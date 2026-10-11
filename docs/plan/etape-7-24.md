# Fiche étape 7.24 - Among Ninjas, les tâches longues

Brief de session. Objectif unique: ajouter aux listes des proies quatre tâches longues, des mini-jeux d'arcade de quinze à vingt-cinq secondes joués dans la fenêtre des tâches, pendant lesquels la proie reste immobile et vulnérable: c'est là que l'assassin frappe. Le serveur les garde comme les tâches courtes (présence, durée minimale, rôle). L'appropriation et d'autres tâches courtes restent aux étapes suivantes.

## Origine de cette fiche

Rédigée le 11 octobre 2026, au début de l'étape, selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2): aucune fiche n'avait été fournie. Sources: les sections 9.4 (le catalogue), 9.5 (d'une partie à l'autre), 10 (les stations), 18 (le plan) et 22 (les tâches courtes construites) de l'étude `docs/design/etude-mode-among-ninjas.md`, la fiche 7.21 prise comme modèle, le handoff `docs/handoffs/etape-7-23-handoff.md`, et l'état du dépôt au commit `9b2194f`.

**Aucune référence de comportement.** Ni la v0.8.6 ni la v0.9.0 n'ont ce mode: rien à caractériser. Les règles ci-dessous font foi, avec celles des fiches 7.20 à 7.23.

**Numéro**: 7.24, dans la phase 7, « Modes de jeu ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (7.23, ou le handoff partiel de cette étape), cette fiche, `.claude/rules/sim-purity.md`, les sections 9 et 22 de l'étude, et la fiche 7.21.

## Décisions du porteur du projet

Du 5 et du 6 octobre 2026 (étude, sections 9.4 et 20) et du 10 octobre 2026 (fiches 7.21 et 7.22):

1. **Quatre mini-jeux d'arcade**, dans une étape à part des tâches courtes: un jeu de blocs à empiler, un serpent, des envahisseurs, une bataille navale.
2. **Une liste de tâches par proie**, jamais deux fois la même tâche, la tâche de chaque station tirée pour chaque proie (inchangé depuis 7.21 et 7.22).
3. **Chaque tâche se joue à la souris, au clavier et au doigt** (étude, section 9.4).
4. **Le mode ne se déploie qu'avec ses étapes suivantes**, sur accord du porteur du projet: `master` ne se pousse pas à la fin de cette étape. Avant toute poussée, la suite de bout en bout complète se rejoue.

## Questions soumises au porteur du projet, et ses réponses du 11 octobre 2026

Les quatre recommandations de la fiche ont été retenues.

1. **Combien de tâches longues dans une liste ?** Les listes se tirent aujourd'hui parmi les sept natures; avec onze, une proie pourrait tirer trois mini-jeux et une autre aucun. Recommandé, et retenu: **un réglage de l'hôte, « dont tâches longues », de 0 à 2, une par défaut**, comptées dans le nombre de tâches par proie (cinq tâches par défaut: une longue et quatre courtes), comme le réglage des tâches longues d'Among Us. Autres voies: exactement une par liste, sans réglage; ou un tirage libre parmi les onze.
2. **Où se jouent les mini-jeux ?** L'étude les mettait aux bornes et à la table de jeu de l'arcade, et à la table de la maison: les assassins sauraient où guetter. Recommandé, et retenu: **chaque mini-jeu à deux stations, dans deux quartiers**: les blocs aux bornes d'arcade et aux bureaux de la salle violette, le serpent aux bornes et à l'ordinateur de la maison, les envahisseurs aux bornes et aux bureaux, la bataille navale à la table de jeu de l'arcade et à la table de la maison. Chacune de ces stations garde aussi sa tâche courte. Autre voie: les stations de l'étude seulement.
3. **Que coûte un échec ?** Un serpent qui se mord, des envahisseurs au sol, des blocs qui ne font pas leurs lignes, une bataille navale sans munitions. Recommandé, et retenu: **le mini-jeu recommence sur place**, une partie neuve, sans fermer la fenêtre ni rien dire au serveur: un échec ne coûte que du temps, comme un geste raté (fiche 7.21). Autres voies: un échec ferme la tâche, à rouvrir; ou des mini-jeux qu'on ne peut pas perdre.
4. **Les noms.** « Tetris » et « Space Invaders » sont des marques, et l'aspect de Tetris (sa grille de dix sur vingt, ses pièces) a déjà été défendu en justice aux États-Unis. Recommandé, et retenu: **des noms et des dessins à nous**, « Empiler des caisses », « Nourrir le serpent », « Repousser les Black Ninjas », « Bataille navale », une grille plus petite que celle de Tetris, les envahisseurs dessinés en Black Ninjas. Autre voie: les noms de l'étude.

La version suit l'usage des étapes 7.21 à 7.23: **tout sous la 1.9.0**, toujours pas en ligne, dont la note gagne les mini-jeux.

## Les règles et les valeurs

Les propositions de l'étude, précisées par cette fiche. Toutes se révisent après une partie d'essai.

### Les quatre mini-jeux

Chacun se joue dans la fenêtre néon des tâches courtes (rendu 1A de 7.21), dans le même espace de 400 sur 300 unités, au bureau comme au téléphone en portrait. La « durée visée » est celle d'un joueur moyen; la « durée minimale » est ce que le serveur exige entre l'ouverture et la fin.

| Tâche (nom proposé)        | But                                                                                                 | Au pointeur (souris, doigt)                                       | Au clavier                                              | Visée | Minimale |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- | ----: | -------: |
| Empiler des caisses        | Une grille préparée de 6 colonnes sur 10 lignes; poser trois pièces pour compléter deux lignes      | Quatre boutons sous la grille: gauche, tourner, droite, descendre | Gauche et droite, Haut pour tourner, Bas pour descendre |  20 s |     12 s |
| Nourrir le serpent         | Manger cinq fruits sur une grille de 12 sur 9, sans se mordre ni toucher le bord                    | Glisser dans la direction voulue, n'importe où dans la fenêtre    | Flèches                                                 |  20 s |     12 s |
| Repousser les Black Ninjas | Abattre une rangée de huit envahisseurs qui descend en zigzag                                       | Le ninja suit le pointeur le long du bas, et tire seul            | Gauche et droite; il tire seul                          |  20 s |     12 s |
| Bataille navale            | Couler deux bateaux, de trois et deux cases, sur une grille de 6 sur 6, en un nombre de tirs limité | Toucher une case                                                  | Flèches pour la case, Espace pour tirer                 |  25 s |     12 s |

- **Le rythme est réglé dans la page**, comme pour les gestes: la chute des pièces et leur descente la plus rapide, l'allure du serpent et l'éloignement de chaque fruit, la cadence du tir et la marche des envahisseurs, l'animation de chaque tir de la bataille navale. Un joueur rapide et honnête finit au-dessus de la durée minimale, sauf à la bataille navale, où la chance peut couler les deux bateaux en cinq tirs: la fenêtre garde alors l'écran gagné jusqu'à la durée minimale, puis annonce la fin. Les tests de la page jouent chaque mini-jeu au plus vite.
- **Le nombre de tirs de la bataille navale** se règle par simulation, dans les tests: un joueur méthodique (qui cherche, puis suit un bateau touché) doit réussir neuf fois sur dix. Les douze tirs de l'étude sont trop peu pour deux bateaux de cinq cases sur trente-six; la fiche s'attend à seize ou dix-huit.
- **Chaque partie se tire dans la page**, d'une graine dérivée de la partie, du joueur, de la station et de la tâche, comme les gestes; une partie neuve après un échec prend la graine suivante. Les grilles des blocs se construisent à l'envers, pour être toujours faisables: deux lignes pleines, dont on retire les trois pièces données.
- **Un échec** (réponse 3) recommence le mini-jeu sur place: l'écran perdu une seconde, puis une partie neuve, dans la même fenêtre, sans rien dire au serveur. La durée minimale se compte toujours de l'ouverture.
- **Une tâche longue interrompue est perdue en entier**, comme une courte: sortir du disque, une réunion, la mort, Échap ou la croix. Le serveur ne connaît pas son avancement, et une reprise demanderait qu'il le connaisse.

### Les tâches de chaque station

Réponse 2:

| Station                      | Tâches courtes        | Tâches longues                                                      |
| ---------------------------- | --------------------- | ------------------------------------------------------------------- |
| Bornes d'arcade              | Relier des couleurs   | Empiler des caisses, Nourrir le serpent, Repousser les Black Ninjas |
| Table de jeu de l'arcade     | Ranger des mines      | Bataille navale                                                     |
| Ordinateur de la maison      | Relier des couleurs   | Nourrir le serpent                                                  |
| Table de la maison           | Nettoyer les lunettes | Bataille navale                                                     |
| Bureaux de la salle violette | Relier des couleurs   | Empiler des caisses, Repousser les Black Ninjas                     |

Les huit autres stations ne changent pas.

### Les listes

Réponse 1: le réglage « dont tâches longues », de 0 à 2, une par défaut, compris dans le nombre de tâches par proie (de 3 à 7, inchangé). Au lancement:

- **Les stations actives** permettent toujours toutes les tâches courtes, chacune à une station différente (comme à 7.21), et au moins autant de tâches longues distinctes, à des stations encore différentes, que le réglage en demande. Le reste se tire comme avant: les lieux changent d'une partie à l'autre.
- **Chaque liste** prend autant de tâches longues que le réglage, tirées parmi celles des stations actives, puis ses tâches courtes; toujours des natures distinctes à des stations distinctes, réparties sur les stations les moins prises.

### Ce que garde le serveur

Rien de neuf: l'ouverture à l'appui, la présence, la durée minimale de la nature, le rôle (fiche 7.21). Une tâche longue compte pour une tâche dans la barre et dans la victoire des proies.

### Les assassins qui font semblant

Comme pour les courtes: l'une des tâches de la station, tirée par la page, la même pour lui à cette station, longues comprises. Un assassin qui fait semblant à une borne joue donc parfois un mini-jeu de vingt secondes, sans effet. Rien ne part au serveur.

### Pendant une tâche longue

Comme une courte (fiche 7.21): on ne bouge pas, on reste vulnérable, la mort, une réunion et Échap ferment la fenêtre. Les commandes inversées des sabotages n'inversent pas les mini-jeux, comme elles n'inversent pas les gestes. Aucune tâche longue n'est visuelle: rien ne se voit de l'extérieur.

### La version

Tout sous la 1.9.0, dont la note gagne une puce sur les mini-jeux, à soumettre au porteur du projet.

## Les sons

Tous se jouent chez le seul joueur qui fait la tâche, comme ceux des tâches courtes. Chacun a un provisoire, pris dans ceux du jeu, jusqu'à ce que le porteur du projet fournisse le sien (mp3, court, sans silence en tête).

| Son à fournir      | Quand                             | Provisoire proposé     |
| ------------------ | --------------------------------- | ---------------------- |
| Pièce posée        | Une caisse se pose                | `button-click.wav`     |
| Ligne complète     | Une ligne de caisses s'efface     | `collect-bonus.wav`    |
| Fruit mangé        | Le serpent mange un fruit         | `bot-convert.mp3`      |
| Shuriken lancé     | Le ninja tire                     | `katana-swing.mp3`     |
| Black Ninja abattu | Un envahisseur touché             | `blackbot-destroy.mp3` |
| Tir à l'eau        | Bataille navale, case vide        | `shotgun-wave.mp3`     |
| Bateau touché      | Bataille navale, case d'un bateau | `explosion-mine.mp3`   |
| Mini-jeu perdu     | Un échec, avant la partie neuve   | `collect-malus.wav`    |

L'ouverture et la réussite gardent les sons des tâches courtes.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE, à réviser en exécutant si le dépôt le demande. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite.

1. **Les natures de tâche s'étendent**: `NATURES_DE_TACHE` gagne les quatre mini-jeux, avec leur durée minimale, et le contrat dit lesquelles sont longues (`TACHES_LONGUES`). Les natures courtes restent une liste à part pour le tirage.
2. **Le réglage des tâches longues** (réponse 1) rejoint ceux du mode, avec sa borne, sa validation et sa place au salon. Les bornes du nombre de tâches par proie ne changent pas.
3. **Le tirage du lancement change dans ce mode seul**: les stations actives, puis les listes, comme dit plus haut. L'empreinte des quatre parties de référence ne bouge pas.
4. **Les mini-jeux sont des modèles purs de la page**, un par nature, dans `packages/client/src/interface/modeles/gestes/`, avec les mêmes commandes que les gestes (pointeur, touche, temps), leurs échos et leurs tests. La fenêtre, son dessin et son annonce de fin servent tels quels; seul le dessin de chaque mini-jeu s'ajoute.
5. **Le moteur ne connaît que la nature et sa durée minimale**: aucune règle des mini-jeux n'entre dans `packages/sim`.

## Rendus

Après confirmation des règles, une planche `docs/design/etape-7-24/1-planche.png` (source `planche.html` à côté), dessinée en code dans la fenêtre néon, sur ordinateur et sur téléphone en portrait:

1. **Les quatre mini-jeux**, deux ou trois propositions de dessin chacun (pixels d'arcade, néon au trait, ou dans le style des gestes).
2. **L'échec et la partie neuve**, et l'écran gagné qui attend la durée minimale.
3. **Les commandes au doigt**: les boutons des caisses, le glissé du serpent.

Les captures dans le vrai jeu, au fil de la construction, à côté.

## Périmètre

### Lot A. Le contrat et le moteur

1. Les quatre natures, leurs durées minimales, les natures longues; les natures des cinq stations; le réglage des tâches longues, sa borne et sa validation.
2. Les stations actives et les listes, avec leurs tâches longues.
3. L'empreinte des quatre parties de référence identique avant et après.

### Lot B. Le serveur

1. Le réglage au salon, de bout en bout du schéma.
2. Tests à travers le vrai serveur: une proie ouvre un mini-jeu, sa fin trop tôt refusée, acceptée après la durée minimale.

### Lot C. La page

1. Les quatre mini-jeux, modèle et dessin, au pointeur et au clavier, jouables sur téléphone en portrait.
2. L'échec, l'écran gagné qui attend la durée minimale.
3. L'assassin qui fait semblant à une station de mini-jeu.
4. Le salon: le réglage nouveau. La carte plein écran et la liste: le nom des tâches longues.
5. Les sons, provisoires.
6. L'aide du mode: une ligne sur les tâches longues.

### Lot D. Bout en bout, mesure et documentation

1. Le scénario `tests/e2e/among.spec.ts`: la proie de la page joue un mini-jeu au clavier jusqu'au bout.
2. Banc: la mesure de 7.23 rejouée (section 32 de `docs/mesures/charge-serveur.md`), pour vérifier que le tirage nouveau ne coûte rien de visible.
3. Journal de conception, ROADMAP, étude (section 25).
4. La note de la 1.9.0 complétée des mini-jeux, à soumettre au porteur du projet; le numéro reste 1.9.0.
5. **Avant toute poussée**, sur accord du porteur du projet: la suite de bout en bout complète, bureau et téléphone, rejouée.

## Hors périmètre

- D'autres tâches courtes (étape 7.26), l'appropriation (étape 7.25): égouts, déguisement, ninjas égarés, ronde des néons.
- Une tâche longue visible de l'extérieur, ou en plusieurs parties qu'on reprend.
- Toute modification des autres modes, de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: les onze natures et leurs durées, les natures longues, chaque station avec au moins une nature courte, le réglage et sa validation.
- **Lancement (TU)**: chaque liste a le nombre réglé de tâches longues, des natures distinctes à des stations distinctes; les stations actives permettent toujours toutes les listes; reproductible à graine égale; aucun tirage dans les autres modes.
- **Tâches (TU)**: la durée minimale d'une tâche longue, refusée avant, acceptée après.
- **Serveur (TI)**: le lot B, point 2.
- **Page (TU)**: le modèle de chaque mini-jeu (le but atteint, l'échec et la partie neuve, les commandes du clavier et du pointeur), le rythme au plus vite qui ne passe jamais sous la durée minimale (la bataille navale par l'écran gagné qui attend), le taux de réussite de la bataille navale par simulation, les grilles de caisses toujours faisables, le réglage du salon.
- **Bout en bout**: le scénario du lot D.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les quatre mini-jeux se jouent dans la page à la souris, au clavier et au doigt, sur ordinateur et sur téléphone en portrait, vérifiés dans le navigateur.
2. **Une tâche longue ne se fait ni de loin, ni plus vite que sa durée minimale, ni par un assassin**, vérifié par les tests du serveur.
3. **Les cinq autres modes n'ont pas changé**: tests existants inchangés, empreinte des quatre parties de référence identique.
4. La couverture de `packages/sim` ne baisse pas (99,84 pour cent au handoff 7.23).
5. `master` n'est pas poussé sans l'accord du porteur du projet, et jamais avant la suite de bout en bout complète.

## Points de vigilance

1. **Le doigt.** Un mini-jeu d'action sur un téléphone en portrait, dans une fenêtre de 400 sur 300 unités ramenée à la largeur de l'écran: les cases, les boutons et le glissé doivent rester assez grands. À essayer à 375 sur 812 avant de déclarer fini.
2. **Le rythme et la durée minimale sont liés**, comme pour les gestes: un joueur rapide refusé par le serveur serait un défaut. Un test le garde, mini-jeu par mini-jeu.
3. **Aucune touche d'un mini-jeu ne doit faire bouger le ninja derrière**, et les flèches du serpent ne doivent pas faire défiler la page.
4. **Rien ne doit trahir une feinte**: un assassin qui joue pour de faux s'arrête aussi longtemps qu'une proie.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-24-handoff.md`: les décisions confirmées en début d'étape, les écarts à cette fiche (section « Réconciliation », à créer), les chiffres du banc, l'état de la CI et de `master` (non poussé). Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP et l'étude. Prochaine action exacte: l'étape suivante de la section 3 du ROADMAP. Commiter.
