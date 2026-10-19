# Handoff - Étape 7.28 Among Ninjas, le déguisement en PNJ

Date: 16 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Qu'un joueur d'Among Ninjas, assassin ou proie, puisse prendre pour vingt secondes l'apparence d'un PNJ: l'assassin en tuant un PNJ, dont le cadavre reste comme indice; la proie en revêtant, quand elle veut, un habit ramassé que les assassins ne voient pas. Fiche: `docs/plan/etape-7-28.md`.

## Réponses du porteur du projet

Le 16 octobre 2026, sur la planche (`docs/design/etape-7-28/1-planche.png`): 1A, 2A, 3A, 4C, 5C. Le cadavre d'un PNJ coupé en deux dans son sang, en gris; l'habit en kimono plié au trait néon, qui bat; le déguisé gris, cerné d'un contour à sa couleur; un bouton « Habit » à la place du Katana, touche Espace, qui n'apparaît qu'une fois l'habit ramassé et se vide en anneau. Les sept recommandations de la fiche, toutes retenues. Détail: fiche, « Réponses du porteur du projet ».

## Hors étape, au début: les meubles de Tokyo et deux sons

Livrés par le porteur du projet en début d'étape, posés et mis en ligne d'abord, sous la version 1.9.9 (`e04c7ca`), après trois décisions de sa part (journal de conception du 16 octobre 2026):

- **Quatorze meubles et véhicules**, découpes du fond de Tokyo retrouvées par comparaison au pixel près, droites ou retournées, à chacun de leurs exemplaires (neuf bornes roses, sept rouges, cinq commodes, deux futons). Sept stations s'y déplacent et changent de nom, sur la répartition validée (`docs/design/etape-7-28/3-stations-proposees.png`). **La place d'une station dont le meuble se répète se tire à chaque partie**, après tous les autres tirages. Seul le meuble devant la place tirée s'éclaire. Captures dans le vrai rendu: `4-meubles-*.png`.
- **Le Tapis du salon porte « Nettoyer du sang » au lieu de « Remplir de fumée »**, avec le tapis pour sol de la fenêtre de la tâche.
- **Deux sons**: `validation-tache.mp3`, la fin de toute tâche; `recharge-fumee.mp3`, la fumée qui monte dans un bonus, entendue tant qu'on tient, coupée au relâcher (le lecteur sait désormais arrêter un son ponctuel en cours).

La CI de `e04c7ca` a d'abord échoué sur le seul job « Rapport de bout en bout »: le téléchargement d'un artefact refusé cinq fois par GitHub. Tous les tests étaient verts, et la mise en ligne s'était faite (`/sante` rend `e04c7ca`). Le job a été relancé.

## Ce qui a été fait

- **Le contrat** (`packages/shared`): `AMONG.DUREE_DU_DEGUISEMENT_MS` (20 s), `REAPPARITION_DE_L_HABIT_MS` (45 s), `PORTEE_DE_L_HABIT_PX` (28), les écarts de l'habit au gong (250) et aux stations (120). Dans le bloc du mode, `habit` (sa place) et `deguises` (qui est déguisé, et pour combien de temps); dans l'état privé, `habit`. Le flux binaire les code sur deux bits nouveaux de l'octet des indicateurs du bloc (32 et 64). Trois sons provisoires: `habitPris`, `deguisementRevetu`, `deguisementPerdu`.
- **Le moteur** (`packages/sim/src/among.ts`, `etatAmong.ts`): à défaut de proie à portée, l'assassin tue le PNJ le plus proche, qui tombe en cadavre gris marqué `pnj`, et prend vingt secondes de déguisement, sans cumul, au prix de la recharge d'un vrai meurtre et sans point. Tuer une proie le démasque. Le premier habit se pose au lancement, après le tirage des places des stations, loin du gong et des stations, dans le morceau principal; une proie vivante sans habit le prend en passant dessus, le suivant revient 45 secondes de jeu plus tard. Une proie revêt son habit par le tir, qu'elle n'avait pas. Le déguisement s'use au temps de jeu, tombe à l'ouverture d'une tâche, à toute réunion, et à la mort, qui fait aussi perdre l'habit. Le cadavre d'un PNJ ne se signale pas. Un déguisé ne fait aucun pas. La foule se reforme au début de chaque tour. Trois événements: `pnjTue`, `habitPris`, `deguisement`.
- **Le serveur** (`packages/server/src/vues.ts`, `instantane.ts`): dans la vue d'un vivant, la foule passe sous alias et se range après les joueurs, dans l'ordre des alias; un déguisé qu'il n'a pas le droit de reconnaître y est un PNJ gris, sous l'alias de son identifiant et du rang de son déguisement. Il se voit lui-même, ses complices le voient, les fantômes voient tout, et le bloc du mode leur dit les déguisés qu'ils connaissent. L'habit ne va qu'aux proies vivantes dont le disque le touche, et aux fantômes. Les trois événements n'envoient aucune notification.
- **La page**: le bouton « Habit » (`hud/modele.ts`, `habitHud`; `hud/surcouche.ts`, `monterHabit`; `jeu.css`), absent sans habit ni déguisement, qui revêt par le tir et se vide en anneau avec les secondes; pour un assassin déguisé, il ne fait que montrer son temps. Le déguisé connu est gris, cerné de sa couleur, comme un fantôme (`rendu/scene.ts`). L'habit sur la carte, au trait sur un disque qui bat (`rendu/among.ts`, `habitPose`). Le katana se propose face à un PNJ, faute de proie, et l'éclaire (`among.ts`, `victimeAPortee`). Les sons, tirés de ce que la page reçoit (`sons/declencheurs.ts`). L'aide du mode, et le pictogramme `habit` (`interface/icones.ts`).
- **Vérifié dans un vrai navigateur**, dans de vraies parties à cinq, au bureau (1280 sur 720) et sur téléphone (375 sur 812): l'habit sur la carte, puis ramassé, puis revêtu, et l'assassin déguisé à côté du cadavre gris (`docs/design/etape-7-28/5-*.png`). L'outil de capture n'est pas commité.
- **Version 1.9.10**, sans note (les petites évolutions d'Among Ninjas restent en 1.9).

## Fichiers créés ou modifiés

- `packages/shared/src/among.ts`: les nombres du déguisement; `evenements.ts`: `habit` et `deguises` du bloc, `DeguiseVu`, l'habit de l'état privé; `flux.ts`: leur codage; `ressources.ts`: trois sons; `index.ts`: l'export; `version.ts`: 1.9.10.
- `packages/sim/src/among.ts`, `etatAmong.ts`: les règles et l'état.
- `packages/server/src/vues.ts`, `instantane.ts`: les vues, le bloc, l'état privé, les événements sans notification.
- `packages/client/src/hud/modele.ts`, `hud/surcouche.ts`, `page/styles/jeu.css`, `rendu/scene.ts`, `rendu/among.ts`, `among.ts`, `sons/declencheurs.ts`, `interface/composants/aide.ts`, `interface/icones.ts`.
- Tests créés: `packages/sim/src/among.deguisement.test.ts`, `packages/server/src/among.deguisement.test.ts`, `packages/client/src/deguisement.test.ts`, `tests/e2e/among-deguisement.spec.ts`. Modifiés: `packages/shared/src/flux.test.ts`, `packages/server/src/among.test.ts`.
- Documentation: la fiche, `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/mesures/charge-serveur.md` (section 35) et ses deux relevés `charge-serveur-7-28-*.json`, `docs/design/etape-7-28/` (planche et captures), ce handoff.

## Tests

- Ajoutés: moteur (le PNJ tué, son cadavre, la recharge, sans point; rien sans PNJ à portée ni en recharge; la proie avant le PNJ; sans cumul; démasqué au meurtre d'une proie; le terme des vingt secondes; muet; le cadavre qui ne se signale pas; la réunion qui démasque tout le monde; la foule reformée au tour suivant; l'habit posé loin du gong et des stations, reproductible, pris par une proie et pas par un assassin, une porteuse ou un fantôme, revenu ailleurs 45 secondes plus tard, revêtu, perdu à la mort, la tâche qui démasque, gardé d'un tour à l'autre); serveur (le déguisé est un PNJ gris sous alias pour une proie, rangé avec la foule, absent de la trame, d'un alias neuf à chaque déguisement; lui-même, ses complices et les fantômes le voient et savent son temps; une proie déguisée cachée aux assassins; l'habit aux seules proies qui le voient et aux fantômes; aucune notification); flux (aller et retour de l'habit et des déguisés, et l'octet inconnu toujours refusé); page (le modèle du bouton, le bouton, la teinte et le contour, l'habit dessiné, le katana face à un PNJ, les sons).
- Résultat: les 4 349 tests unitaires et d'intégration passent (projet `unitaires`; ceux de la base sont sautés en local, sans les clés de Neon). Types du code, des tests et du bout en bout, et linter: sans erreur. Bout en bout, la suite complète en local, trois à la fois: 108 au vert, 3 en échec sur un délai dépassé sous la charge du poste (Chasse, compte, diagnostic; deux au démarrage du navigateur), tous trois au vert rejoués seuls.
- Couverture de packages/sim: 99,85 pour cent des instructions (99,84 au handoff 7.27); `among.ts` à 100 pour cent des instructions.
- Empreinte des parties de référence (`tests/charge/empreinte.ts`): identique, jeu et flux, avant et après l'étape.
- Banc: section 35 de `docs/mesures/charge-serveur.md`. Among Ninjas 0,265 ms par battement à 40 PNJ (0,228 à l'étape 7.24), le prix des alias de la foule dans les vues; le fil ne change pas.

## Décisions et écarts au plan

1. **La foule sous alias** (réconciliation de la fiche): sans cela, un déguisé garderait un identifiant de joueur dans la trame. Le prix est mesuré (section 35).
2. **Revêtir l'habit passe par le tir** (`capturer`), qu'une proie n'avait pas: aucun message nouveau, et Espace comme le bouton y mènent déjà. La fiche prévoyait « l'entrée qui revêt l'habit, validée au serveur »: c'est celle-là, déjà validée.
3. **Aucune notification**: la fiche ne le disait pas. Une notification dirait qui se déguise; la page tire ses sons de ce qu'elle reçoit (l'habit de son état privé, son nom dans les déguisés du bloc).
4. **Le temps du déguisé voyage dans le bloc du mode**, pas dans son entité: un champ de plus au joueur aurait changé le codage de toutes les entités. Ses complices et les fantômes le reçoivent aussi, et la page les dessine comme lui, gris et cernés de leur couleur.
5. **Pour l'assassin déguisé, le bouton « Habit » ne fait que montrer son temps** (4C ne visait que la proie): son temps devait se voir, et le bouton du katana garde son rôle.
6. **L'habit est dessiné au trait**, dans la couche des flèches, au-dessus des personnages: la scène n'a pas de traits au sol, et une image de plus n'apportait rien.
7. **Le premier habit se pose dès le lancement**, ce que la fiche ne précisait pas.
8. **Version 1.9.10 au lieu de 1.9.9**: les meubles, hors étape, ont pris la 1.9.9.
9. **Le scénario de bout en bout ne fige aucun rôle**: la foule, peuplée avant le lancement, change le tirage d'une graine. L'assassin, page ou client du réseau, tue un PNJ, et une page proie témoigne.

## Après l'étape: les retours du porteur du projet, 16 octobre 2026

Après une partie en production, quatre retours, traités le jour même (version 1.9.11):

- **Les meubles devant l'avant-plan, sous la pluie.** L'avant-plan de Tokyo redessine le haut de la plupart des meubles, et masquait leur éclairage. Les meubles découpés du fond se posent désormais au premier plan, devant l'avant-plan, avec leur éclairage; la copie éteinte du décor, hors du cercle de vision, suit le même ordre. **La pluie tombe désormais au-dessus de tout, dans tous les modes**, personnages compris (choix du porteur du projet; le jeu d'origine la posait sur le fond). Le gong, la pierre, le générateur et les consoles restent sous les personnages: on se tient dessus ou tout autour. Captures `docs/design/etape-7-28/6-calques-*.png`. Fichiers: `packages/client/src/rendu/pixi.ts`, `rendu/among.ts` (`devant`).
- **Le bandeau « nouvelle version » qui insistait**, pendant la mise en ligne de `928b012`: la fenêtre entre le nouveau serveur et la promotion de la page. La page refusée pour sa version attend désormais que la nouvelle soit publiée, puis se recharge d'elle-même (`packages/client/src/nouvelleVersion.ts`, `version.json` écrit par `packages/client/scripts/empaqueter.ts`, texte dans `interface/modeles/lien.ts`; `docs/deploiement.md`, « Pendant la mise en ligne »).
- **Une tâche s'ouvre de tout le tour de son meuble.** Une station habillée d'un meuble s'ouvre dans son disque, ou à 30 pixels au plus du rectangle du meuble (`aLaStation`, `AMONG.MARGE_D_UN_MEUBLE_PX`, dans `packages/shared/src/among.ts`), la même règle pour le moteur (ouverture et maintien de la tâche), le bouton E et l'éclairage du meuble. Le rectangle se tire des objets du décor (`avecLesEmprises`), la place tirée emporte celui de son meuble, et le miroir le retourne.
- **Le déguisement de l'assassin dure sa recharge du meurtre, et cinq secondes de plus** (30 secondes à la recharge par défaut de 25), pour qu'il puisse frapper de nouveau, déguisé; celui d'une proie reste à vingt secondes (`dureeDuDeguisementMs`, `AMONG.MARGE_DU_DEGUISEMENT_DE_L_ASSASSIN_MS`). L'aide le dit.
- **L'habit**: le porteur du projet ne l'a pas vu en jouant une proie. Il reste caché, sans indication, par sa décision: on ne le trouve qu'en passant à portée de vue.

Tests ajoutés: `packages/shared/src/among.meubles.test.ts` (la portée, les emprises de Tokyo et leur miroir, les durées), la tâche ouverte et gardée de l'autre côté d'un meuble (`packages/sim/src/among.deguisement.test.ts`), l'attente de la nouvelle version (`packages/client/src/nouvelleVersion.test.ts`). Les 4 361 tests unitaires et d'intégration passent; types et linter sans erreur; les scénarios du rendu, d'Among Ninjas et du lien passent (`lien.spec.ts` rejoué seul, fragile sous la charge comme au handoff 5.15).

## Problèmes connus et dette

- Les trois sons du déguisement sont provisoires, à remplacer par ceux du porteur du projet (`packages/shared/src/ressources.ts`).
- Le pilote du bout en bout frappe dès qu'un PNJ est à portée: une proie plus proche passe avant, et c'est elle qui meurt, ce qu'on voit sur la capture de l'assassin déguisé (le cadavre orange). C'est la règle, pas un défaut.
- Rien de neuf sur les dettes des étapes 7.20 à 7.27.
- **Parties en production** (remarque du porteur du projet au début de l'étape): plusieurs parties à plusieurs joueurs ont bien fonctionné. La clôture de l'étape 5.15 demande encore de vérifier dans Grafana que le tableau les montre, et de faire sonner chaque alerte une fois (handoff 5.15). L'étape 5.9 attendait une partie à plusieurs avec un compte: à confirmer par le porteur du projet.

## Prochaine action exacte

La main au porteur du projet, pour choisir la suite: `7.26` (d'autres tâches courtes), `7.25` (l'appropriation, après une partie d'essai), la clôture de `5.15` (Grafana), ou les sons du déguisement. Lui proposer une partie d'essai du déguisement.

## Étape suivante

Fiche à lire: celle que le porteur du projet choisira, `docs/plan/etape-7-26.md` à rédiger au début de l'étape selon le cas de repli du PROTOCOLE si c'est `7.26`.
