# Handoff - Hors étape: le HUD réduit, un radar et les boutons d'action ensemble

Date: 9 octobre 2026
Auteur: session Claude Code
Statut: terminée

Travail hors plan, demandé par le porteur du projet avant de poursuivre l'étape 7.20 (Among Ninjas), dont les lots A et B attendent, non poussés, sur le `master` local.

## Objectif

Sur un Samsung A56 tenu à l'horizontale, la barre du haut prenait trop de place, et le bouton de capture, celui de la localisation, le compteur de combo et la minimap s'empilaient à droite. Le porteur du projet a fourni deux captures et une maquette: barre réduite, classement réduit, pause, son et quitter en pictogrammes, une minimap en radar réduit, un combo réduit à « x2 », « x3 », et un bouton « Capturer » rond à côté de « Localiser », un peu plus gros. Le tout reporté sur ordinateur.

## Ce qui a été fait

- Barre du haut: 44 pixels sur ordinateur, 38 sur écran tactile (56 et 48 avant). Pause, son et quitter ne montrent que leur pictogramme, leur nom reste lu par les lecteurs d'écran et passe en infobulle là où il y en avait. Le temps restant tient dans une pastille avec un chronomètre, sans l'intitulé « Temps restant ».
- Classement: plus bas, notre ligne sans hauteur supplémentaire, les points séparés du nom par un filet. Sur écran tactile ou étroit, il se limite au podium et à notre ligne.
- Radar à la place de la minimap, en haut à droite sous la barre, 112 pixels sur ordinateur, 84 sur téléphone: nous au centre, les joueurs à 1 200 pixels au plus, ceux au-delà posés sur le bord dans leur direction, deux cercles, une croix et un balayage qui tourne (arrêté si le joueur demande moins d'animations). En Tactique, 900 pixels, rien au-delà, et le disque pointillé disparaît puisque le radar est ce disque. En Chasse, notre camp seulement. Sans nous sur la carte, il part du milieu et la couvre toute.
- Combo: un « x2 » penché, sans fond, sous le radar, aux couleurs des points flottants du même cran (cyan, vert, jaune, magenta), qui grossit à chaque cran, saute en arrivant et à chaque cran, avec un trait de vitesse qui s'épuise avec la fenêtre. Il ne se montre plus à x1, en Horde comme en Massacre. Le compte des coups reste lu par les lecteurs d'écran.
- Ninjas restants du Massacre: dans la barre, une tête de ninja et le nombre, la phrase pour les lecteurs d'écran.
- Boutons d'action rangés ensemble en bas à droite, dans la surcouche: la poche (téléphone seulement), la localisation (violette), la capture (rouge, la plus grosse, la plus à droite, ses charges dans une pastille sur le bas du disque, une tête de ninja ou un katana). Le nom sous chaque disque; sur ordinateur, la touche (F, Espace) en étiquette sur le disque. La localisation quitte la barre, sur ordinateur aussi, et réagit à l'appui comme la capture.
- Effets en cours, sur écran tactile ou étroit (demande du porteur du projet en cours de session): plus de cartes, une pastille ronde de 40 pixels par effet, le pictogramme dans son disque et ce qu'il reste de l'effet en anneau autour, qui se vide comme la jauge; un malus garde son pointillé en contour, le nom et les secondes restent lus par les lecteurs d'écran. Sur écran tactile, la pastille de la poche ne se montre pas, son bouton suffit. Sur ordinateur, les cartes restent.
- Version 1.7.5, sans note.

## Retours du porteur du projet, même jour (version 1.7.6)

Après essai de la 1.7.5:

- Le rappel des touches de la barre (« ZQSD ou flèches · Espace pour trancher… ») est retiré, avec son module `interface/modeles/touches.ts`: chaque bouton d'action porte sa touche, l'aide les décrit toutes.
- Le palier d'un combo ne s'annonce plus par une bulle en haut de l'écran: « Combo x3 » flotte au-dessus de notre ninja, dans le style du compteur (penché, coloré au cran, sans fond), monte un peu et s'efface. Quand un grand titre de bonus ou de malus occupe déjà cette hauteur, il se pose sous le ninja. Le palier est calculé avec les points flottants (`palierDuFait` dans `src/pointsFlottants.ts`, genre `combo`), placé par `hud/pointsFlottants.ts`.
- Le radar ne se montre plus que pendant notre Révélation: toujours affiché, il défaisait le camouflage. Il montre alors tous les joueurs reçus, comme les halos de la scène, Chasse comprise; le Tactique garde sa portée de 900 pixels. Sans lui, le combo et le rôle de la Chasse remontent sous la barre.
- Trouvé en route par le scénario de disposition: sur un téléphone de 320 pixels de haut tenu à l'horizontale, le grand titre d'un bonus posait son disque sur le temps restant. Son milieu reste désormais au moins à 92 pixels du haut (`composants.css`).
- Fichiers: `annonces.ts`, `pointsFlottants.ts`, `hud/pointsFlottants.ts`, `hud/modele.ts`, `hud/surcouche.ts`, `rendu/boucle.ts`, `index.ts`, `interface/ecrans/jeu.ts`, `jeu.css`, `composants.css`, `version.ts`; tests `massacre.test.ts`, `horde.test.ts`, `rendu/boucle.test.ts`, `hud/pointsFlottants.test.ts`, `hud/surcouche.test.ts`, `hud/modele*.test.ts`, bout en bout `hud-reduit.spec.ts` (grand titre et palier mesurés), `tactique.spec.ts` et `massacre.spec.ts` (la touche sur le bouton au lieu du rappel).

## Fichiers créés ou modifiés

- `packages/client/src/hud/modele.ts`: `radar` (`PointRadar`, `PORTEE_DU_RADAR_PX`, `PORTEE_DU_RADAR_TACTIQUE_PX`) remplace `minimap` et `portee`; `restants` sort de `ComboHud`; le combo n'existe qu'à partir de x2.
- `packages/client/src/hud/surcouche.ts`: le temps en pastille, le radar, le combo réduit, le compteur des restants posé dans la barre (option `compteurs`), les boutons d'action dans `.hud-boutons` (option `localiser`); l'option `carte` disparaît, le radar n'en a plus besoin.
- `packages/client/src/interface/ecrans/jeu.ts`: la localisation passe à la surcouche, la place du compteur dans la barre.
- `packages/client/src/interface/icones.ts`: pictogrammes `horloge` et `masque`.
- `packages/client/page/styles/jeu.css`: barre, temps, classement, radar, boutons, combo, effets en pastilles, tailles des écrans tactiles et étroits.
- `packages/client/src/index.ts`: `PointRadar` au lieu de `PointMinimap`, `COTE_MINIMAP` retiré.
- Textes et commentaires: `aide.ts` (« radar limité » en Tactique), `rendu/camera.ts` (il prêtait à la minimap un rectangle de vue qu'elle n'a jamais dessiné), `packages/shared/src/chasse.ts`.
- `packages/shared/src/version.ts`: 1.7.5.
- Tests: `modele.test.ts`, `modele.tactique.test.ts`, `modele.chasse.test.ts`, `surcouche.test.ts`, `massacre.test.ts`, `horde.test.ts`; bout en bout `hud-reduit.spec.ts` (nouveau, bureau seulement, déclaré dans `playwright.config.ts`), `hud-telephone.spec.ts`, `hud-lisible.spec.ts`, `massacre.spec.ts`.
- `docs/design/README.md`: entrée du journal du 9 octobre 2026.

## Tests

- Ajoutés: le radar (centre, part de portée, bord, milieu de carte sans nous, Tactique sans bord), le combo absent à x1, les restants à part, et dans la surcouche l'ordre des boutons et leurs appuis, le katana, le combo, le compteur dans la barre et son retrait, les points du radar, les lignes hors podium, le temps caché tant que rien n'est affiché. `hud-reduit.spec.ts` monte le HUD complet (barre, radar, combo x5, trois boutons, deux effets et la poche, six joueurs) sur des téléphones à l'horizontale (800 sur 360, 640 sur 320) et à la verticale (412 sur 780, 360 sur 640) et sur ordinateur (1280 sur 720), et exige qu'aucun bloc n'en chevauche un autre et que tous tiennent dans l'écran; et une barre de moins de 40 pixels sur téléphone.
- Résultat: 3 670 tests unitaires au vert, types et linter propres sur les quatre paquets. Bout en bout: 95 sur 96 au premier passage complet; l'échec était fondé, le bouton de localisation à 50 pixels sur téléphone quand l'étape 5.4 en exige 56 (la taille d'un pouce), remonté à 56 et la capture à 64; puis les scénarios du HUD, de la navigation, du peaufinage, du Massacre et de la poche au vert sur les deux projets (24).
- Captures: `docs/design/hud-reduit/` (téléphone à l'horizontale, à la verticale, ordinateur).
- Couverture de packages/sim: inchangée, rien n'y a été touché.

## Décisions et écarts au plan

- Le « x2 » de la maquette apparaissait deux fois, à côté du score et flottant à droite. Seul le flottant est construit, sous le radar. À revoir en jouant.
- Un radar centré sur nous plutôt qu'une carte entière réduite: c'est ce que montre la maquette (points rouges sur le bord). Il dit où sont les autres, pas où l'on est sur la carte.
- Le combo ne se montre plus à x1 en Massacre non plus: un « x1 » n'apprend rien. Le compte ne peut alors être qu'au pluriel (x2 demande cinq coups).
- Livraison: le travail est fait sur une branche partie de `origin/master`, poussée en avance rapide, puis les deux commits locaux de l'étape 7.20 sont replacés par-dessus. Ils ne sont pas poussés: le client ne compile pas avec eux (le mode `among` manque aux tables des modes de la page), ce que le lot suivant de l'étape 7.20 doit régler.

## Problèmes connus et dette

- Le pictogramme de la fumée (`assets/objets/fumee.svg`) paraît vide dans la carte de la poche et sur son bouton dans les captures du scénario; antérieur à ce travail, non vérifié en partie.
- Pas encore joué sur le Samsung A56 du porteur du projet: les tailles sont mesurées en émulation.

## Prochaine action exacte

Reprendre l'étape 7.20 (lot C, la page), sur le `master` local qui porte ses lots A et B.
