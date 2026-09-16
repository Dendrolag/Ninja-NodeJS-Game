/**
 * Le mode Chasse: des traqueurs cherchent les vrais joueurs caches parmi les faux ninjas,
 * et les proies doivent bouger pour marquer.
 *
 * Etape 7.3. Aucune version du jeu d'origine n'avait ce mode: ses regles sont celles que
 * le porteur du projet a tranchees le 16 septembre 2026, puis revisees le meme jour
 * (docs/plan/etape-7-3.md).
 *
 * QUI EST TRAQUEUR. L'etat d'une Chasse lancee porte la table de ses traqueurs, avec leurs
 * vies et leur arme (EtatPartie.chasse). Un joueur qui n'y figure pas est une proie. La
 * couleur des traqueurs le dit a l'ecran; la table et la couleur s'ecrivent ensemble, dans
 * devenirTraqueur, et nulle part ailleurs.
 *
 * CE QUI SE DECIDE ICI:
 *
 *   - Au lancement, un traqueur par tranche de cinq joueurs, tire au sort.
 *   - Un traqueur tire en cone, comme en Tactique, et ne prend que l'entite la plus proche.
 *     Une proie est infectee: elle devient traqueur sur place. Un faux ninja lui coute une
 *     vie; a la troisieme, il est elimine, et ne joue plus.
 *   - Si plus aucun traqueur n'est en jeu a la suite d'un depart, une proie tiree au sort
 *     le devient; a la suite d'une elimination, la partie est decidee.
 *   - Une proie marque en parcourant la carte, un traqueur en capturant et en gardant ses
 *     vies.
 *   - Un malus frappe l'autre camp.
 *
 * Les ninjas de la carte servent de camouflage: toucher ne fait rien, et il n'y a pas de
 * bots noirs, que les reglages imposes par le mode retirent (imposerLesReglagesDuMode,
 * dans packages/shared).
 */

import type { Position } from '@neon-ninja/shared';
import { CHASSE, COULEUR_DES_TRAQUEURS, TACTIQUE, entier } from '@neon-ninja/shared';

import { captureAutorisee, inscrireAuJournal } from './capture.js';
import type {
  EtatDeChasse,
  EtatPartie,
  IdentifiantEntite,
  Joueur,
  TraqueurEnChasse,
} from './etat.js';
import type { Entrees } from './moteur.js';
import type { VictimeDuMalus } from './objets.js';
import { dansLeCone, ordreDesTirs } from './tactique.js';

/** Aucun joueur hors jeu: la reponse des modes qui n'eliminent personne. */
export const PERSONNE_HORS_JEU: ReadonlySet<IdentifiantEntite> = new Set();

/** La Chasse d'un etat, ou une Chasse vide si elle n'est pas lancee. */
function chasseDe(etat: EtatPartie): EtatDeChasse {
  return etat.chasse ?? { traqueurs: {}, parcours: {}, traqueursEpuises: false };
}

/** Ce joueur est-il un traqueur, elimine ou non ? Faux pour une proie. */
export function estTraqueur(etat: EtatPartie, id: IdentifiantEntite): boolean {
  return etat.chasse?.traqueurs[id] !== undefined;
}

/** Ce joueur est-il un traqueur encore en jeu, avec au moins une vie ? */
export function traqueurEnJeu(etat: EtatPartie, id: IdentifiantEntite): boolean {
  return (etat.chasse?.traqueurs[id]?.vies ?? 0) > 0;
}

/**
 * Les joueurs hors jeu: les traqueurs elimines.
 *
 * Un joueur hors jeu ne bouge plus, ne ramasse rien et ne subit aucun malus (le moteur le
 * lit dans le jeu de regles du mode). Il reste membre de la partie, et classe.
 */
export function horsJeuEnChasse(etat: EtatPartie): ReadonlySet<IdentifiantEntite> {
  const traqueurs = etat.chasse?.traqueurs;

  if (traqueurs === undefined) {
    return PERSONNE_HORS_JEU;
  }

  const elimines = Object.keys(traqueurs).filter((id) => traqueurs[id]?.vies === 0);

  return elimines.length === 0 ? PERSONNE_HORS_JEU : new Set(elimines);
}

/**
 * Fait d'un joueur un traqueur: il en prend la couleur, trois vies, et le delai d'un
 * nouveau traqueur.
 *
 * C'est la seule fonction qui ecrit la couleur des traqueurs ou la table des traqueurs,
 * pour qu'elles ne puissent jamais se contredire. Son parcours de proie est fige tel
 * quel: il garde ses points. Rend l'etat inchange pour un joueur absent de la partie, ou
 * deja traqueur.
 */
export function devenirTraqueur(etat: EtatPartie, id: IdentifiantEntite): EtatPartie {
  const joueur = etat.joueurs[id];

  if (joueur === undefined || estTraqueur(etat, id)) {
    return etat;
  }

  const chasse = chasseDe(etat);
  const traqueur: TraqueurEnChasse = {
    devenuAMs: etat.tempsEcouleMs,
    vies: CHASSE.VIES_DES_TRAQUEURS,
    orientation:
      joueur.direction === 'immobile' ? TACTIQUE.ORIENTATION_DE_DEPART : joueur.direction,
    avantProchainTirMs: 0,
  };

  return {
    ...etat,
    joueurs: { ...etat.joueurs, [id]: { ...joueur, couleur: COULEUR_DES_TRAQUEURS } },
    chasse: { ...chasse, traqueurs: { ...chasse.traqueurs, [id]: traqueur } },
  };
}

/**
 * Ce traqueur peut-il tirer maintenant ?
 *
 * Il faut qu'il soit en jeu, qu'il ait passe son delai de nouveau traqueur, compare en
 * inegalite stricte comme le delai entre deux captures, et qu'une seconde se soit ecoulee
 * depuis son dernier tir. Faux pour une proie.
 */
export function peutTirer(etat: EtatPartie, id: IdentifiantEntite): boolean {
  const traqueur = etat.chasse?.traqueurs[id];

  return (
    traqueur !== undefined &&
    traqueur.vies > 0 &&
    etat.tempsEcouleMs - traqueur.devenuAMs > CHASSE.DELAI_NOUVEAU_TRAQUEUR_MS &&
    traqueur.avantProchainTirMs <= 0
  );
}

/**
 * Lance une Chasse: le parcours de chaque joueur commence, et les premiers traqueurs sont
 * tires au sort.
 *
 * Un traqueur par tranche de cinq joueurs, arrondi au-dessus: un de deux a cinq joueurs,
 * deux de six a dix. Le tirage se fait parmi les joueurs dans leur ordre dans l'etat, par le
 * generateur a graine. Leur delai de trois secondes coincide avec la protection
 * d'apparition que chaque proie porte deja depuis le salon.
 */
export function lancerLaChasse(etat: EtatPartie): EtatPartie {
  const candidats = Object.keys(etat.joueurs);
  const nombre = Math.ceil(candidats.length / CHASSE.JOUEURS_PAR_TRAQUEUR);
  const parcours = Object.fromEntries(
    Object.values(etat.joueurs).map((joueur) => [
      joueur.id,
      { distancePx: 0, derniere: joueur.position },
    ]),
  );
  let courant: EtatPartie = {
    ...etat,
    chasse: { traqueurs: {}, parcours, traqueursEpuises: false },
  };

  for (let tire = 0; tire < nombre; tire += 1) {
    const tirage = entier(courant.alea, candidats.length);
    const [elu] = candidats.splice(tirage.valeur, 1);

    courant = devenirTraqueur({ ...courant, alea: tirage.alea }, elu as IdentifiantEntite);
  }

  return courant;
}

/**
 * Ce que la Chasse fait a chaque battement, une fois tout le monde deplace et avant le
 * releve des contacts.
 *
 *   1. Les proies ajoutent a leur parcours le chemin de ce battement; les traqueurs
 *      s'orientent et voient approcher leur prochain tir.
 *   2. Si plus aucun traqueur n'est en jeu a la suite d'un depart, une proie est tiree au
 *      sort pour le devenir.
 *   3. Les tirs demandes partent, dans un ordre tire au sort.
 *
 * Une Chasse qui n'est pas lancee n'a rien a faire.
 */
export function agirEnChasse(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie {
  if (etat.chasse === undefined) {
    return etat;
  }

  let courant = remplacerLesTraqueursPartis(avancerLesRoles(etat, dtMs));
  const tirage = ordreDesTirs(courant, entrees);
  courant = { ...courant, alea: tirage.alea };

  for (const tireurId of tirage.ordre) {
    courant = tirerEnChasse(courant, tireurId);
  }

  return courant;
}

/** Le parcours des proies et l'arme des traqueurs, apres un battement de dtMs. */
function avancerLesRoles(etat: EtatPartie, dtMs: number): EtatPartie {
  const chasse = chasseDe(etat);
  const traqueurs: Record<IdentifiantEntite, TraqueurEnChasse> = { ...chasse.traqueurs };
  const parcours = { ...chasse.parcours };

  for (const joueur of Object.values(etat.joueurs)) {
    const traqueur = traqueurs[joueur.id];

    if (traqueur !== undefined) {
      traqueurs[joueur.id] = {
        ...traqueur,
        orientation: joueur.direction === 'immobile' ? traqueur.orientation : joueur.direction,
        avantProchainTirMs: Math.max(traqueur.avantProchainTirMs - dtMs, 0),
      };
      continue;
    }

    const avant = parcours[joueur.id] ?? { distancePx: 0, derniere: joueur.position };
    parcours[joueur.id] = {
      distancePx: avant.distancePx + distanceEntre(avant.derniere, joueur.position),
      derniere: joueur.position,
    };
  }

  return { ...etat, chasse: { ...chasse, traqueurs, parcours } };
}

/**
 * Remplace les traqueurs partis (decision 8 du porteur du projet).
 *
 * S'il n'y a plus aucun traqueur en jeu et que les traqueurs ne sont pas epuises, c'est
 * qu'ils sont partis: une proie tiree au sort devient traqueur, s'il reste au moins deux
 * proies. Seule, une proie joue jusqu'au terme. Un traqueur dont le lien est tombe (etape
 * 2.5) est encore dans l'etat, et compte.
 */
function remplacerLesTraqueursPartis(etat: EtatPartie): EtatPartie {
  const ids = Object.keys(etat.joueurs);
  const proies = ids.filter((id) => !estTraqueur(etat, id));

  if (
    chasseDe(etat).traqueursEpuises ||
    ids.some((id) => traqueurEnJeu(etat, id)) ||
    proies.length < CHASSE.JOUEURS_MINIMUM
  ) {
    return etat;
  }

  const tirage = entier(etat.alea, proies.length);

  return devenirTraqueur({ ...etat, alea: tirage.alea }, proies[tirage.valeur] as string);
}

/**
 * Un traqueur tire, s'il le peut.
 *
 * Le cone et la portee sont ceux du Tactique. Parmi les proies et les faux ninjas dans le
 * cone, le plus proche est pris; a distance egale, l'ordre de l'etat departage, joueurs
 * d'abord. Les traqueurs ne sont jamais des cibles.
 *
 *   - Une proie est infectee, si la capture est permise: une proie protegee ou invincible
 *     ne produit rien, et ne coute aucune vie.
 *   - Un faux ninja coute une vie. A zero vie, le traqueur est elimine; s'il etait le
 *     dernier en jeu, les traqueurs sont epuises.
 *   - Le vide ne coute rien.
 *
 * Dans tous les cas, le tir a eu lieu: le traqueur attend une seconde avant le suivant, et
 * le journal le dit.
 */
export function tirerEnChasse(etat: EtatPartie, tireurId: IdentifiantEntite): EtatPartie {
  const tireur = etat.joueurs[tireurId];
  const arme = etat.chasse?.traqueurs[tireurId];

  if (tireur === undefined || arme === undefined || !peutTirer(etat, tireurId)) {
    return etat;
  }

  const cible = cibleLaPlusProche(etat, tireur, arme);
  let courant = armer(etat, tireurId, { ...arme, avantProchainTirMs: CHASSE.DELAI_ENTRE_TIRS_MS });
  let captures = 0;

  if (cible?.type === 'joueur') {
    const apres = infecter(courant, tireurId, cible.id);
    captures = apres === courant ? 0 : 1;
    courant = apres;
  } else if (cible !== undefined) {
    courant = perdreUneVie(courant, tireurId, cible.position);
  }

  return {
    ...courant,
    evenements: [
      ...courant.evenements,
      {
        type: 'tirDeCapture',
        joueur: tireurId,
        position: tireur.position,
        orientation: arme.orientation,
        captures,
      },
    ],
  };
}

/** Une cible possible d'un tir: une proie ou un faux ninja. */
interface Cible {
  readonly type: 'joueur' | 'bot';
  readonly id: IdentifiantEntite;
  readonly position: Position;
}

/** L'entite la plus proche dans le cone d'un traqueur, hors traqueurs, ou rien. */
function cibleLaPlusProche(
  etat: EtatPartie,
  tireur: Joueur,
  arme: TraqueurEnChasse,
): Cible | undefined {
  const candidates: Cible[] = [
    ...Object.values(etat.joueurs)
      .filter((joueur) => !estTraqueur(etat, joueur.id))
      .map((joueur) => ({ type: 'joueur' as const, id: joueur.id, position: joueur.position })),
    ...Object.values(etat.bots)
      .filter((bot) => bot.type === 'bot')
      .map((bot) => ({ type: 'bot' as const, id: bot.id, position: bot.position })),
  ];

  let retenue: Cible | undefined;
  let distanceRetenue = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!dansLeCone(tireur.position, arme.orientation, candidate.position)) {
      continue;
    }

    const distance = distanceEntre(tireur.position, candidate.position);

    // En inegalite stricte: a distance egale, la premiere dans l'ordre reste retenue.
    if (distance < distanceRetenue) {
      retenue = candidate;
      distanceRetenue = distance;
    }
  }

  return retenue;
}

/** Remplace l'arme d'un traqueur. */
function armer(etat: EtatPartie, id: IdentifiantEntite, arme: TraqueurEnChasse): EtatPartie {
  const chasse = chasseDe(etat);

  return { ...etat, chasse: { ...chasse, traqueurs: { ...chasse.traqueurs, [id]: arme } } };
}

/**
 * Un traqueur perd une vie sur un faux ninja. A zero, il est elimine, et, s'il etait le
 * dernier traqueur en jeu, les traqueurs sont epuises.
 */
function perdreUneVie(etat: EtatPartie, id: IdentifiantEntite, position: Position): EtatPartie {
  const arme = etat.chasse?.traqueurs[id];

  if (arme === undefined) {
    return etat;
  }

  const viesRestantes = Math.max(arme.vies - 1, 0);
  const touche = armer(etat, id, { ...arme, vies: viesRestantes });
  const epuises =
    viesRestantes === 0 &&
    !Object.keys(touche.joueurs).some((autre) => traqueurEnJeu(touche, autre));
  const chasse = chasseDe(touche);

  return {
    ...touche,
    chasse: epuises ? { ...chasse, traqueursEpuises: true } : chasse,
    evenements: [
      ...touche.evenements,
      { type: 'vieDeTraqueurPerdue', joueur: id, viesRestantes, position },
    ],
  };
}

/**
 * Un traqueur infecte une proie.
 *
 * La proie devient traqueur sur place, sans reapparaitre ailleurs: son delai de trois
 * secondes laisse aux proies voisines le temps de s'eloigner. Elle garde les points de son
 * parcours. Aucun ninja ne change de main. Les compteurs et le journal des captures
 * avancent comme pour toute capture, et l'evenement de capture le dit, avec la couleur des
 * traqueurs pour nouvelle couleur.
 *
 * Renvoie l'etat inchange, le meme objet, si l'infection n'est pas permise: l'attaquant
 * n'est pas un traqueur en jeu, la victime n'est pas une proie, ou les verifications
 * communes a toutes les captures la refusent (protection, invincibilite, delai d'une
 * seconde entre deux captures).
 */
export function infecter(
  etat: EtatPartie,
  traqueurId: IdentifiantEntite,
  proieId: IdentifiantEntite,
): EtatPartie {
  const traqueur = etat.joueurs[traqueurId];
  const proie = etat.joueurs[proieId];

  if (
    traqueur === undefined ||
    proie === undefined ||
    !traqueurEnJeu(etat, traqueurId) ||
    estTraqueur(etat, proieId) ||
    !captureAutorisee(traqueur, proie)
  ) {
    return etat;
  }

  const infecte = devenirTraqueur(etat, proieId);
  const devenue = infecte.joueurs[proieId] as Joueur;

  return {
    ...infecte,
    joueurs: {
      ...infecte.joueurs,
      [traqueurId]: {
        ...traqueur,
        captures: traqueur.captures + 1,
        joueursCaptures: inscrireAuJournal(traqueur.joueursCaptures, proieId, proie.pseudo),
        tempsDepuisDerniereCaptureMs: 0,
      },
      [proieId]: {
        ...devenue,
        capturesSubies: inscrireAuJournal(proie.capturesSubies, traqueurId, traqueur.pseudo),
      },
    },
    evenements: [
      ...infecte.evenements,
      {
        type: 'captureJoueur',
        attaquant: traqueurId,
        victime: proieId,
        botsTransferes: 0,
        nouvelleCouleurVictime: COULEUR_DES_TRAQUEURS,
        position: proie.position,
      },
    ],
  };
}

/**
 * Qui subit un malus, en Chasse: l'autre camp.
 *
 * Le camp se lit a la couleur, la seule chose que la question recoit: un traqueur porte
 * toujours la couleur des traqueurs, et une proie jamais. Un traqueur elimine, hors jeu,
 * n'est de toute facon pas frappe.
 */
export const malusEnChasse: VictimeDuMalus = (ramasseur, autre) =>
  (ramasseur.couleur === COULEUR_DES_TRAQUEURS) !== (autre.couleur === COULEUR_DES_TRAQUEURS);

/**
 * Les points d'un joueur en Chasse (decisions 14 et 15 du porteur du projet).
 *
 * Un point par tranche de cent pixels parcourus en tant que proie, arrondi en dessous,
 * plus cinquante par proie attrapee, plus vingt-cinq par vie d'un traqueur en jeu. Le
 * score se lit ainsi pendant toute la partie, pour que le classement affiche ne contredise
 * jamais le classement final.
 */
export function pointsEnChasse(etat: EtatPartie, joueur: Joueur): number {
  const distancePx = etat.chasse?.parcours[joueur.id]?.distancePx ?? 0;
  const vies = etat.chasse?.traqueurs[joueur.id]?.vies ?? 0;

  return (
    Math.floor(distancePx / CHASSE.PIXELS_PAR_POINT) +
    joueur.captures * CHASSE.POINTS_PAR_CAPTURE +
    vies * CHASSE.POINTS_PAR_VIE
  );
}

/**
 * La Chasse est-elle decidee avant le terme ?
 *
 * Oui, une fois lancee, s'il ne reste plus aucune proie, tombee ou partie, ou si tous les
 * traqueurs ont ete elimines (decisions 12 et 16 du porteur du projet). Une Chasse au salon
 * ne l'est jamais.
 */
export function chasseDecidee(etat: EtatPartie): boolean {
  const chasse = etat.chasse;

  return (
    chasse !== undefined &&
    (chasse.traqueursEpuises ||
      Object.keys(etat.joueurs).every((id) => chasse.traqueurs[id] !== undefined))
  );
}

/** La distance entre deux positions, en pixels. */
function distanceEntre(une: Position, autre: Position): number {
  return Math.hypot(une.x - autre.x, une.y - autre.y);
}
