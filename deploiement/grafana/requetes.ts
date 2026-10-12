/**
 * Les requetes que partagent le tableau « Fluidite » et les alertes (etape 5.15).
 *
 * LES MEMES SEUILS QUE LE VERDICT DU JOURNAL (packages/server/src/surveillance/verdict.ts):
 * plus de 1 pour cent de battements en retard met le serveur en cause; plus de 5 pour cent
 * d'instantanes en retard, le reseau; plus de 5 pour cent d'images lentes, la page. Les
 * changer ici demande de les changer la-bas.
 *
 * Toutes les metriques du serveur repartent de zero a chaque redemarrage, donc a chaque mise
 * en ligne: on ne lit que des taux (rate, increase), qui le savent.
 */

/** Les seuils du verdict, en parts. */
export const SEUILS = {
  battementsEnRetard: 0.01,
  instantanesEnRetard: 0.05,
  imagesLentes: 0.05,
} as const;

/** La part de battements en retard, sur cette fenetre. */
export function partDesBattementsEnRetard(fenetre = '5m'): string {
  return `sum(rate(neon_battements_en_retard_total[${fenetre}])) / sum(rate(neon_battements_total[${fenetre}]))`;
}

/** La part d'instantanes recus en retard par les pages. */
export function partDesInstantanesEnRetard(fenetre = '5m'): string {
  return `sum(rate(neon_page_instantanes_en_retard_total[${fenetre}])) / sum(rate(neon_page_instantanes_total[${fenetre}]))`;
}

/** Le decalage d'une fenetre dans le passe, ecrit apres elle: rien, ou « offset 1h ». */
function decale(decalage: string): string {
  return decalage === '' ? '' : ` offset ${decalage}`;
}

/** La part d'images lentes (au moins 50 ms) dans les pages. */
export function partDesImagesLentes(fenetre = '5m', par = '', decalage = ''): string {
  const groupe = par === '' ? '' : ` by (${par})`;
  const plage = `[${fenetre}]${decale(decalage)}`;

  return `sum${groupe}(rate(neon_page_images_lentes_total{seuil="50"}${plage})) / sum${groupe}(rate(neon_page_images_total${plage}))`;
}

/** Les parties en cours, tous emplacements confondus. */
export const PARTIES_EN_COURS = 'sum(neon_parties{statut="enCours"})';

/**
 * Le verdict en un nombre: -1 sans partie, 0 fluide, 1 le serveur, 2 le reseau, 3 la page.
 * Le premier qui depasse son seuil l'emporte, dans l'ordre ou ils se masquent l'un l'autre.
 */
export const VERDICT = [
  `(clamp_max(${partDesBattementsEnRetard()} > ${String(SEUILS.battementsEnRetard)}, 0) + 1)`,
  `(clamp_max(${partDesInstantanesEnRetard()} > ${String(SEUILS.instantanesEnRetard)}, 0) + 2)`,
  `(clamp_max(${partDesImagesLentes()} > ${String(SEUILS.imagesLentes)}, 0) + 3)`,
  `clamp_max(${PARTIES_EN_COURS} > 0, 0)`,
  'vector(-1)',
].join(' or ');

/** Un centile d'un histogramme, regroupe par ces etiquettes. */
export function centile(
  part: number,
  histogramme: string,
  par: readonly string[] = [],
  fenetre = '$__rate_interval',
  decalage = '',
): string {
  return `histogram_quantile(${String(part)}, sum by (${['le', ...par].join(', ')}) (rate(${histogramme}_bucket[${fenetre}]${decale(decalage)})))`;
}

/** La moyenne d'un histogramme: sa somme sur son nombre. */
export function moyenne(
  histogramme: string,
  par: readonly string[] = [],
  fenetre = '$__rate_interval',
): string {
  const groupe = par.length === 0 ? '' : ` by (${par.join(', ')})`;

  return `sum${groupe}(rate(${histogramme}_sum[${fenetre}])) / sum${groupe}(rate(${histogramme}_count[${fenetre}]))`;
}

/**
 * Le nom de chaque metrique lue par le tableau et les alertes. Un test verifie que le serveur
 * les ecrit toutes: renommer une metrique sans suivre ici rendrait un panneau muet.
 */
export function metriquesLues(requete: string): string[] {
  return [...requete.matchAll(/\b(neon_[a-z0-9_]+?)(?:_bucket|_sum|_count)?\b(?=[{[)\s]|$)/gu)]
    .map((trouve) => trouve[1] ?? '')
    .filter((nom, rang, tous) => tous.indexOf(nom) === rang);
}
