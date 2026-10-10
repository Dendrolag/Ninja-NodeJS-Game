# Handoff - Étape 7.21 Among Ninjas, les tâches courtes et la carte

Date: 10 octobre 2026
Auteur: session Claude Code
Statut: terminée, non poussée: le mode ne se déploie qu'avec ses étapes suivantes, sur accord du porteur du projet

## Objectif de l'étape

Remplacer la tâche provisoire d'Among Ninjas (tenir le bouton à une station) par les sept tâches courtes de l'étude, des gestes de quatre à cinq secondes joués dans la page, et donner au mode sa carte plein écran; en réglage de l'hôte, les tâches visuelles et la barre des tâches. Fiche: `docs/plan/etape-7-21.md`.

## Ce qui a été fait

- **Fiche** rédigée au début de l'étape selon le cas de repli du PROTOCOLE, à partir des sections 9, 10, 13, 18 et 21 de l'étude (`5bd3ece`). Les règles et les valeurs soumises au porteur du projet, ses réponses consignées (`744562e`, voir la fiche, « Réponses du porteur du projet »).
- **Planche des rendus**, `docs/design/etape-7-21/1-planche.png`, et choix du porteur du projet: 1A, 2A, 3A, 4A sur téléphone, 4B sur ordinateur (`411dc31`, `e4cd02f`). **Planche des sept gestes**, `2-gestes.png`, validée telle quelle; la demande qui suit, `734c588`.
- **Demande du porteur du projet après la planche des gestes**: des tâches qui varient d'une partie à l'autre et d'un joueur à l'autre. La tâche d'une station se tire pour chaque proie, les listes se répartissent sur les stations; d'autres tâches courtes viendront dans une étape à part, `7.26` (numéro provisoire, au ROADMAP).
- **Lots A et B, le contrat, le moteur et le serveur** (`99feadb`): sept natures et leurs durées minimales, les stations nommées, deux réglages de l'hôte; l'ouverture à l'appui, la fin jugée contre la durée minimale, l'annulation hors du disque ou à la fermeture; la tâche visuelle adressée aux seuls témoins; la barre filtrée dans la vue de chaque vivant; la demande « tâche ».
- **Lot C, la page** (`fba467f`): les sept gestes en modèles purs, leur dessin, la fenêtre néon, la feinte de l'assassin, les commandes figées pendant une tâche, la carte plein écran (M ou la mini-carte), la liste sous la mini-carte au bureau, les étincelles et la bouffée, les sons provisoires.
- **Lot D**: le scénario de bout en bout fait une vraie tâche au clavier et ouvre la carte; la note de la 1.9.0 annonce les tâches et la carte; documentation.
- **Captures dans le vrai jeu**, `docs/design/etape-7-21/`: les sept gestes au bureau (`geste-*-ordinateur.png`), la feinte d'un assassin sur téléphone (`feinte-telephone.png`), la carte (`carte-ordinateur.png`), la liste sous la mini-carte (`liste-ordinateur.png`).

## Fichiers créés ou modifiés

Le détail est dans les messages des commits `99feadb` et `fba467f`. En résumé:

- `packages/shared/src/among.ts`, `reglages.ts`, `validation.ts`, `evenements.ts`, `ressources.ts`, `index.ts`: les natures, les durées, les stations nommées, les réglages, la demande, la notification, les douze sons provisoires.
- `packages/sim/src/among.ts`, `etatAmong.ts`, `moteur.ts`: les règles des tâches.
- `packages/server/src/instantane.ts`, `vues.ts`, `GameRoom.ts`, `ServeurSocket.ts`: l'état privé, la notification, la barre, la demande.
- `packages/client/src/interface/modeles/gestes/` (créé): les sept gestes. `interface/composants/tache.ts`, `dessinsDesGestes.ts`, `carteAmong.ts` (créés): la fenêtre, le dessin, la carte.
- `packages/client/src/among.ts`, `actions.ts`, `reduction.ts`, `client.ts`, `faits.ts`, `controles/`, `hud/among.ts`, `hud/modele.ts`, `hud/surcouche.ts`, `rendu/boucle.ts`, `rendu/among.ts`, `rendu/scene.ts`, `sons/`, `interface/ecrans/jeu.ts`, `interface/composants/aide.ts`, `interface/modeles/reglages.ts`, `salon.ts`, `notesDeVersion.ts`, `page/styles/jeu.css`.
- `tests/e2e/among.spec.ts`, `tests/e2e/harnais/gestes.ts` (créé).
- Documentation: `docs/plan/etape-7-21.md` (créé), `docs/plan/ROADMAP.md` (7.21, 7.26, journal), `docs/design/README.md` (journal), `docs/design/etude-mode-among-ninjas.md` (section 18, section 22), `docs/mesures/charge-serveur.md` (section 30), `docs/design/etape-7-21/` (planches et captures).

## Tests

- Ajoutés: contrat (natures, stations, réglages et leur validation); moteur (tirage réparti, nature par proie, ouverture, durée minimale, annulation, feinte, fantôme, tâches visuelles, barre); serveur (vues et barre, notification des témoins, room) et à travers le vrai serveur (une tâche ouverte, refusée trop tôt, puis faite); page (les sept gestes et leur rythme au plus vite, la fenêtre, la carte, l'état, la feinte, les commandes figées, la touche M, les effets visuels et leur son).
- Résultat: 3 952 tests unitaires au vert; types des paquets, des tests et du bout en bout, et linter, propres. Tests de la base non joués en local (la CI les joue).
- Bout en bout: scénario `tests/e2e/among.spec.ts` au vert (la proie fait une vraie tâche au clavier, la carte s'ouvre par M). Suite complète, bureau, téléphone et banc, jouée deux fois en fin d'étape: 105 scénarios sur 106 au vert les deux fois. Le seul échec est le banc de rendu au processeur ralenti six fois, notre code à 4,4 puis 4,7 ms par image à 500 sprites pour un plafond local de 4,17: l'échec connu de cette machine (handoffs 8.6 et 8.8, 4,20 puis 4,40), que la CI n'exige pas (étape 4.5). Rien de l'étape ne touche le rendu d'un autre mode
- Couverture de packages/sim: 99,83 pour cent des instructions, inchangée. Elle était tombée à 99,79: une garde de `appuyer` (moteur), inatteignable depuis que le fantôme passe ailleurs, remplacée par la certitude, commentée (99,83 au handoff 7.20).
- Empreinte des quatre parties de référence, jeu et flux: identique à l'octet avant et après les lots A et B.
- État de la CI: rien n'est poussé (voir plus bas).

## Banc

Section 30 de `docs/mesures/charge-serveur.md`, fichiers bruts `charge-serveur-7-21-*.json`. Douze joueurs sur Tokyo, deux tours en alternance: 0,208 ms par battement avec 40 PNJ (0,197 à 7.20; Horde de la même séance 0,185, contre 0,183), 0,286 avec 80 (0,279). Environ 0,01 ms de plus, propre au mode: le parcours des tâches ouvertes et la barre recopiée dans chaque vue. 84 et 91 octets par message, inchangés. Les joueurs du banc n'ouvrent aucune tâche.

## Décisions et écarts au plan

Consignés dans la section « Réconciliation » de la fiche. Les décisions du porteur du projet pendant l'étape:

- 10 octobre: le cercle de vision qui dépasse l'écran depuis le cadrage serré est **gardé tel quel**, à juger à la prochaine partie d'essai; tâches visuelles **activées par défaut**; **tout sous la 1.9.0**; le reste des règles construit tel que proposé, à juger en jouant l'ensemble.
- Rendus: 1A, 2A, 3A, 4A sur téléphone, 4B sur ordinateur; planche des gestes validée.
- Des tâches qui varient (ci-dessus), et l'étape `7.26` à venir.

## Problèmes connus et dette

- **Le porteur du projet n'a encore rien essayé de l'étape**: règles, durées, gestes et carte se jugeront à sa partie d'essai.
- **Les sons des tâches sont provisoires**, comme ceux de 7.20 (meurtre, alerte de la victime, gong et réunion, exécution). Le frottement et le remplissage en boucle n'en ont aucun. Liste et provisoires: fiche, section « Les sons »; les fichiers se changent dans `packages/shared/src/ressources.ts`.
- **Le cercle de vision dépasse l'écran** depuis le cadrage serré (dette de 7.20, gardée telle quelle sur décision du porteur du projet).
- **Une tâche au doigt n'est pas jouée par le scénario de bout en bout**: vérifiée par les captures et à l'œil sur un téléphone simulé (375 sur 812). Le vrai téléphone reste à essayer, comme à 7.20.
- **La note de la 1.9.0** (« Les tâches », « La carte ») est à relire par le porteur du projet avec le reste de la note.
- Dettes de 7.20 toujours ouvertes: l'égout de l'exécution à affiner, un onglet en arrière-plan qui retient la révélation 30 secondes, la vision hors du disque peut-être trop claire, les textes du mode à relire.
- **Hors du dépôt**: un ancien worktree, `.claude/worktrees/optimisations`, reste dans le dossier local (ignoré par git). `pnpm lint` le parcourt et y relève plus de 3 000 erreurs qui ne sont pas celles du dépôt; le linter, lancé sans lui, est propre. À supprimer par le porteur du projet s'il ne sert plus.

## État de la CI et de master

Rien n'est poussé: `master` local compte les commits de 7.20 et de 7.21 en avance sur `origin/master`. Pousser met en ligne; le porteur du projet veut d'abord les étapes suivantes. Avant toute poussée: la suite de bout en bout complète, rejouée (105 sur 106, deux fois, le banc ralenti excepté à la fin de cette étape).

## Comment essayer en local

1. `pnpm build`.
2. `node tests/outils/jeu-sans-base.mjs` (ou `preview_start` de la configuration « jeu-sans-base »).
3. Ouvrir http://localhost:3000, créer une partie Among Ninjas.
4. `node tests/outils/joueurs-fictifs.mjs http://localhost:3000 auto 4`, puis lancer la partie. Les joueurs fictifs ne font pas de tâches.
5. À une station de sa liste, E ou le bouton d'action ouvre la tâche; M ou la mini-carte, la carte.

## Prochaine action exacte

L'étape 7.22, les sabotages, sans pousser `master` d'ici là. Sa fiche se rédige au début de l'étape, selon le cas de repli du PROTOCOLE, à partir des sections 11, 12 et 20 de `docs/design/etude-mode-among-ninjas.md` (sabotages, fantômes, malédiction des fantômes); où les sabotages se déclenchent (depuis la carte ou à des postes) se tranche au début de l'étape avec le porteur du projet.

## Étape suivante

Fiche à rédiger: `docs/plan/etape-7-22.md`.
