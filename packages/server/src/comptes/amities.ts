/**
 * Les regles des amities (etape 3.6): ce qu'un geste d'un compte sur un autre a le
 * droit de faire, et ce que chacun voit de l'autre.
 *
 * FONCTIONS PURES. Elles ne lisent ni la base ni l'heure: on leur donne les faits
 * entre deux comptes, lus par la base dans une transaction qui les verrouille, et
 * elles rendent une decision, sous la forme des ecritures a faire. La base les
 * applique (base/amities.ts); les comptes en memoire des tests appliquent les memes
 * decisions a leurs tableaux. Les regles n'existent donc qu'ici.
 *
 * LES REGLES, EN BREF (etude des amis, section 4.1).
 *
 *   - L'amitie est mutuelle: une demande, puis une acceptation. Deux demandes croisees
 *     valent acceptation.
 *   - Refuser, annuler et retirer sont silencieux: l'autre voit seulement la demande,
 *     ou l'ami, disparaitre.
 *   - Bloquer defait l'amitie et les demandes dans les deux sens. LE BLOQUE N'EN SAIT
 *     RIEN: ses demandes nouvelles sont acceptees et enregistrees, et c'est le bloqueur
 *     qui ne les voit pas. Debloquer efface ces demandes ignorees, qui ne resurgissent
 *     pas.
 *   - Deux cents amis au plus de chaque cote, cinquante demandes en attente au plus
 *     pour qui demande (BORNES_AMITIES).
 *   - Tous les gestes sont idempotents: refaire un geste deja fait ne change rien, et
 *     ne refuse rien.
 */

import type { GesteDAmitie, RelationDAmitie } from '@neon-ninja/shared';
import { BORNES_AMITIES } from '@neon-ninja/shared';

/**
 * Ce qui lie deux comptes, vu du premier, « moi », qui fait le geste ou lit la fiche,
 * vers le second, « lui ».
 */
export interface FaitsDAmitie {
  /** Les deux comptes sont le meme. */
  readonly soi: boolean;
  readonly amis: boolean;
  /** Ma demande a lui attend sa reponse. */
  readonly demandeEnvoyee: boolean;
  /** Sa demande a moi attend ma reponse. */
  readonly demandeRecue: boolean;
  /** Je le bloque. */
  readonly jeBloque: boolean;
  /** Il me bloque. Ce fait decide, mais ne se montre jamais. */
  readonly ilMeBloque: boolean;
  /** Mon nombre d'amis. */
  readonly mesAmis: number;
  /** Son nombre d'amis. */
  readonly sesAmis: number;
  /** Mes demandes envoyees qui attendent une reponse, ignorees comprises. */
  readonly mesDemandesEnAttente: number;
}

/** Une ecriture qu'un geste fait, entre moi et lui. */
export type EcritureDAmitie =
  | 'creerAmitie'
  | 'supprimerAmitie'
  | 'creerDemandeEnvoyee'
  | 'supprimerDemandeEnvoyee'
  | 'supprimerDemandeRecue'
  | 'creerBlocage'
  | 'supprimerBlocage';

/** Ce que les regles decident d'un geste. */
export type DecisionDAmitie =
  /** Le geste est permis: ces ecritures, dans cet ordre. Aucune s'il est deja fait. */
  | { readonly permis: true; readonly ecritures: readonly EcritureDAmitie[] }
  /** Le geste est refuse, pour ce motif, que le joueur lira. */
  | { readonly permis: false; readonly motif: string };

/** Le motif d'un geste qui vise son propre compte. */
export const GESTE_SUR_SOI = 'Ce geste ne peut pas viser votre propre compte.';

/** Le motif d'une demande d'ami a soi-meme. */
export const AMI_DE_SOI = 'Vous ne pouvez pas vous ajouter vous-même.';

/** Le motif d'une demande a un compte qu'on bloque. */
export const DEBLOQUER_D_ABORD = 'Vous avez bloqué ce compte. Débloquez-le d’abord.';

/** Le motif d'une acceptation sans demande a accepter. */
export const AUCUNE_DEMANDE = 'Ce compte ne vous a pas demandé d’être amis.';

/** Le motif d'une amitie refusee parce qu'on a deja le nombre maximal d'amis. */
export const MES_AMIS_AU_COMPLET = `Vous avez déjà ${String(BORNES_AMITIES.amisMaximum)} amis. Retirez-en un pour en ajouter un autre.`;

/** Le motif d'une amitie refusee parce que l'autre a deja le nombre maximal d'amis. */
export const SES_AMIS_AU_COMPLET = `Ce compte a déjà ${String(BORNES_AMITIES.amisMaximum)} amis.`;

/** Le motif d'une demande refusee parce qu'on en a trop en attente. */
export const TROP_DE_DEMANDES = `Vous avez déjà ${String(BORNES_AMITIES.demandesEnAttenteMaximum)} demandes en attente. Annulez-en une, ou attendez une réponse.`;

/**
 * Ce que je vois de lui, dans ma liste et sur sa fiche.
 *
 * Qu'il me bloque ne se voit pas: ce qu'il a defait en bloquant n'existe plus, et ma
 * demande ignoree se montre comme n'importe quelle demande qui attend.
 */
export function relationVue(faits: FaitsDAmitie): RelationDAmitie {
  if (faits.soi) {
    return 'soi';
  }

  if (faits.jeBloque) {
    return 'bloque';
  }

  if (faits.amis) {
    return 'ami';
  }

  if (faits.demandeRecue) {
    return 'demandeRecue';
  }

  return faits.demandeEnvoyee ? 'demandeEnvoyee' : 'aucune';
}

/** Decide d'un geste que je fais sur lui. */
export function deciderDuGeste(geste: GesteDAmitie, faits: FaitsDAmitie): DecisionDAmitie {
  if (faits.soi) {
    return refuse(geste === 'demander' ? AMI_DE_SOI : GESTE_SUR_SOI);
  }

  switch (geste) {
    case 'demander':
      return demander(faits);

    case 'accepter':
      return accepter(faits);

    case 'refuser':
      return permis(faits.demandeRecue ? ['supprimerDemandeRecue'] : []);

    case 'annuler':
      return permis(faits.demandeEnvoyee ? ['supprimerDemandeEnvoyee'] : []);

    case 'retirer':
      return permis(faits.amis ? ['supprimerAmitie'] : []);

    case 'bloquer':
      return bloquer(faits);

    // Ses demandes arrivees pendant le blocage ont ete ignorees: elles ne resurgissent
    // pas au deblocage.
    case 'debloquer':
      return permis(
        faits.jeBloque
          ? ['supprimerBlocage', ...(faits.demandeRecue ? ['supprimerDemandeRecue' as const] : [])]
          : [],
      );
  }
}

/**
 * Demander d'etre amis. Une demande croisee vaut acceptation; une demande a un compte
 * qui me bloque s'enregistre comme les autres, et il ne la verra pas.
 */
function demander(faits: FaitsDAmitie): DecisionDAmitie {
  if (faits.jeBloque) {
    return refuse(DEBLOQUER_D_ABORD);
  }

  if (faits.amis || faits.demandeEnvoyee) {
    return permis([]);
  }

  if (faits.demandeRecue) {
    return devenirAmis(faits);
  }

  if (faits.mesAmis >= BORNES_AMITIES.amisMaximum) {
    return refuse(MES_AMIS_AU_COMPLET);
  }

  if (faits.mesDemandesEnAttente >= BORNES_AMITIES.demandesEnAttenteMaximum) {
    return refuse(TROP_DE_DEMANDES);
  }

  return permis(['creerDemandeEnvoyee']);
}

/**
 * Accepter sa demande. Une demande que j'ignore parce que je le bloque n'existe pas pour
 * moi: il n'y a rien a accepter.
 */
function accepter(faits: FaitsDAmitie): DecisionDAmitie {
  if (faits.amis) {
    return permis([]);
  }

  if (!faits.demandeRecue || faits.jeBloque) {
    return refuse(AUCUNE_DEMANDE);
  }

  return devenirAmis(faits);
}

/** L'amitie, a partir de sa demande a lui, si aucun des deux n'est au complet. */
function devenirAmis(faits: FaitsDAmitie): DecisionDAmitie {
  if (faits.mesAmis >= BORNES_AMITIES.amisMaximum) {
    return refuse(MES_AMIS_AU_COMPLET);
  }

  if (faits.sesAmis >= BORNES_AMITIES.amisMaximum) {
    return refuse(SES_AMIS_AU_COMPLET);
  }

  return permis([
    'supprimerDemandeRecue',
    ...(faits.demandeEnvoyee ? ['supprimerDemandeEnvoyee' as const] : []),
    'creerAmitie',
  ]);
}

/** Bloquer: tout ce qui nous lie est defait, dans les deux sens. */
function bloquer(faits: FaitsDAmitie): DecisionDAmitie {
  if (faits.jeBloque) {
    return permis([]);
  }

  return permis([
    ...(faits.amis ? ['supprimerAmitie' as const] : []),
    ...(faits.demandeEnvoyee ? ['supprimerDemandeEnvoyee' as const] : []),
    ...(faits.demandeRecue ? ['supprimerDemandeRecue' as const] : []),
    'creerBlocage',
  ]);
}

/**
 * Les faits apres ces ecritures. Les comptes restent les memes, leurs nombres d'amis et
 * de demandes suivent.
 */
export function faitsApres(
  faits: FaitsDAmitie,
  ecritures: readonly EcritureDAmitie[],
): FaitsDAmitie {
  return ecritures.reduce<FaitsDAmitie>((avant, ecriture) => {
    switch (ecriture) {
      case 'creerAmitie':
        return avant.amis
          ? avant
          : { ...avant, amis: true, mesAmis: avant.mesAmis + 1, sesAmis: avant.sesAmis + 1 };
      case 'supprimerAmitie':
        return avant.amis
          ? { ...avant, amis: false, mesAmis: avant.mesAmis - 1, sesAmis: avant.sesAmis - 1 }
          : avant;
      case 'creerDemandeEnvoyee':
        return avant.demandeEnvoyee
          ? avant
          : {
              ...avant,
              demandeEnvoyee: true,
              mesDemandesEnAttente: avant.mesDemandesEnAttente + 1,
            };
      case 'supprimerDemandeEnvoyee':
        return avant.demandeEnvoyee
          ? {
              ...avant,
              demandeEnvoyee: false,
              mesDemandesEnAttente: avant.mesDemandesEnAttente - 1,
            }
          : avant;
      case 'supprimerDemandeRecue':
        return { ...avant, demandeRecue: false };
      case 'creerBlocage':
        return { ...avant, jeBloque: true };
      case 'supprimerBlocage':
        return { ...avant, jeBloque: false };
    }
  }, faits);
}

/** Une decision qui permet ces ecritures. */
function permis(ecritures: readonly EcritureDAmitie[]): DecisionDAmitie {
  return { permis: true, ecritures };
}

/** Une decision qui refuse, pour ce motif. */
function refuse(motif: string): DecisionDAmitie {
  return { permis: false, motif };
}
