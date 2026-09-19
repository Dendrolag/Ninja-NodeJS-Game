# Fiche étape 5.7 - Allègement du rendu

Brief de session. Objectif unique: que 500 entités tiennent sur un téléphone d'entrée de gamme. Au processeur ralenti six fois, notre code coûte 4,3 à 5,7 ms par image à 500 entités, soit plus du quart d'une image, et PixiJS dépense ensuite autant pour des sprites que la caméra ne montre pas. Réduire ces deux coûts sans rien changer de ce qui se voit.

## Origine de cette fiche

Aucune fiche n'existait: l'étape a été ajoutée le 19 septembre 2026, issue de la mesure de l'étape 7.6, sur décision du porteur du projet de garder le plafond de 500 faux ninjas. Elle est rédigée le 19 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- l'entrée 5.7 de la section 4 du ROADMAP, et la fiche 5.6 prise comme modèle;
- la section 17 de `docs/mesures/charge-serveur.md` et la réconciliation de la fiche 7.6 (points 3 et 4);
- l'état du dépôt au commit `431f068`, et la mesure avant ci-dessous.

**Numéro**: 5.7, dans la phase 5, « Charge, performance et durcissement ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (5.6, ou le handoff partiel de cette étape), puis cette fiche. L'étape ne touche pas `packages/sim`.

## Mesure avant, 19 septembre 2026

Banc du rendu (`tests/e2e/banc-rendu.spec.ts`) au commit `431f068`, carte graphique RTX 2080 Ti, processeur ralenti six fois par Chromium, composition d'une vraie partie pleine, toutes les entités autour du centre de l'écran: **300 entités, 3,35 à 3,57 ms de notre code par image; 500 entités, 4,97 à 5,67 ms**, pour 50 à 54 images par seconde. Le budget d'une image est de 16,7 ms; le quart, 4,2 ms.

Un profil du processeur pendant la mesure à 500 entités dit où va le temps, par image:

| Poste                                               | Temps  | Constat                                                                                                                                                                                                       |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transmission des personnages (`majPersonnages`)     | 3,2 ms | Deux noms de texture recomposés, deux recherches de texture, la teinte (convertie par PixiJS), la taille et un ensemble d'identifiants refaits pour chaque entité, à chaque image, qu'ils aient changé ou non |
| Lissage et scène                                    | 1,1 ms | Proportionnels au nombre d'entités                                                                                                                                                                            |
| Travail de PixiJS avant le dessin (hors notre code) | 11 ms  | Transformations et collecte de **tous** les sprites, y compris ceux que la caméra ne montre pas                                                                                                               |

Sur téléphone, la caméra ne montre que 360 par 271 pixels de carte (`CADRAGE_MOBILE`): 3 pour cent de Tokyo, 1,6 pour cent de Spirit & Time. Presque toutes les entités y sont hors champ, et toutes sont pourtant mises à jour et parcourues par PixiJS à chaque image. Le banc ne mesure pas ce cas: sa série « téléphone » place toutes les entités devant une caméra de bureau.

**Défaut du banc** (règle 7): chaque série remonte le rendu, si bien que la seconde d'échauffement de la série téléphone ne réchauffe que le code, pas les textures, que la mesure envoie de nouveau à la carte graphique.

## Décisions prises par cette fiche

1. **Ne transmettre à PixiJS que ce qui a changé.** Chaque personnage affiché garde la texture, la taille et la teinte qu'on lui a données; elles ne sont reposées que si la scène en demande d'autres. Les noms des deux calques ne se recomposent qu'au changement de texture. L'ensemble des identifiants vus est remplacé par un numéro d'image posé sur chaque personnage.
2. **Ne mettre à jour que ce que la caméra montre.** Un personnage hors du champ de la caméra, marge comprise, est caché et n'est pas mis à jour; il ne naît qu'en entrant dans le champ. Caché, il ne coûte plus rien à PixiJS non plus. La marge couvre un sprite entier, ce qui dépasse d'un cadavre couché et la plus forte secousse du katana: rien n'apparaît d'un coup au bord de l'écran. Le champ se calcule par `zoneVisible` (camera.ts), déjà prévue pour cet usage. Seuls les personnages sont triés: les objets, zones, disques et repères sont quelques dizaines au plus.
3. **La scène reste complète et ignore la caméra.** Le tri se fait dans l'adaptateur PixiJS, qui connaît la caméra et l'écran; la scène continue de dire tout ce qui existe, et ses tests ne changent pas.
4. **L'ordre de dessin des personnages devient celui de la scène.** Jusqu'ici, un sprite créé en cours de partie passait devant tous les autres: un cadavre du Massacre, que la scène déclare dessous, se dessinait par-dessus les vivants. Avec le tri par la caméra, tout personnage qui entre dans le champ serait créé, donc dessiné devant. Le rang dans la scène fixe désormais l'ordre de dessin.
5. **Le banc gagne une série « cadrage téléphone »**: composition d'une vraie partie pleine, entités réparties sur toute la carte, caméra au cadrage mobile. La série téléphone existante reste le pire cas (tout à l'écran) et reste comparable à la mesure 7.6. Le banc vérifie en plus que le nombre de personnages affichés est celui des entités dans le champ, et relève le temps de PixiJS avant le dessin.
6. **Seuil**: au processeur ralenti six fois, notre code reste sous le quart d'une image (4,2 ms) à 500 entités toutes à l'écran. Il s'exige sur carte graphique; en intégration continue, il se mesure et s'affiche sans s'exiger (décision du porteur du projet du 19 septembre 2026, section 17.4 de `docs/mesures/charge-serveur.md`).

## Périmètre

1. `packages/client/src/rendu/pixi.ts`: transmission des seuls changements, tri par la caméra, ordre de dessin.
2. `packages/client/src/rendu/camera.ts`: un point est-il dans une zone visible, fonction pure et testée.
3. `packages/client/src/rendu/apparence.ts`: la marge hors champ, avec sa justification.
4. Le lissage et la scène, si la mesure après les deux premières décisions montre qu'ils pèsent encore.
5. `tests/e2e/banc-rendu.spec.ts`: la série au cadrage téléphone, l'échauffement qui réchauffe vraiment, le temps de PixiJS, le compte des personnages affichés, le nouveau seuil.
6. Documentation: `docs/mesures/charge-serveur.md` (section 18), le journal de conception, le ROADMAP.

## Hors périmètre

- Le moteur et le serveur: ils tiennent 500 faux ninjas à 2,3 ms par battement (section 17.3).
- Réduire ce que le serveur envoie selon la caméra du joueur: c'est une autre étape, qui change le protocole.
- Changer ce qui se voit: tailles, couleurs, lueur, densité de l'écran.
- Toute modification de `legacy/`, de `tests/caracterisation/` ou de `packages/sim`.

## Tests requis

- Un point dans une zone visible: dedans, dehors de chaque côté, sur le bord.
- La marge hors champ couvre un sprite, un cadavre couché et la plus forte secousse.
- Le banc: toutes les entités de la scène, et seulement celles du champ, sont affichées; le seuil de 4,2 ms à 500 entités toutes à l'écran, sur carte graphique.
- Les scénarios de bout en bout existants, qui jouent de vraies parties, restent verts: ce qu'ils voient ne change pas.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Mesure après au banc, trois exécutions, consignée dans la section 18 de `docs/mesures/charge-serveur.md` à côté de la mesure avant.
2. Vérifié dans le navigateur de Claude Code: une partie sur Spirit & Time à 500 faux ninjas, en bureau et en cadrage téléphone; les personnages entrent dans le champ sans apparaître d'un coup, aucune erreur dans la console.
3. Suite Vitest complète, types, linter, formatage et bout en bout verts; CI verte.

## Points de vigilance

1. **PixiJS ne met à jour la teinte, la position ou l'opacité que si la valeur change**, mais la teinte passe d'abord par une conversion de couleur: c'est pourquoi elle se compare avant d'être posée.
2. **Un personnage caché garde son état**: à son retour dans le champ, ce qui a changé pendant son absence est posé, et seulement cela.
3. **Le champ se calcule sur l'écran de PixiJS**, celui qui place la caméra, et non sur la taille de la fenêtre: les deux doivent rester les mêmes.

## Rituel de fin de session

Écrire docs/handoffs/etape-5-7-handoff.md. Prochaine action exacte: l'étape suivante de la section 3 du ROADMAP, les fonctionnalités reportées, dans l'ordre que fixe le porteur du projet. Commiter.
