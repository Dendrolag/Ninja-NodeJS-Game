# Handoff - Étape 7.20 Among Ninjas, le socle du mode

Date: 9 octobre 2026
Auteur: session Claude Code
Statut: partielle (lots A, B et C faits; essai du porteur du projet, lot D et livraison à faire)

## Objectif de l'étape

Ajouter le sixième mode, Among Ninjas, jouable entre amis sur Tokyo: des assassins anonymes éliminent en secret des proies qui font des tâches à des stations, un cadavre signalé ou le gong ouvre une réunion où l'on discute puis vote, les morts jouent en fantôme, chacun ne voit qu'autour de lui. Une seule tâche provisoire (tenir le bouton d'action à une station). Fiche: `docs/plan/etape-7-20.md`.

## Ce qui a été fait

- **Fiche**: deux sessions ont rédigé une fiche le même jour; celle de la conversation de l'étude fait foi (fusion `0aefcaa`). Valeurs confirmées par le porteur du projet (`44b9062`), puis planche des rendus et ses choix (`2a27908`), toutes consignées dans la fiche.
- **Lot A, contrat et moteur** (`14e4ba2`): mode `among`, ses valeurs, ses lieux de Tokyo (gong et treize stations) et leur miroir, douze couleurs nommées, gris de la foule, réglages imposés; le moteur pur: tirage des rôles, des stations et des listes, phases et monde figé, meurtre au contact, cadavre, fantômes qui traversent les murs, signaler, gong, tâches tenues, réunion, vote, éjection sans rôle, victoire, points des faits de jeu.
- **Lot B, flux et serveur** (`da20b08`): bloc de phase, fantôme et cadavre dans le flux binaire (une partie d'un autre mode identique à l'octet), une vue par vivant bornée à son disque et sans fantôme, une vue des fantômes, état privé annoncé à chacun, notifications de meurtre aux seuls témoins, réunion à tous, chat par canal, messages `agir` et `voter`, bilan par camp, migration.
- **Fusions**: Prison Island (8.11, migration du mode renumérotée en `0015_mode_among`, `29d492d`), puis les optimisations du 9 octobre (statistiques de fin par mode, `dc7122a`): Among Ninjas a ses colonnes (tâches, meurtres, signalés, bons votes).
- **Lot C1, données de la page** (`5554ac3`): état privé, réunion, morts connus, notre vote; touche E et bouton tenus comme bouton d'action.
- **Lots C2 à C5, la page** (`22640e9`): la carte (cadavre coupé en deux, fantôme translucide, stations, gong, cercle de vision), le HUD (rôle, barre des tâches, jauge, bouton d'action et son libellé, katana de l'assassin), les écrans (révélation en rangée, réunion en table ronde avec chat et vote, traits de vote, éjection dans l'égout, chat des fantômes), réglages et récapitulatifs du salon et de la création, fin par camp avec rôles révélés, annonces et sons provisoires, présentation statique.
- **Essai dans le navigateur de Claude Code** avec quatre joueurs fictifs: création, salon, révélation, carte, réunion d'office, chat, vote, éjection, tour suivant. Pas encore vus en vrai: un meurtre fait par soi, le cadavre, la vue d'un fantôme, l'écran de fin.

## Décisions du porteur du projet pendant la session

- Valeurs (fiche, « Valeurs confirmées »): tâches de 3 à 8 par proie; meurtre au contact (32 px de centre à centre); éjection jamais confirmée, le doute reste jusqu'au dernier assassin; tour de 3 minutes par défaut; aucun terme de partie; tâches de 5 à 10 s; camp vainqueur puis sous-classement aux points des faits de jeu.
- Planche (fiche, « Rendus choisis »): « Assassin » remplace « Tueur » dans la page (le code garde `tueur`); révélation C; cercle de vision mélangé (disque net, décor hors disque assombri de moitié et sans couleur); cadavre C (coupé en deux); fantôme entre A et B; réunion B à améliorer (rendu des votes); éjection B à affiner.
- 9 octobre: **aucun pseudo sur la carte**, sauf entre assassins; les pseudos restent à la révélation, en réunion, à l'éjection, à la fin.

## Fichiers créés ou modifiés

- `packages/shared`: `among.ts` (créé), `constantes.ts`, `reglages.ts`, `bornes.ts`, `validation.ts`, `evenements.ts`, `entrees.ts`, `flux.ts`, `statistiquesDeFin.ts`, `index.ts`; tests `among.test.ts` (créé), `flux.test.ts`, `reglages.test.ts`.
- `packages/sim`: `among.ts` et `etatAmong.ts` (créés), `moteur.ts` (trois questions de plus au jeu de règles: monde figé, passe-muraille, sans terme), `etat.ts`, `couleurs.ts`, `bots.ts`, `contacts.ts`, `score.ts`, `index.ts`; tests `among.test.ts` (créé), `etat.test.ts`.
- `packages/server`: `GameRoom.ts`, `ServeurSocket.ts`, `instantane.ts`, `vues.ts`, `statistiquesDeFin.ts`; `migrations/0015_mode_among.sql` et ses métadonnées; tests `among.test.ts` et `ServeurSocket.among.test.ts` (créés), `statistiquesDeFin.test.ts`.
- `packages/client`: créés `among.ts`, `hud/among.ts`, `rendu/among.ts`, `interface/avatarNinja.ts`, `interface/modeles/among.ts`, `interface/composants/among.ts`, `among.test.ts`; modifiés `faits.ts`, `actions.ts`, `etat.ts`, `reduction.ts`, `reconstruction.ts`, `client.ts`, `controles/controles.ts`, `controles/clavier.ts`, `rendu/boucle.ts`, `rendu/scene.ts`, `rendu/pixi.ts`, `rendu/textures.ts`, `rendu/apparence.ts`, `hud/modele.ts`, `hud/surcouche.ts`, `annonces.ts`, `sons/declencheurs.ts`, `interface/ecrans/jeu.ts`, `interface/ecrans/fin.ts`, `interface/composants/chat.ts`, `interface/composants/reglages.ts`, `interface/composants/aide.ts`, `interface/modeles/cartes.ts`, `interface/modeles/reglages.ts`, `interface/modeles/salon.ts`, `interface/modeles/creation.ts`, `interface/modeles/fin.ts`, `interface/icones.ts`, `page/index.html`, `page/styles/jeu.css`, `page/styles/ecrans.css`; tests `application.test.ts`, `creation.test.ts`.
- `tests/outils/jeu-sans-base.mjs` et `joueurs-fictifs.mjs` (créés): essayer en local sans la base de production, et lancer à cinq avec des joueurs fictifs.
- `vitest.config.ts`: `etatAmong.ts`, fichier de types, hors de la couverture.
- `docs/plan/etape-7-20.md`, `docs/design/etape-7-20/planche.html` et `1-planche.png`.

## Tests

- Ajoutés: moteur (52: tirage, phases, meurtre, fantômes, action, tâches, vote, victoire, départs, points, vision), contrat (14 et 4 du flux), serveur (22 unitaires, 5 d'intégration dont une partie entière à cinq clients, 1 des statistiques de fin), page (9).
- Résultat: 3 816 tests unitaires au vert; types des paquets, des tests et du bout en bout, et linter, propres. Tests de la base non joués en local (la CI les joue).
- Couverture de packages/sim: 99,83 pour cent des instructions (99,79 au handoff 2.9); `among.ts` à 100.
- Empreinte des quatre parties de référence: identique avant et après le lot B, jeu et flux (relevée sur le code d'avant l'étape).
- État de la CI: **rien n'est poussé**. Les commits de l'étape sont sur le `master` local, devant `origin/master` (`6204636`).

## Décisions et écarts au plan

- Identifiant `among` et état `EtatPartie.among`, comme la fiche. Phases `revelation`, `jeu`, `discussion`, `vote`, `ejection` (la fiche disait `reunion`: la réunion a deux phases).
- Le bouton d'action est un état tenu (`agir`), comme le déplacement; signaler et sonner se font à l'appui, la tâche se fait en tenant. Un appui bref est retenu jusqu'à la prochaine image et le prochain battement (deux défauts trouvés à l'essai, corrigés).
- Le meurtre réutilise la demande de capture; l'arme de l'assassin voyage dans `tactique`, dans sa seule vue.
- L'état privé (rôle, complices, stations, liste) part à chacun seul, dès le lancement, puis à chaque changement; le rôle n'est dans aucune trame.
- Le temps de partie ne s'écoule pas hors du jeu (fiche, décision 4); aucun terme.
- Deux défauts corrigés en route (règle 7): le serveur chargeait le terrain de la carte demandée et non de celle que le mode impose; une notification sans envoi partait en silence nulle part (garde d'exhaustivité ajoutée).
- Pas de `pnpm dev` sur la machine du porteur du projet: `DATABASE_URL` y désigne la production. D'où `tests/outils/jeu-sans-base.mjs`, et la configuration « jeu-sans-base » ajoutée à `.claude/launch.json` (fichier ignoré par Git, local seulement).
- Textes du mode (présentation, rappel, aide, consignes) provisoires, à soumettre au porteur du projet avec la note de version.

## Problèmes connus et dette

- Pas encore vus en partie: le meurtre fait par soi, le cadavre coupé en deux, la vue d'un fantôme et son chat, l'écran de fin.
- La révélation (5 s) peut passer pendant le chargement de la carte: un joueur lent la manque.
- Les traits de vote se lisent mal (pointe peu visible); l'égout est à affiner (demande du porteur du projet).
- La vision hors du disque: à juger, peut-être trop claire.
- Sur téléphone: rien n'a été vérifié (table ronde, chat, bouton d'action).
- Lot D non fait: scénario de bout en bout `tests/e2e/among.spec.ts`, mesure au banc à douze vues (prochaine section de `docs/mesures/charge-serveur.md`: 29), CLAUDE.md (comportements 1, 2 et 4), journal de conception, ROADMAP, étude.
- Version: Prison Island a pris 1.8; Among Ninjas prendra **1.9.0** avec sa note 1.9, à soumettre au porteur du projet.

## Comment essayer en local

1. `pnpm build` (types, puis la page empaquetée).
2. `node tests/outils/jeu-sans-base.mjs` (ou, dans Claude Code, `preview_start` de la configuration « jeu-sans-base »).
3. Ouvrir http://localhost:3000, créer une partie Among Ninjas.
4. `node tests/outils/joueurs-fictifs.mjs http://localhost:3000 auto 4`, puis lancer la partie.

## Prochaine action exacte

Recueillir les retours du porteur du projet sur son essai local, et les traiter. Puis le lot D: scénario de bout en bout, mesure au banc, documentation, version 1.9.0 et sa note. Enfin pousser `master`, suivre la CI et la mise en ligne.

## Étape suivante

Fiche à lire: `docs/plan/etape-7-20.md` (la même étape, à terminer).
