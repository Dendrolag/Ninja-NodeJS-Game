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
import type {
  ArmeHud,
  ChargesHud,
  ChasseHud,
  EffetHud,
  Hud,
  LigneHud,
  ComboHud,
  PointMinimap,
  PorteeMinimap,
} from './modele.js';

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
  const retour = element(doc, 'div', 'hud-retour', racine);
  retour.setAttribute('role', 'status');
  retour.textContent = 'Connexion perdue. Retour dans la partie…';
  retour.hidden = true;
  const chasse = monterChasse(doc, racine);
  const combo = monterCombo(doc, racine);
  const classement = element(doc, 'ol', 'hud-classement', racine);
  const effets = element(doc, 'ul', 'hud-effets', racine);
  const minimap = element(doc, 'div', 'hud-minimap', racine);
  minimap.style.width = `${String(COTE_MINIMAP)}px`;
  minimap.style.height = `${String(COTE_MINIMAP)}px`;
  // Le disque que la minimap montre en Tactique (etape 7.7), cache ailleurs.
  const portee = element(doc, 'div', 'hud-portee', minimap);
  portee.hidden = true;

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
  /** Les cartes des effets deja creees (etape 4.6). */
  const cartesDEffets = new Map<string, HTMLElement>();

  return {
    afficher(hud: Hud) {
      temps.textContent = hud.temps;
      temps.classList.toggle('urgence', hud.urgence);

      pause.textContent =
        hud.pausePar === undefined ? 'Partie suspendue' : `Partie suspendue par ${hud.pausePar}`;
      // Un lien perdu passe avant la pause: rien de ce qui est affiche n'est plus a jour.
      pause.hidden = !hud.enPause || hud.retourEnCours;
      retour.hidden = !hud.retourEnCours;

      chasse.afficher(hud.chasse);
      combo.afficher(hud.combo);
      majClassement(doc, classement, lignes, hud.classement);
      majEffets(doc, effets, cartesDEffets, hud.effets);
      majMinimap(doc, minimap, points, hud.minimap, options.carte);
      majPortee(portee, hud.portee, options.carte);
      // En Chasse, les charges d'un traqueur sont ses vies (etape 7.3); en Massacre, le
      // bouton porte le katana (etape 7.4).
      capture?.afficher(hud.charges, hud.arme);
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
      cartesDEffets.clear();
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
  /** Montre nos charges, ou, en Chasse, nos vies, ou, en Massacre, notre katana. */
  afficher(charges: ChargesHud | undefined, arme: ArmeHud): void;
  demonter(): void;
}

/**
 * Pose le bouton de capture du mode Tactique (etape 7.1), et du traqueur de la Chasse
 * (etape 7.3), dont les points sont les vies.
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
  const libelle = element(doc, 'span', 'hud-capture-libelle', bouton);
  libelle.textContent = 'Capturer';
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
    afficher(charges, arme) {
      const enVies = arme === 'vies';
      const nom = arme === 'katana' ? 'Katana' : 'Capturer';
      bouton.hidden = charges === undefined;
      jauge.classList.toggle('vies', enVies);
      jauge.classList.toggle('katana', arme === 'katana');

      if (libelle.textContent !== nom) {
        libelle.textContent = nom;
      }

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

      const nouvelle =
        arme === 'katana'
          ? `Katana, ${charges.disponibles > 0 ? 'prêt' : 'en garde'}`
          : `Capturer, ${String(charges.disponibles)} ${enVies ? 'vies' : 'charges'} sur ${String(charges.maximum)}`;

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

/** Le compteur de combo, dans une partie Massacre ou Horde. */
interface CompteurDeCombo {
  afficher(combo: ComboHud | undefined): void;
}

/**
 * Le compteur de combo d'une partie Massacre (etape 7.4) ou Horde (etape 7.5): le
 * multiplicateur en grand, les coups du combo, la fenetre qui s'epuise, et, en Massacre, les
 * ninjas qui restent. Cache hors de ces modes. Il prend la place du bandeau de role de la
 * Chasse, a droite sous les boutons.
 */
function monterCombo(doc: Document, parent: HTMLElement): CompteurDeCombo {
  const compteur = element(doc, 'div', 'hud-massacre', parent);
  compteur.hidden = true;
  const multiplicateur = element(doc, 'strong', 'hud-massacre-multiplicateur', compteur);
  const coups = element(doc, 'span', 'hud-massacre-combo', compteur);
  const fenetre = element(doc, 'span', 'hud-massacre-fenetre', compteur);
  const restants = element(doc, 'span', 'hud-massacre-restants', compteur);
  restants.setAttribute('role', 'status');

  return {
    afficher(combo) {
      compteur.hidden = combo === undefined;

      if (combo === undefined) {
        return;
      }

      const texte = `x${String(combo.multiplicateur)}`;
      if (multiplicateur.textContent !== texte) {
        multiplicateur.textContent = texte;
      }
      compteur.dataset['multiplicateur'] = String(combo.multiplicateur);
      compteur.classList.toggle('en-combo', combo.fenetre > 0);
      coups.textContent = combo.compte;
      fenetre.style.setProperty('--fenetre', String(combo.fenetre));
      restants.textContent = combo.restants;
      restants.hidden = combo.restants === '';
    },
  };
}

/** Le bandeau de notre role, dans une partie Chasse. */
interface BandeauDeChasse {
  afficher(chasse: ChasseHud | undefined): void;
}

/**
 * Le bandeau qui dit notre role dans une partie Chasse, et les proies restantes (etape
 * 7.3). Cache hors de ce mode.
 */
function monterChasse(doc: Document, parent: HTMLElement): BandeauDeChasse {
  const bandeau = element(doc, 'div', 'hud-chasse', parent);
  bandeau.setAttribute('role', 'status');
  bandeau.hidden = true;
  const role = element(doc, 'strong', 'hud-chasse-role', bandeau);
  const consigne = element(doc, 'span', 'hud-chasse-consigne', bandeau);
  const proies = element(doc, 'span', 'hud-chasse-proies', bandeau);

  return {
    afficher(chasse) {
      bandeau.hidden = chasse === undefined;

      if (chasse === undefined) {
        return;
      }

      bandeau.dataset['camp'] = chasse.camp;
      role.textContent = chasse.role;
      consigne.textContent = chasse.consigne;
      proies.textContent = chasse.proies;
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
    // Le badge du x2 de l'Evade, a cote du nom (etape 7.9).
    (element_.querySelector('.hud-x2') as HTMLElement).hidden = !ligne.doubleur;
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
  const x2 = element(doc, 'span', 'hud-x2', ligne);
  x2.textContent = 'x2';
  x2.title = 'Porte le x2 de l’Évadé';
  x2.hidden = true;
  element(doc, 'span', 'hud-points', ligne);
  lignes.set(id, ligne);

  return ligne;
}

/**
 * Met les cartes des effets en accord avec le modele (etape 4.6, cartes a jauge).
 *
 * LES CARTES SONT REUTILISEES, comme les lignes du classement: une carte reconstruite a
 * chaque image ferait repartir son clignotement de fin a zero, et il ne clignoterait
 * jamais. Une carte par effet, reconnue a sa nature, sa categorie et sa cible. L'ordre,
 * du plus proche de sa fin au plus lointain, passe par l'ordre de mise en page.
 */
function majEffets(
  doc: Document,
  liste: HTMLElement,
  cartes: Map<string, HTMLElement>,
  modele: readonly EffetHud[],
): void {
  const vues = new Set<string>();

  modele.forEach((effet, rang) => {
    const cle = `${effet.categorie}-${effet.nature}-${effet.auxAutres ? 'autres' : 'moi'}`;
    vues.add(cle);
    const carte = cartes.get(cle) ?? creerCarte(doc, liste, cartes, cle, effet);

    (carte.querySelector('.hud-effet-reste') as HTMLElement).textContent =
      `${String(effet.resteS)}s`;
    carte.style.setProperty('--part', String(effet.part));
    carte.style.order = String(rang);
    carte.classList.toggle('fin-proche', effet.finProche);
  });

  for (const [cle, carte] of cartes) {
    if (!vues.has(cle)) {
      carte.remove();
      cartes.delete(cle);
    }
  }
}

/** Cree la carte d'un effet, avec ce qui ne change pas pendant sa vie, et la retient. */
function creerCarte(
  doc: Document,
  liste: HTMLElement,
  cartes: Map<string, HTMLElement>,
  cle: string,
  effet: EffetHud,
): HTMLElement {
  const carte = element(doc, 'li', `hud-effet hud-effet-${effet.categorie}`, liste);
  carte.style.setProperty('--couleur-effet', `#${effet.couleur.toString(16).padStart(6, '0')}`);
  carte.classList.toggle('aux-autres', effet.auxAutres);

  const icone = element(doc, 'span', 'hud-effet-icone', carte);
  icone.setAttribute('aria-hidden', 'true');
  element(doc, 'span', 'hud-effet-pictogramme', icone).style.backgroundImage =
    `url("${effet.icone}")`;

  const nom = element(doc, 'span', 'hud-effet-nom', carte);
  element(doc, 'span', 'hud-effet-libelle', nom).textContent = effet.libelle;

  if (effet.auxAutres) {
    element(doc, 'span', 'hud-effet-cible', nom).textContent = 'aux autres';
  }

  element(doc, 'span', 'hud-effet-reste', carte);
  element(doc, 'span', 'hud-effet-jauge', carte).setAttribute('aria-hidden', 'true');
  cartes.set(cle, carte);

  return carte;
}

/**
 * Pose sur la minimap le disque qu'elle montre, en Tactique (etape 7.7). La minimap est
 * carree et la carte ne l'est pas: le disque y devient une ellipse.
 */
function majPortee(
  portee: HTMLElement,
  modele: PorteeMinimap | undefined,
  carte: DimensionsCarte,
): void {
  portee.hidden = modele === undefined;

  if (modele === undefined) {
    return;
  }

  portee.style.left = `${String(((modele.x - modele.rayon) / carte.largeur) * 100)}%`;
  portee.style.top = `${String(((modele.y - modele.rayon) / carte.hauteur) * 100)}%`;
  portee.style.width = `${String(((2 * modele.rayon) / carte.largeur) * 100)}%`;
  portee.style.height = `${String(((2 * modele.rayon) / carte.hauteur) * 100)}%`;
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
