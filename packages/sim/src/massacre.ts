/**
 * Le mode Massacre: plus de capture, un coup de katana tue ce qu'il balaie, et les morts
 * enchainees font monter les points.
 *
 * Etape 7.4. Aucune version du jeu d'origine n'avait ce mode: ses regles sont celles que le
 * porteur du projet a tranchees le 16 septembre 2026 (docs/plan/etape-7-4.md).
 *
 * CE QUI SE DECIDE ICI:
 *
 *   - Un joueur frappe devant lui, dans la direction de son dernier deplacement: un arc de
 *     160 degres sur 60 pixels, toutes les 400 millisecondes au plus. Tout ce que l'arc
 *     contient meurt: les bots, les Black Ninjas, et un joueur au plus, le delai d'une
 *     seconde entre deux joueurs tues valant ici comme le delai entre deux captures.
 *   - Un bot tue vaut dix points, un Black Ninja quinze, fois le multiplicateur du combo.
 *     Une mort qui suit la precedente de deux secondes au plus prolonge le combo, et le
 *     multiplicateur monte d'un cran toutes les cinq morts, jusqu'a cinq.
 *   - Un joueur tue perd son combo et la moitie de ses points, qui vont a son tueur. Il
 *     reapparait ailleurs, protege.
 *   - Un joueur attrape par un Black Ninja perd son combo et la part reglee de ses points.
 *   - La carte se vide: quand le dernier bot tombe, chaque joueur recoit cinq points par
 *     seconde restante, et la partie est decidee.
 *
 * OU VIT CET ETAT. Dans EtatPartie.massacre, pose au lancement: une partie d'un autre mode
 * n'a pas ce champ, et l'empreinte des parties le prouve. Les points s'y rangent, parce
 * qu'ils ne se deduisent plus de rien: les bots tues ont disparu.
 *
 * Toucher ne produit rien dans ce mode (regleMassacre, dans contacts.ts): le katana est la
 * seule arme, et l'invincibilite ne fait que proteger.
 */

import type { Orientation } from '@neon-ninja/shared';
import { DUREES, MASSACRE, TACTIQUE, multiplicateurDuCombo } from '@neon-ninja/shared';

import type { PerteFaceAuBotNoir } from './bots.js';
import { inscrireAuJournal } from './capture.js';
import type {
  Bot,
  EtatDeMassacre,
  EtatPartie,
  GuerrierEnMassacre,
  IdentifiantEntite,
  Joueur,
  MortParLeKatana,
} from './etat.js';
import {
  estInvulnerable,
  peutCapturer,
  positionDApparition,
  positionsOccupees,
  retirerBot,
} from './etat.js';
import type { Entrees } from './moteur.js';
import { dansLeCone, geometrieDuCone, ordreDesTirs } from './tactique.js';

/** L'arc du katana: 160 degres sur 60 pixels. */
export const CONE_DU_KATANA = geometrieDuCone(
  MASSACRE.ANGLE_DU_KATANA_DEGRES,
  MASSACRE.PORTEE_DU_KATANA_PX,
);

/** Ce que retient un joueur qui n'a encore rien fait: tourne vers l'est, pret a frapper. */
export const GUERRIER_DE_DEPART: GuerrierEnMassacre = {
  orientation: TACTIQUE.ORIENTATION_DE_DEPART,
  avantProchainCoupMs: 0,
  points: 0,
  combo: 0,
  avantFinDuComboMs: 0,
  botsTues: 0,
};

/**
 * Ce que retient un joueur du Massacre.
 *
 * Un joueur qui n'a pas encore d'entree dans la table, parce qu'il est entre en cours de
 * partie, a l'etat de depart.
 */
export function guerrierDe(etat: EtatPartie, id: IdentifiantEntite): GuerrierEnMassacre {
  return etat.massacre?.guerriers[id] ?? GUERRIER_DE_DEPART;
}

/** Les points d'un joueur en Massacre: ceux que l'etat range pour lui. */
export function pointsEnMassacre(etat: EtatPartie, joueur: Joueur): number {
  return guerrierDe(etat, joueur.id).points;
}

/**
 * Le multiplicateur d'un combo de tant de morts. La regle vit dans packages/shared, pour
 * que la page la lise comme le moteur; elle est republiee ici sous le meme nom.
 */
export { multiplicateurDuCombo };

/**
 * Lance un Massacre: chaque joueur present recoit l'etat de depart.
 *
 * Aucun tirage. Les bots sont deja poses: le serveur peuple la carte avant de lancer.
 */
export function lancerLeMassacre(etat: EtatPartie): EtatPartie {
  const guerriers = Object.fromEntries(
    Object.keys(etat.joueurs).map((id) => [id, GUERRIER_DE_DEPART]),
  );

  return { ...etat, massacre: { guerriers, carteVidee: false } };
}

/**
 * Ce que perd un joueur attrape par un Black Ninja, en bots: aucun.
 *
 * Les bots n'appartiennent a personne dans ce mode. La perte de points et de combo
 * s'applique dans agirEnMassacre, qui lit les prises du battement.
 */
export const perteEnMassacre: PerteFaceAuBotNoir = () => [];

/**
 * Ce que le Massacre fait a chaque battement, une fois tout le monde deplace et avant le
 * releve des contacts.
 *
 *   1. Chaque joueur s'oriente, voit approcher son prochain coup, et son combo s'epuiser.
 *   2. Les joueurs attrapes par un Black Ninja pendant ce battement perdent leur combo et la
 *      part reglee de leurs points. Les Black Ninjas ont avance juste avant, dans le meme
 *      battement: leurs prises sont au journal.
 *   3. Les coups demandes partent, dans un ordre tire au sort.
 *   4. Si ces coups ont tue le dernier bot, la carte est videe.
 *
 * Un Massacre qui n'est pas lance n'a rien a faire.
 */
export function agirEnMassacre(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie {
  if (etat.massacre === undefined) {
    return etat;
  }

  const botsAvant = nombreDeBotsOrdinaires(etat);
  let courant = subirLesBotsNoirs(avancerLesGuerriers(etat, dtMs));
  const tirage = ordreDesTirs(courant, entrees);
  const tues = new Set<IdentifiantEntite>();
  courant = { ...courant, alea: tirage.alea };

  for (const id of tirage.ordre) {
    // Tue par un coup precedent, le joueur vient de reapparaitre ailleurs: le coup qu'il
    // demandait partait d'une place qu'il n'occupe plus.
    if (!tues.has(id)) {
      const coup = frapper(courant, id);
      courant = coup.etat;

      if (coup.victime !== undefined) {
        tues.add(coup.victime);
      }
    }
  }

  return botsAvant > 0 && nombreDeBotsOrdinaires(courant) === 0 ? viderLaCarte(courant) : courant;
}

/**
 * L'orientation, l'attente du prochain coup et la fenetre du combo de chaque joueur, apres
 * un battement de dtMs.
 *
 * La table est reconstruite a partir des joueurs presents: celui qui a quitte la partie en
 * sort de lui-meme. Le combo ne retombe qu'une fois sa fenetre DEPASSEE: une mort qui suit
 * la precedente d'exactement deux secondes le prolonge encore.
 */
function avancerLesGuerriers(etat: EtatPartie, dtMs: number): EtatPartie {
  const guerriers: Record<IdentifiantEntite, GuerrierEnMassacre> = {};

  for (const joueur of Object.values(etat.joueurs)) {
    const avant = guerrierDe(etat, joueur.id);
    const restant = avant.avantFinDuComboMs - dtMs;
    const comboTombe = restant < 0;

    guerriers[joueur.id] = {
      ...avant,
      orientation: joueur.direction === 'immobile' ? avant.orientation : joueur.direction,
      avantProchainCoupMs: Math.max(avant.avantProchainCoupMs - dtMs, 0),
      combo: comboTombe ? 0 : avant.combo,
      avantFinDuComboMs: comboTombe ? 0 : restant,
    };
  }

  return { ...etat, massacre: { ...massacreDe(etat), guerriers } };
}

/**
 * Les joueurs attrapes par un Black Ninja pendant ce battement perdent leur combo et la part
 * reglee de leurs points, arrondie en dessous (decision 6 du porteur du projet).
 */
function subirLesBotsNoirs(etat: EtatPartie): EtatPartie {
  let courant = etat;

  for (const evenement of etat.evenements) {
    if (evenement.type === 'captureParBotNoir' && etat.joueurs[evenement.victime] !== undefined) {
      const guerrier = guerrierDe(courant, evenement.victime);
      const perdus = part(guerrier.points, etat.reglages.botsNoirs.partDeBotsPerduePourCent);

      courant = equiper(courant, evenement.victime, {
        ...guerrier,
        points: guerrier.points - perdus,
        combo: 0,
        avantFinDuComboMs: 0,
      });
    }
  }

  return courant;
}

/** Ce qu'un coup laisse derriere lui. */
interface Coup {
  readonly etat: EtatPartie;
  /** Le joueur tue par ce coup, qui vient de reapparaitre ailleurs. */
  readonly victime: IdentifiantEntite | undefined;
}

/**
 * Un joueur donne un coup de katana, s'il le peut.
 *
 * Les cibles sont jugees sur les positions d'avant le coup. Les joueurs d'abord, comme les
 * tirs du Tactique: un seul au plus, le delai d'une seconde entre deux joueurs tues
 * refusant le suivant. Puis les bots et les Black Ninjas, dans l'ordre de l'etat. Le coup a
 * lieu meme dans le vide: il relance l'attente, et le journal le dit.
 */
export function frapper(etat: EtatPartie, id: IdentifiantEntite): Coup {
  const joueur = etat.joueurs[id];

  if (joueur === undefined || guerrierDe(etat, id).avantProchainCoupMs > 0) {
    return { etat, victime: undefined };
  }

  const { position } = joueur;
  const { orientation } = guerrierDe(etat, id);
  let courant = equiper(etat, id, {
    ...guerrierDe(etat, id),
    avantProchainCoupMs: MASSACRE.DELAI_ENTRE_COUPS_MS,
  });
  let victime: IdentifiantEntite | undefined;

  for (const cible of Object.values(etat.joueurs)) {
    if (
      victime === undefined &&
      cible.id !== id &&
      dansLeCone(position, orientation, cible.position, CONE_DU_KATANA)
    ) {
      const apres = tuerUnJoueur(courant, id, cible.id, orientation);

      if (apres !== courant) {
        victime = cible.id;
        courant = apres;
      }
    }
  }

  const morts: MortParLeKatana[] = [];

  for (const bot of Object.values(etat.bots)) {
    if (dansLeCone(position, orientation, bot.position, CONE_DU_KATANA)) {
      const mort = tuerUnBot(courant, id, bot);
      courant = mort.etat;
      morts.push(mort.mort);
    }
  }

  const apres = guerrierDe(courant, id);

  return {
    etat: {
      ...courant,
      evenements: [
        ...courant.evenements,
        {
          type: 'coupDeKatana',
          joueur: id,
          position,
          orientation,
          morts,
          combo: apres.combo,
          multiplicateur: multiplicateurDuCombo(apres.combo),
        },
      ],
    },
    victime,
  };
}

/**
 * Un joueur tue un bot ou un Black Ninja: il le retire de la carte, prolonge son combo, et
 * gagne sa valeur fois le multiplicateur atteint. Un Black Ninja tue compte aussi comme
 * detruit.
 *
 * Le bot est lu dans l'etat d'avant le coup: seul ce coup retire des bots, chacun une fois.
 * Le joueur, lui, est dans l'etat courant, ou il ne peut pas manquer: un coup ne deplace
 * que sa victime.
 */
function tuerUnBot(
  etat: EtatPartie,
  id: IdentifiantEntite,
  bot: Bot,
): { readonly etat: EtatPartie; readonly mort: MortParLeKatana } {
  const botId = bot.id;
  const joueur = etat.joueurs[id] as Joueur;
  const noir = bot.type === 'botNoir';
  const guerrier = guerrierDe(etat, id);
  const combo = guerrier.combo + 1;
  const valeur = noir ? MASSACRE.POINTS_PAR_BOT_NOIR : MASSACRE.POINTS_PAR_BOT;
  const points = valeur * multiplicateurDuCombo(combo);
  const sansLeBot = retirerBot(etat, botId);
  const equipe = equiper(sansLeBot, id, {
    ...guerrier,
    points: guerrier.points + points,
    combo,
    avantFinDuComboMs: MASSACRE.FENETRE_DU_COMBO_MS,
    botsTues: guerrier.botsTues + 1,
  });

  return {
    etat: noir
      ? {
          ...equipe,
          joueurs: {
            ...equipe.joueurs,
            [id]: { ...joueur, botsNoirsDetruits: joueur.botsNoirsDetruits + 1 },
          },
        }
      : equipe,
    mort: { bot: botId, noir, position: bot.position, points },
  };
}

/**
 * Un joueur en tue un autre.
 *
 * Permis si la victime n'est ni protegee ni invincible, et si le tueur a laisse passer une
 * seconde depuis son dernier joueur tue. La victime perd son combo et la moitie de ses
 * points, arrondie en dessous, qui s'ajoutent tels quels a son tueur, sans multiplicateur
 * et sans prolonger son combo. Elle garde sa couleur, et reapparait ailleurs avec une
 * protection neuve. Les compteurs et le journal des captures avancent comme pour une
 * capture.
 *
 * Renvoie l'etat inchange, le meme objet, si la mise a mort n'est pas permise.
 */
export function tuerUnJoueur(
  etat: EtatPartie,
  tueurId: IdentifiantEntite,
  victimeId: IdentifiantEntite,
  orientation: Orientation,
): EtatPartie {
  const tueur = etat.joueurs[tueurId];
  const victime = etat.joueurs[victimeId];

  if (
    tueur === undefined ||
    victime === undefined ||
    tueurId === victimeId ||
    estInvulnerable(victime) ||
    !peutCapturer(tueur)
  ) {
    return etat;
  }

  const volee = guerrierDe(etat, victimeId);
  const armee = guerrierDe(etat, tueurId);
  const pointsVoles = part(volee.points, MASSACRE.PART_VOLEE_POUR_CENT);
  const place = positionDApparition(etat.alea, etat.terrain, positionsOccupees(etat));

  const joueurs: Record<IdentifiantEntite, Joueur> = {
    ...etat.joueurs,
    [tueurId]: {
      ...tueur,
      captures: tueur.captures + 1,
      joueursCaptures: inscrireAuJournal(tueur.joueursCaptures, victimeId, victime.pseudo),
      tempsDepuisDerniereCaptureMs: 0,
    },
    [victimeId]: {
      ...victime,
      position: place.valeur,
      direction: 'immobile',
      protectionSpawnRestanteMs: DUREES.PROTECTION_SPAWN_MS,
      capturesSubies: inscrireAuJournal(victime.capturesSubies, tueurId, tueur.pseudo),
    },
  };
  const massacre = massacreDe(etat);

  return {
    ...etat,
    joueurs,
    massacre: {
      ...massacre,
      guerriers: {
        ...massacre.guerriers,
        [tueurId]: { ...armee, points: armee.points + pointsVoles },
        [victimeId]: {
          ...volee,
          points: volee.points - pointsVoles,
          combo: 0,
          avantFinDuComboMs: 0,
        },
      },
    },
    evenements: [
      ...etat.evenements,
      {
        type: 'joueurTranche',
        attaquant: tueurId,
        victime: victimeId,
        position: victime.position,
        orientation,
        pointsVoles,
      },
    ],
    alea: place.alea,
  };
}

/**
 * Le dernier bot est tombe: chaque joueur present recoit cinq points par seconde entiere
 * restante, et la partie est decidee.
 */
function viderLaCarte(etat: EtatPartie): EtatPartie {
  const tempsRestantMs = Math.max(etat.dureeMs - etat.tempsEcouleMs, 0);
  const bonus = Math.floor(tempsRestantMs / 1000) * MASSACRE.POINTS_PAR_SECONDE_RESTANTE;
  const guerriers: Record<IdentifiantEntite, GuerrierEnMassacre> = {};

  for (const id of Object.keys(etat.joueurs)) {
    const guerrier = guerrierDe(etat, id);
    guerriers[id] = { ...guerrier, points: guerrier.points + bonus };
  }

  return {
    ...etat,
    massacre: { guerriers, carteVidee: true },
    evenements: [...etat.evenements, { type: 'carteVidee', tempsRestantMs, bonus }],
  };
}

/**
 * Le Massacre est-il decide avant le terme ? Oui, une fois la carte videe. Un Massacre au
 * salon ne l'est jamais.
 */
export function massacreDecide(etat: EtatPartie): boolean {
  return etat.massacre?.carteVidee === true;
}

/** Le Massacre d'un etat, ou un Massacre vide s'il n'est pas lance. */
function massacreDe(etat: EtatPartie): EtatDeMassacre {
  return etat.massacre ?? { guerriers: {}, carteVidee: false };
}

/** Remplace ce que retient un joueur. */
function equiper(
  etat: EtatPartie,
  id: IdentifiantEntite,
  guerrier: GuerrierEnMassacre,
): EtatPartie {
  const massacre = massacreDe(etat);

  return {
    ...etat,
    massacre: { ...massacre, guerriers: { ...massacre.guerriers, [id]: guerrier } },
  };
}

/** Combien de bots ordinaires restent sur la carte. Les Black Ninjas n'en sont pas. */
function nombreDeBotsOrdinaires(etat: EtatPartie): number {
  let nombre = 0;

  for (const bot of Object.values(etat.bots)) {
    if (bot.type === 'bot') {
      nombre += 1;
    }
  }

  return nombre;
}

/** Une part en pour cent d'un nombre de points, arrondie en dessous. */
function part(points: number, pourCent: number): number {
  return Math.floor((points * pourCent) / 100);
}
