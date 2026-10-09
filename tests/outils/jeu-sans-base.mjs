/* global process -- un outil lance par Node, hors des paquets. */
// Lance le jeu en local SANS base de donnees, en invites seulement.
//
// Sur la machine du porteur du projet, DATABASE_URL designe la base de PRODUCTION: le serveur
// applique ses migrations au demarrage, et `pnpm dev` y ecrirait. Ce lanceur retire les
// variables de la base avant de demarrer le serveur compile, pour essayer la page en local
// sans risque (configuration « jeu-sans-base » de .claude/launch.json).
//
// A lancer apres `pnpm build`: node tests/outils/jeu-sans-base.mjs

for (const variable of ['DATABASE_URL', 'NEON_API_KEY', 'NEON_PROJECT_ID']) {
  delete process.env[variable];
}

await import('../../packages/server/dist/principal.js');
