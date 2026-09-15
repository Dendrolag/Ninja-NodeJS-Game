# Fiche étape 3.1 - Base de données et schéma

Brief de session. Objectif unique: mettre en place PostgreSQL et le schéma des comptes, de la progression et des résultats de partie, à partir du cadrage. Le schéma reste extensible pour les fonctionnalités reportées, sans les construire.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 2.4, le cadrage docs/design/cadrage.md (forme des données de progression et points d'extension), puis cette fiche.

## Objectif

Mettre en place la base sur Neon (Postgres managé), définir le schéma v1, et fournir un accès typé à la base depuis packages/server. Les connexions du serveur passent par le pooler de Neon. Mettre en place un mécanisme de migrations versionnées. Les bases de test isolées s'appuient sur le branchement de Neon, une branche propre par exécution de tests, supprimée à la fin.

## Périmètre (schéma v1, depuis le cadrage)

1. Compte: identifiant, pseudo unique, date de création. Les informations d'authentification (mot de passe haché) sont ajoutées à l'étape 3.2, prévoir leur place.
2. Progression: rattachée au compte. Niveau, XP, pièces, gemmes, points de ligue, palier de rang.
3. Résultat de partie: rattaché au compte. Mode, carte, placement, score, XP gagnée, pièces gagnées, variation de points de ligue, horodatage.
4. Défis du jour: seulement si retenus en v1 selon le cadrage, sous une forme minimale. Sinon, ne pas créer la table.
5. Accès typé: une couche d'accès typée en TypeScript (par exemple un constructeur de requêtes typé ou un ORM léger comme Drizzle, compatible Neon), cohérente avec la philosophie des contrats typés du projet. Les connexions passent par le pooler de Neon, adapté à un serveur Node persistant. Le choix précis de l'outil est une micro-décision à consigner dans le handoff.
6. Migrations: un mécanisme de migrations versionnées, rejouables. Base de test isolée par branchement Neon, créée puis supprimée par exécution de tests, sans état partagé entre exécutions.

## Points d'extension (à prévoir, pas à construire)

Concevoir le schéma pour que le pass de saison, les skins et les clans puissent être ajoutés plus tard sous forme de nouvelles tables, sans modifier les tables v1. Ne pas ajouter de colonnes spéculatives pour ces fonctionnalités. Garder la table compte sobre.

## Hors périmètre

- Aucune authentification ici. C'est l'étape 3.2.
- Aucun branchement de la progression sur la fin de partie. C'est l'étape 3.3.
- Aucune table pour les fonctionnalités reportées (pass de saison, skins, clans, échelle de ligue).
- Aucune interface.

## Tests requis

- TI avec base de test: les migrations s'appliquent et se rejouent proprement.
- TI sur les opérations de base: créer un compte, lire et écrire sa progression, enregistrer un résultat de partie.
- TI vérifiant les contraintes (pseudo unique, intégrité des liens compte vers progression et résultats).

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Le schéma v1 existe via des migrations versionnées.
2. L'accès typé à la base fonctionne depuis packages/server.
3. La base de test est isolée et utilisée par les TI.
4. Les points d'extension sont documentés, sans table spéculative.
5. Les TI passent.

## Ajustements venus du cadrage, étape 0.3 (10 septembre 2026)

`docs/design/cadrage.md`, section 5, précise le schéma sur trois points. Le cadrage fait foi.

1. **La progression ne stocke ni niveau, ni palier de rang.** Elle stocke l'XP totale, les pièces et les points de ligue; niveau et palier se déduisent, comme le score. Le périmètre 2 de cette fiche est réduit d'autant.
2. **Pas de gemmes en v1.** Elles arrivent avec une boutique, par ajout.
3. **Pas de table de défis du jour**: ils sont reportés. Le périmètre 4 de cette fiche est sans objet.

Le résultat de partie porte aussi, d'après le cadrage: l'identifiant commun de la partie, le mode miroir, la durée, le nombre de joueurs, les captures et les Black Ninjas détruits. Et la question de l'accès sans compte, laissée au porteur du projet, doit être tranchée avant l'étape 3.2. Tranchée le 11 septembre 2026: on joue sans compte, le compte n'apporte que la progression (voir la fiche 3.2).

## Réconciliation au début de l'étape (11 septembre 2026)

Écarts entre cette fiche et le dépôt réel. Le dépôt et le cadrage font foi.

1. **L'étape avait été bloquée le 10 septembre** faute d'accès à Neon (handoff 3.1 au statut bloquée, remplacé par le handoff de fin de cette étape). Le porteur du projet a créé le projet `neon-ninja` (AWS Francfort, PostgreSQL 18) et fourni `DATABASE_URL`, `NEON_API_KEY` et `NEON_PROJECT_ID` sur la machine. Son organisation Neon d'origine était gérée par Vercel, qui interdit d'y créer un projet: il a fallu une organisation gérée par Neon.
2. **Le résultat de partie devient deux tables.** Ce qui est commun à tous les joueurs d'une partie (mode, carte, miroir, durée, nombre de joueurs, heure de fin) vit dans `parties`; ce qui est propre à un compte dans `resultats`. Les champs sont exactement ceux du cadrage, rangés sans répétition. Le « score » de la fiche s'appelle `points`, comme dans `LigneClassement`, et « l'horodatage » est l'heure de fin de la partie.
3. **La place de l'authentification** n'est pas réservée par une colonne vide: la fiche 3.2 et le cadrage lui laissent le choix entre une colonne du compte et une table à part, qu'une migration ajoutera.
4. **Rien ne se branche encore sur la base.** Le serveur de jeu ne l'ouvre pas au démarrage: aucun code ne s'en sert avant l'étape 3.2, et le jeu doit continuer de tourner sans `DATABASE_URL`, dans les scénarios de bout en bout comme en local.
5. **Le pseudo d'un compte suit la règle d'unicité du salon.** Sa fonction, privée dans `GameRoom.ts`, est déplacée dans `packages/shared` (`reperePseudo`) pour que salon et comptes ne puissent pas diverger.
6. **Base de test**: une branche Neon par exécution, créée sans les données de sa parente et avec une date d'expiration, vidée puis migrée. Les tests de la base forment un projet Vitest à part, qui ne sollicite Neon que si l'un de ses tests est sélectionné.

## Rituel de fin de session

Écrire docs/handoffs/etape-3-1-handoff.md. Décrire le schéma retenu, l'outil d'accès choisi, et les points d'extension. Prochaine action exacte pour l'étape 3.2: inscription, connexion, gestion de session, et authentification de la connexion Socket.IO. Commiter.
