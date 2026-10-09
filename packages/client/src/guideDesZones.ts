/**
 * Le guide des zones (9 octobre 2026): a chaque image, ce qu'il faut dire au joueur des zones
 * et des mines de zone qui l'entourent. Les regles sont dans zonesExpliquees.ts; ce fichier
 * garde ce qui doit se rappeler d'une image a l'autre.
 *
 *   - Le texte de la bulle d'une mine se decide quand elle apparait, et ne change plus tant
 *     qu'elle reste la plus proche: une bulle qui passerait de la phrase au nom sous nos yeux
 *     se lirait mal.
 *   - L'entree dans une zone se constate d'une image a l'autre; sa phrase flotte deux secondes
 *     et demie au-dessus de notre ninja.
 *   - La duree d'une zone, a sa premiere vue, donne la jauge de son effet en cours: le flux ne
 *     dit que ce qu'il lui reste.
 *   - Le chaos reprend nos ninjas un a un, au fil des battements: ses pertes se cumulent une
 *     seconde avant de s'afficher, en un seul nombre.
 *
 * Chaque phrase complete montree compte comme une explication, retenue par le souvenir.
 */

import type { TypeZone, ZoneVue } from '@neon-ninja/shared';

import type { EtatClient } from './etat.js';
import type { SouvenirDesZones } from './interface/souvenirDesZones.js';
import type { VueLissee } from './rendu/interpolation.js';
import {
  EXPLICATIONS_AVANT_LE_NOM_SEUL,
  mineLaPlusProche,
  ninjasRepeintsParLeChaos,
  texteDeLaZone,
  zonesQuiCouvrent,
} from './zonesExpliquees.js';

/** Combien de temps la phrase d'une zone flotte au-dessus de notre ninja quand on y entre. */
export const DUREE_DE_LA_PHRASE_D_ENTREE_MS = 2500;

/** Combien de temps les pertes du chaos se cumulent avant de s'afficher. */
export const CUMUL_DES_PERTES_DU_CHAOS_MS = 1000;

/**
 * Une bulle a poser au-dessus de la carte, en coordonnees de carte:
 *
 *   - mine: au-dessus d'une mine de zone proche, son nom et son effet;
 *   - entree: au-dessus de notre ninja, la zone ou nous venons d'entrer;
 *   - masque: au-dessus de notre ninja, tant qu'une zone d'invisibilite le cache.
 */
export interface BulleDeZone {
  readonly cle: string;
  readonly genre: 'mine' | 'entree' | 'masque';
  /** Vide pour le masque, qui n'est qu'un pictogramme. */
  readonly texte: string;
  readonly nature: TypeZone;
  readonly x: number;
  readonly y: number;
}

/** Des ninjas que le chaos nous a pris, a montrer sous notre ninja. */
export interface PerteParLeChaos {
  readonly ninjas: number;
  readonly x: number;
  readonly y: number;
}

/** Ce que le guide rend pour une image. */
export interface ImageDuGuide {
  readonly bulles: readonly BulleDeZone[];
  /** Les pertes du chaos cumulees, une fois leur seconde ecoulee. */
  readonly perteParLeChaos: PerteParLeChaos | undefined;
  /** La duree de chaque zone ouverte a sa premiere vue, par identifiant. */
  readonly dureesDesZones: ReadonlyMap<string, number>;
}

/** Un guide des zones, pour une partie. */
export interface GuideDesZones {
  /**
   * Ce qu'il faut montrer a cette image.
   *
   * @param avant L'etat de l'image precedente, pour voir ce que le chaos vient de prendre.
   * @param lissee La vue affichee: les positions qu'on voit a l'ecran.
   */
  image(
    etat: EtatClient,
    avant: EtatClient,
    lissee: VueLissee | undefined,
    maintenant: number,
  ): ImageDuGuide;
}

/** Une entree dans une zone, et sa phrase. */
interface Entree {
  readonly nature: TypeZone;
  readonly texte: string;
  readonly depuis: number;
}

/** Cree le guide des zones d'une partie, qui retient ses explications dans ce souvenir. */
export function creerGuideDesZones(souvenir: SouvenirDesZones): GuideDesZones {
  /** Le texte decide pour la bulle de chaque mine, a son apparition. */
  const textesDesMines = new Map<string, string>();
  /** Les zones ou nous etions a l'image precedente. */
  let zonesOuNousEtions = new Set<string>();
  const entrees = new Map<string, Entree>();
  const durees = new Map<string, number>();
  let pertes: { ninjas: number; depuis: number } | undefined;

  /** Le texte d'une zone, compte comme une explication s'il dit l'effet. */
  const expliquer = (nature: TypeZone): string => {
    const deja = souvenir.explications(nature);

    if (deja < EXPLICATIONS_AVANT_LE_NOM_SEUL) {
      souvenir.retenirUneExplication(nature);
    }

    return texteDeLaZone(nature, deja);
  };

  return {
    image(etat, avant, lissee, maintenant) {
      const zones = lissee?.vue.zones ?? [];
      retenirLesDurees(durees, zones);

      const moi = lissee?.entites.find(({ entite }) => entite.id === etat.moi);
      const bulles: BulleDeZone[] = [];

      if (moi !== undefined) {
        // Avant: la mine de zone la plus proche.
        const mine = mineLaPlusProche(lissee?.entites ?? [], moi);

        if (mine !== undefined) {
          const id = mine.entite.id;
          const texte = textesDesMines.get(id) ?? expliquer(mine.entite.nature);
          textesDesMines.set(id, texte);
          bulles.push({
            cle: `mine:${id}`,
            genre: 'mine',
            texte,
            nature: mine.entite.nature,
            x: mine.x,
            y: mine.y,
          });
        }

        // Une mine garde son texte tant qu'elle est sur la carte: s'en eloigner puis revenir
        // ne compte pas une explication de plus. Ouverte ou retiree, elle s'oublie.
        const posees = new Set(
          (lissee?.entites ?? [])
            .filter(({ entite }) => entite.type === 'mineDeZone')
            .map(({ entite }) => entite.id),
        );

        for (const id of textesDesMines.keys()) {
          if (!posees.has(id)) {
            textesDesMines.delete(id);
          }
        }

        // Pendant: les zones ou nous venons d'entrer.
        const couvrantes = zonesQuiCouvrent(zones, moi);
        const ici = new Set(couvrantes.map((zone) => zone.id));

        for (const zone of couvrantes) {
          if (!zonesOuNousEtions.has(zone.id)) {
            entrees.set(zone.id, {
              nature: zone.type,
              texte: expliquer(zone.type),
              depuis: maintenant,
            });
          }
        }

        zonesOuNousEtions = ici;

        for (const [id, entree] of entrees) {
          if (maintenant - entree.depuis >= DUREE_DE_LA_PHRASE_D_ENTREE_MS) {
            entrees.delete(id);
            continue;
          }

          bulles.push({
            cle: `entree:${id}`,
            genre: 'entree',
            texte: entree.texte,
            nature: entree.nature,
            x: moi.x,
            y: moi.y,
          });
        }

        // Apres: le masque, tant que l'invisibilite nous cache.
        if (couvrantes.some((zone) => zone.type === 'invisibilite')) {
          bulles.push({
            cle: 'masque',
            genre: 'masque',
            texte: '',
            nature: 'invisibilite',
            x: moi.x,
            y: moi.y,
          });
        }
      }

      // Apres: ce que le chaos vient de nous prendre, cumule une seconde.
      const repeints = ninjasRepeintsParLeChaos(
        avant.partie,
        etat.partie,
        etat.moi,
        etat.salon?.mode,
      );

      if (repeints > 0) {
        pertes = { ninjas: (pertes?.ninjas ?? 0) + repeints, depuis: pertes?.depuis ?? maintenant };
      }

      let perteParLeChaos: PerteParLeChaos | undefined;

      if (pertes !== undefined && maintenant - pertes.depuis >= CUMUL_DES_PERTES_DU_CHAOS_MS) {
        if (moi !== undefined) {
          perteParLeChaos = { ninjas: pertes.ninjas, x: moi.x, y: moi.y };
        }
        pertes = undefined;
      }

      return { bulles, perteParLeChaos, dureesDesZones: durees };
    },
  };
}

/** Retient la duree de chaque zone a sa premiere vue, et oublie celles qui sont fermees. */
function retenirLesDurees(durees: Map<string, number>, zones: readonly ZoneVue[]): void {
  const ouvertes = new Set<string>();

  for (const zone of zones) {
    ouvertes.add(zone.id);

    if (!durees.has(zone.id)) {
      durees.set(zone.id, zone.dureeRestanteMs);
    }
  }

  for (const id of durees.keys()) {
    if (!ouvertes.has(id)) {
      durees.delete(id);
    }
  }
}
