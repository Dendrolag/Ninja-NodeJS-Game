/**
 * Le mode Among Ninjas: des tueurs anonymes, des proies qui font leurs taches, des reunions
 * ou l'on vote (etape 7.20).
 *
 * Aucune version du jeu d'origine n'avait ce mode: ses regles sont celles de la fiche
 * docs/plan/etape-7-20.md, tirees de l'etude du 5 octobre 2026 et confirmees par le porteur
 * du projet le 6 octobre 2026. Les nombres sont dans packages/shared (AMONG).
 *
 * LES PHASES. Une partie lancee attend que chacun ait charge la carte (le chargement), passe par
 * la revelation des roles, puis alterne le jeu et
 * les reunions (discussion, vote, ejection). Hors du jeu, le monde est fige: le moteur ne
 * deplace personne et n'avance que les minuteries de la phase (mondeFigeEnAmong, lu par le
 * moteur). Aucun chronometre de partie: seule une victoire la finit.
 *
 * LE MEURTRE se fait par la demande de capture, au contact. Une proie tuee devient un
 * fantome sur place, et laisse un cadavre. Un fantome traverse les murs, n'est vu que des
 * fantomes, et une proie fantome finit ses taches.
 *
 * LE BOUTON D'ACTION est tenu ou non (EntreeJoueur.agir), et seul l'appui compte. Un vivant
 * signale un cadavre proche, ou, a defaut, sonne le gong au point de reunion; a defaut encore,
 * une proie, vivante ou fantome, ouvre la tache de la station ou elle se tient.
 *
 * LES TACHES (etape 7.21) se jouent dans la page, que le moteur ne voit pas. Il garde la
 * presence (sortir du disque annule la tache), une duree minimale par nature (une fin
 * annoncee plus tot est ignoree), et le role (un tueur qui fait semblant n'ouvre rien: sa page
 * seule joue le geste).
 *
 * LES SABOTAGES (etape 7.22) sont demandes par un assassin, vivant ou fantome, depuis sa carte:
 * un seul a la fois, une recharge commune entre deux. Trois nuisances, les malus du jeu sur les
 * proies vivantes; le nuage noir sur une station, que le serveur filtre dans la vue des proies
 * vivantes; la panne de neons, qui reduit leur vision jusqu'a ce qu'on tienne le boitier; la
 * surchauffe, deux consoles a tenir ensemble avant son terme, sans quoi les assassins gagnent.
 * Une reunion finit le sabotage en cours. LA MALEDICTION, leur miroir: une proie fantome inflige
 * a tous les assassins vivants l'un des trois malus, avec une recharge commune aux fantomes.
 *
 * LES PAS (etape 7.23): un vivant qui marche fait un pas a chaque foulee parcourue, d'apres son
 * deplacement reel. Le moteur dit qui vient d'en faire un (EtatAmong.pasDuBattement); ce que
 * chacun en entend est l'affaire du serveur.
 *
 * LE SECRET n'est pas l'affaire du moteur: il sait tout, et le serveur decide ce que chacun
 * en voit (packages/server/src/vues.ts).
 */

import type {
  Alea,
  NatureDeSabotage,
  NatureDeTache,
  Nuisance,
  Position,
  ReglagesAmong,
  StationDuMode,
} from '@neon-ninja/shared';
import {
  AMONG,
  AMONG_PAR_DEFAUT,
  DUREES_MINIMALES_DES_TACHES_MS,
  NATURES_COURTES,
  NATURES_LONGUES,
  POINTS_AMONG,
  RAYONS_DE_VISION,
  NUISANCES,
  TACHES_VISUELLES,
  VITESSES,
  entier,
  estUneNuisance,
  lieuxDuMode,
  tueursMaximum,
} from '@neon-ninja/shared';

import { positionTenable } from './collisions.js';
import { AUCUN_MALUS, remplacer } from './effets.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import { identifiantSuivant } from './etat.js';
import type {
  CadavreAmong,
  CampAmong,
  EtatAmong,
  EvenementAmong,
  FaitsAmong,
  FouleeAmong,
  JoueurAmong,
  MotifDeReunion,
  ReunionAmong,
  SabotageAmong,
  TacheAmong,
  VoixAmong,
  VoteAmong,
} from './etatAmong.js';
import type { Entrees } from './moteur.js';

/** Aucun fait: le depart de chaque joueur. */
const AUCUN_FAIT: FaitsAmong = {
  taches: 0,
  signalements: 0,
  meurtres: 0,
  bonsVotes: 0,
  meurtresAuPremierTour: 0,
  tueursTrouvesALaPremiereReunion: 0,
};

/** Personne: la reponse quand la partie n'est pas lancee. */
const PERSONNE: ReadonlySet<IdentifiantEntite> = new Set();

/** Les reglages du mode d'une partie. */
function reglagesDe(etat: EtatPartie): ReglagesAmong {
  return etat.reglages.among ?? AMONG_PAR_DEFAUT;
}

/** Ce joueur est-il un tueur, fantome ou non ? */
export function estTueur(etat: EtatPartie, id: IdentifiantEntite): boolean {
  return etat.among?.joueurs[id]?.role === 'tueur';
}

/** Ce joueur est-il un fantome ? */
export function estFantome(etat: EtatPartie, id: IdentifiantEntite): boolean {
  return etat.among?.joueurs[id]?.fantome === true;
}

/** Ce joueur est-il en vie dans une partie lancee ? */
export function estVivant(etat: EtatPartie, id: IdentifiantEntite): boolean {
  const joueur = etat.among?.joueurs[id];

  return joueur !== undefined && !joueur.fantome;
}

/**
 * Les fantomes d'une partie: ils traversent les murs (lu par le moteur au deplacement).
 * Personne avant le lancement.
 */
export function fantomesEnAmong(etat: EtatPartie): ReadonlySet<IdentifiantEntite> {
  const joueurs = etat.among?.joueurs;

  if (joueurs === undefined) {
    return PERSONNE;
  }

  const fantomes = Object.keys(joueurs).filter((id) => joueurs[id]?.fantome === true);

  return fantomes.length === 0 ? PERSONNE : new Set(fantomes);
}

/**
 * Le monde est-il fige ? Oui hors de la phase de jeu, une fois la partie lancee: pendant la
 * revelation, la reunion et l'ejection, personne ne bouge et le temps de jeu ne s'ecoule pas.
 * Une partie decidee aussi, le temps que le serveur la termine.
 */
export function mondeFigeEnAmong(etat: EtatPartie): boolean {
  const among = etat.among;

  return among !== undefined && (among.phase !== 'jeu' || among.vainqueur !== undefined);
}

/**
 * Jusqu'ou ce joueur voit, en pixels, de son centre: selon son role et le palier que l'hote a
 * regle pour lui. Un fantome voit toute la carte. Zero pour un joueur que le mode ne connait
 * pas: il ne voit rien.
 */
export function rayonDeVision(etat: EtatPartie, id: IdentifiantEntite): number {
  const joueur = etat.among?.joueurs[id];

  if (joueur === undefined) {
    return 0;
  }

  if (joueur.fantome) {
    return Number.POSITIVE_INFINITY;
  }

  const reglages = reglagesDe(etat);
  const palier =
    RAYONS_DE_VISION[joueur.role][
      joueur.role === 'proie' ? reglages.visionProie : reglages.visionTueur
    ];

  // La panne de neons (etape 7.22) n'eteint que les proies vivantes.
  return joueur.role === 'proie' && etat.among?.sabotage?.nature === 'panne'
    ? Math.min(palier, AMONG.RAYON_DE_VISION_EN_PANNE_PX)
    : palier;
}

/**
 * Le centre du nuage noir en cours (etape 7.22), ou rien: le serveur en retire ce qui s'y tient
 * de la vue des proies vivantes. Son rayon est AMONG.RAYON_DU_NUAGE_PX.
 */
export function nuageEnAmong(etat: EtatPartie): Position | undefined {
  const among = etat.among;
  const sabotage = among?.sabotage;

  if (sabotage?.nature !== 'nuage' || sabotage.station === undefined) {
    return undefined;
  }

  const station = among?.stations[sabotage.station];

  return station === undefined ? undefined : { x: station.x, y: station.y };
}

/** La partie est-elle decidee: un camp a gagne. */
export function amongDecide(etat: EtatPartie): boolean {
  return etat.among?.vainqueur !== undefined;
}

// --------------------------------------------------------------------------
// Le lancement
// --------------------------------------------------------------------------

/**
 * Lance une partie Among Ninjas.
 *
 *   1. Les tueurs sont tires au sort parmi les joueurs, dans leur ordre dans l'etat. Leur
 *      nombre est celui du reglage, ramene a ce que le nombre de joueurs admet; le serveur
 *      ne lance pas a moins de cinq.
 *   2. Les stations actives sont tirees parmi celles de la carte: le nombre de taches par
 *      proie, plus quatre. Le tirage garde d'abord de quoi faire chacune des taches courtes a
 *      une station differente, puis autant de taches longues distinctes que le reglage en
 *      demande, a des stations encore differentes (etape 7.24), puis complete au hasard.
 *   3. Chaque proie recoit sa liste: autant de stations actives distinctes que de taches,
 *      prises d'abord parmi celles que les listes deja tirees ont le moins prises (etape
 *      7.21), et JAMAIS DEUX FOIS LA MEME TACHE (retour d'essai du porteur du projet, 10
 *      octobre 2026): les natures de la liste sont tirees, distinctes, puis placees chacune a
 *      une station qui la propose. Le reglage dit combien sont longues (etape 7.24).
 *   4. Tout le monde est place autour du point de reunion, et la partie attend que chacun ait
 *      charge la carte avant la revelation.
 *
 * Tout tirage passe par le generateur a graine de l'etat: meme graine, meme partie.
 *
 * @throws Si la carte n'a pas de lieux pour ce mode: le mode impose Tokyo, qui en a.
 */
export function lancerAmong(etat: EtatPartie): EtatPartie {
  const lieux = lieuxDuMode(etat.reglages.carte, etat.reglages.modeMiroir);

  if (lieux === undefined) {
    throw new Error(`La carte ${etat.reglages.carte} n'a pas de lieux pour Among Ninjas.`);
  }

  const reglages = reglagesDe(etat);
  const ids = Object.keys(etat.joueurs);
  const nombreDeTueurs = Math.min(reglages.tueurs, tueursMaximum(ids.length));

  let alea = etat.alea;
  const melange = melanger(alea, ids);
  alea = melange.alea;
  const tueurs = new Set(melange.liste.slice(0, nombreDeTueurs));

  const nombreDeStations = Math.min(
    lieux.stations.length,
    reglages.tachesParProie + AMONG.STATIONS_EN_PLUS_DES_TACHES,
  );
  const tirageDesStations = melanger(
    alea,
    lieux.stations.map((_station, rang) => rang),
  );
  const tirageDesCourtes = melanger(tirageDesStations.alea, NATURES_COURTES);
  const tirageDesLongues = melanger(tirageDesCourtes.alea, NATURES_LONGUES);
  alea = tirageDesLongues.alea;
  const proposent = (nature: NatureDeTache): readonly number[] =>
    tirageDesStations.liste.filter((rang) =>
      (lieux.stations[rang] as StationDuMode).natures.includes(nature),
    );
  // De quoi faire chaque tache courte a une station differente, puis les taches longues
  // demandees a d'autres encore, puis le reste du tirage. Une liste qui place ses taches
  // longues a des stations des courtes leur en laisse assez: elle a autant de taches courtes
  // de moins (listeDeTaches).
  const pourLesCourtes = new Set(
    apparier(tirageDesCourtes.liste, NATURES_COURTES.length, proposent).values(),
  );
  const pourLesLongues = apparier(tirageDesLongues.liste, reglages.tachesLongues, (nature) =>
    proposent(nature).filter((rang) => !pourLesCourtes.has(rang)),
  );
  const necessaires = new Set([...pourLesCourtes, ...pourLesLongues.values()]);
  const actives = [
    ...tirageDesStations.liste.filter((rang) => necessaires.has(rang)),
    ...tirageDesStations.liste
      .filter((rang) => !necessaires.has(rang))
      .slice(0, Math.max(nombreDeStations - necessaires.size, 0)),
  ].sort((un, autre) => un - autre);
  const stations = actives.map((rang) => lieux.stations[rang] as StationDuMode);

  const joueurs: Record<IdentifiantEntite, JoueurAmong> = {};
  const prises = stations.map(() => 0);

  for (const id of ids) {
    if (tueurs.has(id)) {
      joueurs[id] = joueurNeuf('tueur', []);
      continue;
    }

    const liste = listeDeTaches(
      alea,
      stations,
      prises,
      reglages.tachesParProie,
      reglages.tachesLongues,
    );
    alea = liste.alea;
    for (const tache of liste.taches) {
      prises[tache.station] = (prises[tache.station] ?? 0) + 1;
    }
    joueurs[id] = joueurNeuf('proie', liste.taches);
  }

  const among: EtatAmong = {
    phase: 'chargement',
    phaseRestanteMs: AMONG.ATTENTE_DU_CHARGEMENT_MAXIMUM_MS,
    charges: [],
    tour: 0,
    tourEcouleMs: 0,
    reunions: 0,
    joueurs,
    cadavres: {},
    stations,
    gong: lieux.gong,
    boitier: lieux.boitier,
    consoles: lieux.consoles,
    rechargeDesSabotagesMs: 0,
    rechargeDeLaMaledictionMs: 0,
    tachesDesPartis: 0,
    tachesALaDerniereReunion: 0,
  };

  return replacerLesVivants({ ...etat, alea, among });
}

/** Un joueur au depart de la partie. */
function joueurNeuf(role: JoueurAmong['role'], taches: readonly TacheAmong[]): JoueurAmong {
  return {
    role,
    fantome: false,
    rechargeMs: 0,
    gongUtilise: false,
    actionTenue: false,
    taches,
    faits: AUCUN_FAIT,
  };
}

/**
 * La liste de taches d'une proie (etape 7.21): autant de stations actives distinctes que de
 * taches, et autant de natures distinctes (retour d'essai du porteur du projet, 10 octobre
 * 2026: jamais deux fois la meme tache), dont le nombre regle de taches longues (etape 7.24).
 * Les stations sont melangees, puis rangees de la moins prise par les listes deja tirees a la
 * plus prise, le melange departageant les egales: les listes se repartissent sur toutes les
 * stations. Les taches longues se placent d'abord, puis les courtes aux stations restantes:
 * chaque station prend, dans ce rang, une nature qu'elle propose et que la liste n'a pas
 * encore, les natures dans un ordre tire pour cette proie; une station deja servie cede la
 * sienne au besoin, si elle en a une autre.
 *
 * Les stations actives permettent toujours toutes les taches courtes a la fois, et les taches
 * longues demandees a d'autres stations (lancerAmong); l'hote ne regle pas plus de taches qu'il
 * n'y a de taches courtes (BORNES_REGLAGES). Chaque tache longue placee ote au plus une station
 * aux courtes, et la liste demande une courte de moins: elle est toujours complete.
 */
function listeDeTaches(
  alea: Alea,
  stations: readonly StationDuMode[],
  prises: readonly number[],
  nombre: number,
  longues: number,
): { readonly taches: readonly TacheAmong[]; readonly alea: Alea } {
  const melange = melanger(
    alea,
    stations.map((_station, rang) => rang),
  );
  const courtes = melanger(melange.alea, NATURES_COURTES);
  const tireesLongues = melanger(courtes.alea, NATURES_LONGUES);
  // Le tri est stable: a prises egales, l'ordre du melange reste.
  const rangees = [...melange.liste].sort(
    (une, autre) => (prises[une] ?? 0) - (prises[autre] ?? 0),
  );
  const proposees =
    (natures: readonly NatureDeTache[]) =>
    (rang: number): readonly NatureDeTache[] =>
      natures.filter((nature) => (stations[rang] as StationDuMode).natures.includes(nature));
  const pourLesLongues = apparier(rangees, longues, proposees(tireesLongues.liste));
  const pourLesCourtes = apparier(
    rangees.filter((rang) => !pourLesLongues.has(rang)),
    nombre - longues,
    proposees(courtes.liste),
  );
  const taches = rangees.flatMap((station) => {
    const nature = pourLesLongues.get(station) ?? pourLesCourtes.get(station);
    return nature === undefined ? [] : [{ station, nature, faite: false }];
  });

  return { taches, alea: tireesLongues.alea };
}

/**
 * Apparie des elements a des partenaires, un partenaire par element et un element par
 * partenaire, jusqu'a en avoir apparie autant que voulu (appariement par chemins
 * augmentants). Les elements sont servis dans leur ordre, chacun avec le premier de ses
 * partenaires possibles qui soit libre, ou qu'un element deja servi peut lui ceder en prenant
 * un autre des siens. Un element que rien ne permet de servir est passe.
 *
 * @returns Le partenaire de chaque element servi.
 */
function apparier<Element, Partenaire>(
  elements: readonly Element[],
  nombre: number,
  partenairesDe: (element: Element) => readonly Partenaire[],
): ReadonlyMap<Element, Partenaire> {
  const servis = new Map<Element, Partenaire>();
  const tenus = new Map<Partenaire, Element>();

  const servir = (element: Element, vus: Set<Partenaire>): boolean => {
    for (const partenaire of partenairesDe(element)) {
      if (vus.has(partenaire)) {
        continue;
      }

      vus.add(partenaire);
      const tenant = tenus.get(partenaire);

      if (tenant === undefined || servir(tenant, vus)) {
        servis.set(element, partenaire);
        tenus.set(partenaire, element);
        return true;
      }
    }

    return false;
  };

  for (const element of elements) {
    if (servis.size === nombre) {
      break;
    }

    servir(element, new Set());
  }

  return servis;
}

/** Une liste melangee par le generateur a graine (melange de Fisher et Yates). */
function melanger<T>(
  alea: Alea,
  source: readonly T[],
): { readonly liste: readonly T[]; readonly alea: Alea } {
  const liste = [...source];
  let courant = alea;

  for (let rang = liste.length - 1; rang > 0; rang -= 1) {
    const tirage = entier(courant, rang + 1);
    const choisi = liste[tirage.valeur] as T;

    liste[tirage.valeur] = liste[rang] as T;
    liste[rang] = choisi;
    courant = tirage.alea;
  }

  return { liste, alea: courant };
}

/**
 * Place les vivants en cercle autour du point de reunion, dans leur ordre dans l'etat. Une
 * place du cercle qui tomberait dans un mur est remplacee par le point de reunion lui-meme.
 * Les fantomes restent ou ils sont.
 */
function replacerLesVivants(etat: EtatPartie): EtatPartie {
  const among = etat.among as EtatAmong;
  const vivants = Object.keys(etat.joueurs).filter((id) => among.joueurs[id]?.fantome !== true);
  const joueurs: Record<IdentifiantEntite, Joueur> = { ...etat.joueurs };

  vivants.forEach((id, rang) => {
    const angle = (2 * Math.PI * rang) / vivants.length;
    const place = {
      x: among.gong.x + Math.cos(angle) * AMONG.RAYON_DU_CERCLE_DE_REUNION_PX,
      y: among.gong.y + Math.sin(angle) * AMONG.RAYON_DU_CERCLE_DE_REUNION_PX,
    };
    const joueur = joueurs[id] as Joueur;

    joueurs[id] = {
      ...joueur,
      position: positionTenable(etat.terrain, place) ? place : among.gong,
    };
  });

  return { ...etat, joueurs };
}

// --------------------------------------------------------------------------
// Le battement
// --------------------------------------------------------------------------

/**
 * Ce que le mode fait a chaque battement, selon la phase.
 *
 * Pendant le jeu, le moteur l'appelle une fois tout le monde deplace. Hors du jeu, le monde
 * est fige, et le moteur ne l'appelle que pour les minuteries de la phase et les votes. Le
 * bouton d'action tenu est retenu a chaque battement, pour reconnaitre l'appui suivant. Puis
 * la victoire se lit, sauf pendant l'ejection, dont le resultat doit d'abord s'afficher.
 */
export function agirEnAmong(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie {
  if (etat.among === undefined || etat.among.vainqueur !== undefined) {
    return etat;
  }

  // Les pas ne valent que pour le battement qui les a faits (etape 7.23).
  const { pasDuBattement: _duBattementPrecedent, ...among } = etat.among;
  etat = avecAmong(etat, among);

  let courant: EtatPartie;

  switch (among.phase) {
    case 'chargement':
      courant = attendreLeChargement(etat, entrees, dtMs);
      break;
    case 'revelation':
      courant =
        among.phaseRestanteMs - dtMs <= 0
          ? commencerUnTour(etat)
          : avecAmong(etat, { ...among, phaseRestanteMs: among.phaseRestanteMs - dtMs });
      break;
    case 'jeu':
      courant = jouer(etat, entrees, dtMs);
      break;
    case 'discussion':
      courant =
        among.phaseRestanteMs - dtMs <= 0
          ? ouvrirLeVote(etat)
          : avecAmong(etat, { ...among, phaseRestanteMs: among.phaseRestanteMs - dtMs });
      break;
    case 'vote':
      courant = voter(etat, entrees, dtMs);
      break;
    case 'ejection':
      courant =
        among.phaseRestanteMs - dtMs <= 0
          ? finirLEjection(etat)
          : avecAmong(etat, { ...among, phaseRestanteMs: among.phaseRestanteMs - dtMs });
      break;
  }

  courant = retenirLesBoutonsTenus(courant, entrees);

  return courant.among?.phase === 'ejection' ? courant : decider(courant);
}

/**
 * Le chargement (demande du porteur du projet du 10 octobre 2026): la revelation attend que
 * chaque joueur ait charge la carte, pour qu'aucun joueur lent ne la manque. Elle commence
 * des que tous l'ont dit, ou a la fin de l'attente maximale: un joueur bloque ou deconnecte ne
 * retient pas la partie. Un joueur parti ne compte plus.
 */
function attendreLeChargement(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie {
  const among = etat.among as EtatAmong;
  const ids = Object.keys(etat.joueurs);
  const deja = new Set(among.charges ?? []);
  const charges = ids.filter((id) => deja.has(id) || entrees[id]?.carteChargee === true);
  const restante = among.phaseRestanteMs - dtMs;

  if (charges.length === ids.length || restante <= 0) {
    const { charges: _tous, ...sansCharges } = among;

    return avecAmong(etat, {
      ...sansCharges,
      phase: 'revelation',
      phaseRestanteMs: AMONG.DUREE_REVELATION_MS,
    });
  }

  return avecAmong(etat, { ...among, phaseRestanteMs: restante, charges });
}

/** L'etat avec ces tables du mode. */
function avecAmong(etat: EtatPartie, among: EtatAmong): EtatPartie {
  return { ...etat, among };
}

/** L'etat avec ce joueur du mode remplace. */
function avecJoueur(etat: EtatPartie, id: IdentifiantEntite, joueur: JoueurAmong): EtatPartie {
  const among = etat.among as EtatAmong;

  return avecAmong(etat, { ...among, joueurs: { ...among.joueurs, [id]: joueur } });
}

/** L'etat avec ces evenements ajoutes au journal du battement. */
function journaliser(etat: EtatPartie, ...evenements: readonly EvenementAmong[]): EtatPartie {
  return { ...etat, evenements: [...etat.evenements, ...evenements] };
}

/** Retient qui tient le bouton d'action, pour reconnaitre l'appui au battement suivant. */
function retenirLesBoutonsTenus(etat: EtatPartie, entrees: Entrees): EtatPartie {
  const among = etat.among as EtatAmong;
  let change = false;
  const joueurs: Record<IdentifiantEntite, JoueurAmong> = { ...among.joueurs };

  for (const [id, joueur] of Object.entries(among.joueurs)) {
    const tenue = entrees[id]?.agir === true;

    if (joueur.actionTenue !== tenue) {
      joueurs[id] = { ...joueur, actionTenue: tenue };
      change = true;
    }
  }

  return change ? avecAmong(etat, { ...among, joueurs }) : etat;
}

/**
 * Un tour commence: les vivants autour du point de reunion, les cadavres retires, la recharge
 * des tueurs a dix secondes, les taches en cours interrompues.
 */
function commencerUnTour(etat: EtatPartie): EtatPartie {
  const among = etat.among as EtatAmong;
  const tour = among.tour + 1;
  const joueurs = Object.fromEntries(
    Object.entries(among.joueurs).map(([id, joueur]) => {
      const { tacheEnCours: _interrompue, ...sansTache } = joueur;
      return [
        id,
        {
          ...sansTache,
          rechargeMs: joueur.role === 'tueur' ? AMONG.RECHARGE_DEBUT_DE_TOUR_MS : 0,
        },
      ];
    }),
  );
  const { reunion: _close, ejection: _affichee, ...sansReunion } = among;

  return journaliser(
    replacerLesVivants(
      avecAmong(etat, {
        ...sansReunion,
        phase: 'jeu',
        phaseRestanteMs: 0,
        tour,
        tourEcouleMs: 0,
        joueurs,
        cadavres: {},
        rechargeDesSabotagesMs: AMONG.RECHARGE_DES_SABOTAGES_DEBUT_DE_TOUR_MS,
        // Pas de malediction dans les premieres secondes d'un tour (etape 7.22): la recharge
        // le dit, et la page n'a qu'elle a lire.
        rechargeDeLaMaledictionMs: Math.max(
          among.rechargeDeLaMaledictionMs,
          AMONG.DELAI_DE_LA_MALEDICTION_MS,
        ),
      }),
    ),
    { type: 'tourCommence', tour },
  );
}

/**
 * Un battement de jeu.
 *
 *   0. Les pas des vivants (etape 7.23), d'apres le deplacement que le moteur vient de faire.
 *   1. Le tour avance, et les recharges: celle des tueurs, des sabotages, de la malediction.
 *   2. Les taches deja ouvertes: le temps passe, la presence, la fin ou la fermeture
 *      annoncees. Avant les gestes: une tache ouverte a ce battement ne compte son temps
 *      qu'a partir du suivant.
 *   3. Le sabotage en cours (etape 7.22): il s'eteint, se repare, ou la surchauffe est perdue.
 *   4. Les gestes du battement, dans un ordre tire au sort: un meurtre, un signalement, un
 *      gong, l'ouverture d'une tache, un sabotage, une malediction. Une reunion ouverte arrete
 *      les gestes qui suivent.
 *   5. Le terme du tour, s'il est regle, ouvre une reunion; il attend la fin d'une surchauffe,
 *      qu'une reunion d'office annulerait.
 */
function jouer(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie {
  const among = compterLesPas(etat, dtMs);
  const joueurs = Object.fromEntries(
    Object.entries(among.joueurs).map(([id, joueur]) => [
      id,
      joueur.rechargeMs > 0
        ? { ...joueur, rechargeMs: Math.max(joueur.rechargeMs - dtMs, 0) }
        : joueur,
    ]),
  );
  let courant = faireLesTaches(
    avecAmong(etat, {
      ...among,
      tourEcouleMs: among.tourEcouleMs + dtMs,
      joueurs,
      rechargeDesSabotagesMs: Math.max(among.rechargeDesSabotagesMs - dtMs, 0),
      rechargeDeLaMaledictionMs: Math.max(among.rechargeDeLaMaledictionMs - dtMs, 0),
    }),
    entrees,
    dtMs,
  );
  courant = avancerLeSabotage(courant, entrees, dtMs);

  const acteurs = Object.keys(etat.joueurs).filter((id) => {
    const entree = entrees[id];

    return (
      entree?.capturer === true ||
      entree?.agir === true ||
      entree?.saboter !== undefined ||
      entree?.maudire !== undefined
    );
  });
  const ordre = melanger(courant.alea, acteurs);
  courant = { ...courant, alea: ordre.alea };

  for (const id of ordre.liste) {
    if (courant.among?.phase !== 'jeu') {
      return courant;
    }

    if (entrees[id]?.capturer === true) {
      courant = tuer(courant, id);
    }

    if (entrees[id]?.agir === true && courant.among?.joueurs[id]?.actionTenue === false) {
      courant = appuyer(courant, id);
    }

    const demande = entrees[id]?.saboter;

    if (demande !== undefined) {
      courant = saboter(courant, id, demande.nature, demande.station);
    }

    const malediction = entrees[id]?.maudire;

    if (malediction !== undefined) {
      courant = maudire(courant, id, malediction);
    }
  }

  if (courant.among?.phase !== 'jeu') {
    return courant;
  }

  const dureeDuTourMs = reglagesDe(courant).dureeDuTourS * 1000;
  const apres = courant.among as EtatAmong;

  return dureeDuTourMs > 0 &&
    apres.tourEcouleMs >= dureeDuTourMs &&
    apres.sabotage?.nature !== 'surchauffe'
    ? ouvrirUneReunion(courant, 'temps')
    : courant;
}

/**
 * Combien de fois la distance qu'un vivant parcourt en un battement un deplacement peut faire
 * avant de compter pour un saut. Le double: une marche ne l'atteint jamais, un replacement si.
 */
const MARGE_D_UN_SAUT = 2;

/**
 * Les pas du battement (etape 7.23): chaque vivant ajoute a sa marche le chemin fait depuis le
 * battement precedent, et fait un pas des qu'elle atteint une foulee. Le chemin est celui du
 * deplacement reel, si bien qu'un joueur bloque contre un mur ne fait pas de bruit. Un saut plus
 * long qu'un battement ne le permet (le replacement autour du point de reunion) n'est pas une
 * marche: il remet la marche a zero. Un fantome ne fait aucun pas, et un PNJ n'a pas de marche.
 *
 * @returns Les tables du mode, chaque vivant a sa nouvelle marche, et les pas du battement.
 */
function compterLesPas(etat: EtatPartie, dtMs: number): EtatAmong {
  const among = etat.among as EtatAmong;
  const sautPx = ((VITESSES.JOUEUR_PX_PAR_SECONDE * dtMs) / 1000) * MARGE_D_UN_SAUT;
  const joueurs: Record<IdentifiantEntite, JoueurAmong> = { ...among.joueurs };
  const pas: IdentifiantEntite[] = [];

  for (const [id, joueur] of Object.entries(among.joueurs)) {
    const position = etat.joueurs[id]?.position;

    if (position === undefined || joueur.fantome) {
      continue;
    }

    const foulee = marcher(joueur.foulee, position, sautPx);

    if (foulee.parcourusPx >= AMONG.FOULEE_PX) {
      pas.push(id);
    }

    joueurs[id] = {
      ...joueur,
      foulee: { position, parcourusPx: foulee.parcourusPx % AMONG.FOULEE_PX },
    };
  }

  const { pasDuBattement: _aucun, ...reste } = among;

  return pas.length === 0 ? { ...reste, joueurs } : { ...reste, joueurs, pasDuBattement: pas };
}

/** La marche d'un vivant arrive a cette position: le chemin s'ajoute, sauf pour un saut. */
function marcher(foulee: FouleeAmong | undefined, position: Position, sautPx: number): FouleeAmong {
  if (foulee === undefined) {
    return { position, parcourusPx: 0 };
  }

  const chemin = Math.hypot(position.x - foulee.position.x, position.y - foulee.position.y);

  return { position, parcourusPx: chemin > sautPx ? 0 : foulee.parcourusPx + chemin };
}

/**
 * Un tueur tente un meurtre: la proie vivante la plus proche, a sa portee, au contact. A
 * distance egale, l'ordre de l'etat departage. Rien si sa recharge n'est pas finie, s'il est
 * fantome, ou si personne n'est a portee: le geste ne coute alors rien.
 */
export function tuer(etat: EtatPartie, tueurId: IdentifiantEntite): EtatPartie {
  const among = etat.among;
  const tueur = among?.joueurs[tueurId];
  const corps = etat.joueurs[tueurId];

  if (
    among === undefined ||
    among.phase !== 'jeu' ||
    tueur === undefined ||
    corps === undefined ||
    tueur.role !== 'tueur' ||
    tueur.fantome ||
    tueur.rechargeMs > 0
  ) {
    return etat;
  }

  let victime: Joueur | undefined;
  let distanceRetenue = Number.POSITIVE_INFINITY;

  for (const joueur of Object.values(etat.joueurs)) {
    const role = among.joueurs[joueur.id];
    const distance = distanceEntre(corps.position, joueur.position);

    // En inegalite stricte: a distance egale, la premiere dans l'ordre de l'etat reste.
    if (
      role?.role === 'proie' &&
      !role.fantome &&
      distance <= AMONG.PORTEE_DU_MEURTRE_PX &&
      distance < distanceRetenue
    ) {
      victime = joueur;
      distanceRetenue = distance;
    }
  }

  if (victime === undefined) {
    return etat;
  }

  const proie = among.joueurs[victime.id] as JoueurAmong;
  const { tacheEnCours: _interrompue, ...sansTache } = proie;
  const identifiant = identifiantSuivant(etat, 'cadavre');
  const cadavre: CadavreAmong = {
    victime: victime.id,
    position: victime.position,
    couleur: victime.couleur,
  };

  return journaliser(
    {
      ...etat,
      compteurIdentifiants: identifiant.compteur,
      among: {
        ...among,
        joueurs: {
          ...among.joueurs,
          [tueurId]: {
            ...tueur,
            rechargeMs: reglagesDe(etat).rechargeMeurtreS * 1000,
            faits: {
              ...tueur.faits,
              meurtres: tueur.faits.meurtres + 1,
              meurtresAuPremierTour: tueur.faits.meurtresAuPremierTour + (among.tour === 1 ? 1 : 0),
            },
          },
          [victime.id]: { ...sansTache, fantome: true },
        },
        cadavres: { ...among.cadavres, [identifiant.valeur]: cadavre },
      },
    },
    { type: 'meurtre', tueur: tueurId, victime: victime.id, position: victime.position },
  );
}

/**
 * Un joueur appuie sur le bouton d'action. Un vivant signale le cadavre le plus proche a sa
 * portee, ou, a defaut, sonne le gong s'il est au point de reunion et qu'il le peut. A defaut
 * encore, ou pour un fantome, dont le bouton ne sert qu'aux taches, une proie ouvre la tache
 * de la station ou elle se tient.
 */
function appuyer(etat: EtatPartie, id: IdentifiantEntite): EtatPartie {
  // Le battement n'appuie que pour un joueur de la partie que le mode connait: son bouton
  // etait lache au battement precedent (jouer).
  const joueur = (etat.among as EtatAmong).joueurs[id] as JoueurAmong;
  const corps = etat.joueurs[id] as Joueur;

  return joueur.fantome
    ? ouvrirUneTache(etat, id, joueur, corps.position)
    : signalerOuSonner(etat, id, joueur, corps.position);
}

/** Un vivant signale un cadavre, ou sonne le gong, ou, a defaut, ouvre sa tache. */
function signalerOuSonner(
  etat: EtatPartie,
  id: IdentifiantEntite,
  joueur: JoueurAmong,
  position: Position,
): EtatPartie {
  const among = etat.among as EtatAmong;
  const trouve = cadavreLePlusProche(among, position);

  if (trouve !== undefined) {
    return ouvrirUneReunion(
      avecJoueur(etat, id, {
        ...joueur,
        faits: { ...joueur.faits, signalements: joueur.faits.signalements + 1 },
      }),
      'cadavre',
      id,
      trouve.victime,
    );
  }

  // Le gong ne sonne pas pendant la surchauffe (etape 7.22, etude section 4.3): il effacerait
  // le seul sabotage qui peut faire gagner les assassins.
  if (
    !joueur.gongUtilise &&
    among.sabotage?.nature !== 'surchauffe' &&
    among.tourEcouleMs >= AMONG.DELAI_DU_GONG_MS &&
    distanceEntre(position, among.gong) <= AMONG.PORTEE_DU_GONG_PX
  ) {
    return ouvrirUneReunion(avecJoueur(etat, id, { ...joueur, gongUtilise: true }), 'gong', id);
  }

  return ouvrirUneTache(etat, id, joueur, position);
}

/**
 * Une proie ouvre la tache de la station ou elle se tient: une tache de sa liste, pas encore
 * faite, dont le disque la contient. Rien si une tache est deja ouverte, ni pour un tueur, qui
 * fait semblant sans que le moteur le sache.
 */
function ouvrirUneTache(
  etat: EtatPartie,
  id: IdentifiantEntite,
  joueur: JoueurAmong,
  position: Position,
): EtatPartie {
  if (joueur.role !== 'proie' || joueur.tacheEnCours !== undefined) {
    return etat;
  }

  const indice = tacheALaPlace(etat.among as EtatAmong, joueur, position);

  return indice < 0
    ? etat
    : avecJoueur(etat, id, { ...joueur, tacheEnCours: { indice, ecouleMs: 0 } });
}

/** Le cadavre le plus proche de cette place, a portee de signalement, ou rien. */
function cadavreLePlusProche(among: EtatAmong, position: Position): CadavreAmong | undefined {
  let retenu: CadavreAmong | undefined;
  let distanceRetenue = Number.POSITIVE_INFINITY;

  for (const cadavre of Object.values(among.cadavres)) {
    const distance = distanceEntre(position, cadavre.position);

    if (distance <= AMONG.PORTEE_DU_SIGNALEMENT_PX && distance < distanceRetenue) {
      retenu = cadavre;
      distanceRetenue = distance;
    }
  }

  return retenu;
}

/**
 * Les taches ouvertes du battement (etape 7.21). Pour chaque proie, vivante ou fantome, qui a
 * ouvert une tache:
 *
 *   - hors du disque de sa station, ou la page l'a dite fermee: la tache est annulee, a
 *     rouvrir et refaire en entier;
 *   - sinon le temps passe d'autant, et une fin annoncee la fait si la duree minimale de sa
 *     nature est atteinte. Plus tot, la fin est ignoree et la tache reste ouverte.
 *
 * Une tache visuelle finie par une proie vivante se voit a sa station, si l'hote l'a voulu.
 */
function faireLesTaches(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie {
  let courant = etat;
  const among = etat.among as EtatAmong;

  for (const [id, joueur] of Object.entries(among.joueurs)) {
    const ouverte = joueur.tacheEnCours;
    const corps = etat.joueurs[id];

    if (ouverte === undefined || corps === undefined) {
      continue;
    }

    const tache = joueur.taches[ouverte.indice] as TacheAmong;
    const station = among.stations[tache.station] as StationDuMode;
    const { tacheEnCours: _close, ...sansTache } = joueur;

    if (
      entrees[id]?.tache === 'fermee' ||
      distanceEntre(corps.position, station) > AMONG.RAYON_D_UNE_STATION_PX
    ) {
      courant = avecJoueur(courant, id, sansTache);
      continue;
    }

    const ecouleMs = ouverte.ecouleMs + dtMs;

    if (entrees[id]?.tache !== 'finie' || ecouleMs < DUREES_MINIMALES_DES_TACHES_MS[tache.nature]) {
      courant = avecJoueur(courant, id, { ...joueur, tacheEnCours: { ...ouverte, ecouleMs } });
      continue;
    }

    courant = journaliser(
      avecJoueur(courant, id, {
        ...sansTache,
        taches: joueur.taches.map((autre, rang) =>
          rang === ouverte.indice ? { ...autre, faite: true } : autre,
        ),
        faits: { ...joueur.faits, taches: joueur.faits.taches + 1 },
      }),
      { type: 'tacheFaite', joueur: id, station: tache.station, nature: tache.nature },
      ...(reglagesDe(etat).tachesVisuelles &&
      !joueur.fantome &&
      TACHES_VISUELLES.includes(tache.nature)
        ? [
            {
              type: 'tacheVisuelle' as const,
              nature: tache.nature,
              position: { x: station.x, y: station.y },
            },
          ]
        : []),
    );
  }

  return courant;
}

/**
 * Le rang, dans la liste de ce joueur, d'une tache pas encore faite dont la station contient
 * cette place; -1 s'il n'y en a pas. La premiere de la liste l'emporte si deux stations se
 * chevauchaient.
 */
function tacheALaPlace(among: EtatAmong, joueur: JoueurAmong, position: Position): number {
  return joueur.taches.findIndex((tache) => {
    const station = among.stations[tache.station];

    return (
      !tache.faite &&
      station !== undefined &&
      distanceEntre(position, station) <= AMONG.RAYON_D_UNE_STATION_PX
    );
  });
}

// --------------------------------------------------------------------------
// Les sabotages et la malediction (etape 7.22)
// --------------------------------------------------------------------------

/**
 * Un assassin, vivant ou fantome, demande un sabotage. Rien si un sabotage est deja en cours, si
 * la recharge commune court, si le demandeur n'est pas un assassin, ou si la station du nuage
 * n'est pas une station active. Une nuisance frappe aussitot les proies vivantes.
 */
function saboter(
  etat: EtatPartie,
  id: IdentifiantEntite,
  nature: NatureDeSabotage,
  station: number | undefined,
): EtatPartie {
  const among = etat.among as EtatAmong;

  if (
    among.joueurs[id]?.role !== 'tueur' ||
    among.sabotage !== undefined ||
    among.rechargeDesSabotagesMs > 0 ||
    (nature === 'nuage' && (station === undefined || among.stations[station] === undefined))
  ) {
    return etat;
  }

  const sabotage: SabotageAmong = {
    nature,
    restantMs: dureeDuSabotage(nature),
    ...(nature === 'nuage' && station !== undefined ? { station } : {}),
    reparationMs: 0,
    consolesTenues: [false, false],
  };
  const victimes = estUneNuisance(nature) ? vivantsDuRole(etat, 'proie') : [];

  return journaliser(
    infliger(
      avecAmong(etat, { ...among, sabotage }),
      victimes,
      nature,
      AMONG.DUREE_D_UNE_NUISANCE_MS,
    ),
    { type: 'sabotage', nature, victimes },
  );
}

/** Combien dure un sabotage qui s'eteint seul. Zero pour la panne, qui attend sa reparation. */
function dureeDuSabotage(nature: NatureDeSabotage): number {
  switch (nature) {
    case 'nuage':
      return AMONG.DUREE_DU_NUAGE_MS;
    case 'panne':
      return 0;
    case 'surchauffe':
      return AMONG.DELAI_DE_LA_SURCHAUFFE_MS;
    default:
      return AMONG.DUREE_D_UNE_NUISANCE_MS;
  }
}

/**
 * Une proie fantome maudit les assassins vivants: le malus de son choix, a tous a la fois. Rien
 * pour un autre joueur, ou pendant la recharge commune des fantomes, qui couvre aussi les
 * premieres secondes d'un tour (commencerUnTour).
 */
function maudire(etat: EtatPartie, id: IdentifiantEntite, nature: Nuisance): EtatPartie {
  const among = etat.among as EtatAmong;
  const joueur = among.joueurs[id];

  if (
    joueur?.role !== 'proie' ||
    !joueur.fantome ||
    !NUISANCES.includes(nature) ||
    among.rechargeDeLaMaledictionMs > 0
  ) {
    return etat;
  }

  const victimes = vivantsDuRole(etat, 'tueur');

  return journaliser(
    infliger(
      avecAmong(etat, {
        ...among,
        rechargeDeLaMaledictionMs: AMONG.RECHARGE_DE_LA_MALEDICTION_MS,
      }),
      victimes,
      nature,
      AMONG.DUREE_DE_LA_MALEDICTION_MS,
    ),
    { type: 'malediction', nature, victimes },
  );
}

/** Les vivants de ce role presents dans la partie, dans l'ordre de l'etat. */
function vivantsDuRole(etat: EtatPartie, role: JoueurAmong['role']): readonly IdentifiantEntite[] {
  const among = etat.among as EtatAmong;

  return Object.keys(etat.joueurs).filter((id) => {
    const joueur = among.joueurs[id];
    return joueur?.role === role && !joueur.fantome;
  });
}

/**
 * Inflige un malus du jeu a ces joueurs, par le moteur: il s'eteint seul, et les commandes
 * inversees s'appliquent au deplacement. Comme un malus ramasse, la duree repart de zero.
 * Rien pour un sabotage qui n'est pas un malus.
 */
function infliger(
  etat: EtatPartie,
  victimes: readonly IdentifiantEntite[],
  nature: NatureDeSabotage,
  dureeMs: number,
): EtatPartie {
  if (!estUneNuisance(nature)) {
    return etat;
  }

  const joueurs = { ...etat.joueurs };

  for (const id of victimes) {
    const joueur = etat.joueurs[id] as Joueur;
    joueurs[id] = {
      ...joueur,
      malusRestantsMs: remplacer(joueur.malusRestantsMs, nature, dureeMs),
    };
  }

  return { ...etat, joueurs };
}

/**
 * Le sabotage en cours, a ce battement.
 *
 *   - Une nuisance et le nuage s'eteignent a leur terme.
 *   - La panne se repare quand quelqu'un tient le bouton d'action dans le disque du boitier,
 *     sans s'arreter, le temps de la reparation: une proie, vivante ou fantome (l'aide qui ne
 *     vise personne), ou un assassin vivant, qui bluffe et dont la reparation compte.
 *   - La surchauffe se repare quand ses deux consoles sont tenues ensemble, par des vivants, le
 *     temps de la reparation. A son terme, elle est perdue et reste en l'etat: les tueurs
 *     gagnent (campVainqueur).
 */
function avancerLeSabotage(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie {
  const among = etat.among as EtatAmong;
  const sabotage = among.sabotage;

  if (sabotage === undefined) {
    return etat;
  }

  if (sabotage.nature === 'panne') {
    const tenu = posteTenu(
      etat,
      entrees,
      among.boitier,
      (joueur) => joueur.role === 'proie' || !joueur.fantome,
    );
    const reparationMs = tenu ? sabotage.reparationMs + dtMs : 0;

    return reparationMs >= AMONG.REPARATION_DE_LA_PANNE_MS
      ? finirLeSabotage(etat, true)
      : avecAmong(etat, { ...among, sabotage: { ...sabotage, reparationMs } });
  }

  if (sabotage.nature === 'surchauffe') {
    const vivant = (joueur: JoueurAmong): boolean => !joueur.fantome;
    const consolesTenues: [boolean, boolean] = [
      posteTenu(etat, entrees, among.consoles[0], vivant),
      posteTenu(etat, entrees, among.consoles[1], vivant),
    ];
    const reparationMs = consolesTenues[0] && consolesTenues[1] ? sabotage.reparationMs + dtMs : 0;

    if (reparationMs >= AMONG.REPARATION_DE_LA_SURCHAUFFE_MS) {
      return finirLeSabotage(etat, true);
    }

    return avecAmong(etat, {
      ...among,
      sabotage: {
        ...sabotage,
        restantMs: Math.max(sabotage.restantMs - dtMs, 0),
        reparationMs,
        consolesTenues,
      },
    });
  }

  const restantMs = sabotage.restantMs - dtMs;

  return restantMs <= 0
    ? finirLeSabotage(etat, false)
    : avecAmong(etat, { ...among, sabotage: { ...sabotage, restantMs } });
}

/**
 * Quelqu'un que ce critere admet tient-il le bouton d'action dans le disque de ce poste, a ce
 * battement ?
 */
function posteTenu(
  etat: EtatPartie,
  entrees: Entrees,
  poste: Position,
  admis: (joueur: JoueurAmong) => boolean,
): boolean {
  const among = etat.among as EtatAmong;

  return Object.values(etat.joueurs).some((corps) => {
    const joueur = among.joueurs[corps.id];

    return (
      joueur !== undefined &&
      entrees[corps.id]?.agir === true &&
      admis(joueur) &&
      distanceEntre(corps.position, poste) <= AMONG.RAYON_D_UN_POSTE_PX
    );
  });
}

/** Le sabotage en cours est fini: la recharge commune repart pleine. */
function finirLeSabotage(etat: EtatPartie, repare: boolean): EtatPartie {
  const among = etat.among as EtatAmong;
  // Appelee seulement quand un sabotage est en cours.
  const { nature } = among.sabotage as SabotageAmong;
  const { sabotage: _fini, ...sansSabotage } = among;

  return journaliser(
    avecAmong(etat, {
      ...sansSabotage,
      rechargeDesSabotagesMs: AMONG.RECHARGE_DES_SABOTAGES_MS,
    }),
    { type: 'sabotageFini', nature, repare },
  );
}

// --------------------------------------------------------------------------
// La reunion
// --------------------------------------------------------------------------

/**
 * Ouvre une reunion: la discussion commence, les taches en cours s'interrompent, la barre des
 * taches se fige pour qui ne la voit qu'en reunion (etape 7.21), et le
 * journal dit qui l'a ouverte, pourquoi, et qui est mort. Le sabotage en cours finit, et les
 * malus de chacun avec lui (etape 7.22): le monde fige ne les ferait pas vieillir, et ils
 * reprendraient apres la reunion, quand la page les croit eteints.
 */
function ouvrirUneReunion(
  etat: EtatPartie,
  motif: MotifDeReunion,
  par?: IdentifiantEntite,
  cadavre?: IdentifiantEntite,
): EtatPartie {
  const among = etat.among as EtatAmong;
  const numero = among.reunions + 1;
  const joueurs = Object.fromEntries(
    Object.entries(among.joueurs).map(([id, joueur]) => {
      const { tacheEnCours: _interrompue, ...sansTache } = joueur;
      return [id, sansTache];
    }),
  );
  const morts = Object.keys(etat.joueurs).filter((id) => among.joueurs[id]?.fantome === true);
  const { sabotage: _fini, ...sansSabotage } = among;
  const sansMalus = Object.fromEntries(
    Object.entries(etat.joueurs).map(([id, corps]) => [
      id,
      { ...corps, malusRestantsMs: AUCUN_MALUS },
    ]),
  );

  return journaliser(
    avecAmong(
      { ...etat, joueurs: sansMalus },
      {
        ...sansSabotage,
        phase: 'discussion',
        phaseRestanteMs: reglagesDe(etat).discussionS * 1000,
        reunions: numero,
        tachesALaDerniereReunion: avancementDesTaches(among).faites,
        joueurs,
        reunion: {
          numero,
          motif,
          ...(par === undefined ? {} : { par }),
          ...(cadavre === undefined ? {} : { cadavre }),
          votes: {},
        },
      },
    ),
    {
      type: 'reunionOuverte',
      numero,
      motif,
      ...(par === undefined ? {} : { par }),
      ...(cadavre === undefined ? {} : { cadavre }),
      morts,
    },
  );
}

/** La discussion est finie: le vote s'ouvre. */
function ouvrirLeVote(etat: EtatPartie): EtatPartie {
  const among = etat.among as EtatAmong;

  return journaliser(
    avecAmong(etat, { ...among, phase: 'vote', phaseRestanteMs: reglagesDe(etat).voteS * 1000 }),
    { type: 'voteOuvert' },
  );
}

/**
 * Un battement de vote. Chaque vivant qui n'a pas encore vote peut voter, pour un vivant,
 * lui-meme compris, ou pour passer; un vote ne se reprend pas, et un vote pour un fantome ou
 * un inconnu est ignore. Le vote se clot quand tous les vivants ont vote, ou a son terme.
 */
function voter(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie {
  const among = etat.among as EtatAmong;
  // Le vote suit toujours l'ouverture d'une reunion.
  const reunion = among.reunion as ReunionAmong;
  const votes: Record<IdentifiantEntite, VoteAmong> = { ...reunion.votes };
  const exprimes: EvenementAmong[] = [];

  for (const id of Object.keys(etat.joueurs)) {
    const choix = entrees[id]?.voter;

    if (
      choix === undefined ||
      !estVivant(etat, id) ||
      Object.hasOwn(votes, id) ||
      (choix !== null && !estVivant(etat, choix))
    ) {
      continue;
    }

    votes[id] = choix;
    exprimes.push({ type: 'aVote', votant: id });
  }

  const vivants = Object.keys(etat.joueurs).filter((id) => estVivant(etat, id));
  const restante = among.phaseRestanteMs - dtMs;
  const courant = journaliser(
    avecAmong(etat, { ...among, phaseRestanteMs: restante, reunion: { ...reunion, votes } }),
    ...exprimes,
  );

  return restante <= 0 || vivants.every((id) => Object.hasOwn(votes, id))
    ? depouiller(courant)
    : courant;
}

/**
 * Clot le vote. La majorite relative ejecte; une egalite en tete, ou « passer » en tete,
 * n'ejecte personne. Un vivant qui n'a pas vote ne compte pas. L'ejecte devient un fantome,
 * sans cadavre. Chaque voix contre un tueur ejecte est un bon vote, et, a la premiere
 * reunion, un tueur trouve. Le resultat ne dit pas le role de l'ejecte (decision du porteur
 * du projet du 6 octobre 2026): seule la fin de la partie le revelera.
 */
function depouiller(etat: EtatPartie): EtatPartie {
  const among = etat.among as EtatAmong;
  const reunion = among.reunion as ReunionAmong;
  const decompte = decompter(reunion.votes);
  const enTete = decompte[0];
  const ejecte =
    enTete !== undefined &&
    enTete.cible !== null &&
    (decompte[1] === undefined || decompte[1].voix < enTete.voix)
      ? enTete.cible
      : undefined;
  const ejecteEstTueur = ejecte !== undefined && among.joueurs[ejecte]?.role === 'tueur';

  const joueurs = Object.fromEntries(
    Object.entries(among.joueurs).map(([id, joueur]) => {
      const bon = ejecteEstTueur && reunion.votes[id] === ejecte;
      const faits = bon
        ? {
            ...joueur.faits,
            bonsVotes: joueur.faits.bonsVotes + 1,
            tueursTrouvesALaPremiereReunion:
              joueur.faits.tueursTrouvesALaPremiereReunion + (reunion.numero === 1 ? 1 : 0),
          }
        : joueur.faits;

      return [id, { ...joueur, faits, ...(id === ejecte ? { fantome: true } : {}) }];
    }),
  );
  const { reunion: _close, ...sansReunion } = among;

  return journaliser(
    avecAmong(etat, {
      ...sansReunion,
      phase: 'ejection',
      phaseRestanteMs: AMONG.DUREE_EJECTION_MS,
      joueurs,
      ejection: { ...(ejecte === undefined ? {} : { ejecte }), votes: reunion.votes, decompte },
    }),
    {
      type: 'resultatDuVote',
      ...(ejecte === undefined ? {} : { ejecte }),
      votes: reunion.votes,
      decompte,
    },
  );
}

/**
 * Les voix de chaque option, de la plus soutenue a la moins soutenue. A egalite, l'ordre du
 * premier vote exprime departage l'affichage, pas l'issue.
 */
function decompter(votes: Readonly<Record<IdentifiantEntite, VoteAmong>>): readonly VoixAmong[] {
  const voix = new Map<VoteAmong, number>();

  for (const cible of Object.values(votes)) {
    voix.set(cible, (voix.get(cible) ?? 0) + 1);
  }

  return [...voix.entries()]
    .map(([cible, nombre]) => ({ cible, voix: nombre }))
    .sort((une, autre) => autre.voix - une.voix);
}

/** L'ejection est affichee: la partie est decidee, ou un tour commence. */
function finirLEjection(etat: EtatPartie): EtatPartie {
  const decidee = decider(etat);

  return decidee.among?.vainqueur === undefined ? commencerUnTour(etat) : decidee;
}

// --------------------------------------------------------------------------
// La victoire et les points
// --------------------------------------------------------------------------

/**
 * Le camp vainqueur, s'il y en a un.
 *
 *   - Une surchauffe perdue (etape 7.22): les tueurs gagnent.
 *   - Plus aucun tueur vivant, ejecte ou parti: les proies gagnent.
 *   - Les tueurs vivants au moins aussi nombreux que les proies vivantes: les tueurs gagnent.
 *   - Toutes les taches faites, fantomes compris: les proies gagnent.
 *
 * Aucun terme: rien d'autre ne finit la partie.
 */
export function campVainqueur(etat: EtatPartie): CampAmong | undefined {
  const among = etat.among;

  if (among === undefined) {
    return undefined;
  }

  if (surchauffePerdue(among)) {
    return 'tueurs';
  }

  let tueursVivants = 0;
  let proiesVivantes = 0;

  for (const joueur of Object.values(among.joueurs)) {
    if (joueur.fantome) {
      continue;
    }

    if (joueur.role === 'tueur') {
      tueursVivants += 1;
    } else {
      proiesVivantes += 1;
    }
  }

  if (tueursVivants === 0) {
    return 'proies';
  }

  if (tueursVivants >= proiesVivantes) {
    return 'tueurs';
  }

  const { faites, total } = avancementDesTaches(among);

  return total > 0 && faites >= total ? 'proies' : undefined;
}

/** La surchauffe a-t-elle atteint son terme sans etre reparee (etape 7.22) ? */
export function surchauffePerdue(among: EtatAmong): boolean {
  return among.sabotage?.nature === 'surchauffe' && among.sabotage.restantMs === 0;
}

/** Inscrit le camp vainqueur, si la partie est decidee. Appelee avant qu'il le soit. */
function decider(etat: EtatPartie): EtatPartie {
  const among = etat.among as EtatAmong;
  const vainqueur = campVainqueur(etat);

  return vainqueur === undefined ? etat : avecAmong(etat, { ...among, vainqueur });
}

/**
 * Ou en sont les taches de la partie: faites et total, fantomes compris. Les taches des
 * proies parties comptent, faites, des deux cotes.
 */
export function avancementDesTaches(among: EtatAmong): {
  readonly faites: number;
  readonly total: number;
} {
  let faites = among.tachesDesPartis;
  let total = among.tachesDesPartis;

  for (const joueur of Object.values(among.joueurs)) {
    total += joueur.taches.length;
    faites += joueur.taches.filter((tache) => tache.faite).length;
  }

  return { faites, total };
}

/**
 * Les points d'un joueur, tires de ses faits de jeu (POINTS_AMONG). Ils ne classent qu'a
 * l'interieur d'un camp: le camp vainqueur passe devant.
 */
export function pointsEnAmong(etat: EtatPartie, joueur: Joueur): number {
  const faits = etat.among?.joueurs[joueur.id]?.faits ?? AUCUN_FAIT;

  return (
    faits.taches * POINTS_AMONG.TACHE +
    faits.signalements * POINTS_AMONG.SIGNALEMENT +
    faits.bonsVotes * POINTS_AMONG.BON_VOTE +
    faits.meurtres * POINTS_AMONG.MEURTRE +
    faits.tueursTrouvesALaPremiereReunion * POINTS_AMONG.TUEUR_TROUVE_A_LA_PREMIERE_REUNION +
    (faits.meurtresAuPremierTour >= 2 ? POINTS_AMONG.DEUX_MEURTRES_AU_PREMIER_TOUR : 0)
  );
}

/** Ce joueur est-il du camp vainqueur ? Faux tant que la partie n'est pas decidee. */
export function estDuCampVainqueur(etat: EtatPartie, id: IdentifiantEntite): boolean {
  const among = etat.among;
  const joueur = among?.joueurs[id];

  return (
    among?.vainqueur !== undefined &&
    joueur !== undefined &&
    (joueur.role === 'tueur') === (among.vainqueur === 'tueurs')
  );
}

/** La distance entre deux positions, en pixels. */
function distanceEntre(une: Position, autre: Position): number {
  return Math.hypot(une.x - autre.x, une.y - autre.y);
}
