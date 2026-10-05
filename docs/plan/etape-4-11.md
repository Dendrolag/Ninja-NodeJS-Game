# Fiche étape 4.11 - Des sons situés sur la carte

Brief de session. Objectif unique: **qu'un son qui a lieu à un endroit de la carte baisse avec la distance à notre personnage et se place à gauche ou à droite selon cet endroit.** Les sons qui ne concernent que nous ne changent pas.

## Origine de cette fiche

Étape ajoutée le 5 octobre 2026 à la demande du porteur du projet, à la clôture de l'étape 5.12 (ROADMAP, phase 4 et section 5). Rédigée le même jour selon le cas de repli du PROTOCOLE, à partir de l'entrée 4.11 du ROADMAP, de l'état du dépôt au commit `2d37496` et de la fiche 5.12 prise comme modèle.

## Ce qu'on sait en entrant

- Le lecteur (`packages/client/src/sons/lecteur.ts`) joue les effets par des tampons décodés sur Web Audio depuis l'étape 5.12: chaque lecture est une source neuve branchée sur le gain des effets. Sans Web Audio, par des éléments audio.
- Les déclencheurs (`packages/client/src/sons/declencheurs.ts`) traduisent un fait en nom de son, sans position. La boucle de rendu (`rendu/boucle.ts`, `faireEntendre`) les joue.
- Les sons situés et entendus de tous sont ceux de cinq faits, qui portent tous leur position: l'armement d'une mine posée (`mineArmee`) et son explosion (`mineExplosee`), l'armement d'une mine de zone et l'ouverture de sa zone (`mineDeZone`), le nuage de fumée (`fumee`, qui a deux bouts: `depart` et `arrivee`).
- Les positions reçues sont déjà celles de la carte affichée, miroir compris (étape 8.3): la gauche du son est la gauche de l'écran.
- La vue couvre 900 pixels de carte en hauteur sur ordinateur, soit environ 1 600 en largeur; 500 en Tactique. Les cartes font de 2 000 à 2 400 pixels de large. Le rayon d'une explosion de mine est de 130 pixels.

## Décisions prises par cette fiche

1. **Quels sons.** Les cinq ci-dessus, et eux seuls. La pose d'une mine ne s'entend que chez nous et ne change pas. L'apparition de l'Évadé est une annonce à toute la partie, pas un bruit de la carte: elle ne change pas. Nos tirs, nos captures, l'interface, la musique, les pas et les boucles de bonus ne changent pas.
2. **Notre propre fumée** ne se spatialise pas: elle ne concerne que nous, et nous sommes aux deux bouts.
3. **La loi d'atténuation.** Plein volume jusqu'à 200 pixels (un rayon et demi d'explosion: qui est touché par une mine l'entend toujours à plein), silence au-delà de 1 400 pixels (un peu moins que la largeur d'un écran d'ordinateur: une mine à l'autre bout de la carte ne s'entend pas). Entre les deux, le volume suit le carré de la part de chemin restant, ce qui s'entend comme une baisse régulière: à 800 pixels, le bord de l'écran, il est au quart.
4. **Le placement gauche-droite** suit l'écart horizontal seul: au centre quand le son est à notre aplomb, à fond d'un côté à 800 pixels ou plus, sans jamais dépasser 80 pour cent d'un côté, pour qu'un son ne disparaisse jamais d'une oreille.
5. **D'où l'on écoute.** De notre personnage s'il est dans la partie. Sinon (mort, éliminé, pas encore apparu), du centre de ce que montre l'écran, la caméra: on entend ce qu'on regarde. Sans l'un ni l'autre, le son joue comme avant, à plein et au centre.
6. **Les deux bouts d'une fumée.** Le son se joue une fois, depuis le bout le plus proche de nous: c'est celui qu'on entendrait le plus fort.
7. **Un son hors de portée ne se joue pas**, et ne coupe donc pas le même son joué plus près (une voix par effet, règle de l'étape 5.12).
8. **Sans Web Audio**, le volume baisse de la même façon, sans placement gauche-droite. Un navigateur qui a Web Audio sans le panoramique stéréo garde l'atténuation seule.
9. **Le calcul est pur**: la place d'un son (volume et placement) se calcule dans une fonction testable, sans haut-parleur; le lecteur ne fait que l'appliquer.

## Périmètre

- `packages/client/src/sons/`: un module pur pour la place d'un son, le lieu de chaque fait dans les déclencheurs, l'application dans le lecteur, leurs tests.
- `packages/client/src/rendu/boucle.ts`: le point d'écoute, transmis au lecteur.
- La documentation: le ROADMAP.

## Hors périmètre

- Les fichiers de son, leurs volumes relatifs, quel fait déclenche quel son.
- Toute règle de jeu, `packages/sim`, le serveur.
- La spatialisation des pas des autres joueurs, ou de tout son qui n'est pas joué aujourd'hui.

## Tests requis

- La place d'un son: plein volume de près, silence au-delà de la portée, le quart au bord de l'écran, placement au centre, d'un côté, borné.
- Le lieu de chaque fait: les cinq sons situés, la fumée par son bout le plus proche, notre propre fumée et les sons non situés sans lieu.
- Le lecteur avec Web Audio: un son placé passe par un gain et un panoramique propres à sa lecture, puis par le gain des effets; un son hors de portée ne joue pas et ne coupe pas sa lecture précédente; un son sans place joue comme avant; sans panoramique stéréo, l'atténuation seule. Sans Web Audio: le volume de l'élément.
- La boucle: le point d'écoute est notre personnage, sinon la caméra.
- Bout en bout vert.

## Définition de terminé

1. Les cinq sons situés baissent avec la distance et se placent à gauche ou à droite.
2. Les autres sons sont inchangés.
3. Types, linter, tests unitaires et bout en bout au vert, CI verte et mise en ligne faite.

## Rituel de fin de session

Écrire `docs/handoffs/etape-4-11-handoff.md`, commiter, pousser, vérifier la CI et la mise en ligne. La prochaine étape suit l'ordre de la section 3 du ROADMAP.
