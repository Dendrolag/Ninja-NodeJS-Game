# Handoff - Étape 7.3 Mode Chasse

Date: 16 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Ajouter au jeu son quatrième mode, la Chasse: des traqueurs repèrent les vrais joueurs cachés parmi les faux ninjas et les infectent d'un tir en cône, au risque de perdre une vie sur un faux ninja; les proies marquent en restant mobiles. Deuxième des fonctionnalités reportées, choisie par le porteur du projet.

## Ce qui a été fait

- **Le porteur du projet a choisi la Chasse et tranché ses règles en deux temps.** Première série, au début de la session: infection, traqueurs tirés au sort (un par tranche de cinq joueurs), dix joueurs, deux pour lancer, trois secondes avant qu'un nouveau traqueur capture, ninjas en camouflage sans Black Ninjas, couleur commune des traqueurs, remplacement des traqueurs partis, pas d'entrée dans une chasse lancée; puis, en voyant la page, la minimap limitée à son camp. Seconde série, après les lots A et B: tir en cône qui ne prend que l'entité la plus proche, trois vies, élimination, tir dans le vide gratuit et une seconde entre deux tirs, un point tous les cent pixels pour une proie, cinquante par capture et vingt-cinq par vie pour un traqueur, classement individuel aux points. Elle remplace l'infection au contact, la survie seule au score et la victoire par camp de la première série.
- **Fiche** `docs/plan/etape-7-3.md` rédigée selon le cas de repli du PROTOCOLE (`5ad2d5f`), réécrite après la révision (`2891319`), réconciliée en fin d'étape (huit écarts).
- **Lots A (`d70c719`) et B (`a23af12`), première version**: le mode dans le contrat, la couleur réservée, les réglages imposés par le mode, la migration, le jeu de règles élargi (`lancer`, `estDecidee`), le tirage des traqueurs, `GameRoom` (capacité, entrée refusée, deux joueurs pour lancer), la place par camp partagée.
- **Lots A2 et B2 (`2288659`), les règles révisées**: l'état de la Chasse (traqueurs, vies, arme, parcours des proies, traqueurs épuisés), le tir, les vies et l'élimination, le hors-jeu d'un traqueur éliminé (nouvelle question du jeu de règles, lue par le déplacement et le ramassage), les points, la fin par épuisement; l'arme d'un traqueur dans le flux (état tactique, charges = vies), le traqueur éliminé retiré de la carte, la notification de vie perdue, le bilan du Classique.
- **Lot C (`dac9e06`), la page**: création, salon, bandeau du rôle, bouton et touche de capture avec les vies, cône de visée, minimap limitée à son camp, annonces d'infection, de vie perdue et d'élimination, aide. Vérifié à l'écran, au bureau et au format téléphone, à deux joueurs.
- **Lot D (`86bfea0`)**: scénario Playwright `tests/e2e/chasse.spec.ts`, banc de charge (section 15 de `docs/mesures/charge-serveur.md`), journal de conception, cadrage, CLAUDE.md, ROADMAP.

## Fichiers créés ou modifiés

Commit `5ad2d5f` puis `2891319` (fiche): `docs/plan/etape-7-3.md` (créé, puis réécrit), `docs/plan/ROADMAP.md`.

Commit `d70c719` (lot A): `packages/shared/src/constantes.ts` (mode, capacité, couleur des traqueurs, règles chiffrées), `reglages.ts` et test (`imposerLesReglagesDuMode`), `index.ts`; `packages/sim/src/chasse.ts` et test (créés), `moteur.ts` (jeu de règles élargi, `lancerLaPartie`), `etat.ts` (champ `chasse`, réglages imposés, doc de l'événement de capture corrigée), `contacts.ts`, `capture.ts`, `score.ts`, `couleurs.ts` et test (couleur réservée), `modes.test.ts`, `index.ts`; `packages/server/migrations/0005_mode_chasse.sql` et métadonnées; client: nom, phrase et tuile du mode, pictogramme `viseur`; `validation.test.ts` et `ServeurSocket.test.ts` (exemple de mode inconnu).

Commit `a23af12` (lot B): `packages/shared/src/camps.ts` (créé), `equipes.ts`, `chasse.ts` et test (créés); `packages/server/src/GameRoom.ts`, `GameRoom.chasse.test.ts` et `ServeurSocket.chasse.test.ts` (créés); `tests/base/parties.test.ts`.

Commit `2288659` (lots A2 et B2): `packages/shared/src/constantes.ts` (vies, attente, barème), `chasse.ts` et test (camp vainqueur et place par camp retirés), `evenements.ts` (`vieDeTraqueurPerdue`, doc de l'état tactique), `index.ts`; `packages/sim/src/chasse.ts` et test (réécrits), `etat.ts` (`EtatDeChasse`, `VieDeTraqueurPerdue`), `moteur.ts` (`horsJeu`), `objets.ts` (hors-jeu au ramassage et au malus), `contacts.ts` (aucun effet en Chasse), `score.ts`, `tactique.ts` (`ordreDesTirs` exportée), `index.ts`; `packages/server/src/instantane.ts` et test (arme, hors-jeu, notification), `ServeurSocket.ts`, `GameRoom.ts` (bilan du Classique) et les tests de la Chasse.

Commit `dac9e06` (lot C): `packages/client/src/hud/modele.ts`, `surcouche.ts`, `page/styles/jeu.css`, `interface/ecrans/jeu.ts`, `creation.ts`, `salon.ts`, `interface/modeles/salon.ts`, `creation.ts`, `cartes.ts`, `reglages.ts`, `interface/composants/reglages.ts`, `aide.ts`, `annonces.ts`, `faits.ts`, `client.ts`, `pointsFlottants.ts`, et leurs tests (`hud/modele.chasse.test.ts`, `interface/modeles/salon.chasse.test.ts`, `fin.chasse.test.ts` créés).

Commit `86bfea0` (lot D): `tests/e2e/chasse.spec.ts` (créé), `playwright.config.ts`, `tests/charge/battement.ts` (Chasse sans tir au banc), `docs/mesures/charge-serveur.md` et deux fichiers de chiffres bruts (créés), `docs/design/README.md`, `docs/design/cadrage.md`, `docs/plan/ROADMAP.md`, `docs/plan/etape-7-3.md`, `CLAUDE.md`; `packages/sim/src/chasse.ts` et test (une vérification inatteignable retirée, couverture).

Commit de ce handoff: `docs/handoffs/etape-7-3-handoff.md` (créé).

Le commit `adf04de` (« assets: nouvelle musique du menu »), arrivé entre les lots B et la révision, n'est pas de cette session.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - **moteur** (`packages/sim/src/chasse.test.ts`, 49 tests): rôles et délai, tirage des traqueurs, tir (plus proche dans le cône, proie avant ninja à distance égale, vide gratuit, hors du cône, proie protégée ou invincible, traqueurs non ciblés, attente d'une seconde), vies, élimination et épuisement, remplacement après un départ (et pas après une élimination, ni pour une proie seule, dans les deux ordres), hors-jeu (déplacement, ramassage, malus, absent des autres modes), contacts sans effet, malus, parcours et points, classement, fin, monde sans Black Ninjas, tir de bout en bout et déterminisme; couleur réservée sur une graine qui tombe dessus (`couleurs.test.ts`); réglages imposés;
  - **serveur**: `GameRoom.chasse.test.ts` (capacité, lancement, tirage, entrée refusée, retour après coupure, tir demandé, fin, remplacement, bilan aux points, temps joué, gains), `ServeurSocket.chasse.test.ts` (démarrage refusé, décompte annulé, réglages, entrée refusée, infection par un tir jusqu'à la fin anticipée, vie perdue annoncée au seul traqueur), `instantane.test.ts` (arme d'un traqueur, traqueur éliminé retiré de la carte, notification);
  - **base**: une partie Chasse enregistrée;
  - **client**: HUD (rôle, éliminé, vies, minimap), salon, fin, création, réglages, annonces, points flottants;
  - **bout en bout**: `tests/e2e/chasse.spec.ts`.
- Résultat: **2 151 tests unitaires sur 2 151**; types des paquets, des tests et du bout en bout compilés en appelant tsc directement; linter et formatage verts. Bout en bout en local: **30 scénarios sur 30**, dont celui de la Chasse (39 secondes) et celui du Tactique, dont le bouton de capture passe désormais par le même code.
- Couverture de `packages/sim`: **99,82 pour cent** des instructions (99,79 au handoff 7.2); `packages/sim/src/chasse.ts` à 100. `shared` à 100.
- **Empreinte du jeu identique** avant le lot A, après les lots A2 et B2, et après le lot D, pour les quatre parties Classique de référence.
- Mesure de charge: section 15 de `docs/mesures/charge-serveur.md`. À dix joueurs et 150 bots, une partie Chasse coûte 0,365 ms par battement contre 0,406 en Classique (pas de Black Ninjas, pas de contagion entre bots de joueurs), pour un message de même taille.
- Aucune régression de caractérisation.

## Décisions et écarts au plan

Cinq entrées au journal de `docs/design/README.md`, datées du 16 septembre 2026: le mode et ses règles révisées, la minimap limitée à son camp, le jeu de règles élargi et les réglages imposés par un mode, l'arme d'un traqueur dans l'état tactique du flux, la place par camp partagée. Les huit écarts à la fiche sont dans sa section « Réconciliation ». À retenir ici:

1. **Les règles ont changé en cours d'étape**, à la demande du porteur du projet. La première version a été entièrement remplacée, sans rien laisser qui la contredise; ses deux lots restent dans l'historique.
2. **Un traqueur éliminé est hors jeu, pas hors de la partie**: il reste membre et classé, ne bouge plus, et disparaît du flux. C'est la troisième question ajoutée au jeu de règles d'un mode (`horsJeu`), après `lancer` et `estDecidee`.
3. **L'arme d'un traqueur voyage dans l'état tactique du flux**, ses charges étant ses vies: le flux d'état n'a pas changé de forme, et le cône de visée et le bouton de capture du Tactique servent tels quels.

## Problèmes connus et dette

Limites assumées du mode Chasse:

- **Un traqueur éliminé ne voit plus que les traqueurs sur la minimap, et la caméra reste où il est tombé**: il n'y a pas de mode spectateur. Il peut encore écrire dans le chat.
- **Le coût d'un tir n'est pas mesuré** au banc, qui ne sait pas jouer des tirs sans terminer la partie; il est borné à un tir par seconde par traqueur.
- **L'équilibrage reste à jouer**: barème (un point par cent pixels, cinquante par capture, vingt-cinq par vie), trois vies, un traqueur par tranche de cinq joueurs. Une proie qui tourne en rond marque autant qu'une qui fuit.
- **Une proie infectée voit encore la flèche de localisation** qui suit une capture dans les autres modes, alors qu'elle n'a pas bougé.

Repris du handoff 7.2, inchangé: on ne distingue ses coéquipiers qu'à la couleur en Équipes; une partie Équipes coûte un peu plus cher; une équipe vidée n'est plus classée; un joueur entré en cours de partie Équipes ne choisit pas son camp; le chat n'est pas par équipe. Et du handoff 2.6: un hôte seul dans son salon le perd avec son lien; un joueur revenu dans le salon n'en est plus l'hôte; l'écoute des sessions fermées et les limites de tentatives vivent dans le processus; fermer la fenêtre du code de secours vaut « noté »; l'échec isolé, non reproduit, du test des routes des comptes; le serveur de développement local parle à la base de production (question au porteur du projet); jusqu'à 45 secondes pour constater une coupure silencieuse; la pluie coûte au chargement du décor; la fluidité et le lancement sur iPhone restent à confirmer sur un vrai téléphone; en haut ou en bas de la carte, le joueur passe sous le HUD sur téléphone; les erreurs d'un travailleur échappent aux scénarios de bout en bout; le relevé des contacts et le lissage du client restent en carré du nombre d'entités; l'outil de Vercel est téléchargé par npx à chaque mise en ligne; des déploiements Vercel non promus restent de la première mise en ligne; le jeton Vercel expire le 14 septembre 2027. Les sons et la musique restent à écouter par le porteur du projet (cas C21 de la grille de recette).

## État de la CI

- `5ad2d5f` et `2891319` (fiche): documentation seule, vertes.
- `d70c719` (lot A), `a23af12` (lot B), `2288659` (lots A2 et B2, exécution 35104542019), `dac9e06` (lot C, exécution 35105359736) et `86bfea0` (lot D, exécution 35106488734): **toutes vertes**, avec les trois travaux « Types, linter et tests », « Bout en bout » et « Mise en ligne ».
- Vérifié ensuite depuis la machine de développement: `https://neon-ninja.onrender.com/sante` rend la version `86bfea097def4c6992b769bd3690a7485a297f96`.
- Le commit de ce handoff ne touche que la documentation: sa mise en ligne doit s'arrêter d'elle-même, la production restant sur `86bfea0`.

## Prochaine action exacte

Dans une conversation neuve, sur `master`: demander au porteur du projet quelle fonctionnalité reportée vient ensuite (Battle Royale, Chaos, pass de saison, skins, clans), trancher ses règles avec lui, puis rédiger sa fiche selon le cas de repli du PROTOCOLE et la commiter avant de l'exécuter.

Au porteur du projet: choisir la fonctionnalité suivante; jouer une Chasse à plusieurs pour valider le barème, les trois vies et le nombre de traqueurs; jouer une partie Équipes (handoff 7.2); écouter les sons et la musique d'une partie (cas C21); trancher la base du serveur de développement local (handoff 3.4).

## Étape suivante

Fiche à lire: aucune encore; celle de la fonctionnalité que le porteur du projet choisira, à rédiger au début de la session.
