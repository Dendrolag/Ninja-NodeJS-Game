/**
 * La scene: la liste de ce qu'il faut dessiner, a un instant donne.
 *
 * C'EST LA PIECE CENTRALE DE CETTE ETAPE, et c'est une FONCTION PURE. On lui
 * donne l'etat du client, la vue lissee et l'instant; elle rend une description
 * de l'image a produire. Elle ne connait ni PixiJS, ni canevas, ni document: elle
 * ne dessine rien, elle DIT quoi dessiner.
 *
 * POURQUOI CETTE SEPARATION. Trois raisons, dans l'ordre d'importance.
 *
 *   1. Elle se teste sans navigateur. La question « combien d'entites sont
 *      affichees, et lesquelles » se pose a une fonction et se verifie en
 *      millisecondes. Le client d'origine ne pouvait repondre a cette question
 *      qu'en regardant l'ecran, ce qui explique qu'aucun de ses defauts
 *      d'affichage n'ait jamais ete couvert par un test.
 *   2. Elle rend le moteur de rendu remplacable. Si PixiJS devait ceder la place,
 *      c'est l'adaptateur qui changerait, pas les regles d'apparence.
 *   3. Elle empeche la logique d'affichage de se disperser. Dans le jeu
 *      d'origine, drawEntities faisait tout a la fois: la camera, la visibilite,
 *      les halos, les sprites, le suivi des couleurs precedentes et la mise a
 *      jour des effets. Trois cents lignes qu'on ne pouvait ni lire ni tester.
 *
 * ELLE NE DECIDE AUCUNE REGLE DE JEU. Elle lit ce que le serveur a envoye et
 * choisit une apparence. Si une question du genre « ce joueur peut-il en capturer
 * un autre » se posait ici, c'est qu'elle manquerait dans packages/sim. Le cone du
 * mode Tactique en est l'exemple: la scene le dessine d'apres l'orientation et les
 * charges recues, sans jamais calculer ce qu'il contient.
 */

import type {
  Couleur,
  Direction,
  EntiteVue,
  Mode,
  Orientation,
  TypeBonus,
  TypeZone,
  Visee,
} from '@neon-ninja/shared';
import {
  AUCUN_EFFET_TACTIQUE,
  CONES_DES_VISEES,
  COULEUR_BOT_NEUTRE,
  DIRECTIONS,
  IMAGES_DE_MARCHE,
  MASSACRE,
  RACINE_RESSOURCES,
  REGLAGES_PAR_DEFAUT,
  cheminNinja,
  cheminObjet,
  viseeDe,
} from '@neon-ninja/shared';

import type { EtatClient } from '../etat.js';
import type { NiveauDeSang } from '../interface/preferences.js';
import { bonusDOrigineEnCours, effetsTactiquesSurMoi } from '../selecteurs.js';
import type { IndicateurScene } from './charges.js';
import { AUCUN_INDICATEUR, arcDesCharges } from './charges.js';
import {
  imageDObjet,
  imageDeMarche,
  imageDePluie,
  opaciteObjet,
  rayonPulsant,
} from './animation.js';
import type { Teinte } from './apparence.js';
import {
  ALPHA_INVISIBLE,
  APPARENCE_KATANA,
  APPARENCE_OBJET,
  APPARENCE_TIR,
  APPARENCE_ZONE,
  HALO_BONUS,
  HALO_BOT_NOIR,
  HALO_REVELATION_AUTRUI,
  OMBRE_JOUEUR,
  RAYON_HALO_OBJET,
  TAILLE_OBJET,
  TAILLE_SPRITE,
  TEINTE_DETECTION_BOT_NOIR,
} from './apparence.js';
import type { VueLissee } from './interpolation.js';
import type { TacheScene } from './katana.js';
import { DEMI_ARC_DU_KATANA, imageDuMassacre } from './katana.js';
import type { Localisation } from './localisation.js';
import { opaciteDeLocalisation, reperesDeLocalisation } from './localisation.js';
import { adresseDImage } from './textures.js';

/** Un sprite a poser sur la carte. */
export interface SpriteScene {
  /** Identifiant stable, qui permet au rendu de retrouver l'objet d'une image a l'autre. */
  readonly id: string;
  /**
   * Adresse de la texture a utiliser. Pour un personnage, celle de l'image dont le
   * rendu tire ses deux calques; pour un objet, celle de l'image de sa planche.
   */
  readonly texture: string;
  readonly x: number;
  readonly y: number;
  /** Cote du carre d'affichage, en pixels de la carte. */
  readonly taille: number;
  /**
   * Couleur du proprietaire. Pour un personnage, le rendu la pose sur son corps
   * seul, jamais sur ses details (recoloration.ts). Pour un objet, le blanc: l'image
   * telle quelle.
   */
  readonly teinte: number;
  readonly alpha: number;
  /** Rotation, en radians: celle d'un cadavre couche du Massacre. Aucune par defaut. */
  readonly rotation?: number;
}

/** Un disque a dessiner sous ou autour de quelque chose. */
export interface DisqueScene {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly rayon: number;
  readonly remplissage: Teinte | undefined;
  readonly contour: (Teinte & { readonly epaisseur: number }) | undefined;
}

/** Une zone speciale, avec son libelle. */
export interface ZoneScene extends DisqueScene {
  readonly type: TypeZone;
  readonly libelle: string;
}

/** Un cone: la portee d'un tir du mode Tactique, devant un joueur (etape 7.1). */
export interface ConeScene {
  readonly id: string;
  /** Le sommet du cone, en coordonnees de carte. */
  readonly x: number;
  readonly y: number;
  /** Direction du milieu du cone, en radians. L'axe des y descend: le sud vaut un quart de tour. */
  readonly angle: number;
  /** Demi-ouverture, en radians. */
  readonly demiOuverture: number;
  readonly rayon: number;
  readonly remplissage: Teinte;
  readonly contour: (Teinte & { readonly epaisseur: number }) | undefined;
}

/** Une ligne brisee, ouverte: un trait de l'arc des charges du Tactique (etape 7.7). */
export interface TraitScene {
  readonly id: string;
  /** Les sommets a plat, en coordonnees de carte: x1, y1, x2, y2, et ainsi de suite. */
  readonly points: readonly number[];
  readonly couleur: number;
  readonly alpha: number;
  readonly epaisseur: number;
}

/** Tout ce qu'une image contient, hors decor et interface. */
export interface Scene {
  /** Les disques poses SOUS les entites: zones, halos, ombres, rayons de detection. */
  readonly disques: readonly DisqueScene[];
  /**
   * Les cones du mode Tactique, poses sous les entites, par-dessus les disques: notre
   * visee, et les tirs qui viennent de partir.
   */
  readonly cones: readonly ConeScene[];
  /** Les zones speciales, qui portent en plus un libelle a ecrire. */
  readonly zones: readonly ZoneScene[];
  /** Les objets ramassables poses sur la carte. */
  readonly objets: readonly SpriteScene[];
  /** Les personnages: joueurs, faux ninjas et bots noirs, et les cadavres du Massacre dessous. */
  readonly entites: readonly SpriteScene[];
  /**
   * Le sang du Massacre a imprimer au sol (etape 7.4). Le rendu n'imprime chaque tache
   * qu'une fois: une tache deja au sol peut revenir dans la scene sans rien couter.
   */
  readonly sang: readonly TacheScene[];
  /** Le decalage de la camera d'une secousse, en pixels de carte. Nul hors du Massacre. */
  readonly secousse: { readonly x: number; readonly y: number };
  /**
   * Les reperes poses par-dessus tout, premier plan compris: les anneaux qui
   * designent notre personnage (etape 7.8). Un toit ne doit pas les cacher, puisque c'est
   * justement quand on ne se voit plus qu'on les demande.
   */
  readonly reperes: readonly DisqueScene[];
  /**
   * L'arc de nos charges, sous notre ninja et par-dessus les personnages (Tactique, etape
   * 7.7). Vide dans les autres modes.
   */
  readonly indicateur: IndicateurScene;
  /**
   * L'image de la planche de pluie a montrer, sur une carte qui en a une. Absente
   * d'une scene vide; le rendu l'ignore sur une carte sans pluie.
   */
  readonly imageDePluie?: number;
}

/** Une scene vide, celle d'un ecran sans partie en cours. */
export const SCENE_VIDE: Scene = {
  disques: [],
  cones: [],
  zones: [],
  objets: [],
  entites: [],
  reperes: [],
  indicateur: AUCUN_INDICATEUR,
  sang: [],
  secousse: { x: 0, y: 0 },
};

/** La direction de chaque orientation, en radians. L'axe des y descend. */
const ANGLES: Readonly<Record<Orientation, number>> = {
  est: 0,
  sud_est: Math.PI / 4,
  sud: Math.PI / 2,
  sud_ouest: (3 * Math.PI) / 4,
  ouest: Math.PI,
  nord_ouest: (-3 * Math.PI) / 4,
  nord: -Math.PI / 2,
  nord_est: -Math.PI / 4,
};

/** La demi-ouverture du cone de chaque visee, en radians (etape 7.7 pour les deux autres). */
const DEMI_OUVERTURES: Readonly<Record<Visee, number>> = {
  normale: (CONES_DES_VISEES.normale.angleDegres / 2) * (Math.PI / 180),
  large: (CONES_DES_VISEES.large.angleDegres / 2) * (Math.PI / 180),
  etroite: (CONES_DES_VISEES.etroite.angleDegres / 2) * (Math.PI / 180),
};

/**
 * Convertit une couleur du contrat, ecrite en hexadecimal, en nombre.
 *
 * PixiJS accepte les deux formes, mais la conversion faite une fois ici evite de
 * la refaire soixante fois par seconde et par entite.
 */
export function couleurEnNombre(couleur: Couleur): number {
  const nettoyee = couleur.startsWith('#') ? couleur.slice(1) : couleur;
  const valeur = Number.parseInt(nettoyee, 16);

  return Number.isNaN(valeur) ? 0xffffff : valeur;
}

/** Adresse complete d'une ressource, telle que le navigateur la demandera. */
function adresse(relatif: string): string {
  return `${RACINE_RESSOURCES}/${relatif}`;
}

/**
 * L'adresse de chaque image de ninja, par direction puis par image de marche, composee
 * une fois pour toutes (etape 5.7). A cinq cents entites, la recomposer pour chacune a
 * chaque image fabriquait trente mille chaines par seconde, toujours les memes.
 */
const ADRESSES_DE_NINJA: ReadonlyMap<Direction, readonly string[]> = new Map(
  DIRECTIONS.map((direction) => [
    direction,
    Array.from({ length: IMAGES_DE_MARCHE }, (_, rang) =>
      adresse(cheminNinja(direction, rang + 1)),
    ),
  ]),
);

/** L'adresse de l'image de ninja de cette direction, a cette image de marche. */
function adresseDeNinja(direction: Direction, image: number): string {
  return ADRESSES_DE_NINJA.get(direction)?.[image - 1] ?? adresse(cheminNinja(direction, image));
}

/**
 * Construit la scene a dessiner.
 *
 * @param etat       L'etat du client, lu tel quel a chaque image.
 * @param lissee     Les positions lissees du battement en cours d'affichage.
 * @param maintenant Instant local, lu sur l'horloge du client.
 * @param localisation Le reperage de notre personnage en cours, s'il y en a un.
 * @param niveauDeSang Le sang que le joueur veut voir, dans le mode Massacre.
 */
export function construireScene(
  etat: EtatClient,
  lissee: VueLissee | undefined,
  maintenant: number,
  localisation?: Localisation,
  niveauDeSang: NiveauDeSang = 'normal',
): Scene {
  if (lissee === undefined) {
    return SCENE_VIDE;
  }

  const moi = etat.moi;
  const bonusActifs = new Set<TypeBonus>(bonusDOrigineEnCours(etat, maintenant));

  // Le rayon de detection des bots noirs est un reglage de la partie: on le lit
  // dans le salon, qui porte les reglages retenus. Faute de salon, la valeur par
  // defaut, qui est celle que le joueur voit dans presque toutes les parties.
  const rayonDetection =
    etat.salon?.reglages.botsNoirs.rayonDetectionPx ??
    REGLAGES_PAR_DEFAUT.botsNoirs.rayonDetectionPx;

  const disques: DisqueScene[] = [];
  const zones: ZoneScene[] = [];
  const objets: SpriteScene[] = [];
  const entites: SpriteScene[] = [];

  for (const zone of lissee.vue.zones) {
    const apparence = APPARENCE_ZONE[zone.type];

    zones.push({
      id: zone.id,
      type: zone.type,
      libelle: apparence.libelle,
      x: zone.x,
      y: zone.y,
      rayon: zone.rayon,
      remplissage: apparence.fond,
      contour: { ...apparence.bordure, epaisseur: 2 },
    });
  }

  const image = imageDeMarche(maintenant);
  const revelationActive = bonusActifs.has('revelation');

  for (const { entite, x, y, enMouvement } of lissee.entites) {
    const cachee = dansUneZoneInvisible(lissee, x, y);
    const estMoi = entite.id === moi;

    // Un joueur cache dans une zone d'invisibilite disparait pour les autres, et
    // se voit lui-meme en transparence. Il faut bien qu'il sache ou il est.
    if (cachee && entite.type === 'joueur' && !estMoi) {
      continue;
    }

    const alpha = cachee && estMoi ? ALPHA_INVISIBLE : 1;

    if (estMoi) {
      disques.push({
        id: `${entite.id}:ombre`,
        x,
        y: y + OMBRE_JOUEUR.decalageY,
        rayon: OMBRE_JOUEUR.rayon,
        remplissage: OMBRE_JOUEUR.teinte,
        contour: undefined,
      });

      for (const nature of bonusActifs) {
        const halo = HALO_BONUS[nature];

        disques.push({
          id: `${entite.id}:${nature}`,
          x,
          y,
          rayon: rayonPulsant(halo, maintenant),
          remplissage: halo.teinte,
          contour: undefined,
        });
      }
    } else if (entite.type === 'joueur' && revelationActive) {
      disques.push({
        id: `${entite.id}:revelation`,
        x,
        y,
        rayon: rayonPulsant(HALO_REVELATION_AUTRUI, maintenant),
        remplissage: HALO_REVELATION_AUTRUI.teinte,
        contour: { ...HALO_REVELATION_AUTRUI.teinte, alpha: 0.4, epaisseur: 2 },
      });
    }

    if (entite.type === 'botNoir') {
      disques.push({
        id: `${entite.id}:detection`,
        x,
        y,
        rayon: rayonDetection,
        remplissage: TEINTE_DETECTION_BOT_NOIR,
        contour: undefined,
      });
      disques.push({
        id: `${entite.id}:pulsation`,
        x,
        y,
        rayon: rayonPulsant(HALO_BOT_NOIR, maintenant),
        remplissage: undefined,
        contour: { ...HALO_BOT_NOIR.teinte, epaisseur: 1 },
      });
    }

    entites.push({
      id: entite.id,
      // A l'arret, un personnage garde sa direction et sa premiere image, sans marcher
      // sur place: c'est getFrameKey du jeu d'origine (client.js:589).
      texture: adresseDeNinja(entite.direction, enMouvement ? image : 1),
      x,
      y,
      taille: TAILLE_SPRITE,
      teinte: couleurEnNombre(teinteDe(entite, enMouvement)),
      alpha,
    });
  }

  for (const objet of lissee.vue.objets) {
    const apparence = APPARENCE_OBJET[objet.nature];
    const opacite = opaciteObjet(objet.dureeDeVieRestanteMs, maintenant);

    disques.push({
      id: `${objet.id}:halo`,
      x: objet.x,
      y: objet.y,
      rayon: RAYON_HALO_OBJET,
      remplissage: { couleur: apparence.couleur, alpha: opacite * 0.6 },
      contour: { couleur: apparence.couleur, alpha: opacite * 0.8, epaisseur: 3 },
    });

    objets.push({
      id: objet.id,
      texture: adresseDImage(adresse(cheminObjet(objet.nature)), imageDObjet(maintenant)),
      x: objet.x,
      y: objet.y,
      taille: TAILLE_OBJET,
      teinte: 0xffffff,
      alpha: opacite,
    });
  }

  // Le repere suit la position AFFICHEE de notre personnage, pas celle du dernier
  // battement: sinon il le devancerait d'un battement. Il prend notre couleur (etape 7.8).
  const monEntite = lissee.entites.find(({ entite }) => entite.id === moi);
  const reperes =
    monEntite === undefined
      ? []
      : reperesDeLocalisation(
          monEntite,
          opaciteDeLocalisation(localisation, maintenant),
          maintenant,
          couleurEnNombre(monEntite.entite.couleur),
        );

  const massacre = imageDuMassacre(etat, maintenant, niveauDeSang);
  const mode = etat.salon?.mode;
  // Nos effets du Tactique changent notre cone et se lisent sur l'arc (etape 7.7).
  const effets =
    mode === 'tactique' ? effetsTactiquesSurMoi(etat, maintenant) : AUCUN_EFFET_TACTIQUE;
  const cones = [
    ...maVisee(monEntite, mode, viseeDe(effets)),
    ...tirsRecents(etat, lissee, maintenant),
    ...massacre.cones,
  ];
  const indicateur =
    mode === 'tactique' &&
    monEntite?.entite.type === 'joueur' &&
    monEntite.entite.tactique !== undefined
      ? arcDesCharges(
          monEntite.entite.id,
          monEntite.x,
          monEntite.y,
          monEntite.entite.tactique,
          effets,
        )
      : AUCUN_INDICATEUR;

  return {
    disques: [...disques, ...massacre.disques],
    cones,
    zones,
    objets,
    // Les cadavres d'abord: les vivants passent par-dessus.
    entites: massacre.cadavres.length === 0 ? entites : [...massacre.cadavres, ...entites],
    reperes,
    indicateur,
    sang: massacre.sang,
    secousse: massacre.secousse,
    imageDePluie: imageDePluie(maintenant),
  };
}

/**
 * Notre cone de visee, devant notre personnage, a sa position affichee.
 *
 * Seulement le notre, comme dans la version 0.9.0: douze cones sur le terrain
 * cacheraient les ninjas que l'on cherche. Il palit quand il ne reste aucune charge.
 * Il n'existe que dans une partie ou le flux porte une orientation: le Tactique, la Chasse,
 * et le Massacre, ou c'est l'arc du katana, plus large et plus court (etape 7.4). En
 * Tactique, il prend la visee que nos objets nous donnent (etape 7.7).
 */
function maVisee(
  mien: VueLissee['entites'][number] | undefined,
  mode: Mode | undefined,
  visee: Visee,
): readonly ConeScene[] {
  if (mien === undefined || mien.entite.type !== 'joueur' || mien.entite.tactique === undefined) {
    return [];
  }

  const { orientation, charges } = mien.entite.tactique;
  const katana = mode === 'massacre';
  const apparence = katana
    ? charges > 0
      ? APPARENCE_KATANA.visee
      : APPARENCE_KATANA.viseeEnGarde
    : charges > 0
      ? APPARENCE_TIR.visee
      : APPARENCE_TIR.viseeDesarmee;

  return [
    {
      id: `${mien.entite.id}:visee`,
      x: mien.x,
      y: mien.y,
      angle: ANGLES[orientation],
      demiOuverture: katana ? DEMI_ARC_DU_KATANA : DEMI_OUVERTURES[visee],
      rayon: katana ? MASSACRE.PORTEE_DU_KATANA_PX : CONES_DES_VISEES[visee].porteePx,
      remplissage: apparence.remplissage,
      contour: apparence.contour,
    },
  ];
}

/**
 * Les tirs qui viennent de partir, de n'importe quel joueur: l'eclair du cone, qui
 * grandit et s'efface.
 *
 * Il part d'ou le tir est parti, et non du joueur affiche: c'est de la qu'il a
 * capture. Un tir qui a pris quelque chose n'a pas la meme couleur qu'un tir dans le
 * vide.
 *
 * Le tir d'un autre joueur parti d'une zone d'invisibilite ne se montre pas: le tireur
 * y est cache, et l'eclair le trahirait. Le notre se voit toujours, comme notre
 * personnage.
 */
function tirsRecents(
  etat: EtatClient,
  lissee: VueLissee,
  maintenant: number,
): readonly ConeScene[] {
  const cones: ConeScene[] = [];

  etat.journal.forEach((fait, rang) => {
    if (fait.nature !== 'tirDeCapture') {
      return;
    }

    const { tireur, x, y } = fait.charge;

    if (tireur !== etat.moi && dansUneZoneInvisible(lissee, x, y)) {
      return;
    }

    const progression = (maintenant - fait.instant) / APPARENCE_TIR.dureeMs;

    if (progression < 0 || progression >= 1) {
      return;
    }

    const tir = fait.charge;
    const couleur = tir.captures > 0 ? APPARENCE_TIR.reussi : APPARENCE_TIR.manque;
    const opacite = 1 - progression;
    // Le cone du tireur au moment du tir, qu'un objet du Tactique a pu changer (etape 7.7).
    const visee = tir.visee ?? 'normale';

    cones.push({
      id: `tir:${tir.tireur}:${String(rang)}`,
      x: tir.x,
      y: tir.y,
      angle: ANGLES[tir.orientation],
      demiOuverture: DEMI_OUVERTURES[visee],
      rayon: CONES_DES_VISEES[visee].porteePx * (1 + progression * APPARENCE_TIR.agrandissement),
      remplissage: { couleur, alpha: opacite * 0.3 },
      contour: { couleur, alpha: opacite * 0.8, epaisseur: 2 },
    });
  });

  return cones;
}

/**
 * De quelle couleur peindre une entite.
 *
 * Le corps rouge du sprite prend la couleur de son proprietaire, ses details
 * gardent la leur (recoloration.ts). Un bot non capture a le corps blanc, ce qui
 * le rend indiscernable d'un joueur blanc: c'est voulu, c'est meme tout le jeu.
 *
 * Le parametre enMouvement ne sert pas encore a la couleur; il est la parce que
 * l'appelant l'a et que la signature restera juste si une apparence de marche
 * differait un jour.
 */
function teinteDe(entite: EntiteVue, _enMouvement: boolean): Couleur {
  return entite.couleur === '' ? COULEUR_BOT_NEUTRE : entite.couleur;
}

/** Ce point est-il dans une zone d'invisibilite active. */
function dansUneZoneInvisible(lissee: VueLissee, x: number, y: number): boolean {
  return lissee.vue.zones.some(
    (zone) => zone.type === 'invisibilite' && Math.hypot(x - zone.x, y - zone.y) <= zone.rayon,
  );
}
