# Fiche étape 1.2 - Déplacements et collisions

Brief de session. Objectif unique: porter le terrain, les positions, et la résolution des collisions dans le moteur pur, validés contre les tests de caractérisation.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 1.1 (pour le modèle d'état et le contrat tick), puis cette fiche.

Base legacy: master v0.8.6. Tous les numéros de ligne de cette fiche s'y réfèrent.

## Objectif

Intégrer dans packages/sim la gestion des positions, la carte de collisions, et la résolution des collisions des deux modes, de sorte que les scénarios de collision figés en étape 0.2 produisent la même sortie.

## Périmètre

À partir de legacy/server.js:

1. Porter PositionManager (ligne 222) et CollisionMap (ligne 327). Exigence: CollisionMap doit être taille-agnostique et fonctionner pour des cartes de dimensions différentes (le legacy a déjà trois cartes de tailles différentes, jusqu'à 3000 x 2000). Elle interroge la collision à partir de données pures (dimensions plus représentation de collision), pas d'une lecture d'image au runtime, pour garder packages/sim pur.

   Deux défauts du legacy à ne pas reproduire, relevés dans docs/audit/AUDIT-EXISTANT.md. D'une part, registerEntity, updateEntityPosition et removeEntity de PositionManager ne sont jamais appelées: la distance de sécurité au spawn (SAFE_SPAWN_DISTANCE, 100 pixels) ne s'applique donc jamais. Décider consciemment si on la fait vivre ou si on la retire, et le noter dans le handoff. D'autre part, getValidPosition référence une variable startTime non déclarée sur son chemin de secours, ce qui lève une erreur; le chemin de secours doit fonctionner.
2. Données de collision: le legacy porte la collision par image (un collision.png par carte). Convertir cette collision en représentation de données pure (par exemple une grille d'occupation dimensionnée à la carte), lors d'une étape de chargement ou de préparation hors du moteur. Le moteur reçoit cette représentation en donnée, dans l'état ou la configuration. Le choix précis de la représentation (résolution de grille ou format compact) tient compte de la taille des grandes cartes, à consigner dans le handoff.
3. Porter getCurrentMapDimensions (ligne 468), en faisant arriver les dimensions par l'état ou la configuration, jamais par une lecture externe. Ne pas reprendre les accesseurs GAME_CONFIG.WIDTH et HEIGHT de game-constants.js: ils lisent une variable waitingRoom absente de leur module et renvoient donc toujours 2000 x 1500, y compris sur map3 qui fait 3000 x 2000.
4. Porter la logique de déplacement des entités (intégrée aux mises à jour des entités du legacy) et la brancher dans le tick. Le déplacement du joueur se trouve dans le gestionnaire de l'événement move (ligne 2604): en extraire la logique de résolution (mouvement complet, puis mouvements séparés en X et en Y, puis essais angulaires), en écartant tout ce qui relève du réseau.
5. Porter detectCollisions (ligne 1671), en ne gardant que la partie entité contre entité: joueur contre joueur, joueur contre bot, bot contre bot, joueur contre bot noir. La collecte des bonus et des malus, aujourd'hui écrite en ligne dans cette même fonction (lignes 1737 à 1761), est laissée à l'étape 1.4.
6. Brancher la détection de collisions dans la boucle tick.

Note sur les modes. Le legacy v0.8.6 ne connaît que le mode Classique: la capture s'y résout par simple proximité (distance inférieure à 20). Il n'y a ni cône de capture, ni tentatives, ni classicModeCollisions ou tacticalModeCollisions. Le mode tactique arrivera plus tard, comme jeu de règles enfichable. La conception doit donc rendre la règle de résolution remplaçable, sans la construire ici.

## Hors périmètre

- Pas de résolution de capture (étape 1.3), pas de bonus ni malus (étape 1.4). La collecte des bonus et malus écrite en ligne dans detectCollisions sera traitée en 1.4.
- Aucune correction des failles de sécurité du legacy (autorité serveur sur le déplacement, plafonnement de la vitesse). C'est l'étape 1.6. Ici on porte la géométrie du déplacement, pas la politique de contrôle.
- Aucune optimisation de performance ici. La grille spatiale est une optimisation de la phase 5, à introduire seulement si la mesure la justifie. En 1.2, on reproduit le comportement, pas on l'optimise.
- Ne pas modifier legacy/.

## Tests requis

- TU de collision entité-entité, conformes aux instantanés de caractérisation.
- TU de collision entité-terrain.
- TU de déplacement bloqué: le glissement le long d'un mur (mouvement séparé en X puis en Y) produit le même résultat que le legacy.
- TU de collision sur des cartes de tailles différentes, dont la grande (3000 x 2000), pour vérifier que la collision reste correcte quelle que soit la taille.
- Au moins un cas limite (contact à la frontière).

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les fonctions de collision sont portées et pures.
2. Les scénarios de collision de l'étape 0.2 passent à l'identique.
3. Le linter confirme la pureté de packages/sim.
4. La couverture de packages/sim ne baisse pas.

## Rituel de fin de session

Écrire docs/handoffs/etape-1-2-handoff.md. Noter tout écart constaté avec la caractérisation et comment il a été résolu. Prochaine action exacte pour l'étape 1.3: porter le système de capture (cônes, angles, résolution). Commiter.
