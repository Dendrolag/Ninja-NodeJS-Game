/**
 * La surcouche: le HUD pose dans le document, au-dessus du terrain PixiJS.
 *
 * CE FICHIER N'A AUCUNE REGLE NON PLUS. Il fabrique des elements une fois, puis
 * les met a jour a partir du modele calcule par modele.ts. Il ne va chercher
 * aucune donnee ailleurs, ne calcule aucun reste et ne decide d'aucun libelle.
 *
 * TROIS PRECAUTIONS QUE LE CLIENT D'ORIGINE NE PRENAIT PAS.
 *
 *   1. LE TEXTE EST POSE AVEC textContent, JAMAIS AVEC innerHTML. Un pseudo est
 *      du texte fourni par un joueur: l'ecrire comme du balisage laisse ce joueur
 *      ecrire dans la page des autres. Le contrat de l'etape 2.2 l'exige
 *      explicitement, et la validation a l'entree ne dispense pas de l'echappement
 *      a l'affichage: les deux ne protegent pas de la meme chose.
 *   2. LES ELEMENTS SONT REUTILISES, pas reconstruits. Refaire tout le classement
 *      a chaque image ferait travailler le navigateur pour rien et perdrait le
 *      defilement et la selection en cours.
 *   3. LA SURCOUCHE NE RECOIT PAS LES CLICS, sauf ce qui en a besoin. Sans cela,
 *      un panneau transparent poserait au joueur un mur invisible entre son doigt
 *      et le terrain. Seul le bouton de capture du mode Tactique les recoit.
 *
 * LA MISE EN FORME N'EST PAS ICI. Les elements portent des classes; la feuille de
 * style arrive avec les ecrans de l'etape 4.3, qui decidera de l'apparence a
 * partir des maquettes. Ce fichier garantit la STRUCTURE et le CONTENU.
 */

import type { DimensionsCarte } from '@neon-ninja/shared';

import type { EtatManette } from '../controles/tactile.js';
import type { ChargesHud, Hud, LigneHud, PointMinimap } from './modele.js';

/** Cote de la minimap, en pixels d'ecran. */
export const COTE_MINIMAP = 160;

/** Ce qu'il faut pour monter la surcouche. */
export interface OptionsSurcouche {
  /** L'element qui contiendra le HUD. */
  readonly hote: HTMLElement;
  /** Dimensions de la carte jouee, pour placer les points de la minimap. */
  readonly carte: DimensionsCarte;
  /** Le document a utiliser. Celui de la page par defaut. */
  readonly document?: Document;
  /**
   * Ce que fait le bouton de capture: tirer (etape 7.1). A fournir dans une partie
   * Tactique seulement; sans lui, la surcouche ne pose ni bouton ni charges.
   */
  readonly capturer?: () => void;
}

/** Une surcouche montee, qui se met a jour et se demonte. */
export interface Surcouche {
  /** Met l'affichage en accord avec ce modele. */
  afficher(hud: Hud): void;
  /** Deplace la manette virtuelle affichee. */
  afficherLaManette(manette: EtatManette): void;
  /** Retire tout du document. */
  demonter(): void;
}

/** Monte la surcouche dans le document et rend de quoi la piloter. */
export function monterSurcouche(options: OptionsSurcouche): Surcouche {
  const doc = options.document ?? document;
  const racine = doc.createElement('div');
  racine.className = 'hud';
  // Le HUD flotte au-dessus du terrain: sans cela, il l'empecherait de recevoir
  // les clics et les contacts.
  racine.style.pointerEvents = 'none';

  const temps = element(doc, 'div', 'hud-temps', racine);
  const pause = element(doc, 'div', 'hud-pause', racine);
  const classement = element(doc, 'ol', 'hud-classement', racine);
  const effets = element(doc, 'ul', 'hud-effets', racine);
  const minimap = element(doc, 'div', 'hud-minimap', racine);
  minimap.style.width = `${String(COTE_MINIMAP)}px`;
  minimap.style.height = `${String(COTE_MINIMAP)}px`;

  const manette = element(doc, 'div', 'hud-manette', racine);
  const pouce = element(doc, 'div', 'hud-manette-pouce', manette);
  // Cachee tant qu'aucun doigt ne la tient. L'etape 4.2 l'oubliait: la manette
  // restait affichee dans un coin tant que personne n'avait touche l'ecran, ce
  // qui ne se voyait pas faute de page pour afficher le HUD.
  manette.hidden = true;

  const capture =
    options.capturer === undefined ? undefined : monterCapture(doc, racine, options.capturer);

  options.hote.append(racine);

  /** Les lignes du classement deja creees, retrouvees par identifiant. */
  const lignes = new Map<string, HTMLElement>();
  /** Les points de la minimap deja crees. */
  const points = new Map<string, HTMLElement>();

  return {
    afficher(hud: Hud) {
      temps.textContent = hud.temps;
      temps.classList.toggle('urgence', hud.urgence);

      pause.textContent =
        hud.pausePar === undefined ? 'Partie suspendue' : `Partie suspendue par ${hud.pausePar}`;
      pause.hidden = !hud.enPause;

      majClassement(doc, classement, lignes, hud.classement);
      majEffets(doc, effets, hud);
      majMinimap(doc, minimap, points, hud.minimap, options.carte);
      capture?.afficher(hud.charges);
    },

    afficherLaManette(etat: EtatManette) {
      manette.hidden = !etat.active;

      if (!etat.active) {
        return;
      }

      manette.style.left = `${String(etat.centreX)}px`;
      manette.style.top = `${String(etat.centreY)}px`;
      pouce.style.left = `${String(etat.pouceX - etat.centreX)}px`;
      pouce.style.top = `${String(etat.pouceY - etat.centreY)}px`;
    },

    demonter() {
      capture?.demonter();
      racine.remove();
      lignes.clear();
      points.clear();
    },
  };
}

/** Cree un element, lui donne une classe et l'attache a son parent. */
function element(doc: Document, balise: string, classe: string, parent: Element): HTMLElement {
  const cree = doc.createElement(balise);
  cree.className = classe;
  parent.append(cree);

  return cree as HTMLElement;
}

/** Le bouton de capture, qui montre aussi nos charges. */
interface BoutonDeCapture {
  afficher(charges: ChargesHud | undefined): void;
  demonter(): void;
}

/**
 * Pose le bouton de capture du mode Tactique (etape 7.1).
 *
 * IL REAGIT A L'APPUI, PAS AU CLIC. Un clic attend que le doigt se leve, et il
 * n'arrive pas toujours quand un autre doigt tient la manette: sur telephone, le
 * pouce gauche court et le pouce droit tire. Il n'est pas dans la zone de la
 * manette, qui est le terrain: un doigt pose dessus ne la plante pas.
 *
 * Un point par charge: plein pour une charge disponible, et celui de la charge qui
 * revient se remplit a mesure.
 */
function monterCapture(doc: Document, parent: HTMLElement, capturer: () => void): BoutonDeCapture {
  const bouton = doc.createElement('button');
  bouton.type = 'button';
  bouton.className = 'hud-capture';
  bouton.style.pointerEvents = 'auto';
  // Hors du parcours au clavier, et jamais en focus: un bouton qui a le focus garde
  // la barre d'espace pour lui (controles/clavier.ts), et un clic de souris sur le
  // bouton empecherait alors de tirer au clavier.
  bouton.tabIndex = -1;
  bouton.hidden = true;
  element(doc, 'span', 'hud-capture-libelle', bouton).textContent = 'Capturer';
  const jauge = element(doc, 'span', 'hud-charges', bouton);
  parent.append(bouton);

  const surAppui = (evenement: Event): void => {
    evenement.preventDefault();
    capturer();
  };

  bouton.addEventListener('pointerdown', surAppui);

  /** Les points deja poses, un par charge. */
  const points: HTMLElement[] = [];
  let etiquette = '';

  return {
    afficher(charges) {
      bouton.hidden = charges === undefined;

      if (charges === undefined) {
        return;
      }

      while (points.length < charges.maximum) {
        points.push(element(doc, 'span', 'hud-charge', jauge));
      }

      points.forEach((point, rang) => {
        const revient = rang === charges.disponibles && charges.disponibles < charges.maximum;

        point.classList.toggle('pleine', rang < charges.disponibles);
        point.classList.toggle('en-recharge', revient);
        point.style.setProperty('--recharge', String(revient ? charges.recharge : 0));
      });

      bouton.classList.toggle('vide', charges.disponibles === 0);

      const nouvelle = `Capturer, ${String(charges.disponibles)} charges sur ${String(charges.maximum)}`;

      if (nouvelle !== etiquette) {
        etiquette = nouvelle;
        bouton.setAttribute('aria-label', nouvelle);
      }
    },

    demonter() {
      bouton.removeEventListener('pointerdown', surAppui);
    },
  };
}

/** Met le classement affiche en accord avec le modele, sans tout reconstruire. */
function majClassement(
  doc: Document,
  liste: HTMLElement,
  lignes: Map<string, HTMLElement>,
  modele: readonly LigneHud[],
): void {
  const vues = new Set<string>();

  for (const ligne of modele) {
    vues.add(ligne.id);
    const element_ = lignes.get(ligne.id) ?? creerLigne(doc, liste, lignes, ligne.id);

    // textContent, et pas innerHTML: un pseudo vient d'un joueur.
    (element_.querySelector('.hud-pseudo') as HTMLElement).textContent = ligne.pseudo;
    (element_.querySelector('.hud-points') as HTMLElement).textContent = String(ligne.points);
    element_.style.setProperty('--couleur-joueur', ligne.couleur);
    element_.classList.toggle('moi', ligne.moi);
    // L'ordre du classement change en cours de partie: on l'exprime par l'ordre
    // de mise en page plutot qu'en deplacant des elements dans le document.
    element_.style.order = String(ligne.rang);
  }

  for (const [id, element_] of lignes) {
    if (!vues.has(id)) {
      element_.remove();
      lignes.delete(id);
    }
  }
}

/** Cree une ligne de classement et la retient. */
function creerLigne(
  doc: Document,
  liste: HTMLElement,
  lignes: Map<string, HTMLElement>,
  id: string,
): HTMLElement {
  const ligne = element(doc, 'li', 'hud-ligne', liste);
  element(doc, 'span', 'hud-pseudo', ligne);
  element(doc, 'span', 'hud-points', ligne);
  lignes.set(id, ligne);

  return ligne;
}

/**
 * Met les effets affiches en accord avec le modele.
 *
 * Ils sont peu nombreux, changent d'ordre a chaque seconde et disparaissent
 * souvent: les reconstruire est ici plus simple que de les suivre, et le cout est
 * negligeable devant celui du classement.
 */
function majEffets(doc: Document, liste: HTMLElement, hud: Hud): void {
  liste.replaceChildren();

  for (const effet of hud.effets) {
    const ligne = element(doc, 'li', `hud-effet hud-effet-${effet.categorie}`, liste);
    ligne.style.setProperty('--couleur-effet', `#${effet.couleur.toString(16).padStart(6, '0')}`);
    element(doc, 'span', 'hud-effet-libelle', ligne).textContent = effet.libelle;
    element(doc, 'span', 'hud-effet-reste', ligne).textContent = `${String(effet.resteS)} s`;
  }
}

/** Met les points de la minimap en accord avec le modele. */
function majMinimap(
  doc: Document,
  minimap: HTMLElement,
  points: Map<string, HTMLElement>,
  modele: readonly PointMinimap[],
  carte: DimensionsCarte,
): void {
  const vus = new Set<string>();

  for (const point of modele) {
    vus.add(point.id);
    let element_ = points.get(point.id);

    if (element_ === undefined) {
      element_ = element(doc, 'div', 'hud-point', minimap);
      points.set(point.id, element_);
    }

    element_.style.left = `${String((point.x / carte.largeur) * 100)}%`;
    element_.style.top = `${String((point.y / carte.hauteur) * 100)}%`;
    element_.style.background = point.couleur;
    element_.classList.toggle('moi', point.moi);
  }

  for (const [id, element_] of points) {
    if (!vus.has(id)) {
      element_.remove();
      points.delete(id);
    }
  }
}
