/**
 * Le mode miroir, cote page: le decor d'une carte, retourne de gauche a droite.
 *
 * DEPUIS L'ETAPE 8.3, UNE CARTE N'A QU'UN JEU D'IMAGES. Le jeu d'origine chargeait
 * un second dossier d'images deja retournees; mesure faite, elles n'etaient rien
 * d'autre que le retournement des normales. Le serveur retourne desormais l'image
 * des murs (packages/server/src/terrain.ts), et la page retourne ce qu'elle dessine
 * de la carte: le fond, la pluie et l'avant-plan.
 *
 * RIEN D'AUTRE NE SE RETOURNE. Les positions que le serveur envoie sont deja celles
 * du terrain retourne: un ninja colle a un mur a droite de la carte miroir y est
 * aussi pour la page. La camera, les personnages, les objets et le sol du Massacre,
 * ou le sang s'imprime a la position des morts, restent donc tels quels.
 *
 * LA PLUIE SE RETOURNE IMAGE PAR IMAGE. Elle ne tombe pas dans les interieurs vus en
 * coupe: ses zones seches suivent le fond, et doivent le suivre une fois retourne.
 * Chaque image de sa planche devient une texture a part, affichee par le meme sprite:
 * retourner le sprite retourne chacune d'elles, sans changer l'ordre de l'animation.
 */

/** Ce que le retournement touche d'un objet d'affichage: sa position et son echelle en largeur. */
export interface ImageOrientable {
  x: number;
  readonly scale: { x: number };
}

/**
 * Oriente une image du decor, deja etiree a la largeur de la carte.
 *
 * Retournee, l'image a une echelle negative: elle s'etend vers la gauche depuis sa
 * position, qui passe donc au bord droit de la carte. Sa taille ne change pas, et
 * l'appeler deux fois de suite dans le meme sens ne change rien.
 *
 * @param image        Le sprite, apres qu'on lui a donne la largeur de la carte.
 * @param largeurCarte La largeur de la carte, en pixels de jeu.
 * @param modeMiroir   Vrai pour une partie en miroir.
 */
export function orienterLeDecor(
  image: ImageOrientable,
  largeurCarte: number,
  modeMiroir: boolean,
): void {
  const echelle = Math.abs(image.scale.x);

  image.scale.x = modeMiroir ? -echelle : echelle;
  image.x = modeMiroir ? largeurCarte : 0;
}
