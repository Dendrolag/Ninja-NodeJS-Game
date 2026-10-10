/**
 * Recharger des munitions (etape 7.21): glisser cinq cartouches dans la fenetre de chargement
 * du fusil du Tactique. Au clavier, Espace en glisse une.
 *
 * Chaque cartouche inseree joue son animation (CARTOUCHE_MS) avant la suivante: cinq
 * cartouches font 3,6 secondes au plus vite, au-dessus des 3,5 secondes du serveur.
 */

import type { AvancementDuGeste, BaseDeGeste, CommandeDeGeste, PointDuGeste } from './commun.js';
import { avecEcho, dansLeRectangle, distance } from './commun.js';

/** Ce que dure une cartouche inseree, son animation comprise. */
export const CARTOUCHE_MS = 720;

/** Le nombre de cartouches. */
export const NOMBRE_DE_CARTOUCHES = 5;

/** La fenetre de chargement du fusil, et le rayon ou une cartouche y entre. */
export const FENETRE_DE_CHARGEMENT = { x: 150, y: 132, rayon: 42 } as const;

/** La rangee des cartouches a inserer, en bas. */
export const RANGEE_DES_CARTOUCHES = { gauche: 190, haut: 200, largeur: 190, hauteur: 80 } as const;

/** Ou en est la recharge. */
export interface EtatMunitions extends BaseDeGeste {
  readonly nature: 'munitions';
  readonly inserees: number;
  /** La fin de l'animation de la derniere cartouche inseree. */
  readonly finDeLaCartouche: number;
  /** La cartouche tenue au pointeur, et sa place. */
  readonly prise?: PointDuGeste;
}

/** Un fusil vide. */
export function creerMunitions(): EtatMunitions {
  return { nature: 'munitions', inserees: 0, finDeLaCartouche: 0, echos: [] };
}

/** Insere une cartouche, si la precedente est entree et qu'il en reste. */
function inserer(etat: EtatMunitions, maintenant: number): EtatMunitions {
  const { prise: _lachee, ...sansPrise } = etat;

  if (maintenant < etat.finDeLaCartouche || etat.inserees >= NOMBRE_DE_CARTOUCHES) {
    return sansPrise;
  }

  return avecEcho(
    { ...sansPrise, inserees: etat.inserees + 1, finDeLaCartouche: maintenant + CARTOUCHE_MS },
    'cartouche',
  );
}

/** La recharge apres une commande. */
export function appliquerMunitions(
  etat: EtatMunitions,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatMunitions {
  if (commande.type === 'temps') {
    return etat;
  }

  if (commande.type === 'touche') {
    return commande.enfoncee && commande.touche === 'espace' ? inserer(etat, maintenant) : etat;
  }

  const { prise: _lachee, ...sansPrise } = etat;
  const { gauche, haut, largeur, hauteur } = RANGEE_DES_CARTOUCHES;

  switch (commande.phase) {
    case 'bas':
      return dansLeRectangle(commande, gauche, haut, largeur, hauteur) &&
        etat.inserees < NOMBRE_DE_CARTOUCHES &&
        maintenant >= etat.finDeLaCartouche
        ? { ...etat, prise: { x: commande.x, y: commande.y } }
        : etat;

    case 'deplace':
      return etat.prise === undefined ? etat : { ...etat, prise: { x: commande.x, y: commande.y } };

    case 'haut':
      return etat.prise !== undefined &&
        distance(commande, FENETRE_DE_CHARGEMENT) <= FENETRE_DE_CHARGEMENT.rayon
        ? inserer(etat, maintenant)
        : sansPrise;
  }
}

/** La recharge est-elle finie: cinq cartouches, la derniere entree. */
export function munitionsFinies(etat: EtatMunitions, maintenant: number): boolean {
  return etat.inserees >= NOMBRE_DE_CARTOUCHES && maintenant >= etat.finDeLaCartouche;
}

/** Les cartouches inserees. */
export function avancementDesMunitions(etat: EtatMunitions): AvancementDuGeste {
  return { faits: etat.inserees, total: NOMBRE_DE_CARTOUCHES };
}
