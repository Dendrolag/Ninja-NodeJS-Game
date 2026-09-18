/**
 * Le combo de la Horde, le mode d'identifiant `classique`: les faux ninjas rallies a la
 * suite font monter un multiplicateur, et chaque ralliement au-dela de x1 ajoute une prime.
 *
 * Etape 7.5. Le jeu d'origine n'avait pas de combo: ses regles sont celles que le porteur du
 * projet a tranchees le 18 septembre 2026 (docs/plan/etape-7-5.md).
 *
 * CE QUI SE DECIDE ICI:
 *
 *   - Un joueur qui touche lui-meme un faux ninja, et le fait passer a sa couleur, le
 *     rallie: son combo avance d'un ninja, qu'il ait ete neutre ou a un autre joueur. La
 *     contagion entre ninjas repeint comme avant, sans combo.
 *   - La regle du combo est celle du Massacre (packages/shared, combo.ts): deux secondes au
 *     plus entre deux ralliements, un cran toutes les cinq, jusqu'a x5.
 *   - Chaque ralliement ajoute a la reserve du joueur son multiplicateur moins un: le ninja
 *     lui-meme compte deja un point, dans les ninjas portes.
 *   - Se faire capturer vide la reserve et fait retomber le combo, et le capteur n'en recoit
 *     rien: le score reste un stock, qui retombe a zero, Black Ninjas mis a part.
 *   - La prise par un Black Ninja coute a la reserve la meme part qu'aux ninjas, et fait
 *     retomber le combo.
 *
 * OU VIT CET ETAT. Dans EtatPartie.horde, pose au lancement, comme le Massacre. Une Horde au
 * salon, et toute partie construite sans lancement, joue exactement comme le Classique
 * d'avant l'etape: aucun combo, aucune prime, aucun fait de ralliement.
 */

import { COMBO, multiplicateurDuCombo } from '@neon-ninja/shared';

import type { Bot, EtatPartie, IdentifiantEntite, Joueur, RallieurEnHorde } from './etat.js';
import type { Entrees } from './moteur.js';

/** Ce que retient un joueur qui n'a encore rien rallie. */
export const RALLIEUR_DE_DEPART: RallieurEnHorde = { combo: 0, avantFinDuComboMs: 0, prime: 0 };

/**
 * Ce que retient un joueur de la Horde. Un joueur qui n'a pas encore d'entree dans la table,
 * parce qu'il est entre en cours de partie, a l'etat de depart.
 */
export function rallieurDe(etat: EtatPartie, id: IdentifiantEntite): RallieurEnHorde {
  return etat.horde?.rallieurs[id] ?? RALLIEUR_DE_DEPART;
}

/** La reserve de primes d'un joueur: ce que le combo ajoute a son score. */
export function primeEnHorde(etat: EtatPartie, joueur: Joueur): number {
  return rallieurDe(etat, joueur.id).prime;
}

/**
 * Lance une Horde: chaque joueur present recoit l'etat de depart.
 *
 * Aucun tirage. Les bots sont deja poses: le serveur peuple la carte avant de lancer.
 */
export function lancerLaHorde(etat: EtatPartie): EtatPartie {
  const rallieurs = Object.fromEntries(
    Object.keys(etat.joueurs).map((id) => [id, RALLIEUR_DE_DEPART]),
  );

  return { ...etat, horde: { rallieurs } };
}

/**
 * Ce que la Horde fait a chaque battement, une fois tout le monde deplace et avant le
 * releve des contacts.
 *
 *   1. Le combo de chaque joueur s'epuise. Il ne retombe qu'une fois sa fenetre DEPASSEE:
 *      un ralliement qui suit le precedent d'exactement deux secondes le prolonge encore.
 *   2. Les joueurs attrapes par un Black Ninja pendant ce battement perdent leur combo et
 *      la part reglee de leur reserve. Les Black Ninjas ont avance juste avant, dans le
 *      meme battement: leurs prises sont au journal.
 *
 * La table est reconstruite a partir des joueurs presents: celui qui a quitte la partie en
 * sort de lui-meme. Une Horde qui n'est pas lancee n'a rien a faire.
 */
export function agirEnHorde(etat: EtatPartie, _entrees: Entrees, dtMs: number): EtatPartie {
  if (etat.horde === undefined) {
    return etat;
  }

  const pris = new Set(
    etat.evenements.flatMap((evenement) =>
      evenement.type === 'captureParBotNoir' ? [evenement.victime] : [],
    ),
  );
  const pourCent = etat.reglages.botsNoirs.partDeBotsPerduePourCent;
  const rallieurs: Record<IdentifiantEntite, RallieurEnHorde> = {};

  for (const id of Object.keys(etat.joueurs)) {
    const avant = rallieurDe(etat, id);
    const restant = avant.avantFinDuComboMs - dtMs;

    rallieurs[id] = pris.has(id)
      ? { combo: 0, avantFinDuComboMs: 0, prime: avant.prime - part(avant.prime, pourCent) }
      : restant < 0
        ? { ...avant, combo: 0, avantFinDuComboMs: 0 }
        : { ...avant, avantFinDuComboMs: restant };
  }

  return { ...etat, horde: { rallieurs } };
}

/**
 * Un joueur vient de faire passer un faux ninja a sa couleur en le touchant: son combo
 * avance, sa fenetre repart, sa reserve gagne le multiplicateur atteint moins un, et le
 * journal garde le ralliement.
 *
 * Le bot est lu tel qu'il etait avant le contact, pour sa position. Rien dans une Horde au
 * salon.
 */
export function rallierUnBot(etat: EtatPartie, joueurId: IdentifiantEntite, bot: Bot): EtatPartie {
  if (etat.horde === undefined) {
    return etat;
  }

  const avant = rallieurDe(etat, joueurId);
  const combo = avant.combo + 1;
  const multiplicateur = multiplicateurDuCombo(combo);

  return {
    ...remplacer(etat, joueurId, {
      combo,
      avantFinDuComboMs: COMBO.FENETRE_MS,
      prime: avant.prime + multiplicateur - 1,
    }),
    evenements: [
      ...etat.evenements,
      {
        type: 'ralliement',
        joueur: joueurId,
        bot: bot.id,
        position: bot.position,
        combo,
        multiplicateur,
      },
    ],
  };
}

/**
 * Un joueur de la Horde vient d'etre capture: il perd sa reserve et son combo. Rien dans une
 * Horde au salon.
 */
export function viderLaReserve(etat: EtatPartie, victimeId: IdentifiantEntite): EtatPartie {
  return etat.horde === undefined ? etat : remplacer(etat, victimeId, RALLIEUR_DE_DEPART);
}

/** Remplace ce que retient un joueur, dans une Horde lancee. */
function remplacer(etat: EtatPartie, id: IdentifiantEntite, rallieur: RallieurEnHorde): EtatPartie {
  const rallieurs = etat.horde?.rallieurs ?? {};

  return { ...etat, horde: { rallieurs: { ...rallieurs, [id]: rallieur } } };
}

/** Une part en pour cent d'une reserve, arrondie en dessous. */
function part(points: number, pourCent: number): number {
  return Math.floor((points * pourCent) / 100);
}
