# Fiche étape 1.4 - Bonus, malus et zones spéciales

Brief de session. Objectif unique: porter les bonus, les malus et les zones spéciales, avec leurs effets et leurs durées, dans le moteur pur.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 1.3, puis cette fiche.

Base legacy: master v0.8.6. Tous les numéros de ligne de cette fiche s'y réfèrent.

## Objectif

Intégrer dans packages/sim l'apparition, la collecte, l'application et l'expiration des bonus et malus, ainsi que les zones spéciales, de sorte que les scénarios d'effets figés en étape 0.2 produisent la même sortie. Toute apparition aléatoire passe par le générateur à graine, jamais par Math.random.

## Périmètre

À partir de legacy/server.js:

1. Porter les classes Bonus (ligne 1347), Malus (ligne 1401) et SpecialZone (ligne 487).
2. Bonus: porter spawnBonus (ligne 1579), handleBonusCollection (ligne 1614), updateBonusItems (ligne 1499) et cleanExpiredBonuses (ligne 1495). Faire passer l'apparition par la graine.
3. Malus: porter spawnMalus (ligne 651), handleMalusCollection (ligne 684), updateMalusItems (ligne 1477) et clearMalusEffects (ligne 676).
4. Effets sur les joueurs: porter updatePlayerBonuses (ligne 627).
5. Zones spéciales: porter manageSpecialZones (ligne 803) et l'application de leurs effets.
6. Porter la collecte des bonus et des malus, laissée de côté en 1.2. Elle n'est pas isolée dans une fonction dans la v0.8.6: elle est écrite en ligne dans detectCollisions (lignes 1737 à 1761). En faire une règle explicite et la brancher.
7. Brancher l'ensemble dans la boucle tick, en s'appuyant sur dt pour les durées et expirations.

Deux pièges du legacy à ne pas reproduire, relevés dans docs/audit/AUDIT-EXISTANT.md.

- spawnBonus et spawnMalus se replanifient elles-mêmes par setTimeout et ne sont jamais annulées, si bien qu'une nouvelle chaîne s'ajoute à chaque partie et que les apparitions s'accélèrent au fil des parties. Dans le moteur pur, la planification est portée par l'état et avancée par dt: le problème disparaît par construction, mais il faut vérifier qu'une remise à zéro de partie repart d'un compteur propre.
- Un malus ramassé s'applique aux **autres** joueurs, pas à celui qui le ramasse. C'est contre-intuitif mais voulu, et listé dans les comportements à préserver de CLAUDE.md.

## Hors périmètre

- Pas d'IA de bots (étape 1.5).
- Aucun rendu des effets. Le moteur expose l'état, le client l'affichera en phase 4.
- Ne pas modifier legacy/.

## Tests requis

- TU sur l'application de chaque type d'effet à la collecte.
- TU sur l'expiration d'un effet après la durée prévue (piloté par dt).
- TU sur l'effet d'une zone spéciale.
- TU de déterminisme: deux parties avec la même graine font apparaître bonus et malus aux mêmes endroits et instants.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Bonus, malus et zones sont portés et purs.
2. Les apparitions aléatoires sont déterministes via la graine.
3. Les scénarios d'effets de l'étape 0.2 passent à l'identique.
4. Le linter confirme la pureté de packages/sim, et la couverture ne baisse pas.

## Rituel de fin de session

Écrire docs/handoffs/etape-1-4-handoff.md. Lister les types d'effets portés et leurs durées. Prochaine action exacte pour l'étape 1.5: porter l'IA des bots standards et des BlackBot, rendue déterministe. Commiter.
