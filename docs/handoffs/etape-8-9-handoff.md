# Handoff - Étape 8.9 La Station lunaire, de jour ou de nuit, et son vaisseau qui la survole

Date: 3 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Une quatrième carte jouable, la Station lunaire, avec un fond de jour et un fond de nuit au choix de l'hôte, et un vaisseau qui arrive au-dessus de la carte, la survole lentement toute la partie, puis repart, avec son ombre portée en parallaxe sur le fond de jour.

## Ce qui a été fait

- **Fiche rédigée selon le cas de repli du PROTOCOLE** (`docs/plan/etape-8-9.md`), commitée avant l'exécution, avec le diagnostic du début d'étape et une section de réconciliation.
- **La carte `station`**, 2000 sur 1524, images à la taille de la carte, livrées par le porteur du projet et dessinées par 2-Minute Tabletop (licence CC BY-NC 4.0). Pas d'avant-plan fixe, pas de badge « Prototype ». Plafond de 190 faux ninjas. Migration de la base: la valeur `station` entre dans l'énumération des cartes.
- **Les douze critères tenus**: un seul morceau, 50,9 pour cent de sol, 47,0 pour cent tenable, 100 pour cent du jouable hors de la bande d'apparition, dixième le plus serré à 34 pixels de dégagement, traversée en 12,2 secondes (le seuil est 12), détour 1,07, collision superposée au décor au pixel près, images aux proportions de la carte.
- **Défaut trouvé et fermé sur la carte**: un trait de mur de cinq pixels, au bord du toit, laissait des places tenables coupées du reste, où une apparition pouvait enfermer un ninja. Les murs de moins de neuf pixels sont épaissis de deux pixels de chaque côté (2 596 pixels ajoutés, invisibles). Au pixel près, la carte est d'un seul tenant dans les deux sens.
- **Le même défaut sur Tokyo, dans le moteur**: onze poches au pixel près, neuf dans le miroir, depuis le jeu d'origine. Planifié comme étape `8.10` (règle 7).
- **Le réglage `nuit`**, sur le modèle de la pluie: le jour par défaut, proposé seulement sur une carte qui a un fond de nuit, dit au récapitulatif du salon (« Station lunaire · Nuit »). Le rendu charge le fond de nuit à la place du fond.
- **La graine du décor**: tirée par la room à chaque lancement, envoyée avec `partieLancee` (nouveau contrat `LancementDePartie`), au lancement comme à qui entre ou revient en cours de partie; la page la retient. La graine du moteur ne sort toujours pas du serveur.
- **Le vaisseau** (`packages/client/src/rendu/vaisseau.ts`, fonctions pures): course tirée de la graine, arrivée par un point du pourtour tiré au hasard, survol à 20 pixels par seconde environ sur une spline de Catmull-Rom centripète entre des points tirés au-dessus de la station, départ par un autre côté dans les vingt dernières secondes, vitesse sans saut aux raccords; cap selon la course (l'avant de l'image en bas). Parallaxe d'altitude (15 pour cent), ombre au sol poussée par le soleil, de jour seulement, retournée en miroir; vaisseau assombri de nuit; translucide à 40 pour cent au-dessus de notre propre ninja. Réglages dans `VAISSEAU` (`rendu/apparence.ts`).
- **Le temps restant se lisse** entre deux battements dans la vue lissée, pour que le vaisseau glisse.
- **Version 1.6.0** et la note 1.6 (« La Station lunaire »: une nouvelle carte, de jour ou de nuit, un vaisseau).
- **Crédits**: une ligne de plus, « Avec l'aimable participation de 2-Minute Tabletop pour la carte Station lunaire, sous licence CC BY-NC 4.0. », avec un lien vers la page de l'auteur et un vers la licence; une participation peut désormais porter une licence.
- **Défaut de documentation corrigé** (règle 7): au ROADMAP, les tests et le résultat de 8.8 étaient rangés sous l'entrée 8.9.
- **Vu dans un vrai navigateur**, serveur local sans base: partie de jour (le vaisseau arrive par le bas, avant en tête, puis survole notre ninja en s'effaçant, l'ombre décalée au sol) et partie de nuit (vaisseau assombri, sans ombre, arrivé par un autre chemin). Captures: `docs/design/etape-8-9/`.

## Fichiers créés ou modifiés

- `assets/cartes/station/` (créé): `background.png` (jour), `background-night.png`, `collision.png` (murs fins épaissis), `spaceship.png`, `preview.png` (carré central du fond de jour, 120 sur 120).
- `packages/shared/src/constantes.ts`: la carte, son enregistrement, son plafond. `ressources.ts`: `cheminAvantPlan`, `cheminFondDeNuit`, `cheminVaisseau`. `reglages.ts`: `nuit`. `validation.ts`: sa validation. `evenements.ts`: `LancementDePartie`, `partieLancee` le porte. `version.ts`: 1.6.0. `index.ts`: exports. Tests: `constantes.test.ts`, `ressources.test.ts`, `validation.test.ts`.
- `packages/server/src/GameRoom.ts`: `graineDuDecor`, tirée au lancement (`tirerGraineDuDecor` injectable). `instantane.ts`: `lancementDe`. `ServeurSocket.ts`: l'envoie aux trois endroits où part `partieLancee`. `migrations/0012_carte_station.sql` et `meta/` (créés). Tests: `GameRoom.test.ts`, `ServeurSocket.test.ts` (graine au lancement, la même au retardataire), `ServeurSocket.options.test.ts` (nuit, 190 faux ninjas tenables), `terrain.test.ts` (empreintes, retournement pixel à pixel, connexité de la Station).
- `packages/client/src/rendu/vaisseau.ts` et son test (créés). `apparence.ts`: `VAISSEAU`. `pixi.ts`: fond de nuit, avant-plan facultatif, vaisseau et ombre, préchargement. `scene.ts`: `VaisseauScene`, `construireScene` reçoit la course. `boucle.ts`: tire la course une fois par partie. `interpolation.ts`: `tempsRestantMs` lissé. `actions.ts`, `etat.ts`, `reduction.ts`, `client.ts`: la graine du décor. `principal.ts`, `interface/ecrans/jeu.ts`: le réglage de nuit vers le rendu. `interface/modeles/reglages.ts`, `cartes.ts`: l'interrupteur Nuit, le récapitulatif, la présentation. `interface/modeles/credits.ts`, `composants/credits.ts`: la licence. `interface/modeles/notesDeVersion.ts`: la note 1.6. Tests mis à jour en conséquence, dont l'argument de `partieLancee` dans une douzaine de fichiers.
- `tests/e2e/rendu-station.spec.ts` (créé).
- Mesures: `docs/mesures/mesurer-les-cartes.mjs` (la carte dans sa table), `cartes.json`, `charge-serveur.md` (section 25), `charge-serveur-8-9-station.json` (créé).
- Documentation: fiche 8.9 (créée), ROADMAP (8.9 faite, 8.10 planifiée, défaut corrigé), journal de conception, `assets/README.md`, compétence `conception-de-cartes` (SKILL.md et fiche de commande), ce handoff, captures `docs/design/etape-8-9/`.

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/sim`.

## Tests

- Ajoutés: chemins et fichiers de la carte; réglage de nuit (validation, formulaire, récapitulatif, salon réel); graine du décor (room, socket, retardataire, réduction, client); course du vaisseau (même graine même chemin, vingt graines vingt chemins, quatre côtés d'entrée, hors de vue avant et après, au-dessus pendant le survol, vitesse de survol, ralentissement et accélération sans saut, pas de saut d'une image à l'autre, cap selon la course, partie courte, partie sans durée); parallaxe, ombre et miroir, rotation, opacité; temps lissé; scène; crédits et licence; note 1.6. Serveur: empreintes des murs, miroir retourné, connexité, 190 faux ninjas tenables. Bout en bout (`rendu-station.spec.ts`, ordinateur et téléphone): la nuit assombrit le fond, le vaisseau se dessine où la scène le place de jour et de nuit, son ombre tombe de jour et pas de nuit, il recule de 115 pixels d'écran quand le sol en recule 100.
- Résultat: 3 452 tests unitaires et d'intégration au vert en local, types, linter et formatage compris; tests de la base sautés en local, joués par la CI. Bout en bout: `rendu-station` 10 sur 10 en local, et toute la suite au vert en CI.
- Banc de charge: 0,72 ms par battement à 190 faux ninjas sur la Station, 0,67 pour Tokyo au même nombre (section 25).
- Couverture de packages/sim: inchangée, il n'est pas touché.
- Empreintes des parties de référence: inchangées par construction, elles se jouent sur Tokyo et le moteur n'est pas touché.
- État de la CI: verte sur `2939c29` (exécution 37116531076): types, linter et tests, bout en bout, mise en ligne. Le serveur de production répond sur ce commit (`/sante`).

## Décisions et écarts au plan

Détail dans la section « Réconciliation » de la fiche. En bref: collision retouchée (murs de neuf pixels au moins); défaut du moteur planifié en 8.10; course du vaisseau tenue par la boucle; crédits avec licence. Choisis par cette session et soumis au porteur du projet: le jour par défaut, le réglage tenu par l'hôte et non par chaque joueur, l'identifiant `station`, l'absence de badge « Prototype », le plafond de 190, le texte de la note 1.6 et de la ligne des crédits, et les réglages du vaisseau (70 pour cent de l'image, 20 pixels par seconde, 15 pour cent d'altitude, ombre à 35 pour cent décalée de 110 et 80 pixels, 40 pour cent d'opacité au-dessus de notre ninja).

## Problèmes connus et dette

- **Étape 8.10 planifiée**: une apparition peut tomber dans une poche close au pied d'un mur de moins de neuf pixels; onze poches sur Tokyo, neuf dans son miroir.
- **Licence CC BY-NC 4.0**: le décor de la Station ne peut servir à aucun usage commercial. À garder en tête si le jeu devait un jour rapporter de l'argent.
- **À juger en jouant**: la taille du vaisseau et sa vitesse, la cachette qu'il fait aux autres joueurs, la traversée de la carte, la plus courte du jeu (12,2 secondes).
- Rien d'autre.

## Prochaine action exacte

Exécuter l'étape `8.10`, les apparitions dans une poche close, planifiée au ROADMAP (section 4). Sa fiche n'existe pas: la rédiger au début de l'étape selon le cas de repli du PROTOCOLE, à partir de l'entrée du ROADMAP et de la section 2 de la compétence `conception-de-cartes`. Au porteur du projet, en parallèle: relire la note 1.6 et la ligne des crédits, jouer la Station de jour et de nuit, juger le vaisseau.

## Étape suivante

Fiche à lire: `docs/plan/etape-8-10.md`, à rédiger au début de l'étape.
