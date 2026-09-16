# Handoff - Étape 7.2 Mode Équipes

Date: 16 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Ajouter au jeu son troisième mode, le mode Équipes, où deux équipes d'une couleur chacune se disputent les ninjas de la carte. Première des fonctionnalités reportées, choisie par le porteur du projet après la fin de la réécriture.

## Ce qui a été fait

- **Neuf décisions de jeu du porteur du projet, prises au début de la session**, parmi les voies présentées: le mode Équipes en premier (plutôt qu'un autre mode, le pass de saison, les skins ou les clans); une couleur par équipe (plutôt qu'une couleur par joueur avec un score additionné); le choix de l'équipe au salon (plutôt qu'un tirage au lancement ou une répartition par l'hôte); deux équipes pour douze joueurs; un malus qui frappe l'équipe adverse; une capture qui rapporte la part de la victime, au plus près d'elle; un bot noir qui en fait perdre la moitié; des récompenses par équipe; un joueur par équipe au moins pour lancer.
- **Fiche rédigée au début de la session** (`docs/plan/etape-7-2.md`, commit `7682152`), selon le cas de repli du PROTOCOLE, puis réconciliée en fin d'exécution (dix écarts, voir « Décisions »).
- **Lot A, le moteur** (`7e6db39`). Une équipe, pour le moteur, c'est une couleur: l'état ne gagne aucun champ. La part d'un joueur (les bots de son équipe divisés par ses membres, les plus proches de lui d'abord), la capture d'un adversaire qui ne prend que cette part et laisse sa couleur à la victime, la perte face au bot noir et la victime d'un malus vivent dans `packages/sim/src/equipes.ts`. Le jeu de règles d'un mode s'élargit à ces deux dernières décisions, qui vivaient dans les bots et dans les objets sans consulter le mode.
- **Lot B, le salon et le serveur** (`acb4cde`). `GameRoom` place un arrivant dans l'équipe la moins nombreuse, accepte un changement d'équipe au salon, refuse de lancer tant qu'une équipe est vide, garde les équipes quand les réglages changent, et classe par équipe dans son bilan. `ServeurSocket` diffuse le changement, refuse le démarrage et annule le décompte si une équipe se vide avant son terme. Les récompenses acceptent un devancement explicite, que le Classique déduit toujours de son placement.
- **Lot C, la page** (`7a4b440`). La création propose le mode, le salon range les joueurs en deux colonnes avec un bouton pour changer d'équipe, le HUD classe les équipes, et l'écran de fin dit l'issue et le score des deux équipes. Vérifié à l'écran avant le commit.
- **Lot D, bout en bout, mesure et documentation** (`a696189`). Un scénario Playwright à deux joueurs, la section 14 de `docs/mesures/charge-serveur.md`, cinq entrées au journal de conception, le cadrage, le ROADMAP et CLAUDE.md.

## Fichiers créés ou modifiés

Commit `7682152` (fiche): `docs/plan/etape-7-2.md` (créé), `docs/plan/ROADMAP.md`.

Commit `7e6db39` (lot A):

- `packages/shared/src/constantes.ts`: le mode `equipes`, sa capacité, les équipes Cyan et Magenta, leurs couleurs, six membres au plus par équipe.
- `packages/shared/src/equipes.ts` et son test (créés): l'équipe d'une couleur.
- `packages/sim/src/equipes.ts` et son test (créés): la part d'un joueur, la perte face au bot noir et la victime du malus en Équipes.
- `packages/sim/src/moteur.ts`: `JeuDeRegles` élargi; `bots.ts` et `objets.ts`: la perte et la victime viennent du mode, le Classique par défaut; `capture.ts`: `capturerEnEquipe`; `contacts.ts`: `regleEquipes`; `etat.ts`: `changerDeCouleur`; `modes.test.ts`, `index.ts` des deux paquets.
- `packages/server/migrations/0004_mode_equipes.sql` et ses métadonnées: la valeur `equipes` de l'énumération.
- `packages/client/src/interface/modeles/cartes.ts`, `ecrans/creation.ts`, `modeles/creation.ts`: nom, phrase de capture et tuile du mode, gardée hors de la création jusqu'au lot C.

Commit `acb4cde` (lot B):

- `packages/shared/src/equipes.ts`: classement des équipes, place de chacun, points retenus d'un joueur, équipe d'un arrivant; `progression.ts`: le devancement explicite; `validation.ts`: `validerEquipe`; `evenements.ts`: l'équipe d'un joueur du salon et `changerDEquipe`; `index.ts`.
- `packages/server/src/GameRoom.ts` et `GameRoom.equipes.test.ts` (créé); `ServeurSocket.ts` et `ServeurSocket.equipes.test.ts` (créé); `finDePartie.ts`; `instantane.ts`.
- `tests/base/parties.test.ts`: une partie Équipes enregistrée.

Commit `7a4b440` (lot C): `packages/client/src/client.ts` et son test, `hud/modele.ts` et `modele.equipes.test.ts` (créé), `interface/modeles/salon.ts`, `ecrans/salon.ts` et leurs tests d'équipes (créés), `interface/modeles/fin.ts`, `ecrans/fin.ts`, `fin.equipes.test.ts` (créé), `ecrans/creation.test.ts`, `composants/aide.ts`, `page/styles/ecrans.css`.

Commit `a696189` (lot D): `tests/e2e/equipes.spec.ts` (créé), `playwright.config.ts`, `docs/mesures/charge-serveur.md` et deux fichiers de chiffres bruts (créés), `docs/design/README.md`, `docs/design/cadrage.md`, `docs/plan/ROADMAP.md`, `docs/plan/etape-7-2.md`, `CLAUDE.md`.

Commit de ce handoff: `docs/handoffs/etape-7-2-handoff.md` (créé).

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - **moteur** (27, `packages/sim/src/equipes.test.ts`): la part (un joueur seul, la division par les membres, les plus proches d'abord, l'ordre de l'état à distance égale, ni l'autre équipe ni les bots noirs, une équipe sans bot); la capture (la part qui change de camp, la victime qui garde sa couleur et réapparaît protégée, les compteurs et le journal, deux coéquipiers qui ne se capturent pas, protection et délai, l'égalité avec le Classique en un contre un); les contacts (capture au contact, rien entre coéquipiers, le bot repeint aux couleurs de l'équipe, les troupeaux qui se retournent); le bot noir (la moitié de la part au plus près, la distinction d'avec le Classique, la perte que le moteur applique); le malus (l'équipe adverse, la distinction d'avec le Classique); `changerDeCouleur`; les couleurs d'équipe qu'aucun bot ne reçoit; le jeu de règles et le déterminisme;
  - **contrats partagés** (`packages/shared/src/equipes.test.ts`): couleurs des équipes, classement (score, victoire, égalité, équipe sans membre, joueur hors équipe), place de chacun et récompenses (vainqueur, perdant, égalité), points retenus, équipe d'un arrivant, devancement refusé s'il est impossible, `validerEquipe`;
  - **salon et serveur**: `GameRoom.equipes.test.ts` (arrivée, changement accepté ou refusé, réglages changés, entrée en cours de partie, condition de lancement, bilan et gains) et `ServeurSocket.equipes.test.ts` (salon diffusé, refus hors mode et pour une équipe inconnue, démarrage refusé, décompte annulé, et une partie Équipes jouée à travers le vrai serveur jusqu'à une capture);
  - **base**: une partie Équipes enregistrée, deux comptes à égalité au même rang;
  - **client**: salon (modèle et écran), fin (modèle), HUD, création et client;
  - **bout en bout** (`tests/e2e/equipes.spec.ts`): Alice crée une partie Équipes sur un ordinateur, Bob la rejoint depuis un téléphone et change d'équipe; le lancement est suspendu tant qu'une équipe est vide, le HUD classe les équipes, l'écran de fin montre le score des deux.
- Résultat: **2 048 tests unitaires sur 2 048**, 141 fichiers (1 954 au handoff 2.6); types des paquets, des tests et du bout en bout compilés en appelant tsc directement; linter et formatage verts.
- Bout en bout en local: le scénario Équipes passe (44 secondes).
- Couverture des instructions: `sim` à **99,79 pour cent** (99,78 au handoff 2.6), `shared` à **100**; `packages/sim/src/equipes.ts` et `packages/shared/src/equipes.ts` à 100.
- **Empreinte du jeu identique** avant le lot A et après le lot C, pour les quatre parties Classique de référence: le Classique n'a pas bougé.
- Mesure de charge: section 14 de `docs/mesures/charge-serveur.md`. Une partie Équipes coûte 0,494 ms par battement à 150 bots contre 0,467 en Classique (6 pour cent), pour la même taille de message; le Classique retrouve ses 453 octets de référence.
- Aucune régression de caractérisation.

## Décisions et écarts au plan

Cinq entrées au journal de `docs/design/README.md`, datées du 16 septembre 2026: le mode et ses neuf règles, l'équipe qui est une couleur, le jeu de règles élargi, les points enregistrés d'un joueur, les récompenses par équipe. Les dix écarts à la fiche sont dans sa section « Réconciliation ». Trois points à retenir ici:

1. **Une équipe est une couleur, et rien d'autre.** Aucun champ ajouté à l'état, aucune table d'équipes tenue par `GameRoom`: la couleur du joueur dans l'état est la seule vérité, ce qui empêche une seconde de diverger. C'est aussi ce qui garde l'empreinte du Classique intacte.
2. **Les points enregistrés d'un joueur en Équipes sont sa part**, plus ses propres points de bots noirs, et non le score de son équipe: sans cela, le meilleur score de son profil aurait été gonflé à la taille de l'équipe. Même raison pour le classement du HUD, qui classe les équipes.
3. **Le devancement est devenu explicite** dans les récompenses, parce qu'un vainqueur d'équipe ne devance pas ses coéquipiers. Le Classique le déduit toujours de son placement, et ses tests de progression sont inchangés.

## Problèmes connus et dette

Limites assumées du mode Équipes:

- **On ne distingue pas ses coéquipiers à l'écran autrement que par la caméra**, qui suit son propre ninja, et par la touche F qui le localise: plusieurs ninjas portent la même couleur, et aucun pseudo ne s'affiche au-dessus des personnages. En Classique, la couleur suffisait.
- **Une partie Équipes coûte un peu plus cher**: 70 parties pleines par cœur au banc contre 74. Ce sont les troupeaux adverses qui se repeignent sans arrêt, pas le code du mode.
- **Une équipe vidée en cours de partie n'est plus classée**: l'autre gagne, et les bots de la couleur partie ne comptent pour personne.
- **Un joueur entré en cours de partie ne choisit pas son camp**: il va dans l'équipe la moins nombreuse, puis la moins riche.
- **Le chat n'est pas par équipe**, et changer d'équipe reste permis pendant le compte à rebours; la condition de lancement est revérifiée à son terme, et le démarrage annulé si une équipe s'est vidée.

Repris du handoff 2.6, inchangé: un hôte seul dans son salon le perd avec son lien; un joueur revenu dans le salon n'en est plus l'hôte; revenir dans un salon passe par les mêmes contrôles qu'une entrée; l'écoute des sessions fermées et les limites de tentatives vivent dans le processus; fermer la fenêtre du code de secours vaut « noté »; l'échec isolé, non reproduit, du test des routes des comptes; le serveur de développement local parle à la base de production (question au porteur du projet); jusqu'à 45 secondes pour constater une coupure silencieuse; la pluie coûte au chargement du décor; un point flottant manqué une fois en jeu; la fluidité et le lancement sur iPhone restent à confirmer sur un vrai téléphone; en haut ou en bas de la carte, le joueur passe sous le HUD sur téléphone; les erreurs d'un travailleur échappent aux scénarios de bout en bout; le relevé des contacts et le lissage du client restent en carré du nombre d'entités; l'outil de Vercel est téléchargé par npx à chaque mise en ligne; des déploiements Vercel non promus restent de la première mise en ligne; le jeton Vercel expire le 14 septembre 2027. Les sons et la musique restent à écouter par le porteur du projet (cas C21 de la grille de recette).

## État de la CI

- `7682152` (fiche): documentation seule.
- `7e6db39` (lot A), `acb4cde` (lot B), `7a4b440` (lot C, exécution 35074173875) et `a696189` (lot D, exécution 35074768423): **toutes vertes**, avec les trois travaux « Types, linter et tests », « Bout en bout » et « Mise en ligne » pour les deux derniers, puisque le jeu a changé.
- Vérifié ensuite depuis la machine de développement: `https://neon-ninja.onrender.com/sante` rend la version `a696189e51ebe73e93f45865e2e54c3ae33a66b5`; `https://neon-ninja-jeu.vercel.app/` répond 200, et son `app.js` porte le mode `equipes`.
- Le commit de ce handoff et de la grille de recette ne touche que la documentation: sa mise en ligne doit s'arrêter d'elle-même, la production restant sur `a696189`.

## Prochaine action exacte

Dans une conversation neuve, sur `master`: demander au porteur du projet quelle fonctionnalité reportée vient ensuite (Chasse, Battle Royale, Chaos, pass de saison, skins, clans), trancher ses règles avec lui, puis rédiger sa fiche selon le cas de repli du PROTOCOLE et la commiter avant de l'exécuter.

Au porteur du projet: choisir la fonctionnalité suivante; jouer une partie Équipes à plusieurs pour valider ses réglages (la part cédée à une capture, la moitié perdue face à un bot noir); écouter les sons et la musique d'une partie (cas C21); trancher la base du serveur de développement local (handoff 3.4).

## Étape suivante

Fiche à lire: aucune encore; celle de la fonctionnalité que le porteur du projet choisira, à rédiger au début de la session.
