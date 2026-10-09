/**
 * Le HUD d'Among Ninjas (etape 7.20): ce que la surcouche montre de notre role, des taches et
 * du bouton d'action. Calcul pur, comme le reste du modele du HUD (modele.ts).
 *
 * LE MOT « ASSASSIN ». Le porteur du projet l'a prefere a « tueur », plus dans le theme des
 * ninjas: la page dit « Assassin », le code garde le role `tueur`.
 *
 * LE BOUTON D'ACTION DIT CE QU'IL FERA. Le serveur decide, mais le joueur doit savoir avant
 * d'appuyer: signaler s'il y a un cadavre a portee, sonner s'il est au point de reunion, faire
 * sa tache a une station. La page le lit dans ce qu'elle recoit: les cadavres de sa vue, le
 * gong et les stations de son etat prive.
 */

import type { EntiteVue, PhaseAmong, Position } from '@neon-ninja/shared';
import { AMONG, AMONG_PAR_DEFAUT } from '@neon-ninja/shared';

import type { EtatClient } from '../etat.js';

/** Ce que fera le bouton d'action si l'on appuie maintenant. */
export type GesteAmong = 'signaler' | 'gong' | 'tache' | 'aucun';

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
  /** Le bouton d'action: ce qu'il fera, et son nom. */
  readonly geste: GesteAmong;
  readonly libelleDuGeste: string;
  /** La tache en cours, de zero a un: ce que la jauge montre pendant qu'on tient le bouton. */
  readonly progression: number | undefined;
}

/** Le nom du bouton d'action, selon ce qu'il fera. */
const LIBELLES_DES_GESTES: Readonly<Record<GesteAmong, string>> = {
  signaler: 'Signaler',
  gong: 'Gong',
  tache: 'Tâche',
  aucun: 'Action',
};

/** Le HUD d'Among Ninjas, ou rien dans un autre mode ou avant que la page sache notre role. */
export function amongHud(etat: EtatClient, maintenant: number): AmongHud | undefined {
  const prive = etat.among.prive;

  if (etat.salon?.mode !== 'among' || prive === undefined) {
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
    geste,
    libelleDuGeste: LIBELLES_DES_GESTES[geste],
    progression: progressionDeLaTache(etat, maintenant),
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
 * Ce que fera le bouton d'action, dans l'ordre du serveur (micro-decision 6 de la fiche):
 * signaler un cadavre a portee, sonner le gong au point de reunion s'il nous reste, faire la
 * tache d'une station. Un fantome ne fait que ses taches. Un assassin peut tenir le bouton a
 * une station pour faire semblant: le bouton le lui propose aussi.
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

  const stations =
    prive.role === 'tueur'
      ? prive.fantome
        ? []
        : prive.stations
      : prive.taches.filter((tache) => !tache.faite).map((tache) => prive.stations[tache.station]);

  return stations.some(
    (station) => station !== undefined && distance(moi, station) <= AMONG.RAYON_D_UNE_STATION_PX,
  )
    ? 'tache'
    : 'aucun';
}

/**
 * Ou en est la tache en cours, de zero a un, d'apres l'instant ou le serveur nous l'a dite
 * commencee: la jauge avance seule, comme celle d'un bonus. Le serveur seul la compte.
 */
function progressionDeLaTache(etat: EtatClient, maintenant: number): number | undefined {
  const { prive, tacheDebuteeA } = etat.among;
  const indice = prive?.tacheEnCours;

  if (prive === undefined || indice === undefined || tacheDebuteeA === undefined) {
    return undefined;
  }

  const duree = prive.taches[indice]?.dureeMs ?? AMONG.DUREE_D_UNE_TACHE_MAXIMUM_MS;

  return Math.min(Math.max((maintenant - tacheDebuteeA) / duree, 0), 1);
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
