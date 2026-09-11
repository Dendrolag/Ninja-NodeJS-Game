# Handoff - Étape 3.1 Base de données et schéma

Date: 11 septembre 2026
Auteur: session Claude Code
Statut: terminée

Ce handoff remplace celui du 10 septembre, qui déclarait l'étape bloquée faute d'accès à Neon.

## Objectif de l'étape

Mettre en place PostgreSQL sur Neon, le schéma v1 des comptes, de la progression et des parties par migrations versionnées, un accès typé depuis `packages/server`, et des tests d'intégration sur une base isolée par branchement Neon.

## Ce qui a été fait

- **Accès à Neon vérifié avant tout code**: les trois variables sont lisibles sans être affichées, l'adresse passe par le pooler, l'API répond (projet `neon-ninja`, AWS Francfort, PostgreSQL 18), et une branche d'essai s'est créée puis supprimée. Le porteur du projet a dû créer une organisation gérée par Neon: la sienne, gérée par Vercel, interdit de créer un projet.
- **Schéma v1** (`packages/server/src/base/schema.ts`) et **sa migration** `0000_schema_v1.sql`, écrite par drizzle-kit.
- **Accès typé**: ouverture de la base par le pooler, migrations par l'adresse directe, et les opérations de la fiche: créer un compte (avec sa progression), le retrouver par pseudo, lire et écrire la progression, enregistrer une partie avec ses résultats, relire l'historique d'un compte.
- **Base de test isolée**: une branche Neon par exécution des tests de la base, créée sans données, vidée, migrée, supprimée à la fin, et qui expire d'elle-même en une heure si le processus meurt. Vérifié: après chaque exécution, seule la branche `production` reste.
- **Deux projets Vitest** (`vitest.workspace.ts`): `unitaires` et `base`. Neon n'est sollicité que si un test de la base est sélectionné; vérifié avec une exécution filtrée sur `packages/sim`.
- **CI**: les secrets Neon sont passés à la tâche de vérification, et une étape régénère les migrations et échoue si le schéma a changé sans elles.
- **`reperePseudo` déplacé dans `packages/shared`**: le salon et les comptes appliquent la même règle d'unicité des pseudos.
- **Commandes** `pnpm base:generer` et `pnpm base:migrer`.
- **Documentation**: fiche 3.1 réconciliée, sept décisions au journal de conception, CLAUDE.md complété (commandes, variables, deux projets de tests).

## Le schéma retenu

La fiche demande de le décrire ici.

**`comptes`**: `id` (uuid tiré par la base), `pseudo` (tel qu'écrit), `repere_pseudo` (unique, calculé par `reperePseudo`), `cree_le`.

**`progressions`**, une par compte, créée avec lui: `compte_id` (clé, supprimée avec le compte), `xp_totale`, `pieces`, `points_ligue` (entiers jamais négatifs, zéro par défaut), `mis_a_jour_le`. **Ni niveau, ni palier, ni gemmes**: le niveau et le palier se déduiront à l'étape 3.3.

**`parties`**, une par partie terminée: `id`, `mode` (type énuméré tiré de `MODES`), `carte` (type énuméré tiré de `CARTES`), `mode_miroir`, `duree_s` (positive), `nombre_joueurs` (au moins 1, joueurs sans compte compris), `terminee_le`.

**`resultats`**, un par compte et par partie (clé composée): `partie_id` (suppression de la partie refusée tant qu'il reste des résultats), `compte_id` (supprimés avec le compte), `placement` (au moins 1, au plus le nombre de joueurs, vérifié par le code), `points`, `captures`, `bots_noirs_detruits`, `xp_gagnee`, `pieces_gagnees` (jamais négatifs), `variation_points_ligue` (signée). Index sur `compte_id` pour l'historique.

Aucune table de défis du jour.

## L'outil d'accès choisi

**Drizzle ORM 0.45 avec le pilote `pg`, et drizzle-kit 0.31 pour écrire les migrations.** Micro-décision que la fiche demande de consigner.

- Le schéma est du TypeScript, d'où viennent à la fois les types des requêtes et les migrations SQL: une seule description de la base.
- `pg` plutôt que le pilote HTTP de Neon: le serveur est un processus Node qui reste allumé, et il ouvre ses connexions par le pooler.
- Les migrations passent par l'adresse directe, sur recommandation de Neon; `adresseDirecte` et `adressePooler` passent de l'une à l'autre, pour qu'une seule variable suffise.
- Écarté: Kysely avec des migrations écrites à la main (deux descriptions de la base à tenir d'accord), et le pilote HTTP de Neon (fait pour des fonctions éphémères).
- À savoir: drizzle-kit tire deux dépendances marquées obsolètes (`@esbuild-kit`). Il ne sert qu'au développement et en CI, jamais au serveur.

## Les points d'extension

Documentés en tête de `schema.ts` et dans la section 5 du cadrage, **sans table spéculative**:

- pass de saison, skins, clans, gemmes, succès et défis du jour s'ajouteront par de nouvelles tables qui référencent `comptes.id`, sans colonne ajoutée aux tables v1;
- l'authentification (étape 3.2) choisira entre une colonne de `comptes` et une table d'identifiants, ajoutée par migration;
- un nouveau mode ou une nouvelle carte changent un type énuméré: `pnpm base:generer` écrit la migration, et la CI la réclame si on l'oublie.

## Fichiers créés ou modifiés

Créés

- `packages/server/src/base/schema.ts`: les quatre tables et les deux types énumérés.
- `packages/server/src/base/connexion.ts`: ouverture de la base par le pooler, adresses directe, pooler et chiffrée, écoute des connexions coupées au repos.
- `packages/server/src/base/erreurs.ts`: lecture du code et de la contrainte d'une erreur de PostgreSQL, y compris dans la cause d'une erreur de Drizzle.
- `packages/server/src/base/migrations.ts`, `migrer.ts`: application des migrations, et la commande `base:migrer`.
- `packages/server/src/base/comptes.ts`, `progression.ts`, `parties.ts`: les opérations de base.
- `packages/server/src/base/connexion.test.ts`, `erreurs.test.ts`: tests unitaires, sans base.
- `packages/server/drizzle.config.ts`: configuration de drizzle-kit.
- `packages/server/migrations/0000_schema_v1.sql` et `meta/`: la migration du schéma v1, écrite par drizzle-kit.
- `tests/base/neon.ts`: création, attente et suppression d'une branche Neon par l'API.
- `tests/base/branche-de-test.ts`: préparation globale des tests de la base.
- `tests/base/contexte.ts`: adresse de la branche, ouverture de la base par fichier, pseudos neufs.
- `tests/base/migrations.test.ts`, `comptes.test.ts`, `progression.test.ts`, `parties.test.ts`: les tests d'intégration requis.
- `vitest.workspace.ts`: les deux projets de tests.

Modifiés

- `packages/shared/src/validation.ts`, `index.ts`, `validation.test.ts`: `reperePseudo`, déplacé depuis `GameRoom.ts`, exporté et testé.
- `packages/server/src/GameRoom.ts`: importe `reperePseudo` au lieu de le définir.
- `packages/server/src/index.ts`: exports de `base/`, et en-tête.
- `packages/server/package.json`: dépendances `drizzle-orm`, `pg`, `drizzle-kit`, `@types/pg`; commandes `base:generer` et `base:migrer`.
- `package.json`: les mêmes commandes; `pg`, `drizzle-orm` et `@types/pg` en dépendances de développement, parce que `tests/base/` les importe et que pnpm ne rend visible à un dossier que les dépendances de son propre paquet.
- `pnpm-lock.yaml`: les dépendances.
- `vitest.config.ts`: `include` et `exclude` passent dans `vitest.workspace.ts`, sans quoi Vitest les concatène dans chaque projet.
- `tsconfig.tests.json`: vérifie les types de `vitest.workspace.ts` et de `drizzle.config.ts`.
- `.prettierignore`: les migrations écrites par drizzle-kit ne sont pas reformatées.
- `.github/workflows/ci.yml`: secrets Neon, et contrôle des migrations.
- `CLAUDE.md`: commandes de la base, variables, deux projets de tests.
- `docs/plan/etape-3-1.md`: réconciliation.
- `docs/design/README.md`: sept décisions.
- `docs/handoffs/etape-3-1-handoff.md`: ce handoff, qui remplace le handoff bloqué.

## Tests

- Ajoutés:
  - **migrations** (3): les quatre tables et elles seules, les types énumérés identiques à `MODES` et `CARTES`, toutes les migrations appliquées et rejouables sans rien changer;
  - **comptes** (6): création avec progression à zéro, pseudo déjà pris même écrit autrement, pseudo invalide, recherche par pseudo, unicité tenue par la base elle-même, progression supprimée avec le compte;
  - **progression** (4): écriture et relecture, compte inconnu en lecture et en écriture, valeur négative refusée par la base sans rien changer;
  - **parties** (9): enregistrement et historique, ordre de l'historique, partie non écrite si un résultat est refusé, double résultat, placement impossible, gain négatif, carte inconnue, suppression d'un compte, suppression d'une partie refusée;
  - **unitaires** (13): adresses directe, pooler et chiffrée, ouverture sans connexion, lecture des erreurs de PostgreSQL; `reperePseudo` (3).
- Résultat: **1169 tests sur 1169**, dans 72 fichiers, dont les 22 de la base contre une vraie branche Neon.
- Couverture de `packages/sim` et `packages/shared`: **99,75 pour cent**, inchangée.
- Formatage, types et linter: verts. Types vérifiés aussi par `tsc` lancé directement (voir « Problèmes connus »).
- Bout en bout et CI: voir « État de la CI ».

## Décisions et écarts au plan

Les sept décisions sont au journal du README. Trois points méritent d'être lus ici.

### 1. Une partie jouée, deux tables

Le cadrage décrit « un résultat de partie par compte et par partie » portant aussi le mode, la carte et la durée. Rangés tels quels, ces champs se répéteraient dans chaque résultat d'une même partie, et pourraient ne plus dire la même chose. Les champs sont ceux du cadrage, rangés dans `parties` et `resultats`.

### 2. Rien n'est branché sur le serveur de jeu

Le serveur n'ouvre pas la base au démarrage: aucun code ne s'en sert avant l'étape 3.2, et le jeu doit continuer de tourner sans `DATABASE_URL`, dans les scénarios de bout en bout comme en local. La base principale (`production`) n'a pas encore reçu la migration: `pnpm base:migrer` le fera quand l'étape 3.2 en aura besoin.

### 3. Les tests de la base font échouer la CI sans les secrets

C'est voulu: une CI verte qui n'a pas testé la base mentirait. En local, sans les variables, ils sont sautés avec un message.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **La CI dépend des secrets `NEON_API_KEY` et `NEON_PROJECT_ID` du dépôt GitHub.** Ils existent (vérifié par leur nom, le 11 septembre 2026). S'ils sont supprimés ou si la clé est révoquée, la CI devient rouge sur la préparation de la base, avec un message qui le dit.
- **L'écriture de la progression remplace les valeurs.** L'étape 3.3 appliquera les gains d'une partie; pour qu'une écriture ne puisse pas en effacer une autre, elle devra ajouter les gains dans la même transaction que l'enregistrement de la partie, plutôt que lire puis réécrire.
- **Observation sur l'outillage local**: pendant l'étape, `rtk pnpm typecheck` a annoncé « No errors found » alors que les tests importaient des fonctions que l'index du serveur n'exportait pas encore, et qu'aucun fichier n'avait été produit dans `dist/base`. Cause non établie. La vérification a été refaite en appelant `tsc` directement, puis la suite complète. La CI, qui n'utilise pas `rtk`, reste le filet.

Repris du handoff 2.4: les **valeurs des récompenses** sont à faire valider par le porteur du projet à l'étape 3.3 (section 8 du cadrage). **L'accès sans compte, lui, a été tranché le 11 septembre 2026, après la fin de cette étape**: on joue sans compte, et le compte n'apporte que la progression (journal de conception; fiches 3.2 et 3.3 mises à jour). Le reste: voir le handoff 4.4.

## État de la CI

**Run 34580272863, commit 9a5d41a: vert.** Première exécution des tests de la base en CI, avec les secrets Neon.

- « Types, linter et tests »: vert. Le contrôle des migrations répond « No schema changes, nothing to migrate »; 72 fichiers de test sur 72, base comprise.
- « Bout en bout »: vert, 10 scénarios sur 10.
- Après ce run, seule la branche `production` reste dans le projet Neon: la CI supprime sa branche de test comme en local.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 3.2, inscription, connexion, gestion de session, et authentification de la connexion Socket.IO. C'est la section 3 du ROADMAP qui la désigne: le jalon 3 enchaîne `3.1`, `3.2`, `3.3`.

Trois points à avoir en tête dès le début:

1. **L'accès sans compte est tranché: on joue sans compte, le compte n'apporte que la progression** (voie B, décision du porteur du projet du 11 septembre 2026, au journal de `docs/design/README.md`). **La fiche 3.2 a été récrite en conséquence**: une connexion non authentifiée rejoint une room en invité avec un pseudo, une connexion authentifiée sous le pseudo et le niveau de son compte, et l'étape doit choisir la règle qui empêche un invité de se faire passer pour un compte. Lire sa section d'ajustements, points 1 à 5.
2. **La base est prête**: `creerCompte`, `trouverCompteParPseudo` et le schéma sont exportés par `@neon-ninja/server`. Le mot de passe haché s'ajoute par une migration (`pnpm base:generer`), dans `comptes` ou dans une table d'identifiants.
3. **Appliquer la migration à la base principale** (`pnpm base:migrer`) quand le serveur commencera à s'en servir, et prévoir que le jeu continue de fonctionner en invités seulement sans `DATABASE_URL` (développement local, scénarios de bout en bout).

## Étape suivante

Fiche à lire: `docs/plan/etape-3-2.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`.
