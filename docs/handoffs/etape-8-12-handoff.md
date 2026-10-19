# Handoff - Étape 8.12 Le Labyrinthe, de jour ou de nuit

Date: 19 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Une sixième carte jouable, le Labyrinthe, livrée par le porteur du projet sur un plan de 2-Minute Tabletop (CC BY-NC 4.0), avec un fond et un avant-plan de jour et de nuit, au choix de l'hôte, comme Prison Island.

## Ce qui a été fait

- **Sans fiche**, à la demande directe du porteur du projet, sur le modèle exact de l'étape 8.11.
- **Faite en parallèle des retours sur l'étape 7.28**, dans le worktree `.claude/worktrees/labyrinthe`, branche `carte-labyrinthe`, tirée de `master`, pour ne pas toucher aux fichiers d'Among Ninjas en cours. Les retours ont été commités et poussés pendant la session (`d7452c9`, 1.9.12): la branche a été rebasée dessus, seul conflit le numéro de version.
- **Ce qui a été livré**: deux fonds en WebP (1500 sur 1091 de jour, 2000 sur 1455 de nuit), deux avant-plans détourés (1500 sur 1091), une collision tracée à la main (632 sur 460), et les originaux de 2-Minute Tabletop (72 et 150 DPI) dans `Téléchargements/Hedge Maze`. Les cinq images livrées sont alignées entre elles et sur les originaux, au pixel près (mesuré).
- **La carte `labyrinthe`, 2400 sur 1746**, une fois et demie le décor de 1600 sur 1164. Le décor est tiré des originaux à 150 DPI, plus nets que les WebP; l'avant-plan est le détourage livré, agrandi et posé sur ces fonds, ses trous de détourage (fleurs blanches) rebouchés. Des fonds à 2000 de large pesaient 6 Mo chacun, et une palette de 256 couleurs ternissait les fleurs: 1600 tient le poids de Prison Island (3,9 Mo le fond de jour, 2,1 Mo l'avant-plan).
- **La collision livrée est gardée dans son esprit**: ses murs sont plus minces que les haies, et les arches de haie restent des passages. L'avant-plan couvre le ninja qui frôle une haie ou passe sous une arche (vu en partie). Retouches, détail dans `assets/README.md`: un mur posé sur le pavé fermait la cour sous le carré central (une poche de 4 635 places); les grilles des deux entrées, des traits de moins de neuf pixels, laissaient des poches à leur pied; une haie trouée entre deux murs, au sud-est, se traversait en diagonale; une trentaine de places isolées d'un point fermées en noircissant un pixel collé au mur. Zéro poche au pixel près, dans les deux sens.
- **Les douze critères**: un seul morceau dans les deux sens; 81,4 pour cent de sol, 61,4 tenable; 75,4 pour cent du tenable hors bande d'apparition; dégagement médian de 38 pixels (allées de 76); traversée en 24,5 secondes; **détour 1,33** (1,35 en miroir), à égalité avec Prison Island; superposition vérifiée par une image des murs posés sur le décor et l'avant-plan; proportions exactes (test); haies lisibles; avant-plan qui cache sans gêner; vignette tirée du centre du fond de jour.
- **La nuit change le fond et l'avant-plan**: `CARTES_DE_NUIT` et `AVANT_PLANS_DE_NUIT` (`packages/shared/src/ressources.ts`). Le rendu n'a pas changé: il savait déjà charger l'avant-plan de nuit depuis l'étape 8.11.
- **Plafond de 340 faux ninjas**: 2,57 millions de pixels carrés tenables, autant que le Quartier. Au banc, 1,5 à 1,7 ms par battement, un peu moins que le Quartier au même plafond (section 36 de `docs/mesures/charge-serveur.md`).
- **Migration `0016_carte_labyrinthe`**: la valeur `labyrinthe` entre dans l'énumération des cartes.
- **Crédits**: « Avec l'aimable participation de 2-Minute Tabletop pour les cartes Station lunaire, Prison Island et Labyrinthe, sous licence CC BY-NC 4.0. »
- **Version 1.10.0** et sa note, « Perdus dans les haies »: Le Labyrinthe, Jour ou nuit, Des arches. Texte à soumettre au porteur du projet (PROTOCOLE, fin d'étape).
- **Vu dans un vrai navigateur**, par le harnais Playwright, serveur local sans base: une partie lancée sur la carte avec 340 faux ninjas, de jour et de nuit, sur ordinateur et sur téléphone, sans erreur. Captures: `docs/design/etape-8-12/`.

## Fichiers créés ou modifiés

- `assets/cartes/labyrinthe/` (créé): `background.png`, `background-night.png`, `foreground.png`, `foreground-night.png` (1600 sur 1164), `collision.png` (2400 sur 1746, retouchée), `preview.png`.
- `packages/shared/src/constantes.ts`: la carte, son enregistrement, son plafond. `ressources.ts`: le fond et l'avant-plan de nuit pour la carte. `reglages.ts`: commentaire du réglage `nuit`. `version.ts`: 1.10.0. Tests: `constantes.test.ts`, `ressources.test.ts` (chemins, tailles, proportions).
- `packages/server/migrations/0016_carte_labyrinthe.sql`, `meta/0016_snapshot.json`, `meta/_journal.json` (par `pnpm base:generer`). Tests: `terrain.test.ts` (empreintes, miroir pixel à pixel, connexité, poches), `ServeurSocket.options.test.ts` (340 faux ninjas tenables).
- `packages/client/src/interface/modeles/cartes.ts`: la présentation, « Labyrinthe », « Jardin · Jour ou nuit ». `credits.ts`: la ligne de 2-Minute Tabletop. `notesDeVersion.ts`: la note 1.10. `reglages.ts`: commentaire. Tests: `reglages.test.ts`, `salon.test.ts`, `credits.test.ts` (modèle et composant), `notesDeVersion.test.ts`, `application.test.ts` (« 6 modes · 6 cartes »).
- `tests/e2e/rendu-labyrinthe.spec.ts` (créé): la nuit assombrit le fond, et les haies de l'avant-plan sont vertes de jour, bleutées de nuit.
- Mesures: `docs/mesures/mesurer-les-cartes.mjs` (la carte dans sa table, commentaire périmé « six terrains » corrigé), `cartes.json`, `charge-serveur.md` (section 36), `charge-serveur-8-12-labyrinthe.json` (créé).
- Documentation: ROADMAP (entrée 8.12 en phase 8, et l'étape terminée), journal de conception, `assets/README.md` (licence et retouches), compétence `conception-de-cartes` (fichiers, table des cartes, deux leçons), ce handoff, captures `docs/design/etape-8-12/`.

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/sim`.

## Tests

- Ajoutés: chemins du fond et de l'avant-plan de nuit, tailles et proportions des images; réglage de nuit proposé et récapitulé; crédits; note 1.10; empreintes des murs, miroir, connexité au pas de quatre pixels, aucune poche dans les deux sens, 340 faux ninjas tenables; bout en bout du rendu de jour et de nuit.
- Résultat: `pnpm verify` en local, types et linter verts, 4 509 tests sur 4 510; le dernier, `comptes/routes.test.ts` « ne sort pas de sa route pour un pseudo fait de points », a échoué une fois sur « bad port » et passe seul (voir « Problèmes connus »). Bout en bout: `rendu-labyrinthe` et `rendu-prison` 8 sur 8.
- Couverture de packages/sim: inchangée, le paquet n'est pas touché.
- État de la CI: voir le commit poussé.

## Décisions et écarts au plan

- **Choix de la session, à valider à la recette**: la taille de la carte (une fois et demie le décor), le poids du décor (1600 de large), le plafond de 340, le nom affiché « Labyrinthe » et l'ambiance « Jardin · Jour ou nuit ».
- **Le jardin autour du dédale reste praticable**, comme la collision livrée le voulait: il offre un contournement par l'extérieur, que la compétence déconseille (« pas de boulevard périphérique »). Le détour reste le plus fort du jeu; à juger en partie.
- **Des haies basses sans avant-plan**: quelques massifs (le carré au sud du centre, des bordures fleuries) ne sont pas dans le détourage livré. Ils sont des murs pleins sous le fond, sans rien qui passe devant le ninja: c'est voulu, ce sont des massifs bas.

## Problèmes connus et dette

- **Test instable sur cette machine, hors de la carte**: Windows y attribue les ports éphémères dès 1024 (`netsh int ipv4 show dynamicport tcp`), si bien qu'un serveur de test monté sur le port 0 tombe parfois sur un port que `fetch` refuse (« bad port », par exemple 6000). Trente-cinq fichiers de test montent un serveur ainsi. La CI, sous Linux, tire ses ports au-delà de 32768 et n'est pas touchée. Proposé en session séparée.
- **Un joueur qui a vu la note 1.10 de l'étape 7.27** (retirée le 14 octobre) et n'est jamais revenu depuis garde « 1.10 » en souvenir: il ne verra pas la note du Labyrinthe. Cas marginal, assumé.

## Prochaine action exacte

Jouer le Labyrinthe en ligne, de jour et de nuit, à plusieurs, et dire au porteur du projet ce que donne le contournement par le jardin et l'errance des 340 faux ninjas dans les allées.

## Étape suivante

Fiche à lire: selon la section 3 de docs/plan/ROADMAP.md.
