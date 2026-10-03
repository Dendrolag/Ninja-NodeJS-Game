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
  FaitsDesComptes,
  IdentiteDeCompte,
  MotifDeRefus,
  NouveauResultat,
  NouvellePartie,
  ProgressionAppliquee,
  ReponseDeCompte,
  ServiceDeComptes,
  StatistiquesEnregistreesDUnMode,
  SuccesEnregistre,
} from '../../packages/server/dist/index.js';
import type { EcritureDAmitie, FaitsDAmitie } from '../../packages/server/dist/index.js';
import {
  CODE_DE_SECOURS_INCORRECT,
  JOUEUR_INCONNU,
  MOT_DE_PASSE_INCORRECT,
  SUCCES_NON_OBTENU,
  deciderDuGeste,
  fabriquerCodeDeSecours,
  faitsApres,
  relationVue,
  statistiquesDeJoueur,
  succesDeFiche,
  succesDeFin,
  succesDuProfil,
} from '../../packages/server/dist/index.js';
import type {
  DefiReleve,
  DefisDeFin,
  DefisDeLaSemaine,
  ErreurValidation,
  FaceAFace,
  IdentifiantSucces,
  ListeDAmis,
  MaProgression,
  ParcoursDeSucces,
  PartieDuParcours,
  PartieDuProfil,
  PersonneListee,
  SessionInscrite,
  SessionOuverte,
  StatistiquesDeJoueur,
} from '../../packages/shared/dist/index.js';
import {
  JOUEURS_POUR_UNE_VICTOIRE,
  PARTIES_DU_PROFIL,
  avancementsDeLaSemaine,
  defisDeLaSemaine,
  formaterCodeDeSecours,
  niveauDeXp,
  palierDePoints,
  parcoursDe,
  reperePseudo,
  semaineDuJour,
  semaineSuivante,
  validerDemandeChangementMotDePasse,
  validerDemandeCodeDeSecours,
  validerDemandeConnexion,
  validerDemandeDeGeste,
  validerDemandeDeTitre,
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
  /**
   * Ses parties, de la plus ancienne a la plus recente, telles que le pli des succes les
   * lit, sans les amis, qui se relisent a chaque attribution (etape 3.7).
   */
  readonly parcours: PartieJouee[];
  /** Ses succes inscrits (etape 3.7). */
  readonly succes: Map<IdentifiantSucces, SuccesEnregistre>;
  /** Le titre choisi parmi ses succes (etape 3.9). */
  titre: IdentifiantSucces | undefined;
  /** Ses defis releves, par semaine puis par defi: l'XP versee et la partie (etape 3.10). */
  readonly defis: Map<string, Map<string, { readonly xp: number; readonly partieId: string }>>;
}

/** Une partie jouee par un compte, pour le pli des succes. */
interface PartieJouee {
  readonly numero: number;
  readonly partieId: string;
  readonly termineeLe: Date;
  readonly partie: Omit<PartieDuParcours, 'amis'>;
}

/** Le jour d'une date a l'heure de Paris, comme la base l'ecrit: « 2026-09-26 ». */
const JOUR_A_PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * L'instant ou commence ce jour a Paris, en temps universel: minuit a Paris est 22 h ou
 * 23 h la veille, selon l'heure d'ete. Comme la base, qui le calcule elle-meme.
 */
function minuitAParis(jour: string): Date {
  for (const decalageH of [1, 2]) {
    const instant = new Date(Date.parse(`${jour}T00:00:00Z`) - decalageH * 3_600_000);
    const heure = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(instant);

    if (JOUR_A_PARIS.format(instant) === jour && heure === '00') {
      return instant;
    }
  }

  throw new Error(`Minuit introuvable a Paris le ${jour}.`);
}

/** Une fin de partie enregistree. */
export interface FinEnregistree {
  readonly partie: NouvellePartie;
  readonly resultats: readonly NouveauResultat[];
  /** Les faits de partie des comptes presents a la fin (etape 3.8). */
  readonly faits: FaitsDesComptes;
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
  /**
   * Inscrit ce succes pour le compte qui porte ce pseudo, sans partie d'origine, comme un
   * rattrapage (etape 3.9): un scenario du titre n'a pas a jouer les parties d'un succes.
   */
  accorderUnSucces(pseudo: string, succes: IdentifiantSucces): void;
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
  const ecouteursDesAmities = new Set<(auteur: string, vise: string) => void>();
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

  /** Les parties de ce compte, avec ses amis d'aujourd'hui dans chaque partie, comme en base. */
  const parcoursAvecLesAmis = (compte: CompteEnMemoire): PartieDuParcours[] =>
    compte.parcours.map((jouee) => ({
      ...jouee.partie,
      amis: [...comptes.values()].flatMap((autre) => {
        const placement = autre.placements.get(jouee.numero);

        return autre.id !== compte.id &&
          placement !== undefined &&
          amities.has(paireOrdonnee(compte.id, autre.id))
          ? [{ compte: autre.id, placement }]
          : [];
      }),
    }));

  /** Le parcours de ce compte, tel que le pli des succes le lit. */
  const parcoursDuCompte = (compte: CompteEnMemoire): ParcoursDeSucces =>
    parcoursDe(parcoursAvecLesAmis(compte));

  /** Les parties de ce compte finies dans cette semaine, telles que les defis les lisent. */
  const partiesDeLaSemaine = (compte: CompteEnMemoire, semaine: string): PartieDuParcours[] =>
    parcoursAvecLesAmis(compte).filter((partie) => semaineDuJour(partie.jour) === semaine);

  /** L'XP versee pour chaque defi releve cette semaine. */
  const xpDesReleves = (compte: CompteEnMemoire, semaine: string): Map<string, number> =>
    new Map([...(compte.defis.get(semaine) ?? [])].map(([id, releve]) => [id, releve.xp]));

  /**
   * Releve les defis que la partie fait atteindre a ce compte, comme en base: l'XP de ceux
   * qui s'inscrivent s'ajoute au compte et a la partie, avant les succes.
   */
  const releverLesDefis = (compte: CompteEnMemoire, partieId: string): DefisDeFin => {
    const index = compte.parcours.findIndex((jouee) => jouee.partieId === partieId);
    const jouee = compte.parcours[index];

    if (jouee === undefined) {
      throw new Error(`La partie ${partieId} manque au parcours de ${compte.pseudo}.`);
    }

    const semaine = semaineDuJour(jouee.partie.jour);
    const releves = compte.defis.get(semaine) ?? new Map();
    const nouveaux: DefiReleve[] = [];

    for (const avancement of avancementsDeLaSemaine(
      semaine,
      partiesDeLaSemaine(compte, semaine),
      xpDesReleves(compte, semaine),
    )) {
      if (!avancement.accompli && avancement.actuel >= avancement.seuil) {
        releves.set(avancement.id, { xp: avancement.xp, partieId });
        nouveaux.push({ id: avancement.id, xp: avancement.xp });
      }
    }

    compte.defis.set(semaine, releves);
    const xp = nouveaux.reduce((total, releve) => total + releve.xp, 0);

    if (xp > 0) {
      compte.xpTotale += xp;
      compte.parcours[index] = { ...jouee, partie: { ...jouee.partie, xpDesDefis: xp } };
    }

    // Dans l'ordre des familles, celui de la semaine.
    const ordre: readonly string[] = defisDeLaSemaine(semaine);

    return {
      releves: nouveaux.sort((a, b) => ordre.indexOf(a.id) - ordre.indexOf(b.id)),
      defis: avancementsDeLaSemaine(
        semaine,
        partiesDeLaSemaine(compte, semaine),
        xpDesReleves(compte, semaine),
      ),
    };
  };

  /** Inscrit les succes atteints de ce compte, dates de leur partie d'origine, comme en base. */
  const attribuer = (compte: CompteEnMemoire): ParcoursDeSucces => {
    const parcours = parcoursDuCompte(compte);

    for (const [id, index] of parcours.premieres) {
      const origine = compte.parcours[index];

      if (origine !== undefined && !compte.succes.has(id)) {
        compte.succes.set(id, { debloqueLe: origine.termineeLe, partieId: origine.partieId });
      }
    }

    return parcours;
  };

  /** La rarete de chaque succes, parmi les comptes qui ont joue, comme en base. */
  const raretes = (): Map<IdentifiantSucces, number> => {
    const joueurs = [...comptes.values()].filter((compte) => compte.parcours.length > 0);
    const parSucces = new Map<IdentifiantSucces, number>();

    for (const compte of joueurs) {
      for (const id of compte.succes.keys()) {
        parSucces.set(id, (parSucces.get(id) ?? 0) + 1);
      }
    }

    return new Map([...parSucces].map(([id, nombre]) => [id, (nombre * 100) / joueurs.length]));
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

    accorderUnSucces: (pseudo, succes) => {
      const compte = parPseudo(pseudo);

      if (compte === undefined) {
        throw new Error(`Aucun compte ne porte le pseudo ${pseudo}.`);
      }

      compte.succes.set(succes, { debloqueLe: new Date(), partieId: undefined });
    },

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
        parcours: [],
        succes: new Map(),
        titre: undefined,
        defis: new Map(),
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
          succes: succesDuProfil(parcoursDuCompte(compte).mesures, compte.succes, raretes()),
          ...(compte.titre === undefined ? {} : { titre: compte.titre }),
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
          succes: succesDeFiche(compte.succes, raretes()),
          ...(compte.titre === undefined ? {} : { titre: compte.titre }),
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

      // Comme Authentification: un geste qui a ecrit previent la couche reseau (etape 2.8).
      if (decision.ecritures.length > 0) {
        for (const ecouteur of ecouteursDesAmities) {
          ecouteur(compteId, vise.id);
        }
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

    // Comme la base: la semaine en cours a Paris, ses parties et ses defis releves.
    defis: async (jeton): Promise<ReponseDeCompte<DefisDeLaSemaine>> => {
      const compte = comptes.get(sessions.get(jeton) ?? '');
      if (compte === undefined) {
        return sessionAbsente();
      }

      const semaine = semaineDuJour(JOUR_A_PARIS.format(new Date()));

      return {
        acceptee: true,
        valeur: {
          semaine,
          finLe: minuitAParis(semaineSuivante(semaine)).toISOString(),
          defis: avancementsDeLaSemaine(
            semaine,
            partiesDeLaSemaine(compte, semaine),
            xpDesReleves(compte, semaine),
          ),
        },
      };
    },

    // Comme Authentification: un titre n'est qu'un succes obtenu, et null le retire.
    choisirUnTitre: async (jeton, brut) => {
      const compte = comptes.get(sessions.get(jeton) ?? '');
      if (compte === undefined) {
        return sessionAbsente();
      }

      const demande = validerDemandeDeTitre(brut);
      if (!demande.valide) {
        return refusee('demandeInvalide', demande.erreurs);
      }

      const { titre } = demande.valeur;

      if (titre !== null && !compte.succes.has(titre)) {
        return refusee('succesNonObtenu', [{ champ: 'titre', motif: SUCCES_NON_OBTENU }]);
      }

      compte.titre = titre ?? undefined;

      return { acceptee: true, valeur: titre === null ? {} : { titre } };
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

      if (compte === undefined) {
        return undefined;
      }

      return {
        pseudo: compte.pseudo,
        niveau: niveauDeXp(compte.xpTotale),
        ...(compte.titre === undefined ? {} : { titre: compte.titre }),
      };
    },

    pseudoDeCompte: async (pseudo) => parPseudo(pseudo) !== undefined,

    surSessionsFermees: (ecouteur) => {
      ecouteurs.add(ecouteur);

      return () => {
        ecouteurs.delete(ecouteur);
      };
    },

    // Les amis d'un compte, dans l'ordre de sa liste, comme en base (etape 2.8).
    amisDe: async (compteId) =>
      listeDe(compteId).amis.flatMap((ami) => {
        const compte = parPseudo(ami.pseudo);
        return compte === undefined ? [] : [{ compteId: compte.id, pseudo: compte.pseudo }];
      }),

    surAmitiesChangees: (ecouteur) => {
      ecouteursDesAmities.add(ecouteur);

      return () => {
        ecouteursDesAmities.delete(ecouteur);
      };
    },

    // Les gains arrivent calcules. Comme en base, une perte de points de ligue plus
    // grande que le solde est ramenee au solde, et les succes s'attribuent une fois tous
    // les resultats de la partie ecrits.
    enregistrerFinDePartie: async (
      partie,
      resultats,
      faits = new Map(),
    ): Promise<readonly ProgressionAppliquee[]> => {
      fins.push({ partie, resultats, faits });
      const numero = fins.length;
      const partieId = partie.id ?? `partie-${String(numero)}`;
      const termineeLe = partie.termineeLe ?? new Date();

      const gains = resultats.map((resultat) => {
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
        const faitsDuCompte = faits.get(resultat.compteId);

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
          termineeLe: termineeLe.toISOString(),
        });
        compte.parcours.push({
          numero,
          partieId,
          termineeLe,
          partie: {
            mode: partie.mode,
            carte: partie.carte,
            modeMiroir: partie.modeMiroir,
            nombreJoueurs: partie.nombreJoueurs,
            dureeS: partie.dureeS,
            placement: resultat.placement,
            captures: resultat.captures,
            botsNoirsDetruits: resultat.botsNoirsDetruits,
            xpGagnee: resultat.xpGagnee,
            variationPointsLigue,
            jour: JOUR_A_PARIS.format(termineeLe),
            // Comme en base, les faits vont avec le resultat du compte (etape 3.8).
            ...(faitsDuCompte === undefined ? {} : { faits: faitsDuCompte }),
          },
        });

        return {
          compte,
          compteId: compte.id,
          avant,
          apres: {
            xpTotale: compte.xpTotale,
            pieces: compte.pieces,
            pointsLigue: compte.pointsLigue,
          },
        };
      });

      // Les defis d'abord, comme en base: leur XP compte dans les succes de niveau.
      return gains.map(({ compte, ...appliquee }) => {
        const defis = releverLesDefis(compte, partieId);

        return {
          ...appliquee,
          apres: { ...appliquee.apres, xpTotale: compte.xpTotale },
          defis,
          succes: succesDeFin(partieId, attribuer(compte).mesures, compte.succes),
        };
      });
    },
  };
}
