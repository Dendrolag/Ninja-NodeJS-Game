# Étude - Se déguiser en PNJ dans Among Ninjas

Date: 14 octobre 2026
Statut: étude seulement, rien n'est décidé. Les questions au porteur du projet sont en section 6.

## 1. La demande

Permettre à un joueur, assassin ou proie, de prendre l'apparence d'un PNJ, le gris réservé que personne ne porte, pendant un temps limité.

- Un assassin l'obtient en tuant un PNJ. Le cadavre du PNJ reste sur la carte, et sert d'indice aux proies.
- Une proie l'obtient en trouvant un habit gris posé à un endroit tiré au sort, que les assassins ne voient pas, et l'équipe pour un temps limité.

## 2. En bref

- **C'est faisable sans rien casser.** Le moteur sait déjà qu'un joueur a une couleur et qu'un PNJ en a une autre. Le déguisement est une couleur affichée qui remplace la vraie pour un temps. Le serveur décide déjà ce que chacun voit (`packages/server/src/vues.ts`): c'est là que le gris se substitue, et que l'habit se cache aux assassins, comme le nuage noir se cache déjà aux proies.
- **Le déguisement touche le cœur du mode.** Toute accusation passe par une couleur (décision du 9 octobre 2026). Un joueur gris n'a plus de couleur: un témoin ne peut plus le nommer. C'est très fort, d'où les garde-fous de la section 4.
- **Taille: une étape entière.** Moteur, serveur, rendu et tests. La partie assassin et la partie proie se séparent bien et peuvent faire deux étapes.

## 3. Ce qui existe déjà

- Les PNJ portent un gris réservé, et rien ne se transmet au contact (étape 7.20).
- Un assassin tue par la demande de capture, au contact, à 32 pixels, la proie vivante la plus proche (`tuer`, `packages/sim/src/among.ts`). Il ignore aujourd'hui les PNJ, et sa recharge est commune à tous ses meurtres.
- Un meurtre laisse un cadavre, à la couleur de la victime, qu'un vivant signale pour ouvrir une réunion.
- Le mode n'a ni bonus ni malus. L'habit serait le premier objet ramassable d'Among Ninjas.
- Les assassins lisent déjà le pseudo de leurs complices au-dessus d'eux: un complice déguisé resterait reconnaissable pour eux.

## 4. Proposition

**Le déguisement de l'assassin.**

- Tuer un PNJ se fait comme tuer une proie: au contact, avec la même recharge. Le PNJ reste au sol en cadavre gris.
- L'assassin devient gris pendant 20 secondes.
- **Tuer une proie pendant le déguisement le fait tomber**: l'assassin reprend sa couleur sur place. Sans cela, il tuerait sans jamais pouvoir être nommé.
- Une réunion le fait tomber aussi: on y parle par couleurs.
- Le cadavre gris se signale comme un autre. La réunion qu'il ouvre dit « le corps d'un PNJ »: tout le monde sait alors qu'un assassin s'est déguisé, sans savoir qui.

**L'habit de la proie.**

- Un habit à la fois sur la carte, posé à une place tirée au sort parmi des places permises (pas dans un mur, loin du gong). Seules les proies vivantes le voient.
- Le ramasser se fait au bouton d'action, comme une tâche. La proie devient grise pendant 20 secondes.
- Un nouvel habit apparaît 45 secondes après qu'il a été pris, ailleurs.
- Une proie déguisée reste tuable: un assassin qui la touche la tue, comme aujourd'hui. Le gain pour elle est de ne plus être suivie à sa couleur.
- Faire une tâche pendant le déguisement le fait tomber? À trancher (question 4): un PNJ qui fait une tâche se trahit de toute façon.

**Ce que chacun voit d'un déguisé.** Le gris des PNJ, leur démarche, pas de pseudo. Les assassins lisent toujours le pseudo de leurs complices. Un fantôme voit tout le monde à sa vraie couleur, pour suivre la partie.

## 5. Ce qu'il faudrait faire

1. Moteur: une échéance de déguisement par joueur dans l'état d'Among Ninjas, le meurtre d'un PNJ, l'habit (sa place, sa réapparition, le geste qui le prend), et la chute du déguisement au meurtre et en réunion. Tirage de la place par le générateur à graine.
2. Serveur: la couleur envoyée à chacun (le gris pour un déguisé, sauf aux fantômes et aux complices), l'habit caché aux assassins.
3. Page: le cadavre gris, l'habit posé sur la carte, la réunion « le corps d'un PNJ », une jauge du temps de déguisement pour qui le porte.
4. Tests à chaque couche, et un passage de bout en bout dans `tests/e2e/among.spec.ts`.

## 6. Questions au porteur du projet

1. Durée du déguisement: 20 secondes, la même pour les deux camps?
2. Un assassin déguisé qui tue reprend-il sa couleur sur-le-champ (recommandé), ou garde-t-il le gris jusqu'au bout?
3. Tuer un PNJ coûte-t-il la recharge d'un vrai meurtre (recommandé), ou une recharge à part?
4. Une proie déguisée qui ouvre une tâche perd-elle son déguisement?
5. Le cadavre d'un PNJ ouvre-t-il une réunion comme les autres (recommandé), ou n'est-il qu'un indice visuel qu'on ne signale pas?
6. Faut-il faire les deux moitiés ensemble, ou d'abord l'assassin, puis l'habit des proies?
