# Fiche étape 5.2 - Optimisations validées par la mesure

Brief de session. Objectif unique: appliquer les optimisations utiles, et seulement celles que les mesures de l'étape 5.1 justifient. Cette fiche pose la méthode et les candidates, pas une liste d'optimisations décidées d'avance. Optimiser sans avoir mesuré serait une erreur.

## Rituel de début de session

Lire CLAUDE.md, le handoff et le rapport de mesures de l'étape 5.1 (où le serveur sature en premier), puis cette fiche.

## Méthode (non négociable)

Pour chaque optimisation envisagée: partir d'un point chaud identifié par la mesure, appliquer le changement, mesurer à nouveau dans les mêmes conditions, et ne conserver que si le gain est réel. À chaque fois, les tests unitaires du moteur restent au vert, pour prouver que le comportement n'a pas changé. Une optimisation qui modifie le comportement de jeu est rejetée.

## Candidates (à activer selon la mesure, pas par défaut)

1. Partitionnement spatial: si la détection de collisions et de capture sature avec le nombre d'entités, introduire une grille spatiale en phase large. L'envelopper autour de CollisionMap de sorte que les fonctions existantes l'utilisent et renvoient un résultat identique. Aucun changement de gameplay.
2. Niveau de détail d'IA: si le calcul des bots sature, faire tourner une IA plus simple ou moins fréquente pour les bots éloignés de tout joueur. Vérifier que le comportement observable reste acceptable.
3. Points chauds résiduels: retirer tout journal synchrone restant dans les chemins exécutés à chaque tick, et toute allocation inutile par tick repérée par le profilage.
4. Diffusion: si la bande passante sature et que la carte est plus grande que la zone visible, envisager un filtrage par zone d'intérêt. Sans intérêt si toutes les entités sont visibles à l'écran.

## Hors périmètre

- Aucune optimisation non justifiée par une mesure.
- Aucune réécriture de la logique de jeu. Les optimisations enveloppent ou allègent, elles ne changent pas les règles.

## Tests requis

- Pour chaque optimisation retenue, une comparaison avant après chiffrée, dans les mêmes conditions que l'étape 5.1.
- Les tests unitaires du moteur restent au vert après chaque optimisation.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les optimisations retenues sont justifiées par une mesure et documentées avec leur gain.
2. Aucune régression de comportement, tests du moteur au vert.
3. Les seuils de référence sont mis à jour.

## Rituel de fin de session

Écrire docs/handoffs/etape-5-2-handoff.md. Lister les optimisations retenues, leur gain mesuré, et celles écartées faute de gain. Prochaine action exacte pour l'étape 5.3: déployer la nouvelle version à côté de l'ancienne, sans bascule sèche. Commiter.
