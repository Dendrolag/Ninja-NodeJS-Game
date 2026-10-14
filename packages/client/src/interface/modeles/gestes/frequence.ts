/**
 * Accorder la frequence (etape 7.27), une reparation de la panne de neons. Un oscilloscope neon:
 * on tourne un cadran jusqu'a caler la courbe sur la courbe cible, puis on la tient une seconde
 * dans la tolerance. Le cadran se tourne au clavier (gauche, droite, tenues), a la molette, ou
 * au doigt, en rond autour du cadran.
 *
 * LE CADRAN A DE L'INERTIE: il suit ce qu'on lui demande a une vitesse bornee, si vite qu'on
 * tourne. Sans elle, un doigt rapide calerait la courbe d'un geste.
 *
 * LE RYTHME. La frequence part a la moitie de sa course de la cible au moins; le cadran en
 * parcourt 0,22 par seconde: 2,1 secondes pour entrer dans la tolerance, puis la seconde a la
 * tenir. 3,1 secondes au plus vite, au-dessus des 3 secondes du serveur.
 */

import type { AvancementDuGeste } from './commun.js';
import { tireur } from './commun.js';
import type { BaseDeReparation, CommandeDeReparation } from './communDesReparations.js';
import { avecEchoDeReparation, borner } from './communDesReparations.js';

/** Ce que le cadran parcourt au plus par seconde, sur une course de zero a un. */
export const VITESSE_DU_CADRAN = 0.22;

/** L'ecart a la cible que l'on tolere. */
export const TOLERANCE_DE_LA_FREQUENCE = 0.03;

/** Ce qu'il faut tenir la courbe dans la tolerance. */
export const TENUE_DE_LA_FREQUENCE_MS = 1000;

/** L'ecart au depart, au moins, entre la frequence et la cible. */
export const ECART_DE_DEPART = 0.5;

/** Ce qu'un cran de molette demande au cadran. */
export const CRAN_DE_MOLETTE = 0.04;

/** Ce qu'un tour complet du doigt demande au cadran. */
export const TOUR_DU_CADRAN = 0.6;

/** Le cadran, en bas a droite de l'espace du geste. */
export const CADRAN = { x: 320, y: 230, rayon: 52 } as const;

/** Ou en est l'accord. */
export interface EtatFrequence extends BaseDeReparation {
  readonly nature: 'frequence';
  /** La frequence cible, de zero a un. */
  readonly cible: number;
  /** La frequence du cadran. */
  readonly valeur: number;
  /** Ce que l'on demande au cadran: il y va a sa vitesse. */
  readonly consigne: number;
  /** Le sens des fleches tenues: -1, 0 ou 1. */
  readonly sens: number;
  /** L'instant du dernier calcul, absent avant le premier. */
  readonly dernierInstant?: number;
  /** La courbe est dans la tolerance depuis cet instant. */
  readonly accordDepuis?: number;
  /** La frequence est accordee, a cet instant. */
  readonly accordeeA?: number;
  /** L'angle du doigt autour du cadran, tant qu'il le tourne. */
  readonly angleDuDoigt?: number;
}

/** Un oscilloscope desaccorde, sa cible et son depart tires de cette graine. */
export function creerFrequence(graine: number): EtatFrequence {
  const tirage = tireur(graine);
  const cible = tirage.reel(0.15, 0.85);
  const ecart = ECART_DE_DEPART + tirage.reel(0, 0.05);
  const valeur = borner(cible >= 0.5 ? cible - ecart : cible + ecart, 0, 1);

  return {
    nature: 'frequence',
    cible,
    valeur,
    consigne: valeur,
    sens: 0,
    echos: [],
  };
}

/** Le temps passe jusqu'a cet instant: le cadran avance, et l'accord se juge. */
function avancer(etat: EtatFrequence, maintenant: number): EtatFrequence {
  if (etat.accordeeA !== undefined) {
    return etat;
  }

  const depuis = etat.dernierInstant ?? maintenant;
  const pas = (VITESSE_DU_CADRAN * Math.max(maintenant - depuis, 0)) / 1000;
  const consigne = etat.sens === 0 ? etat.consigne : borner(etat.valeur + etat.sens, 0, 1);
  const valeur =
    consigne > etat.valeur
      ? Math.min(etat.valeur + pas, consigne)
      : Math.max(etat.valeur - pas, consigne);
  const avance = { ...etat, valeur, consigne, dernierInstant: maintenant };

  if (Math.abs(valeur - etat.cible) > TOLERANCE_DE_LA_FREQUENCE) {
    const { accordDepuis: _perdu, ...sansAccord } = avance;
    return sansAccord;
  }

  const accordDepuis = etat.accordDepuis ?? maintenant;

  return maintenant - accordDepuis >= TENUE_DE_LA_FREQUENCE_MS
    ? avecEchoDeReparation({ ...avance, accordDepuis, accordeeA: maintenant }, 'accord')
    : { ...avance, accordDepuis };
}

/** L'angle d'un point autour du cadran. */
function angleAutourDuCadran(point: { readonly x: number; readonly y: number }): number {
  return Math.atan2(point.y - CADRAN.y, point.x - CADRAN.x);
}

/** L'accord apres une commande. */
export function appliquerFrequence(
  etat: EtatFrequence,
  commande: CommandeDeReparation,
  maintenant: number,
): EtatFrequence {
  const avance = avancer(etat, maintenant);

  if (avance.accordeeA !== undefined) {
    return avance;
  }

  switch (commande.type) {
    case 'temps':
      return avance;

    case 'molette':
      return {
        ...avance,
        consigne: borner(avance.consigne + commande.crans * CRAN_DE_MOLETTE, 0, 1),
      };

    case 'touche': {
      if (commande.touche !== 'gauche' && commande.touche !== 'droite') {
        return avance;
      }

      const sens = commande.touche === 'droite' ? 1 : -1;

      if (commande.enfoncee) {
        return { ...avance, sens };
      }

      // Lachee, la fleche arrete le cadran ou il est.
      return avance.sens === sens ? { ...avance, sens: 0, consigne: avance.valeur } : avance;
    }

    case 'pointeur': {
      if (commande.phase === 'haut') {
        const { angleDuDoigt: _leve, ...sansDoigt } = avance;
        return sansDoigt;
      }

      const angle = angleAutourDuCadran(commande);

      if (commande.phase === 'bas' || avance.angleDuDoigt === undefined) {
        return commande.phase === 'bas' ? { ...avance, angleDuDoigt: angle } : avance;
      }

      // Le tour fait depuis le dernier point, ramene entre -pi et pi.
      let tour = angle - avance.angleDuDoigt;
      if (tour > Math.PI) {
        tour -= 2 * Math.PI;
      } else if (tour < -Math.PI) {
        tour += 2 * Math.PI;
      }

      return {
        ...avance,
        angleDuDoigt: angle,
        consigne: borner(avance.consigne + (tour / (2 * Math.PI)) * TOUR_DU_CADRAN, 0, 1),
      };
    }
  }
}

/** La frequence est-elle accordee. */
export function frequenceAccordee(etat: EtatFrequence): boolean {
  return etat.accordeeA !== undefined;
}

/** Ou en est la tenue de l'accord, a cet instant: de zero a un. */
export function tenueDeLaFrequence(etat: EtatFrequence, maintenant: number): number {
  if (etat.accordeeA !== undefined) {
    return 1;
  }

  return etat.accordDepuis === undefined
    ? 0
    : Math.min((maintenant - etat.accordDepuis) / TENUE_DE_LA_FREQUENCE_MS, 1);
}

/** L'accord, fait ou non. */
export function avancementDeLaFrequence(etat: EtatFrequence): AvancementDuGeste {
  return { faits: etat.accordeeA === undefined ? 0 : 1, total: 1 };
}
