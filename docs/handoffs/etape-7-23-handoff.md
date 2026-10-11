# Handoff - Étape 7.23 Among Ninjas, les pas entendus

Date: 11 octobre 2026
Auteur: session Claude Code
Statut: terminée, non poussée: le mode ne se déploie qu'avec ses étapes suivantes, sur accord du porteur du projet

## Objectif de l'étape

Faire entendre aux joueurs d'Among Ninjas les pas des vivants qui marchent près d'eux, y compris hors de leur disque de vision, sans livrer de position ni d'identité. Fiche: `docs/plan/etape-7-23.md`.

## Ce qui a été fait

- **Fiche** rédigée au début de l'étape selon le cas de repli du PROTOCOLE (`d41fc2b`). Quatre questions soumises au porteur du projet, qui a retenu les quatre recommandations: les vivants à 500 pixels, PNJ et fantômes muets; au son seul, sans marque à l'écran; le nuage noir n'étouffe rien; tout sous la 1.9.0. L'étape ne dessine rien: pas de planche.
- **Lots A à C** (`3223246`):
  - Le contrat: la foulée (37,5 pixels), la portée (500), trois paliers (170, 335, 500), huit secteurs, `pasEntendu` et `ecartDUnPas`.
  - Le moteur: chaque vivant retient sa marche (`JoueurAmong.foulee`); chaque battement de jeu dit qui vient de faire un pas (`EtatAmong.pasDuBattement`). Le pas suit le déplacement réel; un saut (le replacement en réunion) remet la marche à zéro; les fantômes ne marchent pas; rien hors de la phase de jeu.
  - Le serveur: la vue de chaque vivant porte les pas des vivants qu'il ne voit pas, à portée, un par secteur et par palier, rangés dans leur ordre (`AmongVu.pas`). Le flux les code sur un octet chacun (indicateur 16 du bloc du mode).
  - La page: les pas hors de vue joués une fois par trame, au milieu de leur secteur et de leur palier; les pas des vivants affichés qui marchent, à leur place exacte, à la cadence des nôtres (`sons/pasEntendus.ts`); des voix à part dans le lecteur (`jouerUnPasDAutrui`). L'aide du mode et la note de la 1.9.0 (« Les pas ») en parlent.
- **Lot D** (ce commit): le scénario de bout en bout relit les trames de la page; le banc compte les pas faits (`pasFaits`); mesure rejouée; journal, ROADMAP, étude (sections 18 et 24), fiche (« Réconciliation »).
- **Vérifié dans le vrai jeu** (serveur sans base, quatre joueurs fictifs): la page a joué 12 pas d'autrui situés en 15 secondes, à gauche comme à droite. Le son était coupé par une préférence enregistrée dans le volet du navigateur; il a été rétabli le temps de la mesure, puis recoupé.

## Fichiers créés ou modifiés

- `packages/shared/src/among.ts`, `index.ts`: valeurs et calcul des secteurs et des paliers.
- `packages/shared/src/evenements.ts`, `flux.ts`: `AmongVu.pas` et son codage.
- `packages/sim/src/etatAmong.ts`, `among.ts`, `index.ts`: la marche et les pas du battement.
- `packages/server/src/vues.ts`: les pas hors de vue dans la vue d'un vivant.
- `packages/client/src/sons/pasEntendus.ts` (créé), `sons/lecteur.ts`, `rendu/boucle.ts`: la place et la cadence des pas d'autrui.
- `packages/client/src/interface/composants/aide.ts`, `interface/modeles/notesDeVersion.ts`: l'aide et la note.
- Tests: `packages/sim/src/among.pas.test.ts`, `packages/server/src/among.pas.test.ts`, `packages/client/src/sons/pasEntendus.test.ts` (créés); `packages/shared/src/among.test.ts`, `flux.test.ts`, `packages/server/src/ServeurSocket.among.test.ts`, `among.test.ts`, `packages/client/src/rendu/boucle.test.ts`, `sons/sons.test.ts`, `interface/essais.ts`.
- `tests/e2e/among.spec.ts`: l'étape 3 quater, une page qui entend un marcheur hors de vue.
- `tests/charge/battement.ts`, `battement.test.ts`: le compte des pas au banc.
- Documentation: `docs/plan/etape-7-23.md`, `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/design/etude-mode-among-ninjas.md`, `docs/mesures/charge-serveur.md` (section 32) et ses fichiers bruts `charge-serveur-7-23-*.json`.

## Tests

- Ajoutés: 7 au moteur, 8 aux vues, 1 à travers le vrai serveur, 4 au contrat, 3 au flux, 7 au module des pas de la page, 5 à la boucle de rendu, 1 au lecteur, 1 au banc; l'étape 3 quater du bout en bout.
- Résultat: 4 089 tests unitaires au vert (plus celui du banc ajouté ensuite). Types des paquets, des tests et du bout en bout, linter et formatage des fichiers touchés, propres. Tests de la base non joués en local (la CI les joue).
- Couverture de packages/sim: 99,84 pour cent des instructions, comme au handoff 7.22.
- Bout en bout: `tests/e2e/among.spec.ts` au vert (2,1 minutes). La suite complète n'a pas été rejouée: elle se rejoue avant toute poussée.
- Empreinte des quatre parties de référence: identique, jeu et flux, avant et après l'étape.

## Banc

Section 32 de `docs/mesures/charge-serveur.md`. Douze joueurs sur Tokyo qui marchent au hasard, 2 372 pas en 1 200 battements: 0,232 ms par battement avec 40 PNJ (0,215 à 7.22; Horde de la même séance 0,190, contre 0,182), 0,314 avec 80 (0,293). L'écart propre au mode, environ 0,01 ms, est dans la projection. 87 et 94 octets par message, comme à 7.22.

## Décisions et écarts au plan

Consignés dans la section « Réconciliation » de la fiche. En bref: un marcheur tué dans le battement de son pas est muet; une trame remplacée avant d'être affichée perd ses pas; le volume d'un pas d'autrui va de la moitié de nos pas au dixième, en ligne droite, et son côté suit la direction seule; le banc compte les pas; le scénario relit les trames de la page.

## Problèmes connus et dette

- **Le porteur du projet n'a encore rien essayé de l'étape.** À juger en jouant: le volume des pas d'autrui, la portée de 500 pixels, la cadence, et si un client modifié pourrait trop en tirer (la voie suivante serait d'arrondir dans le temps, fiche, points de vigilance).
- **La note de la 1.9.0 dit des fantômes « Ni silencieux »**, alors que leurs pas ne s'entendent pas. Le texte est celui du porteur du projet: à lui de dire s'il le garde. La puce « Les pas » (« On entend venir avant de voir. Les vivants seulement. ») lui est soumise aussi.
- **Les bruits sont ceux de nos pas.** Le porteur du projet peut en fournir un plus sourd pour les pas d'autrui.
- **Dans le volet du navigateur de Claude**, le son du jeu est coupé par une préférence enregistrée (`neon-ninja.son`), et le contexte audio reste suspendu: une vérification du son y passe par l'instrumentation.
- Dettes de 7.20 à 7.22 toujours ouvertes: les sons provisoires des sabotages, la carte d'une proie fantôme qui défile sur téléphone, la graine du scénario, un onglet en arrière-plan qui retient la révélation, la vision hors du disque peut-être trop claire, le cercle de vision qui dépasse l'écran, les textes du mode à relire.
- **Hors du dépôt**: l'ancien worktree `.claude/worktrees/optimisations` reste dans le dossier local; `pnpm lint` et `pnpm format:check` le parcourent. Les fichiers extraits en CRLF par Git sous Windows font aussi échouer `prettier --check .` en local; ne vérifier que les fichiers touchés.

## État de la CI et de master

Rien n'est poussé: `master` local compte les commits de 7.20 à 7.23 en avance sur `origin/master`. Pousser met en ligne; le porteur du projet veut d'abord les étapes suivantes. Avant toute poussée: la suite de bout en bout complète, bureau et téléphone, rejouée.

## Comment essayer en local

1. `pnpm build`.
2. `node tests/outils/jeu-sans-base.mjs` (ou `preview_start` de la configuration « jeu-sans-base »).
3. Ouvrir http://localhost:3000, le son rétabli, et créer une partie Among Ninjas.
4. `node tests/outils/joueurs-fictifs.mjs http://localhost:3000 auto 4`, puis lancer la partie.
5. Rester immobile: les joueurs fictifs qui marchent s'entendent, de leur côté, plus fort de près.

## Prochaine action exacte

L'étape 7.24, les tâches longues (les quatre mini-jeux d'arcade), sans pousser `master` d'ici là. Sa fiche se rédige au début de l'étape, selon le cas de repli du PROTOCOLE, à partir des sections 9.4 et 18 de `docs/design/etude-mode-among-ninjas.md`.

## Étape suivante

Fiche à rédiger: `docs/plan/etape-7-24.md`.
