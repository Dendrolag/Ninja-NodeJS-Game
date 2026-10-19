# Fiche étape 7.28 - Among Ninjas, le déguisement en PNJ

Brief de session. Objectif unique: qu'un joueur d'Among Ninjas, assassin ou proie, puisse prendre pour vingt secondes l'apparence d'un PNJ, le gris réservé que personne ne porte. L'assassin l'obtient en tuant un PNJ, dont le cadavre reste comme indice. La proie l'obtient en ramassant un habit que les assassins ne voient pas, et le revêt quand elle veut. Le reste du mode ne change pas.

## Origine de cette fiche

Rédigée le 14 octobre 2026, à la demande du porteur du projet, avant l'exécution de l'étape. Sources: l'étude `docs/design/etude-deguisement-among.md` et les réponses du porteur du projet du même jour à ses six questions, reportées ci-dessous; la fiche 7.20 (le socle), prise comme modèle; l'état du dépôt au commit `c8a8cf0` (version 1.9.8).

**Aucune référence de comportement.** Ni la v0.8.6 ni la v0.9.0 n'ont ce mode: rien à caractériser. Les règles ci-dessous font foi, avec celles des fiches 7.20 à 7.27.

**Numéro**: 7.28, numéro provisoire, dans la phase 7, « Modes de jeu ». Le déguisement était prévu dans `7.25` (l'appropriation, étude du 5 octobre, section 20, décision 4); le porteur du projet le veut sans attendre la partie d'essai que `7.25` demande: il en sort, et `7.25` garde les égouts, les ninjas égarés et les traces de sang.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff, cette fiche, `.claude/rules/sim-purity.md`, l'étude `docs/design/etude-deguisement-among.md`, la fiche 7.20, et dans `packages/sim/src/among.ts` les fonctions `tuer`, `ouvrirUneTache` et le passage au tour suivant; dans `packages/server/src/vues.ts`, la vue d'un vivant et le filtrage du nuage noir. Les questions de la section « À trancher au début de l'étape » se soumettent au porteur du projet avant toute construction, avec la planche des rendus.

## Décisions du porteur du projet, 14 octobre 2026

1. **Vingt secondes, pour les deux camps.** L'assassin n'a pas le choix du moment: le déguisement part **automatiquement** quand il tue un PNJ. La proie, elle, garde l'habit ramassé et **le revêt quand elle veut**.
2. **Un assassin déguisé qui tue une proie reprend sa couleur sur-le-champ**, au moment du meurtre. Sans cela, il tuerait sans jamais pouvoir être nommé.
3. **Tuer un PNJ coûte la recharge d'un vrai meurtre.** (Réponse donnée en reprenant la question; à confirmer d'un mot au début de l'étape.)
4. **Une proie déguisée qui ouvre une tâche perd son déguisement.**
5. **Le cadavre d'un PNJ n'est qu'un indice visuel**: on ne le signale pas, et il n'ouvre aucune réunion. Le bouton d'action l'ignore.
6. **Les deux moitiés se font ensemble**, dans cette étape.

## Les règles

### Le déguisement

- Un joueur déguisé a, pour tous les autres vivants, le gris des PNJ, sans pseudo, comme un PNJ. Il garde sa vitesse et ses gestes. Ses pas sont la question 7.
- Les assassins lisent toujours le pseudo de leurs complices, déguisés ou non. Les fantômes voient chacun à sa vraie couleur.
- Il dure **20 secondes**, puis tombe. Il tombe aussi, sur-le-champ:
  - pour un assassin, quand il tue une proie (décision 2);
  - pour une proie, quand elle ouvre une tâche (décision 4);
  - pour tous, à l'ouverture d'une réunion, où l'on parle par couleurs.
- Le joueur déguisé voit le temps qui lui reste, dans son bandeau.

### L'assassin

- Tuer un PNJ se fait comme tuer une proie: au contact, à 32 pixels, par la demande de capture. La proie vivante la plus proche reste prioritaire: un PNJ n'est visé que s'il n'y a aucune proie à portée.
- Cela coûte la recharge d'un vrai meurtre (décision 3), et ne rapporte aucun point.
- Le PNJ tombe en cadavre gris, à sa place, et le déguisement part aussitôt, pour 20 secondes (décision 1). Un assassin déjà déguisé qui tue un autre PNJ repart pour 20 secondes, sans cumul.
- Le cadavre gris ne se signale pas (décision 5). Il disparaît, comme les autres, au début du tour suivant.

### La proie

- Un seul habit sur la carte à la fois, posé à une place tirée au sort, par la graine de la partie, parmi des places permises (hors des murs, loin du gong et des stations). Seules les proies vivantes le voient: le serveur le retire de la vue des assassins, comme il retire aux proies ce que cache le nuage noir.
- Une proie vivante le prend en passant dessus, si elle n'en porte pas déjà un. Un nouvel habit apparaît **45 secondes** après, ailleurs.
- Elle le revêt quand elle veut (décision 1), par un geste à elle (section suivante). Elle le perd, sans l'avoir revêtu, si elle meurt.
- Une proie déguisée reste tuable: le gain pour elle est de ne plus être suivie à sa couleur.

## À trancher au début de l'étape

Recommandations à soumettre au porteur du projet avec la planche, avant toute construction:

1. **Le geste qui revêt l'habit.** Recommandé: la touche **Espace**, et sur téléphone **un bouton « Habit »** à la place du bouton Katana, que les proies n'ont pas. Espace ne fait rien aujourd'hui pour une proie, et E reste le bouton d'action des tâches, du signalement et du gong.
2. **Prendre l'habit.** Recommandé: **en passant dessus**, comme les objets des autres modes. Au bouton d'action, il faudrait s'arrêter, et cela trahirait la proie aux yeux d'un assassin qui ne voit pas l'habit.
3. **Les PNJ tués.** Recommandé: **la foule se reforme au début de chaque tour**, quand les cadavres disparaissent: sans cela, un assassin qui se déguise souvent viderait la carte de ses PNJ, et le déguisement avec.
4. **L'habit et la réunion.** Recommandé: un habit **porté sans être revêtu se garde** d'un tour à l'autre; un déguisement en cours tombe à la réunion (règle ci-dessus).
5. **La recharge du meurtre d'un PNJ** (décision 3): confirmer qu'elle est bien celle d'un vrai meurtre.
6. **La version.** Recommandé: **1.9.9, sans note**, les petites évolutions d'Among Ninjas restant en 1.9 (décision du 14 octobre 2026). Le déguisement change la façon de jouer: si le porteur du projet veut une note, la règle lui demande d'en décider.
7. **Les pas d'un déguisé.** Un PNJ est muet (étape 7.23), et les pas d'un joueur qu'on voit s'entendent à sa place exacte: un déguisé qui marche serait reconnu à l'oreille dès qu'on le voit. Recommandé: **un déguisé marche sans bruit**, comme un PNJ, sans quoi le déguisement ne tromperait personne de près. L'autre voie, qu'il s'entende, en fait un camouflage de loin seulement.

## Retours du porteur du projet après l'étape, 16 octobre 2026

- Le déguisement d'un assassin dure sa recharge du meurtre et cinq secondes de plus, et non plus vingt secondes: il tombait avant le meurtre suivant (la décision 1 ne vaut plus que pour la proie).
- Les meubles se dessinent devant l'avant-plan; la pluie, au-dessus de tout, dans tous les modes.
- Une tâche s'ouvre de tout le tour de son meuble, à 30 pixels au plus.
- L'habit reste caché, sans indication.

Détail: handoff, « Après l'étape ».

## Réponses du porteur du projet, 16 octobre 2026

- **La planche** (`docs/design/etape-7-28/1-planche.png`): 1A, le cadavre d'un PNJ coupé en deux dans son sang, comme un joueur, en gris; 2A, l'habit est un kimono plié au trait néon, qui bat; 3A, le déguisé se voit gris, avec un fin contour à sa couleur que lui seul voit; 4C, au bureau, un bouton « Habit » à la place du Katana, touche Espace, cerné d'un anneau qui se vide pendant le déguisement; 5C, sur téléphone, ce bouton n'apparaît qu'une fois l'habit ramassé, et se vide en anneau. Au bureau comme sur téléphone, le bouton n'est donc là que si la proie porte un habit ou en est vêtue.
- **Les sept questions**: les sept recommandations sont retenues. Espace et le bouton « Habit »; l'habit se prend en passant dessus; la foule se reforme au début de chaque tour; un habit porté sans être revêtu se garde d'un tour à l'autre; tuer un PNJ coûte la recharge d'un vrai meurtre (décision 3 confirmée); version 1.9.9, sans note; un déguisé marche sans bruit.

## Hors étape, avant la construction, 16 octobre 2026

Le porteur du projet a livré en début d'étape quatorze meubles découpés du fond de Tokyo et deux sons, posés hors étape et mis en ligne d'abord, sous la version **1.9.9** (journal de conception du 16 octobre 2026). Le déguisement prend donc la **1.9.10**, sans note, au lieu de la 1.9.9 de la réponse 6. Ce qui en touche l'étape: sept stations ont changé de nom et de place, la place des stations à meuble répété se tire à chaque partie, après les réparations, et le Tapis du salon porte le sang au lieu de la fumée. Les tirages du déguisement viennent après celui des places.

## Réconciliation au début de l'étape, 16 octobre 2026

Lecture de `vues.ts`, `instantane.ts` et `among.ts` au commit `fc3d9a8`. Deux points que la fiche ne disait pas, aucun ne demande de décision:

1. **Les PNJ doivent passer sous alias dans la vue d'un vivant.** Aujourd'hui, un vivant reçoit chaque PNJ sous son identifiant du moteur (`bot-12`) et chaque joueur sous le sien. Un déguisé envoyé comme un PNJ garderait un identifiant de joueur, ou en prendrait un nouveau à son entrée dans la foule: dans les deux cas, un client qui lit ses trames le trouverait. Comme les proies dans la vue des traqueurs de la Chasse (étape 2.9), les PNJ et les déguisés d'une vue de vivant prennent donc un alias tiré du secret de la partie, rangés par alias, et le cadavre d'un PNJ ne dit pas qui il était. L'alias d'un déguisé est tiré à chaque déguisement, pour qu'on ne le reconnaisse pas d'une fois sur l'autre. Ce qui se voit à l'écran ne change pas: un témoin qui voit un assassin devenir gris le sait, c'est le jeu.
2. **Le cadavre d'une proie déguisée est à sa vraie couleur.** Le déguisement est un affichage, la couleur du joueur ne change pas dans l'état: tuée déguisée, la proie tombe à sa couleur, et l'on sait qui est mort.

## Ce qu'il faut faire

1. **La planche des rendus** (`docs/design/etape-7-28/`): le cadavre gris d'un PNJ, l'habit posé sur la carte, le bandeau d'un joueur déguisé et son temps, le bouton « Habit » sur téléphone. Deux ou trois propositions chacun, dessinées par le vrai code.
2. **Le moteur** (`packages/sim/src/among.ts`, `etatAmong.ts`): l'échéance du déguisement par joueur, le meurtre d'un PNJ, l'habit (sa place, sa réapparition, son ramassage, l'entrée qui le revêt), la chute du déguisement au meurtre, à la tâche et en réunion, et la foule reformée au tour suivant si la question 3 est retenue. Tout tirage par le générateur à graine, **après tous les tirages existants**, pour que la graine 4 du scénario de bout en bout donne toujours les mêmes rôles.
3. **Le protocole** (`packages/shared`): l'entrée qui revêt l'habit, validée au serveur; ce que la vue dit de l'habit et du déguisement.
4. **Le serveur** (`packages/server/src/vues.ts`): la couleur envoyée à chacun (le gris pour un déguisé, sauf aux fantômes, à lui-même et à ses complices s'il est assassin), le pseudo retiré, l'habit retiré de la vue des assassins.
5. **La page**: le cadavre gris, l'habit, le bandeau et son temps, le bouton « Habit », l'aide du mode, les sons provisoires (prendre l'habit, le revêtir, le perdre).
6. **Les tests**: unitaires à chaque couche, couverture de `packages/sim` qui ne baisse pas, et un passage dans `tests/e2e/among.spec.ts` (un assassin tue un PNJ et devient gris pour une autre page).
7. **Le banc**: une partie Among Ninjas à douze, avec et sans déguisement, à comparer à la section 33 de `docs/mesures/charge-serveur.md`.

## Critères de fin

- Les règles ci-dessus se jouent dans une vraie partie, au bureau et sur téléphone, captures à côté.
- Un client ne peut pas savoir qui est déguisé en lisant ses trames, sauf ce que son rôle lui permet (lui-même, ses complices, un fantôme).
- `pnpm verify` et les scénarios de bout en bout d'Among Ninjas passent; la CI est verte.
- Le handoff est écrit, le ROADMAP mis à jour.

## Prochaine action exacte

Au début de l'étape: dessiner la planche des rendus et soumettre les sept questions de la section « À trancher » au porteur du projet, avant toute construction.
