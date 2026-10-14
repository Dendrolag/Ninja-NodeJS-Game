/**
 * Couper un interrupteur (etape 7.27), un geste du relais de la surchauffe. On abaisse la
 * manette jusqu'au declic: au doigt ou a la souris, en la tirant vers le bas; au clavier, la
 * fleche bas ou Espace tenue. Lachee avant le declic, la manette remonte.
 *
 * LA MANETTE A DE L'INERTIE: elle descend a une vitesse bornee, si vite qu'on la tire, et met
 * 0,65 seconde a aller du haut au declic, au-dessus des 0,6 seconde du serveur.
 */

import type { AvancementDuGeste } from './commun.js';
import { dansLeRectangle } from './commun.js';
import type { BaseDeReparation, CommandeDeReparation } from './communDesReparations.js';
import { avecEchoDeReparation, borner } from './communDesReparations.js';

/** Ce que met la manette a descendre du haut au declic. */
export const DESCENTE_MS = 650;

/** La course de la manette, dans l'espace du geste: ce qu'il faut tirer pour la descendre. */
export const COURSE_DE_LA_MANETTE = 150;

/** La manette, au milieu: la ou on la saisit, a sa course entiere. */
export const MANETTE = { gauche: 140, haut: 50, largeur: 120, hauteur: 230 } as const;

/** Ou en est la manette. */
export interface EtatInterrupteur extends BaseDeReparation {
  readonly nature: 'interrupteur';
  /** La position de la manette, de zero (en haut) a un (au declic). */
  readonly position: number;
  /** Ou l'on demande a la manette d'aller. */
  readonly consigne: number;
  /** L'instant du dernier calcul, absent avant le premier. */
  readonly dernierInstant?: number;
  /** La manette tenue au pointeur: d'ou la prise est partie. */
  readonly prise?: { readonly departY: number; readonly departConsigne: number };
  /** Le declic, a cet instant. */
  readonly coupeA?: number;
}

/** Une manette en haut. */
export function creerInterrupteur(): EtatInterrupteur {
  return { nature: 'interrupteur', position: 0, consigne: 0, echos: [] };
}

/** Le temps passe jusqu'a cet instant: la manette va vers sa consigne, et claque au bout. */
function avancer(etat: EtatInterrupteur, maintenant: number): EtatInterrupteur {
  if (etat.coupeA !== undefined) {
    return etat;
  }

  const depuis = etat.dernierInstant ?? maintenant;
  const pas = Math.max(maintenant - depuis, 0) / DESCENTE_MS;
  const position =
    etat.consigne > etat.position
      ? Math.min(etat.position + pas, etat.consigne)
      : Math.max(etat.position - pas, etat.consigne);
  const avance = { ...etat, position, dernierInstant: maintenant };

  return position >= 1 ? avecEchoDeReparation({ ...avance, coupeA: maintenant }, 'declic') : avance;
}

/** L'interrupteur apres une commande. */
export function appliquerInterrupteur(
  etat: EtatInterrupteur,
  commande: CommandeDeReparation,
  maintenant: number,
): EtatInterrupteur {
  const avance = avancer(etat, maintenant);

  if (avance.coupeA !== undefined) {
    return avance;
  }

  switch (commande.type) {
    case 'temps':
    case 'molette':
      return avance;

    case 'touche':
      if (commande.touche !== 'bas' && commande.touche !== 'espace') {
        return avance;
      }

      return { ...avance, consigne: commande.enfoncee ? 1 : 0 };

    case 'pointeur': {
      const { prise: _lachee, ...sansPrise } = avance;

      switch (commande.phase) {
        case 'bas':
          return dansLeRectangle(
            commande,
            MANETTE.gauche,
            MANETTE.haut,
            MANETTE.largeur,
            MANETTE.hauteur,
          )
            ? { ...avance, prise: { departY: commande.y, departConsigne: avance.consigne } }
            : avance;

        case 'deplace':
          return avance.prise === undefined
            ? avance
            : {
                ...avance,
                consigne: borner(
                  avance.prise.departConsigne +
                    (commande.y - avance.prise.departY) / COURSE_DE_LA_MANETTE,
                  0,
                  1,
                ),
              };

        case 'haut':
          return { ...sansPrise, consigne: 0 };
      }
    }
  }
}

/** L'interrupteur est-il coupe. */
export function interrupteurCoupe(etat: EtatInterrupteur): boolean {
  return etat.coupeA !== undefined;
}

/** Coupe ou non. */
export function avancementDeLInterrupteur(etat: EtatInterrupteur): AvancementDuGeste {
  return { faits: etat.coupeA === undefined ? 0 : 1, total: 1 };
}
