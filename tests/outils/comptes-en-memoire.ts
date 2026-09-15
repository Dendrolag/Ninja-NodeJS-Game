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
 * Le mot de passe est garde en clair: ce fichier ne sert qu'aux tests, et aucun
 * vrai mot de passe n'y passe.
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
  NouveauResultat,
  NouvellePartie,
  ProgressionAppliquee,
  ReponseDeCompte,
  ServiceDeComptes,
} from '../../packages/server/dist/index.js';
import type {
  ErreurValidation,
  MaProgression,
  PartieDuProfil,
  SessionOuverte,
} from '../../packages/shared/dist/index.js';
import {
  JOUEURS_POUR_UNE_VICTOIRE,
  PARTIES_DU_PROFIL,
  niveauDeXp,
  reperePseudo,
  validerDemandeConnexion,
  validerDemandeInscription,
} from '../../packages/shared/dist/index.js';

/** Un compte tenu en memoire. */
interface CompteEnMemoire {
  readonly id: string;
  readonly pseudo: string;
  readonly motDePasse: string;
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
  const fins: FinEnregistree[] = [];
  let compteur = 0;

  const refusee = <T>(
    motif: 'demandeInvalide' | 'pseudoPris' | 'identifiantsIncorrects' | 'sessionAbsente',
    erreurs: readonly ErreurValidation[],
  ): ReponseDeCompte<T> => ({ acceptee: false, motif, erreurs });

  const parPseudo = (pseudo: string): CompteEnMemoire | undefined =>
    [...comptes.values()].find((compte) => reperePseudo(compte.pseudo) === reperePseudo(pseudo));

  const ouvrirUneSession = (compte: CompteEnMemoire): SessionOuverte => {
    compteur += 1;
    // Quarante-trois caracteres, la forme des jetons du serveur.
    const jeton = `jeton${String(compteur)}`.padEnd(43, '0');
    sessions.set(jeton, compte.id);

    return { jeton, compte: { pseudo: compte.pseudo, niveau: niveauDeXp(compte.xpTotale) } };
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

    inscrire: async (brut) => {
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
        inscritLe: new Date('2026-09-11T10:00:00.000Z'),
        xpTotale: 0,
        pieces: 0,
        pointsLigue: 0,
        historique: [],
      };
      comptes.set(compte.id, compte);

      return { acceptee: true, valeur: ouvrirUneSession(compte) };
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
        ? refusee('sessionAbsente', [{ champ: 'session', motif: MOTIFS.sessionAbsente }])
        : { acceptee: true, valeur: progressionDe(compte) };
    },

    // Les statistiques se deduisent de tout l'historique, comme en base.
    profil: async (jeton) => {
      const compte = comptes.get(sessions.get(jeton) ?? '');

      if (compte === undefined) {
        return refusee('sessionAbsente', [{ champ: 'session', motif: MOTIFS.sessionAbsente }]);
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

    compteDeSession: async (jeton) => sessions.get(jeton),

    identiteDe: async (compteId): Promise<IdentiteDeCompte | undefined> => {
      const compte = comptes.get(compteId);

      return compte === undefined
        ? undefined
        : { pseudo: compte.pseudo, niveau: niveauDeXp(compte.xpTotale) };
    },

    pseudoDeCompte: async (pseudo) => parPseudo(pseudo) !== undefined,

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
