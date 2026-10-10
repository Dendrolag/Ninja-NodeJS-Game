/**
 * Remplir de fumee les bonus fumee (etape 7.21): pour chacun des trois bonus, maintenir appuye
 * pendant que la jauge monte, et relacher quand elle est dans la bande. Hors de la bande, ou
 * au-dela du plein, le bonus se vide et se recommence. Au clavier, Espace tenu.
 *
 * La jauge se remplit en REMPLISSAGE_MS: la bande commence a 70 pour cent, soit 1,05 seconde.
 * Trois bonus font 3,15 secondes au plus vite, au-dessus des 3 secondes du serveur.
 */

import type { AvancementDuGeste, BaseDeGeste, CommandeDeGeste } from './commun.js';
import { avecEcho } from './commun.js';

/** Ce que met la jauge a se remplir, de vide a plein. */
export const REMPLISSAGE_MS = 1500;

/** La bande ou relacher, en part de la jauge. */
export const BANDE_DE_LA_FUMEE = { bas: 0.7, haut: 0.85 } as const;

/** Ce que met un bonus rate a se vider avant qu'on recommence. */
export const VIDAGE_MS = 400;

/** Le nombre de bonus a remplir. */
export const NOMBRE_DE_BONUS = 3;

/** Ou en est le remplissage. */
export interface EtatFumee extends BaseDeGeste {
  readonly nature: 'fumee';
  readonly remplis: number;
  /** Le bouton tenu depuis cet instant: la jauge monte. */
  readonly tenuDepuis?: number;
  /** Le bonus rate se vide jusqu'a cet instant: on ne peut pas recommencer avant. */
  readonly videJusqua: number;
}

/** Trois bonus vides. */
export function creerFumee(): EtatFumee {
  return { nature: 'fumee', remplis: 0, videJusqua: 0, echos: [] };
}

/** Le niveau de la jauge a cet instant, de zero a un et plus. */
export function niveauDeLaFumee(etat: EtatFumee, maintenant: number): number {
  return etat.tenuDepuis === undefined
    ? 0
    : Math.max(maintenant - etat.tenuDepuis, 0) / REMPLISSAGE_MS;
}

/** On appuie: la jauge commence a monter, sauf pendant un vidage ou une fois tout rempli. */
function tenir(etat: EtatFumee, maintenant: number): EtatFumee {
  return etat.tenuDepuis !== undefined ||
    maintenant < etat.videJusqua ||
    etat.remplis >= NOMBRE_DE_BONUS
    ? etat
    : { ...etat, tenuDepuis: maintenant };
}

/** On relache: dans la bande, le bonus est plein; ailleurs, il se vide. */
function relacher(etat: EtatFumee, maintenant: number): EtatFumee {
  if (etat.tenuDepuis === undefined) {
    return etat;
  }

  const niveau = niveauDeLaFumee(etat, maintenant);
  const { tenuDepuis: _relache, ...sansTenue } = etat;

  return niveau >= BANDE_DE_LA_FUMEE.bas && niveau <= BANDE_DE_LA_FUMEE.haut
    ? avecEcho({ ...sansTenue, remplis: etat.remplis + 1 }, 'remplie')
    : rater(etat, maintenant);
}

/** Le bonus rate: il se vide. */
function rater(etat: EtatFumee, maintenant: number): EtatFumee {
  const { tenuDepuis: _relache, ...sansTenue } = etat;

  return avecEcho({ ...sansTenue, videJusqua: maintenant + VIDAGE_MS }, 'ratee');
}

/** Le remplissage apres une commande. */
export function appliquerFumee(
  etat: EtatFumee,
  commande: CommandeDeGeste,
  maintenant: number,
): EtatFumee {
  switch (commande.type) {
    case 'temps':
      // Tenue au-dela du plein, la fumee deborde.
      return niveauDeLaFumee(etat, maintenant) > 1 ? rater(etat, maintenant) : etat;

    case 'touche':
      if (commande.touche !== 'espace') {
        return etat;
      }
      return commande.enfoncee ? tenir(etat, maintenant) : relacher(etat, maintenant);

    case 'pointeur':
      if (commande.phase === 'bas') {
        return tenir(etat, maintenant);
      }
      return commande.phase === 'haut' ? relacher(etat, maintenant) : etat;
  }
}

/** Les trois bonus sont-ils pleins. */
export function fumeeFinie(etat: EtatFumee): boolean {
  return etat.remplis >= NOMBRE_DE_BONUS;
}

/** Les bonus pleins. */
export function avancementDeLaFumee(etat: EtatFumee): AvancementDuGeste {
  return { faits: etat.remplis, total: NOMBRE_DE_BONUS };
}
