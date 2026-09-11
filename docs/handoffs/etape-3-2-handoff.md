# Handoff - Étape 3.2 Authentification

Date: 11 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Inscription, connexion, gestion de session et authentification de la connexion Socket.IO, de sorte qu'un compte identifié rejoigne une room sous son pseudo et avec son niveau, tandis qu'un invité continue d'y entrer avec un simple pseudo.

## Ce qui a été fait

- **Inscription et connexion** par pseudo et mot de passe, derrière quatre routes HTTP (`ROUTES_COMPTES`, sous `/api/comptes`): inscription (201 et session), connexion (200 et session), déconnexion (204), lecture de sa progression (200, réservée à une session).
- **Mots de passe hachés par scrypt** de `node:crypto`, dans une table `mots_de_passe` à part.
- **Session par jeton opaque**, dont la base ne garde que l'empreinte, dans une table `sessions`, trente jours.
- **Tentatives limitées** par pseudo et par adresse, avant toute vérification du mot de passe.
- **Connexion Socket.IO authentifiée**: le jeton est vérifié à l'ouverture; un compte entre en partie sous son pseudo et avec son niveau, un invité sous un pseudo qui n'est celui d'aucun compte.
- **Le salon distingue les comptes des invités**: `JoueurDuSalon.compte = { niveau }` pour un compte, rien pour un invité; le salon du client affiche « Niveau N ».
- **Niveau provisoire** (`niveauDeXp`, un niveau tous les mille points d'XP), à remplacer à l'étape 3.3.
- **Serveur sans base**: invités seulement, routes des comptes en 503, jeton refusé. `principal.ts` branche les comptes quand `DATABASE_URL` est définie.
- **Migration `0001_authentification`** écrite par drizzle-kit, et **appliquée à la base principale** (`pnpm base:migrer`, 0000 et 0001).
- **Vérification sur le vrai serveur** (`principal.js`, avec `DATABASE_URL`): routes des comptes montées (401 sans jeton, 401 pour un jeton inconnu, 401 générique pour un pseudo inconnu, sans erreur de base), et une partie rapide en invité depuis la page atteint le salon. Aucune écriture dans la base principale.
- **Documentation**: fiche 3.2 réconciliée, huit décisions au journal de conception, cadrage (table du mot de passe), CLAUDE.md (comptes branchés avec `DATABASE_URL`, `MANDATAIRES_DE_CONFIANCE`).

## Le mécanisme de session retenu

La fiche demande de le décrire ici.

- À l'inscription ou à la connexion, le serveur tire un **jeton de 32 octets** (`randomBytes`, base 64 pour adresse, 43 caractères) et le rend au client dans `SessionOuverte`. Il n'en garde que l'**empreinte SHA-256**, dans `sessions`, avec une expiration à **trente jours** calculée par la base (`now()`).
- Le client joint le jeton lui-même: en-tête `Authorization: Bearer <jeton>` pour les routes HTTP, `auth: { jeton }` à l'ouverture de la connexion Socket.IO. **Aucun cookie.**
- Se déconnecter efface la ligne. Une session expirée n'ouvre plus rien; les lignes expirées sont effacées à l'ouverture des sessions suivantes.
- Pourquoi un jeton: le client (Vercel) et le serveur (Render) seront sur deux domaines, où les cookies sont restreints. Pourquoi opaque et non signé: révocable, sans clé secrète à gérer. Le détail est au journal de conception.

## La façon dont la connexion réseau est authentifiée

- Un intermédiaire Socket.IO (`io.use`, dans `ServeurSocket`) lit `handshake.auth.jeton` **avant** que la connexion soit acceptée. Sans jeton: un invité. Avec un jeton qui ouvre une session: `socket.data.compteId`. Avec un jeton mal formé, inconnu, expiré, présenté à un serveur sans comptes, ou si la base ne répond pas: **la connexion est refusée** avec une explication (`connect_error` côté client), jamais rabattue en invité.
- À **chaque entrée en partie** (rejoindre ou créer), le pseudo et le niveau du compte sont relus en base; le pseudo de la demande n'est pas lu, et peut manquer. La room retient le compte de chaque membre (`GameRoom`, à côté de l'état du moteur, qui n'en sait rien).
- L'identification étant asynchrone, la partie visée n'est cherchée ou créée qu'**après**, et la connexion est revérifiée au retour (fermée entre-temps, ou déjà entrée par une autre demande).
- La couche réseau ne connaît qu'une interface, `AnnuaireDesComptes` (trois questions); `Authentification` l'implémente avec la base.

## La règle retenue pour les pseudos des invités

**Les pseudos des comptes sont refusés aux invités**, comparés par `reperePseudo` (la règle d'unicité du salon), à l'entrée en partie. Motif rendu: « Ce pseudo appartient à un compte. Connectez-vous pour le prendre, ou choisissez-en un autre. »

Conséquences assumées, au journal: un invité déjà en partie sous un pseudo qui vient d'être inscrit le garde jusqu'à sa sortie; si la base ne répond pas, l'entrée d'un invité est refusée plutôt que laissée sans vérification. Écartée: marquer les invités partout où un pseudo s'affiche.

## Fichiers créés ou modifiés

Créés

- `packages/shared/src/comptes.ts`: contrats des comptes (demandes, `SessionOuverte`, `MaProgression`, `ROUTES_COMPTES`, `AuthentificationReseau`).
- `packages/shared/src/progression.ts`: `niveauDeXp`, provisoire.
- `packages/shared/src/comptes.test.ts`, `progression.test.ts`: validateurs des comptes, niveau.
- `packages/server/src/comptes/annuaire.ts`: interfaces `AnnuaireDesComptes` et `ServiceDeComptes`, et la forme des réponses.
- `packages/server/src/comptes/Authentification.ts`: inscription, connexion, déconnexion, progression, et l'annuaire, avec la base.
- `packages/server/src/comptes/motDePasse.ts`: hachage et vérification scrypt.
- `packages/server/src/comptes/jetons.ts`: fabrication d'un jeton, empreinte.
- `packages/server/src/comptes/limiteur.ts`: seaux à jetons par clé, avec oubli des clés redevenues pleines.
- `packages/server/src/comptes/routes.ts`: routes HTTP, codes, en-têtes, contrôle d'accès du navigateur, adresse du demandeur.
- `packages/server/src/base/sessions.ts`: ouvrir, retrouver, fermer une session en base.
- `packages/server/migrations/0001_authentification.sql` et `meta/`: tables `mots_de_passe` et `sessions`, écrites par drizzle-kit.
- `packages/server/src/comptes/motDePasse.test.ts`, `jetons.test.ts`, `limiteur.test.ts`, `routes.test.ts`: tests unitaires, sans base.
- `packages/server/src/ServeurSocket.comptes.test.ts`: couche réseau avec un annuaire en mémoire.
- `packages/server/src/GameRoom.comptes.test.ts`: comptes des membres et projection du salon.
- `tests/base/authentification.test.ts`: les tests d'intégration requis, contre Neon.

Modifiés

- `packages/shared/src/bornes.ts`: `BORNES_MOT_DE_PASSE`, `BORNES_JETON`, `LIMITES_COMPTES`.
- `packages/shared/src/entrees.ts`: `SessionJoueur.compte`, `CompteDeSession`; pseudo facultatif dans `DemandeRejoindre` et `DemandeCreation`.
- `packages/shared/src/evenements.ts`: `JoueurDuSalon.compte`, `CompteDuSalon`.
- `packages/shared/src/validation.ts`: pseudo facultatif des demandes d'entrée; `validerMotDePasse`, `validerDemandeInscription`, `validerDemandeConnexion`, `validerJeton`.
- `packages/shared/src/validation.test.ts`: une demande sans pseudo est désormais acceptée (le test qui l'interdisait est remplacé).
- `packages/shared/src/index.ts`: exports.
- `packages/server/src/base/schema.ts`: tables `motsDePasse` et `sessions`.
- `packages/server/src/base/comptes.ts`: `creerCompte` écrit l'empreinte dans la même transaction; `identifiantsParPseudo`, `profilDuCompte`.
- `packages/server/src/ServeurSocket.ts`: identification à l'ouverture, identité d'entrée (compte ou invité), revérification après l'attente; types `DonneesDeConnexion`.
- `packages/server/src/GameRoom.ts`: comptes des membres.
- `packages/server/src/instantane.ts`: `joueurDuSalon` projette le niveau, jamais l'identifiant du compte.
- `packages/server/src/serveur.ts`: options `comptes` et `mandatairesDeConfiance`; routes des comptes montées.
- `packages/server/src/fichiers.ts`: les routes des comptes passent avant les fichiers.
- `packages/server/src/principal.ts`: base et comptes si `DATABASE_URL`, `MANDATAIRES_DE_CONFIANCE`, fermeture de la base à l'extinction.
- `packages/server/src/index.ts`: exports et en-tête.
- `packages/server/src/ServeurSocket.test.ts`: la vérification de contrat « entrée sans pseudo » devient « pseudo d'un autre type ».
- `packages/client/src/interface/modeles/salon.ts`, `ecrans/salon.ts`, `page/styles/ecrans.css`: niveau d'un compte dans le salon; et leurs tests `modeles/salon.test.ts`, `ecrans/salon.test.ts`.
- `packages/client/src/reseauSocketIo.ts`: commentaire sur la reconnexion, qui renvoyait à l'étape 3.2 comme si elle la rendait possible.
- `tests/base/migrations.test.ts`: six tables.
- `package.json`, `pnpm-lock.yaml`: `socket.io-client` en dépendance de développement de la racine, parce que `tests/base/` l'importe.
- `CLAUDE.md`, `docs/design/README.md`, `docs/design/cadrage.md`, `docs/plan/etape-3-2.md`: documentation.
- `docs/handoffs/etape-3-2-handoff.md`: ce handoff.

## Tests

- Ajoutés:
  - **intégration contre Neon** (17): inscription (empreinte scrypt aux paramètres du projet, jeton jamais stocké, pseudo pris même écrit autrement, demande invalide sans écriture); connexion (identifiants valides, mauvais mot de passe et pseudo inconnu à la même réponse, compte sans mot de passe, tentatives répétées limitées même avec le bon mot de passe puis rétablies, limite par adresse); accès (progression refusée sans session ou avec un jeton inconnu, rendue avec son niveau, session fermée à la déconnexion, session expirée); réseau (compte sous son pseudo et son niveau, invité à côté d'un compte, pseudo d'un compte refusé à un invité, jeton inconnu ou fermé refusé à la connexion);
  - **couche réseau avec annuaire en mémoire** (16): entrée d'un compte, création sans pseudo, niveau vu des autres, départ, compte supprimé, invité sans pseudo, usurpation, serveur sans comptes, jetons refusés, panne à l'ouverture et à l'entrée, deux demandes coup sur coup, connexion fermée pendant la vérification;
  - **routes HTTP** (15), **hachage** (7), **jetons** (4), **limiteur** (5), **comptes dans la room** (5), **validateurs et niveau** (22), **salon du client** (2).
- Résultat: **1223 tests unitaires sur 1223** (76 fichiers), **39 tests de la base sur 39** (5 fichiers), **10 scénarios de bout en bout sur 10**, sans modification des scénarios.
- Couverture de `packages/sim` et `packages/shared`: **99,76 pour cent** (99,75 au handoff 3.1).
- Types (par `tsc` lancé directement, voir handoff 3.1), linter et formatage: verts.
- Caractérisation: non touchée, verte dans la suite unitaire.
- État de la CI: voir « État de la CI ».

## Décisions et écarts au plan

Huit décisions au journal du README, datées du 11 septembre 2026. Les écarts à la fiche sont dans sa section « Réconciliation pendant l'étape ». Trois points à lire ici.

### 1. Le niveau est provisoire

La fiche l'autorise à condition de le dire: **`niveauDeXp` rend `1 + floor(xp / 1000)`**. Les seuils réels sont à fixer à l'étape 3.3, avec les valeurs des récompenses, à faire valider par le porteur du projet. Remplacer la fonction suffit: serveur et client l'appellent.

### 2. La migration est appliquée à la base principale

`pnpm base:migrer` a appliqué `0000_schema_v1` et `0001_authentification` à la base de `DATABASE_URL`, comme le handoff 3.1 le prévoyait. Aucun compte n'y a été créé pendant la vérification.

### 3. Le salon du client affiche le niveau, sans écran de connexion

Le client n'a aucun moyen de se connecter (hors périmètre); un compte n'apparaît donc dans le salon du client que si un autre client s'est connecté. L'affichage existe et est testé, pour que la définition de terminé 4 tienne sans attendre la reprise des écrans.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **Les limites de tentatives vivent en mémoire de l'instance.** Suffisant pour un serveur unique. Plusieurs instances derrière un répartiteur multiplieraient la limite par leur nombre; il faudrait alors un stockage partagé (à regarder à l'étape 5.3).
- **Au déploiement (5.3), poser `MANDATAIRES_DE_CONFIANCE`** au nombre de mandataires de l'hébergeur, sans quoi tous les joueurs partagent l'adresse du mandataire, donc la limite par adresse. Et `ORIGINES_AUTORISEES` à l'origine du client.
- **Une session fermée ne coupe pas une connexion réseau déjà ouverte**: le compte est identifié à l'ouverture. Elle ne pourra plus en ouvrir d'autre. Sans gravité aujourd'hui; à reconsidérer si une suppression de compte ou une exclusion arrive.
- **Un même compte peut être dans deux parties à la fois** (deux onglets): rien ne l'interdit, et une même partie le refuse déjà par l'unicité des pseudos. L'étape 3.3 ajoutant les gains dans la transaction de chaque partie, deux parties simultanées ne s'effacent pas l'une l'autre.
- **Le client ne sait ni garder un jeton ni l'envoyer**: c'est la reprise des écrans du jalon 3 (écran de connexion, stockage du jeton, `auth` à l'ouverture de la connexion).

Repris du handoff 3.1: les **valeurs des récompenses** sont à faire valider par le porteur du projet à l'étape 3.3 (section 8 du cadrage), et désormais aussi **les seuils de niveau**. L'observation sur `rtk pnpm typecheck` tient toujours: les types ont été vérifiés par `tsc` lancé directement. Le reste: voir le handoff 4.4.

## État de la CI

À confirmer après la poussée du commit de cette étape.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 3.3, brancher la progression sur la fin de partie pour les joueurs qui ont un compte (XP, niveau, pièces, points de ligue, rang) et enregistrer leurs résultats. C'est la section 3 du ROADMAP qui la désigne: le jalon 3 enchaîne `3.1`, `3.2`, `3.3`.

Trois points à avoir en tête dès le début:

1. **Les comptes des joueurs d'une partie sont déjà connus de la room**: `GameRoom.joueurs[i].compte` porte `{ id, niveau }` pour un compte, rien pour un invité. C'est de là que la fin de partie tire qui reçoit un résultat.
2. **Le niveau est provisoire** (`niveauDeXp` dans `packages/shared/src/progression.ts`): la fiche 3.3 fixe les vrais seuils avec les valeurs des récompenses, à faire valider par le porteur du projet avant de les coder.
3. **Les gains s'ajoutent dans la transaction de `enregistrerPartie`**, jamais par `ecrireProgression`, qui remplace les valeurs (handoff 3.1).

## Étape suivante

Fiche à lire: `docs/plan/etape-3-3.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`.
