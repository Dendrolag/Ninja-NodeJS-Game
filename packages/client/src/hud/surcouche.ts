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
 *      et le terrain. Seuls les boutons d'action les recoivent: la poche (etape
 *      7.10), la localisation et la capture.
 *
 * LES BOUTONS D'ACTION SONT RANGES ENSEMBLE, en bas a droite, la capture la plus a droite,
 * sous le pouce (9 octobre 2026, a la demande du porteur du projet): poses chacun a sa
 * place, la capture, la localisation, la minimap et le combo se chevauchaient sur un
 * telephone tenu a l'horizontale.
 *
 * LA MISE EN FORME N'EST PAS ICI. Les elements portent des classes; la feuille de
 * style arrive avec les ecrans de l'etape 4.3, qui decidera de l'apparence a
 * partir des maquettes. Ce fichier garantit la STRUCTURE et le CONTENU.
 */

import type { EtatManette } from '../controles/tactile.js';
import type { Glyphe } from '../interface/icones.js';
import { icone } from '../interface/icones.js';
import type {
  ArmeHud,
  ChargesHud,
  ChasseHud,
  ComboHud,
  EffetHud,
  Hud,
  LigneHud,
  PocheHud,
  PointRadar,
  RestantsHud,
} from './modele.js';

/** Ce qu'il faut pour monter la surcouche. */
export interface OptionsSurcouche {
  /** L'element qui contiendra le HUD. */
  readonly hote: HTMLElement;
  /** Le document a utiliser. Celui de la page par defaut. */
  readonly document?: Document;
  /**
   * L'endroit de la barre du haut ou poser le compteur des ninjas qui restent, en Massacre.
   * Sans lui, il est pose avec le reste du HUD.
   */
  readonly compteurs?: HTMLElement;
  /**
   * Ce que fait le bouton de capture: tirer (etape 7.1). A fournir dans une partie
   * Tactique seulement; sans lui, la surcouche ne pose ni bouton ni charges.
   */
  readonly capturer?: () => void;
  /** Ce que fait le bouton de localisation: montrer ou est notre ninja. Sans lui, pas de bouton. */
  readonly localiser?: () => void;
  /**
   * Ce que fait le bouton de la poche: s'en servir (etape 7.10). Sans lui, la carte de la
   * poche se montre, et aucun bouton n'est pose.
   */
  readonly utiliserLaPoche?: () => void;
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

  const temps = monterTemps(doc, racine);
  const pause = element(doc, 'div', 'hud-pause', racine);
  const retour = element(doc, 'div', 'hud-retour', racine);
  retour.setAttribute('role', 'status');
  retour.textContent = 'Connexion perdue. Retour dans la partie…';
  retour.hidden = true;
  const classement = element(doc, 'ol', 'hud-classement', racine);
  const effets = element(doc, 'ul', 'hud-effets', racine);
  const radar = element(doc, 'div', 'hud-radar', racine);
  radar.setAttribute('aria-hidden', 'true');
  element(doc, 'div', 'hud-radar-balayage', radar);
  const disque = element(doc, 'div', 'hud-radar-disque', radar);
  // Sous le radar, a droite: le role en Chasse, ou le combo en Massacre et en Horde.
  const chasse = monterChasse(doc, racine);
  const combo = monterCombo(doc, racine);
  const restants = monterRestants(doc, options.compteurs ?? racine);

  const manette = element(doc, 'div', 'hud-manette', racine);
  const pouce = element(doc, 'div', 'hud-manette-pouce', manette);
  // Cachee tant qu'aucun doigt ne la tient. L'etape 4.2 l'oubliait: la manette
  // restait affichee dans un coin tant que personne n'avait touche l'ecran, ce
  // qui ne se voyait pas faute de page pour afficher le HUD.
  manette.hidden = true;

  // Les boutons d'action, de gauche a droite: la poche, la localisation, la capture.
  const boutons = element(doc, 'div', 'hud-boutons', racine);
  const poche = monterPoche(doc, boutons, effets, options.utiliserLaPoche);
  const localisation =
    options.localiser === undefined
      ? undefined
      : monterBouton(doc, boutons, {
          classe: 'hud-localiser',
          glyphe: 'epingle',
          libelle: 'Localiser',
          touche: 'F',
          etiquette: 'Localiser mon ninja',
          surAppui: options.localiser,
        });
  const capture =
    options.capturer === undefined ? undefined : monterCapture(doc, boutons, options.capturer);

  options.hote.append(racine);

  /** Les lignes du classement deja creees, retrouvees par identifiant. */
  const lignes = new Map<string, HTMLElement>();
  /** Les points du radar deja crees. */
  const points = new Map<string, HTMLElement>();
  /** Les cartes des effets deja creees (etape 4.6). */
  const cartesDEffets = new Map<string, HTMLElement>();

  return {
    afficher(hud: Hud) {
      temps.afficher(hud.temps, hud.urgence);

      pause.textContent =
        hud.pausePar === undefined ? 'Partie suspendue' : `Partie suspendue par ${hud.pausePar}`;
      // Un lien perdu passe avant la pause: rien de ce qui est affiche n'est plus a jour.
      pause.hidden = !hud.enPause || hud.retourEnCours;
      retour.hidden = !hud.retourEnCours;

      chasse.afficher(hud.chasse);
      combo.afficher(hud.combo);
      restants.afficher(hud.restants);
      majClassement(doc, classement, lignes, hud.classement);
      majEffets(doc, effets, cartesDEffets, hud.effets);
      poche.afficher(hud.poche);
      majRadar(doc, disque, points, hud.radar);
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
      localisation?.demonter();
      poche.demonter();
      restants.demonter();
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

/** Le temps restant, en haut au centre. */
interface TempsRestant {
  afficher(temps: string, urgence: boolean): void;
}

/**
 * Le temps restant: un chronometre et les minutes. Cache tant que rien n'est affiche, sans
 * quoi un ecran sans partie montrerait un chronometre vide.
 */
function monterTemps(doc: Document, parent: HTMLElement): TempsRestant {
  const temps = element(doc, 'div', 'hud-temps', parent);
  temps.hidden = true;
  temps.append(icone(doc, 'horloge'));
  const valeur = element(doc, 'span', 'hud-temps-valeur', temps);

  return {
    afficher(texte, urgence) {
      temps.hidden = texte === '';
      if (valeur.textContent !== texte) {
        valeur.textContent = texte;
      }
      temps.classList.toggle('urgence', urgence);
    },
  };
}

/** Ce qu'il faut pour poser un bouton d'action. */
interface OptionsBoutonDAction {
  readonly classe: string;
  readonly glyphe: Glyphe;
  /** Le nom ecrit sous le bouton. */
  readonly libelle: string;
  /** La touche qui fait la meme chose, rappelee a cote du nom sur ordinateur. */
  readonly touche?: string;
  /** Le nom lu par les lecteurs d'ecran. */
  readonly etiquette: string;
  readonly surAppui: () => void;
}

/** Un bouton d'action pose, avec ce qu'il faut pour le changer et le retirer. */
interface BoutonDAction {
  readonly bouton: HTMLButtonElement;
  readonly libelle: HTMLElement;
  /** Change son pictogramme. */
  changerDeGlyphe(glyphe: Glyphe): void;
  demonter(): void;
}

/**
 * Pose un bouton d'action: un disque et son pictogramme, le nom dessous.
 *
 * IL REAGIT A L'APPUI, PAS AU CLIC. Un clic attend que le doigt se leve, et il
 * n'arrive pas toujours quand un autre doigt tient la manette: sur telephone, le
 * pouce gauche court et le pouce droit agit. Il n'est pas dans la zone de la
 * manette, qui est le terrain: un doigt pose dessus ne la plante pas.
 *
 * Hors du parcours au clavier, et jamais en focus: un bouton qui a le focus garde la barre
 * d'espace pour lui (controles/clavier.ts), et un clic de souris sur le bouton empecherait
 * alors de tirer au clavier. Chaque geste a sa touche.
 */
function monterBouton(
  doc: Document,
  parent: HTMLElement,
  options: OptionsBoutonDAction,
): BoutonDAction {
  const bouton = doc.createElement('button');
  bouton.type = 'button';
  bouton.className = `hud-bouton ${options.classe}`;
  bouton.style.pointerEvents = 'auto';
  bouton.tabIndex = -1;
  bouton.setAttribute('aria-label', options.etiquette);
  let pictogramme: SVGSVGElement = icone(doc, options.glyphe, 26);
  bouton.append(pictogramme);
  const libelle = element(doc, 'span', 'hud-bouton-libelle', bouton);
  libelle.textContent = options.libelle;

  if (options.touche !== undefined) {
    element(doc, 'kbd', 'hud-bouton-touche', bouton).textContent = options.touche;
  }

  parent.append(bouton);

  const surAppui = (evenement: Event): void => {
    evenement.preventDefault();
    options.surAppui();
  };

  bouton.addEventListener('pointerdown', surAppui);

  return {
    bouton,
    libelle,

    changerDeGlyphe(glyphe) {
      const nouveau = icone(doc, glyphe, 26);
      pictogramme.replaceWith(nouveau);
      pictogramme = nouveau;
    },

    demonter() {
      bouton.removeEventListener('pointerdown', surAppui);
    },
  };
}

/** Le bouton de capture, qui montre aussi nos charges. */
interface BoutonDeCapture {
  /** Montre nos charges, ou, en Chasse, nos vies, ou, en Massacre, notre katana. */
  afficher(charges: ChargesHud | undefined, arme: ArmeHud): void;
  demonter(): void;
}

/**
 * Pose le bouton de capture du mode Tactique (etape 7.1), et du traqueur de la Chasse
 * (etape 7.3), dont les points sont les vies, et le katana du Massacre (etape 7.4).
 *
 * Un point par charge, sur le bas du disque: plein pour une charge disponible, et celui de
 * la charge qui revient se remplit a mesure.
 */
function monterCapture(doc: Document, parent: HTMLElement, capturer: () => void): BoutonDeCapture {
  const pose = monterBouton(doc, parent, {
    classe: 'hud-capture',
    glyphe: 'masque',
    libelle: 'Capturer',
    touche: 'Espace',
    etiquette: 'Capturer',
    surAppui: capturer,
  });
  const { bouton, libelle } = pose;
  libelle.classList.add('hud-capture-libelle');
  bouton.hidden = true;
  const jauge = element(doc, 'span', 'hud-charges', bouton);

  /** Les points deja poses, un par charge. */
  const points: HTMLElement[] = [];
  let etiquette = '';
  let arme: ArmeHud = 'charges';

  return {
    afficher(charges, nouvelleArme) {
      const enVies = nouvelleArme === 'vies';
      const nom = nouvelleArme === 'katana' ? 'Katana' : 'Capturer';
      bouton.hidden = charges === undefined;
      jauge.classList.toggle('vies', enVies);
      jauge.classList.toggle('katana', nouvelleArme === 'katana');

      if (nouvelleArme !== arme) {
        arme = nouvelleArme;
        pose.changerDeGlyphe(arme === 'katana' ? 'katana' : 'masque');
      }

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
      pose.demonter();
    },
  };
}

/** La poche, au HUD: sa carte parmi les effets, et son bouton sur un ecran tactile. */
interface PocheAuHud {
  afficher(poche: PocheHud | undefined): void;
  demonter(): void;
}

/**
 * Pose la poche au HUD (etape 7.10), rendus A des planches de docs/design/etape-7-10/.
 *
 * LA CARTE se range en tete des effets, sans jauge: la fumee dure tant qu'on la garde. Elle
 * porte la touche E, que la feuille de style cache sur un ecran tactile. LE BOUTON, un
 * disque de brume a gauche des autres boutons d'action, ne se montre que sur un ecran
 * tactile, et seulement quand la poche est pleine. Comme eux, il reagit a l'appui, et il
 * est hors du terrain: un doigt pose dessus ne plante pas la manette.
 */
function monterPoche(
  doc: Document,
  boutons: HTMLElement,
  effets: HTMLElement,
  utiliser: (() => void) | undefined,
): PocheAuHud {
  // La carte n'est dans la liste des effets que tant que la poche est pleine.
  const carte = element(doc, 'li', 'hud-effet hud-effet-poche', effets);
  carte.remove();
  const pastille = element(doc, 'span', 'hud-effet-icone', carte);
  pastille.setAttribute('aria-hidden', 'true');
  const pictogramme = element(doc, 'span', 'hud-effet-pictogramme', pastille);
  const nom = element(doc, 'span', 'hud-effet-nom', carte);
  const libelle = element(doc, 'span', 'hud-effet-libelle', nom);
  element(doc, 'span', 'hud-effet-cible', nom).textContent = 'En poche';
  const touche = element(doc, 'kbd', 'hud-poche-touche', carte);
  touche.textContent = 'E';

  let bouton: HTMLButtonElement | undefined;
  let boutonIcone: HTMLElement | undefined;
  let boutonLibelle: HTMLElement | undefined;
  const surAppui = (evenement: Event): void => {
    evenement.preventDefault();
    utiliser?.();
  };

  if (utiliser !== undefined) {
    bouton = doc.createElement('button');
    bouton.type = 'button';
    bouton.className = 'hud-bouton hud-poche';
    bouton.style.pointerEvents = 'auto';
    // Jamais en focus, pour la meme raison que les autres boutons d'action.
    bouton.tabIndex = -1;
    bouton.hidden = true;
    boutonIcone = element(doc, 'span', 'hud-poche-pictogramme', bouton);
    boutonIcone.setAttribute('aria-hidden', 'true');
    boutonLibelle = element(doc, 'span', 'hud-bouton-libelle', bouton);
    bouton.addEventListener('pointerdown', surAppui);
    boutons.append(bouton);
  }

  /** L'objet affiche, pour ne toucher au document que s'il change. */
  let affiche: string | undefined;

  return {
    afficher(poche) {
      const nature = poche?.nature;
      if (nature === affiche) {
        return;
      }
      affiche = nature;

      if (poche === undefined) {
        carte.remove();
      } else if (carte.parentElement !== effets) {
        effets.prepend(carte);
      }
      if (bouton !== undefined) {
        bouton.hidden = poche === undefined;
      }

      if (poche === undefined) {
        return;
      }

      const couleur = `#${poche.couleur.toString(16).padStart(6, '0')}`;
      carte.style.setProperty('--couleur-effet', couleur);
      pictogramme.style.backgroundImage = `url("${poche.icone}")`;
      libelle.textContent = poche.libelle;

      if (bouton !== undefined && boutonIcone !== undefined && boutonLibelle !== undefined) {
        bouton.style.setProperty('--couleur-effet', couleur);
        boutonIcone.style.backgroundImage = `url("${poche.icone}")`;
        boutonLibelle.textContent = poche.libelle;
        bouton.setAttribute('aria-label', `${poche.libelle} : s’en servir`);
      }
    },

    demonter() {
      bouton?.removeEventListener('pointerdown', surAppui);
    },
  };
}

/** Le multiplicateur de combo, dans une partie Massacre ou Horde. */
interface IndicateurDeCombo {
  afficher(combo: ComboHud | undefined): void;
}

/**
 * Le combo d'une partie Massacre (etape 7.4) ou Horde (etape 7.5), reduit a son
 * multiplicateur (9 octobre 2026, a la demande du porteur du projet): un « x2 » flottant,
 * sans fond, sous le radar, et un trait de vitesse dessous, la fenetre du combo qui
 * s'epuise. Il saute a chaque cran. Le compte des coups reste lu par les lecteurs d'ecran.
 */
function monterCombo(doc: Document, parent: HTMLElement): IndicateurDeCombo {
  const indicateur = element(doc, 'div', 'hud-combo', parent);
  indicateur.hidden = true;
  const multiplicateur = element(doc, 'strong', 'hud-combo-multiplicateur', indicateur);
  const fenetre = element(doc, 'span', 'hud-combo-fenetre', indicateur);
  fenetre.setAttribute('aria-hidden', 'true');
  const compte = element(doc, 'span', 'hud-combo-compte visuellement-cache', indicateur);

  return {
    afficher(combo) {
      indicateur.hidden = combo === undefined;

      if (combo === undefined) {
        return;
      }

      const texte = `x${String(combo.multiplicateur)}`;
      if (multiplicateur.textContent !== texte) {
        multiplicateur.textContent = texte;
        // Le saut repart a chaque cran: retire, puis remis apres un calcul de la mise en page.
        indicateur.classList.remove('saut');
        void indicateur.offsetWidth;
        indicateur.classList.add('saut');
      }
      indicateur.dataset['multiplicateur'] = String(combo.multiplicateur);
      fenetre.style.setProperty('--fenetre', String(combo.fenetre));
      if (compte.textContent !== combo.compte) {
        compte.textContent = combo.compte;
      }
    },
  };
}

/** Le compteur des ninjas qui restent, dans une partie Massacre. */
interface CompteurDeRestants {
  afficher(restants: RestantsHud | undefined): void;
  demonter(): void;
}

/**
 * Les ninjas qui restent a tuer en Massacre (etape 7.4), dans la barre du haut: une tete de
 * ninja et leur nombre. La phrase entiere reste lue par les lecteurs d'ecran.
 */
function monterRestants(doc: Document, parent: HTMLElement): CompteurDeRestants {
  const compteur = element(doc, 'div', 'hud-restants', parent);
  compteur.setAttribute('role', 'status');
  compteur.hidden = true;
  compteur.append(icone(doc, 'masque'));
  const nombre = element(doc, 'span', 'hud-restants-nombre', compteur);
  nombre.setAttribute('aria-hidden', 'true');
  const phrase = element(doc, 'span', 'hud-restants-libelle visuellement-cache', compteur);

  return {
    afficher(restants) {
      compteur.hidden = restants === undefined;

      if (restants === undefined) {
        return;
      }

      const texte = String(restants.nombre);
      if (nombre.textContent !== texte) {
        nombre.textContent = texte;
      }
      if (phrase.textContent !== restants.libelle) {
        phrase.textContent = restants.libelle;
        compteur.title = restants.libelle;
      }
    },

    demonter() {
      compteur.remove();
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
    // Hors du podium, une ligne autre que la notre: un ecran etroit ne la montre pas.
    element_.classList.toggle('hors-podium', ligne.rang > 3 && !ligne.moi);
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

  const pastille = element(doc, 'span', 'hud-effet-icone', carte);
  pastille.setAttribute('aria-hidden', 'true');
  element(doc, 'span', 'hud-effet-pictogramme', pastille).style.backgroundImage =
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
 * Met les points du radar en accord avec le modele. Le modele les place par rapport au
 * centre, en part de la portee: le disque en fait des pourcentages.
 */
function majRadar(
  doc: Document,
  disque: HTMLElement,
  points: Map<string, HTMLElement>,
  modele: readonly PointRadar[],
): void {
  const vus = new Set<string>();

  for (const point of modele) {
    vus.add(point.id);
    let element_ = points.get(point.id);

    if (element_ === undefined) {
      element_ = element(doc, 'div', 'hud-point', disque);
      points.set(point.id, element_);
    }

    element_.style.left = `${String(50 + point.x * 50)}%`;
    element_.style.top = `${String(50 + point.y * 50)}%`;
    element_.style.background = point.couleur;
    element_.classList.toggle('moi', point.moi);
    element_.classList.toggle('au-bord', point.auBord);
  }

  for (const [id, element_] of points) {
    if (!vus.has(id)) {
      element_.remove();
      points.delete(id);
    }
  }
}
