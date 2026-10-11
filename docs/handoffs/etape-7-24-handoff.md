# Handoff - Étape 7.24 Among Ninjas, les tâches longues

Date: 11 octobre 2026
Auteur: session Claude Code
Statut: terminée, non poussée: le mode ne se déploie qu'avec l'accord du porteur du projet

## Objectif de l'étape

Ajouter aux listes des proies d'Among Ninjas des tâches longues, quatre mini-jeux d'arcade d'une douzaine de secondes au moins, pendant lesquels la proie reste immobile et vulnérable. Fiche: `docs/plan/etape-7-24.md`.

## Ce qui a été fait

- **Fiche** rédigée au début de l'étape selon le cas de repli du PROTOCOLE (`f95dc3b`). Quatre questions soumises au porteur du projet, qui a retenu les quatre recommandations: un réglage de l'hôte de 0 à 2 tâches longues par liste, une par défaut; chaque mini-jeu à deux stations, dans deux quartiers; un échec qui recommence le mini-jeu sur place; des noms et des dessins à nous (« Tetris » et « Space Invaders » sont des marques).
- **Planche des rendus** (`3420f31`): trois dessins par mini-jeu. Choix du porteur du projet: le néon au trait (B) pour les quatre.
- **Lots A à C** (`7704644`):
  - Le contrat: `NATURES_COURTES`, `NATURES_LONGUES`, `estUneTacheLongue`, douze secondes minimales par mini-jeu, les natures des cinq stations, le réglage `tachesLongues`, huit sons provisoires.
  - Le moteur: les stations actives gardent les tâches courtes à des stations distinctes et les tâches longues demandées à d'autres; chaque liste place d'abord ses tâches longues, puis ses courtes.
  - Le serveur: rien de neuf, un test à travers le vrai serveur pour la durée minimale d'un mini-jeu.
  - La page: les quatre mini-jeux, modèles purs (`modeles/gestes/caisses.ts`, `serpent.ts`, `envahisseurs.ts`, `bataille.ts`), leur dessin néon (`composants/dessinsDesMiniJeux.ts`), l'écran gagné qui attend la durée minimale (`tache.ts`), le réglage au salon, l'aide et la note de la 1.9.
- **Lot D** (ce commit): les Black Ninjas qui ripostent (voir plus bas), deux retouches de dessin après les captures, le scénario de bout en bout, le banc, la documentation.

## Fichiers créés ou modifiés

- `packages/shared/src/among.ts`, `index.ts`, `reglages.ts`, `bornes.ts`, `validation.ts`, `ressources.ts`: natures, stations, réglage, sons.
- `packages/sim/src/among.ts`: le tirage des stations actives et des listes.
- `packages/client/src/interface/modeles/gestes/caisses.ts`, `serpent.ts`, `envahisseurs.ts`, `bataille.ts` (créés), `commun.ts`, `index.ts`: les mini-jeux.
- `packages/client/src/interface/composants/dessinsDesMiniJeux.ts` (créé), `dessinsDesGestes.ts`, `tache.ts`: le dessin, l'écran gagné.
- `packages/client/src/interface/modeles/reglages.ts`, `salon.ts`, `composants/aide.ts`, `modeles/notesDeVersion.ts`: salon, aide, note.
- Tests: `modeles/gestes/minijeux.test.ts` (créé); `gestes.test.ts`, `composants/tache.test.ts`, `modeles/salon.among.test.ts`, `packages/shared/src/among.test.ts`, `packages/sim/src/among.test.ts`, `packages/server/src/ServeurSocket.among.test.ts`.
- `tests/e2e/among.spec.ts`, `tests/e2e/harnais/gestes.ts`: l'étape 3 bis bis, une bataille navale au clavier.
- Documentation: `docs/plan/etape-7-24.md` (créé), `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/design/etude-mode-among-ninjas.md` (sections 18 et 25), `docs/design/etape-7-24/` (planche et captures), `docs/mesures/charge-serveur.md` (section 33) et ses fichiers bruts `charge-serveur-7-24-*.json`.

## Tests

- Unitaires: 4 119 au vert après les lots A à C, plus ceux du lot D (le joueur immobile qui ne gagne jamais). Types des paquets, des tests et du bout en bout, linter des paquets et du bout en bout: propres. Tests de la base non joués en local (la CI les joue).
- Bout en bout: `tests/e2e/among.spec.ts` au vert sur le projet bureau (2,5 minutes). La suite complète n'a pas été rejouée: elle se rejoue avant toute poussée.
- Empreinte des quatre parties de référence: identique, jeu et flux, avant et après l'étape.
- Couverture de packages/sim: 99,84 pour cent des instructions, comme au handoff 7.23.
- La passe de couverture complète a vu échouer six tests de `packages/server/src/comptes/routes.test.ts` (« fetch failed: bad port », un port tiré au hasard que Node refuse); relancé seul, le fichier passe (37 tests). Sans lien avec l'étape.

## Banc

Section 33 de `docs/mesures/charge-serveur.md`. 0,228 ms par battement avec 40 PNJ (0,232 à 7.23), 0,321 avec 80 (0,314); la Horde de la même séance 0,181 et 0,248. Les mini-jeux ne quittent pas la page; le tirage ne joue qu'au lancement. 87 et 94 octets par message, comme à 7.23.

## Décisions et écarts au plan

Consignés dans la section « Réconciliation » de la fiche. Trois écarts mesurés, **à soumettre au porteur du projet**:

1. **Quatre caisses à poser, pas trois**: trois se posaient en six secondes. Au plus vite, de 11 à 14 secondes.
2. **Vingt tirs à la bataille navale**: à douze (l'étude), un joueur méthodique ne réussit que deux fois sur dix; à vingt, neuf fois sur dix.
3. **Les Black Ninjas ripostent**: avec un ninja qui lance seul, un joueur immobile au milieu gagnait sans rien faire. Toutes les 1,8 seconde, le Black Ninja le plus proche lance vers notre ninja; touché, on recommence. Si le porteur du projet n'en veut pas, la voie de rechange est un tir à la main.

## Problèmes connus et dette

- **Le porteur du projet n'a encore rien essayé de l'étape.** À juger en jouant: la difficulté de chaque mini-jeu au doigt, les ripostes, la durée minimale de douze secondes, et si deux stations par mini-jeu suffisent à brouiller l'affût des assassins.
- **Les sons des mini-jeux sont provisoires**, et les ripostes muettes.
- **Les textes sont à relire par le porteur du projet**: la puce « Les mini-jeux » de la note 1.9 (« Caisses, serpent, Black Ninjas, bataille navale. Vingt secondes à découvert. »), l'aide du mode, les annonces de l'écran gagné (« Deux lignes ! », « Rassasié ! », « Repoussés ! », « Coulés ! ») et de l'écran perdu (« Raté ! »).
- Dettes de 7.20 à 7.23 toujours ouvertes: les sons provisoires des tâches et des sabotages, la carte d'une proie fantôme qui défile sur téléphone, un onglet en arrière-plan qui retient la révélation, la vision hors du disque peut-être trop claire, le cercle de vision qui dépasse l'écran, les textes du mode, « Ni silencieux » dans la note de la 1.9.
- **Hors du dépôt**: l'ancien worktree `.claude/worktrees/optimisations` reste dans le dossier local; ne linter et ne formater que les fichiers touchés.

## État de la CI et de master

Rien n'est poussé: `master` local compte les commits de 7.20 à 7.24 en avance sur `origin/master`. Pousser met en ligne; le porteur du projet doit d'abord donner son accord. Avant toute poussée: la suite de bout en bout complète, bureau et téléphone, rejouée.

## Comment essayer en local

1. `pnpm build`.
2. `node tests/outils/jeu-sans-base.mjs` (ou `preview_start` de la configuration « jeu-sans-base »).
3. Ouvrir http://localhost:3000 et créer une partie Among Ninjas; au salon, « Dont mini-jeux » règle leur nombre.
4. `node tests/outils/joueurs-fictifs.mjs http://localhost:3000 auto 4`, puis lancer la partie.
5. Aller à une station dont la tâche est un mini-jeu (la carte plein écran, touche M, dit laquelle), appuyer sur E.

## Prochaine action exacte

Demander la suite au porteur du projet: `7.25`, l'appropriation, demande une partie d'essai d'abord; `7.26`, d'autres tâches courtes, peut se faire sans; ou la mise en ligne du mode, après la suite de bout en bout complète.

## Étape suivante

Selon sa réponse. La fiche de `7.25` ou de `7.26` se rédige au début de l'étape, selon le cas de repli du PROTOCOLE.
