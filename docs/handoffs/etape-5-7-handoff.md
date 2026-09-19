# Handoff - Étape 5.7 Allègement du rendu

Date: 19 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Que 500 entités tiennent sur un téléphone d'entrée de gamme, en réduisant le coût du rendu dans la page sans rien changer de ce qui se voit.

## Ce qui a été fait

- **Fiche rédigée** selon le cas de repli du PROTOCOLE, avec une mesure avant au banc et un profil du processeur à 500 entités (`docs/plan/etape-5-7.md`, commit `6d058df`).
- **Le rendu ne transmet plus que ce qui change.** Chaque personnage retient sa texture, sa taille et sa teinte, et ne les reçoit de nouveau que si la scène en demande d'autres. Les deux calques d'une image de ninja se cherchent une fois pour tout le rendu, la taille se pose par l'échelle, et l'ensemble des identifiants vus est remplacé par un numéro d'image.
- **Le rendu ne met à jour que ce que la caméra montre.** Un personnage hors du champ, à deux sprites de marge (`MARGE_HORS_CHAMP_PX`), est caché sans être mis à jour, et PixiJS ne le parcourt plus. Les halos (disques) hors du champ ne sont pas tracés. La scène reste complète et ignore la caméra.
- **La scène tire l'adresse des images de ninja d'une table figée**, au lieu de la recomposer pour chaque entité à chaque image.
- **Défaut corrigé** (règle 7): un personnage créé en cours de partie passait devant tous les autres, par exemple un cadavre du Massacre, que la scène met dessous. L'ordre de dessin suit désormais le rang dans la scène.
- **Banc du rendu enrichi**: série au cadrage d'un téléphone (fenêtre 915 par 412, caméra serrée, entités réparties sur toute la carte, 300 sur Tokyo et 500 sur Spirit & Time), temps de PixiJS relevé, compte des personnages affichés comparé aux entités dans le champ, plafond de 4,2 ms à 500 entités au processeur ralenti. **Défaut du banc corrigé**: l'échauffement de la série téléphone remontait le rendu avant la mesure, et ne réchauffait donc que le code.
- **Vérifié dans le navigateur de Claude Code** (serveur local): une Horde sur Spirit & Time à 500 PNJ, en bureau puis en émulation de téléphone; les personnages à cheval sur les bords sont dessinés, ceux qui entrent dans le champ aussi pendant que la caméra avance, aucune erreur de console.

### Mesure avant et après, banc du rendu, processeur ralenti six fois

Trois exécutions, carte graphique RTX 2080 Ti. Avant: commit `431f068`, mesuré avec le banc de cette étape.

| Situation, 500 entités | Notre code avant | Notre code après | PixiJS avant | PixiJS après |
| ---------------------- | ---------------: | ---------------: | -----------: | -----------: |
| Tout à l'écran         |        5,7 à 6,1 |              2,7 |   9,5 à 10,4 |   9,7 à 10,4 |
| Cadrage d'un téléphone |        5,8 à 6,2 |        1,6 à 1,9 |  10,0 à 10,6 |    3,2 à 3,6 |

En millisecondes par image. Au cadrage d'un téléphone, une image passe d'environ 16 ms de processeur à 5, et la cadence tient 60 images par seconde (53 à 57 avant). Détail et chiffres à 300 entités: section 18 de `docs/mesures/charge-serveur.md`.

## Fichiers créés ou modifiés

Commit `6d058df`: `docs/plan/etape-5-7.md` (créé).

Commit de l'étape (`17eb312`):

- Rendu: `packages/client/src/rendu/pixi.ts` (transmission des seuls changements, tri des personnages et des disques par la caméra, ordre de dessin, calques rangés par image, nom du calque des personnages pour le banc), `rendu/camera.ts` (`dansLaZone`, avec un rayon pour les disques), `rendu/apparence.ts` (`MARGE_HORS_CHAMP_PX` et sa justification), `rendu/scene.ts` (table figée des adresses d'images de ninja).
- Tests: `packages/client/src/rendu/camera.test.ts` (un point et un disque dans une zone, la marge couvre un sprite couché et la plus forte secousse), `tests/e2e/banc-rendu.spec.ts` (série au cadrage d'un téléphone, temps de PixiJS, compte des personnages affichés, échauffement, nouveau plafond).
- Documentation: `docs/mesures/charge-serveur.md` (section 18), `docs/design/README.md` (trois entrées), `docs/plan/ROADMAP.md` (5.7 faite), `docs/plan/etape-5-7.md` (réconciliation).

Commit de ce handoff: `docs/handoffs/etape-5-7-handoff.md` (créé).

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/sim`.

## Tests

- Ajoutés: `dansLaZone` dedans, dehors de chaque côté, sur les bords, avec et sans rayon; la marge hors champ couvre la demi-diagonale d'un sprite et la plus forte secousse du katana; un personnage dont le sprite mord sur le bord de l'écran est dans le champ. Au banc: le rendu affiche exactement les personnages que la caméra montre, à chaque mesure; au cadrage d'un téléphone, moins d'un quart des entités sont affichées; notre code sous 4,2 ms à 500 entités au processeur ralenti, sur carte graphique.
- Résultat: **2 421 tests Vitest** au vert (2 414 au handoff 5.6); types des paquets, des tests et du bout en bout compilés en appelant tsc directement; linter et formatage verts. Bout en bout en local: **44 scénarios sur 44** (43 au handoff 5.6, plus la série du banc au cadrage d'un téléphone).
- Couverture de `packages/sim`: inchangée, le paquet n'est pas touché.
- État de la CI: **`17eb312` verte** (exécution 35457882581), « Types, linter et tests », « Bout en bout » et « Mise en ligne »: l'allègement est en production. En intégration continue, sans carte graphique, le banc mesure au cadrage d'un téléphone 2,1 ms de notre code par image à 300 et 500 entités, et 4,8 à 6,4 ms tout à l'écran, où le plafond ne s'exige pas.

## Décisions et écarts au plan

Trois entrées au journal de `docs/design/README.md`: la transmission des seuls changements et le tri par la caméra, l'ordre de dessin, la table des adresses d'images.

Écarts à la fiche, notés dans sa section de réconciliation:

1. Les halos sont triés aussi: une fois les personnages triés, leur géométrie refaite à chaque image était le plus gros travail restant de PixiJS au cadrage d'un téléphone.
2. La scène est allégée (point 4 du périmètre, prévu sous condition): la mesure l'a demandé.
3. Le ROADMAP demandait des tests unitaires « de ce qui se dessine ou non »: la décision est une fonction pure testée (`dansLaZone` et la marge), et son application par l'adaptateur PixiJS, qui ne se teste pas sans carte graphique, est vérifiée par le banc à chaque mesure.

## Problèmes connus et dette

- **Un vrai téléphone n'a pas été mesuré**: le ralentissement de Chromium ne reproduit ni sa carte graphique ni son échauffement. À confirmer en jouant une partie à 500 PNJ sur Spirit & Time.
- **Tout à l'écran, PixiJS garde ses 10 ms par image à 500 entités** au processeur ralenti: mille sprites visibles restent à dessiner. Aucun écran de téléphone ne montre autant d'entités.
- **Deux scénarios mobiles ont échoué une fois** en début de session, au premier passage complet du bout en bout (`parcours-solo` et `tactique`: le joueur piloté restait immobile en route vers un faux ninja), puis ont passé seuls deux fois de suite et au passage complet de fin d'étape. Rien dans le code de l'étape ne les touchait alors. À surveiller: s'ils échouent de nouveau, lire le contexte d'erreur de `test-results/`.

Repris du handoff 5.6, inchangé: déclarer `ninja.dendrolag.fr` à la Google Search Console et à Bing Webmaster Tools, puis suivre l'indexation; relire le titre de la page, l'accroche de la présentation statique et le texte de l'image d'aperçu; la densité de 300 et 500 PNJ à jouer; l'or du x4 proche de celui des Black Ninjas; l'équilibre de la prime de la Horde; le compteur de combo qui tombe au battement près; les textes de l'aide et du rappel du salon à relire.

## Prochaine action exacte

La section 3 du ROADMAP est épuisée jusqu'aux fonctionnalités reportées (Battle Royale, Chaos, pass de saison, skins, clans), dont l'ordre revient au porteur du projet. Dans une conversation neuve, sur `master`: demander au porteur du projet la fonctionnalité à ouvrir, puis rédiger sa fiche selon le cas de repli du PROTOCOLE (numéro 7.7 si c'est un mode de jeu).

## Étape suivante

Fiche à lire: aucune encore; celle de la fonctionnalité reportée que choisira le porteur du projet.
