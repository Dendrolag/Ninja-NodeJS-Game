/**
 * Le rendu des mines posees (etape 7.11), choisi par le porteur du projet sur la planche
 * docs/design/etape-7-11/1-mine.png.
 *
 * QUI VOIT QUOI. Le flux d'etat envoie toutes les mines a tous les joueurs: c'est la page qui
 * choisit le rendu (micro-decision 13 de la fiche).
 *
 *   - Le poseur et son camp voient leur mine pleine: un disque de metal cerne, un anneau a
 *     la couleur du poseur, une diode qui respire. Son camp, c'est son equipe en Equipes et
 *     les joueurs du meme role en Chasse; ailleurs, le poseur seul.
 *   - Les adversaires n'en voient qu'un reflet blanc, deux dixiemes de seconde toutes les
 *     deux secondes, chaque mine a son rythme.
 *   - Sous la Revelation, l'adversaire la voit pleine, cernee de violet.
 *   - Armee, elle se voit pleine de tous, sa diode s'affole, et un cercle pointille rouge
 *     marque les 130 pixels de son explosion: c'est ce qui laisse a chacun sa chance.
 *   - Elle saute en boule de feu, que tout le monde voit, par-dessus les personnages.
 *
 * Fonctions pures: le temps arrive en parametre, et rien n'est garde d'une image a l'autre.
 */

import type { MineVue, Mode } from '@neon-ninja/shared';
import { COULEUR_DES_TRAQUEURS, MINES } from '@neon-ninja/shared';

import type { FaitDeJeu } from '../faits.js';
import { APPARENCE_MINE } from './apparence.js';
import type { IndicateurScene } from './charges.js';
import type { DisqueScene, TraitScene } from './scene.js';

/** Une mine a dessiner, a sa place affichee. */
export interface MineADessiner {
  readonly mine: MineVue;
  readonly x: number;
  readonly y: number;
}

/** Ce que les mines ajoutent a une image: au sol, sous les personnages, et par-dessus. */
export interface MinesDeLaScene {
  /** Les mines et leurs rayons, poses au sol. */
  readonly sol: IndicateurScene;
  /** Les explosions, par-dessus les personnages. */
  readonly explosions: readonly DisqueScene[];
}

/** Ce que la page sait du spectateur, pour choisir le rendu de chaque mine. */
export interface Spectateur {
  readonly moi: string | undefined;
  /** Notre couleur, celle de notre equipe en Equipes, celle de notre role en Chasse. */
  readonly couleur: string | undefined;
  readonly mode: Mode | undefined;
  /** La Revelation est-elle sur nous. */
  readonly revelation: boolean;
}

/** Les mines de l'image, et les explosions recentes du journal. */
export function minesDeLaScene(
  mines: readonly MineADessiner[],
  journal: readonly FaitDeJeu[],
  spectateur: Spectateur,
  maintenant: number,
): MinesDeLaScene {
  const disques: DisqueScene[] = [];
  const traits: TraitScene[] = [];

  for (const { mine, x, y } of mines) {
    if (mine.avantExplosionMs !== undefined) {
      disques.push(...rayonArme(mine.id, x, y));
      traits.push(...pointilles(mine.id, x, y));
      disques.push(...minePleine(mine, x, y, diodeArmee(mine.avantExplosionMs, maintenant)));
      continue;
    }

    if (estDeMonCamp(mine, spectateur)) {
      disques.push(...minePleine(mine, x, y, respiration(maintenant)));
      continue;
    }

    if (spectateur.revelation) {
      const { revelation } = APPARENCE_MINE;
      disques.push(...minePleine(mine, x, y, respiration(maintenant)), {
        id: `${mine.id}:revelation`,
        x,
        y,
        rayon: revelation.rayon,
        remplissage: undefined,
        contour: {
          couleur: revelation.couleur,
          alpha: revelation.alpha,
          epaisseur: revelation.epaisseur,
        },
      });
      continue;
    }

    traits.push(...reflet(mine.id, x, y, maintenant));
  }

  return { sol: { disques, parts: [], traits }, explosions: explosions(journal, maintenant) };
}

/** Cette mine est-elle du camp du spectateur, qui la voit alors pleine ? */
export function estDeMonCamp(mine: MineVue, spectateur: Spectateur): boolean {
  if (mine.poseur === spectateur.moi) {
    return true;
  }

  if (spectateur.couleur === undefined) {
    return false;
  }

  switch (spectateur.mode) {
    case 'equipes':
      return mine.couleur === spectateur.couleur;
    case 'chasse':
      return (
        (mine.couleur === COULEUR_DES_TRAQUEURS) === (spectateur.couleur === COULEUR_DES_TRAQUEURS)
      );
    default:
      return false;
  }
}

/** La mine pleine: metal cerne, anneau du poseur, diode allumee a ce degre, de zero a un. */
function minePleine(mine: MineVue, x: number, y: number, diode: number): readonly DisqueScene[] {
  const forme = APPARENCE_MINE;
  const couleur = Number.parseInt(mine.couleur.slice(1), 16);
  const disque = (
    suffixe: string,
    rayon: number,
    remplissage: DisqueScene['remplissage'],
    contour: DisqueScene['contour'],
    dx = 0,
    dy = 0,
  ): DisqueScene => ({
    id: `${mine.id}:${suffixe}`,
    x: x + dx,
    y: y + dy,
    rayon,
    remplissage,
    contour,
  });

  return [
    disque(
      'metal',
      forme.rayon,
      { couleur: forme.metal, alpha: 1 },
      { couleur: forme.cerne, alpha: 1, epaisseur: 2 },
    ),
    disque('anneau', forme.rayonAnneau, undefined, {
      couleur,
      alpha: 1,
      epaisseur: forme.epaisseurAnneau,
    }),
    disque('eclat', 1.6, { couleur: forme.metalClair, alpha: 1 }, undefined, -2.5, -3),
    disque('halo', forme.rayonHaloDiode, { couleur: forme.diode, alpha: 0.45 * diode }, undefined),
    disque(
      'diode',
      forme.rayonDiode,
      { couleur: diode > 0.3 ? forme.diode : forme.diodeEteinte, alpha: 1 },
      { couleur: forme.cerne, alpha: 1, epaisseur: 0.8 },
    ),
  ];
}

/** La diode d'une mine posee respire lentement, entre un tiers et tout. */
function respiration(maintenant: number): number {
  const phase = (maintenant % APPARENCE_MINE.respirationMs) / APPARENCE_MINE.respirationMs;

  return 0.65 + 0.35 * Math.sin(phase * 2 * Math.PI);
}

/**
 * La diode d'une mine armee: allumee ou eteinte, d'un clignotement qui s'accelere a mesure
 * que l'explosion approche.
 */
export function diodeArmee(avantExplosionMs: number, maintenant: number): number {
  const { departMs, arriveeMs } = APPARENCE_MINE.clignotement;
  const avancee = 1 - Math.min(Math.max(avantExplosionMs / MINES.DELAI_AVANT_EXPLOSION_MS, 0), 1);
  const periode = departMs - (departMs - arriveeMs) * avancee;

  return maintenant % periode < periode / 2 ? 1 : 0;
}

/** Le disque rouge, tres leger, du rayon de l'explosion. */
function rayonArme(id: string, x: number, y: number): readonly DisqueScene[] {
  return [
    {
      id: `${id}:rayon`,
      x,
      y,
      rayon: MINES.RAYON_EXPLOSION_PX,
      remplissage: APPARENCE_MINE.rayonArme.remplissage,
      contour: undefined,
    },
  ];
}

/** Le cercle pointille du rayon de l'explosion: un trait par tiret. */
function pointilles(id: string, x: number, y: number): readonly TraitScene[] {
  const { tiret, vide, trait, alpha, epaisseur } = APPARENCE_MINE.rayonArme;
  const rayon = MINES.RAYON_EXPLOSION_PX;
  const pas = (tiret + vide) / rayon;
  const longueur = tiret / rayon;
  const nombre = Math.floor((2 * Math.PI) / pas);
  const traits: TraitScene[] = [];

  for (let rang = 0; rang < nombre; rang += 1) {
    const debut = rang * pas;
    const milieu = debut + longueur / 2;
    const fin = debut + longueur;

    traits.push({
      id: `${id}:tiret${String(rang)}`,
      points: [debut, milieu, fin].flatMap((angle) => [
        x + Math.cos(angle) * rayon,
        y + Math.sin(angle) * rayon,
      ]),
      couleur: trait,
      alpha,
      epaisseur,
    });
  }

  return traits;
}

/**
 * Le reflet qu'une mine adverse laisse voir: une croix blanche, deux dixiemes de seconde
 * toutes les deux secondes. Chaque mine a son decalage, tire de son identifiant, pour que
 * les mines d'une carte ne brillent pas toutes ensemble.
 */
export function reflet(
  id: string,
  x: number,
  y: number,
  maintenant: number,
): readonly TraitScene[] {
  const { periodeMs, dureeMs, taille } = APPARENCE_MINE.reflet;
  const phase = (maintenant + decalage(id, periodeMs)) % periodeMs;

  if (phase >= dureeMs) {
    return [];
  }

  const alpha = Math.sin((phase / dureeMs) * Math.PI);
  const cx = x + 3;
  const cy = y - 3;

  return [
    {
      id: `${id}:reflet-h`,
      points: [cx - taille, cy, cx + taille, cy],
      couleur: 0xffffff,
      alpha,
      epaisseur: 1.6,
    },
    {
      id: `${id}:reflet-v`,
      points: [cx, cy - taille, cx, cy + taille],
      couleur: 0xffffff,
      alpha,
      epaisseur: 1.6,
    },
  ];
}

/**
 * Un decalage stable, tire d'un identifiant. La somme est melangee par un grand multiplicateur
 * avant d'etre ramenee a la periode: sans lui, deux mines posees l'une apres l'autre, aux
 * identifiants voisins, brillaient a une milliseconde d'ecart.
 */
function decalage(id: string, periodeMs: number): number {
  let somme = 0;

  for (const caractere of id) {
    somme = (somme * 31 + caractere.charCodeAt(0)) % 100_003;
  }

  return (somme * 2_654_435_761) % periodeMs;
}

/** Les boules de feu des explosions recentes, d'apres le journal. */
function explosions(journal: readonly FaitDeJeu[], maintenant: number): readonly DisqueScene[] {
  const disques: DisqueScene[] = [];

  for (const fait of journal) {
    if (fait.nature !== 'mineExplosee') {
      continue;
    }

    const ecoule = maintenant - fait.instant;

    if (ecoule >= 0 && ecoule < APPARENCE_MINE.explosion.dureeMs) {
      disques.push(...bouleDeFeu(fait.charge.mine, fait.charge.x, fait.charge.y, ecoule));
    }
  }

  return disques;
}

/**
 * Une boule de feu, ecouleMs apres l'explosion: des lobes cernes qui remplissent le rayon,
 * orange puis rouges, eclaires de jaune, puis qui palissent.
 */
export function bouleDeFeu(
  id: string,
  x: number,
  y: number,
  ecouleMs: number,
): readonly DisqueScene[] {
  const forme = APPARENCE_MINE.explosion;
  const gonfle = Math.min(ecouleMs / forme.gonflementMs, 1);
  const fin = Math.max(ecouleMs - forme.gonflementMs, 0) / (forme.dureeMs - forme.gonflementMs);
  const opacite = 1 - fin * 0.85;
  const teinte = ecouleMs < forme.orangeMs ? forme.orange : forme.rouge;
  const lobe = (
    suffixe: string,
    [dx, dy, rayon]: readonly [number, number, number],
    plus: number,
    couleur: number,
    echelle = 1,
    decale = 0,
  ): DisqueScene => ({
    id: `${id}:${suffixe}`,
    x: x + dx * gonfle - decale,
    y: y + dy * gonfle - decale,
    rayon: Math.max((rayon * echelle + plus) * gonfle, 0),
    remplissage: { couleur, alpha: opacite },
    contour: undefined,
  });

  return [
    ...forme.lobes.map((forme_, rang) => lobe(`cerne${String(rang)}`, forme_, 3, forme.cerne)),
    ...forme.lobes.map((forme_, rang) => lobe(`feu${String(rang)}`, forme_, 0, teinte)),
    ...forme.lobes
      .slice(0, 3)
      .map((forme_, rang) => lobe(`clair${String(rang)}`, forme_, 0, forme.clair, 0.45, 3)),
  ];
}
