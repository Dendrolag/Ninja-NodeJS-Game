# Handoff - Étape 7.22 Among Ninjas, les sabotages et la malédiction des fantômes

Date: 10 octobre 2026
Auteur: session Claude Code (deux sessions, la première interrompue par la limite d'usage)
Statut: terminée, non poussée: le mode ne se déploie qu'avec ses étapes suivantes, sur accord du porteur du projet

## Objectif de l'étape

Donner aux assassins d'Among Ninjas leurs sabotages, depuis la carte plein écran, et aux proies mortes leur riposte, la malédiction. Fiche: `docs/plan/etape-7-22.md`.

## Ce qui a été fait

- **Fiche** rédigée au début de l'étape selon le cas de repli du PROTOCOLE; règles soumises au porteur du projet et ses réponses consignées: depuis la carte, commandes inversées sur les proies seulement, surchauffe perdue qui fait gagner les assassins, tout sous la 1.9.0. Retours d'essai de 7.20 et 7.21 consignés et corrigés (`30b7c8d`): tâches toutes différentes dans une liste (7 par proie au plus), lettres de déplacement dans le chat, carte et repère bloqués hors de la phase de jeu.
- **Planche des rendus** `docs/design/etape-7-22/1-planche.png`, rendus choisis: 1A, 2C, 3B, 4A, 5A, 6A, 7C (`e7b4025`).
- **Lots A et B, le moteur et le serveur** (`5ac10dd`): les six sabotages, un seul à la fois, la recharge commune; les nuisances par les malus du moteur; le nuage filtré au serveur dans la vue des proies vivantes; la panne et sa réparation tenue au boîtier; la surchauffe à deux consoles, sa victoire, le gong retenu, le terme du tour qui l'attend; la malédiction; les deux demandes validées et limitées en débit.
- **Lot C, la page** (`5f91b37`, puis cette session): panneau des sabotages et des malédictions dans la carte, choix de la station du nuage au pointeur, au doigt et au clavier, alerte de la panne et de la surchauffe, bouton « Réparer », boîtier et consoles en néon, volutes du nuage, disque et voile de la panne, flèches vers les postes, exécution au katana, fin par la surchauffe, aide, sons provisoires. Cette session a écrit les tests de la page, puis vérifié dans le vrai jeu.
- **Corrigé après les captures dans le vrai jeu** (règle 7): la bulle qui annonçait la surchauffe cachait son compte à rebours (elle ne s'affiche plus, l'alerte dit « Tenez les deux consoles ensemble »); sur téléphone, l'alerte de la surchauffe passait sous le bandeau du mode (elle se pose à sa gauche); le texte des flèches était couvert par la flèche et coupé par le bord du téléphone (il se pose en deçà, selon sa largeur); chaque console tenue s'emplit sur la mini-carte et la carte, comme la fiche le demandait.
- **Corrigé en route** (règle 7): un import inutilisé laissé par `30b7c8d` faisait échouer le linter (`packages/sim/src/among.ts`); deux tests existants ne compilaient plus après le lot C (`rendu/among.test.ts`, `victime.test.ts`).
- **Lot D**: le scénario de bout en bout sabote les néons depuis la carte d'un assassin de la page et les fait réparer au boîtier par une proie de la page; banc rejoué avec un nuage en cours; note de la 1.9.0 complétée; journal, ROADMAP, étude (section 23), fiche (« Réconciliation »).
- **Captures dans le vrai jeu**, `docs/design/etape-7-22/`: panneau des sabotages et choix du nuage au bureau, panne vue d'une proie sur téléphone et d'un assassin au bureau, réparation au boîtier, nuage vu d'une proie, panneau des malédictions sur téléphone, malédiction subie au bureau, exécution au bureau et sur téléphone, surchauffe au bureau et sur téléphone, fin par la surchauffe.

## Fichiers créés ou modifiés

Lots A à C: le détail est dans les messages de `5ac10dd` et `5f91b37`. Cette session:

- `packages/client/src/hud/sabotages.test.ts`, `rendu/sabotages.test.ts` (créés): alerte, bouton « Réparer », gong, postes, panneau; vision en panne, postes, nuage, flèches.
- `packages/client/src/interface/composants/carteAmong.test.ts`, `among.test.ts`, `modeles/fin.test.ts`, `hud/surcouche.test.ts`, `annonces.test.ts`, `sons/sons.test.ts`: le panneau et le nuage au clavier, la malédiction, l'exécution, la fin par la surchauffe, l'alerte, les annonces et les sons des sabotages.
- `packages/client/src/hud/among.ts`, `hud/surcouche.ts`, `interface/composants/carteAmong.ts`, `page/styles/jeu.css`: console tenue marquée, alerte de la surchauffe (texte, place sur téléphone).
- `packages/client/src/annonces.ts`: plus de bulle au lancement de la surchauffe.
- `packages/client/src/rendu/among.ts`: texte des flèches en deçà de la flèche; le masque du cercle de vision ne demande que le centre et le rayon.
- `packages/client/src/victime.test.ts`: l'image d'Among Ninjas prend l'instant.
- `packages/client/src/interface/modeles/notesDeVersion.ts`: « Les sabotages » dans la note de la 1.9.0, et les fantômes « Ni sans rancune ».
- `packages/sim/src/among.ts`: l'import inutilisé.
- `packages/server/src/serveur.ts`: option `genererGraine`, pour qu'un scénario fixe la graine de ses parties.
- `tests/e2e/harnais/serveur-de-jeu.ts`: option `graine`. `tests/e2e/among.spec.ts`: graine 4 (Alice tire l'assassin), la panne sabotée et réparée.
- `tests/charge/battement.ts`, `battement.test.ts`: au banc d'Among Ninjas, le premier assassin pose le nuage dès que possible; le banc compte les battements sabotés.
- Documentation: `docs/plan/etape-7-22.md` (« Réconciliation »), `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/design/etude-mode-among-ninjas.md` (section 18, section 23), `docs/mesures/charge-serveur.md` (section 31) et ses fichiers bruts `charge-serveur-7-22-*.json`, captures `docs/design/etape-7-22/*.png`.

## Tests

- Ajoutés cette session: 53 dans la page (voir ci-dessus), un au banc. Lots A et B: moteur (19), contrat, flux, validation, terrain des postes, vues et notifications, room, et à travers le vrai serveur (panne réparée, surchauffe perdue, malédiction).
- Résultat: 4 053 tests unitaires au vert, deux fois de suite. Une première exécution, au rapport abrégé, en avait compté un en échec sans le nommer; il ne s'est pas reproduit, et reste non identifié. Types des paquets, des tests et du bout en bout, linter et formatage, propres. Tests de la base non joués en local (la CI les joue).
- Couverture de packages/sim: 99,84 pour cent des instructions (99,83 au handoff 7.21).
- Bout en bout: `tests/e2e/among.spec.ts` au vert (2,3 minutes). La suite complète n'a pas été rejouée: elle se rejoue avant toute poussée.
- Empreinte des quatre parties de référence: identique, jeu et flux, avant et après les lots A et B. Depuis, le moteur n'a changé que dans le code propre au mode, que ces parties (des Hordes) ne jouent pas.

## Banc

Section 31 de `docs/mesures/charge-serveur.md`. Douze joueurs sur Tokyo, deux tours en alternance, un nuage en cours 400 battements sur 1 200: 0,215 ms par battement avec 40 PNJ (0,208 à 7.21; Horde de la même séance 0,182, contre 0,185), 0,293 avec 80 (0,286). 87 et 94 octets par message, 3 de plus qu'à 7.21.

## Décisions et écarts au plan

Consignés dans la section « Réconciliation » de la fiche. En bref: les recharges voyagent dans le bloc du mode de chaque vue (assassins et fantômes seulement), pas dans l'état privé; « Un fantôme vous maudit » au vouvoiement; le son du nuage aux seuls assassins et fantômes; l'alarme de la surchauffe jouée une fois; les flèches à 185 pixels autour du joueur; la surchauffe sans bulle; la graine fixée du scénario; le nuage posé au banc; les postes marqués en orange sur les cartes, panne comme surchauffe.

## Problèmes connus et dette

- **Le porteur du projet n'a encore rien essayé de l'étape.** À juger en jouant: les commandes inversées qui épargnent les assassins (un ninja qui marche droit se désigne-t-il ?), les mêmes dans la malédiction, les durées et recharges, la panne à 110 pixels sur téléphone.
- **Les sons sont provisoires** (fiche, section « Les sons »): l'alarme de la surchauffe et la réparation en boucle n'ont pas de boucle.
- **Sur téléphone, la carte d'une proie fantôme se fait défiler** pour atteindre les trois malédictions: la carte, puis la liste des tâches, puis le panneau (capture `maledictions-telephone.png`). Fonctionnel, à juger.
- **La graine du scénario** dépend du tirage des rôles: si le tirage change, le scénario échoue en le disant, et une autre graine se cherche (le script de sonde est simple: créer la partie à cinq par le réseau, lancer, lire qui est assassin).
- Dettes de 7.20 et 7.21 toujours ouvertes: un onglet en arrière-plan qui retient la révélation 30 secondes, la vision hors du disque peut-être trop claire, le cercle de vision qui dépasse l'écran, les textes du mode à relire. L'égout de l'exécution est remplacé par la coupe au katana.
- **Hors du dépôt**: l'ancien worktree `.claude/worktrees/optimisations` reste dans le dossier local; `pnpm lint` et `pnpm format:check` le parcourent. Lancés sans lui, ils sont propres. À supprimer par le porteur du projet s'il ne sert plus.

## État de la CI et de master

Rien n'est poussé: `master` local compte les commits de 7.20, 7.21 et 7.22 en avance sur `origin/master`. Pousser met en ligne; le porteur du projet veut d'abord les étapes suivantes. Avant toute poussée: la suite de bout en bout complète, bureau et téléphone, rejouée.

## Comment essayer en local

1. `pnpm build`.
2. `node tests/outils/jeu-sans-base.mjs` (ou `preview_start` de la configuration « jeu-sans-base »).
3. Ouvrir http://localhost:3000, créer une partie Among Ninjas.
4. `node tests/outils/joueurs-fictifs.mjs http://localhost:3000 auto 4`, puis lancer la partie.
5. Assassin: M ou la mini-carte, puis un sabotage du panneau (après 15 secondes de tour). Proie: E tenu au boîtier ou à une console. Proie fantôme: la carte, puis une malédiction.

## Prochaine action exacte

L'étape 7.23, les pas entendus, sans pousser `master` d'ici là. Sa fiche se rédige au début de l'étape, selon le cas de repli du PROTOCOLE, à partir des sections 7.4 et 18 de `docs/design/etude-mode-among-ninjas.md`.

## Étape suivante

Fiche à rédiger: `docs/plan/etape-7-23.md`.
