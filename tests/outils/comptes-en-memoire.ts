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
 * paquet partage, les motifs sont ceux d'Authentification, et les gains arrivent
 * deja calcules par le serveur de jeu. Ce que seul la base garantit (hachage,
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
} from '../../packages/server/dist/index.js';
import {
  CODE_DE_SECOURS_INCORRECT,
  MOT_DE_PASSE_INCORRECT,
  fabriquerCodeDeSecours,
} from '../../packages/server/dist/index.js';
import type {
  ErreurValidation,
  MaProgression,
  PartieDuProfil,
  SessionInscrite,
  SessionOuverte,
} from '../../packages/shared/dist/index.js';
import {
  JOUEURS_POUR_UNE_VICTOIRE,
  PARTIES_DU_PROFIL,
  formaterCodeDeSecours,
  niveauDeXp,
  reperePseudo,
  validerDemandeChangementMotDePasse,
  validerDemandeCodeDeSecours,
  validerDemandeConnexion,
  validerDemandeInscription,
  validerDemandeReinitialisation,
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
}

/** Une fin de partie enregistree. */
export interface FinEnregistree {
  readonly partie: NouvellePartie;
  readonly resultats: readonly NouveauResultat[];
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

      const victoires = compte.historique.filter(
        (partie) => partie.placement === 1 && partie.nombreJoueurs >= JOUEURS_POUR_UNE_VICTOIRE,
      ).length;
      const scores = compte.historique.map((partie) => partie.points);

      return {
        acceptee: true,
        valeur: {
          ...progressionDe(compte),
          statistiques:
            scores.length === 0
              ? { partiesJouees: 0, victoires }
              : { partiesJouees: scores.length, victoires, meilleurScore: Math.max(...scores) },
          dernieresParties: compte.historique.slice(0, PARTIES_DU_PROFIL),
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
