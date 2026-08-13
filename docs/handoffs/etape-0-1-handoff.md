# Handoff - Étape 0.1 Squelette du dépôt et outillage

Date: 13 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Mettre en place un dépôt vide mais qui sait déjà se tester, se vérifier et se compiler, sans aucune logique de jeu.

## Ce qui a été fait

- Branche dédiée `reecriture` créée depuis `master`. `master` reste intacte et fonctionnelle: c'est là qu'on relance le jeu d'origine.
- Legacy figé dans `legacy/`, en lecture seule, avec la provenance exacte de chaque fichier vérifiée au caractère près.
- Monorepo pnpm avec les quatre paquets `shared`, `sim`, `server`, `client`, reliés par des références de projet TypeScript.
- TypeScript en mode strict, avec une configuration de base partagée à la racine.
- ESLint et Prettier configurés, `legacy/` et l'ancien jeu entièrement exclus.
- Invariant de pureté de `packages/sim` appliqué par le linter, et vérifié par une suite de tests dédiée.
- Vitest et Playwright installés, avec leurs tests qui passent.
- Workflow GitHub Actions en deux travaux: vérification rapide, puis bout en bout.

## Fichiers créés ou modifiés

Racine

- `package.json`: remplacé. C'était le manifeste du jeu d'origine, c'est désormais la racine du monorepo. Le manifeste d'origine reste sur `master`.
- `pnpm-workspace.yaml`: déclaration des paquets, plus l'autorisation explicite du script d'installation d'esbuild (dépendance de Vitest), que pnpm 11 exige.
- `tsconfig.base.json`: configuration TypeScript partagée, mode strict plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` et `verbatimModuleSyntax`.
- `tsconfig.json`: fichier de solution, référence les quatre paquets.
- `eslint.config.js`: configuration plate, règles générales plus le bloc dédié à la pureté de `packages/sim`.
- `.prettierrc.json`, `.prettierignore`: formatage, avec `legacy/`, l'ancien jeu et les maquettes exclus.
- `vitest.config.ts`: tests dans `packages/` et `tests/`, `tests/e2e` exclu car il appartient à Playwright. La couverture ne mesure que `sim` et `shared`.
- `playwright.config.ts`: deux projets, bureau et mobile. Aucun serveur lancé à ce stade.
- `.gitignore`: ajout des sorties de compilation, des rapports de test, des fichiers système et des réglages Claude Code locaux.
- `.node-version`: passé de 23 à 24.
- `package-lock.json`: supprimé, remplacé par `pnpm-lock.yaml`.

Paquets

- `packages/{shared,sim,server,client}/package.json` et `tsconfig.json`: quatre paquets privés en ESM. Les dépendances entre eux sont déclarées en `workspace:*`.
- `packages/shared/src/index.ts`, `demo.ts`, `demo.test.ts`: fonction de démonstration et ses trois tests. À supprimer dès que `shared` contiendra du vrai code, à l'étape 1.1.
- `packages/{sim,server,client}/src/index.ts`: points d'entrée vides, commentés avec le rôle du paquet et ce qui y arrivera.

Tests et intégration continue

- `tests/purity/sim-purity.test.ts`: douze tests qui vérifient que l'invariant de pureté est bien appliqué.
- `tests/e2e/fumee.spec.ts`: deux scénarios de fumée, exécutés sur bureau et mobile.
- `.github/workflows/ci.yml`: le workflow.

Legacy et documentation

- `legacy/`: server.js, game-constants.js, client.js, styles.css, index.html, js/, et les six images de collision.
- `legacy/README.md`: provenance de chaque fichier, règle de lecture seule, et justification de ce qui n'a pas été copié.
- `CLAUDE.md`: section Commandes remplie.

## Tests

- Ajoutés: trois tests unitaires sur la fonction de démonstration, douze tests sur l'invariant de pureté, deux scénarios de bout en bout exécutés sur deux profils d'appareil.
- Résultat: **15 tests Vitest passent, 0 échec. 4 tests Playwright passent, 0 échec.**
- Couverture de `packages/sim`: sans objet, le paquet est vide. La mesure commence à l'étape 1.1.
- État de la CI: **verte**. Branche `reecriture` poussée, les deux travaux passent (exécution 31690765093). Les actions ont ensuite été portées de v4 à v7, et `pnpm/action-setup` à v6, pour lever l'avertissement de dépréciation de Node 20 sur les exécuteurs GitHub.

### Comment l'invariant de pureté est vérifié

Le test soumet à ESLint des extraits qui violent volontairement la règle, en prétendant qu'ils vivent dans `packages/sim`, et exige que le linter les refuse: imports de `socket.io`, `express`, `pixi.js`, `fs`, `node:fs`, `node:http`, appels à `Date.now()` et `Math.random()`, accès à `document`. Il vérifie aussi le contraire, que du code pur passe, et que la règle ne déborde pas sur `packages/server`.

Vérifié en plus à la main, hors des tests: un vrai fichier en violation déposé dans `packages/sim/src/` fait échouer `pnpm lint` avec trois erreurs et un code de sortie 1, chacune accompagnée de son message d'explication en français. Le fichier a été supprimé après vérification.

## Décisions et écarts au plan

1. **Node 24 au lieu de « 20 ou 22 »**. La fiche demandait la LTS courante en citant ces deux versions. La machine tourne en Node 24, qui est la LTS courante depuis octobre 2025. Aligné sur 24, dans `.node-version` et dans la CI. `engines` reste tolérant à `>=22`.

2. **pnpm installé par npm et non par corepack**. `corepack enable` échoue sur cette machine avec `EPERM` en tentant d'écrire dans `C:\Program Files\nodejs`, ce qui demanderait des droits administrateur. Contourné par `npm i -g pnpm`, qui installe dans le profil utilisateur. pnpm 11.21.0. Le champ `packageManager` est renseigné pour que la CI reste reproductible. Noté dans CLAUDE.md.

3. **Branche dédiée plutôt que travail sur `master`**. Non prévu par la fiche. L'étape restructure toute la racine du dépôt: fait sur `master`, cela aurait cassé le jeu, alors que la consigne était de garder `master` fonctionnelle.

4. **`tests/e2e` n'est pas un paquet du workspace.** Playwright est installé à la racine et `playwright.config.ts` pointe vers `tests/e2e`. Plus simple qu'un paquet dédié, pour un dossier qui ne contient que des tests.

5. **Aucune dépendance applicative installée.** Ni `express`, ni `socket.io`, ni `pixi.js`, ni pilote de base. La fiche l'interdit explicitement pour ce squelette. Elles arriveront avec les étapes qui en ont besoin.

6. **`package-lock.json` supprimé** sur cette branche. Deux fichiers de verrouillage concurrents auraient prêté à confusion. Il reste présent sur `master`.

7. **Deux fichiers de démonstration à supprimer plus tard.** `packages/shared/src/demo.ts` et son test n'ont aucun rapport avec le jeu. Ils prouvent que la chaîne tourne. À retirer à l'étape 1.1.

8. **Versions installées**: TypeScript 5.9.3, ESLint 9.39.5, typescript-eslint 8.67.0, Prettier 3.9.6, Vitest 2.1.9, Playwright 1.62.1, @types/node 22.20.1.

### Provenance du legacy

`server.js` et `game-constants.js` viennent de `master` (`fe8c955`, v0.8.5). `client.js`, `styles.css` et `index.html` viennent de `origin/master` (`bc44b32`, v0.8.6). Ce mélange est volontaire et sans conséquence: `server.js` est **identique au caractère près** entre les deux versions, les six commits d'écart ne touchant que le client. Le détail est dans `legacy/README.md`.

Seules les images `collision.png` des trois cartes ont été reprises des ressources. L'audio et les images de fond, 72 Mo dont plusieurs fichiers morts, ne servent à aucun test de caractérisation et restent accessibles sur `master`.

## Retrait de l'ancien jeu de cette branche

Décidé après coup, hors du périmètre de la fiche, sur demande explicite. `server.js`, `game-constants.js`, `nodemon.json`, `public/` et `server/` ont été retirés de la branche `reecriture`. Le code de référence reste dans `legacy/`, et `master` conserve l'ensemble intact.

Motif: deux copies de `server.js` cohabitaient, celle de la racine et celle de `legacy/`. Rien ne garantissait qu'elles restent identiques, et une session future aurait pu modifier la mauvaise en croyant toucher la référence.

Trois conséquences à connaître.

1. **Les ressources graphiques et sonores ne sont plus sur cette branche.** Sprites, sons, musiques, fonds de carte: tout est sur `master`. À rapatrier, en triant, à l'étape 4.2. La marche à suivre est dans `legacy/README.md`.
2. **Le dépôt ne s'allège pas.** Les 157 Mo sont dans l'historique Git, une suppression de fichiers ne les enlève pas. Le gain est en clarté.
3. **Danger de fusion.** Fusionner `reecriture` dans `master` avant que la nouvelle version soit jouable propagerait ces suppressions et casserait le jeu. C'est l'objectif de l'étape 6.1, pas avant.

`public/CHANGELOG.md` a été conservé et déplacé en `docs/legacy-CHANGELOG.md`: c'est la mémoire des versions du jeu, elle a de la valeur.

## Problèmes connus et dette

- `master` est resté **6 commits en retard** sur `origin/master`, par choix, pour ne pas risquer de casser la version jouable. À rattraper un jour, hors de ce chantier.
- Le dépôt pèse 157 Mo à cause des binaires versionnés, et `docs/design/` en ajoute 3,7 Mo de captures. Non traité, hors périmètre.
- `tests/purity/sim-purity.test.ts` instancie ESLint, ce qui prend environ 1,3 seconde. C'est le test le plus lent de la suite, pour un total qui reste sous 2,5 secondes.
- Les deux fichiers de démonstration de `packages/shared` (`demo.ts` et son test) sont à supprimer à l'étape 1.1, dès que le paquet contiendra du vrai code.

## Prochaine action exacte

Dans une conversation neuve: lire `legacy/server.js` et écrire les premiers scénarios de caractérisation de la capture, en commençant par `handlePlayerCapture` (ligne 737).

## Étape suivante

Fiche à lire: `docs/plan/etape-0-2.md`

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear` avant d'attaquer l'étape 0.2.
