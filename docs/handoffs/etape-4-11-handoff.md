# Handoff - Étape 4.11 Des sons situés sur la carte

Date: 5 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Qu'un son qui a lieu à un endroit de la carte baisse avec la distance à notre personnage et se place à gauche ou à droite selon cet endroit. Les sons qui ne concernent que nous ne changent pas.

## Ce qui a été fait

- **La fiche**, rédigée selon le cas de repli du PROTOCOLE et commitée avant l'exécution (`46919b8`). Elle fixe ce que le ROADMAP laissait ouvert.
- **Cinq sons situés**: l'armement et l'explosion d'une mine posée, l'armement d'une mine de zone et l'ouverture de sa zone, le nuage de fumée d'un autre joueur. Notre propre fumée, la pose d'une mine (entendue de nous seuls), l'apparition de l'Évadé (une annonce) et tous les autres sons ne changent pas.
- **La loi d'atténuation** (`sons/espace.ts`, fonctions pures): plein volume jusqu'à 200 pixels de carte, silence au-delà de 1 400, et entre les deux le carré de la part de chemin restant, soit le quart à 800 pixels, le bord d'un écran d'ordinateur. Qui est touché par une mine (rayon 130) l'entend toujours à plein.
- **Le placement gauche-droite**: selon l'écart horizontal seul, entièrement d'un côté à 800 pixels, borné à 80 pour cent pour qu'un son ne quitte jamais une oreille. Les positions reçues sont déjà celles de la carte affichée, miroir compris.
- **D'où l'on écoute**: de notre personnage s'il est dans la partie, sinon du centre de l'écran (la caméra de l'image précédente). Sans l'un ni l'autre, le son joue comme avant.
- **Une fumée** s'entend une fois, de son bout le plus proche.
- **Le lecteur** applique la place reçue: un gain et un panoramique stéréo propres à la lecture, avant le gain des effets. Un son de volume nul ne joue pas et ne coupe donc pas le même son joué plus près (une voix par effet, étape 5.12). Sans panoramique stéréo, le gain seul; sans Web Audio, le volume de l'élément.
- **Version 1.7.2**: un changement audible, sans note.

## Fichiers créés ou modifiés

- `docs/plan/etape-4-11.md` (créé, commit `46919b8`): la fiche.
- `packages/client/src/sons/espace.ts` (créé): `OREILLE`, `placeDuSon`, `lieuDuSon`, `placeDuFait`.
- `packages/client/src/sons/espace.test.ts` (créé): leurs tests.
- `packages/client/src/sons/lecteur.ts`: `jouer(nom, place?)`, la fonction `placer` (gain et panoramique), l'atténuation par élément sans Web Audio.
- `packages/client/src/sons/sons.test.ts`: le contexte d'essai gagne le panoramique stéréo et retient les branchements; tests des sons placés, avec et sans Web Audio.
- `packages/client/src/rendu/boucle.ts`: `faireEntendre` calcule le point d'écoute et passe la place de chaque son.
- `packages/client/src/rendu/boucle.test.ts`: la doublure du lecteur retient les places; tests du point d'écoute.
- `packages/shared/src/version.ts`: 1.7.2.
- `docs/plan/ROADMAP.md`: l'entrée 4.11 et sa clôture en section 5.

## Tests

- Ajoutés: la loi (plein volume de près, silence à la portée, le quart à 800 pixels, décroissance sans remontée, côtés, borne, aplomb), le lieu de chaque fait (mines, mines de zone, fumée par son bout le plus proche, notre fumée et les sons non situés sans lieu), le lecteur (gain et panoramique propres à la lecture branchés sur le gain des effets, une place par lecture, silence hors de portée sans couper la lecture plus proche, sans panoramique, sans place, sans Web Audio), la boucle (écoute depuis notre personnage, depuis le centre de l'écran sans nous, sons non situés sans place).
- Résultat: 3 731 tests Vitest au vert (suite complète); types (les trois configurations) et linter au vert. Bout en bout en local: `diagnostic`, `mine`, `mine-de-zone` et `poche`, 9 sur 9.
- Couverture de packages/sim: inchangée, rien n'y a été touché.
- État de la CI: verte sur `70a9a9e` (types, linter et tests, bout en bout, essai sur Oracle, mise en ligne).

## Décisions et écarts au plan

- Les décisions de la fiche (portée, loi, point d'écoute, fumée) sont des choix de cette session, que le ROADMAP lui déléguait. Elles se règlent en un endroit, `OREILLE` dans `sons/espace.ts`, si le porteur du projet les trouve trop fortes ou trop faibles à l'oreille.
- L'explosion d'une de nos mines, loin de nous, se spatialise comme les autres: elle a lieu sur la carte et s'entend de tous. Ses points s'affichent déjà.
- Pas de vérification à l'oreille par la session: le rendu sonore ne se voit pas dans une capture. Le câblage est couvert par les tests, et les quatre scénarios de bout en bout qui déclenchent ces sons passent dans Chromium, qui a Web Audio et le panoramique stéréo.

## Problèmes connus et dette

- Une autre session exécute l'étape 5.13 (production sur Oracle) en parallèle; sa fiche a été commitée pendant cette session (`71622a9`). Aucun fichier en commun hors du ROADMAP.
- Les fichiers du client modifiés par leurs seules fins de ligne (handoff 5.12) sont toujours là, non commités.

## Prochaine action exacte

Exécuter l'étape `5.13`, la production sur Oracle, si la session qui l'a commencée ne l'a pas close: lire son handoff s'il existe, sinon `docs/plan/etape-5-13.md`.

## Étape suivante

Fiche à lire: `docs/plan/etape-5-13.md`.
