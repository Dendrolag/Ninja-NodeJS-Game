/**
 * Le souvenir des notes de version deja lues (etape 4.9), dans le navigateur.
 *
 * UNE FOIS PAR NAVIGATEUR ET PAR VERSION. Fermee, la note 1.5 ne revient plus; la
 * note 1.6 s'affichera a son tour. Le souvenir est la derniere version mineure vue,
 * rangee dans le stockage du navigateur. Il ne voyage pas avec le compte: c'est hors
 * du perimetre de l'etape.
 *
 * UN JOUEUR TOUT NOUVEAU NE LA VOIT PAS: tout est nouveau pour lui. Est nouveau un
 * navigateur qui ne connait ni version deja vue, ni aucune trace d'un passage: pas
 * de session de compte, pas de reglage du son ni du sang. Il retient quand meme la
 * version courante comme vue, pour que la note suivante lui soit montree.
 * Consequence assumee: un invite d'avant cette etape qui n'a jamais rien regle est
 * pris pour un nouveau joueur, et ne lit que les notes a partir de la suivante.
 *
 * LE STOCKAGE PEUT MANQUER (navigation privee, donnees de site refusees). Alors la
 * note ne s'affiche pas: sans souvenir, elle reviendrait a chaque visite, et elle ne
 * doit jamais gener l'accueil. Toute lecture ou ecriture est protegee.
 */

import { versionMineure } from '@neon-ninja/shared';

import { CLE_JETON } from '../comptes/coffre.js';
import type { NoteDeVersion } from './modeles/notesDeVersion.js';
import { noteDeLaVersion, notesParues } from './modeles/notesDeVersion.js';
import { CLE_PREFERENCE_SANG, CLE_PREFERENCES_SON } from './preferences.js';

/** La cle sous laquelle la derniere version mineure vue est rangee. */
export const CLE_VERSION_VUE = 'neon-ninja.version-vue';

/** Les cles dont la presence dit qu'un joueur est deja passe par ce navigateur. */
export const CLES_D_UN_PASSAGE: readonly string[] = [
  CLE_JETON,
  CLE_PREFERENCES_SON,
  CLE_PREFERENCE_SANG,
];

/** Ce que l'on sait de ce navigateur, au chargement de la page. */
export interface CeQueSaitLeNavigateur {
  /** La derniere version mineure vue, absente si aucune ne l'a ete. */
  readonly versionVue: string | undefined;
  /** Un joueur est-il deja passe par ce navigateur. */
  readonly dejaVenu: boolean;
}

/**
 * Ce qu'il faut faire de la note, au chargement de la page.
 *
 * - `montrer`: le joueur revient, et n'a pas lu cette version;
 * - `retenir`: un nouveau joueur, a qui l'on ne montre rien, mais dont on retient
 *   la version courante;
 * - `rien`: deja lue, ou aucune note pour cette version.
 */
export type DecisionDeLaNote = 'montrer' | 'retenir' | 'rien';

/** Decide du sort de la note de cette version mineure. */
export function decisionDeLaNote(
  mineure: string,
  aUneNote: boolean,
  navigateur: CeQueSaitLeNavigateur,
): DecisionDeLaNote {
  if (navigateur.versionVue === mineure) {
    return 'rien';
  }

  if (navigateur.versionVue === undefined && !navigateur.dejaVenu) {
    return 'retenir';
  }

  return aUneNote ? 'montrer' : 'rien';
}

/** Le souvenir de la note, pour la page en cours. */
export interface SouvenirDeVersion {
  /** La note de la version servie, celle dont on decide l'ouverture. */
  readonly note: NoteDeVersion | undefined;
  /**
   * Les notes parues jusqu'a la version servie, la plus recente en tete: ce que la
   * fenetre des nouveautes fait defiler, et que le pied de l'accueil rouvre.
   */
  readonly historique: readonly NoteDeVersion[];
  /** La note doit-elle s'ouvrir d'elle-meme a l'accueil. */
  readonly aMontrer: boolean;
  /** Retient la note comme lue: elle ne s'ouvrira plus d'elle-meme. */
  marquerLue(): void;
}

/**
 * Lit le souvenir de ce navigateur, une fois, au montage de l'application: un
 * nouveau joueur qui regle le son pendant sa visite ne doit pas devenir, a son
 * retour sur l'accueil, un joueur qui revient.
 *
 * @param stockage Le stockage du navigateur, absent s'il est refuse.
 * @param numero   Le numero de version servi.
 * @param notes    Les notes, celles du jeu par defaut.
 */
export function lireLeSouvenirDeVersion(
  stockage: Storage | undefined,
  numero: string,
  notes?: readonly NoteDeVersion[],
): SouvenirDeVersion {
  const note = noteDeLaVersion(numero, notes);
  const mineure = versionMineure(numero);
  let aMontrer = false;

  const retenir = (): void => {
    essayer(() => {
      stockage?.setItem(CLE_VERSION_VUE, mineure);
    });
  };

  const navigateur = essayer(() =>
    stockage === undefined
      ? undefined
      : {
          versionVue: stockage.getItem(CLE_VERSION_VUE) ?? undefined,
          dejaVenu: CLES_D_UN_PASSAGE.some((cle) => stockage.getItem(cle) !== null),
        },
  );

  if (navigateur !== undefined) {
    const decision = decisionDeLaNote(mineure, note !== undefined, navigateur);

    if (decision === 'retenir') {
      retenir();
    }

    aMontrer = decision === 'montrer';
  }

  return {
    note,
    historique: notesParues(numero, notes),
    get aMontrer() {
      return aMontrer;
    },
    marquerLue() {
      aMontrer = false;
      retenir();
    },
  };
}

/** Execute une operation sur le stockage, sans jamais lever. */
function essayer<T>(operation: () => T): T | undefined {
  try {
    return operation();
  } catch {
    return undefined;
  }
}
