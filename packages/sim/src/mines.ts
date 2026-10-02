/**
 * La mine posee par un joueur, second objet de poche (etape 7.11).
 *
 * Aucune version du jeu d'origine n'avait de mine: ses regles sont celles que le porteur du
 * projet a tranchees le 28 septembre 2026 (docs/plan/etape-7-11.md). Les mines que pose la
 * carte, qui ouvrent les zones, sont une autre famille (etape 7.12).
 *
 * CE QUI SE DECIDE ICI:
 *
 *   - Se servir d'une mine en poche la pose au centre du ninja. Un joueur a trois mines
 *     posees au plus: la quatrieme chasse la plus ancienne. Elles restent quand il se fait
 *     capturer, et disparaissent quand il quitte la partie (retirerJoueur, etat.ts).
 *   - Posee, elle attend sans limite de temps. Un ADVERSAIRE du poseur ou un Black Ninja qui
 *     passe dessus l'arme; jamais le poseur, ses coequipiers, un faux ninja ni l'Evade. Un
 *     joueur protege l'arme comme un autre: seule l'explosion l'epargne.
 *   - Armee, elle saute 1,5 seconde plus tard, et touche tout ce qui est alors a 130 pixels
 *     au plus de son centre, pas seulement celui qui l'a armee. Une explosion ne declenche pas
 *     les autres mines.
 *   - Ce qu'elle fait a un adversaire depend du mode: 15 pour cent de ses ninjas redeviennent
 *     neutres en Horde, en Tactique et en Equipes, choisis comme face a un Black Ninja, et en
 *     Horde sa reserve perd la meme part et son combo retombe; en Massacre, elle le tue, et il
 *     cede la moitie de ses points au poseur; en Chasse, une proie perd 15 pour cent de ses
 *     points, un traqueur a son arme enrayee 3 secondes. Rien ne revient au poseur hors du
 *     Massacre: c'est un piege, pas une capture a distance. La victime reste ou elle est, sauf
 *     en Massacre, ou elle reapparait comme apres un coup de katana.
 *   - Les Black Ninjas pris dans le rayon meurent, et rapportent 15 points au poseur; en
 *     Massacre, elle tue aussi les faux ninjas, dix points chacun, et l'Evade, dont le x2 va
 *     au poseur. Aucun multiplicateur, aucun combo.
 *   - L'invincibilite et la protection d'apparition protegent de l'explosion.
 *
 * QUI EST ADVERSAIRE. Celui qu'un malus du poseur frapperait: tout autre joueur, l'equipe
 * adverse en Equipes, l'autre camp en Chasse (VictimeDuMalus, le jeu de regles du mode). La
 * question se pose au moment ou elle se pose, a partir du poseur tel qu'il est alors: une
 * proie infectee voit ses mines epargner les traqueurs et frapper les proies.
 *
 * L'ORDRE DU BATTEMENT. Les mines se posent avec les poches, avant tout le reste (poche.ts).
 * Elles s'arment et sautent apres que le mode a agi, avant le releve des contacts (tick, dans
 * moteur.ts): d'abord les mines deja armees se rapprochent de leur explosion, et sautent si
 * leur heure est venue, puis les contacts du battement arment les autres. Une mine armee dans
 * un battement ne perd rien de son delai dans ce battement.
 *
 * AUCUN TIRAGE SANS MINE. Une partie ou personne n'en pose n'a pas de champ minesPosees, et
 * ce module lui rend son etat tel quel.
 */

import type { Position, ToucheParUneMine } from '@neon-ninja/shared';
import { COULEUR_BOT_NEUTRE, MINES, SCORE } from '@neon-ninja/shared';

import type { PerteFaceAuBotNoir } from './bots.js';
import { amputerLeParcours, enrayerLArme, estTraqueur } from './chasse.js';
import type { Bot, EtatPartie, IdentifiantEntite, Joueur, MineSurLaCarte } from './etat.js';
import { avecLesMines, estInvulnerable, retirerBot } from './etat.js';
import { attraperLEvade, evadeSurLaCarte } from './evade.js';
import { amputerLaReserve } from './horde.js';
import {
  nombreDeBotsOrdinaires,
  tuerParUneMine,
  tuerUnBotParUneMine,
  viderLaCarteSiElleEstVide,
} from './massacre.js';
import type { VictimeDuMalus } from './objets.js';
import { sansPoche } from './poche.js';

/** Ce que le mode decide pour une mine: qui est adversaire, et quels ninjas il perd. */
export interface ReglesDesMines {
  readonly victimeDuMalus: VictimeDuMalus;
  readonly perteFaceAuBotNoir: PerteFaceAuBotNoir;
}

/**
 * Le joueur pose la mine qu'il a en poche, sous ses pieds, et vide sa poche. S'il avait deja
 * trois mines posees, la plus ancienne disparait.
 */
export function poserUneMine(etat: EtatPartie, joueur: Joueur): EtatPartie {
  const id = `mine-${String(etat.compteurIdentifiants)}`;
  const siennes = Object.values(etat.minesPosees ?? {}).filter((mine) => mine.poseur === joueur.id);
  const chassees = new Set(
    siennes
      .slice(0, Math.max(siennes.length - MINES.PLAFOND_PAR_JOUEUR + 1, 0))
      .map((mine) => mine.id),
  );
  const gardees = Object.fromEntries(
    Object.entries(etat.minesPosees ?? {}).filter(([cle]) => !chassees.has(cle)),
  );
  const posee: MineSurLaCarte = { id, poseur: joueur.id, position: joueur.position };

  return {
    ...avecLesMines(etat, { ...gardees, [id]: posee }),
    compteurIdentifiants: etat.compteurIdentifiants + 1,
    joueurs: { ...etat.joueurs, [joueur.id]: sansPoche(joueur) },
    evenements: [
      ...etat.evenements,
      { type: 'minePosee', joueur: joueur.id, mine: id, position: joueur.position },
    ],
  };
}

/**
 * Les mines d'un battement: celles qui sont armees se rapprochent de leur explosion et
 * sautent a leur heure, puis celles qu'une entite touche s'arment.
 *
 * @param horsJeu Les joueurs hors jeu (les traqueurs elimines, en Chasse): ils n'arment rien
 *                et rien ne les touche.
 */
export function avancerLesMines(
  etat: EtatPartie,
  dtMs: number,
  regles: ReglesDesMines,
  horsJeu: ReadonlySet<IdentifiantEntite>,
): EtatPartie {
  if (etat.minesPosees === undefined) {
    return etat;
  }

  return armerLesMines(
    faireSauterLesMines(etat, etat.minesPosees, dtMs, regles, horsJeu),
    regles,
    horsJeu,
  );
}

/** Les mines armees se rapprochent de leur explosion; celles dont l'heure est venue sautent. */
function faireSauterLesMines(
  etat: EtatPartie,
  posees: Readonly<Record<IdentifiantEntite, MineSurLaCarte>>,
  dtMs: number,
  regles: ReglesDesMines,
  horsJeu: ReadonlySet<IdentifiantEntite>,
): EtatPartie {
  // Aucune mine armee: rien ne change, et la table n'est pas recopiee.
  if (Object.values(posees).every((mine) => mine.avantExplosionMs === undefined)) {
    return etat;
  }

  const mines: Record<IdentifiantEntite, MineSurLaCarte> = {};
  const aFaireSauter: MineSurLaCarte[] = [];

  for (const [id, mine] of Object.entries(posees)) {
    if (mine.avantExplosionMs === undefined) {
      mines[id] = mine;
      continue;
    }

    const avantExplosionMs = mine.avantExplosionMs - dtMs;

    if (avantExplosionMs > 0) {
      mines[id] = { ...mine, avantExplosionMs };
    } else {
      aFaireSauter.push(mine);
    }
  }

  // Les mines qui sautent quittent la carte avant de sauter: aucune n'en declenche une
  // autre, et chacune touche ce qui est la au moment ou elle saute, dans l'ordre de la pose.
  let courant = avecLesMines(etat, mines);

  for (const mine of aFaireSauter) {
    courant = exploser(courant, mine, regles, horsJeu);
  }

  return courant;
}

/** Les mines qui attendent et qu'une entite qui la declenche touche s'arment. */
function armerLesMines(
  etat: EtatPartie,
  regles: ReglesDesMines,
  horsJeu: ReadonlySet<IdentifiantEntite>,
): EtatPartie {
  if (etat.minesPosees === undefined) {
    return etat;
  }

  const mines: Record<IdentifiantEntite, MineSurLaCarte> = {};
  const evenements = [...etat.evenements];
  // Les Black Ninjas, releves une fois pour toutes les mines: une mine n'a pas a parcourir
  // tous les faux ninjas de la carte pour les trouver.
  const botsNoirs = Object.values(etat.bots).filter((bot) => bot.type === 'botNoir');
  let arme = false;

  for (const [id, mine] of Object.entries(etat.minesPosees)) {
    const par =
      mine.avantExplosionMs === undefined
        ? quiLArme(etat, mine, regles, horsJeu, botsNoirs)
        : undefined;

    if (par === undefined) {
      mines[id] = mine;
      continue;
    }

    arme = true;
    mines[id] = { ...mine, avantExplosionMs: MINES.DELAI_AVANT_EXPLOSION_MS };
    evenements.push({
      type: 'mineArmee',
      mine: id,
      poseur: mine.poseur,
      par,
      position: mine.position,
    });
  }

  // Aucune mine armee dans ce battement: l'etat est rendu tel quel, sans copie.
  return arme ? { ...etat, minesPosees: mines, evenements } : etat;
}

/**
 * L'entite qui arme cette mine dans ce battement, s'il y en a une: le premier adversaire du
 * poseur qui la touche, dans l'ordre des joueurs, sinon le premier Black Ninja.
 */
function quiLArme(
  etat: EtatPartie,
  mine: MineSurLaCarte,
  regles: ReglesDesMines,
  horsJeu: ReadonlySet<IdentifiantEntite>,
  botsNoirs: readonly Bot[],
): IdentifiantEntite | undefined {
  const poseur = etat.joueurs[mine.poseur];

  if (poseur === undefined) {
    return undefined;
  }

  for (const joueur of Object.values(etat.joueurs)) {
    if (
      surLaMine(joueur.position, mine.position) &&
      estAdversaire(poseur, joueur, regles, horsJeu)
    ) {
      return joueur.id;
    }
  }

  for (const bot of botsNoirs) {
    if (surLaMine(bot.position, mine.position)) {
      return bot.id;
    }
  }

  return undefined;
}

/**
 * Cette entite touche-t-elle la mine ? Une entite eloignee d'au moins le seuil sur un axe
 * est ecartee sans calculer sa distance, comme dans le releve des contacts (contacts.ts): la
 * distance n'est jamais plus petite que l'ecart sur un axe. Le resultat est le meme.
 */
function surLaMine(entite: Position, mine: Position): boolean {
  const ecartX = entite.x - mine.x;
  const ecartY = entite.y - mine.y;
  const seuil = MINES.SEUIL_ARMEMENT_PX;

  if (ecartX >= seuil || ecartX <= -seuil || ecartY >= seuil || ecartY <= -seuil) {
    return false;
  }

  return Math.hypot(ecartX, ecartY) < seuil;
}

/** Ce joueur est-il, en ce moment, un adversaire du poseur, en jeu ? */
function estAdversaire(
  poseur: Joueur,
  joueur: Joueur,
  regles: ReglesDesMines,
  horsJeu: ReadonlySet<IdentifiantEntite>,
): boolean {
  return (
    joueur.id !== poseur.id && !horsJeu.has(joueur.id) && regles.victimeDuMalus(poseur, joueur)
  );
}

/** Ce qu'une explosion accumule pour son fait au journal. */
interface Bilan {
  readonly etat: EtatPartie;
  readonly touches: readonly ToucheParUneMine[];
  readonly botsNoirsTues: number;
  readonly botsTues: number;
  readonly points: number;
}

/**
 * Une mine saute: elle touche les adversaires de son poseur dans son rayon, puis les Black
 * Ninjas, puis, en Massacre, les faux ninjas et l'Evade. Les positions sont celles d'avant
 * l'explosion: une victime tuee en Massacre qui reapparait ailleurs ne change pas ce qu'elle
 * touche ensuite.
 *
 * Une mine dont le poseur n'est plus dans la partie disparait sans sauter. Cela ne se
 * produit pas: ses mines partent avec lui.
 */
function exploser(
  etat: EtatPartie,
  mine: MineSurLaCarte,
  regles: ReglesDesMines,
  horsJeu: ReadonlySet<IdentifiantEntite>,
): EtatPartie {
  const poseur = etat.joueurs[mine.poseur];

  if (poseur === undefined) {
    return etat;
  }

  const botsAvant = nombreDeBotsOrdinaires(etat);
  let bilan: Bilan = { etat, touches: [], botsNoirsTues: 0, botsTues: 0, points: 0 };

  for (const joueur of Object.values(etat.joueurs)) {
    if (
      estAdversaire(poseur, joueur, regles, horsJeu) &&
      !estInvulnerable(joueur) &&
      dansLeRayon(mine, joueur.position)
    ) {
      bilan = toucherUnJoueur(bilan, poseur.id, joueur, regles);
    }
  }

  for (const bot of Object.values(etat.bots)) {
    if (dansLeRayon(mine, bot.position)) {
      bilan = toucherUnBot(bilan, poseur.id, bot);
    }
  }

  const evade = evadeSurLaCarte(etat);
  const avecLEvade =
    etat.mode === 'massacre' && evade !== undefined && dansLeRayon(mine, evade.position)
      ? attraperLEvade(bilan.etat, poseur.id)
      : bilan.etat;
  const apres = viderLaCarteSiElleEstVide(
    {
      ...avecLEvade,
      evenements: [
        ...avecLEvade.evenements,
        {
          type: 'mineExplosee',
          mine: mine.id,
          poseur: poseur.id,
          position: mine.position,
          touches: bilan.touches,
          botsNoirsTues: bilan.botsNoirsTues,
          botsTues: bilan.botsTues,
          points: bilan.points,
        },
      ],
    },
    botsAvant,
  );

  return apres;
}

/** Ce que l'explosion fait a un adversaire du poseur, selon le mode. */
function toucherUnJoueur(
  bilan: Bilan,
  poseurId: IdentifiantEntite,
  victime: Joueur,
  regles: ReglesDesMines,
): Bilan {
  const etat = bilan.etat;
  const pourCent = MINES.PART_PERDUE_POUR_CENT;

  switch (etat.mode) {
    case 'massacre': {
      const mort = tuerParUneMine(etat, poseurId, victime.id);
      return {
        ...bilan,
        etat: mort.etat,
        touches: [
          ...bilan.touches,
          { joueur: victime.id, effet: 'tue', quantite: mort.pointsVoles },
        ],
        points: bilan.points + mort.pointsVoles,
      };
    }
    case 'chasse': {
      if (estTraqueur(etat, victime.id)) {
        return {
          ...bilan,
          etat: enrayerLArme(etat, victime.id, MINES.ENRAYEMENT_MS),
          touches: [
            ...bilan.touches,
            { joueur: victime.id, effet: 'armeEnrayee', quantite: MINES.ENRAYEMENT_MS },
          ],
        };
      }

      const amputee = amputerLeParcours(etat, victime.id, pourCent);
      return {
        ...bilan,
        etat: amputee.etat,
        touches: [
          ...bilan.touches,
          { joueur: victime.id, effet: 'pointsPerdus', quantite: amputee.pointsPerdus },
        ],
      };
    }
    default: {
      // Lue dans l'etat courant: une explosion precedente a pu lui retirer des ninjas.
      const courante = etat.joueurs[victime.id] as Joueur;
      const perdus = regles.perteFaceAuBotNoir(etat, courante, pourCent);
      const bots = { ...etat.bots };

      for (const bot of perdus) {
        bots[bot.id] = { ...bot, couleur: COULEUR_BOT_NEUTRE };
      }

      return {
        ...bilan,
        etat: amputerLaReserve({ ...etat, bots }, victime.id, pourCent),
        touches: [
          ...bilan.touches,
          { joueur: victime.id, effet: 'ninjasPerdus', quantite: perdus.length },
        ],
      };
    }
  }
}

/**
 * Ce que l'explosion fait a un bot: un Black Ninja meurt dans tous les modes, et rapporte
 * quinze points au poseur; un faux ninja ne meurt qu'en Massacre. L'Evade n'est pas un bot.
 */
function toucherUnBot(bilan: Bilan, poseurId: IdentifiantEntite, bot: Bot): Bilan {
  const etat = bilan.etat;

  if (etat.mode === 'massacre') {
    const mort = tuerUnBotParUneMine(etat, poseurId, bot);
    const noir = bot.type === 'botNoir';

    return {
      ...bilan,
      etat: mort.etat,
      botsNoirsTues: bilan.botsNoirsTues + (noir ? 1 : 0),
      botsTues: bilan.botsTues + (noir ? 0 : 1),
      points: bilan.points + mort.points,
    };
  }

  if (bot.type !== 'botNoir') {
    return bilan;
  }

  // Les quinze points d'un Black Ninja detruit se comptent, hors du Massacre, par le nombre
  // de Black Ninjas detruits du joueur (score.ts), comme pour l'invincibilite.
  const sansLui = retirerBot(etat, bot.id);
  const poseur = sansLui.joueurs[poseurId] as Joueur;

  return {
    ...bilan,
    etat: {
      ...sansLui,
      joueurs: {
        ...sansLui.joueurs,
        [poseurId]: { ...poseur, botsNoirsDetruits: poseur.botsNoirsDetruits + 1 },
      },
    },
    botsNoirsTues: bilan.botsNoirsTues + 1,
    points: bilan.points + SCORE.POINTS_PAR_BOT_NOIR,
  };
}

/** Ce point est-il dans le rayon de l'explosion ? */
function dansLeRayon(mine: MineSurLaCarte, position: Position): boolean {
  return distance(mine.position, position) <= MINES.RAYON_EXPLOSION_PX;
}

/** Distance entre deux positions, en pixels. */
function distance(une: Position, autre: Position): number {
  return Math.hypot(une.x - autre.x, une.y - autre.y);
}
