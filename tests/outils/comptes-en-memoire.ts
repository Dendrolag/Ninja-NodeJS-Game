/**
 * Des comptes en memoire, pour les tests qui montent un vrai serveur sans base.
 *
 * POURQUOI ILS EXISTENT. Les scenarios de bout en bout et les tests d'integration
 * du client tournent sans base de donnees (decision du 11 septembre 2026: sans
 * DATABASE_URL, le serveur joue en invites seulement). Pour eprouver la page et le
 * client avec un compte, il faut pourtant un serveur qui en connaisse. Le serveur
 * accepte n'importe quel service de comptes (option comptes de creerServeur):
 * celui-ci en est un, tenu en memoire.
 *
 * CE N'EST PAS UNE SECONDE IMPLEMENTATION DES REGLES. Les validations sont celles du
 * paquet partage, les motifs sont ceux d'Authentification, les gains arrivent
 * deja calcules par le serveur de jeu, et les gestes d'amitie sont decides par les
 * fonctions pures du serveur (comptes/amities.ts), ici appliquees a des ensembles. Ce que seul la base garantit (hachage,
 * limites de tentatives, transactions) est verifie contre Neon, dans tests/base.
 * Le mot de passe et le code de secours sont gardes en clair: ce fichier ne sert
 * qu'aux tests, et aucun vrai secret n'y passe.
 *
 * Rien de ce fichier n'est ajoute au jeu: il est fourni au serveur par le test.
 *
 * LES PAQUETS SONT IMPORTES DEPUIS LEUR COMPILATION, PAR CHEMIN. Les scenarios de
 * bout en bout le chargent aussi, et ils ne resolvent pas les noms de paquets
 * (@neon-ninja/...), que seul Vitest sait ramener aux sources. C'est ce que fait deja
 * tout le harnais de bout en bout; la compilation est produite avant les tests, en
 * local comme en integration continue (tsc --build).
 */

import type {
  IdentiteDeCompte,
  MotifDeRefus,
  NouveauResultat,
  NouvellePartie,
  ProgressionAppliquee,
  ReponseDeCompte,
  ServiceDeComptes,
  StatistiquesEnregistreesDUnMode,
} from '../../packages/server/dist/index.js';
import type { EcritureDAmitie, FaitsDAmitie } from '../../packages/server/dist/index.js';
import {
  CODE_DE_SECOURS_INCORRECT,
  JOUEUR_INCONNU,
  MOT_DE_PASSE_INCORRECT,
  deciderDuGeste,
  fabriquerCodeDeSecours,
  faitsApres,
  relationVue,
  statistiquesDeJoueur,
} from '../../packages/server/dist/index.js';
import type {
  ErreurValidation,
  FaceAFace,
  ListeDAmis,
  MaProgression,
  PartieDuProfil,
  PersonneListee,
  SessionInscrite,
  SessionOuverte,
  StatistiquesDeJoueur,
} from '../../packages/shared/dist/index.js';
import {
  JOUEURS_POUR_UNE_VICTOIRE,
  PARTIES_DU_PROFIL,
  formaterCodeDeSecours,
  niveauDeXp,
  palierDePoints,
  reperePseudo,
  validerDemandeChangementMotDePasse,
  validerDemandeCodeDeSecours,
  validerDemandeConnexion,
  validerDemandeDeGeste,
  validerDemandeInscription,
  validerDemandeReinitialisation,
  validerPseudo,
} from '../../packages/shared/dist/index.js';

/** Un compte tenu en memoire. */
interface CompteEnMemoire {
  readonly id: string;
  readonly pseudo: string;
  motDePasse: string;
  /** Le code de secours normalise, sans tiret. */
  codeDeSecours: string;
  readonly inscritLe: Date;
  xpTotale: number;
  pieces: number;
  pointsLigue: number;
  /** Les parties jouees, de la plus recente a la plus ancienne. */
  readonly historique: PartieDuProfil[];
  /** Le placement du compte dans chaque partie jouee, par numero de partie (etape 3.6). */
  readonly placements: Map<number, number>;
}

/** Une fin de partie enregistree. */
export interface FinEnregistree {
  readonly partie: NouvellePartie;
  readonly resultats: readonly NouveauResultat[];
}

/**
 * Les statistiques d'un compte, regroupees par mode comme le fait la base, puis
 * deduites par la fonction du serveur: seul le regroupement est ecrit ici.
 */
function statistiquesDe(compte: CompteEnMemoire): StatistiquesDeJoueur {
  const parMode = new Map<string, StatistiquesEnregistreesDUnMode>();

  for (const partie of compte.historique) {
    const aPlusieurs = partie.nombreJoueurs >= JOUEURS_POUR_UNE_VICTOIRE;
    const seul = partie.nombreJoueurs === 1;
    const fin = new Date(partie.termineeLe);
    const avant = parMode.get(partie.mode);
    const meilleurSeul = avant?.meilleurScoreSeul;

    parMode.set(partie.mode, {
      mode: partie.mode,
      partiesJouees: (avant?.partiesJouees ?? 0) + 1,
      partiesAPlusieurs: (avant?.partiesAPlusieurs ?? 0) + (aPlusieurs ? 1 : 0),
      victoires: (avant?.victoires ?? 0) + (aPlusieurs && partie.placement === 1 ? 1 : 0),
      meilleurScore: Math.max(avant?.meilleurScore ?? 0, partie.points),
      meilleurScoreSeul: seul ? Math.max(meilleurSeul ?? 0, partie.points) : meilleurSeul,
      derniereLe:
        avant === undefined || fin.getTime() > avant.derniereLe.getTime() ? fin : avant.derniereLe,
    });
  }

  return statistiquesDeJoueur([...parMode.values()]);
}

/** Des comptes en memoire, et de quoi les examiner. */
export interface ComptesEnMemoire extends ServiceDeComptes {
  /** Les fins de partie enregistrees, dans l'ordre. */
  readonly fins: readonly FinEnregistree[];
  /** Le compte qui porte ce pseudo, s'il existe. */
  compteNomme(pseudo: string): Readonly<CompteEnMemoire> | undefined;
  /** Le nombre de sessions ouvertes de ce compte (etape 3.4). */
  sessionsDe(pseudo: string): number;
}

/** La cle d'une paire dirigee de comptes. */
function paire(de: string, pour: string): string {
  return `${de}|${pour}`;
}

/** La cle d'une amitie: la paire, dans l'ordre des identifiants, comme en base. */
function paireOrdonnee(a: string, b: string): string {
  return a < b ? paire(a, b) : paire(b, a);
}

/** Les motifs d'Authentification, pour que la page lise les memes phrases qu'en production. */
const MOTIFS = {
  identifiantsIncorrects: 'Pseudo ou mot de passe incorrect.',
  pseudoPris: 'Ce pseudo est déjà pris.',
  sessionAbsente: 'Session absente ou expirée. Connectez-vous.',
} as const;

/** Cree des comptes en memoire, vides. */
export function creerComptesEnMemoire(): ComptesEnMemoire {
  const comptes = new Map<string, CompteEnMemoire>();
  const sessions = new Map<string, string>();
  const ecouteurs = new Set<(compteId: string) => void>();
  const fins: FinEnregistree[] = [];
  const amities = new Set<string>();
  const demandes = new Set<string>();
  const blocages = new Set<string>();
  let compteur = 0;

  const refusee = <T>(
    motif: MotifDeRefus,
    erreurs: readonly ErreurValidation[],
  ): ReponseDeCompte<T> => ({ acceptee: false, motif, erreurs });

  const sessionAbsente = <T>(): ReponseDeCompte<T> =>
    refusee('sessionAbsente', [{ champ: 'session', motif: MOTIFS.sessionAbsente }]);

  const parPseudo = (pseudo: string): CompteEnMemoire | undefined =>
    [...comptes.values()].find((compte) => reperePseudo(compte.pseudo) === reperePseudo(pseudo));

  const ouvrirUneSession = (compte: CompteEnMemoire): SessionOuverte => {
    compteur += 1;
    // Quarante-trois caracteres, la forme des jetons du serveur.
    const jeton = `jeton${String(compteur)}`.padEnd(43, '0');
    sessions.set(jeton, compte.id);

    return { jeton, compte: { pseudo: compte.pseudo, niveau: niveauDeXp(compte.xpTotale) } };
  };

  /** Ferme les sessions de ce compte, sauf celle de ce jeton, et previent les ecouteurs. */
  const fermerLesSessions = (compte: CompteEnMemoire, sauf?: string): void => {
    for (const [jeton, compteId] of sessions) {
      if (compteId === compte.id && jeton !== sauf) {
        sessions.delete(jeton);
      }
    }

    for (const ecouteur of ecouteurs) {
      ecouteur(compte.id);
    }
  };

  /** Un nouveau code pour ce compte, rendu tel qu'on le montre. */
  const renouvelerLeCode = (compte: CompteEnMemoire): string => {
    compte.codeDeSecours = fabriquerCodeDeSecours();

    return formaterCodeDeSecours(compte.codeDeSecours);
  };

  /** Le compte de cette session, si ce mot de passe est le sien. */
  const verifier = (jeton: string, motDePasse: string): ReponseDeCompte<CompteEnMemoire> => {
    const compte = comptes.get(sessions.get(jeton) ?? '');

    if (compte === undefined) {
      return sessionAbsente();
    }

    return compte.motDePasse === motDePasse
      ? { acceptee: true, valeur: compte }
      : refusee('motDePasseIncorrect', [{ champ: 'motDePasse', motif: MOT_DE_PASSE_INCORRECT }]);
  };

  /** Le nombre d'amis de ce compte. */
  const nombreDAmis = (compteId: string): number =>
    [...amities].filter((cle) => cle.split('|').includes(compteId)).length;

  /** Ce qui lie ces deux comptes, vu du premier, comme le lit la base. */
  const faitsEntre = (moi: string, lui: string): FaitsDAmitie => ({
    soi: moi === lui,
    amis: amities.has(paireOrdonnee(moi, lui)),
    demandeEnvoyee: demandes.has(paire(moi, lui)),
    demandeRecue: demandes.has(paire(lui, moi)),
    jeBloque: blocages.has(paire(moi, lui)),
    ilMeBloque: blocages.has(paire(lui, moi)),
    mesAmis: nombreDAmis(moi),
    sesAmis: nombreDAmis(lui),
    mesDemandesEnAttente: [...demandes].filter((cle) => cle.startsWith(`${moi}|`)).length,
  });

  /** Fait une ecriture decidee par les regles, comme la base. */
  const ecrire = (ecriture: EcritureDAmitie, moi: string, lui: string): void => {
    const operations: Record<EcritureDAmitie, () => void> = {
      creerAmitie: () => amities.add(paireOrdonnee(moi, lui)),
      supprimerAmitie: () => amities.delete(paireOrdonnee(moi, lui)),
      creerDemandeEnvoyee: () => demandes.add(paire(moi, lui)),
      supprimerDemandeEnvoyee: () => demandes.delete(paire(moi, lui)),
      supprimerDemandeRecue: () => demandes.delete(paire(lui, moi)),
      creerBlocage: () => blocages.add(paire(moi, lui)),
      supprimerBlocage: () => blocages.delete(paire(moi, lui)),
    };

    operations[ecriture]();
  };

  /** Les amities de ce compte, triees par pseudo comme en base. */
  const listeDe = (compteId: string): ListeDAmis => {
    const listees = (ids: readonly string[]): PersonneListee[] =>
      ids
        .map((id) => comptes.get(id))
        .filter((compte): compte is CompteEnMemoire => compte !== undefined)
        .sort((a, b) => (reperePseudo(a.pseudo) < reperePseudo(b.pseudo) ? -1 : 1))
        .map((compte) => ({ pseudo: compte.pseudo, niveau: niveauDeXp(compte.xpTotale) }));
    const autres = (
      ensemble: Set<string>,
      garder: (de: string, pour: string) => string | undefined,
    ) =>
      [...ensemble].flatMap((cle) => {
        const [de = '', pour = ''] = cle.split('|');
        const autre = garder(de, pour);
        return autre === undefined ? [] : [autre];
      });

    return {
      amis: listees(
        autres(amities, (a, b) => (a === compteId ? b : b === compteId ? a : undefined)),
      ),
      recues: listees(
        autres(demandes, (de, pour) =>
          pour === compteId && !blocages.has(paire(compteId, de)) ? de : undefined,
        ),
      ),
      envoyees: listees(autres(demandes, (de, pour) => (de === compteId ? pour : undefined))),
      bloques: listees(autres(blocages, (de, pour) => (de === compteId ? pour : undefined))),
    };
  };

  /** Les parties que ces deux comptes ont jouees ensemble, vues du premier. */
  const faceAFace = (moi: CompteEnMemoire, lui: CompteEnMemoire): FaceAFace => {
    let partiesEnsemble = 0;
    let devant = 0;
    let derriere = 0;

    for (const [partie, placement] of moi.placements) {
      const sienne = lui.placements.get(partie);

      if (sienne !== undefined) {
        partiesEnsemble += 1;
        devant += placement < sienne ? 1 : 0;
        derriere += placement > sienne ? 1 : 0;
      }
    }

    return { partiesEnsemble, devant, derriere };
  };

  const progressionDe = (compte: CompteEnMemoire): MaProgression => ({
    pseudo: compte.pseudo,
    niveau: niveauDeXp(compte.xpTotale),
    xpTotale: compte.xpTotale,
    pieces: compte.pieces,
    pointsLigue: compte.pointsLigue,
    inscritLe: compte.inscritLe.toISOString(),
  });

  return {
    fins,

    compteNomme: parPseudo,

    sessionsDe: (pseudo) => {
      const compte = parPseudo(pseudo);

      return [...sessions.values()].filter((compteId) => compteId === compte?.id).length;
    },

    inscrire: async (brut): Promise<ReponseDeCompte<SessionInscrite>> => {
      const demande = validerDemandeInscription(brut);
      if (!demande.valide) {
        return refusee('demandeInvalide', demande.erreurs);
      }

      if (parPseudo(demande.valeur.pseudo) !== undefined) {
        return refusee('pseudoPris', [{ champ: 'pseudo', motif: MOTIFS.pseudoPris }]);
      }

      const compte: CompteEnMemoire = {
        id: `compte-${String(comptes.size + 1)}`,
        pseudo: demande.valeur.pseudo,
        motDePasse: demande.valeur.motDePasse,
        codeDeSecours: '',
        inscritLe: new Date('2026-09-11T10:00:00.000Z'),
        xpTotale: 0,
        pieces: 0,
        pointsLigue: 0,
        historique: [],
        placements: new Map(),
      };
      comptes.set(compte.id, compte);
      const codeDeSecours = renouvelerLeCode(compte);

      return { acceptee: true, valeur: { ...ouvrirUneSession(compte), codeDeSecours } };
    },

    connecter: async (brut) => {
      const demande = validerDemandeConnexion(brut);
      if (!demande.valide) {
        return refusee('demandeInvalide', demande.erreurs);
      }

      const compte = parPseudo(demande.valeur.pseudo);

      if (compte === undefined || compte.motDePasse !== demande.valeur.motDePasse) {
        return refusee('identifiantsIncorrects', [
          { champ: 'connexion', motif: MOTIFS.identifiantsIncorrects },
        ]);
      }

      return { acceptee: true, valeur: ouvrirUneSession(compte) };
    },

    deconnecter: async (jeton) => {
      sessions.delete(jeton);
    },

    maProgression: async (jeton) => {
      const compte = comptes.get(sessions.get(jeton) ?? '');

      return compte === undefined
        ? sessionAbsente()
        : { acceptee: true, valeur: progressionDe(compte) };
    },

    // Les statistiques se deduisent de tout l'historique, comme en base.
    profil: async (jeton) => {
      const compte = comptes.get(sessions.get(jeton) ?? '');

      if (compte === undefined) {
        return sessionAbsente();
      }

      return {
        acceptee: true,
        valeur: {
          ...progressionDe(compte),
          statistiques: statistiquesDe(compte),
          dernieresParties: compte.historique.slice(0, PARTIES_DU_PROFIL),
          codeDeSecours: compte.codeDeSecours !== '',
        },
      };
    },

    // Comme Authentification, la limite de lecture en moins: aucun scenario ne l'atteint.
    ficheJoueur: async (jeton, brut) => {
      const lecteur = comptes.get(sessions.get(jeton) ?? '');
      if (lecteur === undefined) {
        return sessionAbsente();
      }

      const pseudo = validerPseudo(brut);
      if (!pseudo.valide) {
        return refusee('demandeInvalide', pseudo.erreurs);
      }

      const compte = parPseudo(pseudo.valeur);
      if (compte === undefined) {
        return refusee('joueurInconnu', [{ champ: 'pseudo', motif: JOUEUR_INCONNU }]);
      }

      return {
        acceptee: true,
        valeur: {
          pseudo: compte.pseudo,
          inscritLe: compte.inscritLe.toISOString(),
          niveau: niveauDeXp(compte.xpTotale),
          palier: palierDePoints(compte.pointsLigue),
          statistiques: statistiquesDe(compte),
          relation: relationVue(faitsEntre(lecteur.id, compte.id)),
          ...(relationVue(faitsEntre(lecteur.id, compte.id)) === 'ami'
            ? { ensemble: faceAFace(lecteur, compte) }
            : {}),
        },
      };
    },

    amis: async (jeton) => {
      const compteId = sessions.get(jeton);

      return compteId === undefined
        ? sessionAbsente()
        : { acceptee: true, valeur: listeDe(compteId) };
    },

    // Comme Authentification, les limites en moins: aucun scenario ne les atteint.
    gesteDAmitie: async (jeton, brut) => {
      const compteId = sessions.get(jeton);
      if (compteId === undefined) {
        return sessionAbsente();
      }

      const demande = validerDemandeDeGeste(brut);
      if (!demande.valide) {
        return refusee('demandeInvalide', demande.erreurs);
      }

      const vise = parPseudo(demande.valeur.pseudo);
      if (vise === undefined) {
        return refusee('joueurInconnu', [{ champ: 'pseudo', motif: JOUEUR_INCONNU }]);
      }

      const faits = faitsEntre(compteId, vise.id);
      const decision = deciderDuGeste(demande.valeur.geste, faits);

      if (!decision.permis) {
        return refusee('gesteImpossible', [{ champ: 'geste', motif: decision.motif }]);
      }

      for (const ecriture of decision.ecritures) {
        ecrire(ecriture, compteId, vise.id);
      }

      return {
        acceptee: true,
        valeur: {
          pseudo: vise.pseudo,
          relation: relationVue(faitsApres(faits, decision.ecritures)),
          amis: listeDe(compteId),
        },
      };
    },

    // Comme Authentification: les autres sessions se ferment, le code est renouvele.
    changerMotDePasse: async (jeton, brut) => {
      const demande = validerDemandeChangementMotDePasse(brut);
      if (!demande.valide) {
        return refusee('demandeInvalide', demande.erreurs);
      }

      const verification = verifier(jeton, demande.valeur.motDePasse);
      if (!verification.acceptee) {
        return verification;
      }

      const compte = verification.valeur;
      compte.motDePasse = demande.valeur.nouveauMotDePasse;
      const codeDeSecours = renouvelerLeCode(compte);
      fermerLesSessions(compte, jeton);

      return { acceptee: true, valeur: { codeDeSecours } };
    },

    nouveauCodeDeSecours: async (jeton, brut) => {
      const demande = validerDemandeCodeDeSecours(brut);
      if (!demande.valide) {
        return refusee('demandeInvalide', demande.erreurs);
      }

      const verification = verifier(jeton, demande.valeur.motDePasse);

      return verification.acceptee
        ? { acceptee: true, valeur: { codeDeSecours: renouvelerLeCode(verification.valeur) } }
        : verification;
    },

    // Comme Authentification: toutes les sessions se ferment, puis une neuve s'ouvre.
    reinitialiser: async (brut): Promise<ReponseDeCompte<SessionInscrite>> => {
      const demande = validerDemandeReinitialisation(brut);
      if (!demande.valide) {
        return refusee('demandeInvalide', demande.erreurs);
      }

      const compte = parPseudo(demande.valeur.pseudo);

      if (compte === undefined || compte.codeDeSecours !== demande.valeur.codeDeSecours) {
        return refusee('identifiantsIncorrects', [
          { champ: 'reinitialisation', motif: CODE_DE_SECOURS_INCORRECT },
        ]);
      }

      compte.motDePasse = demande.valeur.nouveauMotDePasse;
      const codeDeSecours = renouvelerLeCode(compte);
      fermerLesSessions(compte);

      return { acceptee: true, valeur: { ...ouvrirUneSession(compte), codeDeSecours } };
    },

    compteDeSession: async (jeton) => sessions.get(jeton),

    identiteDe: async (compteId): Promise<IdentiteDeCompte | undefined> => {
      const compte = comptes.get(compteId);

      return compte === undefined
        ? undefined
        : { pseudo: compte.pseudo, niveau: niveauDeXp(compte.xpTotale) };
    },

    pseudoDeCompte: async (pseudo) => parPseudo(pseudo) !== undefined,

    surSessionsFermees: (ecouteur) => {
      ecouteurs.add(ecouteur);

      return () => {
        ecouteurs.delete(ecouteur);
      };
    },

    // Les gains arrivent calcules; comme en base, une perte de points de ligue
    // plus grande que le solde est ramenee au solde.
    enregistrerFinDePartie: async (partie, resultats): Promise<readonly ProgressionAppliquee[]> => {
      fins.push({ partie, resultats });
      const numero = fins.length;

      return resultats.map((resultat) => {
        const compte = comptes.get(resultat.compteId);

        if (compte === undefined) {
          throw new Error(`Compte inconnu: ${resultat.compteId}.`);
        }

        const avant = {
          xpTotale: compte.xpTotale,
          pieces: compte.pieces,
          pointsLigue: compte.pointsLigue,
        };

        const variationPointsLigue = Math.max(resultat.variationPointsLigue, -compte.pointsLigue);

        compte.xpTotale += resultat.xpGagnee;
        compte.pieces += resultat.piecesGagnees;
        compte.pointsLigue += variationPointsLigue;
        compte.placements.set(numero, resultat.placement);
        compte.historique.unshift({
          mode: partie.mode,
          carte: partie.carte,
          modeMiroir: partie.modeMiroir,
          placement: resultat.placement,
          nombreJoueurs: partie.nombreJoueurs,
          points: resultat.points,
          xpGagnee: resultat.xpGagnee,
          piecesGagnees: resultat.piecesGagnees,
          variationPointsLigue,
          termineeLe: (partie.termineeLe ?? new Date()).toISOString(),
        });

        return {
          compteId: compte.id,
          avant,
          apres: {
            xpTotale: compte.xpTotale,
            pieces: compte.pieces,
            pointsLigue: compte.pointsLigue,
          },
        };
      });
    },
  };
}
