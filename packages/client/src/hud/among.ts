/**
 * Le HUD d'Among Ninjas (etape 7.20): ce que la surcouche montre de notre role, des taches et
 * du bouton d'action, et la carte plein ecran (etape 7.21). Calcul pur, comme le reste du
 * modele du HUD (modele.ts).
 *
 * LE MOT « ASSASSIN ». Le porteur du projet l'a prefere a « tueur », plus dans le theme des
 * ninjas: la page dit « Assassin », le code garde le role `tueur`.
 *
 * LE BOUTON D'ACTION DIT CE QU'IL FERA. Le serveur decide, mais le joueur doit savoir avant
 * d'appuyer: signaler s'il y a un cadavre a portee, sonner s'il est au point de reunion, ouvrir
 * sa tache a une station. La page le lit dans ce qu'elle recoit: les cadavres de sa vue, le
 * gong et les stations de son etat prive.
 *
 * LA CARTE ET LA MINI-CARTE NE MONTRENT JAMAIS LES AUTRES JOUEURS: la vision reduite ferait
 * sinon double emploi avec rien.
 */

import type { EntiteVue, EtatPriveAmong, PhaseAmong, Position } from '@neon-ninja/shared';
import {
  AMONG,
  AMONG_PAR_DEFAUT,
  CARTES,
  RACINE_RESSOURCES,
  REGLAGES_PAR_DEFAUT,
  cheminCarte,
} from '@neon-ninja/shared';

import { stationsAMontrer } from '../among.js';
import type { EtatClient } from '../etat.js';
import { TITRES_DES_TACHES } from '../interface/modeles/gestes/index.js';

/** Ce que fera le bouton d'action si l'on appuie maintenant. */
export type GesteAmong = 'signaler' | 'gong' | 'tache' | 'aucun';

/** Une tache de notre liste, telle que la liste et la carte l'ecrivent. */
export interface LigneDeTache {
  /** Le nom de la tache: « Aiguiser un katana ». */
  readonly titre: string;
  /** Le nom de sa station: « Pierre du jardin zen ». */
  readonly station: string;
  readonly faite: boolean;
}

/** Le HUD d'Among Ninjas. */
export interface AmongHud {
  /** « Proie », « Assassin », ou « Fantôme » une fois mort. */
  readonly role: string;
  /** Le role, pour la couleur du bandeau. */
  readonly camp: 'proie' | 'tueur';
  readonly fantome: boolean;
  /** Ce que le role demande, en quelques mots. */
  readonly consigne: string;
  readonly phase: PhaseAmong | undefined;
  /** La barre commune des taches, de zero a un, et son texte. */
  readonly taches: { readonly part: number; readonly texte: string } | undefined;
  /** Nos taches, pour une proie: « 2 sur 5 ». */
  readonly mesTaches: string | undefined;
  /** Notre liste, pour une proie, montree sous la mini-carte au bureau (etape 7.21). */
  readonly liste: readonly LigneDeTache[];
  /** Le bouton d'action: ce qu'il fera, et son nom. */
  readonly geste: GesteAmong;
  readonly libelleDuGeste: string;
  /** La mini-carte: ou l'on est, et ou aller. */
  readonly minimap: MinimapAmong;
}

/** Un point de la mini-carte, en part de la carte: de zero a un sur chaque axe. */
export interface PointDeMinimap {
  readonly x: number;
  readonly y: number;
}

/**
 * La mini-carte d'Among Ninjas (decision 24 de la fiche 7.20): toute la carte, notre position,
 * nos stations a faire, ou toutes les stations actives pour un assassin, et le gong.
 */
export interface MinimapAmong {
  /** L'adresse du fond de la carte, montre en petit. */
  readonly fond: string;
  /** La carte se joue en miroir: le fond se retourne, les lieux le sont deja. */
  readonly miroir: boolean;
  /** Largeur sur hauteur de la carte. */
  readonly proportions: number;
  readonly moi: (PointDeMinimap & { readonly couleur: string }) | undefined;
  readonly stations: readonly PointDeMinimap[];
  readonly gong: PointDeMinimap;
}

/** Un repere de la carte plein ecran: une station, son nom et sa tache. */
export interface RepereDeCarte extends PointDeMinimap {
  /** Ce qui s'y fait: une tache, ou toutes celles de la station pour un assassin. */
  readonly titre: string;
  readonly station: string;
  readonly faite: boolean;
}

/**
 * La carte plein ecran (etape 7.21, rendu A): le decor eteint, nos stations en neon avec le nom
 * de leur tache, nos taches faites cochees, le gong et nous. Un assassin y voit toutes les
 * stations actives et leurs taches, sans liste: il les voit sans pouvoir les faire.
 */
export interface CarteAmong extends Omit<MinimapAmong, 'stations'> {
  readonly camp: 'proie' | 'tueur';
  readonly reperes: readonly RepereDeCarte[];
  /** Notre liste, pour une proie; vide pour un assassin. */
  readonly liste: readonly LigneDeTache[];
  /** « Mes tâches 2 sur 5 », ou « Les tâches des proies » pour un assassin. */
  readonly titreDeLaListe: string;
}

/** Le nom du bouton d'action, selon ce qu'il fera. */
const LIBELLES_DES_GESTES: Readonly<Record<GesteAmong, string>> = {
  signaler: 'Signaler',
  gong: 'Gong',
  tache: 'Tâche',
  aucun: 'Action',
};

/** Le HUD d'Among Ninjas, ou rien dans un autre mode ou avant que la page sache notre role. */
export function amongHud(etat: EtatClient): AmongHud | undefined {
  const prive = etat.among.prive;

  // Pendant le chargement, le role n'est pas encore revele: le bandeau attend la revelation.
  if (
    etat.salon?.mode !== 'among' ||
    prive === undefined ||
    etat.partie?.among?.phase === 'chargement'
  ) {
    return undefined;
  }

  const partie = etat.partie;
  const moi = partie?.entites.find((entite) => entite.id === etat.moi);
  const geste =
    moi === undefined || partie?.among?.phase !== 'jeu'
      ? 'aucun'
      : gesteAPortee(etat, moi, partie.entites);
  const faites = prive.taches.filter((tache) => tache.faite).length;
  const commune = partie?.among;

  return {
    role: prive.fantome ? 'Fantôme' : prive.role === 'tueur' ? 'Assassin' : 'Proie',
    camp: prive.role,
    fantome: prive.fantome,
    consigne: consigneDe(prive.role, prive.fantome),
    phase: commune?.phase,
    taches:
      commune === undefined || commune.tachesTotal === 0
        ? undefined
        : {
            part: Math.min(commune.tachesFaites / commune.tachesTotal, 1),
            texte: `Tâches ${String(commune.tachesFaites)}/${String(commune.tachesTotal)}`,
          },
    mesTaches:
      prive.role === 'proie' ? `${String(faites)} sur ${String(prive.taches.length)}` : undefined,
    liste: listeDe(prive),
    geste,
    libelleDuGeste: LIBELLES_DES_GESTES[geste],
    minimap: minimapDe(etat, moi),
  };
}

/** Notre liste de taches, pour une proie, dans son ordre: vide pour un assassin. */
function listeDe(prive: EtatPriveAmong): readonly LigneDeTache[] {
  return prive.role === 'tueur'
    ? []
    : prive.taches.map((tache) => ({
        titre: TITRES_DES_TACHES[tache.nature],
        station: prive.stations[tache.station]?.nom ?? '',
        faite: tache.faite,
      }));
}

/** Ce qui se place en part de la carte: le fond, le miroir, les proportions, le gong et nous. */
function cadreDeLaCarte(
  etat: EtatClient,
  moi: EntiteVue | undefined,
): Omit<MinimapAmong, 'stations'> & { readonly enPart: (place: Position) => PointDeMinimap } {
  const prive = etat.among.prive;
  const reglages = etat.salon?.reglages ?? REGLAGES_PAR_DEFAUT;
  const carte = CARTES[reglages.carte];
  const enPart = (place: Position): PointDeMinimap => ({
    x: place.x / carte.largeur,
    y: place.y / carte.hauteur,
  });

  return {
    enPart,
    fond: `${RACINE_RESSOURCES}/${cheminCarte(reglages.carte, 'background')}`,
    miroir: reglages.modeMiroir,
    proportions: carte.largeur / carte.hauteur,
    moi: moi === undefined ? undefined : { ...enPart(moi), couleur: moi.couleur },
    gong: enPart(prive?.gong ?? { x: carte.largeur / 2, y: carte.hauteur / 2 }),
  };
}

/** La mini-carte, depuis notre etat prive et notre place sur la carte. */
function minimapDe(etat: EtatClient, moi: EntiteVue | undefined): MinimapAmong {
  const prive = etat.among.prive;
  const { enPart, ...cadre } = cadreDeLaCarte(etat, moi);

  return { ...cadre, stations: prive === undefined ? [] : stationsAMontrer(prive).map(enPart) };
}

/**
 * La carte plein ecran, ou rien dans un autre mode ou avant que la page sache notre role. Une
 * proie y voit toutes ses stations, faites comprises, cochees; un assassin, toutes les stations
 * actives et les taches qu'on peut y faire.
 */
export function carteAmongDe(etat: EtatClient): CarteAmong | undefined {
  const prive = etat.among.prive;

  if (etat.salon?.mode !== 'among' || prive === undefined) {
    return undefined;
  }

  const moi = etat.partie?.entites.find((entite) => entite.id === etat.moi);
  const { enPart, ...cadre } = cadreDeLaCarte(etat, moi);
  const liste = listeDe(prive);
  const reperes: readonly RepereDeCarte[] =
    prive.role === 'tueur'
      ? prive.stations.map((station) => ({
          ...enPart(station),
          titre: station.natures.map((nature) => TITRES_DES_TACHES[nature]).join(', '),
          station: station.nom,
          faite: false,
        }))
      : prive.taches.flatMap((tache, rang) => {
          const station = prive.stations[tache.station];
          const ligne = liste[rang];

          return station === undefined || ligne === undefined
            ? []
            : [{ ...enPart(station), ...ligne }];
        });
  const faites = liste.filter((ligne) => ligne.faite).length;

  return {
    ...cadre,
    camp: prive.role,
    reperes,
    liste,
    titreDeLaListe:
      prive.role === 'tueur'
        ? 'Les tâches des proies'
        : `Mes tâches ${String(faites)} sur ${String(liste.length)}`,
  };
}

/** Ce que le role demande. */
function consigneDe(role: 'proie' | 'tueur', fantome: boolean): string {
  if (fantome) {
    return role === 'tueur' ? 'Vous regardez la suite' : 'Finissez vos tâches';
  }

  return role === 'tueur' ? 'Éliminez sans être vu' : 'Faites vos tâches, trouvez les assassins';
}

/**
 * Ce que fera le bouton d'action, dans l'ordre du serveur (micro-decision 6 de la fiche 7.20):
 * signaler un cadavre a portee, sonner le gong au point de reunion s'il nous reste, ouvrir la
 * tache d'une station. Un fantome n'ouvre que ses taches. Un assassin peut ouvrir une tache a
 * une station active pour faire semblant: le bouton le lui propose aussi.
 */
function gesteAPortee(etat: EtatClient, moi: EntiteVue, entites: readonly EntiteVue[]): GesteAmong {
  const prive = etat.among.prive;

  if (prive === undefined) {
    return 'aucun';
  }

  if (!prive.fantome) {
    const cadavre = entites.some(
      (entite) =>
        entite.type === 'cadavre' && distance(moi, entite) <= AMONG.PORTEE_DU_SIGNALEMENT_PX,
    );

    if (cadavre) {
      return 'signaler';
    }

    if (
      !prive.gongUtilise &&
      gongPermis(etat) &&
      distance(moi, prive.gong) <= AMONG.PORTEE_DU_GONG_PX
    ) {
      return 'gong';
    }
  }

  return stationAPortee(prive, moi) === undefined ? 'aucun' : 'tache';
}

/**
 * Le rang, dans nos stations, de celle ou le bouton ouvrirait une tache: une station de nos
 * taches qui restent pour une proie, toute station active pour un assassin vivant. Rien sinon.
 */
function stationAPortee(prive: EtatPriveAmong, moi: Position): number | undefined {
  const rangs =
    prive.role === 'tueur'
      ? prive.fantome
        ? []
        : prive.stations.map((_station, rang) => rang)
      : prive.taches.filter((tache) => !tache.faite).map((tache) => tache.station);

  return rangs.find((rang) => {
    const station = prive.stations[rang];

    return station !== undefined && distance(moi, station) <= AMONG.RAYON_D_UNE_STATION_PX;
  });
}

/**
 * La station ou un assassin ferait semblant s'il appuyait maintenant (etape 7.21): le bouton
 * ouvrirait une tache, ni cadavre ni gong ne passant devant. Rien pour une proie, dont le
 * serveur ouvre la tache, ni hors du jeu.
 */
export function feinteAPortee(etat: EtatClient): number | undefined {
  const prive = etat.among.prive;
  const partie = etat.partie;
  const moi = partie?.entites.find((entite) => entite.id === etat.moi);

  if (
    prive?.role !== 'tueur' ||
    prive.fantome ||
    moi === undefined ||
    partie?.among?.phase !== 'jeu' ||
    gesteAPortee(etat, moi, partie.entites) !== 'tache'
  ) {
    return undefined;
  }

  return stationAPortee(prive, moi);
}

/**
 * Le gong est-il permis, d'apres le temps du tour: pas dans ses quinze premieres secondes.
 * Sans duree de tour, la page ne sait pas ou en est le tour: elle le propose, et le serveur
 * tranche.
 */
function gongPermis(etat: EtatClient): boolean {
  const commune = etat.partie?.among;
  const dureeMs = (etat.salon?.reglages.among ?? AMONG_PAR_DEFAUT).dureeDuTourS * 1000;

  return commune === undefined || dureeMs === 0
    ? true
    : dureeMs - commune.restantMs >= AMONG.DELAI_DU_GONG_MS;
}

/** Le temps a afficher dans la barre: celui de la phase, ou rien en jeu sans duree de tour. */
export function tempsAmong(etat: EtatClient): number | undefined {
  const commune = etat.partie?.among;

  if (commune === undefined) {
    return undefined;
  }

  return commune.phase === 'jeu' && commune.restantMs === 0 ? undefined : commune.restantMs;
}

/** La recharge du meurtre de l'assassin, en millisecondes, d'apres les reglages. */
export function rechargeDuMeurtreMs(etat: EtatClient): number {
  return (etat.salon?.reglages.among ?? AMONG_PAR_DEFAUT).rechargeMeurtreS * 1000;
}

/** La distance entre deux points, en pixels de carte. */
function distance(un: Position, autre: Position): number {
  return Math.hypot(un.x - autre.x, un.y - autre.y);
}
