# Handoff - Étape 7.9 L'Évadé

Date: 25 septembre 2026
Auteur: session Claude Code
Statut: terminée (sous réserve de la CI et de la mise en ligne, vérifiées après la poussée, et de la validation des textes par le porteur du projet)

## Objectif de l'étape

Faire apparaître une fois par partie un ninja rayé rouge et blanc, l'Évadé, qui fuit les joueurs un peu plus vite qu'eux. Qui l'attrape, ou l'élimine en Massacre, porte jusqu'à la fin un x2 sur son score, qu'un autre joueur peut lui voler en le capturant.

## Ce qui a été fait

- **Deux réponses du porteur du projet en ouvrant l'étape**: l'Évadé apparaît aussi dans le Massacre en solo, et le x2 double indirectement les récompenses de progression. Consignées dans la fiche (décisions 11 et 12).
- **Le moteur** (`packages/sim/src/evade.ts`). Le moment d'apparition est tiré au lancement, entre le quart et les trois quarts de la partie, seulement si le réglage est actif et le mode l'admet. L'Évadé apparaît à l'écart des joueurs, fuit ceux à moins de 300 pixels en essayant seize caps sans mur, erre sinon, longe les murs, et s'en va au bout de 45 secondes. Il va à 165 pixels par seconde. Il s'attrape au contact en Horde et en Équipes, d'un tir en cône en Tactique (qui coûte une charge), d'un coup de katana en Massacre (sans points ni combo). Le x2 double le score déduit du porteur, et en Équipes celui de toute son équipe; il passe à qui capture ou tue le porteur, et un Black Ninja le détruit; il part avec un porteur qui quitte la partie.
- **Une mesure, puis une décision du porteur du projet**: des poursuivants sans bonus qui foncent droit sur l'Évadé ne l'attrapent qu'en le coinçant (seul: 6 sur 20 sur Tokyo, 0 sur 20 sur Spirit & Time). Un essoufflement le rendait prenable partout; le porteur du projet a gardé la fuite sans répit, un trophée rare. L'essai a été retiré du code.
- **Le contrat**: le réglage `evade`, actif par défaut, retiré de la Chasse; l'Évadé dans le flux comme un nouveau type d'entité, ajouté en fin de liste; le x2 dans l'octet des indicateurs d'un joueur; une notification `evade` adressée à tous (apparu, attrapé, volé, perdu, enfui); le x2 au classement final et au classement des équipes.
- **La page**: l'Évadé dessiné sur les sprites du jeu, corps rayé par bandes de deux lignes (un calque fabriqué au chargement), sous un halo blanc cerné de rouge; le porteur avec un anneau rayé qui tourne et un badge « x2 »; le badge au classement du HUD et à l'écran de fin; ses annonces en grand titre rayé (étape 4.6); deux sons existants; l'interrupteur dans les réglages et une ligne au récapitulatif du salon, hors Chasse; une section dans l'aide.
- **Vérifié dans un vrai navigateur**, dans une vraie partie à deux joueurs, l'Évadé et le x2 posés par un outil jetable: planches 2 à 4 de `docs/design/etape-7-9/`.

## Fichiers créés ou modifiés

- `packages/sim/src/evade.ts` et `evade.test.ts` (créés): le comportement et ses 27 tests.
- `packages/sim/src/etat.ts`: l'état de l'Évadé, ses cinq événements, le porteur qui quitte la partie. `moteur.ts`: le battement, le lancement, le champ `attraperLEvade` du jeu de règles. `contacts.ts`: la capture au contact. `capture.ts`, `massacre.ts`, `bots.ts`: la cession et la perte du x2, la capture d'un tir et d'un coup. `tactique.ts`: le tir. `score.ts`: le x2 au score. `index.ts`: les exports.
- `packages/sim/src/partie.test.ts` et son instantané: la partie de référence reste celle d'avant, l'Évadé coupé; une seconde référence avec lui. `massacre.test.ts`, `modes.test.ts`: le tirage du lancement.
- `packages/shared/src/constantes.ts` (`EVADE`, `MODES_AVEC_EVADE`), `reglages.ts`, `validation.ts`, `evenements.ts`, `flux.ts`, `equipes.ts`, `index.ts`, et les tests de `flux`, `reglages`, `validation`, `equipes`.
- `packages/server/src/instantane.ts`, `ServeurSocket.ts`, et `instantane.test.ts`, `ServeurSocket.evade.test.ts` (créé).
- `packages/client/src/rendu/`: `evade` dans `scene.ts`, `pixi.ts`, `apparence.ts` (`APPARENCE_EVADE`), `recoloration.ts` (`rayerLeCorps`), `textures.ts` (`adresseRayee`), et leurs tests.
- `packages/client/src/`: `annonces.ts`, `faits.ts`, `client.ts`, `sons/declencheurs.ts`, `hud/modele.ts`, `hud/surcouche.ts`, `interface/composants/annonces.ts`, `aide.ts`, `interface/modeles/fin.ts`, `salon.ts`, `reglages.ts`, `interface/ecrans/fin.ts`, et leurs tests.
- `packages/client/page/styles/`: `composants.css` (grand titre rayé), `jeu.css` (badge du HUD), `ecrans.css` (badge de fin).
- `tests/e2e/evade.spec.ts` (créé), `tests/charge/empreinte.ts` (option `--sans-evade`), `tests/e2e/rendu-couleurs.spec.ts`, `rendu-miroir.spec.ts`, `rendu-pluie.spec.ts` (le champ `marques` de leurs scènes d'essai).
- `docs/mesures/charge-serveur.md` (section 20) et `charge-serveur-7-9-horde.json` (créé).
- `docs/design/etape-7-9/2-realise-apparition.png`, `3-realise-porteur.png`, `4-realise-zooms.png` (créés).
- `CLAUDE.md`: précisions datées aux comportements à préserver 1 et 2.
- `docs/plan/etape-7-9.md` (décisions 11 et 12, réconciliation), `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/handoffs/etape-4-6-handoff.md` (CI), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: 27 dans le moteur (tirage, apparition, départ, fuite, vitesse, bonus de vitesse, bord de carte, zones, PNJ, capture dans les quatre modes, x2 au score de chaque mode, cession, perte, départ du porteur); 4 dans le flux, 1 aux réglages, 1 à la validation, 1 au classement des équipes; 5 dans la projection; 4 à travers le vrai serveur, dans une arène fermée (Horde, Tactique, Massacre, Chasse sans Évadé), stables sur 8 passages; 3 sur la scène, 1 sur les rayures, 4 sur les annonces, 1 sur le grand titre rayé, 2 sur le HUD, 1 sur la surcouche, 1 sur la fin, 1 sur les réglages, 1 sur les sons; le scénario de bout en bout `evade.spec.ts`, dans les deux cadrages.
- Résultat: **2 556 tests unitaires au vert**, types, linter et formatage verts. **Bout en bout: 55 scénarios sur 55 en local**, bureau, mobile et banc de rendu, après correction de trois scénarios de rendu (point 4 des décisions ci-dessous).
- Couverture de packages/sim: `evade.ts` est couvert par ses propres tests; la couverture du paquet ne baisse pas (vérifiée par la CI).
- **Empreinte des parties de référence, Évadé coupé** (`--sans-evade`): identique à l'octet à celle du handoff 8.5, jeu et flux, pour les quatre parties.
- **Nouvelles empreintes, Évadé actif** (réglages par défaut):
  - 150 bots, 12 joueurs, murs: jeu `e86caa22fbda88fa712f722b10bd1da0dca2589671c41cef6c1bcb264cb143cf`, flux `02cd2911f067f480ffb2fe6c788e10fb8b382f47e0ca7db769098511c431f4ed`
  - 50 bots, 12 joueurs, murs: jeu `176b7b88a6df23b4f5556681024e79c0f6f007ef80f3ad95c78c743eb8209df7`, flux `7708fc0873ff79530fffe73953ed646311e56dc116a98ebb946a1ddd9852decf`
  - 300 bots, 12 joueurs, sans mur: jeu `f2fd81f6d10cc63b6375326b2de4a67fb58a2d04ff1422a32f6c88fba857cf00`, flux `c3541fe6575212f131cbef0e5009aee3931f40156d9a74c21945565f761dbd44`
  - 150 bots, 2 joueurs, murs: jeu `6eb2d84ef3411a54b5bf0dffc984ced511faba22f31d0a6edcc77296797f763d`, flux `db1254e2b0433b30dd7bb9e62c4a4f1f3a0d437fcebfd72bb477e1f30ef1b2cb`
- Banc de charge: coût inchangé, section 20 de `docs/mesures/charge-serveur.md`.
- État de la CI: voir le commit de clôture.

## Décisions et écarts au plan

1. **Écart de méthode, demandé par le porteur du projet**: l'étape s'est faite dans la conversation qui l'a décidée, à la suite de l'étape 4.6, et avant `8.7`.
2. **La fuite reste sans répit**, sur décision du porteur du projet après mesure (réconciliation, point 1).
3. Les autres écarts de construction sont à la section « Réconciliation » de la fiche: seize caps, la capture au contact dans `contacts.ts`, le x2 sur le joueur et non sur sa ligne, le badge de fin posé par la feuille de style, les annonces, les sons, les tests d'intégration dans une arène, le scénario de bout en bout sans capture, aucun test propre à la base.
4. **Trois scénarios de rendu composent leur scène à la main** (`rendu-couleurs`, `rendu-miroir`, `rendu-pluie`): la scène a un champ de plus, `marques`, et leurs scènes d'essai l'ont reçu, comme elles avaient reçu `indicateur` à l'étape 7.7. Sans lui, le dessin échouait et les douze scénarios attendaient en vain.

## Problèmes connus et dette

- **Les textes des annonces de l'Évadé et des descriptions de bonus (étape 4.6) restent à valider** par le porteur du projet, à la recette.
- **L'Évadé est rare à attraper sur une carte ouverte**, voulu. Si la recette le trouve imprenable, le levier mesuré est l'essoufflement (réconciliation, point 1), pas la vitesse.
- **Les scénarios Tactique au pouce échouent par intermittence en CI** (étape `8.7`, inchangé).

## Prochaine action exacte

**Au porteur du projet**: jouer une partie à plusieurs pour juger l'Évadé et le HUD, et valider les textes. **À la session suivante**: l'étape `8.7`, les scénarios Tactique au pouce.

## Étape suivante

Fiche à lire: `docs/plan/etape-8-7.md`, à rédiger au début de l'étape. L'entrée correspondante est à la section 3 de `docs/plan/ROADMAP.md`.
