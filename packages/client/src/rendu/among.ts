/**
 * Ce qu'Among Ninjas ajoute a la carte (etape 7.20): les cadavres, les stations, le gong, le
 * pseudo de chacun, et le cercle de vision.
 *
 * Rendus choisis par le porteur du projet sur la planche docs/design/etape-7-20/1-planche.png:
 *
 *   - LE CADAVRE, rendu C: le ninja coupe en deux, le haut et le bas ecartes, dans son sang;
 *   - LE CERCLE DE VISION, un melange: le disque net du rendu A, et hors du disque le decor
 *     assombri de moitie et sans couleur. Le rendu PixiJS le pose (pixi.ts); la scene ne dit
 *     que son centre et son rayon;
 *   - LE FANTOME: le ninja legerement translucide, a sa couleur, cerne d'un contour neon de sa
 *     couleur (demande du porteur du projet du 10 octobre 2026, a la place du halo pale du
 *     rendu entre A et B). Seuls les fantomes en recoivent: la vue d'un vivant n'en contient
 *     aucun.
 *
 * LES PSEUDOS NE S'AFFICHENT PAS SUR LA CARTE (decision du porteur du projet du 9 octobre 2026):
 * le doute sur qui est qui fait le jeu, et toute accusation passe par une couleur. Seul un
 * assassin lit le pseudo de ses complices. La revelation, la reunion, l'ejection et la fin, elles,
 * nomment tout le monde.
 *
 * Ce module est pur: il lit l'etat du client et rend des formes a dessiner.
 */

import type { Couleur, DimensionsCarte } from '@neon-ninja/shared';
import { AMONG, AMONG_PAR_DEFAUT, RAYONS_DE_VISION } from '@neon-ninja/shared';

import { victimeAPortee } from '../among.js';
import type { EtatClient } from '../etat.js';
import type { VueLissee } from './interpolation.js';
import type { DisqueScene, SpriteScene } from './scene.js';
import { TAILLE_SPRITE } from './apparence.js';
import { adresseCoupee } from './textures.js';

/** Un texte pose sur la carte, centre sur ce point: le pseudo d'un joueur. */
export interface LibelleScene {
  readonly id: string;
  readonly texte: string;
  readonly x: number;
  readonly y: number;
  readonly couleur: number;
}

/** Le cercle de vision: ce qu'on voit autour de soi, le reste eteint (pixi.ts). */
export interface VisionScene {
  readonly x: number;
  readonly y: number;
  readonly rayon: number;
}

/** Un rectangle, en coordonnees de carte. */
export interface Cadre {
  readonly x: number;
  readonly y: number;
  readonly largeur: number;
  readonly hauteur: number;
}

/**
 * Le rectangle du masque du decor eteint, que le disque de vision perce (pixi.ts): la carte,
 * elargie de part et d'autre du rayon du disque, pour que le trou y tienne toujours en entier.
 *
 * Sur la carte seule, un disque qui debordait du bord ne se decoupait plus: le masque redevenait
 * la carte pleine, et le decor eteint recouvrait tout, ninjas compris, des qu'on approchait d'un
 * bord (retour d'essai du porteur du projet, 10 octobre 2026). Le decor eteint s'arrete de toute
 * facon au bord de la carte: le masque peut deborder sans rien montrer de plus.
 */
export function cadreDuMasque(carte: DimensionsCarte, vision: VisionScene): Cadre {
  const marge = vision.rayon + 1;

  return {
    x: -marge,
    y: -marge,
    largeur: carte.largeur + 2 * marge,
    hauteur: carte.hauteur + 2 * marge,
  };
}

/** Ce qu'Among Ninjas ajoute a une image. */
export interface ImageDAmong {
  /** Au sol, sous les personnages: les stations, le gong, le sang des cadavres, les halos. */
  readonly disques: readonly DisqueScene[];
  /** Les cadavres, sous les vivants. */
  readonly cadavres: readonly SpriteScene[];
  readonly libelles: readonly LibelleScene[];
  readonly vision: VisionScene | undefined;
}

/** Rien a ajouter: une image d'un autre mode. */
export const RIEN_D_AMONG: ImageDAmong = {
  disques: [],
  cadavres: [],
  libelles: [],
  vision: undefined,
};

/** Les reglages de l'apparence, tenus ici pour se regler en jouant. */
export const APPARENCE_AMONG = {
  /** Opacite d'un fantome: une legere transparence (10 octobre 2026). */
  alphaFantome: 0.7,
  /** Le contour neon d'un fantome, a sa couleur (pixi.ts): son epaisseur et sa lueur. */
  contourFantome: { epaisseur: 2, lueur: 2.5, portee: 10 },
  /** Ecart des deux moities d'un cadavre, en pixels de carte. */
  ecartDuCadavre: 5,
  /** Le sang sous un cadavre: quelques taches rouges. */
  sang: { couleur: 0x8c0012, alpha: 0.85 },
  /** Une station: un disque cyan, plein pale et bord net. */
  station: { couleur: 0x2ee6ff, alphaPlein: 0.12, alphaBord: 0.75, epaisseur: 3 },
  /** Le gong: un anneau magenta au point de reunion. */
  gong: { couleur: 0xff4fd8, alpha: 0.85, epaisseur: 4, rayon: 34 },
  /** La hauteur du pseudo au-dessus du centre du ninja. */
  hauteurDuPseudo: 30,
  /**
   * La victime qu'un assassin peut tuer maintenant (demande du porteur du projet du 10 octobre
   * 2026): une legere surbrillance rouge sous elle, un disque pale et un anneau. A juger en
   * jouant.
   */
  victime: { couleur: 0xff3355, alphaPlein: 0.3, alphaBord: 0.9, epaisseur: 2, rayon: 24 },
} as const;

/** Une couleur du contrat en nombre. */
function enNombre(couleur: Couleur): number {
  const valeur = Number.parseInt(couleur.replace('#', ''), 16);

  return Number.isNaN(valeur) ? 0xffffff : valeur;
}

/** Un nombre tire d'un identifiant, toujours le meme: les taches d'un cadavre ne bougent pas. */
function graineDe(id: string): number {
  let graine = 7;

  for (const caractere of id) {
    graine = (graine * 31 + caractere.charCodeAt(0)) % 100_003;
  }

  return graine;
}

/**
 * Ce qu'Among Ninjas ajoute a l'image.
 *
 * @param texture L'image d'un ninja de face, immobile: celle des cadavres.
 */
export function imageDAmong(etat: EtatClient, lissee: VueLissee, texture: string): ImageDAmong {
  if (etat.salon?.mode !== 'among') {
    return RIEN_D_AMONG;
  }

  const disques: DisqueScene[] = [...lieuxDuJoueur(etat)];
  const victime = victimeAPortee(etat);
  const complices = new Set(etat.among.prive?.role === 'tueur' ? etat.among.prive.complices : []);
  const cadavres: SpriteScene[] = [];
  const libelles: LibelleScene[] = [];

  for (const { entite, x, y } of lissee.entites) {
    if (entite.type === 'cadavre') {
      disques.push(...sangDuCadavre(entite.id, x, y));
      cadavres.push(...moitiesDuCadavre(entite.id, x, y, entite.couleur, texture));
      continue;
    }

    if (entite.type !== 'joueur') {
      continue;
    }

    if (entite.id === victime) {
      const { couleur, alphaPlein, alphaBord, epaisseur, rayon } = APPARENCE_AMONG.victime;
      disques.push({
        id: `${entite.id}:victime`,
        x,
        y,
        rayon,
        remplissage: { couleur, alpha: alphaPlein },
        contour: { couleur, alpha: alphaBord, epaisseur },
      });
    }

    if (!complices.has(entite.id)) {
      continue;
    }

    libelles.push({
      id: `${entite.id}:pseudo`,
      texte: entite.pseudo,
      x,
      y: y - APPARENCE_AMONG.hauteurDuPseudo,
      couleur: enNombre(entite.couleur),
    });
  }

  return { disques, cadavres, libelles, vision: visionDe(etat, lissee) };
}

/** L'opacite d'un joueur d'Among Ninjas: translucide s'il est fantome. */
export function alphaAmong(fantome: boolean | undefined): number {
  return fantome === true ? APPARENCE_AMONG.alphaFantome : 1;
}

/**
 * Les stations et le gong que ce joueur doit voir: les stations des taches qui lui restent
 * pour une proie, toutes les stations actives pour un assassin, et le gong pour tous.
 */
function lieuxDuJoueur(etat: EtatClient): readonly DisqueScene[] {
  const prive = etat.among.prive;

  if (prive === undefined) {
    return [];
  }

  const { station, gong } = APPARENCE_AMONG;
  const rangs =
    prive.role === 'tueur'
      ? prive.stations.map((_place, rang) => rang)
      : prive.taches.filter((tache) => !tache.faite).map((tache) => tache.station);
  const lieux: DisqueScene[] = rangs.flatMap((rang) => {
    const place = prive.stations[rang];

    return place === undefined
      ? []
      : [
          {
            id: `station:${String(rang)}`,
            x: place.x,
            y: place.y,
            rayon: AMONG.RAYON_D_UNE_STATION_PX,
            remplissage: { couleur: station.couleur, alpha: station.alphaPlein },
            contour: {
              couleur: station.couleur,
              alpha: station.alphaBord,
              epaisseur: station.epaisseur,
            },
          },
        ];
  });

  lieux.push({
    id: 'gong',
    x: prive.gong.x,
    y: prive.gong.y,
    rayon: gong.rayon,
    remplissage: undefined,
    contour: { couleur: gong.couleur, alpha: gong.alpha, epaisseur: gong.epaisseur },
  });

  return lieux;
}

/** Le sang sous un cadavre: quelques taches, toujours les memes pour un meme cadavre. */
function sangDuCadavre(id: string, x: number, y: number): readonly DisqueScene[] {
  let graine = graineDe(id);
  const tirer = (): number => {
    graine = (graine * 9301 + 49297) % 233_280;
    return graine / 233_280;
  };

  return Array.from({ length: 5 }, (_vide, rang): DisqueScene => ({
    id: `${id}:sang:${String(rang)}`,
    x: x + (tirer() - 0.5) * 30,
    y: y + 4 + (tirer() - 0.5) * 16,
    rayon: 5 + tirer() * 8,
    remplissage: { couleur: APPARENCE_AMONG.sang.couleur, alpha: APPARENCE_AMONG.sang.alpha },
    contour: undefined,
  }));
}

/** Les deux moities d'un cadavre, ecartees l'une de l'autre, a la couleur de la victime. */
function moitiesDuCadavre(
  id: string,
  x: number,
  y: number,
  couleur: Couleur,
  texture: string,
): readonly SpriteScene[] {
  const ecart = APPARENCE_AMONG.ecartDuCadavre;
  const teinte = enNombre(couleur);

  return [
    {
      id: `${id}:bas`,
      texture: adresseCoupee(texture, 'bas'),
      x: x + ecart,
      y: y + ecart,
      taille: TAILLE_SPRITE,
      teinte,
      alpha: 1,
      rotation: 0.25,
    },
    {
      id: `${id}:haut`,
      texture: adresseCoupee(texture, 'haut'),
      x: x - ecart,
      y: y - ecart,
      taille: TAILLE_SPRITE,
      teinte,
      alpha: 1,
      rotation: -0.3,
    },
  ];
}

/**
 * Le cercle de vision d'un vivant: centre sur lui, du rayon de son role au palier regle.
 * Aucun pour un fantome, qui voit toute la carte, ni avant que la page sache notre role.
 */
function visionDe(etat: EtatClient, lissee: VueLissee): VisionScene | undefined {
  const prive = etat.among.prive;
  const moi = lissee.entites.find(({ entite }) => entite.id === etat.moi);

  if (prive === undefined || prive.fantome || moi === undefined) {
    return undefined;
  }

  const reglages = etat.salon?.reglages.among ?? AMONG_PAR_DEFAUT;
  const palier = prive.role === 'tueur' ? reglages.visionTueur : reglages.visionProie;

  return { x: moi.x, y: moi.y, rayon: RAYONS_DE_VISION[prive.role][palier] };
}
