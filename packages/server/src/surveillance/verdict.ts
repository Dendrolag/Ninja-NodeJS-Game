/**
 * Le verdict: une partie est-elle fluide, et sinon, ou nait la saccade (etape 5.15).
 *
 * C'EST LA METHODE DE LECTURE DES AUDITS 8.5 ET 8.6, appliquee en continu. Une saccade a
 * trois origines, qu'on teste dans l'ordre ou elles se masquent l'une l'autre:
 *
 *   1. LE SERVEUR, si ses battements partent en retard: tout ce qui suit en souffre.
 *   2. LE RESEAU, si les instantanes arrivent en retard alors que le serveur bat a l'heure.
 *   3. LA PAGE, si les images sont lentes alors que les instantanes arrivent a l'heure.
 *
 * Les memes seuils servent au journal, au tableau de Grafana et aux alertes
 * (deploiement/grafana/): les changer ici demande de les changer la-bas.
 */

/** D'ou vient une saccade. */
export type OrigineDUneSaccade = 'serveur' | 'reseau' | 'page';

/** Le verdict d'une partie. */
export type Verdict = 'fluide' | OrigineDUneSaccade;

/** Les parts au-dela desquelles une origine est mise en cause. */
export const SEUILS_DU_VERDICT = {
  /** Battements d'au moins 100 ms d'ecart: plus de 1 pour cent. */
  battementsEnRetard: 0.01,
  /** Instantanes recus d'au moins 100 ms d'ecart: plus de 5 pour cent. */
  instantanesEnRetard: 0.05,
  /** Images d'au moins 50 ms: plus de 5 pour cent. */
  imagesLentes: 0.05,
} as const;

/** Ce qu'il faut compter pour juger. */
export interface ComptesDuVerdict {
  readonly battements: number;
  readonly battementsEnRetard: number;
  readonly instantanes: number;
  readonly instantanesEnRetard: number;
  readonly images: number;
  readonly imagesLentes: number;
}

/** Une part, ou zero sans rien a diviser. */
export function part(compte: number, total: number): number {
  return total > 0 ? compte / total : 0;
}

/** Le verdict de ces comptes. */
export function verdict(comptes: ComptesDuVerdict): Verdict {
  if (part(comptes.battementsEnRetard, comptes.battements) > SEUILS_DU_VERDICT.battementsEnRetard) {
    return 'serveur';
  }

  if (
    part(comptes.instantanesEnRetard, comptes.instantanes) > SEUILS_DU_VERDICT.instantanesEnRetard
  ) {
    return 'reseau';
  }

  if (part(comptes.imagesLentes, comptes.images) > SEUILS_DU_VERDICT.imagesLentes) {
    return 'page';
  }

  return 'fluide';
}
