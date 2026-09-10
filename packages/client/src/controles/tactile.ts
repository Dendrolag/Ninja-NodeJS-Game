/**
 * La manette virtuelle: le controle au pouce, pour le tactile.
 *
 * DECISION D'AMBITION MOBILE DU 29 JUIN 2026: le mobile est soutenu, le bureau
 * reste prioritaire pour la finition. La manette est donc fonctionnelle et
 * sobre; son habillage se decidera avec les maquettes.
 *
 * COMMENT ELLE MARCHE. Un doigt pose dans la zone tactile plante le centre de la
 * manette la ou il s'est pose, et non a un endroit fixe: c'est ce qui evite au
 * joueur de chercher un cercle a l'aveugle sur un ecran qu'il ne regarde pas. Le
 * pouce s'ecarte, la direction suit; il se leve, le personnage s'arrete.
 *
 * IL N'Y A PAS DE ZONE DE CAPTURE, et ce n'est pas un oubli. Dans le mode
 * Classique, on capture en touchant l'autre: il n'y a rien a declencher. Voir la
 * note en tete de controles.ts.
 *
 * COMME POUR LE CLAVIER, ce fichier ne decide rien: il traduit des evenements en
 * appels. Le calcul de la direction est dans intention.ts, ou il se teste.
 */

import type { Controles } from './controles.js';

/** Rayon de la manette virtuelle, en pixels d'ecran. */
export const RAYON_MANETTE = 60;

/** Ou en est le doigt qui tient la manette, pour l'affichage. */
export interface EtatManette {
  /** Un doigt tient la manette. */
  readonly active: boolean;
  /** Centre de la manette, la ou le doigt s'est pose, en pixels d'ecran. */
  readonly centreX: number;
  readonly centreY: number;
  /** Position du pouce, deja ramenee dans le rayon de la manette. */
  readonly pouceX: number;
  readonly pouceY: number;
}

/** Manette au repos. */
export const MANETTE_AU_REPOS: EtatManette = {
  active: false,
  centreX: 0,
  centreY: 0,
  pouceX: 0,
  pouceY: 0,
};

/** Ce qu'il faut pour brancher la manette. */
export interface OptionsTactile {
  /** Rayon de la manette, en pixels d'ecran. */
  readonly rayon?: number;
  /** Appele a chaque changement, pour que l'affichage suive le pouce. */
  readonly surChangement?: (etat: EtatManette) => void;
}

/**
 * Branche une zone tactile sur des controles.
 *
 * @param zone      L'element qui recoit les contacts. En pratique, la surface de
 *                  jeu entiere.
 * @returns La fonction a appeler pour tout debrancher.
 */
export function brancherTactile(
  zone: HTMLElement,
  controles: Controles,
  options: OptionsTactile = {},
): () => void {
  const rayon = options.rayon ?? RAYON_MANETTE;
  const prevenir = options.surChangement;

  /** Identifiant du doigt qui tient la manette, pour ignorer les autres. */
  let doigt: number | undefined;
  let centreX = 0;
  let centreY = 0;

  const annoncer = (etat: EtatManette): void => {
    prevenir?.(etat);
  };

  const surDebut = (evenement: TouchEvent): void => {
    if (doigt !== undefined) {
      return;
    }

    const contact = evenement.changedTouches[0];
    if (contact === undefined) {
      return;
    }

    // Sans cela, un appui prolonge ouvre le menu contextuel du navigateur et un
    // glissement fait defiler la page.
    evenement.preventDefault();

    doigt = contact.identifier;
    centreX = contact.clientX;
    centreY = contact.clientY;

    controles.deplacerLaManette({ x: 0, y: 0 }, rayon);
    annoncer({ active: true, centreX, centreY, pouceX: centreX, pouceY: centreY });
  };

  const surDeplacement = (evenement: TouchEvent): void => {
    const contact = contactDe(evenement, doigt);
    if (contact === undefined) {
      return;
    }

    evenement.preventDefault();

    const ecart = { x: contact.clientX - centreX, y: contact.clientY - centreY };
    const distance = Math.hypot(ecart.x, ecart.y);
    // Le pouce affiche reste dans le cercle, meme quand le doigt en sort: c'est
    // ce qui donne la sensation d'une vraie manette butant en fin de course.
    const facteur = distance > rayon ? rayon / distance : 1;

    controles.deplacerLaManette(ecart, rayon);
    annoncer({
      active: true,
      centreX,
      centreY,
      pouceX: centreX + ecart.x * facteur,
      pouceY: centreY + ecart.y * facteur,
    });
  };

  const surFin = (evenement: TouchEvent): void => {
    if (contactDe(evenement, doigt) === undefined) {
      return;
    }

    doigt = undefined;
    controles.relacherLaManette();
    annoncer(MANETTE_AU_REPOS);
  };

  zone.addEventListener('touchstart', surDebut, { passive: false });
  zone.addEventListener('touchmove', surDeplacement, { passive: false });
  zone.addEventListener('touchend', surFin);
  // Un contact annule par le systeme, par exemple a l'arrivee d'un appel, doit
  // relacher la manette comme un doigt leve. Le jeu d'origine le faisait deja
  // (client.js:987); on garde ce comportement.
  zone.addEventListener('touchcancel', surFin);

  return () => {
    zone.removeEventListener('touchstart', surDebut);
    zone.removeEventListener('touchmove', surDeplacement);
    zone.removeEventListener('touchend', surFin);
    zone.removeEventListener('touchcancel', surFin);
    controles.relacherLaManette();
  };
}

/** Retrouve le contact qui porte cet identifiant dans un evenement tactile. */
function contactDe(evenement: TouchEvent, doigt: number | undefined): Touch | undefined {
  if (doigt === undefined) {
    return undefined;
  }

  for (const contact of Array.from(evenement.changedTouches)) {
    if (contact.identifier === doigt) {
      return contact;
    }
  }

  return undefined;
}
