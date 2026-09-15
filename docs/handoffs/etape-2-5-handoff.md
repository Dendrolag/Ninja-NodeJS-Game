# Handoff - Étape 2.5 Reconnexion en cours de partie

Date: 15 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Un joueur dont le lien se coupe, ou qui recharge la page, retrouve sa partie, sa couleur et ses ninjas, dans un délai borné; au-delà, son départ est un abandon, comme avant.

## Ce qui a été fait

- **Fiche rédigée au début de la session** (`docs/plan/etape-2-5.md`, commit `68c21cf`), selon le cas de repli du PROTOCOLE: état de départ du dépôt, dix décisions de conception, périmètre, tests requis. Réconciliée en fin d'exécution (six écarts, voir « Décisions »).
- **Un jeton de retour par place.** À chaque entrée en partie, le serveur remet au seul joueur qui entre, par la notification `placeAttribuee`, son identifiant de joueur et un jeton de retour secret (32 octets tirés au hasard, même forme qu'un jeton de session). Le jeton est renouvelé à chaque retour.
- **La place survit à la connexion** (`packages/server/src/places.ts`). Le joueur garde l'identifiant de la connexion par laquelle il est entré; le registre des places dit quelle connexion le joue. Les notifications adressées et le récapitulatif de fin partent par lui.
- **Déconnexion en pleine partie**: le joueur reste dans l'état, absent, immobile (son intention est effacée), capturable, avec sa couleur, ses ninjas et sa place dans la capacité; ses bots continuent de transmettre sa couleur (règle 11). Un hôte absent cède la main au plus ancien présent. Au bout de `DELAI_DE_RETOUR_MS` (30 secondes), il sort de la partie: abandon, comme avant. Dans le salon et après la fin, une déconnexion reste un départ immédiat.
- **Retour** par la demande `revenir`: jeton bien formé, place existante, même identité (le même compte, ou un invité pour un invité), partie en cours. Tout est vérifié avant que rien ne change. Admis, le joueur reçoit un jeton neuf, le salon, `partieLancee` et une image complète du flux. Une connexion qui tenait encore la place en est détachée et prévenue par `placeReprise`, sans être coupée.
- **Côté client** (`packages/client/src/retour.ts`): le jeton est gardé dans le stockage de session et oublié en quittant, à la fin, au premier refus ou quand la place est reprise ailleurs. Un lien tombé en pleine partie laisse la partie affichée sous le bandeau « Connexion perdue. Retour dans la partie… », et la page rouvre le lien toutes les deux secondes pendant le délai, puis présente le jeton. Une page rechargée présente sa place dès que le lien s'ouvre; l'accueil dit « Retour dans votre partie… » et ne laisse pas entrer ailleurs. Tout refus se dit sur l'accueil. Le réveil d'un serveur endormi se tait pendant un retour.
- **Le client apprend son identifiant de joueur du serveur**: `moi` vient de `placeAttribuee`, et le transport n'expose plus d'identifiant.
- **Bout en bout local à trois scénarios à la fois**: le nouveau scénario, lourd, faisait échouer un autre parcours par la charge (voir « Décisions », point 3).
- **Documentation**: quatre décisions au journal de `docs/design/README.md`, étape terminée au ROADMAP, ligne de la grille de recette 5.4 mise à jour.

## Fichiers créés ou modifiés

Commit `68c21cf`: `docs/plan/etape-2-5.md` (créé), la fiche.

Commit `be6655e`, la reconnexion:

- `packages/shared/src/bornes.ts`: `DELAI_DE_RETOUR_MS`.
- `packages/shared/src/entrees.ts`: `DemandeRetour`; `SessionJoueur.id` documenté comme l'identifiant du joueur.
- `packages/shared/src/evenements.ts`: `revenir`, `placeAttribuee` (`PlaceEnPartie`), `placeReprise`.
- `packages/shared/src/validation.ts` et test: `validerDemandeRetour`.
- `packages/shared/src/index.ts`: exports.
- `packages/server/src/places.ts` et `places.test.ts` (créés): le registre des places.
- `packages/server/src/GameRoom.ts`, `GameRoom.absence.test.ts` (créé): `marquerAbsent`, `marquerPresent`, `estAbsent`, succession de l'hôte.
- `packages/server/src/ServeurSocket.ts`: place remise à l'entrée, `surRevenir`, `surDeconnexion` qui suspend, `faireSortir`, place reprise, messages adressés par joueur.
- `packages/server/src/finDePartie.ts` et test: `connexions` devient `joueurs`.
- `packages/server/src/ServeurSocket.retour.test.ts` (créé), `ServeurSocket.comptes.test.ts`: intégration du retour.
- `packages/client/src/retour.ts` et `retour.test.ts` (créés): garde du jeton et retour.
- `packages/client/src/comptes/coffre.ts` et test: clé du coffre, `CLE_RETOUR`.
- `packages/client/src/principal.ts`: le coffre de retour dans le stockage de session.
- `packages/client/src/actions.ts`, `etat.ts`, `reduction.ts`, `ecrans.ts` et leurs tests: état `retour`, `avisDeRetour`, actions du retour, `moi` appris du serveur.
- `packages/client/src/reseau.ts`, `reseauSocketIo.ts`: plus d'identifiant de transport.
- `packages/client/src/client.ts`: le retour branché, `quitter` y renonce.
- `packages/client/src/reveil.ts`: silencieux pendant un retour.
- `packages/client/src/hud/modele.ts`, `hud/surcouche.ts`, `packages/client/page/styles/jeu.css`: le bandeau.
- `packages/client/src/interface/modeles/accueil.ts`, `interface/ecrans/accueil.ts` et test: retour en cours, avis de retour.
- `packages/client/src/index.ts`: exports.
- Tests client adaptés à la connexion sans identifiant (`simulerConnexion()` sans argument, place reçue là où `moi` compte): `client.test.ts`, `magasin.test.ts`, `reduction.session.test.ts`, `rafraichissement.test.ts`, `reveil.test.ts`, `rendu/boucle.test.ts`, `comptes/session.test.ts`, `comptes/session.profil.test.ts`, `interface/application*.test.ts`, `interface/ecrans/*.test.ts`.
- `tests/client/integration/client-serveur.test.ts`: `moi` appris à l'entrée, rechargement contre un vrai serveur.
- `tests/e2e/retour.spec.ts` (créé), `playwright.config.ts`: le scénario du rechargement, projet bureau.
- `docs/design/README.md`, `docs/plan/etape-2-5.md`, `docs/plan/ROADMAP.md`, `docs/recette/recette-5-4.md`.

Commit `0f69e4f`: `playwright.config.ts`, trois scénarios de bout en bout à la fois en local.

Commit de ce handoff: `docs/handoffs/etape-2-5-handoff.md` (créé).

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/sim`.

## Tests

- Ajoutés:
  - **validation**: jeton de retour de la bonne forme accepté seul, tout le reste refusé, jeton hérité compris;
  - **registre des places** (19): attribution et jeton unique, suspension et expiration sur l'horloge, délai qui ne se répète pas, libération et fermeture qui arrêtent les délais, vérification par identité (invité, compte, autre compte, jeton inconnu) sans rien changer, reprise qui renouvelle le jeton et arrête le délai, reprise d'une place encore tenue;
  - **absence dans la room** (10): l'absent reste dans l'état avec sa couleur, immobile, compte dans la capacité et garde son pseudo; l'hôte passe la main au plus ancien présent, la garde si personne n'est là, ne la reprend pas en revenant; un revenu bouge de nouveau; sortie d'un absent en abandon;
  - **intégration serveur** (14 + 3 avec comptes): place et jeton remis avant la réponse et jamais aux autres; retour dans le délai avec même joueur, même couleur et flux; commande rendue; refus après le délai avec abandon; jeton inconnu, mal formé ou déjà servi; place reprise à une page qui la tient encore, prévenue, sans commande ni trame; connexion déjà en partie; partie terminée pendant l'absence; hôte absent remplacé qui peut suspendre; salon et départ volontaire immédiats; dernière expiration qui ferme la partie; place de compte reprise seulement par ce compte, place d'invité refusée à un compte; compte revenu classé présent et qui reçoit sa progression;
  - **client** (17 pour le retour, plus réduction, écrans, accueil, coffre, HUD): jeton gardé et oublié à bon escient; partie affichée et lien rouvert aussitôt; jeton présenté au retour du lien, l'état restant « retour » jusqu'à la réponse; essais toutes les deux secondes puis perte au bout du délai; réponse perdue d'un lien retombé ignorée; refus du lien par le serveur; retour refusé avec motif; quitter pendant un retour; salon; fermeture; page rechargée acceptée ou refusée;
  - **intégration client-serveur**: un client fermé en pleine partie, puis un client neuf avec le même coffre de retour, retrouve l'écran de jeu, le même `moi` et son entité dans le flux;
  - **bout en bout** (`tests/e2e/retour.spec.ts`): Alice rallie des faux ninjas, recharge la page, retrouve l'écran de jeu sans salon; le serveur confirme le même joueur, la même couleur, des ninjas en nombre au moins égal, une partie qui a continué et aucun abandon; la page commande de nouveau son joueur.
- Résultat: **1 823 tests unitaires sur 1 823** (projet `unitaires`, 1 743 au handoff 6.1); types des trois projets compilés en appelant tsc directement, linter et formatage verts. Le projet `base` tourne en CI (ses tests ne coupent un compte que par `quitter` ou au nettoyage, comportement inchangé).
- Bout en bout en local: **26 sur 26** à trois scénarios à la fois, deux passages (2,6 et 2,8 minutes).
- À l'écran, dans le panneau navigateur, sur le serveur de développement: partie rapide, partie lancée, puis serveur arrêté. La partie reste affichée, figée, sous le bandeau « Connexion perdue. Retour dans la partie… », exposé comme zone de statut; la console relève un échec d'ouverture de WebSocket par essai, attendu serveur arrêté. Passé le délai de retour, la page revient à l'accueil avec « La connexion au serveur a été perdue » et « Recharger la page », et ne réessaie plus.
- Couverture des instructions: `sim` à **99,77 pour cent** (inchangée, aucun code du moteur touché), `shared` à **100**, ensemble 99,89.
- Aucune régression de caractérisation.

## Décisions et écarts au plan

Quatre entrées au journal de `docs/design/README.md`, datées du 15 septembre 2026: la place gardée trente secondes, l'identité du joueur détachée de sa connexion, la place reprise à une page qui la tient encore, le jeton en stockage de session et le retour comme demande. Points à lire ici.

### 1. Trois défauts du retour trouvés par ses propres tests, avant tout commit

- Le code de `GameRoom.marquerAbsent` donnait la main au plus ancien absent quand personne n'était présent, contrairement à sa documentation; il la laisse à l'hôte absent.
- Au retour du lien après une coupure, l'état repassait « connecté » avant la réponse du serveur, ce qui aurait retiré le bandeau trop tôt; il reste « retour » jusqu'à la réponse.
- Une demande de retour partie sur un lien retombé aussitôt pouvait voir sa réponse tardive acceptée; elle est invalidée dès que le lien retombe.

### 2. Écarts à la fiche

Réconciliés dans la fiche elle-même (section « Réconciliation en cours d'exécution »): vérification puis reprise en deux temps; motif propre à une partie terminée; partie d'absents gardée jusqu'au dernier délai; plus d'identifiant de transport côté client; un test d'intégration client-serveur de plus; scénario de bout en bout limité au projet bureau.

### 3. Trois scénarios de bout en bout à la fois en local, au lieu de quatre

À quatre, avec le nouveau scénario (deux chargements de carte), deux passages complets sur trois ont compté un échec, sur `parties.spec.ts` puis sur `multijoueur.spec.ts` et `compte.spec.ts`. Tous passent seuls. Le contexte d'erreur montrait une page restée à l'accueil avec « La connexion au serveur a été perdue »: hors de toute partie, donc sans lien avec le retour, c'est la fragilité relevée à l'étape 5.4. Sans le nouveau scénario, 26 sur 26 à quatre; avec lui, à trois, 26 sur 26 deux fois. La CI reste à un scénario à la fois.

### 4. Ce qui n'a pas été fait, volontairement (hors périmètre de la fiche)

Garder la place dans le salon; montrer l'écran de fin à qui revient après la fin; montrer aux autres qu'un joueur est absent; rendre au revenu les faits manqués (annonces, chat, jauges de bonus); revenir depuis un autre onglet ou un autre appareil.

## Problèmes connus et dette

Nouveau, planifié comme étape:

- **Hors partie, un lien perdu ne se rétablit toujours pas.** L'étape 2.5 garde la place en partie; sur l'accueil, les menus ou dans le salon, une page qui perd son lien (téléphone qui change de réseau, page privée de processeur) affiche toujours « La connexion au serveur a été perdue » et propose de recharger. C'est ce qui a fait échouer les parcours de bout en bout sous charge. La fiche de l'étape 2.5 ne couvrait que la partie en cours: le reste devient l'**étape 2.6** du ROADMAP, selon la règle 7, placée après 3.4.

Limite assumée, relevée par cette étape:

- **Jusqu'à 45 secondes pour constater une coupure silencieuse.** Tant que le serveur n'a pas constaté la fin d'une connexion (battements par défaut de Socket.IO: 25 secondes d'intervalle, 20 d'attente), le joueur continue d'avancer dans sa dernière direction, et le délai de retour ne commence qu'ensuite. Un rechargement n'est pas concerné: la fermeture de la page est vue aussitôt, et une page qui revient reprend la place de toute façon. Les battements n'ont pas été raccourcis: les pages privées de processeur des parcours de bout en bout perdent déjà leur lien avec vingt secondes d'attente, et un téléphone qui hésite serait coupé plus souvent.

Résolu par cette étape, repris des handoffs précédents: une coupure de réseau qui coûtait la partie (handoffs 1.7, 2.1, 2.2, 3.3, 4.1 à 4.4); la destruction immédiate d'une room vide sans délai de grâce (handoff 2.1), désormais gardée tant que des absents peuvent revenir.

Repris du handoff 6.1, inchangé: la pluie coûte au chargement du décor; un point flottant manqué une fois en jeu; la fluidité et le lancement sur iPhone restent à confirmer sur un vrai téléphone; en haut ou en bas de la carte, le joueur passe sous le HUD sur téléphone; les erreurs d'un travailleur échappent aux scénarios de bout en bout; les limites de tentatives vivent en mémoire de l'instance; le relevé des contacts et le lissage du client restent en carré du nombre d'entités; l'outil de Vercel est téléchargé par npx à chaque mise en ligne; des déploiements Vercel non promus restent de la première mise en ligne; le jeton Vercel expire le 14 septembre 2027. Les sons et la musique restent à écouter par le porteur du projet (cas C21 de la grille de recette).

## État de la CI

- `68c21cf` (fiche): documentation seule.
- `be6655e` (reconnexion) et `0f69e4f` (trois scénarios à la fois en local), poussés ensemble: **verte**, exécution 34972837543 sur `0f69e4f`: « Types, linter et tests » (2 min 8 s), « Bout en bout » (6 min 20 s) et **« Mise en ligne »** (3 min), partie puisque le jeu a changé depuis `5a05351`.
- Vérifié ensuite depuis la machine de développement: `https://neon-ninja.onrender.com/sante` rend la version `0f69e4fe530bf1e3cf60877a0d2c8c4473d36538`; `https://neon-ninja-jeu.vercel.app/` répond 200, et son `app.js` porte ce commit et la clé du jeton de retour (`neon-ninja.retour`).
- Le commit de ce handoff ne touche que la documentation (handoff, ROADMAP): sa mise en ligne doit s'arrêter d'elle-même, la production restant sur `0f69e4f`.

## Prochaine action exacte

La section 3 du ROADMAP place ensuite **l'étape 3.4, gestion du mot de passe**. Aucune fiche n'existe encore: dans une conversation neuve, sur `master`, rédiger `docs/plan/etape-3-4.md` selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.4 du ROADMAP (section 4). Son entrée prévoit de trancher avec le porteur du projet, au début de l'étape, le périmètre de la réinitialisation d'un mot de passe oublié: les comptes n'ont aucun moyen de joindre le joueur. Puis la commiter et l'exécuter.

Au porteur du projet: écouter les sons et la musique d'une partie (cas C21 de la grille de recette), et confirmer l'ordre des étapes 3.4 puis 2.6 (lien perdu hors partie), qu'il peut inverser.

## Étape suivante

Fiche à lire: `docs/plan/etape-3-4.md`, à rédiger au début de la session
