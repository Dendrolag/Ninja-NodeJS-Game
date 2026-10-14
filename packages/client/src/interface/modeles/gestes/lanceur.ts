/**
 * Relancer le generateur (etape 7.27), une reparation de la panne de neons. D'abord tirer le
 * lanceur: maintenir appuye pendant que l'aiguille du regime monte, et relacher quand elle passe
 * dans la zone verte. Ratee, ou tenue au-dela du plein, le moteur tousse et l'on retire. Puis
 * remonter les trois disjoncteurs, dans l'ordre ou ils clignotent: celui qui clignote se touche,
 * ou se remonte par la fleche haut.
 *
 * LE RYTHME. L'aiguille entre dans le vert apres 1,05 seconde, le moteur demarre en 0,7, et
 * chaque disjoncteur remonte en 0,45: 3,1 secondes au plus vite, au-dessus des 3 secondes du
 * serveur.
 */

import type { AvancementDuGeste } from './commun.js';
import { dansLeRectangle, tireur } from './commun.js';
import type { BaseDeReparation, CommandeDeReparation } from './communDesReparations.js';
import { avecEchoDeReparation } from './communDesReparations.js';

/** Ce que met l'aiguille du regime a monter, de zero au plein. */
export const MONTEE_DU_REGIME_MS = 1500;

/** La zone verte ou relacher le lanceur, en part du regime. */
export const ZONE_VERTE = { bas: 0.7, haut: 0.85 } as const;

/** Ce que dure la toux d'un lancer rate: on ne retire pas avant. */
export const TOUX_MS = 500;

/** Ce que met le moteur a demarrer, avant les disjoncteurs. */
export const DEMARRAGE_MS = 700;

/** Le nombre de disjoncteurs a remonter. */
export const NOMBRE_DE_DISJONCTEURS = 3;

/** Ce que dure la remontee d'un disjoncteur: le suivant attend. */
export const DISJONCTEUR_MS = 450;

/** Le lanceur, a gauche: sa poignee se tire vers le bas. */
export const LANCEUR = { gauche: 30, haut: 50, largeur: 140, hauteur: 230 } as const;

/** Les trois disjoncteurs, a droite, de gauche a droite. */
export const DISJONCTEURS = [
  { gauche: 214, haut: 150, largeur: 48, hauteur: 100 },
  { gauche: 278, haut: 150, largeur: 48, hauteur: 100 },
  { gauche: 342, haut: 150, largeur: 48, hauteur: 100 },
] as const;

/** Ou en est la relance. */
export interface EtatLanceur extends BaseDeReparation {
  readonly nature: 'lanceur';
  /** Le lanceur tire depuis cet instant: l'aiguille monte. */
  readonly tireDepuis?: number;
  /** Le moteur tousse jusqu'a cet instant: on ne retire pas avant. */
  readonly touxJusqua: number;
  /** Le moteur a demarre a cet instant. */
  readonly demarreA?: number;
  /** L'ordre ou les disjoncteurs clignotent, tire de la graine. */
  readonly ordre: readonly number[];
  /** Les disjoncteurs deja remontes. */
  readonly remontes: number;
  /** La fin de la remontee du dernier disjoncteur: rien ne compte avant. */
  readonly finDuDisjoncteur: number;
}

/** Le generateur a l'arret, ses disjoncteurs tombes dans un ordre tire de cette graine. */
export function creerLanceur(graine: number): EtatLanceur {
  return {
    nature: 'lanceur',
    touxJusqua: 0,
    ordre: tireur(graine).melanger([0, 1, 2]),
    remontes: 0,
    finDuDisjoncteur: 0,
    echos: [],
  };
}

/** Le regime a cet instant, de zero a un et plus: zero tant qu'on ne tire pas. */
export function regimeDuLanceur(etat: EtatLanceur, maintenant: number): number {
  return etat.tireDepuis === undefined
    ? 0
    : Math.max(maintenant - etat.tireDepuis, 0) / MONTEE_DU_REGIME_MS;
}

/** Le disjoncteur qui clignote, ou rien: avant le demarrage, et une fois tous remontes. */
export function disjoncteurQuiClignote(etat: EtatLanceur, maintenant: number): number | undefined {
  if (etat.demarreA === undefined || maintenant < etat.demarreA + DEMARRAGE_MS) {
    return undefined;
  }

  return etat.ordre[etat.remontes];
}

/** On tire le lanceur: l'aiguille monte, sauf pendant la toux ou une fois le moteur demarre. */
function tirer(etat: EtatLanceur, maintenant: number): EtatLanceur {
  return etat.tireDepuis !== undefined ||
    etat.demarreA !== undefined ||
    maintenant < etat.touxJusqua
    ? etat
    : { ...etat, tireDepuis: maintenant };
}

/** On relache le lanceur: dans le vert, le moteur demarre; ailleurs, il tousse. */
function relacher(etat: EtatLanceur, maintenant: number): EtatLanceur {
  if (etat.tireDepuis === undefined) {
    return etat;
  }

  const regime = regimeDuLanceur(etat, maintenant);
  const { tireDepuis: _relache, ...sansTirage } = etat;

  return regime >= ZONE_VERTE.bas && regime <= ZONE_VERTE.haut
    ? avecEchoDeReparation({ ...sansTirage, demarreA: maintenant }, 'demarre')
    : tousser(etat, maintenant);
}

/** Le lancer rate: le moteur tousse, et l'on retirera. */
function tousser(etat: EtatLanceur, maintenant: number): EtatLanceur {
  const { tireDepuis: _relache, ...sansTirage } = etat;

  return avecEchoDeReparation({ ...sansTirage, touxJusqua: maintenant + TOUX_MS }, 'tousse');
}

/** On remonte ce disjoncteur: le bon, celui qui clignote, la remontee precedente finie. */
function remonter(etat: EtatLanceur, rang: number, maintenant: number): EtatLanceur {
  const attendu = disjoncteurQuiClignote(etat, maintenant);

  if (attendu === undefined || maintenant < etat.finDuDisjoncteur) {
    return etat;
  }

  if (rang !== attendu) {
    return avecEchoDeReparation(etat, 'ratee');
  }

  return avecEchoDeReparation(
    { ...etat, remontes: etat.remontes + 1, finDuDisjoncteur: maintenant + DISJONCTEUR_MS },
    'disjoncteur',
  );
}

/** La relance apres une commande. */
export function appliquerLanceur(
  etat: EtatLanceur,
  commande: CommandeDeReparation,
  maintenant: number,
): EtatLanceur {
  switch (commande.type) {
    case 'temps':
      // Tenu au-dela du plein, le moteur noie et tousse.
      return regimeDuLanceur(etat, maintenant) > 1 ? tousser(etat, maintenant) : etat;

    case 'molette':
      return etat;

    case 'touche': {
      if (commande.touche === 'espace') {
        return commande.enfoncee ? tirer(etat, maintenant) : relacher(etat, maintenant);
      }

      const attendu = disjoncteurQuiClignote(etat, maintenant);

      return commande.enfoncee && commande.touche === 'haut' && attendu !== undefined
        ? remonter(etat, attendu, maintenant)
        : etat;
    }

    case 'pointeur': {
      if (commande.phase === 'haut') {
        return relacher(etat, maintenant);
      }

      if (commande.phase !== 'bas') {
        return etat;
      }

      if (etat.demarreA === undefined) {
        const { gauche, haut, largeur, hauteur } = LANCEUR;

        return dansLeRectangle(commande, gauche, haut, largeur, hauteur)
          ? tirer(etat, maintenant)
          : etat;
      }

      const rang = DISJONCTEURS.findIndex(({ gauche, haut, largeur, hauteur }) =>
        dansLeRectangle(commande, gauche, haut, largeur, hauteur),
      );

      return rang < 0 ? etat : remonter(etat, rang, maintenant);
    }
  }
}

/** La relance est-elle finie: le moteur demarre et les trois disjoncteurs remontes. */
export function lanceurFini(etat: EtatLanceur, maintenant: number): boolean {
  return etat.remontes >= NOMBRE_DE_DISJONCTEURS && maintenant >= etat.finDuDisjoncteur;
}

/** Le demarrage, puis les disjoncteurs. */
export function avancementDuLanceur(etat: EtatLanceur): AvancementDuGeste {
  return {
    faits: (etat.demarreA === undefined ? 0 : 1) + etat.remontes,
    total: 1 + NOMBRE_DE_DISJONCTEURS,
  };
}
