# Fiche étape 0.1 - Squelette du dépôt et outillage

Brief de la première conversation Claude Code. Objectif unique de cette session: mettre en place un dépôt vide mais qui sait déjà se tester, se vérifier et se déployer. Aucune logique de jeu ici.

## Rituel de début de session

Première étape du projet, il n'y a donc pas de handoff précédent. Lire CLAUDE.md (chargé automatiquement) puis cette fiche. Vérifier la structure cible dans docs/plan/ROADMAP.md.

## Objectif

Un monorepo TypeScript avec les quatre packages, l'outillage de test, la vérification automatique, l'intégration continue, et les fichiers fondateurs en place. La définition de terminé en bas de fiche est la seule mesure de réussite.

## Décisions techniques fixées pour cette étape

- Gestionnaire de paquets: pnpm avec workspaces. C'est un choix, modifiable plus tard, mais on s'y tient pour ce projet.
- Modules: ESM partout, comme le legacy.
- Node: version LTS courante (20 ou 22).
- TypeScript en mode strict.
- Formateur: Prettier. Linter: ESLint. Prettier gère le formatage, ESLint gère les règles, ils ne se chevauchent pas.
- Tests: Vitest pour unitaire et intégration, Playwright pour le bout en bout.
- Intégration continue: GitHub Actions.

## Où vit le code legacy

Le code legacy doit rester consultable pendant toute la réécriture, pour les tests de caractérisation de l'étape 0.2 et comme référence de portage.

**Base retenue: master v0.8.6.** Copier dans un dossier legacy/ à la racine: server.js, game-constants.js, public/client.js, public/js/MapManager.js, public/js/AudioManager.js, public/index.html, public/styles.css, ainsi que les cartes de collision de public/assets/maps/ dont l'étape 0.2 aura besoin.

Point de vigilance sur la provenance. Le master local est en v0.8.5 et origin/master en v0.8.6. **server.js est identique entre les deux**, seuls le client et les styles diffèrent. Prendre server.js et game-constants.js indifféremment, mais **client.js et styles.css depuis origin/master**, et noter dans le handoff la référence exacte (branche et empreinte de commit) de chaque fichier copié.

Ce dossier est une référence en lecture seule. Il n'est ni construit, ni inclus dans les packages, ni modifié. L'exclure de la compilation TypeScript et du linter.

## Périmètre de l'étape (ce qui est à faire)

1. Initialiser Git proprement. Le dossier legacy/ ne contient aucune sauvegarde manuelle de version ni fichier mort. Ne pas y copier public/styles-neon-test.css (1 574 lignes jamais chargées par index.html), public/assets/map/ (ancienne carte remplacée par public/assets/maps/), ni les fichiers audio non référencés recensés dans docs/audit/AUDIT-EXISTANT.md, dont game-music-1.wav qui pèse 45 Mo à lui seul.
2. Créer le monorepo pnpm: package.json racine avec les workspaces, plus les quatre packages packages/sim, packages/server, packages/client, packages/shared, chacun avec son package.json et son tsconfig.
3. Configurer TypeScript en mode strict, avec une configuration de base partagée à la racine et des références de projet entre packages.
4. Configurer ESLint et Prettier à la racine, appliqués à tous les packages, le dossier legacy/ exclu.
5. Mettre en place l'enforcement de l'invariant de pureté sur packages/sim (voir la règle dans .claude/rules/sim-purity.md): interdire dans packages/sim l'import de socket.io, express, des modules Node d'entrée-sortie (fs, http, net), et de pixi.js, ainsi que l'usage direct de Date.now() et Math.random(). Cet enforcement passe par les règles ESLint no-restricted-imports et no-restricted-properties ciblées sur ce package.
6. Configurer Vitest à la racine, capable de lancer les tests par package. Écrire un test trivial qui passe (par exemple une fonction d'addition dans packages/shared, avec son test).
7. Installer et configurer Playwright, avec un scénario de fumée minimal qui démarre et passe (il peut juste ouvrir une page vide pour l'instant).
8. Créer le workflow GitHub Actions qui, sur chaque poussée et chaque demande de fusion, lance dans l'ordre: installation, vérification de types, linter, Vitest, puis le scénario de fumée Playwright. La fusion est bloquée si le workflow est rouge.
9. Mettre en place les fichiers fondateurs aux bons endroits: CLAUDE.md à la racine, docs/plan/ROADMAP.md, docs/handoffs/_TEMPLATE.md, .claude/rules/sim-purity.md, et un dossier docs/design/ avec un court README indiquant que les maquettes Claude Design y seront déposées.
10. Compléter la section Commandes de CLAUDE.md avec les commandes réelles une fois l'outillage en place (installation, lancer tous les tests, lancer un sous-ensemble, démarrer en développement, lancer le bout en bout).

## Hors périmètre (ce qu'il ne faut surtout pas faire)

- Aucune logique de jeu, aucun portage depuis le legacy. C'est la phase 1.
- Aucun test de caractérisation. C'est l'étape 0.2.
- Aucune base de données, aucun Socket.IO fonctionnel, aucun rendu PixiJS.
- Aucune interface réelle.
- Ne pas toucher, corriger ou refactorer le contenu de legacy/.
- Ne pas ajouter de dépendances non nécessaires à ce squelette.

## Tests requis

- Un test Vitest trivial au vert.
- Un scénario Playwright de fumée qui démarre et passe.
- Le workflow GitHub Actions au vert sur une branche poussée.

## Définition de terminé

Toutes ces conditions réunies:

1. pnpm install fonctionne sans erreur.
2. La vérification de types passe sur tous les packages.
3. Le linter passe, et l'enforcement de pureté de packages/sim est actif et vérifié par un cas qui échoue si on tente un import interdit.
4. Vitest s'exécute et le test trivial est vert.
5. Le scénario de fumée Playwright est vert.
6. Le workflow GitHub Actions est vert sur une branche poussée.
7. Les fichiers fondateurs sont commités aux bons emplacements.
8. La section Commandes de CLAUDE.md est remplie.
9. Un handoff est écrit dans docs/handoffs/ à partir du modèle, et commité.

## Rituel de fin de session

Écrire docs/handoffs/etape-0-1-handoff.md à partir de docs/handoffs/_TEMPLATE.md. Indiquer précisément les commandes réelles mises en place, les versions choisies, la provenance exacte des fichiers de legacy/, et toute décision prise. La prochaine action exacte à noter pour l'étape 0.2: lire le legacy server.js et caractériser dans l'ordre la capture, les collisions, le score et les effets. Commiter.
