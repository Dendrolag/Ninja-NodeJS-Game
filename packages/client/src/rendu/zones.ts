/**
 * Le rendu des zones ouvertes (etape 7.12): le rendu B de la planche
 * docs/design/etape-7-12/1-zones.png, « motif vivant », choisi par le porteur du projet le 2
 * octobre 2026. Il remplace le disque plat et le libelle ecrit des premiers essais.
 *
 * Chaque zone est un disque a peine teinte, cerne d'un bord neon a sa couleur, ou un motif
 * montre ce qu'elle fait:
 *
 *   - le chaos: des eclairs qui crepitent au hasard dans le disque;
 *   - la repulsion: des ondes qui partent du centre, des chevrons qui poussent vers le bord;
 *   - l'attraction: des ondes qui se resserrent vers le centre, des chevrons qui aspirent;
 *   - l'invisibilite: un voile de brume qui ondule et masque le sol.
 *
 * Son pictogramme, sur le bord en haut, remplace le libelle. Les trois dernieres secondes, la
 * zone palit et son bord clignote.
 *
 * Fonctions pures: le temps arrive en parametre, et le hasard des eclairs se tire de
 * l'identifiant de la zone et du moment, si bien que deux images au meme instant sont les
 * memes et que rien n'est garde d'une image a l'autre.
 */

import type { MineDeZoneVue, TypeZone, ZoneVue } from '@neon-ninja/shared';
import { MINES_DE_ZONE, ZONES } from '@neon-ninja/shared';

import type { FaitDeJeu } from '../faits.js';
import {
  APPARENCE_MINE,
  APPARENCE_MINE_DE_ZONE,
  APPARENCE_ZONE,
  APPARENCE_ZONES,
} from './apparence.js';
import type { DisqueScene, TraitScene } from './scene.js';

/** Des disques et des traits, dessines dans cet ordre. */
export interface CoucheScene {
  readonly disques: readonly DisqueScene[];
  readonly traits: readonly TraitScene[];
}

/**
 * Ce qui se dessine au sol pour une zone ou une mine de zone: des couches, dans l'ordre. Le
 * pictogramme d'une zone est une couche a part, dessinee apres son motif, qui ne le couvre pas.
 */
export interface ZoneScene {
  readonly id: string;
  readonly couches: readonly CoucheScene[];
}

/** Le dessin d'une zone ouverte, a cet instant. */
export function zoneVivante(zone: ZoneVue, maintenant: number): ZoneScene {
  const forme = APPARENCE_ZONES;
  const couleur = APPARENCE_ZONE[zone.type].couleur;
  const finissante = zone.dureeRestanteMs < forme.fin.dureeMs;
  const eclat = finissante ? forme.fin.palit : 1;
  const bordAllume = !finissante || Math.floor(maintenant / forme.fin.clignotementMs) % 2 === 0;
  const motif = motifDe(zone, couleur, eclat, maintenant);
  const disque = (
    suffixe: string,
    remplissage: DisqueScene['remplissage'],
    contour: DisqueScene['contour'],
  ): DisqueScene => ({
    id: `${zone.id}:${suffixe}`,
    x: zone.x,
    y: zone.y,
    rayon: zone.rayon,
    remplissage,
    contour,
  });

  return {
    id: zone.id,
    couches: [
      {
        disques: [
          disque('fond', { couleur, alpha: forme.fond * eclat }, undefined),
          ...motif.disques,
          disque('halo', undefined, {
            couleur,
            alpha: forme.halo.alpha * (bordAllume ? 1 : 0.3),
            epaisseur: forme.halo.epaisseur,
          }),
          disque('bord', undefined, {
            couleur,
            alpha: forme.bord.alpha * (bordAllume ? 1 : 0.3),
            epaisseur: forme.bord.epaisseur,
          }),
        ],
        traits: motif.traits,
      },
      pictogramme(
        zone.type,
        `${zone.id}:picto`,
        zone.x,
        zone.y - zone.rayon,
        forme.pictogramme.rayon,
      ),
    ],
  };
}

/** Le motif de la zone, selon sa nature. */
function motifDe(zone: ZoneVue, couleur: number, eclat: number, maintenant: number): CoucheScene {
  switch (zone.type) {
    case 'chaos':
      return { disques: [], traits: eclairs(zone, couleur, eclat, maintenant) };
    case 'repulsion':
    case 'attraction':
      return ondes(zone, couleur, eclat, maintenant);
    case 'invisibilite':
      return voile(zone, couleur, eclat, maintenant);
  }
}

/**
 * Le chaos: des eclairs, a des places tirees au hasard a chaque periode, qui crepitent. Le
 * hasard se tire de l'identifiant de la zone et du numero de la periode.
 */
function eclairs(
  zone: ZoneVue,
  couleur: number,
  eclat: number,
  maintenant: number,
): readonly TraitScene[] {
  const forme = APPARENCE_ZONES.chaos;
  const periode = Math.floor(maintenant / forme.periodeMs);
  const traits: TraitScene[] = [];

  for (let rang = 0; rang < forme.eclairs; rang += 1) {
    const tirage = (numero: number): number => bruit(zone.id, periode, rang * 7 + numero);
    // La racine repartit les eclairs sur l'aire du disque, et pas en tas au centre.
    const distance = Math.sqrt(tirage(0)) * zone.rayon * 0.85;
    const angle = tirage(1) * 2 * Math.PI;
    const cap = tirage(2) * 2 * Math.PI;
    const taille = forme.tailleMin + tirage(3) * (forme.tailleMax - forme.tailleMin);
    const cx = zone.x + Math.cos(angle) * distance;
    const cy = zone.y + Math.sin(angle) * distance;
    const ux = Math.cos(cap);
    const uy = Math.sin(cap);

    traits.push({
      id: `${zone.id}:eclair${String(rang)}`,
      points: [
        [-0.5, 0],
        [-1 / 6, 0.25],
        [1 / 6, -0.25],
        [0.5, 0],
      ].flatMap(([le, travers]) => [
        cx + (ux * (le ?? 0) - uy * (travers ?? 0)) * taille,
        cy + (uy * (le ?? 0) + ux * (travers ?? 0)) * taille,
      ]),
      couleur,
      alpha: APPARENCE_ZONES.motif.alpha * eclat * (0.55 + 0.45 * tirage(4)),
      epaisseur: APPARENCE_ZONES.motif.epaisseur,
    });
  }

  return traits;
}

/**
 * La repulsion et l'attraction: des ondes qui partent du centre, ou y reviennent, et des
 * chevrons pres du bord, tournes vers le dehors ou vers le dedans, qui avancent dans le
 * meme sens.
 */
function ondes(zone: ZoneVue, couleur: number, eclat: number, maintenant: number): CoucheScene {
  const forme = APPARENCE_ZONES.ondes;
  const sortantes = zone.type === 'repulsion';
  const phase = (maintenant % forme.periodeMs) / forme.periodeMs;
  const disques: DisqueScene[] = [];
  const traits: TraitScene[] = [];

  for (let rang = 0; rang < forme.nombre; rang += 1) {
    const avancee = (phase + rang / forme.nombre) % 1;
    const part = sortantes ? avancee : 1 - avancee;

    disques.push({
      id: `${zone.id}:onde${String(rang)}`,
      x: zone.x,
      y: zone.y,
      rayon: zone.rayon * part,
      remplissage: undefined,
      contour: {
        couleur,
        // Une onde nait et meurt transparente: elle n'apparait pas d'un coup au centre.
        alpha: APPARENCE_ZONES.motif.alpha * eclat * Math.sin(part * Math.PI),
        epaisseur: APPARENCE_ZONES.motif.epaisseur,
      },
    });
  }

  const glisse = (sortantes ? phase : -phase) * forme.course * zone.rayon;

  for (let rang = 0; rang < forme.chevrons; rang += 1) {
    // Decales d'un huitieme de tour: aucun chevron sous le pictogramme, en haut.
    const angle = ((rang + 0.5) * 2 * Math.PI) / forme.chevrons;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const loin = forme.place * zone.rayon + glisse;
    const pointe = sortantes ? loin : loin - forme.taille;
    const talon = sortantes ? loin - forme.taille : loin;
    const point = (le: number, travers: number): readonly number[] => [
      zone.x + ux * le - uy * travers,
      zone.y + uy * le + ux * travers,
    ];

    traits.push({
      id: `${zone.id}:chevron${String(rang)}`,
      points: [
        ...point(talon, -forme.taille * 0.7),
        ...point(pointe, 0),
        ...point(talon, forme.taille * 0.7),
      ],
      couleur,
      alpha: APPARENCE_ZONES.motif.alpha * eclat,
      epaisseur: APPARENCE_ZONES.motif.epaisseur,
    });
  }

  return { disques, traits };
}

/** L'invisibilite: un voile plus dense, et des lignes de brume qui ondulent d'un bord a l'autre. */
function voile(zone: ZoneVue, couleur: number, eclat: number, maintenant: number): CoucheScene {
  const forme = APPARENCE_ZONES.voile;
  const phase = ((maintenant % forme.periodeMs) / forme.periodeMs) * 2 * Math.PI;
  const traits: TraitScene[] = [];
  // Les lignes restent a l'interieur du disque, ondulation comprise.
  const interieur = zone.rayon - forme.amplitude;
  const lignes = Math.floor((2 * interieur) / forme.ecart);

  for (let rang = 0; rang < lignes; rang += 1) {
    const dy = -interieur + forme.ecart * (rang + 0.5);
    const demiCorde = Math.sqrt(Math.max(interieur * interieur - dy * dy, 0));

    if (demiCorde < forme.longueurDOnde / 4) {
      continue;
    }

    const pas = Math.max(Math.ceil((2 * demiCorde) / 12), 4);
    const points: number[] = [];

    for (let echantillon = 0; echantillon <= pas; echantillon += 1) {
      const dx = -demiCorde + (2 * demiCorde * echantillon) / pas;
      points.push(
        zone.x + dx,
        zone.y +
          dy +
          forme.amplitude * Math.sin((dx / forme.longueurDOnde) * 2 * Math.PI + phase + rang),
      );
    }

    traits.push({
      id: `${zone.id}:brume${String(rang)}`,
      points,
      couleur,
      alpha: APPARENCE_ZONES.motif.alpha * eclat,
      epaisseur: APPARENCE_ZONES.motif.epaisseur,
    });
  }

  return {
    disques: [
      {
        id: `${zone.id}:voile`,
        x: zone.x,
        y: zone.y,
        rayon: zone.rayon,
        remplissage: { couleur, alpha: forme.fond * eclat },
        contour: undefined,
      },
    ],
    traits,
  };
}

/**
 * Le pictogramme d'une nature de zone: un disque blanc cerne, et son dessin en noir. L'eclair
 * du chaos, quatre fleches qui sortent pour la repulsion ou qui rentrent pour l'attraction,
 * un oeil barre pour l'invisibilite. Il sert aussi aux mines de zone.
 *
 * @param rayon Le rayon du disque blanc; le dessin s'y inscrit.
 */
export function pictogramme(
  type: TypeZone,
  id: string,
  x: number,
  y: number,
  rayon: number,
): CoucheScene {
  const forme = APPARENCE_ZONES.pictogramme;
  const s = rayon * 0.62;
  const epaisseur = Math.max((forme.trait * rayon) / forme.rayon, 1);
  const trait = (suffixe: string, points: readonly number[]): TraitScene => ({
    id: `${id}:${suffixe}`,
    points: points.map((valeur, rang) => valeur * s + (rang % 2 === 0 ? x : y)),
    couleur: forme.dessin,
    alpha: 1,
    epaisseur,
  });

  return {
    disques: [
      {
        id: `${id}:fond`,
        x,
        y,
        rayon,
        remplissage: { couleur: forme.fond, alpha: 1 },
        contour: { couleur: forme.cerne, alpha: 1, epaisseur: Math.max(rayon / 9, 1) },
      },
      ...(type === 'invisibilite'
        ? [
            {
              id: `${id}:pupille`,
              x,
              y,
              rayon: s * 0.22,
              remplissage: { couleur: forme.dessin, alpha: 1 },
              contour: undefined,
            },
          ]
        : []),
    ],
    traits: dessinDuPictogramme(type).map((points, rang) => trait(`trait${String(rang)}`, points)),
  };
}

/**
 * Le pictogramme d'une nature de zone en image, pour l'interface (9 octobre 2026): la carte de
 * l'effet d'une zone ou l'on se tient. C'est le dessin que porte le bord de la zone sur la
 * carte, trace en noir sur fond transparent, pose par la page sur un disque a sa couleur.
 * Une image SVG ecrite ici, sans fichier a charger.
 */
export function adresseDuPictogrammeDeZone(type: TypeZone): string {
  const lignes = dessinDuPictogramme(type)
    .map((ligne) => `<polyline points="${ligne.map((valeur) => valeur.toFixed(3)).join(' ')}"/>`)
    .join('');
  const image =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.25 -1.25 2.5 2.5" fill="none" ' +
    `stroke="#111111" stroke-width="0.24" stroke-linecap="round" stroke-linejoin="round">${lignes}</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(image)}`;
}

/** Le dessin d'un pictogramme, en lignes brisees, dans un carre de cote deux centre en zero. */
function dessinDuPictogramme(type: TypeZone): readonly (readonly number[])[] {
  switch (type) {
    case 'chaos':
      return [[0.25, -0.9, -0.35, 0.05, 0.2, 0.05, -0.25, 0.9]];
    case 'repulsion':
    case 'attraction':
      return [0, 1, 2, 3].flatMap((quart) => fleche(quart, type === 'repulsion'));
    case 'invisibilite': {
      const oeil: number[] = [];
      for (let rang = 0; rang <= 16; rang += 1) {
        const angle = (rang / 16) * 2 * Math.PI;
        oeil.push(Math.cos(angle) * 0.85, Math.sin(angle) * 0.5);
      }
      return [oeil, [-0.8, 0.8, 0.8, -0.8]];
    }
  }
}

/** Une des quatre fleches en diagonale, tournee vers le dehors ou vers le dedans. */
function fleche(quart: number, sortante: boolean): readonly (readonly number[])[] {
  const angle = Math.PI / 4 + (quart * Math.PI) / 2;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const point = (le: number, travers: number): readonly number[] => [
    ux * le - uy * travers,
    uy * le + ux * travers,
  ];
  const pointe = sortante ? 0.95 : 0.2;
  const recul = sortante ? -0.35 : 0.35;

  return [
    [...point(0.2, 0), ...point(0.95, 0)],
    [...point(pointe + recul, -0.3), ...point(pointe, 0), ...point(pointe + recul, 0.3)],
  ];
}

/**
 * Un nombre au hasard entre zero et un, toujours le meme pour les memes trois cles: un
 * melange de l'identifiant, puis des deux entiers, par de grands multiplicateurs.
 */
export function bruit(id: string, periode: number, rang: number): number {
  let graine = 2_166_136_261;

  for (const caractere of id) {
    graine = Math.imul(graine ^ caractere.charCodeAt(0), 16_777_619);
  }

  graine = Math.imul(graine ^ periode, 2_654_435_761);
  graine = Math.imul(graine ^ rang, 2_246_822_519);
  graine ^= graine >>> 15;
  graine = Math.imul(graine, 3_266_489_917);
  graine ^= graine >>> 13;

  return (graine >>> 0) / 4_294_967_296;
}

/** Une mine de zone a dessiner, a sa place affichee. */
export interface MineDeZoneADessiner {
  readonly mine: MineDeZoneVue;
  readonly x: number;
  readonly y: number;
}

/**
 * Une mine de zone (etape 7.12), rendus A et B de la planche: la mine ronde, a la couleur de
 * la zone qu'elle cache, son pictogramme au centre, un halo qui respire; armee, son halo
 * clignote de plus en plus vite, et le bord de sa zone se trace, du haut et dans le sens des
 * aiguilles d'une montre, pour se fermer quand la zone s'ouvre.
 */
export function mineDeZoneVivante(
  { mine, x, y }: MineDeZoneADessiner,
  maintenant: number,
): ZoneScene {
  const forme = APPARENCE_MINE_DE_ZONE;
  const couleur = APPARENCE_ZONE[mine.nature].couleur;
  const armee = mine.avantOuvertureMs !== undefined;
  const lueur =
    mine.avantOuvertureMs === undefined
      ? respiration(maintenant)
      : clignotement(mine.avantOuvertureMs, maintenant);
  const disque = (
    suffixe: string,
    rayon: number,
    remplissage: DisqueScene['remplissage'],
    contour: DisqueScene['contour'],
  ): DisqueScene => ({ id: `${mine.id}:${suffixe}`, x, y, rayon, remplissage, contour });
  const corps: CoucheScene = {
    disques: [
      disque('halo', forme.rayonHalo, { couleur, alpha: forme.halo * lueur }, undefined),
      disque(
        'metal',
        forme.rayon,
        { couleur: APPARENCE_MINE.metal, alpha: 1 },
        { couleur: APPARENCE_MINE.cerne, alpha: 1, epaisseur: 2 },
      ),
      disque('anneau', forme.rayonAnneau, undefined, {
        couleur,
        alpha: 1,
        epaisseur: forme.epaisseurAnneau,
      }),
    ],
    traits: [],
  };

  return {
    id: mine.id,
    couches: [
      ...(armee ? [traceDuBord(mine, x, y, couleur)] : []),
      corps,
      pictogramme(mine.nature, `${mine.id}:picto`, x, y, forme.rayonPictogramme),
    ],
  };
}

/** Le bord de la zone a venir: pale en entier, et trace a mesure que l'ouverture approche. */
function traceDuBord(mine: MineDeZoneVue, x: number, y: number, couleur: number): CoucheScene {
  const forme = APPARENCE_MINE_DE_ZONE;
  const avancee = partEcoulee(mine.avantOuvertureMs ?? 0);
  const fin = avancee * 2 * Math.PI;
  const points: number[] = [];

  for (let angle = 0; angle < fin; angle += forme.pasDuTrace) {
    points.push(...pointDuBord(x, y, angle));
  }
  points.push(...pointDuBord(x, y, fin));

  return {
    disques: [
      {
        id: `${mine.id}:aVenir`,
        x,
        y,
        rayon: ZONES.RAYON_PX,
        remplissage: undefined,
        contour: { couleur, ...forme.bordAVenir },
      },
    ],
    traits:
      points.length < 4 ? [] : [{ id: `${mine.id}:trace`, points, couleur, ...forme.bordTrace }],
  };
}

/** Un point du bord de la zone a venir, l'angle compte depuis le haut, dans le sens horaire. */
function pointDuBord(x: number, y: number, angle: number): readonly number[] {
  return [x + Math.sin(angle) * ZONES.RAYON_PX, y - Math.cos(angle) * ZONES.RAYON_PX];
}

/** La part du delai d'ouverture deja ecoulee, de zero a un. */
function partEcoulee(avantOuvertureMs: number): number {
  return 1 - Math.min(Math.max(avantOuvertureMs / MINES_DE_ZONE.DELAI_AVANT_OUVERTURE_MS, 0), 1);
}

/** Posee, le halo respire lentement, comme la diode de la mine posee. */
function respiration(maintenant: number): number {
  const phase = (maintenant % APPARENCE_MINE.respirationMs) / APPARENCE_MINE.respirationMs;

  return 0.65 + 0.35 * Math.sin(phase * 2 * Math.PI);
}

/**
 * Armee, le halo clignote de plus en plus vite a mesure que l'ouverture approche: le
 * clignotement de la mine posee (etape 7.11), etale sur les 3 secondes de la mine de zone.
 */
export function clignotement(avantOuvertureMs: number, maintenant: number): number {
  const { departMs, arriveeMs } = APPARENCE_MINE.clignotement;
  const periode = departMs - (departMs - arriveeMs) * partEcoulee(avantOuvertureMs);

  return maintenant % periode < periode / 2 ? 1.6 : 0.3;
}

/**
 * Le temps ecoule depuis l'ouverture de cette zone, d'apres le journal: le fait de son
 * ouverture porte la place de la mine, qui est le centre de la zone. Absent si le journal
 * n'en dit rien, pour une zone deja ouverte a notre arrivee par exemple.
 */
export function ecouleDepuisLOuverture(
  zone: ZoneVue,
  journal: readonly FaitDeJeu[],
  maintenant: number,
): number | undefined {
  for (let rang = journal.length - 1; rang >= 0; rang -= 1) {
    const fait = journal[rang];

    if (
      fait?.nature === 'mineDeZone' &&
      fait.charge.quoi === 'ouverte' &&
      fait.charge.nature === zone.type &&
      Math.abs(fait.charge.x - zone.x) < 1 &&
      Math.abs(fait.charge.y - zone.y) < 1
    ) {
      return maintenant - fait.instant;
    }
  }

  return undefined;
}

/**
 * Une zone qui vient de s'ouvrir gonfle depuis la mine jusqu'a son rayon, bord en tete, en
 * ralentissant a l'arrivee (rendu B de la planche). Rend la zone au rayon de cet instant.
 */
export function zoneQuiGonfle(zone: ZoneVue, ecouleMs: number | undefined): ZoneVue {
  if (ecouleMs === undefined || ecouleMs >= APPARENCE_MINE_DE_ZONE.gonflementMs) {
    return zone;
  }

  const avancee = Math.max(ecouleMs, 0) / APPARENCE_MINE_DE_ZONE.gonflementMs;

  return { ...zone, rayon: zone.rayon * (1 - Math.pow(1 - avancee, 3)) };
}
