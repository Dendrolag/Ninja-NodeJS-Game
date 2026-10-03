# Fiche étape 8.10 - Les apparitions dans une poche close

Brief de session. Objectif unique: qu'une apparition ne tombe jamais hors du morceau principal de la carte, sans changer la façon dont les ninjas frôlent les murs.

## Origine de cette fiche

Aucune fiche n'existait. L'étape a été planifiée le 3 octobre 2026, à l'étape 8.9, au titre de la règle 7 (entrée 8.10 du ROADMAP, section 4). Rédigée le 3 octobre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de cette entrée, de la section 2 de la compétence `conception-de-cartes`, de l'état du dépôt au commit `edb72bc` et du handoff 8.9.

## Le défaut

Le moteur juge qu'un ninja tient à une place en regardant dix-sept points de son disque (`positionTenable`, `packages/sim/src/collisions.ts`), écartés de huit pixels au plus. Un trait de mur plus fin que neuf pixels peut passer entre deux points: la place à cheval sur lui est jugée tenable. Au pied d'un tel trait naissent des places coupées du reste de la carte. Le tirage d'une apparition (`positionDApparition`, `packages/sim/src/etat.ts`) ne vérifie que la place elle-même: il peut tomber dans une telle poche, et le joueur, le faux ninja, le Black Ninja, l'Évadé ou le bonus qui y naît y reste toute la partie.

## Diagnostic, fait au début de l'étape

1. **Une seule porte d'entrée.** Toutes les apparitions du moteur passent par `positionDApparition`: joueurs, retour après capture, faux ninjas, Black Ninjas, Évadé, bonus, mines de zone, morts du Massacre, fumée. La corriger là les corrige toutes.
2. **Les poches, mesurées sur les points entiers de chaque terrain**, voisins par les quatre côtés: Tokyo compte un morceau de 2 258 784 places et 16 poches (de 1 à 106 places), son miroir 15 poches. Spirit & Time, le Quartier et la Station lunaire tiennent en un seul morceau, en normal comme en miroir. Les onze poches comptées à l'étape 8.9 l'étaient avec les diagonales; sans elles, quelques poches se coupent en deux.
3. **Le calcul coûte un quart de seconde par terrain** (150 à 270 ms pour juger toutes les places, 50 à 90 ms pour les relier), une fois par carte et par sens: le serveur garde ses terrains décodés (`ChargeurDeTerrain`).

## Décisions prises par cette fiche

1. **Le morceau principal se calcule une fois, avec la carte.** `CarteCollisions` porte un champ de plus, le morceau principal, un bit par point entier de la carte. Il est calculé par `carteDepuisPixels` et par `creerCarteCollisions` quand une règle de murs est donnée. Une carte sans mur n'en porte pas: elle est d'un seul tenant par construction, et rien n'est restreint.
2. **Deux points voisins par un côté sont reliés.** Aller de l'un à l'autre est un pas d'un pixel, que `trajetTenable` accepte dès que l'arrivée tient. Le morceau ainsi trouvé est donc atteignable à coup sûr. Sans les diagonales, on ne risque pas de relier une poche par un coin que le moteur refuserait; la mesure montre qu'aucune carte du jeu n'en est coupée.
3. **Le morceau principal est le plus grand.** À égalité, le premier dans l'ordre de lecture, pour rester déterministe.
4. **Une place tirée au hasard, à coordonnées réelles, appartient au morceau principal** si elle tient et rejoint par un trajet tenable l'un des quatre points entiers qui l'entourent, pris dans le morceau. La règle du tirage ne change pas autrement: même nombre de tirages tant que la place tombe hors d'une poche, si bien que les parties qui n'y tombaient pas rejouent à l'identique.
5. **La spirale de secours applique la même règle.** Le repli ultime sur le centre de la carte, quand la spirale ne trouve rien, ne change pas.
6. **Le déplacement ne change pas.** `positionTenable` et `trajetTenable` restent tels quels: les ninjas frôlent les murs comme depuis deux ans.
7. **Les murs épaissis de la Station lunaire restent épaissis.** Ils ne gênent rien et rendent son image de collision juste au pixel près.
8. **Version 1.6.1**: une correction visible du joueur, sans note.

## Périmètre

### Lot A. Le moteur

- `packages/sim/src/collisions.ts`: le calcul du morceau principal à la construction, et `dansLeMorceauPrincipal(carte, position)`.
- `packages/sim/src/etat.ts`: `positionDApparition` et `positionDeSecours` exigent le morceau principal.

### Lot B. Version et documentation

- `NUMERO_DE_VERSION` à 1.6.1.
- Compétence `conception-de-cartes` (section 2 point 4, section 9 point 6) et sa fiche de commande: le moteur ne fait plus apparaître personne dans une poche; un mur fin reste chevauchable.
- ROADMAP, journal de conception, handoff.

## Hors périmètre

- Changer la géométrie du disque d'un ninja ou le balayage des trajets.
- Retoucher les images de collision de Tokyo.
- Une entité déjà dans une poche par une position imposée (tests, reprise): une position imposée n'est pas vérifiée, comme avant.

## Tests requis

- Sim: une carte fabriquée avec une poche close au pied d'un mur fin, dont une place est tenable: le morceau principal l'exclut; une carte sans mur n'a pas de morceau; à égalité, le premier; une place réelle à côté d'un point du morceau y appartient; une apparition ne tombe jamais dans la poche, alors qu'avant l'étape elle y tombait pour la même graine; la spirale de secours l'évite aussi.
- Serveur: sur les quatre cartes, dans les deux sens, chaque place du morceau principal est hors des poches mesurées et Tokyo garde bien ses poches hors du morceau; mille apparitions sur Tokyo tombent toutes dans le morceau principal.
- Empreintes des parties de référence (`tests/charge/empreinte.ts`): relevées avant et après; tout écart s'explique par une apparition qui tombait dans une poche.

## Définition de terminé

1. Aucune apparition ne peut tomber hors du morceau principal, sur aucune carte.
2. Le déplacement est inchangé, et les tests du moteur restent au vert.
3. Couverture de packages/sim maintenue.
4. CI verte, handoff écrit et commité.

## Réconciliation pendant l'étape (3 octobre 2026)

1. **Le calcul a été réécrit pour aller vite.** Juger chaque point par `positionTenable` puis relier les points coûtait 300 ms par carte, et sous la mesure de couverture un test du serveur dépassait son délai d'attente. Les points se jugent désormais sur une copie des murs à un octet par pixel, avec les seize décalages du contour précalculés en indices, et le parcours se fait sans test de bord: 50 à 150 ms par carte. Un test compare ce jugement à `positionTenable` point par point; il échoue si l'on oublie que, dans les 64 premières colonnes, la virgule flottante décale d'une colonne le point du contour tourné vers le haut.
2. **Le serveur précharge toutes les cartes au démarrage** (`ChargeurDeTerrain.prechargerTout`), dans les deux sens, comme le harnais de bout en bout. Sans cela, le premier lancement d'une carte arrêterait toutes les parties en cours le temps du calcul. Deux secondes de plus au démarrage, six mégaoctets de mémoire.
3. **Défaut trouvé et corrigé** (règle 7): le test du réglage de nuit (`ServeurSocket.options.test.ts`) préchargeait trois cartes sur quatre, la Station oubliée depuis l'étape 8.9; il décodait donc la Station au milieu d'un test. Il précharge maintenant tout.
4. **Un pilier de dix pixels se chevauche aussi.** Une tentative de test sur des piliers carrés de dix pixels a trouvé des poches à leurs abords: comme un trait fin, un obstacle trop petit passe entre les points du disque. C'est le même défaut, couvert par la même correction.
5. **Les parties de référence rejouent à l'octet** (`tests/charge/empreinte.ts`): aucune de leurs apparitions ne tombait dans une poche.

## Rituel de fin de session

Handoff depuis `docs/handoffs/_TEMPLATE.md`, ROADMAP à jour, commit et poussée, CI suivie jusqu'à la mise en ligne.
