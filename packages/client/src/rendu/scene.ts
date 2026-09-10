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
 * un autre » se posait ici, c'est qu'elle manquerait dans packages/sim.
 */

import type { Couleur, EntiteVue, TypeBonus, TypeZone } from '@neon-ninja/shared';
import {
  COULEUR_BOT_NEUTRE,
  RACINE_RESSOURCES,
  REGLAGES_PAR_DEFAUT,
  cheminNinja,
  cheminObjet,
} from '@neon-ninja/shared';

import type { EtatClient } from '../etat.js';
import { effetsEnCours } from '../selecteurs.js';
import { imageDeMarche, opaciteObjet, rayonPulsant } from './animation.js';
import type { Teinte } from './apparence.js';
import {
  ALPHA_INVISIBLE,
  APPARENCE_OBJET,
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

/** Un sprite a poser sur la carte. */
export interface SpriteScene {
  /** Identifiant stable, qui permet au rendu de retrouver l'objet d'une image a l'autre. */
  readonly id: string;
  /** Adresse de la texture a utiliser. */
  readonly texture: string;
  readonly x: number;
  readonly y: number;
  /** Cote du carre d'affichage, en pixels de la carte. */
  readonly taille: number;
  /** Couleur appliquee au sprite, qui est dessine en niveaux de gris. */
  readonly teinte: number;
  readonly alpha: number;
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

/** Tout ce qu'une image contient, hors decor et interface. */
export interface Scene {
  /** Les disques poses SOUS les entites: zones, halos, ombres, rayons de detection. */
  readonly disques: readonly DisqueScene[];
  /** Les zones speciales, qui portent en plus un libelle a ecrire. */
  readonly zones: readonly ZoneScene[];
  /** Les objets ramassables poses sur la carte. */
  readonly objets: readonly SpriteScene[];
  /** Les personnages: joueurs, faux ninjas et bots noirs. */
  readonly entites: readonly SpriteScene[];
}

/** Une scene vide, celle d'un ecran sans partie en cours. */
export const SCENE_VIDE: Scene = { disques: [], zones: [], objets: [], entites: [] };

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
 * Construit la scene a dessiner.
 *
 * @param etat       L'etat du client, lu tel quel a chaque image.
 * @param lissee     Les positions lissees du battement en cours d'affichage.
 * @param maintenant Instant local, lu sur l'horloge du client.
 */
export function construireScene(
  etat: EtatClient,
  lissee: VueLissee | undefined,
  maintenant: number,
): Scene {
  if (lissee === undefined) {
    return SCENE_VIDE;
  }

  const moi = etat.moi;
  const bonusActifs = new Set<TypeBonus>(
    effetsEnCours(etat, maintenant)
      .filter((effet) => effet.categorie === 'bonus')
      .map((effet) => effet.nature as TypeBonus),
  );

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
      texture: adresse(cheminNinja(entite.direction, image)),
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
      texture: adresse(cheminObjet(objet.nature)),
      x: objet.x,
      y: objet.y,
      taille: TAILLE_OBJET,
      teinte: 0xffffff,
      alpha: opacite,
    });
  }

  return { disques, zones, objets, entites };
}

/**
 * De quelle couleur peindre une entite.
 *
 * Le sprite du ninja est dessine en clair et prend la couleur de son
 * proprietaire par teinte. Un bot non capture reste blanc, ce qui le rend
 * indiscernable d'un joueur blanc: c'est voulu, c'est meme tout le jeu.
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
