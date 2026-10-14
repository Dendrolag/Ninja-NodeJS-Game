/**
 * Le dessin des reparations d'Among Ninjas (etape 7.27), dans le canevas de la fenetre: les cinq
 * gestes, la cle des deux cles et l'attente du relais. Au trait neon, comme les gestes des taches
 * (dessinsDesGestes.ts); orange pour la panne, rouge pour la surchauffe, vert pour ce qui est
 * fait.
 *
 * Chaque dessin lit l'etat du geste (modeles/gestes) et l'instant local, et ne decide rien. Il
 * dessine dans l'espace du geste, 400 sur 300 unites, que l'appelant a deja mis a l'echelle.
 *
 * CE FICHIER N'EST PAS COUVERT PAR LES TESTS UNITAIRES: le canevas a besoin d'un vrai
 * navigateur. Il se verifie a l'oeil, dans le navigateur, au bureau et sur telephone.
 */

import { AMONG } from '@neon-ninja/shared';

import { HAUTEUR_DU_GESTE, LARGEUR_DU_GESTE } from '../modeles/gestes/commun.js';
import type { EtatFrequence } from '../modeles/gestes/frequence.js';
import { CADRAN, tenueDeLaFrequence } from '../modeles/gestes/frequence.js';
import type { EtatFusibles } from '../modeles/gestes/fusibles.js';
import {
  LEVIER,
  LEVIER_MS,
  NOMBRE_DE_FUSIBLES,
  REMPLACEMENT_MS,
  fusibleGrille,
  placeDuFusible,
} from '../modeles/gestes/fusibles.js';
import type { EtatInterrupteur } from '../modeles/gestes/interrupteur.js';
import { MANETTE } from '../modeles/gestes/interrupteur.js';
import type { EtatLanceur } from '../modeles/gestes/lanceur.js';
import {
  DEMARRAGE_MS,
  DISJONCTEURS,
  DISJONCTEUR_MS,
  LANCEUR,
  TOUX_MS,
  ZONE_VERTE,
  disjoncteurQuiClignote,
  regimeDuLanceur,
} from '../modeles/gestes/lanceur.js';
import type { EtatPurge } from '../modeles/gestes/purge.js';
import { BANDE_DE_LA_VANNE, COUP_MS, pressionDeLaPurge } from '../modeles/gestes/purge.js';
import type { EtatDeReparation } from '../modeles/gestes/reparations.js';
import { avancementDeLaReparation } from '../modeles/gestes/reparations.js';

/** Les couleurs du dessin, celles de la fenetre neon et des sabotages. */
const CYAN = '#2EE6FF';
const CYAN_PALE = 'rgba(46, 230, 255, 0.45)';
const VERT = '#3EE07A';
const ORANGE = '#FF8C1A';
const ROUGE = '#FF2E3A';
const PALE = '#AEB6CC';
const SOMBRE = 'rgba(10, 16, 34, 0.9)';

/** Ce que la fenetre demande de dessiner. */
export type DessinDeReparation =
  | { readonly genre: 'geste'; readonly geste: EtatDeReparation }
  | {
      readonly genre: 'cle';
      /** La cle tournee: tenue dans la page, ou dite tenue par le serveur. */
      readonly tournee: boolean;
      /** L'autre console a sa cle tournee. */
      readonly autreTournee: boolean;
    }
  | { readonly genre: 'attente'; readonly interrupteursCoupes: number };

/** Ou en est une animation de cette duree, finie a cet instant: de zero a un, un a l'arret. */
function avancee(fin: number, duree: number, maintenant: number): number {
  return maintenant >= fin ? 1 : Math.max(1 - (fin - maintenant) / duree, 0);
}

/** Un clignotement, vrai la moitie du temps. */
function clignote(maintenant: number, periodeMs = 500): boolean {
  return Math.floor(maintenant / periodeMs) % 2 === 0;
}

/** Dessine la reparation, dans l'espace du geste deja mis a l'echelle. */
export function dessinerUneReparation(
  ctx: CanvasRenderingContext2D,
  dessin: DessinDeReparation,
  maintenant: number,
  interrupteursCoupes = 0,
): void {
  ctx.clearRect(0, 0, LARGEUR_DU_GESTE, HAUTEUR_DU_GESTE);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (dessin.genre === 'cle') {
    cle(ctx, dessin.tournee, dessin.autreTournee);
    return;
  }

  if (dessin.genre === 'attente') {
    relais(ctx, undefined, dessin.interrupteursCoupes);
    return;
  }

  const { faits, total } = avancementDeLaReparation(dessin.geste);
  if (total > 1) {
    progression(ctx, faits, total);
  }

  switch (dessin.geste.nature) {
    case 'lanceur':
      lanceur(ctx, dessin.geste, maintenant);
      return;
    case 'fusibles':
      fusibles(ctx, dessin.geste, maintenant);
      return;
    case 'frequence':
      frequence(ctx, dessin.geste, maintenant);
      return;
    case 'purge':
      purge(ctx, dessin.geste, maintenant);
      return;
    case 'interrupteur':
      relais(ctx, dessin.geste, interrupteursCoupes);
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
      ctx.fillStyle = VERT;
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

/** Un trait neon: une lueur, puis le trait. */
function neon(ctx: CanvasRenderingContext2D, couleur: string, epaisseur: number): void {
  ctx.save();
  ctx.shadowColor = couleur;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = couleur;
  ctx.lineWidth = epaisseur;
  ctx.stroke();
  ctx.restore();
}

/** Une petite bouffee de fumee, pour un moteur qui tousse. */
function bouffee(ctx: CanvasRenderingContext2D, x: number, y: number, force: number): void {
  ctx.save();
  ctx.globalAlpha = 0.7 * force;
  ctx.fillStyle = '#5A6070';
  for (const [dx, dy, r] of [
    [0, 0, 12],
    [14, -8, 10],
    [-10, -12, 9],
    [6, -20, 8],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * (2 - force), y + dy * (2 - force), r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --------------------------------------------------------------------------
// Relancer le generateur
// --------------------------------------------------------------------------

function lanceur(ctx: CanvasRenderingContext2D, etat: EtatLanceur, maintenant: number): void {
  const demarre = etat.demarreA !== undefined;
  const regime = demarre ? 0.78 : Math.min(regimeDuLanceur(etat, maintenant), 1.05);

  // Le generateur, a gauche: son carter, et le lanceur qui pend.
  rectArrondi(ctx, LANCEUR.gauche, LANCEUR.haut, LANCEUR.largeur, 80, 12);
  ctx.fillStyle = SOMBRE;
  ctx.fill();
  neon(ctx, demarre ? VERT : ORANGE, 3);
  ctx.fillStyle = demarre ? VERT : ORANGE;
  ctx.font = '600 14px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    demarre ? 'EN MARCHE' : 'ARRÊT',
    LANCEUR.gauche + LANCEUR.largeur / 2,
    LANCEUR.haut + 46,
  );

  const xCorde = LANCEUR.gauche + LANCEUR.largeur / 2;
  const yPoignee = LANCEUR.haut + 120 + Math.min(regime, 1) * 110 * (demarre ? 0 : 1);
  ctx.beginPath();
  ctx.moveTo(xCorde, LANCEUR.haut + 80);
  ctx.lineTo(xCorde, yPoignee);
  neon(ctx, PALE, 2);
  rectArrondi(ctx, xCorde - 34, yPoignee, 68, 18, 9);
  ctx.fillStyle = SOMBRE;
  ctx.fill();
  neon(ctx, etat.tireDepuis === undefined ? CYAN : ORANGE, 3);

  if (maintenant < etat.touxJusqua) {
    bouffee(ctx, LANCEUR.gauche + 20, LANCEUR.haut + 6, (etat.touxJusqua - maintenant) / TOUX_MS);
  }

  // L'aiguille du regime, au-dessus des disjoncteurs: la zone verte ou relacher.
  const centre = { x: 302, y: 122 };
  const rayon = 62;
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, rayon, Math.PI, Math.PI * 2);
  neon(ctx, CYAN_PALE, 3);
  ctx.beginPath();
  ctx.arc(
    centre.x,
    centre.y,
    rayon,
    Math.PI + ZONE_VERTE.bas * Math.PI,
    Math.PI + ZONE_VERTE.haut * Math.PI,
  );
  neon(ctx, VERT, 8);
  const tremble = demarre ? Math.sin(maintenant / 40) * 0.02 : 0;
  const angle = Math.PI + Math.min(regime + tremble, 1.02) * Math.PI;
  ctx.beginPath();
  ctx.moveTo(centre.x, centre.y);
  ctx.lineTo(centre.x + Math.cos(angle) * (rayon - 6), centre.y + Math.sin(angle) * (rayon - 6));
  neon(ctx, regime > ZONE_VERTE.haut ? ROUGE : CYAN, 3);

  // Les trois disjoncteurs: tombes en orange, remontes en vert, celui qui clignote en cyan.
  const clignotant = disjoncteurQuiClignote(etat, maintenant);
  const pret = demarre && maintenant >= (etat.demarreA ?? 0) + DEMARRAGE_MS;
  DISJONCTEURS.forEach((place, rang) => {
    const ordre = etat.ordre.indexOf(rang);
    const remonte = ordre < etat.remontes;
    const enCours =
      remonte && ordre === etat.remontes - 1
        ? avancee(etat.finDuDisjoncteur, DISJONCTEUR_MS, maintenant)
        : 1;
    rectArrondi(ctx, place.gauche, place.haut, place.largeur, place.hauteur, 8);
    ctx.fillStyle = SOMBRE;
    ctx.fill();
    const actif = pret && rang === clignotant;
    neon(ctx, remonte ? VERT : actif && clignote(maintenant, 300) ? CYAN : ORANGE, actif ? 4 : 2);
    // La manette: en bas tant que tombe, en haut une fois remonte.
    const yManette = remonte
      ? place.haut + 14 + (1 - enCours) * (place.hauteur - 48)
      : place.haut + place.hauteur - 34;
    rectArrondi(ctx, place.gauche + 10, yManette, place.largeur - 20, 20, 5);
    ctx.fillStyle = remonte ? VERT : actif ? CYAN : ORANGE;
    ctx.fill();
  });
}

// --------------------------------------------------------------------------
// Changer les fusibles
// --------------------------------------------------------------------------

function fusibles(ctx: CanvasRenderingContext2D, etat: EtatFusibles, maintenant: number): void {
  // La boite.
  rectArrondi(ctx, 24, 54, 256, 228, 14);
  ctx.fillStyle = 'rgba(10, 16, 34, 0.6)';
  ctx.fill();
  neon(ctx, CYAN_PALE, 2);

  for (let rang = 0; rang < NOMBRE_DE_FUSIBLES; rang += 1) {
    const { gauche, haut, largeur, hauteur } = placeDuFusible(rang);
    const grille = fusibleGrille(etat, rang);
    const remplace = etat.remplaces.includes(rang);
    const dernier = remplace && etat.remplaces.at(-1) === rang;
    const enCours = dernier ? avancee(etat.finDuRemplacement, REMPLACEMENT_MS, maintenant) : 1;

    // Le verre, et ses deux culots.
    rectArrondi(ctx, gauche + 8, haut + 14, largeur - 16, hauteur - 28, 10);
    ctx.fillStyle = grille ? '#1A1414' : 'rgba(46, 230, 255, 0.08)';
    ctx.fill();
    neon(ctx, grille ? ORANGE : remplace ? VERT : CYAN, 2);
    for (const y of [haut, haut + hauteur - 14]) {
      rectArrondi(ctx, gauche + 4, y, largeur - 8, 14, 4);
      ctx.fillStyle = '#6B7180';
      ctx.fill();
    }

    // Le filament: noirci et rompu, ou entier.
    ctx.beginPath();
    if (grille) {
      ctx.moveTo(gauche + largeur / 2, haut + 16);
      ctx.lineTo(gauche + largeur / 2 + 4, haut + hauteur / 2 - 6);
      ctx.moveTo(gauche + largeur / 2 - 4, haut + hauteur / 2 + 6);
      ctx.lineTo(gauche + largeur / 2, haut + hauteur - 16);
      neon(ctx, '#3A2A20', 3);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.arc(gauche + largeur / 2, haut + hauteur / 2, 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(gauche + largeur / 2, haut + 16);
      ctx.lineTo(gauche + largeur / 2, haut + 16 + (hauteur - 32) * enCours);
      neon(ctx, remplace ? VERT : '#FFE07A', 2);
    }

    if (rang === etat.choix && etat.levierA === undefined) {
      ctx.save();
      ctx.setLineDash([6, 5]);
      rectArrondi(ctx, gauche - 2, haut - 4, largeur + 4, hauteur + 8, 10);
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Le levier general, a droite: il s'eclaire une fois les fusibles changes.
  const pret = etat.remplaces.length >= etat.grilles.length && maintenant >= etat.finDuRemplacement;
  const descente =
    etat.levierA === undefined ? 0 : Math.min((maintenant - etat.levierA) / LEVIER_MS, 1);
  rectArrondi(ctx, LEVIER.gauche + 30, LEVIER.haut, 20, LEVIER.hauteur, 10);
  ctx.fillStyle = SOMBRE;
  ctx.fill();
  neon(ctx, PALE, 2);
  const yPoignee = LEVIER.haut + 10 + descente * (LEVIER.hauteur - 50);
  rectArrondi(ctx, LEVIER.gauche, yPoignee, LEVIER.largeur, 30, 10);
  ctx.fillStyle = SOMBRE;
  ctx.fill();
  neon(
    ctx,
    descente >= 1 ? VERT : pret && clignote(maintenant, 400) ? CYAN : pret ? CYAN_PALE : '#4A5060',
    3,
  );
}

// --------------------------------------------------------------------------
// Accorder la frequence
// --------------------------------------------------------------------------

/** La frequence d'une courbe, en periodes sur la largeur de l'ecran. */
function periodes(valeur: number): number {
  return 1 + valeur * 5;
}

/** Trace une sinusoide dans l'ecran de l'oscilloscope. */
function courbe(
  ctx: CanvasRenderingContext2D,
  ecran: {
    readonly x: number;
    readonly y: number;
    readonly largeur: number;
    readonly hauteur: number;
  },
  valeur: number,
  phase: number,
): void {
  ctx.beginPath();
  for (let pas = 0; pas <= 120; pas += 1) {
    const t = pas / 120;
    const x = ecran.x + t * ecran.largeur;
    const y =
      ecran.y +
      ecran.hauteur / 2 +
      Math.sin(t * periodes(valeur) * Math.PI * 2 + phase) * (ecran.hauteur * 0.36);
    if (pas === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
}

function frequence(ctx: CanvasRenderingContext2D, etat: EtatFrequence, maintenant: number): void {
  const ecran = { x: 22, y: 44, largeur: 236, hauteur: 160 };
  rectArrondi(ctx, ecran.x - 6, ecran.y - 6, ecran.largeur + 12, ecran.hauteur + 12, 10);
  ctx.fillStyle = '#04120E';
  ctx.fill();
  neon(ctx, CYAN_PALE, 2);

  // La grille de l'ecran.
  ctx.save();
  ctx.strokeStyle = 'rgba(62, 224, 122, 0.12)';
  ctx.lineWidth = 1;
  for (let rang = 1; rang < 6; rang += 1) {
    ctx.beginPath();
    ctx.moveTo(ecran.x + (rang * ecran.largeur) / 6, ecran.y);
    ctx.lineTo(ecran.x + (rang * ecran.largeur) / 6, ecran.y + ecran.hauteur);
    ctx.stroke();
  }
  ctx.restore();

  const phase = maintenant / 300;
  const tenue = tenueDeLaFrequence(etat, maintenant);
  const dedans = etat.accordDepuis !== undefined || etat.accordeeA !== undefined;

  // La cible, en pointilles, puis la courbe du cadran, qui gresille hors de l'accord.
  ctx.save();
  ctx.setLineDash([6, 6]);
  courbe(ctx, ecran, etat.cible, phase);
  ctx.strokeStyle = 'rgba(174, 182, 204, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  courbe(ctx, ecran, etat.valeur + (dedans ? 0 : Math.sin(maintenant / 23) * 0.004), phase);
  neon(ctx, dedans ? VERT : ORANGE, 3);

  // La tenue de l'accord, sous l'ecran.
  rectArrondi(ctx, ecran.x, 226, ecran.largeur, 14, 7);
  ctx.strokeStyle = CYAN_PALE;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (tenue > 0) {
    rectArrondi(ctx, ecran.x, 226, Math.max(ecran.largeur * tenue, 14), 14, 7);
    ctx.fillStyle = VERT;
    ctx.fill();
  }

  // Le cadran, a droite: son repere tourne avec la frequence.
  ctx.beginPath();
  ctx.arc(CADRAN.x, CADRAN.y, CADRAN.rayon, 0, Math.PI * 2);
  ctx.fillStyle = SOMBRE;
  ctx.fill();
  neon(ctx, etat.angleDuDoigt === undefined ? CYAN : '#FFFFFF', 3);
  for (let cran = 0; cran < 12; cran += 1) {
    const angle = (cran / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(
      CADRAN.x + Math.cos(angle) * (CADRAN.rayon - 8),
      CADRAN.y + Math.sin(angle) * (CADRAN.rayon - 8),
    );
    ctx.lineTo(
      CADRAN.x + Math.cos(angle) * (CADRAN.rayon - 3),
      CADRAN.y + Math.sin(angle) * (CADRAN.rayon - 3),
    );
    ctx.strokeStyle = CYAN_PALE;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const repere = -Math.PI / 2 + (etat.valeur / 0.6) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(CADRAN.x, CADRAN.y);
  ctx.lineTo(
    CADRAN.x + Math.cos(repere) * (CADRAN.rayon - 12),
    CADRAN.y + Math.sin(repere) * (CADRAN.rayon - 12),
  );
  neon(ctx, CYAN, 4);

  // Le sens a tourner, au-dessus du cadran.
  ctx.fillStyle = PALE;
  ctx.font = '600 13px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FRÉQUENCE', CADRAN.x, CADRAN.y - CADRAN.rayon - 12);
}

// --------------------------------------------------------------------------
// Purger la console
// --------------------------------------------------------------------------

function purge(ctx: CanvasRenderingContext2D, etat: EtatPurge, maintenant: number): void {
  const pression = Math.min(pressionDeLaPurge(etat, maintenant), 1);
  const faite = etat.coups >= 3;
  const tube = { x: 70, y: 44, largeur: 56, hauteur: 236 };
  const yDe = (niveau: number): number => tube.y + tube.hauteur * (1 - niveau);

  // Le manometre: la bande de la vanne, et le rouge au-dessus.
  rectArrondi(ctx, tube.x, tube.y, tube.largeur, tube.hauteur, 14);
  ctx.fillStyle = SOMBRE;
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 46, 58, 0.35)';
  ctx.fillRect(tube.x + 3, yDe(1) + 3, tube.largeur - 6, yDe(BANDE_DE_LA_VANNE.haut) - yDe(1));
  ctx.fillStyle = 'rgba(46, 230, 255, 0.25)';
  ctx.fillRect(
    tube.x + 3,
    yDe(BANDE_DE_LA_VANNE.haut),
    tube.largeur - 6,
    yDe(BANDE_DE_LA_VANNE.bas) - yDe(BANDE_DE_LA_VANNE.haut),
  );
  rectArrondi(
    ctx,
    tube.x + 8,
    yDe(pression),
    tube.largeur - 16,
    tube.y + tube.hauteur - 8 - yDe(pression),
    8,
  );
  ctx.fillStyle = faite ? VERT : pression >= BANDE_DE_LA_VANNE.bas ? CYAN : ROUGE;
  ctx.fill();
  rectArrondi(ctx, tube.x, tube.y, tube.largeur, tube.hauteur, 14);
  neon(ctx, faite ? VERT : CYAN_PALE, 2);
  ctx.fillStyle = PALE;
  ctx.font = '600 12px "Chakra Petch", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VANNE', tube.x + tube.largeur + 8, yDe(BANDE_DE_LA_VANNE.haut) + 14);

  // La vanne, a droite: un volant qui tourne a chaque coup.
  const coup = avancee(etat.finDuCoup, COUP_MS, maintenant);
  const rotation = (etat.coups - 1 + coup) * (Math.PI / 3);
  const volant = { x: 272, y: 168, rayon: 66 };
  ctx.beginPath();
  ctx.arc(volant.x, volant.y, volant.rayon, 0, Math.PI * 2);
  ctx.fillStyle = SOMBRE;
  ctx.fill();
  neon(ctx, faite ? VERT : ROUGE, 5);
  for (let rayon = 0; rayon < 3; rayon += 1) {
    const angle = rotation + (rayon * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(volant.x, volant.y);
    ctx.lineTo(
      volant.x + Math.cos(angle) * volant.rayon,
      volant.y + Math.sin(angle) * volant.rayon,
    );
    neon(ctx, faite ? VERT : ROUGE, 4);
  }
  ctx.beginPath();
  ctx.arc(volant.x, volant.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = faite ? VERT : ROUGE;
  ctx.fill();
}

// --------------------------------------------------------------------------
// Le relais, et son interrupteur
// --------------------------------------------------------------------------

function relais(
  ctx: CanvasRenderingContext2D,
  etat: EtatInterrupteur | undefined,
  interrupteursCoupes: number,
): void {
  const actif = etat !== undefined;
  const position = etat?.position ?? 0;
  const coupe = etat?.coupeA !== undefined;

  // La fente et la manette.
  const xFente = MANETTE.gauche + MANETTE.largeur / 2;
  rectArrondi(ctx, xFente - 12, MANETTE.haut, 24, MANETTE.hauteur, 12);
  ctx.fillStyle = SOMBRE;
  ctx.fill();
  neon(ctx, actif ? CYAN_PALE : '#3A4050', 2);
  const yManette = MANETTE.haut + 6 + position * (MANETTE.hauteur - 50);
  rectArrondi(ctx, MANETTE.gauche, yManette, MANETTE.largeur, 38, 12);
  ctx.fillStyle = SOMBRE;
  ctx.fill();
  neon(ctx, coupe ? VERT : actif ? ROUGE : '#4A5060', 4);
  ctx.fillStyle = actif ? PALE : '#4A5060';
  ctx.font = '600 13px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(actif ? 'TIREZ' : 'ATTENDEZ', xFente, yManette + 25);

  // Les quatre interrupteurs du relais, a droite: coupes en vert.
  for (let rang = 0; rang < AMONG.INTERRUPTEURS_DU_RELAIS; rang += 1) {
    const y = 70 + rang * 52;
    ctx.beginPath();
    ctx.arc(346, y, 16, 0, Math.PI * 2);
    const fait = rang < interrupteursCoupes || (coupe && rang === interrupteursCoupes);
    ctx.fillStyle = fait ? VERT : SOMBRE;
    ctx.fill();
    neon(ctx, fait ? VERT : ROUGE, 2);
  }
  ctx.fillStyle = PALE;
  ctx.font = '600 12px "Chakra Petch", sans-serif';
  ctx.fillText('RELAIS', 346, 40);
}

// --------------------------------------------------------------------------
// Les deux cles
// --------------------------------------------------------------------------

function cle(ctx: CanvasRenderingContext2D, tournee: boolean, autreTournee: boolean): void {
  const centre = { x: 200, y: 140 };

  // La serrure.
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, 78, 0, Math.PI * 2);
  ctx.fillStyle = SOMBRE;
  ctx.fill();
  neon(ctx, tournee ? VERT : ROUGE, 4);

  // La cle: debout au repos, couchee une fois tournee.
  ctx.save();
  ctx.translate(centre.x, centre.y);
  ctx.rotate(tournee ? Math.PI / 2 : 0);
  ctx.beginPath();
  ctx.arc(0, -40, 22, 0, Math.PI * 2);
  ctx.moveTo(0, -18);
  ctx.lineTo(0, 46);
  ctx.moveTo(0, 26);
  ctx.lineTo(14, 26);
  ctx.moveTo(0, 40);
  ctx.lineTo(10, 40);
  neon(ctx, tournee ? VERT : CYAN, 6);
  ctx.restore();

  // Les deux voyants: notre console, l'autre.
  for (const [x, allume, nom] of [
    [110, tournee, 'ICI'],
    [290, autreTournee, 'AUTRE'],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, 260, 14, 0, Math.PI * 2);
    ctx.fillStyle = allume ? VERT : SOMBRE;
    ctx.fill();
    neon(ctx, allume ? VERT : ROUGE, 2);
    ctx.fillStyle = PALE;
    ctx.font = '600 12px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(nom, x, 290);
  }
}
