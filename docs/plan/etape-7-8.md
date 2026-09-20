# Fiche étape 7.8 - Style des repères de localisation

Brief de session. Objectif unique: remplacer les quatre triangles rouges qui désignent notre ninja par une onde qui se referme, à notre couleur, pour que le repère tienne dans le style du jeu. Rien d'autre ne change: ni les occasions d'un repérage, ni sa durée, ni les commandes.

## Origine de cette fiche

Aucune fiche n'existait: l'étape a été ajoutée le 20 septembre 2026, à la demande du porteur du projet, en recettant l'étape 7.7. Elle est rédigée le même jour selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- la planche de maquettes `docs/design/etape-7-8/1-reperes.png`, cinq rendus dessinés avec les images du jeu, et les décisions prises dessus;
- l'état du dépôt au commit `000362c`, et le handoff 7.7;
- la fiche 7.7 prise comme modèle.

**Numéro**: 7.8, dans la phase 7.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (7.7, ou le handoff partiel de cette étape), cette fiche, et `.claude/rules/sim-purity.md`.

## Ce qu'est le repère aujourd'hui

Quatre triangles rouges cernés de blanc, posés à 80 pixels du personnage et pointés vers lui, qui respirent de 8 pixels (`REPERE_LOCALISATION` dans `packages/client/src/rendu/apparence.ts`, `flechesDeLocalisation` dans `rendu/localisation.ts`). Ce sont les valeurs du jeu d'origine (`drawPlayerLocator`). Ils apparaissent à l'entrée en partie et après chaque capture (3,5 s), ou à la demande du joueur, touche F ou bouton (2 s), avec un fondu d'une demi-seconde. Ils sont dessinés dans le calque des repères, le seul qui rayonne (filtre de lueur néon), au-dessus du premier plan.

Deux reproches du porteur du projet: le rouge ne tient pas dans la palette du jeu, et il se confond avec les Black Ninjas, dont le halo est rouge.

## Décisions du porteur du projet, 20 septembre 2026

1. **Le rendu A des maquettes: une onde qui se referme.** Deux anneaux qui se resserrent sur le ninja, décalés d'un demi-cycle, plus un anneau d'ancrage discret autour de lui. Écartés: le viseur à quatre crochets (B), les chevrons fins (C), la colonne de lumière (D), et le maintien des triangles.
2. **La couleur du joueur, cernée de blanc.** L'anneau prend notre couleur, doublé d'un trait blanc fin: on se reconnaît, et le repère reste lisible quand notre couleur est sombre sur un fond de nuit. Écartés: notre couleur seule, le cyan de l'interface, le blanc.
3. **L'onde recommence en boucle** pendant toute la durée du repérage. Écartés: deux ondes puis plus rien, une onde puis un anneau fixe.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite.

1. **Le repère devient une suite de disques**, et non plus de triangles: `Scene.reperes` porte des `DisqueScene` (contour seul, sans remplissage), que le calque des repères sait déjà dessiner pour les halos. `FlecheScene` n'a plus d'usage et se retire du contrat de la scène.
2. **Chaque anneau est tracé deux fois**: un trait blanc à demi opaque dessous, un peu plus épais, puis le trait de notre couleur dessus. C'est la manière la moins coûteuse d'obtenir le cerné demandé, et elle reprend ce que font les icônes du jeu d'origine, cernées de blanc.
3. **L'onde se calcule à partir de l'instant**, comme l'opacité du repérage: aucun état nouveau, aucune minuterie. Un cycle dure 900 millisecondes; le second anneau est en avance d'un demi-cycle. Le rayon va de 78 à 30 pixels de carte, et l'opacité d'un anneau tombe à zéro en fin de course, pour qu'il se fonde dans le ninja au lieu de disparaître d'un coup.
4. **L'anneau d'ancrage reste**, à 26 pixels, à notre couleur, très discret: il tient le regard une fois l'onde passée, et c'est ce que montre la maquette retenue.
5. **La couleur est celle de notre personnage dans la partie**, lue comme le fait déjà la scène pour teinter les sprites. Faute de couleur (un cas qui n'arrive pas en partie), le repère se trace en blanc.
6. **Les durées, les occasions et le fondu ne changent pas**: 3,5 s à l'apparition et après une capture, 2 s à la demande, une demi-seconde de fondu.

## Périmètre

### Lot A. Le rendu

1. **`apparence.ts`**: `REPERE_LOCALISATION` décrit l'onde (rayons de départ et d'arrivée, durée d'un cycle, décalage du second anneau, rayon de l'anneau d'ancrage, épaisseurs et alphas du trait de couleur et du trait blanc).
2. **`rendu/localisation.ts`**: `flechesDeLocalisation` devient `reperesDeLocalisation`, prend la couleur du joueur et rend des disques.
3. **`rendu/scene.ts`**: `reperes` porte des disques; la couleur de notre personnage est passée au repère; `FlecheScene` retiré.
4. **`rendu/pixi.ts`**: le calque des repères dessine des disques.
5. **`index.ts`**: les exports suivent.

### Lot B. Documentation

1. Le journal de conception, le ROADMAP, et la fiche réconciliée.

## Hors périmètre

- Les occasions d'un repérage, sa durée, ses commandes.
- Le repère des autres joueurs: il n'en existe pas, et il n'en est pas question ici.
- La lueur néon elle-même, qui reste le filtre du calque des repères.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Rendu (TU)**: aucun repère sans repérage; deux anneaux et l'ancrage pendant un repérage; le rayon décroît au fil du cycle et repart au cycle suivant; le second anneau est en avance d'un demi-cycle; chaque anneau est doublé d'un trait blanc; la couleur est celle du joueur; l'opacité suit le fondu de fin de repérage.
- **Scène (TU)**: les repères suivent la position affichée de notre personnage, et pas la sienne au dernier battement; aucun repère pour les autres joueurs.
- **Bout en bout**: les scénarios existants, qui déclenchent un repérage à l'entrée en partie, restent verts et sans erreur de console.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie se joue avec le nouveau repère, vérifié dans le navigateur de Claude Code, à l'entrée en partie et à la demande (touche F).
2. Le repère est lisible sur un fond clair comme sur un fond sombre, et avec une couleur de joueur sombre.
3. La couverture de `packages/sim` ne baisse pas (le paquet n'est pas touché).

## Points de vigilance

1. **Le calque des repères rayonne**: un trait fin y brille davantage qu'ailleurs. À juger à l'écran, pas seulement sur maquette.
2. **Le repère passe au-dessus du premier plan**, toits compris: c'est voulu, c'est justement quand on ne se voit plus qu'on le demande.
3. **L'anneau ne doit pas se confondre avec les halos de bonus**, qui sont des disques pleins et pâles autour du joueur: l'onde est un trait net qui bouge.

## Réconciliation pendant l'étape (20 septembre 2026)

Écarts entre la fiche et ce qui a été construit.

1. **Aucun écart de fond.** Les six micro-décisions ont été construites telles quelles.
2. **`FlecheScene` a disparu du contrat de la scène**, comme prévu: plus rien ne dessinait de triangle. Le calque des repères dessine des anneaux, et les tests de la boucle qui comptaient quatre flèches vérifient désormais qu'un repère est posé, sans compter ses traits.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-8-handoff.md`, puis commiter. Prochaine action exacte: l'étape `8.1`, l'étude des structures de carte.
