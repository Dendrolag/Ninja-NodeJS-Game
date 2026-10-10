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
 * LES SABOTAGES (etape 7.22, rendus choisis sur la planche docs/design/etape-7-22/1-planche.png):
 *
 *   - LE BOITIER ET LES CONSOLES, rendu 6A: des objets neon dessines au sol, toujours la, cyan,
 *     qui s'allument en orange (la panne) ou en rouge (la surchauffe) pendant leur sabotage,
 *     avec le disque ou l'on se tient pour reparer;
 *   - LE NUAGE NOIR, rendu 4A: des volutes de fumee noire sur la station, opaques pour une
 *     proie vivante, que le serveur prive de ce qui s'y tient, et a demi pour les assassins et
 *     les fantomes, qui y voient;
 *   - LA PANNE, rendu 2C: le disque d'une proie vivante tombe a 110 pixels, le decor eteint
 *     s'assombrit, et une fleche orange dit ou est le boitier, et a quelle distance;
 *   - LA SURCHAUFFE, rendu 3B: deux fleches rouges vers les consoles. L'alarme et le compte a
 *     rebours sont dans le HUD.
 *
 * LES PSEUDOS NE S'AFFICHENT PAS SUR LA CARTE (decision du porteur du projet du 9 octobre 2026):
 * le doute sur qui est qui fait le jeu, et toute accusation passe par une couleur. Seul un
 * assassin lit le pseudo de ses complices. La revelation, la reunion, l'ejection et la fin, elles,
 * nomment tout le monde.
 *
 * Ce module est pur: il lit l'etat du client et rend des formes a dessiner.
 */

import type { Couleur, DimensionsCarte, Position } from '@neon-ninja/shared';
import { AMONG, AMONG_PAR_DEFAUT, RAYONS_DE_VISION, lieuxDuMode } from '@neon-ninja/shared';

import { stationsAMontrer, victimeAPortee } from '../among.js';
import type { EtatClient } from '../etat.js';
import type { IndicateurScene } from './charges.js';
import { AUCUN_INDICATEUR } from './charges.js';
import type { VueLissee } from './interpolation.js';
import type { DisqueScene, SpriteScene, TraitScene } from './scene.js';
import { TAILLE_SPRITE, VISION_AMONG } from './apparence.js';
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
  /** L'opacite du voile noir sur le decor eteint: plus sombre pendant la panne (etape 7.22). */
  readonly voile: number;
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
  /** Au sol, sous les personnages: le boitier et les consoles des sabotages (etape 7.22). */
  readonly postes: IndicateurScene;
  /** Par-dessus tout: les fleches vers le boitier ou les consoles d'un sabotage (etape 7.22). */
  readonly fleches: readonly TraitScene[];
}

/** Rien a ajouter: une image d'un autre mode. */
export const RIEN_D_AMONG: ImageDAmong = {
  disques: [],
  cadavres: [],
  libelles: [],
  vision: undefined,
  postes: AUCUN_INDICATEUR,
  fleches: [],
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
  /**
   * Le boitier et les consoles (etape 7.22, rendu 6A): un trait neon cyan sur un socle sombre,
   * orange pendant la panne, rouge pendant la surchauffe. Le disque ou l'on repare bat pendant
   * le sabotage; une console tenue s'emplit.
   */
  poste: {
    repos: 0x2ee6ff,
    panne: 0xff8c1a,
    surchauffe: 0xff2e3a,
    alpha: 0.95,
    epaisseur: 3,
    socle: { couleur: 0x081020, alpha: 0.85, rayon: 24 },
    /** Le battement du disque de reparation, en millisecondes, et son opacite au plus bas. */
    battementMs: 900,
    alphaMinimum: 0.35,
    alphaTenue: 0.3,
  },
  /**
   * Le nuage noir (rendu 4A): des volutes, toujours les memes pour une station. Opaque pour une
   * proie vivante, a demi pour ceux qui y voient.
   */
  nuage: { couleur: 0x07040c, alphaOpaque: 0.93, alphaTranslucide: 0.45, volutes: 22 },
  /**
   * Les fleches vers un poste (rendus 2C et 3B), a cette distance de nous: dans l'ecran sur
   * ordinateur comme sur telephone, le plus petit cote montrant 450 pixels de carte.
   */
  fleche: { rayon: 185, longueur: 22, epaisseur: 5, ecartDuTexte: 30 },
  /** Le voile du decor eteint pendant la panne, pour une proie vivante (rendu 2C). */
  voileEnPanne: 0.82,
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
export function imageDAmong(
  etat: EtatClient,
  lissee: VueLissee,
  texture: string,
  maintenant: number,
): ImageDAmong {
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

  disques.push(...nuageNoir(etat));
  const moi = lissee.entites.find(({ entite }) => entite.id === etat.moi);
  const fleches = moi === undefined ? undefined : flechesVersLesPostes(etat, moi);

  return {
    disques,
    cadavres,
    libelles: fleches === undefined ? libelles : [...libelles, ...fleches.libelles],
    vision: visionDe(etat, lissee),
    postes: postesDesSabotages(etat, maintenant),
    fleches: fleches?.traits ?? [],
  };
}

/** Les postes des sabotages de la partie: le boitier et les deux consoles, en miroir s'il le faut. */
function postesDeLaPartie(
  etat: EtatClient,
): { readonly boitier: Position; readonly consoles: readonly [Position, Position] } | undefined {
  const reglages = etat.salon?.reglages;

  return reglages === undefined ? undefined : lieuxDuMode(reglages.carte, reglages.modeMiroir);
}

/**
 * Le boitier et les consoles, au sol (rendu 6A): un socle sombre, puis le trait neon de l'objet,
 * cyan au repos. Pendant leur sabotage, ils passent a l'orange (la panne) ou au rouge (la
 * surchauffe), et le disque ou l'on se tient pour reparer bat; une console tenue s'emplit.
 */
function postesDesSabotages(etat: EtatClient, maintenant: number): IndicateurScene {
  const postes = postesDeLaPartie(etat);

  if (postes === undefined || etat.among.prive === undefined) {
    return AUCUN_INDICATEUR;
  }

  const { poste } = APPARENCE_AMONG;
  const sabotage = etat.partie?.among?.sabotage;
  const enPanne = sabotage?.nature === 'panne';
  const enSurchauffe = sabotage?.nature === 'surchauffe';
  const battement =
    poste.alphaMinimum +
    (1 - poste.alphaMinimum) *
      (0.5 + 0.5 * Math.sin((maintenant / poste.battementMs) * Math.PI * 2));
  const disques: DisqueScene[] = [];
  const traits: TraitScene[] = [];

  const poser = (
    id: string,
    place: Position,
    couleur: number,
    actif: boolean,
    tenu: boolean,
    dessin: (place: Position) => readonly (readonly number[])[],
  ): void => {
    disques.push({
      id: `${id}:socle`,
      x: place.x,
      y: place.y,
      rayon: poste.socle.rayon,
      remplissage: { couleur: poste.socle.couleur, alpha: poste.socle.alpha },
      contour: undefined,
    });

    if (actif) {
      disques.push({
        id: `${id}:disque`,
        x: place.x,
        y: place.y,
        rayon: AMONG.RAYON_D_UN_POSTE_PX,
        remplissage: tenu ? { couleur, alpha: poste.alphaTenue } : undefined,
        contour: { couleur, alpha: battement, epaisseur: 2 },
      });
    }

    dessin(place).forEach((points, rang) => {
      traits.push({
        id: `${id}:trait:${String(rang)}`,
        points,
        couleur,
        alpha: poste.alpha,
        epaisseur: poste.epaisseur,
      });
    });
  };

  poser(
    'boitier',
    postes.boitier,
    enPanne ? poste.panne : poste.repos,
    enPanne,
    false,
    dessinDuBoitier,
  );
  postes.consoles.forEach((console_, rang) => {
    poser(
      `console:${String(rang)}`,
      console_,
      enSurchauffe ? poste.surchauffe : poste.repos,
      enSurchauffe,
      sabotage?.consolesTenues[rang] === true,
      dessinDUneConsole,
    );
  });

  return { disques, parts: [], traits };
}

/** Le boitier de la rue: un coffret debout, et l'eclair au milieu. */
function dessinDuBoitier({ x, y }: Position): readonly (readonly number[])[] {
  return [
    [x - 11, y - 16, x + 11, y - 16, x + 11, y + 16, x - 11, y + 16, x - 11, y - 16],
    [
      x + 3,
      y - 10,
      x - 5,
      y + 2,
      x + 1,
      y + 2,
      x - 3,
      y + 10,
      x + 5,
      y - 2,
      x - 1,
      y - 2,
      x + 3,
      y - 10,
    ],
  ];
}

/** Une console: un ecran sur son pied, et la courbe qui s'y affole. */
function dessinDUneConsole({ x, y }: Position): readonly (readonly number[])[] {
  return [
    [x - 16, y - 14, x + 16, y - 14, x + 16, y + 6, x - 16, y + 6, x - 16, y - 14],
    [x, y + 6, x, y + 14],
    [x - 9, y + 14, x + 9, y + 14],
    [x - 10, y - 2, x - 4, y - 9, x + 2, y - 3, x + 9, y - 10],
  ];
}

/**
 * Le nuage noir (rendu 4A): des volutes sur la station, toujours les memes pour un meme nuage.
 * Opaque pour une proie vivante: le serveur ne lui envoie rien de ce qui s'y tient. A demi pour
 * un assassin ou un fantome, qui y voient.
 */
function nuageNoir(etat: EtatClient): readonly DisqueScene[] {
  const nuage = etat.partie?.among?.nuage;
  const prive = etat.among.prive;

  if (nuage === undefined || prive === undefined) {
    return [];
  }

  const { couleur, alphaOpaque, alphaTranslucide, volutes } = APPARENCE_AMONG.nuage;
  const alpha = prive.role === 'tueur' || prive.fantome ? alphaTranslucide : alphaOpaque;
  const rayon = AMONG.RAYON_DU_NUAGE_PX;
  let graine = graineDe(`${String(nuage.x)}:${String(nuage.y)}`);
  const tirer = (): number => {
    graine = (graine * 9301 + 49297) % 233_280;
    return graine / 233_280;
  };
  const disques: DisqueScene[] = [
    {
      id: 'nuage:coeur',
      x: nuage.x,
      y: nuage.y,
      rayon: rayon * 0.72,
      remplissage: { couleur, alpha },
      contour: undefined,
    },
  ];

  for (let rang = 0; rang < volutes; rang += 1) {
    const angle = tirer() * Math.PI * 2;
    const ecart = Math.sqrt(tirer()) * rayon * 0.62;
    // Les volutes du bord sont plus legeres: le nuage s'efface sur son pourtour.
    disques.push({
      id: `nuage:volute:${String(rang)}`,
      x: nuage.x + Math.cos(angle) * ecart,
      y: nuage.y + Math.sin(angle) * ecart,
      rayon: rayon * (0.22 + tirer() * 0.18),
      remplissage: { couleur, alpha: alpha * (ecart > rayon * 0.4 ? 0.55 : 0.85) },
      contour: undefined,
    });
  }

  return disques;
}

/**
 * Les fleches vers les postes d'un sabotage en cours (rendus 2C et 3B): le boitier pendant la
 * panne, en orange, les deux consoles pendant la surchauffe, en rouge. Chacune a une distance
 * fixe de nous, dans sa direction, avec ce qu'elle designe et a combien de pixels; aucune pour
 * un poste deja tout pres.
 */
function flechesVersLesPostes(
  etat: EtatClient,
  moi: { readonly x: number; readonly y: number },
): { readonly traits: readonly TraitScene[]; readonly libelles: readonly LibelleScene[] } {
  const sabotage = etat.partie?.among?.sabotage;
  const postes = postesDeLaPartie(etat);
  const traits: TraitScene[] = [];
  const libelles: LibelleScene[] = [];

  if (postes === undefined || etat.partie?.among?.phase !== 'jeu') {
    return { traits, libelles };
  }

  const cibles: readonly {
    readonly nom: string;
    readonly place: Position;
    readonly couleur: number;
  }[] =
    sabotage?.nature === 'panne'
      ? [{ nom: 'Boîtier', place: postes.boitier, couleur: APPARENCE_AMONG.poste.panne }]
      : sabotage?.nature === 'surchauffe'
        ? postes.consoles.map((place) => ({
            nom: 'Console',
            place,
            couleur: APPARENCE_AMONG.poste.surchauffe,
          }))
        : [];
  const { rayon, longueur, epaisseur, ecartDuTexte } = APPARENCE_AMONG.fleche;

  cibles.forEach(({ nom, place, couleur }, rang) => {
    const dx = place.x - moi.x;
    const dy = place.y - moi.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= rayon + longueur) {
      return;
    }

    const ux = dx / distance;
    const uy = dy / distance;
    const pointe = { x: moi.x + ux * rayon, y: moi.y + uy * rayon };
    const base = { x: pointe.x - ux * longueur, y: pointe.y - uy * longueur };
    const ecart = longueur * 0.65;

    traits.push({
      id: `fleche:${String(rang)}`,
      points: [
        base.x - uy * ecart,
        base.y + ux * ecart,
        pointe.x,
        pointe.y,
        base.x + uy * ecart,
        base.y - ux * ecart,
      ],
      couleur,
      alpha: 1,
      epaisseur,
    });
    libelles.push({
      id: `fleche:${String(rang)}:${nom}`,
      texte: `${nom} ${String(Math.round(distance))} px`,
      x: moi.x + ux * (rayon - longueur - ecartDuTexte),
      y: moi.y + uy * (rayon - longueur - ecartDuTexte),
      couleur,
    });
  });

  return { traits, libelles };
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
  const lieux: DisqueScene[] = stationsAMontrer(prive).map((place) => ({
    id: `station:${String(place.x)}:${String(place.y)}`,
    x: place.x,
    y: place.y,
    rayon: AMONG.RAYON_D_UNE_STATION_PX,
    remplissage: { couleur: station.couleur, alpha: station.alphaPlein },
    contour: {
      couleur: station.couleur,
      alpha: station.alphaBord,
      epaisseur: station.epaisseur,
    },
  }));

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
 * Pendant la panne de neons (etape 7.22), une proie vivante ne voit plus qu'a 110 pixels, et le
 * decor eteint s'assombrit (rendu 2C): le meme rayon que celui du serveur (rayonDeVision).
 */
function visionDe(etat: EtatClient, lissee: VueLissee): VisionScene | undefined {
  const prive = etat.among.prive;
  const moi = lissee.entites.find(({ entite }) => entite.id === etat.moi);

  if (prive === undefined || prive.fantome || moi === undefined) {
    return undefined;
  }

  const reglages = etat.salon?.reglages.among ?? AMONG_PAR_DEFAUT;
  const palier = prive.role === 'tueur' ? reglages.visionTueur : reglages.visionProie;
  const rayon = RAYONS_DE_VISION[prive.role][palier];
  const enPanne = prive.role === 'proie' && etat.partie?.among?.sabotage?.nature === 'panne';

  return enPanne
    ? {
        x: moi.x,
        y: moi.y,
        rayon: Math.min(rayon, AMONG.RAYON_DE_VISION_EN_PANNE_PX),
        voile: APPARENCE_AMONG.voileEnPanne,
      }
    : { x: moi.x, y: moi.y, rayon, voile: VISION_AMONG.voile };
}

/**
 * Les taches visuelles (etape 7.21, rendu 3A de la planche docs/design/etape-7-21/1-planche.png):
 * une gerbe d'etincelles jaunes et orange sur la pierre pour le katana, une bouffee grise
 * au-dessus de la station pour la fumee. Le serveur ne les adresse qu'a ceux qui voient la
 * station; elles durent une seconde et demie.
 */
export const APPARENCE_DES_TACHES_VISUELLES = {
  dureeMs: 1500,
  etincelles: {
    nombre: 18,
    couleurs: [0xffe07a, 0xffb02e, 0xff7a1a, 0xfff6c8],
    /** Jusqu'ou elles volent, et de combien elles retombent, en pixels de carte. */
    portee: 46,
    chute: 30,
    rayon: 2.6,
  },
  bouffee: { nombre: 8, couleur: 0xcfd4dc, alpha: 0.7, rayonDepart: 8, rayonFin: 26, montee: 42 },
} as const;

/**
 * Les etincelles et les bouffees des taches visuelles recentes, a cet instant: des disques
 * par-dessus les personnages, dessines comme les impacts. Le dessin se tire du rang du fait et
 * de chaque particule: le meme fait se dessine de meme chez tous ceux qui le voient.
 */
export function effetsDesTachesVisuelles(
  journal: EtatClient['journal'],
  maintenant: number,
): readonly DisqueScene[] {
  const { dureeMs, etincelles, bouffee } = APPARENCE_DES_TACHES_VISUELLES;
  const disques: DisqueScene[] = [];

  journal.forEach((fait, rang) => {
    if (fait.nature !== 'tacheVisuelle') {
      return;
    }

    const avancee = (maintenant - fait.instant) / dureeMs;

    if (avancee < 0 || avancee >= 1) {
      return;
    }

    const { x, y, nature } = fait.charge;
    const id = `tacheVisuelle:${String(rang)}`;

    if (nature === 'fumee') {
      for (let bulle = 0; bulle < bouffee.nombre; bulle += 1) {
        const angle = (bulle / bouffee.nombre) * Math.PI * 2;
        disques.push({
          id: `${id}:${String(bulle)}`,
          x: x + Math.cos(angle) * 18 * avancee,
          y: y - 12 - bouffee.montee * avancee + Math.sin(angle) * 8 * avancee,
          rayon: bouffee.rayonDepart + (bouffee.rayonFin - bouffee.rayonDepart) * avancee,
          remplissage: { couleur: bouffee.couleur, alpha: bouffee.alpha * (1 - avancee) },
          contour: undefined,
        });
      }
      return;
    }

    for (let etincelle = 0; etincelle < etincelles.nombre; etincelle += 1) {
      // Une gerbe vers le haut, chaque etincelle a son angle et sa vitesse.
      const angle = -Math.PI / 2 + (etincelle / (etincelles.nombre - 1) - 0.5) * 2.4;
      const vitesse = 0.6 + ((etincelle * 7) % 5) / 10;
      const couleur = etincelles.couleurs[etincelle % etincelles.couleurs.length] as number;
      disques.push({
        id: `${id}:${String(etincelle)}`,
        x: x + Math.cos(angle) * etincelles.portee * vitesse * avancee,
        y:
          y +
          Math.sin(angle) * etincelles.portee * vitesse * avancee +
          etincelles.chute * avancee * avancee,
        rayon: etincelles.rayon * (1 - avancee) + 0.8,
        remplissage: { couleur, alpha: 1 - avancee },
        contour: undefined,
      });
    }
  });

  return disques;
}
