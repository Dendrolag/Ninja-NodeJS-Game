/**
 * Le dessin des sept gestes des taches courtes d'Among Ninjas (etape 7.21), dans le canevas de
 * la fenetre de la tache; les mini-jeux des taches longues (etape 7.24) ont leur fichier,
 * dessinsDesMiniJeux.ts. Rendu choisi par le porteur du projet sur les planches
 * docs/design/etape-7-21/1-planche.png (la fenetre neon, 1A) et 2-gestes.png (les gestes).
 *
 * Chaque dessin lit l'etat du geste (modeles/gestes) et l'instant local, et ne decide rien: les
 * regles et le rythme sont dans le modele. Il dessine dans l'espace du geste, 400 sur 300
 * unites, que l'appelant a deja mis a l'echelle du canevas.
 *
 * CE FICHIER N'EST PAS COUVERT PAR LES TESTS UNITAIRES: le canevas a besoin d'un vrai
 * navigateur. Il se verifie a l'oeil, dans le navigateur, au bureau et sur telephone.
 */

import {
  BORNES,
  FIL_MS,
  PRISES,
  boutDeLaBorne,
  boutDeLaPrise,
  hauteurDuRang,
} from '../modeles/gestes/couleurs.js';
import type { EtatCouleurs } from '../modeles/gestes/couleurs.js';
import {
  BANDE_DE_LA_FUMEE,
  NOMBRE_DE_BONUS,
  VIDAGE_MS,
  niveauDeLaFumee,
} from '../modeles/gestes/fumee.js';
import type { EtatFumee } from '../modeles/gestes/fumee.js';
import type { EtatFrotte } from '../modeles/gestes/frotter.js';
import type { EtatDeGeste } from '../modeles/gestes/index.js';
import { HAUTEUR_DU_GESTE, LARGEUR_DU_GESTE, avancementDuGeste } from '../modeles/gestes/index.js';
import { PASSE_MS, PIERRE } from '../modeles/gestes/katana.js';
import type { EtatKatana } from '../modeles/gestes/katana.js';
import type { EtatLunettes } from '../modeles/gestes/lunettes.js';
import {
  ALVEOLES,
  MINE_MS,
  RAYON_D_UNE_ALVEOLE,
  TAS,
  minesAuTas,
} from '../modeles/gestes/mines.js';
import type { EtatMines } from '../modeles/gestes/mines.js';
import {
  CARTOUCHE_MS,
  FENETRE_DE_CHARGEMENT,
  NOMBRE_DE_CARTOUCHES,
  RANGEE_DES_CARTOUCHES,
} from '../modeles/gestes/munitions.js';
import type { EtatMunitions } from '../modeles/gestes/munitions.js';
import type { EtatSang } from '../modeles/gestes/sang.js';

import { dessinerUnMiniJeu } from './dessinsDesMiniJeux.js';

/** Les couleurs du dessin, celles de la fenetre neon. */
const CYAN = '#2EE6FF';
const CYAN_PALE = 'rgba(46, 230, 255, 0.5)';
const VERT = '#3EE07A';
const PALE = '#AEB6CC';

/** Ou en est une animation de cette duree, finie a cet instant: de zero a un, un a l'arret. */
function avancee(fin: number, duree: number, maintenant: number): number {
  return maintenant >= fin ? 1 : Math.max(1 - (fin - maintenant) / duree, 0);
}

/** Dessine le geste, dans l'espace du geste deja mis a l'echelle. */
export function dessinerLeGeste(
  ctx: CanvasRenderingContext2D,
  geste: EtatDeGeste,
  maintenant: number,
): void {
  ctx.clearRect(0, 0, LARGEUR_DU_GESTE, HAUTEUR_DU_GESTE);
  const { faits, total } = avancementDuGeste(geste);
  // La grille des caisses monte jusqu'en haut: elle ecrit ses lignes a cote d'elle.
  if (geste.nature !== 'caisses') {
    progression(ctx, faits, total);
  }

  switch (geste.nature) {
    case 'katana':
      katana(ctx, geste, maintenant);
      return;
    case 'lunettes':
      lunettes(ctx, geste);
      return;
    case 'sang':
      sang(ctx, geste);
      return;
    case 'couleurs':
      couleurs(ctx, geste, maintenant);
      return;
    case 'mines':
      mines(ctx, geste, maintenant);
      return;
    case 'munitions':
      munitions(ctx, geste, maintenant);
      return;
    case 'fumee':
      fumee(ctx, geste, maintenant);
      return;
    case 'caisses':
    case 'serpent':
    case 'envahisseurs':
    case 'bataille':
      dessinerUnMiniJeu(ctx, geste, maintenant);
      return;
  }
}

// --------------------------------------------------------------------------
// Les formes communes
// --------------------------------------------------------------------------

/** Les points de progression, en haut: faits, puis restants. */
function progression(ctx: CanvasRenderingContext2D, faits: number, total: number): void {
  for (let rang = 0; rang < total; rang += 1) {
    const x = LARGEUR_DU_GESTE / 2 + (rang - (total - 1) / 2) * 24;
    ctx.beginPath();
    ctx.arc(x, 18, 7, 0, Math.PI * 2);

    if (rang < faits) {
      ctx.fillStyle = CYAN;
      ctx.fill();
    } else {
      ctx.strokeStyle = CYAN_PALE;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

/** Un rectangle aux coins arrondis, a remplir ou tracer. */
function rectArrondi(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  rayon: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + rayon, y);
  ctx.arcTo(x + largeur, y, x + largeur, y + hauteur, rayon);
  ctx.arcTo(x + largeur, y + hauteur, x, y + hauteur, rayon);
  ctx.arcTo(x, y + hauteur, x, y, rayon);
  ctx.arcTo(x, y, x + largeur, y, rayon);
  ctx.closePath();
}

/** Une coche verte. */
function coche(ctx: CanvasRenderingContext2D, x: number, y: number, taille: number): void {
  ctx.save();
  ctx.strokeStyle = VERT;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - taille * 0.45, y);
  ctx.lineTo(x - taille * 0.1, y + taille * 0.35);
  ctx.lineTo(x + taille * 0.5, y - taille * 0.4);
  ctx.stroke();
  ctx.restore();
}

/** Un anneau en pointilles neon: ce que le clavier a choisi. */
function choixDuClavier(ctx: CanvasRenderingContext2D, x: number, y: number, rayon: number): void {
  ctx.save();
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(x, y, rayon, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Une fleche en pointilles, de la queue a la pointe. */
function fleche(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  ctx.save();
  ctx.strokeStyle = CYAN;
  ctx.fillStyle = CYAN;
  ctx.lineWidth = 3;
  ctx.setLineDash([9, 6]);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  const angle = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1 + Math.cos(angle) * 10, y1 + Math.sin(angle) * 10);
  ctx.lineTo(x1 + Math.cos(angle + 2.5) * 12, y1 + Math.sin(angle + 2.5) * 12);
  ctx.lineTo(x1 + Math.cos(angle - 2.5) * 12, y1 + Math.sin(angle - 2.5) * 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Des etincelles qui jaillissent de ce point, vers le haut. */
function etincelles(ctx: CanvasRenderingContext2D, x: number, y: number, force: number): void {
  ctx.save();
  ctx.strokeStyle = '#FFE07A';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  for (let rang = 0; rang < 7; rang += 1) {
    const angle = -Math.PI / 2 - 0.9 + (rang / 6) * 1.8;
    const longueur = (10 + ((rang * 7) % 11)) * force;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4);
    ctx.lineTo(x + Math.cos(angle) * longueur, y + Math.sin(angle) * longueur);
    ctx.stroke();
  }

  ctx.restore();
}

// --------------------------------------------------------------------------
// Aiguiser un katana
// --------------------------------------------------------------------------

/** La course de la lame sur la pierre, d'un bout a l'autre d'une passe. */
const COURSE_DE_LA_LAME = 120;

function katana(ctx: CanvasRenderingContext2D, etat: EtatKatana, maintenant: number): void {
  const { gauche, haut, largeur, hauteur } = PIERRE;

  // La pierre, et son support de bois.
  ctx.fillStyle = '#4A4F5C';
  rectArrondi(ctx, gauche, haut, largeur, hauteur, 10);
  ctx.fill();
  ctx.fillStyle = '#6B7180';
  rectArrondi(ctx, gauche + 6, haut + 4, largeur - 12, hauteur * 0.45, 8);
  ctx.fill();
  ctx.fillStyle = '#2B2F3A';
  ctx.fillRect(gauche - 10, haut + hauteur - 4, largeur + 20, 12);

  // La lame glisse pendant une passe, ou suit le pointeur qui la tient.
  const enCours = maintenant < etat.finDeLaPasse;
  const glisse =
    etat.prise !== undefined
      ? Math.min(Math.max(etat.prise.x - etat.prise.departX, 0), COURSE_DE_LA_LAME)
      : enCours
        ? avancee(etat.finDeLaPasse, PASSE_MS, maintenant) * COURSE_DE_LA_LAME
        : 0;
  const garde = gauche + 40 + glisse;
  const y = haut - 6;

  ctx.save();
  ctx.translate(garde, y);
  ctx.rotate(-0.06);
  // La poignee, tressee.
  ctx.fillStyle = '#20232B';
  rectArrondi(ctx, -70, -7, 62, 14, 4);
  ctx.fill();
  ctx.strokeStyle = '#B8955A';
  ctx.lineWidth = 2;
  for (let rang = 0; rang < 6; rang += 1) {
    ctx.beginPath();
    ctx.moveTo(-66 + rang * 10, -7);
    ctx.lineTo(-61 + rang * 10, 7);
    ctx.stroke();
  }
  // La garde, puis la lame.
  ctx.fillStyle = '#C9A24A';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  const lame = ctx.createLinearGradient(0, -6, 0, 6);
  lame.addColorStop(0, '#F4F7FB');
  lame.addColorStop(0.55, '#C3CAD6');
  lame.addColorStop(1, '#8A93A3');
  ctx.fillStyle = lame;
  ctx.beginPath();
  ctx.moveTo(6, -5);
  ctx.lineTo(180, -6);
  ctx.quadraticCurveTo(200, -6, 204, 4);
  ctx.lineTo(6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (enCours || etat.prise !== undefined) {
    etincelles(ctx, garde + 110, haut - 2, 1);
  }

  fleche(ctx, gauche + 10, haut + hauteur + 34, gauche + largeur - 18, haut + hauteur + 34);
}

// --------------------------------------------------------------------------
// Frotter: les lunettes et le sang
// --------------------------------------------------------------------------

/** Le chiffon ou l'eponge: a la place du pointeur, ou pres de la zone choisie au clavier. */
function placeDuFrotteur(etat: EtatFrotte): { x: number; y: number } | undefined {
  if (etat.pointeur !== undefined) {
    return etat.pointeur;
  }

  const zone = etat.zones[etat.choisie];

  return zone === undefined || (etat.sale[etat.choisie] ?? 0) === 0
    ? undefined
    : { x: zone.x + zone.rayon * 0.4, y: zone.y + zone.rayon * 0.4 };
}

function lunettes(ctx: CanvasRenderingContext2D, etat: EtatLunettes): void {
  etat.zones.forEach((verre, rang) => {
    const sale = etat.sale[rang] ?? 0;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(verre.x, verre.y, verre.rayon, verre.rayon * 0.82, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180, 220, 255, 0.22)';
    ctx.fill();
    ctx.clip();

    for (const trace of etat.traces[rang] ?? []) {
      ctx.fillStyle = `rgba(150, 140, 120, ${String(0.7 * sale)})`;
      ctx.beginPath();
      ctx.ellipse(
        verre.x + trace.dx,
        verre.y + trace.dy,
        trace.rayonX,
        trace.rayonY,
        trace.angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    if (sale === 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(verre.x - verre.rayon * 0.5, verre.y - verre.rayon * 0.2);
      ctx.lineTo(verre.x - verre.rayon * 0.1, verre.y - verre.rayon * 0.55);
      ctx.stroke();
    }

    ctx.restore();

    ctx.strokeStyle = '#D9DEE8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(verre.x, verre.y, verre.rayon, verre.rayon * 0.82, 0, 0, Math.PI * 2);
    ctx.stroke();
    jaugeOuCoche(ctx, verre.x, verre.y + verre.rayon + 18, verre.rayon, sale);

    if (rang === etat.choisie && sale > 0 && etat.pointeur === undefined) {
      choixDuClavier(ctx, verre.x, verre.y, verre.rayon + 9);
    }
  });

  // Le pont entre les verres.
  const [gauche, droit] = etat.zones;
  if (gauche !== undefined && droit !== undefined) {
    ctx.strokeStyle = '#D9DEE8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(gauche.x + gauche.rayon * 0.9, gauche.y - gauche.rayon * 0.3);
    ctx.quadraticCurveTo(
      200,
      gauche.y - gauche.rayon * 0.6,
      droit.x - droit.rayon * 0.9,
      droit.y - droit.rayon * 0.3,
    );
    ctx.stroke();
  }

  const chiffon = placeDuFrotteur(etat);
  if (chiffon !== undefined) {
    ctx.save();
    ctx.translate(chiffon.x, chiffon.y);
    ctx.rotate(-0.4);
    ctx.fillStyle = '#5AD1E6';
    rectArrondi(ctx, -26, -18, 52, 36, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.lineTo(18, -10);
    ctx.moveTo(-16, 6);
    ctx.lineTo(16, 4);
    ctx.stroke();
    ctx.restore();
  }
}

/** Sous une zone: une jauge de ce qui est efface, ou une coche une fois propre. */
function jaugeOuCoche(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  demiLargeur: number,
  sale: number,
): void {
  if (sale === 0) {
    coche(ctx, x, y, 16);
    return;
  }

  ctx.fillStyle = '#26304F';
  rectArrondi(ctx, x - demiLargeur, y - 5, demiLargeur * 2, 10, 4);
  ctx.fill();
  ctx.fillStyle = CYAN;
  rectArrondi(ctx, x - demiLargeur, y - 5, demiLargeur * 2 * (1 - sale), 10, 4);
  ctx.fill();
}

function sang(ctx: CanvasRenderingContext2D, etat: EtatSang): void {
  // Le carrelage.
  ctx.fillStyle = '#9D968A';
  ctx.fillRect(10, 40, 380, 255);
  ctx.strokeStyle = '#7F786D';
  ctx.lineWidth = 2;
  for (let x = 10; x <= 390; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, 40);
    ctx.lineTo(x, 295);
    ctx.stroke();
  }
  for (let y = 40; y <= 295; y += 46) {
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(390, y);
    ctx.stroke();
  }

  etat.zones.forEach((tache, rang) => {
    const sale = etat.sale[rang] ?? 0;

    if (sale === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.ellipse(tache.x, tache.y, 40, 22, 0.2, 0, Math.PI * 2);
      ctx.fill();
      coche(ctx, tache.x, tache.y, 20);
      return;
    }

    ctx.fillStyle = `rgba(150, 0, 18, ${String(0.9 * sale)})`;
    for (const goutte of etat.gouttes[rang] ?? []) {
      ctx.beginPath();
      ctx.ellipse(
        tache.x + goutte.dx,
        tache.y + goutte.dy,
        goutte.rayonX,
        goutte.rayonY,
        goutte.angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    if (rang === etat.choisie && etat.pointeur === undefined) {
      choixDuClavier(ctx, tache.x, tache.y, tache.rayon + 6);
    }
  });

  const eponge = placeDuFrotteur(etat);
  if (eponge !== undefined) {
    ctx.save();
    ctx.translate(eponge.x, eponge.y);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#FFD23D';
    rectArrondi(ctx, -28, -16, 56, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#2F9E4F';
    ctx.fillRect(-28, -16, 56, 8);
    ctx.restore();
  }
}

// --------------------------------------------------------------------------
// Relier des couleurs
// --------------------------------------------------------------------------

/** Un fil, d'un point a l'autre, en courbe. */
function fil(
  ctx: CanvasRenderingContext2D,
  de: { x: number; y: number },
  vers: { x: number; y: number },
  couleur: string,
  lueur: number,
): void {
  ctx.save();
  ctx.strokeStyle = couleur;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  if (lueur > 0) {
    ctx.shadowColor = couleur;
    ctx.shadowBlur = 16 * lueur;
  }
  ctx.beginPath();
  ctx.moveTo(de.x, de.y);
  const milieu = (de.x + vers.x) / 2;
  ctx.bezierCurveTo(milieu, de.y, milieu, vers.y, vers.x, vers.y);
  ctx.stroke();
  ctx.restore();
}

/** Une couleur claire, ou le nom s'ecrit en sombre. */
function claire(couleur: string): boolean {
  const valeur = Number.parseInt(couleur.slice(1), 16);
  const r = (valeur >> 16) & 255;
  const v = (valeur >> 8) & 255;
  const b = valeur & 255;

  return 0.299 * r + 0.587 * v + 0.114 * b > 165;
}

function couleurs(ctx: CanvasRenderingContext2D, etat: EtatCouleurs, maintenant: number): void {
  const lueur = 1 - avancee(etat.finDuFil, FIL_MS, maintenant);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 13px sans-serif';

  etat.couleurs.forEach((couleur, rang) => {
    const y = hauteurDuRang(rang);
    ctx.fillStyle = couleur.couleur;
    rectArrondi(ctx, PRISES.gauche, y - PRISES.hauteur / 2, PRISES.largeur, PRISES.hauteur, 6);
    ctx.fill();
    ctx.fillStyle = claire(couleur.couleur) ? '#1A1A1A' : '#FFFFFF';
    ctx.fillText(couleur.nom, PRISES.gauche + PRISES.largeur / 2, y);

    if (
      etat.curseur.cote === 'gauche' &&
      etat.curseur.gauche === rang &&
      etat.relies[rang] !== true
    ) {
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      rectArrondi(
        ctx,
        PRISES.gauche - 5,
        y - PRISES.hauteur / 2 - 5,
        PRISES.largeur + 10,
        PRISES.hauteur + 10,
        8,
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  ctx.font = 'bold 14px sans-serif';
  etat.noms.forEach((nom, rang) => {
    const y = hauteurDuRang(rang);
    ctx.fillStyle = '#121A33';
    ctx.strokeStyle = etat.curseur.cote === 'droite' && etat.curseur.droite === rang ? CYAN : PALE;
    ctx.lineWidth = 2;
    rectArrondi(ctx, BORNES.gauche, y - BORNES.hauteur / 2, BORNES.largeur, BORNES.hauteur, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(nom, BORNES.gauche + BORNES.largeur / 2, y);
  });

  // Les fils relies, le dernier qui brille encore un instant.
  etat.couleurs.forEach((couleur, rang) => {
    if (etat.relies[rang] === true) {
      const nom = etat.noms.indexOf(couleur.nom);
      fil(ctx, boutDeLaPrise(rang), boutDeLaBorne(nom), couleur.couleur, lueur);
    }
  });

  if (etat.prise !== undefined) {
    const couleur = etat.couleurs[etat.prise.rang]?.couleur ?? '#FFFFFF';
    fil(ctx, boutDeLaPrise(etat.prise.rang), etat.prise, couleur, 0);
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.arc(etat.prise.x, etat.prise.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --------------------------------------------------------------------------
// Ranger des mines
// --------------------------------------------------------------------------

/** Une mine a pointes, son reflet et son voyant. */
function mine(ctx: CanvasRenderingContext2D, x: number, y: number, taille: number): void {
  ctx.save();
  ctx.strokeStyle = '#7D8596';
  ctx.lineWidth = taille * 0.16;
  ctx.lineCap = 'round';
  for (let rang = 0; rang < 8; rang += 1) {
    const angle = (rang * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * taille * 0.62, y + Math.sin(angle) * taille * 0.62);
    ctx.stroke();
  }
  ctx.fillStyle = '#2A2F3A';
  ctx.strokeStyle = CYAN_PALE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, taille * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x - taille * 0.14, y - taille * 0.14, taille * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FF3030';
  ctx.beginPath();
  ctx.arc(x + taille * 0.12, y + taille * 0.1, taille * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function mines(ctx: CanvasRenderingContext2D, etat: EtatMines, maintenant: number): void {
  // La mallette.
  ctx.fillStyle = '#3A3F4C';
  rectArrondi(ctx, 195, 60, 185, 192, 10);
  ctx.fill();
  ctx.fillStyle = '#20242E';
  rectArrondi(ctx, 203, 68, 169, 176, 8);
  ctx.fill();

  const derniere = 1 - avancee(etat.finDeLaMine, MINE_MS, maintenant);

  ALVEOLES.forEach((centre, rang) => {
    ctx.save();
    ctx.fillStyle = '#0D1018';
    ctx.strokeStyle = etat.curseur === rang && etat.rangees[rang] === false ? CYAN : '#4A5060';
    ctx.lineWidth = etat.curseur === rang ? 3 : 2;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, RAYON_D_UNE_ALVEOLE, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (etat.rangees[rang] === true) {
      mine(ctx, centre.x, centre.y, 44);
    }
  });

  // La mine qui vient d'entrer brille un instant.
  if (derniere > 0) {
    ctx.save();
    ctx.globalAlpha = derniere;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 3;
    for (const [rang, centre] of ALVEOLES.entries()) {
      if (etat.rangees[rang] === true) {
        ctx.beginPath();
        ctx.arc(centre.x, centre.y, RAYON_D_UNE_ALVEOLE + 6 * (1 - derniere), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Le tas: les mines qui restent, deux par deux, cote a cote.
  for (let rang = 0; rang < minesAuTas(etat); rang += 1) {
    mine(ctx, TAS.x - 20 + (rang % 2) * 40, TAS.y - 22 + Math.floor(rang / 2) * 44, 34);
  }

  if (etat.prise !== undefined) {
    mine(ctx, etat.prise.x, etat.prise.y, 48);
  } else if (minesAuTas(etat) > 0) {
    const vide = ALVEOLES[etat.rangees.indexOf(false)];
    if (vide !== undefined) {
      fleche(ctx, TAS.x + 34, TAS.y, vide.x - RAYON_D_UNE_ALVEOLE - 8, vide.y);
    }
  }
}

// --------------------------------------------------------------------------
// Recharger des munitions
// --------------------------------------------------------------------------

/** Une cartouche: le corps rouge, le culot de laiton. */
function cartouche(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  taille: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#C9312C';
  rectArrondi(ctx, -taille * 0.5, -taille * 0.17, taille * 0.78, taille * 0.34, 3);
  ctx.fill();
  ctx.fillStyle = '#D9A83A';
  ctx.fillRect(taille * 0.22, -taille * 0.19, taille * 0.28, taille * 0.38);
  ctx.restore();
}

function munitions(ctx: CanvasRenderingContext2D, etat: EtatMunitions, maintenant: number): void {
  const y = 110;

  // La crosse, la carcasse, le canon et le magasin tubulaire.
  ctx.fillStyle = '#6B4423';
  ctx.beginPath();
  ctx.moveTo(14, y - 8);
  ctx.lineTo(96, y - 14);
  ctx.lineTo(110, y + 6);
  ctx.lineTo(36, y + 30);
  ctx.lineTo(14, y + 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4A4F5C';
  rectArrondi(ctx, 96, y - 16, 74, 30, 4);
  ctx.fill();
  ctx.fillStyle = '#2B2F3A';
  ctx.fillRect(170, y - 13, 216, 11);
  ctx.fillStyle = '#3A3F4C';
  ctx.fillRect(166, y + 1, 186, 12);

  // La fenetre de chargement, ou glisser les cartouches.
  ctx.save();
  ctx.strokeStyle = etat.prise === undefined ? CYAN_PALE : CYAN;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(
    FENETRE_DE_CHARGEMENT.x,
    FENETRE_DE_CHARGEMENT.y,
    FENETRE_DE_CHARGEMENT.rayon,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();

  // Les cartouches deja dans le tube.
  for (let rang = 0; rang < etat.inserees; rang += 1) {
    cartouche(ctx, 190 + rang * 34, y + 7, 26, 0);
  }

  // La derniere cartouche entre, en glissant.
  const entree = avancee(etat.finDeLaCartouche, CARTOUCHE_MS, maintenant);
  if (entree < 1) {
    cartouche(
      ctx,
      FENETRE_DE_CHARGEMENT.x,
      FENETRE_DE_CHARGEMENT.y + 30 * (1 - entree),
      32,
      -0.5 * (1 - entree),
    );
  }

  // Celles qui restent, debout, en bas.
  const restantes = NOMBRE_DE_CARTOUCHES - etat.inserees - (etat.prise === undefined ? 0 : 1);
  const { gauche, haut, largeur, hauteur } = RANGEE_DES_CARTOUCHES;
  for (let rang = 0; rang < restantes; rang += 1) {
    cartouche(
      ctx,
      gauche + 20 + rang * (largeur / NOMBRE_DE_CARTOUCHES),
      haut + hauteur / 2,
      44,
      -Math.PI / 2,
    );
  }

  if (etat.prise !== undefined) {
    cartouche(ctx, etat.prise.x, etat.prise.y, 40, -0.5);
  } else if (restantes > 0) {
    fleche(ctx, gauche + 4, haut + 6, FENETRE_DE_CHARGEMENT.x + 28, FENETRE_DE_CHARGEMENT.y + 30);
  }
}

// --------------------------------------------------------------------------
// Remplir de fumee
// --------------------------------------------------------------------------

/** Un petit nuage de fumee. */
function nuage(ctx: CanvasRenderingContext2D, x: number, y: number, taille: number): void {
  ctx.fillStyle = 'rgba(225, 228, 235, 0.9)';
  ctx.beginPath();
  ctx.arc(x - taille * 0.35, y + taille * 0.12, taille * 0.36, 0, Math.PI * 2);
  ctx.arc(x + taille * 0.32, y + taille * 0.16, taille * 0.32, 0, Math.PI * 2);
  ctx.arc(x, y - taille * 0.22, taille * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

/** Le bouton a tenir, a droite. */
const BOUTON_DE_LA_FUMEE = { x: 340, y: 160, rayon: 38 } as const;

function fumee(ctx: CanvasRenderingContext2D, etat: EtatFumee, maintenant: number): void {
  const largeur = 64;
  const haut = 46;
  const hauteur = 220;

  for (let rang = 0; rang < NOMBRE_DE_BONUS; rang += 1) {
    const x = 70 + rang * 90;
    const courant = rang === etat.remplis;
    // Le niveau: plein une fois rempli; pour le bonus en cours, la jauge, ou le vidage.
    const vidage = maintenant < etat.videJusqua ? (etat.videJusqua - maintenant) / VIDAGE_MS : 0;
    const niveau =
      rang < etat.remplis
        ? 1
        : courant
          ? Math.max(niveauDeLaFumee(etat, maintenant), vidage * 0.6)
          : 0;

    ctx.save();
    ctx.fillStyle = 'rgba(180, 220, 255, 0.1)';
    ctx.strokeStyle = courant ? CYAN : '#6B7180';
    ctx.lineWidth = courant ? 3 : 2;
    rectArrondi(ctx, x - largeur / 2, haut, largeur, hauteur, 16);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (niveau > 0) {
      ctx.save();
      rectArrondi(ctx, x - largeur / 2 + 4, haut + 4, largeur - 8, hauteur - 8, 13);
      ctx.clip();
      const surface = haut + hauteur - hauteur * Math.min(niveau, 1);
      ctx.fillStyle = niveau > 1 ? 'rgba(255, 120, 120, 0.75)' : 'rgba(205, 210, 220, 0.75)';
      ctx.fillRect(x - largeur / 2, surface, largeur, hauteur);
      for (let bouffee = 0; bouffee < 3; bouffee += 1) {
        nuage(ctx, x - 12 + bouffee * 12, surface + 6 + bouffee * 3, 14);
      }
      ctx.restore();
    }

    if (courant) {
      // La bande ou relacher.
      const bas = haut + hauteur - hauteur * BANDE_DE_LA_FUMEE.bas;
      const hautDeLaBande = haut + hauteur - hauteur * BANDE_DE_LA_FUMEE.haut;
      ctx.save();
      ctx.fillStyle = 'rgba(62, 224, 122, 0.25)';
      ctx.strokeStyle = VERT;
      ctx.lineWidth = 2;
      ctx.fillRect(x - largeur / 2 - 10, hautDeLaBande, largeur + 20, bas - hautDeLaBande);
      ctx.strokeRect(x - largeur / 2 - 10, hautDeLaBande, largeur + 20, bas - hautDeLaBande);
      ctx.restore();
    }

    if (rang < etat.remplis) {
      coche(ctx, x, haut + hauteur + 18, 16);
    }
  }

  // Le bouton a tenir.
  const tenu = etat.tenuDepuis !== undefined;
  ctx.save();
  ctx.fillStyle = tenu ? 'rgba(46, 230, 255, 0.45)' : 'rgba(46, 230, 255, 0.2)';
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 3;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(BOUTON_DE_LA_FUMEE.x, BOUTON_DE_LA_FUMEE.y, BOUTON_DE_LA_FUMEE.rayon, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Tenir', BOUTON_DE_LA_FUMEE.x, BOUTON_DE_LA_FUMEE.y);
}
