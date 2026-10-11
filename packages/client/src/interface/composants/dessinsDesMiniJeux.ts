/**
 * Le dessin des quatre mini-jeux des taches longues d'Among Ninjas (etape 7.24), dans le canevas
 * de la fenetre de la tache. Rendu choisi par le porteur du projet sur la planche
 * docs/design/etape-7-24/1-planche.png: le neon au trait (B), pour les quatre, avec l'ecran perdu
 * et l'ecran gagne qui attend la duree minimale de la rangee 5.
 *
 * Comme pour les gestes, chaque dessin lit l'etat du mini-jeu (modeles/gestes) et l'instant
 * local, et ne decide rien. Il dessine dans l'espace du geste, 400 sur 300 unites, deja mis a
 * l'echelle du canevas.
 *
 * CE FICHIER N'EST PAS COUVERT PAR LES TESTS UNITAIRES: le canevas a besoin d'un vrai
 * navigateur. Il se verifie a l'oeil, dans le navigateur, au bureau et sur telephone.
 */

import type { NatureLongue } from '@neon-ninja/shared';

import type { EtatBataille } from '../modeles/gestes/bataille.js';
import {
  COTE_DE_LA_MER,
  MER,
  TIRS_PERMIS,
  TIR_MS,
  bateauCoule,
} from '../modeles/gestes/bataille.js';
import type { BoutonDeCaisses, EtatCaisses, Piece } from '../modeles/gestes/caisses.js';
import {
  BOUTONS,
  COLONNES,
  EFFACEMENT_MS,
  GRILLE,
  LIGNES,
  PIECES_PAR_PARTIE,
  PREPAREE,
  VIDE,
  atterrissage,
  casesDeLaPiece,
} from '../modeles/gestes/caisses.js';
import { HAUTEUR_DU_GESTE, LARGEUR_DU_GESTE } from '../modeles/gestes/commun.js';
import type { EtatEnvahisseurs } from '../modeles/gestes/envahisseurs.js';
import {
  BORD_DROIT,
  BORD_GAUCHE,
  LIGNE_DU_NINJA,
  RAYON_DU_NINJA,
  RAYON_D_UN_ENVAHISSEUR,
  SOL,
  centreDUnEnvahisseur,
} from '../modeles/gestes/envahisseurs.js';
import type { EtatSerpent } from '../modeles/gestes/serpent.js';
import { COLONNES_DU_SERPENT, LIGNES_DU_SERPENT, TERRAIN } from '../modeles/gestes/serpent.js';

/** Les couleurs du neon, celles de la planche. */
const CYAN = '#2EE6FF';
const ROSE = '#FF5FD2';
const JAUNE = '#FFD84A';
const VERT = '#5CFF8A';
const ROUGE = '#FF4D5E';
const BLEU = '#5A7AB0';
const PALE = '#AEB6CC';
const BLANC = '#E8ECF6';

/** Un mini-jeu en cours, quel qu'il soit. */
export type EtatDeMiniJeu = EtatCaisses | EtatSerpent | EtatEnvahisseurs | EtatBataille;

/** Ce que l'ecran gagne annonce, mini-jeu par mini-jeu. */
const VICTOIRES: Readonly<Record<NatureLongue, string>> = {
  caisses: 'Deux lignes !',
  serpent: 'Rassasié !',
  envahisseurs: 'Repoussés !',
  bataille: 'Coulés !',
};

/** Dessine le mini-jeu, dans l'espace du geste deja mis a l'echelle. */
export function dessinerUnMiniJeu(
  ctx: CanvasRenderingContext2D,
  jeu: EtatDeMiniJeu,
  maintenant: number,
): void {
  switch (jeu.nature) {
    case 'caisses':
      caisses(ctx, jeu, maintenant);
      break;
    case 'serpent':
      serpent(ctx, jeu);
      break;
    case 'envahisseurs':
      envahisseurs(ctx, jeu, maintenant);
      break;
    case 'bataille':
      bataille(ctx, jeu, maintenant);
      break;
  }

  if (jeu.perdueJusqua !== undefined) {
    perdu(ctx);
  }
}

/**
 * L'ecran gagne qui attend la duree minimale du serveur (rangee 5 de la planche): le mini-jeu
 * assombri, son annonce, et la barre « Enregistrement du score », a cette part de l'attente.
 */
export function dessinerLAttente(
  ctx: CanvasRenderingContext2D,
  nature: NatureLongue,
  part: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 16, 34, 0.8)';
  ctx.fillRect(0, 32, LARGEUR_DU_GESTE, HAUTEUR_DU_GESTE - 32);
  texte(ctx, VICTOIRES[nature], LARGEUR_DU_GESTE / 2, 128, 30, CYAN, { gras: true, halo: true });
  texte(ctx, 'Enregistrement du score', LARGEUR_DU_GESTE / 2, 166, 14, BLANC);
  const largeur = 220;
  const x = (LARGEUR_DU_GESTE - largeur) / 2;
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1.5;
  rectArrondi(ctx, x, 186, largeur, 12, 6);
  ctx.stroke();
  ctx.fillStyle = CYAN;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 8;
  rectArrondi(ctx, x + 2, 188, (largeur - 4) * Math.min(Math.max(part, 0), 1), 8, 4);
  ctx.fill();
  ctx.restore();
}

// --------------------------------------------------------------------------
// Les formes communes
// --------------------------------------------------------------------------

function rectArrondi(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  rayon: number,
): void {
  const r = Math.min(rayon, largeur / 2, hauteur / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + largeur, y, x + largeur, y + hauteur, r);
  ctx.arcTo(x + largeur, y + hauteur, x, y + hauteur, r);
  ctx.arcTo(x, y + hauteur, x, y, r);
  ctx.arcTo(x, y, x + largeur, y, r);
  ctx.closePath();
}

function texte(
  ctx: CanvasRenderingContext2D,
  chaine: string,
  x: number,
  y: number,
  taille: number,
  couleur: string,
  options: {
    readonly gras?: boolean;
    readonly align?: CanvasTextAlign;
    readonly halo?: boolean;
  } = {},
): void {
  ctx.save();
  ctx.font = `${options.gras === true ? 'bold ' : ''}${String(taille)}px sans-serif`;
  ctx.fillStyle = couleur;
  ctx.textAlign = options.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (options.halo === true) {
    ctx.shadowColor = couleur;
    ctx.shadowBlur = 14;
  }
  ctx.fillText(chaine, x, y);
  ctx.restore();
}

/** Le cadre lumineux d'une aire de jeu, et son fond a peine teinte. */
function plateau(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(46, 230, 255, 0.04)';
  ctx.fillRect(x, y, largeur, hauteur);
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, largeur, hauteur);
  ctx.restore();
}

/** Les lignes fines d'une grille. */
function quadrillage(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colonnes: number,
  lignes: number,
  cote: number,
  couleur: string,
): void {
  ctx.save();
  ctx.strokeStyle = couleur;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let rang = 1; rang < colonnes; rang += 1) {
    ctx.moveTo(x + rang * cote, y);
    ctx.lineTo(x + rang * cote, y + lignes * cote);
  }
  for (let rang = 1; rang < lignes; rang += 1) {
    ctx.moveTo(x, y + rang * cote);
    ctx.lineTo(x + colonnes * cote, y + rang * cote);
  }
  ctx.stroke();
  ctx.restore();
}

/** Une croix lumineuse. */
function croix(ctx: CanvasRenderingContext2D, x: number, y: number, taille: number): void {
  ctx.save();
  ctx.strokeStyle = ROSE;
  ctx.shadowColor = ROSE;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - taille, y - taille);
  ctx.lineTo(x + taille, y + taille);
  ctx.moveTo(x + taille, y - taille);
  ctx.lineTo(x - taille, y + taille);
  ctx.stroke();
  ctx.restore();
}

/** L'ecran perdu: le jeu rougi, « Rate ! », et la partie neuve annoncee. */
function perdu(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 77, 94, 0.2)';
  ctx.fillRect(0, 32, LARGEUR_DU_GESTE, HAUTEUR_DU_GESTE - 32);
  ctx.fillStyle = 'rgba(10, 16, 34, 0.55)';
  ctx.fillRect(60, 112, LARGEUR_DU_GESTE - 120, 76);
  ctx.restore();
  texte(ctx, 'Raté !', LARGEUR_DU_GESTE / 2, 136, 30, ROUGE, { gras: true, halo: true });
  texte(ctx, 'Une partie neuve dans un instant', LARGEUR_DU_GESTE / 2, 170, 14, BLANC);
}

// --------------------------------------------------------------------------
// Empiler des caisses
// --------------------------------------------------------------------------

/** Une caisse au trait: bleue, preparee; rose, la piece; plus pale, posee. */
function caisse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cote: number,
  couleur: string,
  lumineuse: boolean,
): void {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = couleur;
  ctx.fillRect(x + 2, y + 2, cote - 4, cote - 4);
  ctx.globalAlpha = 1;
  if (lumineuse) {
    ctx.shadowColor = couleur;
    ctx.shadowBlur = 10;
  }
  ctx.strokeStyle = couleur;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2.5, y + 2.5, cote - 5, cote - 5);
  ctx.restore();
}

/** Le signe d'un bouton: une fleche, un tour, une descente. */
function signe(ctx: CanvasRenderingContext2D, bouton: BoutonDeCaisses, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = BLANC;
  ctx.strokeStyle = BLANC;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  switch (bouton) {
    case 'gauche':
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 6, y - 8);
      ctx.lineTo(x + 6, y + 8);
      ctx.fill();
      break;
    case 'droite':
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x - 6, y - 8);
      ctx.lineTo(x - 6, y + 8);
      ctx.fill();
      break;
    case 'descendre':
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x - 8, y - 6);
      ctx.lineTo(x + 8, y - 6);
      ctx.fill();
      break;
    case 'tourner':
      ctx.arc(x, y, 8, -Math.PI * 0.35, Math.PI * 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 9, y - 10);
      ctx.lineTo(x + 9, y - 2);
      ctx.lineTo(x + 1, y - 4);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function caisses(ctx: CanvasRenderingContext2D, etat: EtatCaisses, maintenant: number): void {
  const { x, y, cote } = GRILLE;
  plateau(ctx, x, y, COLONNES * cote, LIGNES * cote);
  quadrillage(ctx, x, y, COLONNES, LIGNES, cote, 'rgba(46, 230, 255, 0.08)');

  // L'ombre de l'atterrissage, la ou la piece tomberait.
  const ombre = atterrissage(etat);
  if (ombre !== undefined) {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(255, 95, 210, 0.65)';
    ctx.lineWidth = 1.5;
    for (const [c, l] of casesDeLaPiece(ombre)) {
      ctx.strokeRect(x + c * cote + 3, y + l * cote + 3, cote - 6, cote - 6);
    }
    ctx.restore();
  }

  etat.grille.forEach((contenu, indice) => {
    if (contenu === VIDE) {
      return;
    }
    const c = indice % COLONNES;
    const l = Math.floor(indice / COLONNES);
    caisse(ctx, x + c * cote, y + l * cote, cote, contenu === PREPAREE ? BLEU : '#B98CFF', false);
  });

  if (etat.enJeu !== undefined) {
    for (const [c, l] of casesDeLaPiece(etat.enJeu)) {
      if (l >= 0) {
        caisse(ctx, x + c * cote, y + l * cote, cote, ROSE, true);
      }
    }
  }

  // Les lignes pleines clignotent avant de s'effacer.
  if (etat.effacement !== undefined) {
    const reste = Math.max(etat.effacement.jusqua - maintenant, 0) / EFFACEMENT_MS;
    ctx.save();
    ctx.fillStyle = `rgba(232, 236, 246, ${String(0.25 + 0.5 * Math.abs(Math.sin(reste * 9)))})`;
    for (const ligne of etat.effacement.lignes) {
      ctx.fillRect(x, y + ligne * cote, COLONNES * cote, cote);
    }
    ctx.restore();
  }

  // La suivante, et les comptes.
  const panneau = x + COLONNES * cote + 22;
  texte(ctx, 'Suivante', panneau, y + 10, 12, PALE, { align: 'left' });
  const suivante = etat.pieces[etat.suivante];
  if (suivante !== undefined) {
    const petite: Piece = { forme: suivante, orientation: 0, colonne: 0, ligne: 0 };
    for (const [c, l] of casesDeLaPiece(petite)) {
      caisse(ctx, panneau + 4 + c * 15, y + 24 + l * 15, 15, ROSE, false);
    }
  }
  const enJeu = Math.min(etat.suivante, PIECES_PAR_PARTIE);
  texte(ctx, `Pièce ${String(enJeu)} / ${String(PIECES_PAR_PARTIE)}`, panneau, y + 98, 13, PALE, {
    align: 'left',
  });
  texte(ctx, `Lignes ${String(Math.min(etat.lignes, 2))} / 2`, panneau, y + 120, 13, PALE, {
    align: 'left',
  });

  for (const bouton of BOUTONS) {
    const tenu = bouton.bouton === 'descendre' && etat.descente;
    ctx.save();
    ctx.fillStyle = tenu ? 'rgba(46, 230, 255, 0.25)' : 'rgba(46, 230, 255, 0.08)';
    rectArrondi(ctx, bouton.x, bouton.y, bouton.largeur, bouton.hauteur, 8);
    ctx.fill();
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    signe(ctx, bouton.bouton, bouton.x + bouton.largeur / 2, bouton.y + bouton.hauteur / 2);
  }
}

// --------------------------------------------------------------------------
// Nourrir le serpent
// --------------------------------------------------------------------------

function serpent(ctx: CanvasRenderingContext2D, etat: EtatSerpent): void {
  const { x, y, cote } = TERRAIN;
  plateau(ctx, x, y, COLONNES_DU_SERPENT * cote, LIGNES_DU_SERPENT * cote);
  quadrillage(ctx, x, y, COLONNES_DU_SERPENT, LIGNES_DU_SERPENT, cote, 'rgba(46, 230, 255, 0.07)');
  const centre = ([c, l]: readonly [number, number]): [number, number] => [
    x + (c + 0.5) * cote,
    y + (l + 0.5) * cote,
  ];

  if (etat.manges < 5) {
    const [fx, fy] = centre(etat.fruit);
    ctx.save();
    ctx.shadowColor = JAUNE;
    ctx.shadowBlur = 16;
    ctx.fillStyle = JAUNE;
    ctx.beginPath();
    ctx.arc(fx, fy, cote * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const couleur = etat.perdueJusqua === undefined ? VERT : ROUGE;
  ctx.save();
  ctx.shadowColor = couleur;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = couleur;
  ctx.lineWidth = cote * 0.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  etat.corps.forEach((case_, rang) => {
    const [px, py] = centre(case_);
    if (rang === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });
  ctx.stroke();
  ctx.restore();

  const [tx, ty] = centre(etat.corps[0] ?? [0, 0]);
  ctx.fillStyle = '#0B1020';
  ctx.beginPath();
  ctx.arc(tx, ty - cote * 0.08, cote * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

// --------------------------------------------------------------------------
// Repousser les Black Ninjas
// --------------------------------------------------------------------------

/** Une tete de Black Ninja au trait: un cercle, un bandeau, deux yeux. */
function blackNinja(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const r = RAYON_D_UN_ENVAHISSEUR;
  ctx.save();
  ctx.shadowColor = ROUGE;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = ROUGE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r, y - 2);
  ctx.lineTo(x + r, y - 2);
  ctx.stroke();
  ctx.fillStyle = ROUGE;
  ctx.fillRect(x - r * 0.5, y + 2, r * 0.32, 3);
  ctx.fillRect(x + r * 0.18, y + 2, r * 0.32, 3);
  ctx.restore();
}

/** Un shuriken au trait, qui tourne: jaune, le notre; rouge, une riposte. */
function shuriken(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  couleur: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  for (let pointe = 0; pointe < 8; pointe += 1) {
    const a = (pointe * Math.PI) / 4;
    const r = pointe % 2 === 0 ? 7 : 2.5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.shadowColor = couleur;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = couleur;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function envahisseurs(
  ctx: CanvasRenderingContext2D,
  etat: EtatEnvahisseurs,
  maintenant: number,
): void {
  plateau(ctx, BORD_GAUCHE, 34, BORD_DROIT - BORD_GAUCHE, HAUTEUR_DU_GESTE - 38);
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(255, 77, 94, 0.35)';
  ctx.beginPath();
  ctx.moveTo(BORD_GAUCHE, SOL);
  ctx.lineTo(BORD_DROIT, SOL);
  ctx.stroke();
  ctx.restore();

  etat.debout.forEach((debout, rang) => {
    if (debout) {
      blackNinja(ctx, centreDUnEnvahisseur(etat, rang), etat.rangeeY);
    }
  });

  // L'eclat du dernier abattu, un tiers de seconde.
  const abattu = etat.abattu;
  if (abattu !== undefined && maintenant - abattu.instant < 330) {
    const part = (maintenant - abattu.instant) / 330;
    ctx.save();
    ctx.globalAlpha = 1 - part;
    ctx.strokeStyle = JAUNE;
    ctx.lineWidth = 2;
    for (let rai = 0; rai < 8; rai += 1) {
      const a = (rai * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(abattu.x + Math.cos(a) * (5 + part * 6), abattu.y + Math.sin(a) * (5 + part * 6));
      ctx.lineTo(
        abattu.x + Math.cos(a) * (12 + part * 10),
        abattu.y + Math.sin(a) * (12 + part * 10),
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  if (etat.shuriken !== undefined) {
    shuriken(ctx, etat.shuriken.x, etat.shuriken.y, maintenant / 60, JAUNE);
  }
  for (const riposte of etat.ripostes) {
    shuriken(ctx, riposte.x, riposte.y, -maintenant / 60, ROUGE);
  }

  // Notre ninja: un cercle rose et son bandeau.
  ctx.save();
  ctx.shadowColor = ROSE;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = ROSE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(etat.ninjaX, LIGNE_DU_NINJA, RAYON_DU_NINJA, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(etat.ninjaX - RAYON_DU_NINJA, LIGNE_DU_NINJA - 3);
  ctx.lineTo(etat.ninjaX + RAYON_DU_NINJA, LIGNE_DU_NINJA - 3);
  ctx.stroke();
  ctx.restore();
}

// --------------------------------------------------------------------------
// Bataille navale
// --------------------------------------------------------------------------

function bataille(ctx: CanvasRenderingContext2D, etat: EtatBataille, maintenant: number): void {
  const { x, y, cote } = MER;
  const cote6 = COTE_DE_LA_MER * cote;

  for (let rang = 0; rang < COTE_DE_LA_MER; rang += 1) {
    texte(ctx, 'ABCDEF'.charAt(rang), x + (rang + 0.5) * cote, y - 11, 12, PALE);
    texte(ctx, String(rang + 1), x - 13, y + (rang + 0.5) * cote, 12, PALE);
  }
  plateau(ctx, x, y, cote6, cote6);
  quadrillage(ctx, x, y, COTE_DE_LA_MER, COTE_DE_LA_MER, cote, 'rgba(46, 230, 255, 0.35)');

  // Les bateaux coules, et tous les bateaux sur l'ecran perdu.
  for (const bateau of etat.bateaux) {
    const coule = bateauCoule(etat, bateau);
    if (!coule && etat.perdueJusqua === undefined) {
      continue;
    }
    const colonnes = bateau.map(([c]) => c);
    const lignes = bateau.map(([, l]) => l);
    const bx = x + Math.min(...colonnes) * cote + 4;
    const by = y + Math.min(...lignes) * cote + 4;
    const largeur = (Math.max(...colonnes) - Math.min(...colonnes) + 1) * cote - 8;
    const hauteur = (Math.max(...lignes) - Math.min(...lignes) + 1) * cote - 8;
    ctx.save();
    if (coule) {
      ctx.shadowColor = ROSE;
      ctx.shadowBlur = 10;
    } else {
      ctx.setLineDash([5, 4]);
    }
    ctx.strokeStyle = ROSE;
    ctx.lineWidth = 2;
    rectArrondi(ctx, bx, by, largeur, hauteur, Math.min(largeur, hauteur) / 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const tir of etat.tirs) {
    const cx = x + (tir.case_[0] + 0.5) * cote;
    const cy = y + (tir.case_[1] + 0.5) * cote;
    const animation = Math.min(Math.max((maintenant - tir.instant) / TIR_MS, 0), 1);

    if (animation < 1) {
      // Le tir tombe: un anneau qui se resserre sur la case.
      ctx.save();
      ctx.strokeStyle = JAUNE;
      ctx.globalAlpha = 1 - animation * 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cote * (0.9 - animation * 0.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (animation < 0.6) {
        continue;
      }
    }

    if (tir.touche) {
      croix(ctx, cx, cy, cote * 0.2);
    } else {
      ctx.save();
      ctx.strokeStyle = 'rgba(46, 230, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cote * 0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // La case visee.
  ctx.save();
  ctx.strokeStyle = JAUNE;
  ctx.shadowColor = JAUNE;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x + etat.visee[0] * cote + 3, y + etat.visee[1] * cote + 3, cote - 6, cote - 6);
  ctx.restore();

  const panneau = x + cote6 + 22;
  const coules = etat.bateaux.filter((bateau) => bateauCoule(etat, bateau)).length;
  texte(
    ctx,
    `Tirs ${String(etat.tirs.length)} / ${String(TIRS_PERMIS)}`,
    panneau,
    y + 14,
    15,
    BLANC,
    {
      gras: true,
      align: 'left',
    },
  );
  texte(
    ctx,
    `Coulés ${String(coules)} / ${String(etat.bateaux.length)}`,
    panneau,
    y + 38,
    13,
    PALE,
    {
      align: 'left',
    },
  );
  texte(ctx, 'Les bateaux', panneau, y + 76, 11, PALE, { align: 'left' });
  texte(ctx, 'ne se touchent', panneau, y + 91, 11, PALE, { align: 'left' });
  texte(ctx, 'pas', panneau, y + 106, 11, PALE, { align: 'left' });
}
