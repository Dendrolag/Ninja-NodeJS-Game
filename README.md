# Neon Ninja

Jeu multijoueur en temps réel, dans le navigateur : capturer les faux ninjas en les touchant, et capturer les autres joueurs pour leur prendre tous les leurs d'un coup.

Jouer : https://neon-ninja-jeu.vercel.app

## Le dépôt

Réécriture en TypeScript du prototype d'origine, couverte par des tests : le moteur de simulation pur (`packages/sim`), le serveur de jeu (`packages/server`), la page du jeu (`packages/client`) et le code partagé (`packages/shared`).

- Lancer le jeu en local : `pnpm install`, puis `pnpm dev`, puis ouvrir http://localhost:3000.
- Vérifier avant de commiter : `pnpm verify`.
- Règles du projet : `CLAUDE.md`. Plan et avancement : `docs/plan/ROADMAP.md` et `docs/handoffs/`. Mise en ligne : `docs/deploiement.md`.

La version d'origine (v0.8.6, en JavaScript) est archivée sous l'étiquette `v0.8.6`, et copiée en lecture seule dans `legacy/`.
