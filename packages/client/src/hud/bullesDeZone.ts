/**
 * Les bulles des zones (9 octobre 2026), posees dans le document au-dessus du terrain, comme
 * les points flottants: la bulle d'une mine de zone proche, la phrase d'une zone ou l'on
 * entre, le masque de notre ninja cache.
 *
 * AUCUNE REGLE ICI. Quelles bulles montrer, et ou, se decide dans guideDesZones.ts; ce
 * fichier ne fait que les poser, les deplacer a chaque image et les retirer. Une bulle est
 * reconnue a sa cle: elle n'est creee qu'une fois, si bien que son apparition ne rejoue pas a
 * chaque image.
 */

import type { TypeZone } from '@neon-ninja/shared';

import type { BulleDeZone } from '../guideDesZones.js';
import { icone } from '../interface/icones.js';
import { APPARENCE_ZONE } from '../rendu/apparence.js';

/** Une bulle a montrer, deja placee sur l'ecran, en pixels de l'element hote. */
export interface BulleAAfficher extends Omit<BulleDeZone, 'x' | 'y'> {
  readonly x: number;
  readonly y: number;
}

/** Ce qu'il faut pour monter les bulles. */
export interface OptionsBullesDeZone {
  /** L'element qui recoit les bulles, pose exactement sur le terrain. */
  readonly hote: HTMLElement;
  /** Le document a utiliser. Celui de la page par defaut. */
  readonly document?: Document;
}

/** Les bulles montees. */
export interface AfficheurDeBulles {
  /** Met les bulles en accord avec celles de cette image. */
  afficher(bulles: readonly BulleAAfficher[]): void;
  /** Retire tout du document. */
  demonter(): void;
}

/** Monte les bulles des zones dans l'element hote. */
export function monterBullesDeZone(options: OptionsBullesDeZone): AfficheurDeBulles {
  const doc = options.document ?? document;
  const calque = doc.createElement('div');
  calque.className = 'bulles-de-zone';
  calque.setAttribute('aria-hidden', 'true');
  // Le premier enfant de l'hote: les bulles passent sous le HUD et sous les points.
  options.hote.prepend(calque);
  const montees = new Map<string, HTMLElement>();

  return {
    afficher(bulles) {
      const vues = new Set<string>();

      for (const bulle of bulles) {
        vues.add(bulle.cle);
        const element = montees.get(bulle.cle) ?? creerBulle(doc, calque, bulle);
        montees.set(bulle.cle, element);
        element.style.transform = `translate(${String(Math.round(bulle.x))}px, ${String(Math.round(bulle.y))}px)`;
      }

      for (const [cle, element] of montees) {
        if (!vues.has(cle)) {
          element.remove();
          montees.delete(cle);
        }
      }
    },

    demonter() {
      calque.remove();
      montees.clear();
    },
  };
}

/** La couleur d'une nature de zone, en notation CSS. */
function couleurDe(nature: TypeZone): string {
  return `#${APPARENCE_ZONE[nature].couleur.toString(16).padStart(6, '0')}`;
}

/**
 * Cree une bulle: un point d'ancrage deplace a chaque image, et dedans la bulle elle-meme,
 * decalee au-dessus de lui par la feuille de style selon son genre.
 */
function creerBulle(doc: Document, calque: HTMLElement, bulle: BulleAAfficher): HTMLElement {
  const ancre = doc.createElement('div');
  ancre.className = 'bulle-de-zone-ancre';
  const corps = doc.createElement('div');
  corps.className = `bulle-de-zone bulle-de-zone-${bulle.genre}`;
  corps.dataset['nature'] = bulle.nature;
  corps.style.setProperty('--couleur-zone', couleurDe(bulle.nature));

  if (bulle.genre === 'masque') {
    corps.append(icone(doc, 'masque', 16));
  } else {
    // textContent, et pas innerHTML: le texte ne devient jamais du balisage.
    corps.textContent = bulle.texte;
  }

  ancre.append(corps);
  calque.append(ancre);

  return ancre;
}
