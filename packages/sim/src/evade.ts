/**
 * L'Evade: un ninja raye qui apparait une fois par partie, fuit les joueurs, et donne a qui
 * l'attrape un x2 sur tout son score (etape 7.9).
 *
 * Regles tranchees par le porteur du projet le 25 septembre 2026 (docs/plan/etape-7-9.md):
 *
 *   - Il apparait en Horde, en Tactique, en Equipes et en Massacre, pas en Chasse, une seule
 *     fois, a un moment tire au sort entre le quart et les trois quarts de la partie. S'il
 *     n'est pas attrape dans les 45 secondes, il s'en va.
 *   - Il va a 165 pixels par seconde, dix pour cent de plus que tout le monde: un joueur sans
 *     bonus de vitesse ne le rattrape pas en ligne droite.
 *   - Celui qui l'attrape porte le x2 jusqu'a la fin. Un joueur qui capture ou tue le porteur
 *     le lui prend; un Black Ninja qui l'attrape le detruit. En Equipes, le x2 double le
 *     score de l'equipe du porteur.
 *
 * CE N'EST NI UN PNJ NI UN BLACK NINJA. Il vit dans un champ a part de l'etat, et rien de ce
 * qui touche aux bots ne le concerne: il ne prend ni ne transmet de couleur, les PNJ le
 * traversent, les Black Ninjas l'ignorent, les zones ne le poussent pas (micro-decisions 1
 * et 6 de la fiche). On l'attrape comme on prend un PNJ dans chaque mode: au contact en
 * Horde et en Equipes (attraperLEvadeAuContact, dans contacts.ts), par le tir en cone en Tactique
 * (tactique.ts), d'un coup de katana en Massacre (massacre.ts).
 *
 * LE SCORE RESTE UN STOCK (comportement a preserver 1). Aucun nombre n'est range: seul le
 * porteur l'est, et le score se deduit de l'etat comme avant, puis double pour lui
 * (multiplicateurDuScore, lu par score.ts).
 *
 * TOUT CE FICHIER EST PUR. Le hasard passe par le generateur a graine de l'etat, et une
 * partie sans Evade n'en consomme aucun tirage.
 */

import type { Position, Vecteur } from '@neon-ninja/shared';
import { EVADE, MODES_AVEC_EVADE, reel } from '@neon-ninja/shared';

import { trajetTenable } from './collisions.js';
import { resoudreDeplacement } from './deplacement.js';
import { aLaLongueur, directionDuVecteur } from './direction.js';
import type {
  EtatDeLEvade,
  EtatPartie,
  EvadeSurLaCarte,
  EvenementPartie,
  IdentifiantEntite,
  Joueur,
} from './etat.js';
import { identifiantSuivant, positionDApparition } from './etat.js';

/** Le temps, en millisecondes, entre deux changements de cap de l'Evade quand il erre. */
const ERRANCE_MINIMUM_MS = 1000;
const ERRANCE_MAXIMUM_MS = 3000;

/**
 * Prepare l'Evade d'une partie qui se lance: le moment ou il apparaitra.
 *
 * Rien, et aucun tirage, si le reglage est coupe ou si le mode ne l'admet pas: la partie
 * reste exactement celle d'avant l'etape (micro-decision 3 de la fiche).
 */
export function preparerLEvade(etat: EtatPartie): EtatPartie {
  if (!etat.reglages.evade || !MODES_AVEC_EVADE.includes(etat.mode)) {
    return etat;
  }

  const tirage = reel(etat.alea, EVADE.DEBUT_DE_LA_FENETRE, EVADE.FIN_DE_LA_FENETRE);

  return {
    ...etat,
    alea: tirage.alea,
    evade: {
      apparitionMs: Math.round(etat.dureeMs * tirage.valeur),
      surLaCarte: undefined,
      passe: false,
      porteur: undefined,
    },
  };
}

/**
 * Un battement de l'Evade: il apparait quand son heure est venue, fuit ou erre, et s'en va
 * au bout de sa presence.
 */
export function avancerLEvade(etat: EtatPartie, dtMs: number): EtatPartie {
  const evade = etat.evade;

  if (evade === undefined) {
    return etat;
  }

  const present = evade.surLaCarte;

  if (present === undefined) {
    return !evade.passe && etat.tempsEcouleMs >= evade.apparitionMs
      ? apparaitre(etat, evade)
      : etat;
  }

  const avantDepartMs = present.avantDepartMs - dtMs;

  if (avantDepartMs <= 0) {
    return {
      ...etat,
      evade: { ...evade, surLaCarte: undefined, passe: true },
      evenements: [...etat.evenements, { type: 'evadeEnfui', position: present.position }],
    };
  }

  const deplace = bouger(etat, { ...present, avantDepartMs }, dtMs);

  return { ...deplace.etat, evade: { ...evade, surLaCarte: deplace.evade } };
}

/**
 * L'Evade entre sur la carte, a l'ecart des joueurs, comme un Black Ninja (micro-decision 4
 * de la fiche). Il part dans un cap tire au sort.
 */
function apparaitre(etat: EtatPartie, evade: EtatDeLEvade): EtatPartie {
  const identifiant = identifiantSuivant(etat, 'evade');
  const joueurs = Object.values(etat.joueurs).map((joueur) => joueur.position);
  const place = positionDApparition(etat.alea, etat.terrain, joueurs);
  const angle = reel(place.alea, 0, 2 * Math.PI);
  const errance = reel(angle.alea, ERRANCE_MINIMUM_MS, ERRANCE_MAXIMUM_MS);
  const cap = capUnitaire(angle.valeur);

  return {
    ...etat,
    compteurIdentifiants: identifiant.compteur,
    alea: errance.alea,
    evade: {
      ...evade,
      surLaCarte: {
        id: identifiant.valeur,
        position: place.valeur,
        direction: directionDuVecteur(cap),
        cap,
        avantDecisionMs: 0,
        avantChangementDeCapMs: errance.valeur,
        avantDepartMs: EVADE.PRESENCE_MS,
      },
    },
    evenements: [...etat.evenements, { type: 'evadeApparu', position: place.valeur }],
  };
}

/** Ce qu'un battement de deplacement laisse: l'etat, pour son generateur, et l'Evade. */
interface Deplacement {
  readonly etat: EtatPartie;
  readonly evade: EvadeSurLaCarte;
}

/**
 * Choisit son cap, puis avance.
 *
 * Tous les quarts de seconde, il regarde les joueurs a moins de trois cents pixels. S'il en
 * voit, il fuit (capDeFuite). Sinon il erre, en changeant de cap toutes les une a trois
 * secondes. Il avance ensuite a sa vitesse, et longe un mur comme un joueur au lieu de s'y
 * arreter; s'il ne peut plus avancer du tout, il reconsidere son cap des le battement
 * suivant.
 */
function bouger(etat: EtatPartie, evade: EvadeSurLaCarte, dtMs: number): Deplacement {
  let courant = etat;
  let cap = evade.cap;
  let avantDecisionMs = evade.avantDecisionMs - dtMs;
  let avantChangementDeCapMs = evade.avantChangementDeCapMs - dtMs;

  if (avantDecisionMs <= 0) {
    avantDecisionMs = EVADE.DECISION_MS;
    const menaces = menacesDe(etat, evade.position);

    if (menaces.length > 0) {
      cap = capDeFuite(etat, evade.position, cap, menaces);
    } else if (avantChangementDeCapMs <= 0) {
      const errance = capDErrance(courant, evade.position, cap);
      courant = errance.etat;
      cap = errance.cap;
      avantChangementDeCapMs = errance.avantChangementDeCapMs;
    }
  }

  const pas = aLaLongueur(cap, (EVADE.VITESSE_PX_PAR_SECONDE * dtMs) / 1000);
  const position = resoudreDeplacement(etat.terrain, evade.position, pas);
  const bloque = position.x === evade.position.x && position.y === evade.position.y;

  return {
    etat: courant,
    evade: {
      ...evade,
      position,
      cap,
      direction: directionDuVecteur(cap),
      // Arrete net par un mur: il reconsidere son cap au battement suivant.
      avantDecisionMs: bloque ? 0 : avantDecisionMs,
      avantChangementDeCapMs: bloque ? 0 : avantChangementDeCapMs,
    },
  };
}

/** Les joueurs dont il se sauve: ceux a moins du rayon de fuite. */
function menacesDe(etat: EtatPartie, position: Position): readonly Position[] {
  return Object.values(etat.joueurs)
    .map((joueur) => joueur.position)
    .filter(
      (autre) => Math.hypot(autre.x - position.x, autre.y - position.y) < EVADE.RAYON_DE_FUITE_PX,
    );
}

/**
 * Le cap qui l'eloigne le plus de ses poursuivants sans le jeter dans un mur.
 *
 * Il essaie seize caps regulierement repartis, et regarde soixante pixels devant lui dans
 * chacun. Un cap qui bute sur un mur est ecarte. Parmi les autres, il prend celui dont le
 * point d'arrivee est le plus loin du poursuivant le plus proche, avec une petite preference
 * pour son cap actuel, pour ne pas hesiter d'un battement a l'autre. A egalite, l'ordre des
 * caps tranche: le choix ne depend d'aucun tirage.
 *
 * Aucun cap libre, il garde le sien: le mur l'arretera, et il reconsiderera au battement
 * suivant. C'est ainsi qu'on le coince.
 */
function capDeFuite(
  etat: EtatPartie,
  position: Position,
  capActuel: Vecteur,
  menaces: readonly Position[],
): Vecteur {
  let meilleur: Vecteur | undefined;
  let meilleurScore = -Infinity;

  for (let rang = 0; rang < EVADE.CAPS_ESSAYES; rang += 1) {
    const cap = capUnitaire((rang / EVADE.CAPS_ESSAYES) * 2 * Math.PI);
    const essai = {
      x: position.x + cap.x * EVADE.PORTEE_D_ESSAI_PX,
      y: position.y + cap.y * EVADE.PORTEE_D_ESSAI_PX,
    };

    if (!trajetTenable(etat.terrain, position, essai)) {
      continue;
    }

    const eloignement = Math.min(
      ...menaces.map((menace) => Math.hypot(menace.x - essai.x, menace.y - essai.y)),
    );
    const constance = cap.x * capActuel.x + cap.y * capActuel.y;
    const score = eloignement + constance * PREFERENCE_POUR_LE_CAP_ACTUEL_PX;

    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = cap;
    }
  }

  return meilleur ?? capActuel;
}

/** Ce que vaut, en pixels d'eloignement, garder exactement son cap actuel. */
const PREFERENCE_POUR_LE_CAP_ACTUEL_PX = 12;

/**
 * Un nouveau cap d'errance, a moins de quatre-vingt-dix degres du precedent, qui ne bute pas
 * sur un mur; un demi-tour si aucun ne convient en huit tirages. C'est la demarche des PNJ.
 */
function capDErrance(
  etat: EtatPartie,
  position: Position,
  capActuel: Vecteur,
): { readonly etat: EtatPartie; readonly cap: Vecteur; readonly avantChangementDeCapMs: number } {
  const angleActuel = Math.atan2(capActuel.y, capActuel.x);
  let alea = etat.alea;
  let cap: Vecteur = { x: -capActuel.x, y: -capActuel.y };

  for (let tentative = 0; tentative < 8; tentative += 1) {
    const ecart = reel(alea, -Math.PI / 2, Math.PI / 2);
    alea = ecart.alea;
    const essai = capUnitaire(angleActuel + ecart.valeur);
    const arrivee = {
      x: position.x + essai.x * EVADE.PORTEE_D_ESSAI_PX,
      y: position.y + essai.y * EVADE.PORTEE_D_ESSAI_PX,
    };

    if (trajetTenable(etat.terrain, position, arrivee)) {
      cap = essai;
      break;
    }
  }

  const duree = reel(alea, ERRANCE_MINIMUM_MS, ERRANCE_MAXIMUM_MS);

  return { etat: { ...etat, alea: duree.alea }, cap, avantChangementDeCapMs: duree.valeur };
}

/** Le vecteur unitaire d'un angle donne en radians. */
function capUnitaire(radians: number): Vecteur {
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

/** L'Evade, s'il est sur la carte en ce moment. */
export function evadeSurLaCarte(etat: EtatPartie): EvadeSurLaCarte | undefined {
  return etat.evade?.surLaCarte;
}

/**
 * Un joueur attrape l'Evade: il quitte la carte pour de bon, et le joueur porte le x2.
 *
 * Sans effet, le meme etat rendu, si l'Evade n'est pas sur la carte ou si le joueur n'est pas
 * dans la partie.
 */
export function attraperLEvade(etat: EtatPartie, joueurId: IdentifiantEntite): EtatPartie {
  const evade = etat.evade;
  const present = evade?.surLaCarte;

  if (evade === undefined || present === undefined || etat.joueurs[joueurId] === undefined) {
    return etat;
  }

  return {
    ...etat,
    evade: { ...evade, surLaCarte: undefined, passe: true, porteur: joueurId },
    evenements: [
      ...etat.evenements,
      { type: 'evadeAttrape', joueur: joueurId, position: present.position },
    ],
  };
}

/**
 * Un joueur capture ou tue le porteur du x2, et le lui prend (decision 5 du porteur du
 * projet). Sans effet si la victime ne le porte pas.
 */
export function cederLeDoubleur(
  etat: EtatPartie,
  victimeId: IdentifiantEntite,
  attaquantId: IdentifiantEntite,
): EtatPartie {
  const evade = etat.evade;

  if (evade?.porteur !== victimeId || victimeId === attaquantId) {
    return etat;
  }

  const evenement: EvenementPartie = { type: 'doubleurVole', par: attaquantId, de: victimeId };

  return {
    ...etat,
    evade: { ...evade, porteur: attaquantId },
    evenements: [...etat.evenements, evenement],
  };
}

/**
 * Un Black Ninja attrape le porteur du x2: le x2 est detruit, perdu pour tous (decision 7 du
 * porteur du projet). Sans effet si la victime ne le porte pas.
 */
export function perdreLeDoubleur(etat: EtatPartie, victimeId: IdentifiantEntite): EtatPartie {
  const evade = etat.evade;

  if (evade?.porteur !== victimeId) {
    return etat;
  }

  return {
    ...etat,
    evade: { ...evade, porteur: undefined },
    evenements: [...etat.evenements, { type: 'doubleurPerdu', de: victimeId }],
  };
}

/** Ce joueur porte-t-il le x2 ? */
export function porteLeDoubleur(etat: EtatPartie, joueurId: IdentifiantEntite): boolean {
  return etat.evade?.porteur !== undefined && etat.evade.porteur === joueurId;
}

/**
 * Par combien le score de ce joueur est multiplie: deux s'il porte le x2, un sinon.
 *
 * EN EQUIPES, le x2 double le score de toute l'equipe du porteur (decision 6 du porteur du
 * projet). Pour le moteur, une equipe est une couleur (etape 7.2): le score d'un joueur y
 * compte deja tous les ninjas de son equipe, et chaque membre de l'equipe du porteur voit
 * donc le sien double.
 */
export function multiplicateurDuScore(etat: EtatPartie, joueur: Joueur): number {
  const porteurId = etat.evade?.porteur;

  if (porteurId === undefined) {
    return 1;
  }

  if (porteurId === joueur.id) {
    return EVADE.MULTIPLICATEUR;
  }

  const porteur = etat.joueurs[porteurId];

  return etat.mode === 'equipes' && porteur !== undefined && porteur.couleur === joueur.couleur
    ? EVADE.MULTIPLICATEUR
    : 1;
}
