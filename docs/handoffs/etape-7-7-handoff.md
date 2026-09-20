# Handoff - Étape 7.7 Objets du Tactique

Date: 20 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Donner au mode Tactique six objets qui jouent sur son arme, et le rendre plus lisible et plus serré à l'écran: les charges affichées sous le joueur, une vue plus proche sur ordinateur, une minimap limitée aux alentours.

## Ce qui a été fait

- **Fiche rédigée** selon le cas de repli du PROTOCOLE, après quatre décisions du porteur du projet prises sur maquettes (`docs/plan/etape-7-7.md`, commit `be8529a`). Les quatre planches sont dans `docs/design/etape-7-7/`.
- **Six objets, réservés au Tactique.** Trois bonus (Rafale, 5 s, un tir ne coûte plus de charge; Recharge rapide, 10 s, une charge en 1,5 s; Visée large, 10 s, 120 degrés sur 150 pixels) et leurs trois contraires, qui frappent les autres joueurs (Tir unique, Recharge lente, Visée étroite). Un bonus et son contraire s'annulent tant que les deux durent.
- **Les effets vivent dans l'état tactique du joueur**, comme ses charges depuis l'étape 7.1: une partie d'un autre mode n'en porte aucune trace, et leur groupe de réglages n'existe que dans une partie Tactique.
- **Les six bonus tirent leur chance à la moitié de leur taux**: deux fois plus de natures, autant de bonus sur la carte. Les malus font toujours un seul tirage, puis choisissent leur nature parmi les six.
- **Les charges se lisent sous le ninja**, pour soi seul: un arc de cinq points, la charge qui revient qui se remplit, les charges gelées barrées sous Tir unique, et un symbole pour l'effet en cours. Le bouton « Capturer » garde ses points, puisque c'est lui qui tire sur téléphone.
- **La vue du Tactique est plus proche sur ordinateur**: 500 pixels de carte en hauteur au lieu de 900, et la minimap ne montre que les joueurs à moins de 900 pixels, avec le disque de sa portée.
- **Six icônes dessinées en SVG**, une couleur par paire, au format des planches d'objets du jeu d'origine.
- **Trois défauts corrigés** (règle 7), détaillés plus bas.
- **Vérifié dans le navigateur de Claude Code** (serveur local): création d'une partie Tactique, groupe de réglages présent dans ce mode seulement, partie lancée, arc sous le ninja, vue plus proche, minimap limitée; et par un scénario de bout en bout qui ramasse un bonus du mode dans les deux cadrages.

### Mesure, banc du battement, avant et après

Douze joueurs, carte Tokyo, même machine. Avant: commit `f2165ac`.

| Faux ninjas | Mode     | Avant, ms | Après, ms | Avant, octets | Après, octets |
| ----------: | -------- | --------: | --------: | ------------: | ------------: |
|         150 | Tactique |     0,438 |     0,450 |           481 |           490 |
|         300 | Tactique |     1,050 |     1,045 |           810 |           814 |
|         150 | Horde    |     0,405 |     0,406 |           440 |           440 |
|         300 | Horde    |     1,015 |     1,045 |           779 |           779 |

Les écarts en millisecondes sont dans le bruit d'une exécution à l'autre. Détail: section 19 de `docs/mesures/charge-serveur.md`.

## Fichiers créés ou modifiés

Commit `be8529a`: `docs/plan/etape-7-7.md` et `docs/design/etape-7-7/` (créés), `docs/plan/ROADMAP.md`.

Commit `0c9058d`, le contrat et le moteur:

- Contrat: `packages/shared/src/constantes.ts` (catalogue des six objets, leurs valeurs, les visées, les natures d'objet élargies), `reglages.ts` (groupe `objetsTactiques`, présent en Tactique seul), `validation.ts`, `evenements.ts`, `flux.ts` (codes ajoutés en fin de liste), `ressources.ts` (icônes SVG).
- Moteur: `packages/sim/src/objetsTactiques.ts` (créé), `tactique.ts` (cône effectif, recharge à vitesse variable, Rafale, gel des charges), `objets.ts` (apparition et ramassage), `etat.ts`.
- Serveur: `packages/server/src/instantane.ts` (cône du tir), `ServeurSocket.ts` (partie rapide).
- Ressources: `assets/objets/*.svg` (six créés).
- Page: libellés, couleurs, textes des malus, et le fait qu'un effet sache s'il agit sur nous.

Commit `0e09911`, la page et la documentation:

- Rendu: `packages/client/src/rendu/charges.ts` (créé), `scene.ts`, `pixi.ts` (calque de l'arc), `camera.ts` et `apparence.ts` (hauteur de vue), `boucle.ts`.
- HUD et écrans: `hud/modele.ts` et `hud/surcouche.ts` (minimap limitée), `interface/modeles/reglages.ts` et `interface/composants/reglages.ts` (groupe du mode), `interface/modeles/salon.ts` (récapitulatif), `interface/composants/aide.ts`, `interface/ecrans/jeu.ts`, feuilles de style.
- Règle commune: `packages/shared/src/objetsTactiques.ts` (créé).
- Tests: `packages/sim/src/objetsTactiques.test.ts`, `packages/client/src/rendu/charges.test.ts`, `packages/client/src/hud/modele.tactique.test.ts` (créés), plus les tests touchés; `tests/e2e/tactique.spec.ts` et `tests/e2e/harnais/parcours.ts` (scénario du ramassage), `tests/e2e/rendu-couleurs.spec.ts` et `rendu-pluie.spec.ts` (nouveau champ de scène).
- Documentation: `docs/design/README.md` (dix entrées), `docs/mesures/charge-serveur.md` (section 19) et ses deux fichiers de chiffres, `docs/plan/etape-7-7.md` (réconciliation), `docs/plan/ROADMAP.md`, `assets/README.md`.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: chaque objet ramassé et son effet, le cumul de deux bonus, la relance d'un malus, les autres joueurs frappés et le ramasseur épargné, l'annulation de chaque paire, les recharges rapide et lente sans dépendre du découpage du temps, le gel et le retour des charges du Tir unique, la Rafale sans coût qui garde la seconde entre deux captures de joueur, les cônes large et étroit bornes comprises, l'apparition à la moitié des taux et aucun objet du mode ailleurs; l'arc et ses états; la hauteur de vue par mode; la minimap filtrée; le groupe de réglages proposé en Tactique seul; le récapitulatif du salon; un scénario de bout en bout qui ramasse un bonus du mode.
- Résultat: **2 477 tests Vitest** au vert (2 421 au handoff 5.7); types des paquets, des tests et du bout en bout compilés en appelant tsc directement; linter et formatage verts. Bout en bout en local: **46 scénarios sur 46** (44 au handoff 5.7, plus le nouveau dans les deux cadrages).
- Couverture de `packages/sim`: **99,85 pour cent** (99,84 au handoff 7.5, mesure sur sim et shared).
- État de la CI: **`0e09911` verte** (exécution 35472414981), « Types, linter et tests », « Bout en bout » et « Mise en ligne »: les objets du Tactique sont en production.

## Décisions et écarts au plan

Dix entrées au journal de `docs/design/README.md`. Écarts à la fiche, détaillés dans sa section de réconciliation:

1. **Le Tir unique gèle vraiment les charges au-delà d'une** (micro-décision 6 révisée): un simple plafond ne limitait rien, la charge dépensée étant aussitôt remplacée par une de la réserve.
2. **La règle d'annulation et la visée vivent dans `packages/shared`**, parce que la page doit dessiner le cône que le moteur appliquera.
3. **L'arc passe au-dessus des personnages et sous le premier plan**, décision du porteur du projet à la recette: il disparaît sous un toit ou un câble, comme le ninja.
4. **Le format du flux ne change pas de version**: les nouvelles natures prennent des codes ajoutés en fin de liste.

Trois défauts anciens corrigés en chemin (règle 7):

- **Vision floue et Vision négative ne troublaient plus l'écran de leur victime** depuis la réécriture: aucun code ne posait de filtre. Le terrain seul est de nouveau flouté ou passé en gris, aux valeurs du jeu d'origine, le HUD restant net.
- **Un malus subi de nouveau voyait sa jauge s'allonger**, alors que le moteur repart de la durée pleine.
- **Le formulaire des réglages restait bloqué** devant une partie dont le mode retire un groupe: il lisait des champs vides. Il montre désormais la valeur par défaut.

## Problèmes connus et dette

- **L'équilibre des six objets n'a pas été joué**: les durées et les taux viennent des décisions du 19 septembre, pas d'une partie à plusieurs. À reprendre après une vraie partie Tactique.
- **La vue de 500 pixels n'a été jugée que sur maquette et sur une partie solo**: à confirmer à plusieurs, où l'on cherche les autres joueurs.
- **Les charges des adversaires restent publiques dans le flux** et ne s'affichent plus nulle part: si le porteur du projet veut un jour les revoir, la donnée est là.

Repris du handoff 5.7, inchangé: déclarer `ninja.dendrolag.fr` à la Google Search Console et à Bing Webmaster Tools; relire le titre de la page et l'accroche de la présentation statique; la densité de 300 et 500 PNJ à jouer; l'or du x4 proche de celui des Black Ninjas; l'équilibre de la prime de la Horde; le compteur de combo qui tombe au battement près; les textes de l'aide et du rappel du salon à relire. Le point sur un vrai téléphone reste ouvert.

## Prochaine action exacte

Deux demandes du porteur du projet, faites pendant cette étape, à traiter dans une conversation neuve chacune:

1. **Étape `7.8`, le style des repères de localisation.** Les quatre triangles rouges sont remplacés par **l'onde qui se referme**: deux anneaux à la couleur du joueur qui se resserrent sur son ninja, rendu A des maquettes, choisi par le porteur du projet le 20 septembre 2026 sur la planche `docs/design/etape-7-8/1-reperes.png`. Trois points restent à trancher en ouvrant l'étape: la couleur en Chasse, où les traqueurs partagent une couleur; le rayonnement, puisque les repères passent dans le calque qui rayonne; et la durée, inchangée a priori (2 s à la demande, 3,5 s à l'apparition et après une capture). Fiche à rédiger selon le cas de repli du PROTOCOLE.
2. **Étape `8.1`, l'étude des structures de carte.** Le porteur du projet a choisi une étude avant tout prototype: ce qu'est techniquement une carte (image de collision, seuil de luminosité, fond et avant-plan, vignette, dimensions), les contraintes du jeu à plusieurs, trois ou quatre archétypes de structure de tailles différentes, et de quoi les juger. Le rendu visuel final serait confié au graphiste de Tokyo. Point de départ: `docs/mesures/etude-grandes-cartes.md`.

## Étape suivante

Fiche à lire: celle de l'étape ouverte, une fois rédigée.
