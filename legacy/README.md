# legacy - Code d'origine, en lecture seule

Ce dossier contient le jeu tel qu'il fonctionnait avant la réécriture. Il sert de référence pour les tests de caractérisation de l'étape 0.2 et pour le portage de la phase 1.

## Règle absolue

**Ce dossier n'est jamais modifié.** Ni corrigé, ni reformaté, ni refactoré. Il est exclu de la compilation TypeScript, du linter et du formateur. Si un défaut y est constaté, il se note dans un handoff, il ne se corrige pas ici.

C'est ce qui garantit que les instantanés de caractérisation restent comparables dans le temps.

## Provenance exacte

Copie vérifiée au caractère près le 13 août 2026.

| Fichier | Source | Commit |
| --- | --- | --- |
| `server.js` | `master:server.js` | `fe8c955` (v0.8.5) |
| `game-constants.js` | `master:game-constants.js` | `fe8c955` (v0.8.5) |
| `client.js` | `origin/master:public/client.js` | `bc44b32` (v0.8.6) |
| `styles.css` | `origin/master:public/styles.css` | `bc44b32` (v0.8.6) |
| `index.html` | `origin/master:public/index.html` | `bc44b32` (v0.8.6) |
| `js/MapManager.js` | `master:public/js/MapManager.js` | `fe8c955` |
| `js/AudioManager.js` | `master:public/js/AudioManager.js` | `fe8c955` |
| `js/game-constants.js` | `master:public/js/game-constants.js` | `fe8c955` |
| `assets/maps/*/*/collision.png` | `master:public/assets/maps/...` | `fe8c955` |

## Pourquoi deux commits différents

La base de référence retenue est **master v0.8.6** (voir la section 5 de docs/plan/ROADMAP.md). Le master local est resté en v0.8.5, et `origin/master` porte la v0.8.6.

Or `server.js` et `game-constants.js` sont **identiques au caractère près** entre les deux versions: les six commits d'écart ne touchent que le client, les styles, le README, le journal des versions et une capture d'écran. Les fichiers serveur ont donc été pris depuis `master`, et les fichiers client depuis `origin/master`, qui porte la v0.8.6.

Conséquence pratique: le portage du moteur en phase 1 est insensible à cette distinction, puisqu'il ne consomme que `server.js` et `game-constants.js`.

## Ce qui n'a pas été copié, et pourquoi

- Les fichiers audio et les images de fond. Ils ne servent à aucun test de caractérisation et pèsent 72 Mo, dont plusieurs fichiers morts recensés dans docs/audit/AUDIT-EXISTANT.md. Ils restent accessibles dans l'historique Git et sur `master`.
- `public/styles-neon-test.css`, 1 574 lignes jamais chargées par `index.html`.
- `public/assets/map/`, ancienne carte remplacée par `public/assets/maps/`.
- Le dossier `server/`, architecture modulaire inachevée jamais branchée: `package.json` démarrait `server.js` à la racine.

Seules les images `collision.png` des trois cartes ont été reprises, car l'étape 0.2 et l'étape 1.2 en ont besoin pour caractériser les collisions de terrain.

## Faire tourner le jeu d'origine

Ce dossier n'est pas exécutable en l'état: les chemins et les ressources ont changé. Pour rejouer la version d'origine, utiliser la branche `master`, qui reste fonctionnelle et intacte.
