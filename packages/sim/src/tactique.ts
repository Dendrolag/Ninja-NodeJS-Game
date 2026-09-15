/**
 * Le mode Tactique: capturer par un cone, devant soi, avec des charges limitees.
 *
 * Etape 7.1. Portage de la capture par cone de la version 0.9.0 du jeu d'origine
 * (branche mode-strategique, commit 8a7b5fc: tacticalModeCollisions,
 * getEntitiesInCaptureRange, checkEntityInCone et updateCaptureAttempts). Cette
 * version n'est pas la base de reference du portage, qui est la v0.8.6: elle fait
 * foi sur l'intention du mode et sur ses valeurs, pas sur ses modalites. Les regles
 * ont ete tranchees par le porteur du projet le 12 septembre 2026.
 *
 * CE QUE FAIT UN JOUEUR DANS CE MODE. Il ne capture plus en touchant. Il regarde
 * dans une direction, celle de son dernier deplacement, et quand il tire, tout ce
 * que contient le cone devant lui est capture: les bots qui ne portent pas sa
 * couleur, et un joueur au plus, parce que le delai d'une seconde entre deux
 * captures de joueur vaut ici comme ailleurs. Un tir qui capture coute une charge;
 * un tir sans effet ne coute rien. Les charges reviennent une par une.
 *
 * CE QUE LE PORTAGE CHANGE, ET POURQUOI:
 *
 *   - Le tir se resout DANS LE BATTEMENT, pas a la reception du message. La v0.9.0
 *     le jouait des que startCapture arrivait: deux tirs croises se departageaient a
 *     la course au reseau, le defaut que contacts.ts decrit pour les duels du legacy.
 *     Ici, quand plusieurs joueurs tirent dans le meme battement, le generateur a
 *     graine tire l'ordre au sort, et un joueur capture par un tir precedent perd le
 *     sien.
 *   - Un joueur a l'arret vise encore, dans sa derniere orientation. La v0.9.0
 *     refusait le tir d'un joueur immobile.
 *   - Un tir sur un joueur protege, qui ne capture rien, ne coute rien. La v0.9.0
 *     debitait une charge des que le cone contenait une cible, meme intouchable.
 *   - La recharge avance par dt, et le reste d'une attente se reporte sur la
 *     suivante: le resultat ne depend pas du decoupage du temps. La v0.9.0 la
 *     verifiait sur une minuterie.
 *
 * OU VIT CET ETAT. L'orientation et les charges de chaque joueur sont rangees a
 * part, dans EtatPartie.tactique, et non dans Joueur. Une partie Classique n'a donc
 * pas ce champ du tout: son etat reste identique a l'octet a ce qu'il etait avant
 * l'arrivee du mode, et l'empreinte des parties (tests/charge/empreinte.ts) le
 * prouve.
 */

import type { Alea, Orientation, Position, Vecteur } from '@neon-ninja/shared';
import { TACTIQUE, entier } from '@neon-ninja/shared';

import { capturerBot, capturerJoueur } from './capture.js';
import type { EtatPartie, EtatTactiqueDuJoueur, IdentifiantEntite } from './etat.js';
import type { Entrees } from './moteur.js';

/** Le cosinus de la demi-ouverture du cone: 45 degres de chaque cote de l'orientation. */
const COSINUS_DU_DEMI_ANGLE = Math.cos((TACTIQUE.ANGLE_DU_CONE_DEGRES / 2) * (Math.PI / 180));

/**
 * Tolerance sur la comparaison des cosinus.
 *
 * La v0.9.0 comparait des angles en inegalite large: une cible exactement sur le bord
 * du cone y est. Calcule en flottants, ce bord tombe tantot d'un cote, tantot de
 * l'autre, le cosinus de 45 degres ne s'ecrivant pas exactement. Un milliardieme
 * garde le bord dans le cone sans y faire entrer quoi que ce soit de visible: il
 * correspond a un cent-millionieme de degre.
 */
const TOLERANCE = 1e-9;

const DIAGONALE = Math.SQRT1_2;

/** Le vecteur unitaire de chaque orientation. L'axe des y descend: le sud est vers le bas. */
const VECTEURS: Readonly<Record<Orientation, Vecteur>> = {
  nord: { x: 0, y: -1 },
  nord_est: { x: DIAGONALE, y: -DIAGONALE },
  est: { x: 1, y: 0 },
  sud_est: { x: DIAGONALE, y: DIAGONALE },
  sud: { x: 0, y: 1 },
  sud_ouest: { x: -DIAGONALE, y: DIAGONALE },
  ouest: { x: -1, y: 0 },
  nord_ouest: { x: -DIAGONALE, y: -DIAGONALE },
};

/** L'etat tactique d'un joueur qui n'a encore rien fait: tourne vers l'est, charges pleines. */
export const ETAT_TACTIQUE_DE_DEPART: EtatTactiqueDuJoueur = {
  orientation: TACTIQUE.ORIENTATION_DE_DEPART,
  charges: TACTIQUE.CHARGES_MAXIMUM,
  avantProchaineChargeMs: TACTIQUE.RECHARGE_MS,
};

/**
 * L'etat tactique d'un joueur.
 *
 * Un joueur qui n'a pas encore d'entree dans la table a l'etat de depart. C'est ce
 * qui evite de toucher a ajouterJoueur, commun a tous les modes.
 */
export function etatTactiqueDe(etat: EtatPartie, id: IdentifiantEntite): EtatTactiqueDuJoueur {
  return etat.tactique?.[id] ?? ETAT_TACTIQUE_DE_DEPART;
}

/**
 * Une cible est-elle dans le cone d'un tireur ?
 *
 * Deux conditions, bornes comprises, comme dans la v0.9.0 (checkEntityInCone): le
 * centre de la cible est a la portee au plus, et l'ecart d'angle entre l'orientation
 * du tireur et la direction de la cible est de la demi-ouverture au plus. Une cible
 * confondue avec le tireur est dans le cone: la v0.9.0 lui comptait un angle nul.
 */
export function dansLeCone(origine: Position, orientation: Orientation, cible: Position): boolean {
  const ecartX = cible.x - origine.x;
  const ecartY = cible.y - origine.y;
  const distance = Math.hypot(ecartX, ecartY);

  // Ecrit ainsi pour qu'une distance non numerique soit hors de portee.
  if (!(distance <= TACTIQUE.PORTEE_PX)) {
    return false;
  }

  if (distance === 0) {
    return true;
  }

  const vecteur = VECTEURS[orientation];
  const cosinus = (vecteur.x * ecartX + vecteur.y * ecartY) / distance;

  return cosinus >= COSINUS_DU_DEMI_ANGLE - TOLERANCE;
}

/**
 * Fait revenir les charges avec le temps ecoule.
 *
 * Une charge revient chaque fois que l'attente arrive a son terme, bornes comprises
 * comme dans la v0.9.0, et le reste de l'attente se reporte sur la suivante: vingt
 * battements de cinquante millisecondes rendent autant qu'un seul battement d'une
 * seconde. Un joueur aux charges pleines n'attend rien: son attente reste entiere, et
 * ne commence qu'a son prochain tir payant.
 */
export function recharger(courant: EtatTactiqueDuJoueur, dtMs: number): EtatTactiqueDuJoueur {
  let charges = courant.charges;
  let avant = courant.avantProchaineChargeMs;

  if (charges < TACTIQUE.CHARGES_MAXIMUM) {
    avant -= dtMs;

    while (avant <= 0 && charges < TACTIQUE.CHARGES_MAXIMUM) {
      charges += 1;
      avant += TACTIQUE.RECHARGE_MS;
    }
  }

  if (charges >= TACTIQUE.CHARGES_MAXIMUM) {
    avant = TACTIQUE.RECHARGE_MS;
  }

  return charges === courant.charges && avant === courant.avantProchaineChargeMs
    ? courant
    : { ...courant, charges, avantProchaineChargeMs: avant };
}

/**
 * Un joueur tire: tout ce que contient son cone est capture.
 *
 * Portage de tacticalModeCollisions (v0.9.0). Les cibles sont jugees sur les
 * positions d'avant le tir; les captures, elles, s'appliquent l'une apres l'autre,
 * par les fonctions de capture.ts, qui verifient chacune ce qu'elles permettent:
 * protection d'apparition, invincibilite, delai entre deux captures de joueur,
 * couleur deja portee. Les joueurs d'abord, puis les bots, comme dans la v0.9.0: les
 * bots d'une victime passent au tireur avant que le cone ne repeigne les autres. Les
 * bots noirs ne sont pas des cibles.
 *
 * Sans charge, le tir n'a pas lieu. Avec une charge, il a lieu et laisse un evenement
 * au journal, meme s'il ne capture rien; il ne coute la charge que s'il capture
 * quelque chose, et relance alors l'attente de la prochaine.
 */
export function tirer(etat: EtatPartie, tireurId: IdentifiantEntite): EtatPartie {
  return unTir(etat, tireurId).etat;
}

/** Ce qu'un tir laisse derriere lui. */
interface Tir {
  readonly etat: EtatPartie;
  /** Les joueurs captures par ce tir, qui viennent d'etre deplaces. */
  readonly victimes: readonly IdentifiantEntite[];
}

/** Joue un tir, et dit qui il a capture. Voir tirer. */
function unTir(etat: EtatPartie, tireurId: IdentifiantEntite): Tir {
  const tireur = etat.joueurs[tireurId];
  const arme = etatTactiqueDe(etat, tireurId);

  if (tireur === undefined || arme.charges <= 0) {
    return { etat, victimes: [] };
  }

  const { position } = tireur;
  const { orientation } = arme;
  const victimes: IdentifiantEntite[] = [];
  let courant = etat;
  let captures = 0;

  for (const cible of Object.values(etat.joueurs)) {
    if (cible.id !== tireurId && dansLeCone(position, orientation, cible.position)) {
      const apres = capturerJoueur(courant, tireurId, cible.id);

      if (apres !== courant) {
        victimes.push(cible.id);
        captures += 1;
        courant = apres;
      }
    }
  }

  for (const bot of Object.values(etat.bots)) {
    if (bot.type === 'bot' && dansLeCone(position, orientation, bot.position)) {
      const apres = capturerBot(courant, tireurId, bot.id);

      if (apres !== courant) {
        captures += 1;
        courant = apres;
      }
    }
  }

  const armeApres =
    captures > 0
      ? { ...arme, charges: arme.charges - 1, avantProchaineChargeMs: TACTIQUE.RECHARGE_MS }
      : arme;

  return {
    etat: {
      ...courant,
      tactique: { ...courant.tactique, [tireurId]: armeApres },
      evenements: [
        ...courant.evenements,
        { type: 'tirDeCapture', joueur: tireurId, position, orientation, captures },
      ],
    },
    victimes,
  };
}

/**
 * Ce que le mode Tactique fait a chaque battement, avant le releve des contacts.
 *
 * Dans cet ordre: chaque joueur prend l'orientation de son deplacement s'il s'est
 * deplace, ses charges reviennent avec le temps ecoule, puis les tirs demandes
 * partent. La table est reconstruite a partir des joueurs presents: celui qui a
 * quitte la partie en sort de lui-meme.
 *
 * La direction d'un joueur est celle de son deplacement effectif pendant ce
 * battement: un joueur arrete, ou bloque contre un mur, garde son orientation.
 */
export function agirEnTactique(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie {
  const table: Record<IdentifiantEntite, EtatTactiqueDuJoueur> = {};

  for (const joueur of Object.values(etat.joueurs)) {
    const avant = etatTactiqueDe(etat, joueur.id);
    const orientation = joueur.direction === 'immobile' ? avant.orientation : joueur.direction;

    table[joueur.id] = recharger(
      orientation === avant.orientation ? avant : { ...avant, orientation },
      dtMs,
    );
  }

  const tirage = ordreDesTirs(etat, entrees);
  const capturesDuBattement = new Set<IdentifiantEntite>();
  let courant: EtatPartie = { ...etat, tactique: table, alea: tirage.alea };

  for (const tireurId of tirage.ordre) {
    // Capture par un tir precedent, le joueur vient d'etre deplace: le tir qu'il
    // demandait visait depuis une place qu'il n'occupe plus.
    if (!capturesDuBattement.has(tireurId)) {
      const tir = unTir(courant, tireurId);
      courant = tir.etat;

      for (const victime of tir.victimes) {
        capturesDuBattement.add(victime);
      }
    }
  }

  return courant;
}

/**
 * Dans quel ordre partent les tirs d'un battement.
 *
 * Le premier tir peut capturer le second tireur: l'ordre decide donc de l'issue d'un
 * tir croise. Il est tire au sort par le generateur a graine, pour la raison qui fait
 * tirer au sort les duels de contacts.ts: « le premier arrive dans la partie tire le
 * premier » donnerait au meme joueur un avantage pendant toute la partie. Un seul
 * tireur ne consomme aucun tirage.
 */
function ordreDesTirs(
  etat: EtatPartie,
  entrees: Entrees,
): { readonly ordre: readonly IdentifiantEntite[]; readonly alea: Alea } {
  const ordre = Object.keys(etat.joueurs).filter((id) => entrees[id]?.capturer === true);
  let alea = etat.alea;

  for (let rang = ordre.length - 1; rang > 0; rang -= 1) {
    const tirage = entier(alea, rang + 1);
    const choisi = ordre[tirage.valeur] as IdentifiantEntite;

    ordre[tirage.valeur] = ordre[rang] as IdentifiantEntite;
    ordre[rang] = choisi;
    alea = tirage.alea;
  }

  return { ordre, alea };
}
