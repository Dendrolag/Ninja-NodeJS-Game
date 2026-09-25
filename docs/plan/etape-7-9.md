# Fiche étape 7.9 - L'Évadé

Brief de session. Objectif unique: faire apparaître une fois par partie un ninja rayé rouge et blanc, l'Évadé, qui fuit les joueurs un peu plus vite qu'eux. Celui qui l'attrape, ou qui l'élimine en Massacre, porte jusqu'à la fin un multiplicateur x2 sur son score, qu'un autre joueur peut lui voler en le capturant.

## Origine de cette fiche

Aucune fiche n'existait. Le porteur du projet a ouvert cette étape le 25 septembre 2026, avec l'étape 4.6, sous le nom de travail « Ninja Où est Charlie ? »: « un Ninja avec un skin uniquement rayé blanc et rouge [...] avec un drop unique en partie, il fuit les joueurs et se déplace un tout petit peu plus rapidement que les PNJ/joueurs (sauf si ceux-ci prennent un bonus de vitesse): à sa capture ou élimination il donne un bonus de multiplication de score unique ». Il n'a pas d'image pour ce personnage: tout se dessine en code.

Rédigée le même jour selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- huit décisions de jeu tranchées avec le porteur du projet, ci-dessous;
- une planche dessinée sur les vrais sprites du jeu, rangée dans `docs/design/etape-7-9/1-evade.png`;
- la fiche 7.7 prise comme modèle, et les fiches 7.4 et 7.5 pour le Massacre et la Horde;
- l'état du dépôt au commit `9deed8e`, et le handoff 8.6.

**Numéro**: 7.9, dans la phase 7, « Modes de jeu ». Elle suit l'étape 4.6, dont elle réutilise le grand titre des annonces et le classement agrandi.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff, cette fiche, les fiches 7.4 et 7.5, et `.claude/rules/sim-purity.md`.

## Ce qu'est le jeu aujourd'hui

Toutes les entités vont à 150 pixels par seconde hors bonus (étape 7.5), et le bonus de vitesse porte un joueur à 255. Les PNJ errent (`packages/sim/src/bots.ts`). Les Black Ninjas chassent, et apparaissent à un moment réglé de la partie. Aucune entité ne fuit. Le score est un stock déduit de l'état, jamais rangé (`score.ts`): en Horde et en Tactique, les ninjas portés et les Black Ninjas détruits, plus la réserve de primes de combo en Horde; en Équipes, les ninjas de l'équipe; en Massacre, des points rangés dans l'état. Aucun multiplicateur ne s'applique au score entier.

## Décisions du porteur du projet, 25 septembre 2026

1. **Le nom affiché est « l'Évadé »**. « Où est Charlie ? » est une marque déposée, et ses rayures rouges et blanches en sont l'emblème: le nom de la marque n'apparaît nulle part dans le jeu.
2. **Il apparaît en Horde, en Tactique, en Équipes et en Massacre**, pas en Chasse.
3. **Une seule fois par partie, à un moment tiré au sort** entre le quart et les trois quarts de la durée. Une annonce prévient tout le monde. S'il n'est pas attrapé dans les 45 secondes, il s'en va, perdu pour tous.
4. **Il va à 165 pixels par seconde**, dix pour cent de plus que tout le monde. Un joueur sans bonus ne le rattrape pas en ligne droite: il faut le coincer, s'y mettre à plusieurs, ou prendre le bonus de vitesse.
5. **Il donne un x2 porté**: le joueur qui l'attrape, ou qui l'élimine en Massacre, voit tout son score compter double jusqu'à la fin de la partie. S'il se fait capturer par un joueur, ou tuer par un joueur en Massacre, son capteur lui prend le x2.
6. **En Équipes, le x2 double le score de l'équipe** du porteur. S'il se fait capturer, le x2 passe à l'équipe adverse.
7. **Un Black Ninja détruit le x2**: s'il attrape le porteur, ou le tue en Massacre, le x2 est perdu pour tous.
8. **Tout le monde voit le porteur**, sur la carte et au classement. C'est ce qui crée la tension: le porteur devient la cible.

Rendus choisis sur la planche `docs/design/etape-7-9/1-evade.png`:

9. **Le skin C**: le corps du ninja, la partie aujourd'hui repeinte à la couleur du joueur, rayé rouge et blanc par bandes de deux lignes de pixels, avec un halo pulsé rouge et blanc. Il se repère dans la foule.
10. **La marque C du porteur**: un anneau rayé rouge et blanc autour de son ninja, et un badge « x2 » au-dessus de sa tête. Au classement, un badge « x2 » à côté de son nom.

Écartés: « Charlie » comme nom; le x2 temporaire, le score doublé une seule fois, et le x1,5 au décompte final; la Chasse; l'apparition à mi-partie ou dès le départ; 157 et 180 pixels par seconde; le x2 réservé à la part du joueur en Équipes; un porteur qui garde son x2 face au Black Ninja; un porteur connu de lui seul, ou visible au seul classement; les rayures fines et les rayures sans halo; l'anneau seul et le badge seul.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **L'Évadé vit dans un champ à part de l'état**, `evade`, absent tant qu'il n'a pas de raison d'être, comme `tactique`, `chasse`, `massacre` et `horde`. Il porte le moment d'apparition tiré au lancement, l'Évadé sur la carte s'il y est, son temps restant, et le porteur du x2. Ce n'est ni un PNJ ni un Black Ninja: il ne prend ni ne transmet de couleur, les PNJ le traversent, et les Black Ninjas l'ignorent.
2. **Un réglage de partie l'active**, un interrupteur « L'Évadé », actif par défaut, proposé dans les quatre modes et retiré de la Chasse par `imposerLesReglagesDuMode`. C'est ce qui permet de prouver que, sans lui, rien d'autre n'a changé (voir le lot E).
3. **Le tirage se fait au lancement, et seulement si le réglage est actif**, par le générateur à graine de l'état. Une partie sans Évadé ne consomme aucun tirage de plus.
4. **Il apparaît loin des joueurs**, par `positionDApparition` et les positions occupées, comme un Black Ninja.
5. **Sa fuite**: tous les quarts de seconde, il regarde les joueurs à moins de 300 pixels. S'il en voit, il essaie huit caps et prend celui qui l'éloigne le plus d'eux sans le jeter dans un mur (`trajetTenable`). Sinon, il erre comme un PNJ. Il garde le dégagement automatique des PNJ, pour ne jamais rester coincé contre un mur. Les valeurs (300 pixels, un quart de seconde, huit caps) vivent dans `packages/shared` et se règlent à la recette.
6. **Les zones spéciales ne l'affectent pas**: ni la zone répulsive, ni la zone de chaos. Il n'a pas de couleur à repeindre, et une zone qui le pousserait déciderait de la partie à la place des joueurs.
7. **On l'attrape comme on prend un PNJ dans chaque mode**: au contact en Horde et en Équipes, par le tir en cône en Tactique, d'un coup de katana en Massacre. Un tir qui l'attrape coûte une charge, comme pour un PNJ. Il ne rapporte rien d'autre que le x2: aucun point, aucun ninja, et il ne compte pas dans le combo.
8. **Le x2 s'applique au score affiché**, et à lui seul. Les ninjas portés, les Black Ninjas détruits, la réserve de primes, les points du Massacre restent ce qu'ils sont: le score se déduit toujours de l'état, puis double pour le porteur (`pointsDe`). Un vol de la moitié des points en Massacre porte sur les points rangés, pas sur le double.
9. **Le x2 suit les captures**: capturé par un joueur, le porteur le cède à son capteur, en même temps que ses ninjas. Attrapé par un Black Ninja, il le perd. Un porteur dont le lien tombe le garde pendant les 30 secondes du retour (étape 2.5). Un porteur qui quitte la partie le perd.
10. **Le x2 compte au classement final**, dans l'historique, dans la progression et dans le record du Massacre en solo, comme tout le score (décisions 11 et 12).
11. **Le flux d'état porte l'Évadé** comme un nouveau type d'entité, ajouté en fin de liste (`TYPES_ENTITE`), et le porteur du x2 dans la vue de la partie. Comme à l'étape 7.7, une partie sans Évadé doit s'écrire à l'octet comme avant, sans changer `VERSION_DU_FLUX`.
12. **Quatre annonces**, au grand titre de l'étape 4.6, en rouge et blanc, à tous les joueurs: son apparition (« L'Évadé rôde ! »), sa capture (« Remi a attrapé l'Évadé : x2 »), le vol du x2 (« Kenji vole le x2 de Remi »), sa fuite (« L'Évadé s'est échappé »). La perte face à un Black Ninja s'annonce aussi. Les textes se valident à la recette.
13. **Le skin se calcule au chargement**, comme la recoloration (`recoloration.ts`): un troisième calque, le corps rayé, tiré des mêmes images. Aucun fichier d'image n'est ajouté.
14. **Aucun son nouveau**: l'apparition et la capture reprennent des sons existants, choisis dans l'étape.
15. **La minimap ne le montre pas**: on le cherche des yeux, c'est le principe du personnage. Elle ne change pas non plus pour le porteur.

## Tranché par le porteur du projet avant l'étape, 25 septembre 2026

11. **L'Évadé apparaît aussi dans le Massacre en solo**, et un record battu avec le x2 compte comme un autre.
12. **Le x2 double le score, et donc indirectement les récompenses de progression** qui en dépendent. C'est voulu.

## Périmètre

### Lot A. Le contrat

1. **Les valeurs**: vitesse, rayon de fuite, cadence, fenêtre d'apparition, durée de présence (`EVADE` dans `packages/shared`).
2. **Le réglage** et son imposition selon le mode (micro-décision 2).
3. **Les vues et les événements**: l'entité dans le flux et son codage, le porteur dans la vue de la partie, les faits d'apparition, de capture, de vol, de perte et de fuite (micro-décisions 11 et 12).

### Lot B. Le moteur

1. **L'apparition et le départ**: le tirage au lancement, la position, les 45 secondes (micro-décisions 3 et 4).
2. **La fuite** (micro-décisions 5 et 6).
3. **La capture** dans chacun des quatre modes (micro-décision 7).
4. **Le x2**: le score affiché, les transferts, la perte (micro-décisions 8 à 10, décisions 5 à 7).

### Lot C. Le serveur

1. **Tests à travers le vrai serveur**: une partie de chacun des quatre modes où l'Évadé apparaît, est attrapé, puis où son porteur est capturé; le classement final avec le x2, enregistré en base; une partie Chasse sans Évadé.

### Lot D. La page

1. **Le skin rayé** et son halo pulsé (décision 9, micro-décision 13).
2. **La marque du porteur**: l'anneau rayé et le badge « x2 » sur la carte, le badge au classement de l'étape 4.6 et au classement final (décisions 8 et 10).
3. **Les annonces** (micro-décision 12) et les sons (micro-décision 14).
4. **Le réglage** dans le formulaire de création, et dans le récapitulatif du salon.
5. **L'aide**: une ligne par mode concerné.

### Lot E. Mesure et documentation

1. **Empreinte**: les quatre parties de référence, Évadé désactivé, identiques à l'octet à celles du dernier handoff. Puis leurs nouvelles empreintes, Évadé actif, consignées au handoff comme changement voulu.
2. **Banc de charge**: une partie pleine avec l'Évadé, avant et après, consignée dans `docs/mesures/charge-serveur.md`. Il est une entité de plus: aucun écart n'est attendu.
3. **CLAUDE.md**: le comportement à préserver 1 (le score est un stock) reçoit une précision datée pour le x2, comme l'étape 7.5 l'a fait pour la réserve de primes. Le 2 reçoit la cession du x2 avec les ninjas.
4. **Documentation**: le journal de conception, le ROADMAP.

## Hors périmètre

- La Chasse.
- Une image de l'Évadé dessinée par un graphiste: le skin est en code, et une commande éventuelle serait une autre étape.
- Plus d'un Évadé par partie, ou un Évadé qui revient.
- Un autre effet que le x2.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: les valeurs; le réglage présent dans quatre modes et absent de la Chasse; le codage de l'entité et du porteur, et l'aller-retour; une partie sans Évadé qui s'écrit à l'octet comme avant.
- **Moteur (TU)**: le moment tiré dans la fenêtre, déterministe, et aucun tirage sans le réglage; l'apparition loin des joueurs; le départ au bout de 45 secondes; la fuite, face à un et à plusieurs joueurs, contre un mur et dans un coin; la vitesse de 165, dépassée par un joueur sous bonus de vitesse; les zones sans effet; la capture dans chacun des quatre modes; le x2 au score de chaque mode, à l'équipe en Équipes; la cession au capteur, la perte face au Black Ninja, le départ du porteur; le vol de moitié du Massacre sur les points rangés; le Massacre qui finit carte nettoyée sans attendre l'Évadé.
- **Serveur (TI)**: le lot C.
- **Client (TU)**: le calque rayé; l'anneau et le badge du porteur; le badge au classement; les annonces; le réglage au formulaire.
- **Bout en bout**: une partie Horde réglée pour que l'Évadé apparaisse tôt, où le joueur l'attrape et voit le x2 au classement; les scénarios existants.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. L'Évadé apparaît, fuit, se fait attraper et donne son x2 dans les quatre modes, depuis la page, sur ordinateur et sur téléphone.
2. Le skin, l'anneau et le badge correspondent à la planche retenue, vérifiés dans le navigateur de Claude Code, avec une capture d'écran.
3. L'empreinte des parties de référence, Évadé désactivé, est identique à celle du dernier handoff.
4. La couverture de `packages/sim` ne baisse pas.

## Points de vigilance

1. **Le score reste un stock**: le x2 ne se range jamais comme un nombre dans l'état. Seul le porteur y est rangé, et le score se déduit.
2. **Une fuite trop bonne** rendrait l'Évadé imprenable: à 165 pixels par seconde, il ne doit pouvoir s'échapper que par l'espace. Le mesurer en jouant sur les trois cartes, le Quartier compris, dont les cours à une seule porte sont des pièges naturels.
3. **Le dégagement automatique** n'a jamais été éprouvé sur une entité qui fuit: un cap choisi pour fuir ne doit pas le coller indéfiniment à un mur.
4. **Le flux binaire** (étape 2.3): une entité nouvelle demande son codage et un test d'aller-retour. Le miroir aussi (étape 8.3): ses positions sont celles du terrain retourné, comme toutes les autres.
5. **Les équipes**: une équipe est une couleur pour le moteur (étape 7.2). Le x2 d'équipe se lit à la couleur du porteur, sans nouveau champ d'équipe.

## Réconciliation pendant l'étape (25 septembre 2026)

Écarts entre la fiche et ce qui a été construit, consignés au journal de `docs/design/README.md`.

1. **La fuite a été mesurée, et le porteur du projet l'a gardée sans répit.** Des poursuivants sans bonus qui foncent droit sur l'Évadé, vingt parties par cas, 45 secondes: seul, 6 sur 20 sur Tokyo, 4 sur le Quartier, 0 sur Spirit & Time; à trois, 16, 10 et 0 sur 20. Un fuyard plus rapide que son poursuivant ne se rattrape qu'en le coinçant, et Spirit & Time est un terrain ouvert. Ralentir l'Évadé à 150 n'y changeait presque rien. Un essoufflement (trois secondes de course, une de pause) le rendait prenable partout (seul, 11, 16 et 8 sur 20); le porteur du projet a préféré un trophée rare, et l'essai a été retiré du code.
2. **Seize caps essayés, et non huit**: huit laissaient des trajectoires en zigzag le long des murs. Les valeurs vivent dans `EVADE` (`packages/shared`).
3. **La capture au contact vit dans `contacts.ts`** (`attraperLEvadeAuContact`), et non dans `evade.ts`: `evade.ts` est lu par `capture.ts`, qui est lu par `contacts.ts`, et la placer dans `evade.ts` aurait fait une boucle d'import. Le jeu de règles d'un mode gagne un champ, `attraperLEvade`: au contact en Horde et en Équipes, rien ailleurs.
4. **Le x2 voyage sur le joueur, pas sur sa ligne du classement.** Un indicateur de plus dans l'octet des indicateurs d'un joueur (8): une partie sans x2 s'écrit à l'octet comme avant, alors qu'un champ de plus au classement aurait changé toutes les trames. La page lit le x2 sur le joueur pour le HUD; le classement final, qui part en entier, le porte (`LigneClassement.doubleur`).
5. **Au classement final, le badge x2 est posé par la feuille de style** (`::after`), hors du texte des cellules: le texte d'une ligne reste le pseudo, et les scénarios qui lisent le classement ne changent pas.
6. **Les annonces de l'Évadé prennent le grand titre de l'étape 4.6**, rayé, un disque « x2 » à la place de l'icône: son apparition, sa capture, le vol et la perte du x2, et sa fuite, chacun dit à la personne qu'il concerne. Les textes restent à valider à la recette.
7. **Deux sons existants**: l'apparition sonne comme le dernier battement du compte à rebours, pour tous; la capture sonne comme une capture de joueur, chez qui l'attrape. Un vol ou une perte du x2 accompagne une capture, qui a déjà son son.
8. **Le test d'intégration joue dans une arène fermée** (`ServeurSocket.evade.test.ts`): sur une vraie carte, un poursuivant ne rattrape pas l'Évadé (point 1). Dans l'arène aussi, foncer droit sur lui ne suffit pas au contact: il fait le tour le long des murs. Le poursuivant du test lui coupe la route. La Horde, le Tactique et le Massacre y sont joués; les Équipes, qui demandent deux joueurs, le sont dans le moteur.
9. **Le scénario de bout en bout ne joue pas la capture**: un scénario n'écrit jamais dans le serveur, et sans cela l'Évadé ne se rattrape pas à coup sûr. Il vérifie le récapitulatif du salon et le grand titre de l'apparition, dans une vraie partie.
10. **L'enregistrement en base n'a pas de test propre**: le x2 n'y ajoute rien, les points enregistrés sont les points du classement, déjà doublés.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-9-handoff.md`: les décisions construites, les écarts à cette fiche, les deux jeux d'empreintes, les mesures, l'état de la CI. Prochaine action exacte: l'étape suivante de la section 3 du ROADMAP, ou demander au porteur du projet la suite. Commiter, pousser, vérifier la CI et la mise en ligne.
