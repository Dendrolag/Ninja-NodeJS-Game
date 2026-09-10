/**
 * Les briques du document: fabriquer un element, y ecrire du texte, le montrer.
 *
 * TOUT LE TEXTE PASSE PAR textContent. Il n'existe dans l'interface aucun appel
 * a innerHTML, et ce fichier est ce qui le rend inutile: on fabrique des
 * elements, on n'assemble jamais de balisage a partir de chaines. Le jeu
 * d'origine faisait l'inverse a trois endroits, et c'est ce qui laissait un pseudo
 * contenant du code s'executer chez tous les joueurs (faille S1). La validation
 * des pseudos a l'entree est l'autre moitie de la correction; les deux sont
 * exigees, parce qu'elles ne protegent pas de la meme chose.
 *
 * ON N'ECRIT QUE CE QUI CHANGE. Les ecrans se mettent a jour a chaque changement
 * d'etat, qui arrive vingt fois par seconde pendant une partie. Reecrire un texte
 * identique ou rebasculer un element deja cache ne coute presque rien, mais
 * n'apporte rien non plus: ecrireTexte et montrer comparent avant d'ecrire.
 */

import type { Glyphe } from './icones.js';
import { icone } from './icones.js';

/** Ce qu'on peut donner a un element a sa creation. */
export interface OptionsElement {
  readonly classe?: string;
  /** Le texte de l'element, pose avec textContent. */
  readonly texte?: string;
  readonly attributs?: Readonly<Record<string, string>>;
}

/**
 * Fabrique un element, avec sa classe, son texte, ses attributs et ses enfants.
 *
 * Les enfants absents sont ignores, ce qui permet d'ecrire un enfant facultatif
 * sans condition autour de l'appel.
 */
export function creer<Balise extends keyof HTMLElementTagNameMap>(
  doc: Document,
  balise: Balise,
  options: OptionsElement = {},
  ...enfants: (Node | undefined)[]
): HTMLElementTagNameMap[Balise] {
  const element = doc.createElement(balise);

  if (options.classe !== undefined) {
    element.className = options.classe;
  }

  if (options.texte !== undefined) {
    element.textContent = options.texte;
  }

  for (const [nom, valeur] of Object.entries(options.attributs ?? {})) {
    element.setAttribute(nom, valeur);
  }

  for (const enfant of enfants) {
    if (enfant !== undefined) {
      element.append(enfant);
    }
  }

  return element;
}

/** Ecrit un texte dans un element, s'il differe de celui qui y est deja. */
export function ecrireTexte(element: Element, texte: string): void {
  if (element.textContent !== texte) {
    element.textContent = texte;
  }
}

/** Montre ou cache un element, s'il n'est pas deja dans l'etat voulu. */
export function montrer(element: HTMLElement, visible: boolean): void {
  if (element.hidden === visible) {
    element.hidden = !visible;
  }
}

/** Ce qu'il faut pour fabriquer un bouton. */
export interface OptionsBouton {
  readonly classe: string;
  /** Le texte visible. */
  readonly texte?: string;
  /** Le pictogramme pose avant le texte. */
  readonly icone?: Glyphe;
  /** Le nom lu par les lecteurs d'ecran, indispensable a un bouton sans texte. */
  readonly etiquette?: string;
  readonly type?: 'button' | 'submit';
}

/** Fabrique un bouton, et branche son action s'il en a une. */
export function bouton(
  doc: Document,
  options: OptionsBouton,
  surClic?: () => void,
): HTMLButtonElement {
  const element = creer(doc, 'button', {
    classe: options.classe,
    attributs: {
      type: options.type ?? 'button',
      ...(options.etiquette === undefined
        ? {}
        : { 'aria-label': options.etiquette, title: options.etiquette }),
    },
  });

  if (options.icone !== undefined) {
    element.append(icone(doc, options.icone));
  }

  if (options.texte !== undefined) {
    element.append(creer(doc, 'span', { texte: options.texte }));
  }

  if (surClic !== undefined) {
    element.addEventListener('click', surClic);
  }

  return element;
}
