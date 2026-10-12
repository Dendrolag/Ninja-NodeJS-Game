/**
 * Ce que coute au serveur l'ecriture de sa route /metriques (etape 5.15), dans le pire cas:
 * 24 parties pleines de 12 joueurs, sur toutes les combinaisons de mode et de carte, et des
 * joueurs de tous les appareils et de tous les navigateurs, soit toutes les series que la
 * surveillance peut ecrire.
 *
 * La lecture que chronometre le harnais (« pnpm charge --reseau --surveillance ») comprend
 * l'attente de la requete derriere les battements d'un serveur occupe; celle-ci ne mesure que
 * l'ecriture, deux cents fois.
 *
 * A lancer apres « tsc --build », depuis la racine du depot:
 *
 *   node --disable-warning=ExperimentalWarning tests/charge/ecriture-des-metriques.ts
 */

import { performance } from 'node:perf_hooks';

import type { GameRoom } from '../../packages/server/dist/index.js';
import { SurveillanceDuJeu, creerJournalEnMemoire } from '../../packages/server/dist/index.js';
import {
  APPAREILS,
  CARTES,
  MODES,
  NAVIGATEURS,
  coderLeBulletin,
} from '../../packages/shared/dist/index.js';

const LECTURES = 200;
const PARTIES = 24;
const JOUEURS = 12;
const PNJ = 150;

const surveillance = new SurveillanceDuJeu({ journal: creerJournalEnMemoire() });
const cartes = Object.keys(CARTES);
const bots = Object.fromEntries(Array.from({ length: PNJ }, (_, rang) => [`b${String(rang)}`, {}]));

// Des parties reduites a ce que la surveillance en lit.
const parties = Array.from(
  { length: PARTIES },
  (_, rang) =>
    ({
      id: `room-${String(rang)}`,
      mode: MODES[rang % MODES.length],
      statut: 'enCours',
      reglages: { carte: cartes[rang % cartes.length] },
      etat: {
        bots,
        joueurs: Object.fromEntries(
          Array.from({ length: JOUEURS }, (_, joueur) => [
            `j${String(rang)}-${String(joueur)}`,
            {},
          ]),
        ),
      },
    }) as unknown as GameRoom,
);

surveillance.brancher({
  parties: () => parties,
  transports: () => Array.from({ length: PARTIES * JOUEURS }, () => 'websocket'),
});
surveillance.demarrer();

const bulletin = coderLeBulletin({
  images: {
    cases: [0, 598, 2, 0, 0, 0, 0, 0],
    sommeMs: 10_003,
    lentes: 0,
    tresLentes: 0,
    cachees: 0,
    tenues: 3,
  },
  lentes: { notreCodeMs: 0, pixiMs: 0, resteMs: 0 },
  pire: { dureeMs: 21.4, notreCodeMs: 2.3, pixiMs: 1.7 },
  instantanes: {
    cases: [12, 181, 6, 1, 0, 0, 0, 0],
    sommeMs: 9_996,
    enRetard: 0,
    ecartMaxMs: 78,
  },
  allersRetoursMs: [38, 41],
  entites: 166,
  son: true,
  erreurs: { script: 0, promesse: 0 },
});

for (const [rang, partie] of parties.entries()) {
  for (let battement = 0; battement < 200; battement += 1) {
    surveillance.diffusion(partie, 0.05, 0.06, 0.1, 5000, 1, 450);
    surveillance.battement(partie, battement * 50, 50, 0.7, 0.4);
  }

  for (let joueur = 0; joueur < JOUEURS; joueur += 1) {
    const id = `c${String(rang)}-${String(joueur)}`;
    surveillance.recevoirLAppareil(id, {
      appareil: APPAREILS[joueur % APPAREILS.length],
      navigateur: NAVIGATEURS[(rang + joueur) % NAVIGATEURS.length],
      moteur: 'webgl',
      largeur: 390,
      hauteur: 844,
      densite: 3,
    });
    surveillance.recevoirUnBulletin(id, { room: partie, pseudo: id }, bulletin);
  }
}

const durees: number[] = [];
let texte = '';

for (let lecture = 0; lecture < LECTURES; lecture += 1) {
  const avant = performance.now();
  texte = surveillance.ecrire();
  durees.push(performance.now() - avant);
}

surveillance.arreter();
durees.sort((une, autre) => une - autre);
const centile = (part: number): string =>
  (durees[Math.min(Math.ceil(part * LECTURES), LECTURES) - 1] ?? 0).toFixed(2);

console.log(
  `Ecriture de /metriques: ${String(surveillance.registre.nombreDeSeries)} series, ${String(Math.round(texte.length / 1024))} Ko, mediane ${centile(0.5)} ms, p99 ${centile(0.99)} ms`,
);
