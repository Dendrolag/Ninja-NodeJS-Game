# Handoff - Étape 8.2 Carte de travail: un quartier

Date: 20 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Faire exister une carte qui ait une structure, et savoir ce qu'elle vaut avant d'y jouer: un quartier de 2400 sur 1800 en noir et blanc, sans graphiste, jugé par les douze critères de l'étude 8.1, puis jouable dans le jeu.

## Ce qui a été fait

- **Fiche rédigée** selon le cas de repli du PROTOCOLE, à partir de l'entrée `8.2` du ROADMAP, des décisions du porteur du projet consignées section 7.1 de l'étude 8.1, du handoff 8.1 et de la fiche 8.1 prise comme modèle (`docs/plan/etape-8-2.md`, commit `30dd27e`).
- **La carte existe et se joue.** Identifiant `quartier`, nom « Quartier », ambiance « Essai · Plan au trait ». Elle se choisit dans la création de partie, se charge, et se parcourt: vérifié dans le navigateur, sans erreur console.
- **Détour médian 1,24**, dans la cible de 1,20 à 1,35 décidée par le porteur du projet, contre 1,08 sur Tokyo et 1,07 sur Spirit & Time. C'est le premier terrain du jeu où le chemin se choisit.
- **Les douze critères de la section 4 de l'étude sont tenus**, jugés un par un et chiffre à l'appui dans la section 9 nouvelle de l'étude: 59,6 pour cent de jouable, un seul morceau d'un seul tenant, 93,1 pour cent du jouable hors bande d'apparition, 24 pixels de dégagement au dixième le plus serré, 7 315 pixels carrés par entité en partie pleine, traversée en 21,3 secondes.
- **Plafond de 340 PNJ, établi par la mesure et non au jugé.** Densité de Tokyo (133 faux ninjas par million de pixels tenables) appliquée aux 2,575 millions de pixels tenables du Quartier, ce qui donne 342. Confirmé au banc de charge: 1,24 ms par battement à 340 PNJ et 12 joueurs, pour un budget de 50, et 28 parties par cœur. C'est exactement le coût de Tokyo à 300.
- **La carte est produite par un programme**, `docs/mesures/dessiner-le-quartier.mjs`, et non dessinée à la main. C'est lui qui porte la géométrie. Structure: quatre colonnes et trois lignes d'îlots, des rues de 120 pixels, deux artères qui traversent la carte de part en part, et sept îlots sur huit bâtis en ceinture de 65 pixels autour d'une cour ouverte par une seule porte.
- **Cinq endroits du code touchés**, ceux de la section 1.5 de l'étude, plus la base: `CARTES`, `CARTES_ENREGISTREES`, `PLAFONDS_DE_FAUX_NINJAS`, `PRESENTATION_CARTES`, et une migration de l'énumération PostgreSQL. `cheminPluie` n'a pas bougé: la carte n'a pas de pluie, et le réglage disparaît tout seul de l'écran de création.
- **L'outil de mesure a été corrigé en chemin** (règle 7): il tirait vingt-quatre points de départ, ce qui faisait bouger le détour de cinq centièmes selon le tirage, plus que ce qu'on cherchait à mesurer. Il en tire quatre-vingts. Un filtre par carte a été ajouté, pour que la boucle dessiner-mesurer coûte deux secondes au lieu de vingt.

## Fichiers créés ou modifiés

Commit `30dd27e`: `docs/plan/etape-8-2.md` (créé), la fiche.

Commit `a55f822`:

Créés:

- `docs/mesures/dessiner-le-quartier.mjs`: le programme qui dessine la carte et écrit ses sept images. **Ce n'est pas du code de jeu**: rien dans `packages/` ne le connaît, le jeu tourne sans lui, et le linter ignore `docs/`. Il contient son propre encodeur PNG, en vingt lignes, faute de dépendance résoluble depuis `docs/`.
- `assets/cartes/quartier/`: les sept images, 200 Ko en tout. `normal/` et `mirror/`, chacune avec `collision.png`, `background.png` et `foreground.png`, plus `preview.png`. Pas de pluie.
- `packages/server/migrations/0007_carte_quartier.sql`: la valeur `quartier` ajoutée à l'énumération `carte`. Renommée à la main, drizzle-kit l'avait baptisée `0007_brainy_puma`.

Modifiés:

- `packages/shared/src/constantes.ts`: la carte, son enregistrement et son plafond.
- `packages/client/src/interface/modeles/cartes.ts`: le nom et l'ambiance lus par le joueur.
- `packages/server/src/terrain.test.ts`: la boucle des vraies cartes porte maintenant sur toutes les cartes jouables au lieu d'une liste écrite à la main, et un test parcourt le Quartier en entier pour vérifier qu'aucun point tenable n'est isolé.
- `packages/server/src/ServeurSocket.options.test.ts`: une partie au plafond sur la carte nouvelle, à travers le vrai serveur, et la vérification renforcée que le corps entier de chaque PNJ tient à son apparition, et pas seulement son centre.
- `packages/shared/src/constantes.test.ts` et `packages/client/src/interface/application.test.ts`: les trois tests qui figeaient deux cartes en attendent trois.
- `docs/mesures/mesurer-les-cartes.mjs`: quatre-vingts points de départ, un filtre par carte, et le détour affiché à l'écran.
- `docs/mesures/etude-structures-de-carte.md`: la section 9, les chiffres, le jugement des douze critères, ce que la mise au point a appris, et ce que la carte ne dit pas encore. Le détour de Spirit & Time y passe de 1,06 à 1,07 avec le nouveau tirage, et la raison est écrite sous le tableau de la section 2.1.
- `docs/mesures/cartes.json`, `docs/plan/ROADMAP.md`, `docs/design/README.md`, `assets/README.md`.

Aucune modification de `packages/sim`, de `legacy/`, de `tests/caracterisation/`, ni des images des deux cartes héritées.

## Tests

- **Ajoutés: cinq.** Deux qui décodent le Quartier normal et miroir (la boucle des vraies cartes est devenue générique), deux qui vérifient qu'aucun point tenable de la carte n'est isolé, en normal et en miroir, et un qui peuple le Quartier de 340 PNJ à travers le vrai serveur et vérifie qu'ils tiennent tous. La vérification de position a été renforcée pour les trois cartes: `positionTenable` au lieu de `estMur`.
- **Résultat: 2 418 tests unitaires au vert** (contre 2 413 au handoff 8.1), **68 tests de base** au vert sur une branche Neon neuve, migration nouvelle comprise, et **46 tests de bout en bout** au vert. Types, linter et formatage verts.
- Couverture de `packages/sim`: inchangée, le paquet n'est pas touché.
- **Empreinte des parties de référence**: ni `packages/sim` ni la logique du serveur ne sont touchés, elle ne peut donc pas avoir bougé. Relevée pour mémoire, sur ce commit: `b566653a…3a06` (150 bots, 12 joueurs, murs), `c64c0e08…9b12` (50 bots), `8a8ba1af…3cce` (300 bots sans mur), `3c090830…4884` (150 bots, 2 joueurs). Ces valeurs remplacent celles de l'étape 5.2 citées dans `charge-serveur.md`, qui datent d'avant les modes de la phase 7.
- **État de la CI**: à vérifier sur le commit `a55f822` poussé en fin de session.

## Décisions et écarts au plan

1. **La carte s'appelle `quartier` et non `map4`.** `map1` et `map3` sont des noms de fichiers hérités, pas une numérotation à poursuivre. Conséquence assumée: la valeur entre dans l'énumération PostgreSQL et n'en sortira jamais, une valeur retirée rendant illisibles les parties déjà jouées.
2. **La carte est calculée, pas dessinée.** Décidée dans la fiche, confirmée à l'usage: la mise au point a demandé une quinzaine d'essais mesurés, dont chacun aurait été un nouveau dessin dans un éditeur d'images. Effet de bord bienvenu: les critères 8 et 9 (superposition du décor et de la collision, proportions de l'image) sont vrais par construction, puisque le même programme écrit les deux images à la même dimension dans la même passe.
3. **Trois décisions de structure prises contre une mesure**, et non au goût. **Pas de boulevard périphérique**: il offre un contournement gratuit de toute la structure et remplit de sol la bande de cent pixels où se tirent les apparitions (68 pour cent hors bande au premier essai, contre 70 exigés; 93 une fois les îlots posés au ras du bord). **Des cours à une seule porte**: une deuxième porte en face fait tomber le détour de 1,24 à 1,10, parce qu'une cour traversante est une rue. **Pas de place centrale**: une cellule vide au croisement des artères coûte 0,09 de détour, une place taillée dans les angles en coûte 0,03. Le croisement des deux artères tient lieu de repère, par la couleur du sol seule, sans retirer un seul mur.
4. **La part jouable n'a pas eu à céder au détour**, contrairement à ce que la décision 9 de la fiche anticipait: 59,6 pour cent, c'est-à-dire la borne basse des 60 à 70 que la section 5.1 de l'étude proposait pour un quartier. Ce sont les îlots à cour qui l'ont permis: une ceinture de 65 pixels encombre autant qu'un pâté plein et coûte trois fois moins de mur.
5. **L'outil de mesure a été corrigé**, au titre de la règle 7. Vingt-quatre points de départ suffisaient sur deux cartes ouvertes où tous les trajets se ressemblent; sur une carte structurée, le bruit de tirage atteignait cinq centièmes de détour. Deux essais ont été réglés contre ce bruit avant que le défaut ne soit vu: le premier relevé à 1,24 valait en réalité 1,19. Conséquence: le détour de Spirit & Time passe de 1,06 à 1,07, Tokyo ne bouge pas.
6. **La carte part en ligne avec le reste.** Le porteur du projet veut la jouer à plusieurs, ce qui suppose qu'elle soit déployée. Son nom et son ambiance disent au joueur que c'est un essai.
7. **Deux pièges de géométrie trouvés et fermés**, tous deux invisibles à l'œil sur l'image, et tous deux trouvés par un test et non par la lecture. Une porte de cour qui donne sur le bord de la carte ne s'ouvre sur rien, le dehors étant un mur pour le moteur: la cour devenait un morceau isolé. Le programme refuse maintenant de dessiner une telle porte. Et une place taillée dans l'angle d'un îlot entame sa ceinture: il restait un point, un seul sur 161 000, où un ninja tenait sans pouvoir en sortir.

Aucun autre écart. Les dix micro-décisions de la fiche ont été tenues, sauf la septième, dont le miroir reste bien quatre images, et la neuvième, dont le conflit annoncé n'a pas eu lieu.

## Problèmes connus et dette

- **La carte est mesurée, elle n'est pas jugée.** Aucune mesure ne dit qu'une carte est bonne. Il reste au porteur du projet à y jouer à plusieurs, et à dire si la structure vaut un décor. C'est la seule chose qui décide de la suite.
- **Les faux ninjas dans les passages étroits n'ont toujours pas été éprouvés à plusieurs.** Leur dégagement automatique n'a connu que des terrains ouverts, et sept cours à une seule porte sont exactement ce qui peut le mettre en défaut. Premier point à observer en jouant.
- **Le Massacre et les culs-de-sac.** Sept cours à une porte font sept refuges, et le mode veut une carte qui se vide. C'est celui qui risque le plus de traîner sur cette carte.
- **Le repérage.** Un écran d'ordinateur montre 33 pour cent du Quartier contre 48 de Tokyo, et les îlots se ressemblent. Le porteur du projet a tranché le 20 septembre 2026: la minimap ne se repense que si l'on se perd vraiment.
- **Les empreintes citées dans `docs/mesures/charge-serveur.md` sont périmées** depuis les modes de la phase 7. Celles de ce handoff les remplacent. Ce n'est pas une dette de cette étape, mais c'est à savoir avant d'utiliser cet outil comme preuve de non-régression.

Repris du handoff 8.1, inchangé: le moteur ne connaît pas de ligne de vue, une couleur de joueur sombre n'a pas encore été jouée avec le repère en onde, l'équilibre des six objets du Tactique est à jouer, la vue de 500 pixels est à confirmer à plusieurs, et la déclaration du domaine aux moteurs de recherche reste à faire.

## Prochaine action exacte

Ouvrir l'étape **8.3, le miroir calculé**, dans une conversation neuve, sur `master`: rédiger sa fiche selon le cas de repli du PROTOCOLE, puis faire que le serveur retourne la collision et que la page retourne le décor, au lieu de charger un second jeu d'images. Point de départ: l'entrée `8.3` de la section 3 de `docs/plan/ROADMAP.md`, et la section 1.4 de `docs/mesures/etude-structures-de-carte.md`, qui a vérifié que le miroir est bien un simple retournement horizontal. Réserve connue à trancher dans l'étape: l'avant-plan de Tokyo a été retouché à la main dans son dossier `mirror`, identique à 91 pour cent seulement, sans doute pour que les enseignes ne se lisent pas à l'envers; l'étape doit décider si l'on conserve une image livrée quand elle existe.

Le Quartier, lui, est déjà prêt pour cette étape: ses images miroir sont produites par retournement du même programme, donc identiques au pixel à ce que le calcul rendra.

## Étape suivante

Fiche à lire: `docs/plan/etape-8-3.md`, à rédiger au début de l'étape. L'entrée correspondante est à la section 3 de `docs/plan/ROADMAP.md`.
