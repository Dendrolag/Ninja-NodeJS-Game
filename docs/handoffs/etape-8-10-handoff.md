# Handoff - Étape 8.10 Les apparitions dans une poche close

Date: 3 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Qu'une apparition ne tombe jamais hors du morceau principal de la carte, sans changer la façon dont les ninjas frôlent les murs.

## Ce qui a été fait

- **Fiche rédigée selon le cas de repli du PROTOCOLE** (`docs/plan/etape-8-10.md`), commitée avant l'exécution, avec le diagnostic chiffré et une section de réconciliation.
- **Le morceau principal d'une carte**: calculé une fois, à la construction (`carteDepuisPixels`, et `creerCarteCollisions` quand une règle de murs est donnée), un bit par point entier, dans le nouveau champ `morceauPrincipal` de `CarteCollisions`. C'est le plus grand ensemble de points tenables reliés par un côté: chaque pas d'un pixel est un trajet que le moteur accepte, si bien que tout le morceau est atteignable. À égalité, le premier dans l'ordre de lecture. Une carte sans mur n'en porte pas.
- **`dansLeMorceauPrincipal(carte, position)`**: une place à coordonnées réelles y appartient si elle tient et rejoint, par un trajet tenable, l'un des quatre points entiers qui l'entourent, pris dans le morceau.
- **`positionDApparition` et sa spirale de secours l'exigent**. Toutes les apparitions du moteur passent par là: joueurs, retour après capture, faux ninjas, Black Ninjas, Évadé, bonus, mines de zone, morts du Massacre, fumée.
- **Le déplacement ne change pas**: `positionTenable` et `trajetTenable` sont intacts.
- **Calcul rapide**: copie des murs à un octet par pixel, décalages du contour précalculés en indices (avec, dans les 64 premières colonnes, des décalages propres à chaque colonne, la virgule flottante y décalant le point tourné vers le haut), parcours sans test de bord. 50 à 150 ms par carte.
- **Le serveur précharge toutes les cartes au démarrage** (`ChargeurDeTerrain.prechargerTout`, appelé dans `principal.ts` et dans le harnais de bout en bout), pour qu'aucune partie en cours ne s'arrête le temps de décoder une carte. Deux secondes de plus au démarrage et au réveil, noté dans `docs/deploiement.md`.
- **Défaut corrigé** (règle 7): `ServeurSocket.options.test.ts` préchargeait trois cartes sur quatre, la Station oubliée à l'étape 8.9; il décodait la Station au milieu d'un test, et sous la mesure de couverture dépassait son délai d'attente. Il précharge maintenant tout.
- **Version 1.6.1**, sans note.
- **Documentation**: compétence `conception-de-cartes` (section 2 point 4, section 9 point 6) et sa fiche de commande, ROADMAP (8.10 faite), journal de conception, `docs/deploiement.md`.

## Fichiers créés ou modifiés

- `packages/sim/src/collisions.ts`: `morceauPrincipal`, son calcul (`pointsTenables`, exportée pour ses tests seulement, `parcourirMorceau`, `calculerMorceauPrincipal`), `dansLeMorceauPrincipal`; `marquerMur` renommée `allumerBit`, puisqu'elle sert aux deux champs. `index.ts`: export de `dansLeMorceauPrincipal`.
- `packages/sim/src/etat.ts`: `placeDApparition`, utilisée par le tirage et par la spirale.
- `packages/server/src/terrain.ts`: `prechargerTout`. `principal.ts`: l'appelle avant d'ouvrir le port.
- `tests/e2e/harnais/serveur-de-jeu.ts`: précharge comme le vrai serveur.
- `packages/shared/src/version.ts`: 1.6.1.
- Tests: `packages/sim/src/collisions.test.ts`, `etat.test.ts`, `packages/server/src/terrain.test.ts`, `ServeurSocket.options.test.ts`.
- Documentation: `docs/plan/etape-8-10.md` (créée), `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/deploiement.md`, `.claude/skills/conception-de-cartes/SKILL.md` et `fiche-de-commande.md`, ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés. Sim: une carte coupée par un trait d'un pixel, où une place tenable de l'autre morceau, ou à cheval sur le trait, est refusée; carte sans mur; égalité; carte pleine; carte lue depuis une image; jugement point par point identique à `positionTenable` sur une carte semée de pixels de mur (il échoue si l'on retire les décalages des premières colonnes, vérifié); deux cents apparitions jamais dans la poche, alors que sans morceau le même tirage y tombe; la spirale de secours passe outre une pièce close. Serveur: Tokyo garde entre 150 et 250 places en poche hors du morceau, en normal et en miroir; Spirit & Time, le Quartier et la Station n'en ont aucune; mille apparitions sur Tokyo toutes dans le morceau; préchargement de toutes les cartes dans les deux sens.
- Résultat: 3 602 tests au vert sous la mesure de couverture; types, linter et formatage des fichiers touchés au vert. Tests de la base sautés en local, joués par la CI.
- Couverture de packages/sim et shared: 99,75 pour cent des instructions; `etat.ts` à 100; `collisions.ts` entièrement couvert après le retrait d'une garde de bord inatteignable.
- Empreintes des quatre parties de référence (`tests/charge/empreinte.ts`): identiques avant et après, à l'octet. Aucune de leurs apparitions ne tombait dans une poche.
- État de la CI: voir le commit de suivi de ce handoff.

## Décisions et écarts au plan

- **Seize poches sur Tokyo, quinze dans son miroir**, et non onze et neuf: l'étape 8.9 les comptait avec les diagonales, cette étape sans, ce qui coupe certaines poches en deux. Sans diagonales, aucune des quatre cartes ne perd de sol jouable.
- **Préchargement au démarrage**, ajouté en cours d'étape: le calcul ne doit pas geler les parties en cours.
- **Un obstacle trop petit se chevauche aussi**, pas seulement un trait fin (piliers de dix pixels): couvert par la même correction. La consigne « un mur se trace à neuf pixels au moins » reste à la compétence, une poche étant désormais du sol perdu plutôt qu'un piège.
- Rien d'autre.

## Problèmes connus et dette

- Le formatage local signale environ 170 fichiers écrits en CRLF dans la copie de travail de cette machine (`core.autocrlf=true`), sans aucune différence de contenu pour git. La CI, qui extrait en LF, n'est pas concernée.
- Rien d'autre.

## Prochaine action exacte

Aucune étape n'est planifiée au ROADMAP. Attendre la prochaine demande du porteur du projet; au porteur du projet, en parallèle, ce qui restait de l'étape 8.9: relire la note 1.6 et la ligne des crédits, jouer la Station de jour et de nuit, juger le vaisseau.

## Étape suivante

À décider par le porteur du projet.
