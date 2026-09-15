# Handoff - Étape 2.6 Lien perdu hors partie

Date: 15 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Hors d'une partie en cours, une page qui perd son lien avec le serveur le rétablit d'elle-même, sans rechargement, et dit au joueur ce qui se passe.

## Ce qui a été fait

- **Trois décisions du porteur du projet au début de l'étape**, parmi les voies présentées: dans le salon, retour automatique (plutôt que l'accueil ou une place gardée côté serveur); hors partie, le joueur reste sur son écran (plutôt que l'accueil ou le silence les premières secondes); quatre-vingt-dix secondes d'essais puis un bouton (plutôt que des essais sans limite).
- **Fiche rédigée au début de la session** (`docs/plan/etape-2-6.md`, commit `9aa806d`), selon le cas de repli du PROTOCOLE, puis réconciliée en fin d'exécution (six écarts, voir « Décisions »).
- **Le rétablissement** (`packages/client/src/retablissement.ts`): `retour.ts` reste seul à décider de la perte du lien et lui passe la main hors d'une partie en cours, ou quand le délai de retour s'écoule. La page rouvre le lien aussitôt, avec la session gardée, puis toutes les trois secondes pendant une minute et demie à compter de la perte; au-delà, la perte est définitive et « Réessayer » relance une série. Le réveil du serveur se tait pendant ce temps. La page réessaie aussi dès qu'elle revient au premier plan ou que le navigateur retrouve le réseau (`principal.ts`). Un refus du serveur lui-même arrête tout et se dit.
- **Le joueur reste sur son écran**: nouvel état du lien `retablissement`; les actions `lienPerdu` et `salonRedemande`; une perte définitive ou un refus ne quittent que les écrans de partie. La place en partie perdue au bout du délai de retour ramène à l'accueil avec un avis, et le lien continue d'être rétabli.
- **Dans le salon**, qui reste affiché sous « Connexion perdue. Retour dans le salon… », lancer, régler et écrire sont suspendus; au retour du lien, la page redemande à entrer par le code (partie privée) ou l'identifiant (publique), sous le pseudo retenu. Refusée, l'accueil dit « Le salon n’a pas pu être retrouvé. » avec le motif.
- **Une ligne d'état commune** (`interface/modeles/lien.ts`, `interface/composants/lien.ts`) dit le lien sur tous les écrans hors de l'accueil et du jeu, avec les mots et les boutons de l'accueil, qui la calcule de la même façon. Elle remplace le « Connexion au serveur… » propre à la liste des parties, qui se redemande à l'établissement du lien.
- **Défaut corrigé en route (règle 7): un message émis sans lien partait sur le lien suivant.** Socket.IO garde ce qui est émis sans lien; le transport l'écarte désormais, et son banc d'essai aussi.
- **Défaut corrigé en route (règle 7): l'arrêt du serveur restait suspendu avec une page ouverte.** Trouvé à la vérification à l'écran, reproduit en Node (une connexion ouverte sans requête retient `server.close()`, et `io.close()` l'attend). Le serveur cesse d'écouter, coupe le jeu, laisse cinq secondes aux réponses en cours, puis ferme le reste (`packages/server/src/serveur.ts`).
- **Documentation**: quatre décisions au journal de `docs/design/README.md`, étape terminée et décision reportée au ROADMAP, grille de recette 5.4, `docs/deploiement.md` (les pages ouvertes après une mise en ligne).

## Fichiers créés ou modifiés

Commit `9aa806d`: `docs/plan/etape-2-6.md` (créé), la fiche.

Commit du lien perdu hors partie:

- `packages/client/src/retablissement.ts` et `retablissement.test.ts` (créés): le rétablissement.
- `packages/client/src/retour.ts` et test: passe la main au rétablissement au lieu de perdre le lien.
- `packages/client/src/reveil.ts`: muet pendant un rétablissement.
- `packages/client/src/etat.ts`, `actions.ts`, `reduction.ts`, `ecrans.ts`: l'état `retablissement`, les actions `lienPerdu` et `salonRedemande`, `connexionPerdue` avec avis, une perte ou un refus qui ne quittent que les écrans de partie. `reduction.retablissement.test.ts` (créé), `ecrans.test.ts`, `parties.test.ts` adaptés.
- `packages/client/src/client.ts`: le rétablissement branché, « Réessayer » après une perte, quitter qui renonce au salon, liste des parties demandée avec un lien, `surReseauRetrouve`. `client.test.ts` adapté.
- `packages/client/src/principal.ts`: premier plan et réseau retrouvé.
- `packages/client/src/reseau.ts`, `reseauSocketIo.ts`: rien ne part sans lien. `controles/controles.test.ts`: le lien est établi avant les touches.
- `packages/client/src/interface/modeles/lien.ts`, `lien.test.ts`, `interface/composants/lien.ts`, `lien.test.ts` (créés): la ligne d'état commune.
- `packages/client/src/interface/modeles/accueil.ts` et test, `interface/ecrans/accueil.ts`: l'accueil calcule son lien avec le modèle commun; « Réessayer » à la place de « Recharger la page » après une perte.
- `packages/client/src/interface/modeles/salon.ts` et test, `interface/ecrans/salon.ts`, `interface/composants/chat.ts`: lancer, régler et écrire suspendus sans lien.
- `packages/client/src/interface/modeles/fin.ts` et test, `interface/ecrans/fin.ts`: « Rejouer » attend le lien.
- `packages/client/src/interface/ecrans/parties.ts`, `packages/client/page/styles/ecrans.css`: la ligne propre aux parties retirée, le style de la ligne commune.
- `packages/client/src/interface/application.ts` et test: la ligne d'état montée; le salon gardé pendant une coupure.
- `packages/client/src/index.ts`: exports.
- `packages/server/src/serveur.ts`, `serveur.arret.test.ts` (créé): l'arrêt qui n'attend plus les connexions ouvertes d'avance.
- `tests/client/integration/client-serveur.test.ts`: quatre tests contre un vrai serveur.
- `tests/e2e/lien.spec.ts` (créé), `tests/e2e/harnais/serveur-de-jeu.ts` (éteindre, rallumer), `playwright.config.ts` (projet bureau).
- `docs/design/README.md`, `docs/plan/ROADMAP.md`, `docs/plan/etape-2-6.md`, `docs/recette/recette-5-4.md`, `docs/deploiement.md`.

Commit de ce handoff: `docs/handoffs/etape-2-6-handoff.md` (créé).

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/sim`.

## Tests

- Ajoutés:
  - **rétablissement** (20): écran et saisie gardés, lien rouvert aussitôt avec la session gardée; essais toutes les trois secondes sans le réveil, perte au bout de la minute et demie sans essai planifié; « Réessayer » et premier plan retrouvé qui relancent, sans doubler un essai en route; refus du serveur qui arrête tout; liste des parties gardée et redemandée, jamais demandée sans lien; salon gardé sans son décompte, redemandé par l'identifiant, par le code, sans pseudo pour un compte; salon disparu dit sur l'accueil; réponse d'un lien retombé ignorée; quitter pendant la coupure ou pendant la demande; salon oublié au bout de la minute et demie ou sur un refus; fin gardée sans rien redemander; place perdue au bout du délai de retour, puis rétablissement jusqu'à la minute et demie;
  - **état** (11): écran, saisie, salon et messages gardés, décompte effacé, jeu quitté avec l'avis, salon redemandé jusqu'à la réponse, session qui rouvre sans interrompre, perte et refus selon l'écran; transitions d'écran de ces actions;
  - **modèles et document**: ce qu'on dit du lien et quand la ligne se montre; accueil en rétablissement et après une perte; salon et fin suspendus; ligne d'état (cachée, rétablissement, perte et « Réessayer », page d'une autre version); application: salon gardé, contrôles suspendus puis rendus, accueil rétabli sans recharger; client: rien n'est émis sans lien;
  - **serveur** (2): une connexion ouverte sans requête ne retient pas l'arrêt; une réponse en cours part avant, et plus rien n'est accepté ensuite;
  - **intégration contre un vrai serveur** (4): lien coupé par le serveur sur l'accueil, rétabli, et entrée possible; joueur coupé dans un salon privé qui y revient sous un nouvel identifiant, et que l'hôte revoit; salon disparu dit sur l'accueil; message émis sans lien qui ne part pas sur le lien suivant;
  - **bout en bout** (`tests/e2e/lien.spec.ts`): sur l'accueil, serveur éteint puis rallumé sur le même port; la page le dit, ne propose pas de recharger, retrouve le lien sans rechargement (témoin posé dans la page), garde le pseudo et entre dans un salon.
- Tests existants adaptés au nouveau comportement: accueil, transitions d'écran, liste des parties, client, retour (trois tests), application, contrôles (deux tests, lien établi d'abord).
- Résultat: **1 954 tests unitaires sur 1 954** (projet `unitaires`, 1 900 au handoff 3.4); types des paquets, des tests et du bout en bout compilés en appelant tsc directement, linter et formatage verts.
- Bout en bout en local: **28 sur 28** en un passage complet, trois scénarios à la fois (2,5 minutes), sur l'état du commit, après la correction de l'arrêt du serveur.
- À l'écran, par un script Playwright temporaire sur le serveur de test sans base, supprimé ensuite: le salon sous « Connexion perdue. Retour dans le salon… » avec « Réglages » grisé; l'accueil après le retour du serveur, « Le salon n’a pas pu être retrouvé. Cette partie n’existe plus. », pseudo gardé; l'accueil sous « Connexion perdue. Reconnexion… »; la liste des parties avec la ligne d'état, au bureau et sur un écran de 390 pixels, puis la ligne effacée au retour du lien. C'est ce script qui a fait trouver l'arrêt suspendu du serveur, dont le correctif a été vérifié par lui: arrêt en moins d'une milliseconde avec la page ouverte, contre plus de dix secondes avant.
- Couverture des instructions, relevée dans `coverage/clover.xml`: `sim` à **99,78 pour cent** (1 811 sur 1 815; 99,77 annoncé au handoff 3.4, aucun code du moteur touché: écart d'arrondi du relevé), `shared` à **100**, ensemble 99,90.
- Aucune régression de caractérisation. `packages/sim` non touché.

## Décisions et écarts au plan

Quatre entrées au journal de `docs/design/README.md`, datées du 15 septembre 2026: le lien rétabli hors partie, le retour dans le salon, le message émis sans lien, l'arrêt du serveur. Points à lire ici.

### 1. Écarts à la fiche

Réconciliés dans la fiche elle-même (section « Réconciliation en cours d'exécution »): l'arrêt du serveur corrigé hors du périmètre prévu; le banc d'essai du transport qui perd lui aussi les messages sans lien; une session qui rouvre le lien sans interrompre le rétablissement; la ligne d'état qui dit aussi l'établissement du lien et le réveil; le scénario de bout en bout qui éteint et rallume le serveur; la vérification à l'écran par un script temporaire.

### 2. Ce que les tests ont attrapé avant tout commit

- Onze tests existants décrivaient l'ancien comportement (lien perdu, retour à l'accueil, « Recharger la page »); ils décrivent le nouveau. Deux tests des contrôles appuyaient sur une touche sans lien: le banc d'essai, devenu fidèle, n'envoyait plus rien.
- Un test neuf du rétablissement attendait qu'aucune minuterie ne reste sur l'écran des parties, qui planifie son propre rafraîchissement: il se joue sur l'écran de création.
- Le premier correctif de l'arrêt fermait les connexions après `io.close()`, qui attend lui-même leur fermeture: il restait suspendu. Le test du serveur l'a montré; l'ordre est corrigé.

### 3. Ce qui n'a pas été fait, volontairement (hors périmètre de la fiche)

Garder la place ou le rôle d'hôte dans le salon côté serveur; montrer aux autres qu'un joueur a perdu son lien; raccourcir les battements de Socket.IO; revenir en partie après le délai de retour.

## Problèmes connus et dette

Limites assumées, relevées par cette étape:

- **Un hôte seul dans son salon le perd avec son lien.** Le serveur détruit un salon vide dès le départ de son dernier joueur (étape 2.1): le rétablissement ne trouve plus rien, et l'accueil le dit. Garder le salon côté serveur a été écarté par le porteur du projet.
- **Un joueur revenu dans le salon n'en est plus l'hôte** si un autre joueur y était: la main est passée au plus ancien présent, comme à tout départ (comportement à préserver 8).
- **Revenir dans le salon passe par les mêmes contrôles qu'une entrée**: un pseudo pris entre-temps, une partie pleine ou lancée entre-temps refusent le retour, avec leur motif.

Repris du handoff 3.4, inchangé: l'écoute des sessions fermées et les limites de tentatives vivent dans le processus; fermer la fenêtre du code de secours vaut « noté »; l'échec isolé, non reproduit, du test des routes des comptes; le serveur de développement local parle à la base de production (question au porteur du projet). Repris du handoff 2.5: jusqu'à 45 secondes pour constater une coupure silencieuse. Repris du handoff 6.1: la pluie coûte au chargement du décor; un point flottant manqué une fois en jeu; la fluidité et le lancement sur iPhone restent à confirmer sur un vrai téléphone; en haut ou en bas de la carte, le joueur passe sous le HUD sur téléphone; les erreurs d'un travailleur échappent aux scénarios de bout en bout; le relevé des contacts et le lissage du client restent en carré du nombre d'entités; l'outil de Vercel est téléchargé par npx à chaque mise en ligne; des déploiements Vercel non promus restent de la première mise en ligne; le jeton Vercel expire le 14 septembre 2027. Les sons et la musique restent à écouter par le porteur du projet (cas C21 de la grille de recette).

Résolu par cette étape: un lien perdu hors partie qui ne se rétablissait pas (handoffs 5.4, 2.5 et 3.4), dont la page coupée parce que la session de son compte a été fermée, qui voit désormais le refus de sa session et peut continuer en invité.

## État de la CI

- `9aa806d` (fiche): documentation seule.
- `8fd29cf` (lien perdu hors partie), poussé avec la fiche: **verte**, exécution 34994923148: « Types, linter et tests » (2 min 3 s), « Bout en bout » (8 min 20 s) et **« Mise en ligne »** (2 min 17 s), partie puisque le jeu a changé depuis `4cce16e`.
- Vérifié ensuite depuis la machine de développement: `https://neon-ninja.onrender.com/sante` rend la version `8fd29cf47bfa5cdac21f5f490c85e4e5c23be1b0`; `https://neon-ninja-jeu.vercel.app/` répond 200, et son `app.js` porte ce commit et le texte « Connexion perdue. Retour dans le salon ».
- Le commit de ce handoff ne touche que la documentation: sa mise en ligne doit s'arrêter d'elle-même, la production restant sur `8fd29cf`.

## Prochaine action exacte

La section 3 du ROADMAP ne place plus aucune étape planifiée: la réécriture est terminée, et la suite est faite des fonctionnalités reportées (autres modes, pass de saison, skins, clans). Dans une conversation neuve, sur `master`, demander au porteur du projet laquelle vient en premier et trancher ses règles avec lui, puis rédiger sa fiche selon le cas de repli du PROTOCOLE et la commiter avant de l'exécuter.

Au porteur du projet: choisir la prochaine fonctionnalité; écouter les sons et la musique d'une partie (cas C21); trancher la base du serveur de développement local (handoff 3.4).

## Étape suivante

Fiche à lire: aucune encore; celle de la fonctionnalité que le porteur du projet choisira, à rédiger au début de la session
