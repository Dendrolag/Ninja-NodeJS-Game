# Handoff - Étape 3.6 Les amis

Date: 26 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Deux comptes peuvent devenir amis, par une demande acceptée, depuis un écran Amis (par pseudo) ou depuis la fiche d'un joueur rencontré au salon ou à la fin; l'amitié se retire, un compte se bloque; la fiche d'un ami montre les parties jouées ensemble et le face-à-face.

## Ce qui a été fait

- **La fiche** `docs/plan/etape-3-6.md`, rédigée selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.6 du ROADMAP et de l'étude des amis. Quatorze décisions de conception, aucune soumise au porteur du projet: l'étude, qu'il a validée, fixait le besoin.
- **Trois tables** (`amities`, `demandes_d_ami`, `blocages`, migration `0008_amities`), en cascade sur `comptes`. Une amitié se range une fois, le plus petit identifiant d'abord, contrainte à l'appui.
- **Les règles en fonctions pures** (`comptes/amities.ts`): à partir des faits entre deux comptes, `deciderDuGeste` dit si un geste est permis et quelles écritures il fait; `relationVue` dit ce qu'un compte est pour l'autre. Sept gestes, tous idempotents: demander (une demande croisée vaut acceptation), accepter, refuser, annuler, retirer, bloquer, débloquer. Bornes: 200 amis de chaque côté, 50 demandes en attente, 10 demandes par minute, et 30 gestes puis un par seconde.
- **Le blocage silencieux**: le bloqué n'apprend jamais qu'il l'est. Sa demande est enregistrée et reste « envoyée » de son côté; le bloqueur ne la voit pas, ne peut pas l'accepter, et débloquer l'efface.
- **La base applique ces règles sous verrou** (`base/amities.ts`): une transaction verrouille les deux comptes dans l'ordre de leurs identifiants (`for no key update`, qui n'arrête pas l'enregistrement d'une partie), lit les faits en une requête, demande la décision, écrit. Deux demandes croisées au même instant font une amitié, et aucune borne ne se dépasse. La liste, triée par pseudo, et le face-à-face (jointure de `resultats` sur elle-même, égalités exclues).
- **Deux routes** `GET` et `POST /api/comptes/amis` (`{ geste, pseudo }`), motif `gesteImpossible` en 409. La réponse d'un geste rend le pseudo du compte visé dans son écriture, la relation qui en résulte et la liste à jour.
- **La fiche joueur** gagne `relation` et, pour un ami seulement, `ensemble` (parties jouées ensemble, « Vous devant », « Bob devant »). Sa fenêtre gagne une section Amitié (la relation en une phrase, les gestes qu'elle permet, ceux qui défont tenus à part) et une section Ensemble. C'est par elle qu'on ajoute un joueur rencontré au salon ou à la fin.
- **L'écran Amis**, cinquième destination de la navigation, entre Créer et Profil, avec une pastille qui compte les demandes reçues (« Amis, 1 demande reçue » pour un lecteur d'écran): « Ajouter par pseudo », demandes reçues (Accepter, Refuser, Bloquer), amis, demandes envoyées (Annuler), comptes bloqués (Débloquer). Chaque pseudo ouvre la fiche. Un invité est mené à la connexion.
- **La liste se relit** à l'ouverture d'une session de compte, à chaque navigation et au retour d'une partie. Les lectures sont numérotées: un geste fait pendant une lecture rend la liste à jour, et la lecture partie avant lui ne la remplace plus.
- **Trois défauts trouvés en route et corrigés avant commit** (règle 7): l'annonce d'un geste reprenait l'écriture tapée (« bob ») au lieu de celle du compte (le scénario de bout en bout l'a montré), d'où le pseudo dans la réponse; une lecture de la liste partie avant un geste pouvait réafficher l'ancienne liste, d'où la numérotation; et « Demande envoyée à Léa B.. » doublait la ponctuation d'un pseudo finissant par un point, d'où « Votre demande à Léa B. est envoyée. ».

Ni `packages/sim`, ni le transport, ni les règles de jeu ne changent.

## Fichiers créés ou modifiés

- `packages/shared/src/comptes.ts`: la route `amis`, `GESTES_D_AMITIE`, les types `GesteDAmitie`, `DemandeDeGeste`, `RelationDAmitie`, `FaceAFace`, `PersonneListee`, `ListeDAmis`, `ReponseDeGeste`; `FicheJoueur.relation` et `ensemble`. `bornes.ts`: `BORNES_AMITIES`, deux limites. `validation.ts`: `validerDemandeDeGeste`. `index.ts`: les exports.
- `packages/server/src/base/schema.ts`: les trois tables. `migrations/0008_amities.sql` et `meta/` (drizzle-kit). `base/amities.ts` (créé).
- `packages/server/src/comptes/amities.ts` (créé): les règles. `Authentification.ts`: `amis`, `gesteDAmitie`, la relation et le face-à-face de la fiche, deux limiteurs. `annuaire.ts`, `routes.ts`, `index.ts`.
- `tests/outils/comptes-en-memoire.ts`: les amitiés par les mêmes règles, les placements par partie pour le face-à-face.
- `packages/client/src/comptes/api.ts`: les requêtes `amis` et `gesteDAmitie`, `LISTE_D_AMIS_VIDE`. `comptes/session.ts`: `chargerLesAmis`, `faireUnGeste`, la relecture de la fiche d'un joueur devenu ami. `client.ts`: la relecture à la navigation et au retour d'une partie. `etat.ts`, `actions.ts`, `reduction.ts`, `ecrans.ts`: l'état des amis, ses six actions, l'écran `amis`.
- `packages/client/src/interface/modeles/amis.ts` (créé), `fiche.ts`, `navigation.ts`. `composants/gestesDAmitie.ts` (créé), `ficheJoueur.ts`, `navigation.ts` (pastille). `ecrans/amis.ts` (créé). `application.ts`. `icones.ts`: le pictogramme `amis`.
- `packages/client/page/styles/composants.css`, `ecrans.css`: bouton compact, section Amitié, pastille, écran Amis.
- `playwright.config.ts`: le scénario des amis, joué par le seul projet bureau.
- Documentation: `docs/plan/etape-3-6.md` (créée), `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/design/cadrage.md` (navigation, section Amis), `docs/design/etude-amis-et-fiche-joueur.md` (statut), `CLAUDE.md` (une ligne), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - partagé: la validation d'un geste (sept gestes, geste inconnu, pseudo mal formé, champs ignorés);
  - serveur, sans base: les règles (`amities.test.ts`, 28 cas: chaque geste depuis chaque relation, demandes croisées, bornes des deux côtés, soi-même, blocage dans les deux sens, déblocage, faits après écriture); les deux routes (200, 401, 400, 404, 409, 429, 503);
  - base (`tests/base/amis.test.ts`, 17 cas): contraintes des trois tables, cascade, demande et acceptation vues des deux côtés, demandes croisées, demandes croisées simultanées qui ne font qu'une amitié, refus, annulation et retrait silencieux, acceptation sans demande, blocage silencieux de bout en bout, demandes défaites dans les deux sens, 200 amis de chaque côté, 50 demandes, limites des demandes et des gestes, refus sans session, geste mal formé, soi-même, pseudo inconnu, liste triée avec niveau, face-à-face sans les égalités réservé aux amis, routes de bout en bout; `fiche.test.ts` et `migrations.test.ts` suivent;
  - client: requêtes, réduction (lecture numérotée, geste, fiche qui suit, pseudo du compte, sortie, changement de session, invité), session (lecture à l'ouverture, à la navigation et au retour, geste, refus, session expirée en partie et hors partie, relecture de la fiche, course entre lecture et geste), modèles (gestes par relation, phrases, annonces, sections, pastille), écran Amis et fiche dans un document;
  - bout en bout (`tests/e2e/amis.spec.ts`, bureau): par pseudo (demande, pastille, acceptation, retrait depuis la fiche), et au salon (ajout et acceptation depuis les fiches, partie courte, une partie ensemble sur la fiche).
- Résultat: `pnpm verify` en local, 2 754 tests unitaires et d'intégration au vert (99 de plus qu'au handoff 3.5), 92 sautés (base Neon absente). **Les tests de la base ont tourné en local cette fois**, contre un PostgreSQL 16 du conteneur (voir plus bas): 91 sur 92, le seul échec étant un écart connu de version. Bout en bout en local: 55 scénarios au vert, plus un (le HUD en partie sur mobile) tombé au délai de 30 s pendant que les tests unitaires tournaient en même temps sur la machine, vert rejoué seul (23,6 s); banc de rendu vert.
- Couverture de packages/sim: inchangée, aucun code du paquet touché.
- État de la CI: **verte sur `2dbc803`** (run `36247579982`) du premier coup, tests de la base Neon compris, 59 scénarios de bout en bout sur 59 sans relance. Mise en ligne sautée: la branche n'est pas `master`.

## Décisions et écarts au plan

1. **L'ajout depuis le salon et la fin passe par la fiche**, pas par un bouton sur chaque ligne (l'étude, 3.2, proposait le bouton): seule la fiche connaît la relation, et une ligne proposerait « Ajouter » pour un ami de longue date.
2. **Un seul point d'entrée pour les sept gestes** (`POST /api/comptes/amis`), et non une route par geste: une seule validation, et le contrôle d'accès du navigateur n'autorise que `GET` et `POST`.
3. **La pastille ne se met pas à jour en direct**: la liste se relit à chaque navigation. Le direct touche la couche réseau, que l'étape `2.8` ouvre de toute façon; l'étude (4.4) le range avec la présence.
4. **Pas de confirmation avant de retirer ou de bloquer**: débloquer défait un blocage, et une amitié retirée se redemande. Le porteur du projet peut en vouloir une.
5. **Sur l'écran Amis, les lignes d'amis n'ont pas de bouton**: retirer et bloquer un ami passent par sa fiche, un clic plus loin. Les demandes reçues, elles, se bloquent depuis la liste, contre un importun.
6. **Les demandes ignorées d'un bloqué comptent dans ses 50 en attente**: les en retirer lui dirait qu'il est bloqué.
7. **Aucune borne sur le nombre de comptes bloqués**: la clé primaire le limite au nombre de comptes, et la limite des gestes à un par seconde.
8. **Écart de branche**, comme aux étapes 2.7 et 3.5: la session travaille sur la branche imposée `claude/etape-3-6-ua1mla`, repartie de `master`, et non directement sur `master`. Le porteur du projet a demandé la fusion le 26 septembre 2026: la branche a rejoint `master` en avance rapide, et part en ligne avec la CI de `master`, migration `0008` comprise.

## Problèmes connus et dette

- **Tests de la base en local, sans Neon**: le conteneur de cette session a un PostgreSQL 16. Démarré à la main (`initdb`, `pg_ctl` sur le port 5433), avec une configuration Vitest hors dépôt qui fournit `adresseBase` après `appliquerMigrations`, il fait tourner `tests/base` en quelques secondes. Seul écart: `parties.test.ts` attend le code `23001` pour une suppression refusée par `on delete restrict`, que PostgreSQL 16 rend en `23503`; Neon, plus récent, rend `23001`, et le code de production n'en dépend pas. Rien de cela n'est dans le dépôt; si l'outil sert encore, il mériterait une étape (une variable d'environnement lue par `branche-de-test.ts`).
- **Playwright en local**: le dépôt attend un Chromium plus récent que celui du conteneur; un lien vers celui installé (`/opt/pw-browsers`) a suffi, hors dépôt.
- **Le scénario mobile du HUD en partie** (`peaufinage.spec.ts`) prend 23,6 s sur un délai de 30 s en local; sous charge, il le dépasse. La CI joue un scénario à la fois; à surveiller seulement.

## Prochaine action exacte

Exécuter l'étape `2.8`, la présence et les invitations entre amis: rédiger sa fiche selon le cas de repli du PROTOCOLE, à partir de l'entrée 2.8 du ROADMAP et de la section 4.4 de `docs/design/etude-amis-et-fiche-joueur.md`. Elle y ajoutera aussi la pastille poussée en direct (décision 3 ci-dessus).

## Étape suivante

Fiche à lire: `docs/plan/etape-2-8.md`, à rédiger au début de l'étape (cas de repli du PROTOCOLE).
