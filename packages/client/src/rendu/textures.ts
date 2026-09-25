/**
 * Le nom des textures que le rendu fabrique a partir des images chargees.
 *
 * DEUX SORTES D'IMAGES NE S'AFFICHENT PAS TELLES QU'ELLES SONT CHARGEES.
 *
 *   - Une image de ninja est coupee en deux calques, le corps a repeindre et les
 *     details intacts (recoloration.ts). Chaque calque est une texture.
 *   - L'icone d'un objet est une planche de plusieurs images cote a cote, qui
 *     s'affichent une a la fois. Chaque image est une texture.
 *
 * La scene decrit ce qu'il faut dessiner en adresses, et le rendu PixiJS range les
 * textures fabriquees sous ces memes noms: les deux parlent de la meme chose sans
 * que la scene connaisse PixiJS. Un nom derive garde l'adresse de son image, suivie
 * d'un fragment que le navigateur ne demande jamais au serveur.
 */

/** Le nom de la texture du corps d'une image de ninja: les pixels qui prennent la couleur. */
export function adresseDuCorps(adresse: string): string {
  return `${adresse}#corps`;
}

/** Le nom de la texture des details d'une image de ninja: les pixels jamais repeints. */
export function adresseDesDetails(adresse: string): string {
  return `${adresse}#details`;
}

/**
 * Le nom de la texture d'une image d'une planche.
 *
 * @param adresse L'adresse de la planche.
 * @param rang    Le rang de l'image dans la planche, a partir de zero.
 */
export function adresseDImage(adresse: string, rang: number): string {
  return `${adresse}#image-${String(rang)}`;
}

/**
 * L'adresse d'une image de ninja dont le corps est raye rouge et blanc: celle de l'Evade
 * (etape 7.9). Ce n'est pas une image chargee: le rendu en fabrique les deux calques a
 * partir de ceux de l'image d'origine, et les range sous les noms que cette adresse donne.
 */
export function adresseRayee(adresse: string): string {
  return `${adresse}#raye`;
}
