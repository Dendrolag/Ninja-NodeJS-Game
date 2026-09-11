/**
 * L'empreinte d'une partie: prouver qu'une optimisation ne change rien au jeu.
 *
 * POURQUOI CET OUTIL. Une optimisation du moteur ne doit rien changer a ce qui se
 * passe dans une partie (fiche de l'etape 5.2). Les tests unitaires le verifient
 * cas par cas; cet outil le verifie en bloc. Il joue quatre parties deterministes,
 * longues et animees (captures, bots noirs, bonus, malus, zones), et resume en une
 * empreinte chaque etat complet du moteur, chaque instantane diffuse et chaque
 * notification, a chaque battement. Deux versions du code qui rendent les memes
 * empreintes jouent les memes parties, a l'octet pres.
 *
 * Il se lance sur la compilation, avant puis apres une modification, et les deux
 * sorties se comparent ligne a ligne:
 *
 *   pnpm typecheck
 *   node --disable-warning=ExperimentalWarning tests/charge/empreinte.ts > avant.txt
 *   (modification, puis pnpm typecheck)
 *   node --disable-warning=ExperimentalWarning tests/charge/empreinte.ts > apres.txt
 *
 * Une empreinte qui change n'est pas forcement une faute: un changement de regle
 * voulu la change aussi. Elle dit seulement que les parties ne sont plus les memes.
 */

import { createHash } from 'node:crypto';

import type { Entrees, EtatPartie } from '../../packages/sim/dist/index.js';
import {
  ajouterJoueur,
  creerEtatInitial,
  peuplerDeBots,
  tick,
} from '../../packages/sim/dist/index.js';
import { creerAlea, entier, nombre } from '../../packages/shared/dist/index.js';
import {
  ChargeurDeTerrain,
  instantaneDe,
  notificationsDe,
} from '../../packages/server/dist/index.js';

/** Une partie jouee par l'outil. */
interface PartieDEmpreinte {
  readonly nom: string;
  readonly bots: number;
  readonly joueurs: number;
  readonly battements: number;
  readonly murs: boolean;
  readonly graine: number;
}

/**
 * Les parties jouees. Leurs reglages font apparaitre souvent bonus, malus, zones
 * et bots noirs, pour que chaque regle ait sa chance de diverger.
 */
const PARTIES: readonly PartieDEmpreinte[] = [
  {
    nom: '150 bots, 12 joueurs, murs',
    bots: 150,
    joueurs: 12,
    battements: 3000,
    murs: true,
    graine: 42,
  },
  {
    nom: '50 bots, 12 joueurs, murs',
    bots: 50,
    joueurs: 12,
    battements: 2000,
    murs: true,
    graine: 7,
  },
  {
    nom: '300 bots, 12 joueurs, sans mur',
    bots: 300,
    joueurs: 12,
    battements: 1500,
    murs: false,
    graine: 99,
  },
  {
    nom: '150 bots, 2 joueurs, murs',
    bots: 150,
    joueurs: 2,
    battements: 2000,
    murs: true,
    graine: 3,
  },
];

/** Le terrain ne change jamais pendant une partie: il n'entre pas dans l'empreinte. */
function sansTerrain(cle: string, valeur: unknown): unknown {
  return cle === 'terrain' ? undefined : valeur;
}

/** Joue une partie et rend sa ligne de sortie: son empreinte, et ce qui s'y est passe. */
function empreinteDe(partie: PartieDEmpreinte, murs: EtatPartie['terrain']): string {
  let etat = creerEtatInitial({
    graine: partie.graine,
    reglages: {
      nombreBotsInitial: partie.bots,
      dureePartieS: 200,
      bonus: { intervalleApparitionS: 2 },
      malus: { intervalleApparitionS: 4 },
      zones: { intervalleApparitionS: 5 },
      botsNoirs: { momentApparitionPourCent: 5 },
    },
    ...(partie.murs ? { terrain: murs } : {}),
  });

  for (let rang = 1; rang <= partie.joueurs; rang += 1) {
    etat = ajouterJoueur(etat, { id: `j${String(rang)}`, pseudo: `Joueur${String(rang)}` });
  }
  etat = peuplerDeBots(etat);

  let alea = creerAlea(partie.graine ^ 0x1234);
  const entrees: Record<string, Entrees[string]> = {};
  const empreinte = createHash('sha256');
  const faits = new Map<string, number>();

  for (let battement = 0; battement < partie.battements; battement += 1) {
    // Chaque joueur change d'intention une fois sur vingt en moyenne, et s'arrete
    // parfois: des joueurs qui bougent, capturent et ramassent.
    for (let rang = 1; rang <= partie.joueurs; rang += 1) {
      const changer = nombre(alea);
      alea = changer.alea;

      if (changer.valeur < 0.05) {
        const angle = nombre(alea);
        alea = angle.alea;
        const radians = angle.valeur * 2 * Math.PI;
        entrees[`j${String(rang)}`] = {
          deplacement: { x: Math.cos(radians), y: Math.sin(radians) },
          enMouvement: angle.valeur > 0.1,
        };
      }
    }

    // Un pas de temps irregulier, de 20 a 80 millisecondes, comme un vrai serveur.
    const pas = entier(alea, 61);
    alea = pas.alea;
    etat = tick(etat, entrees, 20 + pas.valeur);

    empreinte.update(JSON.stringify(etat, sansTerrain));
    empreinte.update(JSON.stringify(instantaneDe(etat)));
    empreinte.update(JSON.stringify(notificationsDe(etat)));

    for (const fait of etat.evenements) {
      faits.set(fait.type, (faits.get(fait.type) ?? 0) + 1);
    }
  }

  const resume = [...faits]
    .sort(([premier], [second]) => premier.localeCompare(second))
    .map(([type, nombreDeFaits]) => `${type}=${String(nombreDeFaits)}`)
    .join(' ');

  return `${partie.nom}: ${empreinte.digest('hex')} | ${resume}`;
}

const murs = new ChargeurDeTerrain().charger({ carte: 'map1', modeMiroir: false });

for (const partie of PARTIES) {
  console.log(empreinteDe(partie, murs));
}
