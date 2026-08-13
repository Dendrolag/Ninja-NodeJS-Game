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

## Où sont passées les ressources du jeu

L'ancien jeu a été retiré de cette branche: `server.js`, `game-constants.js`, `nodemon.json`, `public/` et `server/` n'y figurent plus. Le code de référence est ici, dans `legacy/`.

**Les ressources graphiques et sonores ne sont pas dans ce dossier.** Sprites du ninja (huit directions, deux images chacune), sons, musiques, images de bonus et de malus, fonds et premiers plans des cartes: tout cela vit sur la branche `master`, dans `public/assets/`.

C'est volontaire. Ces fichiers ne servent à aucun test de caractérisation, ils pèsent 72 Mo, et l'audit y a relevé beaucoup de contenu mort (dont un fichier audio de 45 Mo jamais référencé). Les rapatrier en bloc reviendrait à traîner ce poids sans l'avoir trié.

**À faire à l'étape 4.2**, quand le rendu PixiJS aura besoin des ressources: les reprendre depuis `master`, en ne gardant que ce qui est réellement référencé. La liste des fichiers morts est dans docs/audit/AUDIT-EXISTANT.md, section « Poids et propreté du dépôt ».

Récupérer un fichier depuis `master` se fait sans changer de branche:

```bash
git show master:public/assets/images/ninja/north_1.png > destination.png
```

## Faire tourner le jeu d'origine

Ce dossier n'est pas exécutable en l'état: il ne contient que du code, sans les ressources ni l'arborescence attendue. Pour rejouer la version d'origine, utiliser la branche `master`, qui reste fonctionnelle et intacte.

## Attention en cas de fusion

Cette branche a supprimé l'ancien jeu. **Fusionner `reecriture` dans `master` avant que la nouvelle version soit jouable propagerait ces suppressions et casserait le jeu en ligne.** Le retrait du monolithe est bien l'objectif final du plan, mais c'est l'étape 6.1, pas avant.
