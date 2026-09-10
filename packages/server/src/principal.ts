/**
 * Le point de demarrage du serveur, celui que « pnpm dev » lance.
 *
 * Il ne contient aucune logique: il lit la configuration de l'environnement,
 * monte le serveur, et l'arrete proprement quand on le lui demande. Tout le reste
 * est dans serveur.ts, qui se teste sans jamais ouvrir de port fixe.
 *
 * ARRETER PROPREMENT N'EST PAS UN DETAIL. Le legacy n'ecoutait aucun signal
 * d'extinction: ses parties, ses minuteries et ses connexions mouraient avec le
 * processus, ce qui suffisait sur une machine de developpement et laissait des
 * joueurs sans explication en production. Ici l'extinction arrete les parties
 * d'abord, ferme les connexions ensuite, et rend la main.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PORT_PAR_DEFAUT, demarrerServeur } from './serveur.js';
import { ChargeurDeTerrain, racineRessources } from './terrain.js';

/** Lit un port depuis l'environnement, en refusant ce qui n'en est pas un. */
function portDemande(brut: string | undefined): number {
  if (brut === undefined) {
    return PORT_PAR_DEFAUT;
  }

  const port = Number(brut);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT doit etre un numero de port valide, recu « ${brut} ».`);
  }

  return port;
}

/** Lit la liste des origines autorisees, separees par des virgules. */
function originesAutorisees(brut: string | undefined): readonly string[] {
  if (brut === undefined) {
    return [];
  }

  return brut
    .split(',')
    .map((origine) => origine.trim())
    .filter((origine) => origine.length > 0);
}

/**
 * Le dossier du client empaquete.
 *
 * Il se deduit de l'emplacement de ce fichier, comme la racine des ressources:
 * packages/server/dist/principal.js a pour voisin packages/client/web. La
 * variable CHEMIN_CLIENT prend le dessus, pour un deploiement ou le client serait
 * range ailleurs.
 */
function dossierDuClient(): string {
  const surcharge = process.env['CHEMIN_CLIENT'];

  if (surcharge !== undefined && surcharge.length > 0) {
    return resolve(surcharge);
  }

  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'web');
}

const client = dossierDuClient();

// Un client absent ne doit pas empecher le serveur de jeu de tourner, mais il ne
// doit pas non plus passer inapercu: la page repondrait « introuvable » sans
// explication.
if (!existsSync(join(client, 'index.html'))) {
  console.warn(
    `Le client n'est pas empaquete dans ${client}: la page ne s'affichera pas. Lancer « pnpm build ».`,
  );
}

// C'est ici, et seulement ici, que le serveur decide de lire les images de
// collision des cartes et de servir la page. Un serveur monte a la main dans un
// test n'a ni murs ni page tant qu'il ne les demande pas.
const serveur = await demarrerServeur(portDemande(process.env['PORT']), {
  originesAutorisees: originesAutorisees(process.env['ORIGINES_AUTORISEES']),
  terrains: new ChargeurDeTerrain(),
  fichiers: { client, ressources: racineRessources() },
});

const adresse = serveur.http.address();
const port = typeof adresse === 'object' && adresse !== null ? adresse.port : '?';

// eslint-disable-next-line no-console
console.log(
  `Neon Ninja: serveur a l'ecoute sur le port ${port}, jeu sur http://localhost:${port}/`,
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void serveur.fermer().then(() => {
      process.exit(0);
    });
  });
}
