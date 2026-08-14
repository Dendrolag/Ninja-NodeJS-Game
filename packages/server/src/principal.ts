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

import { PORT_PAR_DEFAUT, demarrerServeur } from './serveur.js';

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

const serveur = await demarrerServeur(portDemande(process.env['PORT']), {
  originesAutorisees: originesAutorisees(process.env['ORIGINES_AUTORISEES']),
});

const adresse = serveur.http.address();
const port = typeof adresse === 'object' && adresse !== null ? adresse.port : '?';

// eslint-disable-next-line no-console
console.log(`Neon Ninja: serveur a l'ecoute sur le port ${port}.`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void serveur.fermer().then(() => {
      process.exit(0);
    });
  });
}
