# Handoff - Étape 3.1 Base de données et schéma

Date: 10 septembre 2026
Auteur: session Claude Code
Statut: bloquée

## Objectif de l'étape

Mettre en place PostgreSQL sur Neon, le schéma v1 des comptes, de la progression et des résultats de partie par migrations versionnées, un accès typé depuis `packages/server`, et des tests d'intégration sur une base isolée par branchement Neon.

## Ce qui a été fait

- Lecture d'ouverture: handoff 2.4, fiche 3.1 et ses ajustements venus du cadrage, section 5 du cadrage.
- **Vérification des accès avant d'écrire la moindre ligne**, puisque la définition de terminé exige une base réelle:
  - aucune variable `DATABASE_URL`, `NEON_*` ni `PG*` sur la machine;
  - ni `neonctl`, ni `psql`, ni PostgreSQL installé, ni Docker;
  - aucun secret ni variable dans le dépôt GitHub, que la CI pourrait lire.
- **Aucun code écrit.** Commencer le schéma sans pouvoir l'appliquer à une base aurait produit des migrations jamais exécutées et des tests d'intégration impossibles à faire passer: exactement la forme de travail « beaucoup construit, jamais confronté au réel » que la section 3 du ROADMAP veut éviter.

## Ce qui bloque

La condition d'arrêt de `docs/plan/PROTOCOLE.md`: **la définition de terminé ne peut pas être atteinte.** Ses points 3 et 5 (base de test isolée utilisée par les TI, TI qui passent) supposent un accès à Neon qui n'existe pas. Le créer n'est pas du ressort d'une session: il faut ouvrir un compte, créer un projet et émettre une clé.

**Ce qu'il faut au porteur du projet**, pour lever le blocage:

1. **Un projet Neon**, avec sa base principale.
2. **La chaîne de connexion par le pooler** (celle dont l'hôte contient `-pooler`), pour le serveur.
3. **Une clé d'API Neon et l'identifiant du projet**, pour créer puis supprimer une branche de test à chaque exécution des tests d'intégration.
4. **Les mêmes informations en secrets du dépôt GitHub**, pour que la CI exécute ces tests: par exemple `NEON_API_KEY` et `NEON_PROJECT_ID`.
5. **Sur la machine de développement**, les mêmes valeurs en variables d'environnement, jamais commitées.

Ces valeurs sont des secrets: c'est au porteur du projet de les saisir, pas à une session.

**Une alternative, qui est une décision du porteur du projet et non une micro-décision technique**: faire tourner les tests d'intégration sur un PostgreSQL local ou embarqué (par exemple PGlite, PostgreSQL compilé en WebAssembly, sans installation), et réserver Neon au déploiement de l'étape 5.3. Avantage: aucune dépendance réseau ni secret pour les tests. Inconvénient: CLAUDE.md fixe « le branchement Neon fournit les bases de test isolées », et un moteur embarqué ne reproduit pas exactement le pooler ni toutes les extensions. Elle ne se prend donc pas sans son accord, et CLAUDE.md serait à mettre à jour si elle était retenue.

## Fichiers créés ou modifiés

- `docs/handoffs/etape-3-1-handoff.md`: ce handoff.

Aucun autre fichier.

## Tests

Aucun test ajouté. Le dépôt est celui du commit de l'étape 2.4, dont l'état de la CI est consigné dans son handoff.

## Décisions et écarts au plan

Aucune décision prise: l'outil d'accès (la fiche cite Drizzle en exemple), le mécanisme de migrations et la forme des tables restent à trancher en début d'étape, une fois l'accès en place.

## Problèmes connus et dette

- Le blocage ci-dessus.
- Repris du handoff 2.4: la question de **l'accès sans compte** doit être tranchée avant l'étape 3.2, et les **valeurs des récompenses** à l'étape 3.3 (section 8 du cadrage).

## Prochaine action exacte

Quand l'accès est fourni: reprendre l'étape 3.1 dans une conversation neuve. Première chose à faire, vérifier que les variables sont lisibles (sans jamais afficher leur valeur) et qu'une branche de test se crée puis se supprime; ensuite seulement, réconcilier la fiche et écrire le schéma.

Si le porteur du projet retient l'alternative d'une base embarquée pour les tests: consigner la décision au journal de `docs/design/README.md`, corriger la ligne de persistance de CLAUDE.md, puis exécuter l'étape sur cette base.

## Étape suivante

Fiche à lire: `docs/plan/etape-3-1.md`, toujours la même tant que ce blocage n'est pas levé.
