# Handoff - Étape 7.1 Mode tactique

Date: 14 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Ajouter au jeu son deuxième mode, le mode Tactique: on y capture par un cône directionnel à charges limitées, au lieu de capturer en touchant. Première application réelle du principe des modes enfichables, et première étape du jalon 5.

## Ce qui a été fait

- **La fiche, rédigée selon le cas de repli du PROTOCOLE** (`docs/plan/etape-7-1.md`), après quatre décisions de jeu posées au porteur du projet le 12 septembre 2026: le cône seul capture; les valeurs de la v0.9.0 (90 degrés, 100 pixels, cinq charges, une toutes les cinq secondes, tir sans effet gratuit); visée dans la direction du dernier déplacement; bouton de capture au tactile. L'étape ouvre une phase 7, « Modes de jeu », dans la carte thématique du ROADMAP.
- **Lot A, le moteur.** Un mode est désormais un jeu de règles (`JeuDeRegles`): il agit sur les entrées du battement, puis résout les contacts. Le Tactique (`packages/sim/src/tactique.ts`) oriente ses joueurs, recharge leurs charges et joue leurs tirs; ses contacts ne capturent rien, mais les bots se transmettent toujours leur couleur et un invincible détruit toujours un bot noir. L'état tactique vit à part, dans `EtatPartie.tactique`, absent d'une partie Classique.
- **Lot B, le réseau.** Événement montant `capturer`, avec sa famille de débit; `GameRoom` joue la demande au battement suivant, une seule fois. Flux d'état en version 2: chaque joueur d'une partie Tactique porte son orientation, ses charges et l'attente de la prochaine. Notification `tirDeCapture` à toute la partie. Migration de l'énumération `mode_de_jeu`.
- **Lot C, la page.** Création d'une partie Tactique; barre d'espace; bouton Capturer avec les charges; cône de visée et éclair des tirs; son de notre tir qui capture; règle de capture du mode au salon et dans l'aide.
- **Lot D, bout en bout et mesure.** Scénario `tests/e2e/tactique.spec.ts`, en bureau et en fenêtre mobile. Le banc du battement accepte un mode (`pnpm charge --banc --mode tactique`); section 13 de `docs/mesures/charge-serveur.md`.

## Les chiffres clés

| Grandeur                                | Classique       | Tactique        |
| --------------------------------------- | --------------- | --------------- |
| Battement du banc, 150 bots, 12 joueurs | 0,403 ms        | 0,409 ms        |
| p99 du battement, 150 bots              | 0,781 ms        | 0,865 ms        |
| Octets par message, 50 / 150 / 300 bots | 230 / 464 / 799 | 254 / 481 / 820 |
| Parties pleines par cœur au banc        | 86              | 85              |

Même machine qu'aux étapes 5.1, 5.2 et 2.3 (AMD Ryzen 7 3800X, Windows 11 Pro, Node.js 24.16.0). Les tailles Classique sont celles de l'étape 2.3, à l'octet: le mode n'a rien coûté au Classique. L'empreinte du jeu des quatre parties de `tests/charge/empreinte.ts` est restée identique à chaque lot.

## Fichiers créés ou modifiés

Créés

- `packages/sim/src/tactique.ts`, `tactique.test.ts`: le jeu de règles Tactique et ses tests.
- `packages/server/migrations/0002_mode_tactique.sql`, `meta/0002_snapshot.json`: la migration.
- `tests/e2e/tactique.spec.ts`: le scénario de bout en bout.
- `docs/plan/etape-7-1.md`: la fiche.
- `docs/mesures/charge-serveur-7-1-classique.json`, `charge-serveur-7-1-tactique.json`: chiffres bruts.
- `docs/handoffs/etape-7-1-handoff.md`.

Modifiés

- `packages/sim/src/moteur.ts`, `contacts.ts`, `etat.ts`, `index.ts`, `modes.test.ts`: jeu de règles par mode, règle de contacts Tactique, état et événement du tir.
- `packages/shared/src/constantes.ts`, `index.ts`, `evenements.ts`, `flux.ts`, `bornes.ts`, `flux.test.ts`: mode, capacité et constantes `TACTIQUE`, `Orientation`; contrat `capturer` et `tirDeCapture`; flux version 2; famille de débit.
- `packages/server/src/GameRoom.ts`, `ServeurSocket.ts`, `instantane.ts` et leurs tests: demande de tir, gestionnaire, projection et notification.
- `packages/client/src`: `controles/` (touches, controles, clavier, tactile), `client.ts`, `faits.ts`, `annonces.ts`, `sons/declencheurs.ts`, `hud/` (modele, surcouche), `rendu/` (scene, apparence, pixi, boucle), `interface/` (écrans et modèles de création, de salon, cartes, aide, jeu), `index.ts`, et leurs tests; `page/styles/jeu.css`, `ecrans.css`.
- `tests/client/integration/creation-serveur.test.ts`: la saisie de création porte un mode.
- `tests/charge/battement.ts`, `battement-isole.ts`, `charge.ts`, `battement.test.ts`: le banc accepte un mode.
- `tests/e2e/harnais/parcours.ts`, `parcours-solo.spec.ts`: mission d'approche; pas de bouton de capture en Classique.
- `docs/plan/ROADMAP.md` (sections 3, 4 et 5), `docs/plan/PROTOCOLE.md`, `CLAUDE.md`, `docs/design/README.md` (seize décisions), `docs/design/cadrage.md` (sections 1, 3, 4.1, 5 et 6), `docs/mesures/charge-serveur.md` (sections 10 et 13).

Aucune modification de `legacy/`, `tests/caracterisation/` ni `master`.

## Tests

- Ajoutés, par exigence de la fiche:
  - **géométrie du cône**: bornes exactes, huit orientations, cible confondue, les trois cas des tests de la v0.9.0 (`tactique.test.ts`);
  - **tir**: bots blancs et adverses, ni les siens ni les bots noirs; un joueur cède tous ses bots; un seul joueur par tir; protégé ou invincible épargné; tir sans effet gratuit; sans charge, pas de tir;
  - **recharge**: une charge par cinq secondes, plafond, indépendance du découpage de dt;
  - **visée**: orientation du déplacement réel, gardée à l'arrêt et après capture, commandes inversées;
  - **moteur**: demande jouée une fois; tirs croisés tirés au sort; pause; déterminisme; Classique sans trace tactique;
  - **réseau** (`ServeurSocket.test.ts`, `GameRoom.test.ts`): annonce à la salle et charges dans le flux; demande jouée une fois sans nouveau message; débit; demande faite dans le salon ignorée; sans effet en Classique; isolation entre parties;
  - **flux**: aller-retour, 400 battements de changements tactiques, apparition et disparition de l'état, gardes du décodage, version 1 refusée;
  - **base**: la migration s'applique sur une branche Neon neuve (projet `base`);
  - **client**: création, clavier, charges du HUD, cône et éclair, son, annonce, salon;
  - **bout en bout**: partie Tactique créée, approche, tir, capture, en bureau et en mobile.
- Résultat: **1 655 tests sur 1 655**, 112 fichiers, par `vitest run --coverage`. Types (paquets, tests, bout en bout), linter et formatage: verts.
- Bout en bout, en local: **14 scénarios sur 14**, bureau et mobile.
- Couverture: **99,83 pour cent** des instructions sur `sim` et `shared`; `sim` à 99,66 (99,63 au handoff 2.3), `shared` à 100.
- Aucune régression de caractérisation.

## Décisions et écarts au plan

Seize décisions au journal de `docs/design/README.md`, datées du 12 septembre 2026. Les écarts à la fiche sont dans sa réconciliation. Quatre points à lire ici.

### 1. Le mode est un jeu de règles, et son état vit à part

`REGLES_DES_MODES` associe à chaque mode `agir(etat, entrees, dt)`, joué avant le relevé des contacts, et `resoudreContacts`. Un tir n'est pas un contact: le faire passer par le relevé aurait inventé des contacts à distance. L'orientation et les charges ne sont pas dans `Joueur`: ajoutées à tous les joueurs, elles auraient changé l'état de chaque partie Classique, et l'empreinte n'aurait plus rien prouvé.

### 2. Les charges sont publiques

Elles voyagent dans le flux, pour toute la salle, comme l'invincibilité et la protection: elles changent l'issue d'une rencontre. La v0.9.0 ne montrait que ses propres charges. À rediscuter si le porteur du projet juge que voir un adversaire désarmé donne trop d'information.

### 3. Un tir ne coûte une charge que s'il capture

Écart assumé à la v0.9.0, qui débitait aussi un tir sur un joueur protégé: pour le joueur, un tir sans effet et un tir sans cible sont la même chose.

### 4. Deux tirs du même battement partent dans un ordre tiré au sort

Comme les duels de contacts: l'ordre d'arrivée donnerait au même joueur l'avantage toute la partie. Un joueur capturé par un tir perd le sien.

### Ce que cette étape rend structurellement impossible

- **Un mode oublié dans le moteur, le client ou la base**: `REGLES_DES_MODES`, `CAPACITES`, `NOMS_DES_MODES` et les tables du client sont indexées par tous les modes, et la CI régénère les migrations.
- **Une partie Classique modifiée par l'arrivée d'un mode**: son état ne porte aucun champ tactique, ce que l'empreinte des parties vérifie.
- **Un tir rejoué**: la demande est effacée à chaque battement, dans la room comme dans les contrôles du client.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **`rtk pnpm typecheck` ne vérifie rien.** Le hook RTK de cette machine répond « aucune erreur » sans lancer le script: ni compilation, ni vérification des types des tests. Le commit du lot A (`98295f6`) est parti avec deux erreurs de types, relevées par la CI et corrigées par `3830a5e`. Pour vérifier, appeler `node node_modules/typescript/bin/tsc --build`, puis `-p tsconfig.tests.json` et `-p tsconfig.e2e.json`, et `node node_modules/vitest/vitest.mjs run`.
- **Couverture des branches de `flux.ts`: 95,9 pour cent.** Plusieurs gardes sont inatteignables par construction, par exemple l'ancien élément d'un joueur qui ne serait pas un joueur (un changement d'élément suppose la même nature).
- **Le banc Tactique tire plus souvent qu'un vrai joueur**, à chaque changement de cap: sa mesure est une borne haute du coût du tir.
- **Le scénario de bout en bout Tactique rejoue son approche** quand un tir manque; sur une machine d'intégration très lente, il peut demander plusieurs essais.
- **La charge du serveur complet en Tactique n'est pas mesurée**: le banc montre qu'une partie coûte le même temps (section 13.4 du rapport).

Repris des handoffs précédents, inchangé: le filtrage du flux par zone d'intérêt écarté par la mesure; le scénario mobile « capturer un faux ninja » fragile quand douze scénarios jouent en parallèle en local; le seuil de taille du flux étroit en CI; relevé des contacts et lissage du client en carré du nombre d'entités; la mesure du client ne reproduit ni carte graphique ni téléphone; `app.js` à vérifier compressé au déploiement (5.3); les erreurs d'un travailleur échappent aux scénarios; continuer en invité laisse la session ouverte côté serveur; la liste des parties ne se rafraîchit pas d'elle-même; aucune gestion du mot de passe; un échec d'enregistrement n'est pas retenté; poser `MANDATAIRES_DE_CONFIANCE` et `ORIGINES_AUTORISEES` au déploiement (5.3).

## État de la CI

- `bb66827` (fiche): **verte**.
- `98295f6` (lot A): **rouge**, exécution 34683513456, vérification des types de deux tests; corrigée par `3830a5e`, dont l'exécution a été annulée par la poussée suivante.
- `2bcd9ad` (lot B, qui porte aussi la correction): **verte**.
- `98e9767` (lot C): **verte**, exécution 34685171494.
- `402a6f0` (lot D): **verte**, exécution 34685808712, « Types, linter et tests » et « Bout en bout ».
- `460a9b6` (handoff, et correction de la zone d'invisibilité): **verte**, exécution 34819224265, « Types, linter et tests » et « Bout en bout ».

`master` n'a pas été touché. Aucune fusion de `reecriture` avant l'étape 6.1.

## Prochaine action exacte

La section 3 du ROADMAP place ensuite, au jalon 5, « les autres modes », puis `5.3` et `6.1`. **Aucun autre mode n'est validé**: Chasse, Battle Royale, Équipes et Chaos sont des propositions de la maquette (cadrage, tension 2).

Dans une conversation neuve, la première chose à faire est donc de **poser la question au porteur du projet**: quel mode construire ensuite, s'il y en a un, avec quelles règles. C'est une condition d'arrêt du PROTOCOLE (une décision de jeu qu'aucun document ne tranche). Si aucun mode n'est retenu, passer à **l'étape 5.3, déploiement** (`docs/plan/etape-5-3.md`), en réconciliant sa fiche avec l'état du dépôt.

## Étape suivante

Fiche à lire: `docs/plan/etape-5-3.md`, sauf si le porteur du projet retient un autre mode, qui recevra alors sa fiche selon le cas de repli, en phase 7.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`.
