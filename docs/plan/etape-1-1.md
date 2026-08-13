# Fiche étape 1.1 - Squelette du moteur et modèle d'état

Brief de session. Objectif unique: poser le cœur de simulation pur, son contrat, son modèle d'état, et y porter les entités de base. Première étape de la phase 1.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 0.2, puis cette fiche. Garder en tête la règle .claude/rules/sim-purity.md, vérifiée par le linter.

Base legacy: master v0.8.6. Tous les numéros de ligne de cette fiche s'y réfèrent.

## Objectif

Dans packages/sim, définir le modèle d'état d'une partie, le contrat du moteur, le générateur à graine (dans packages/shared), et porter les classes Entity et Player du legacy. À la fin, le moteur avance d'un tick sur un état, de façon pure et déterministe, sans réseau ni rendu.

## Contrat du moteur

Une fonction pure de la forme tick(etat, entrees, dt) qui renvoie un nouvel état. Elle ne lit jamais l'horloge (le temps arrive par dt) ni le hasard global (il passe par le générateur à graine, transporté dans l'état ou en paramètre). Exposer aussi une évaluation pure des conditions de fin de partie, sans déclencher d'action (l'action appartiendra au serveur en phase 2).

## Périmètre

À partir de legacy/server.js et legacy/game-constants.js:

1. Porter les constantes partagées dans packages/shared.
2. Implémenter le générateur de nombres à graine dans packages/shared, et remplacer les usages de hasard du legacy (getRandomColor ligne 1512, getUniqueColor ligne 1521) par ce générateur déterministe.
3. Définir le modèle d'état de la partie (entités, scores, temps écoulé en ticks, graine), typé en TypeScript.
4. Porter la classe Entity (legacy ligne 832) et la classe Player (ligne 876) dans packages/sim, débarrassées de toute dépendance d'entrée-sortie. Attention: le constructeur de Entity appelle positionManager.getValidPosition() et getRandomColor(). Dans le moteur pur, la position et la couleur de départ sont fournies en entrée ou tirées de la graine, jamais calculées par un appel à un service externe.
5. Implémenter la boucle tick minimale: appliquer les entrées et avancer l'état, même si peu de systèmes sont encore branchés.
6. Porter les helpers de direction determineDirection (ligne 844) et updateDirection (ligne 864), méthodes de Entity, utilitaires purs utiles dès maintenant. Le legacy les porte comme méthodes d'instance; en version pure, ce sont des fonctions qui prennent un vecteur et renvoient une direction.

## Hors périmètre

- Pas encore de collisions, de capture, de bonus, de malus ni d'IA de bots. Ce sont les étapes 1.2 à 1.5.
- Aucun réseau, aucun rendu, aucune base.
- Ne pas modifier legacy/.

## Tests requis

- TU sur la création d'un état initial.
- TU de pureté: deux exécutions du même tick avec les mêmes entrées et la même graine donnent le même état.
- TU sur l'avancement d'un tick (les entrées de déplacement modifient l'état comme attendu).
- TU sur le déterminisme du générateur à graine.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Le contrat tick existe et est typé.
2. Entity et Player sont portées et pures.
3. Le linter confirme l'absence d'import ou d'appel interdit dans packages/sim.
4. Les TU ci-dessus passent.

## Rituel de fin de session

Écrire docs/handoffs/etape-1-1-handoff.md. Décrire le modèle d'état retenu et la forme exacte du contrat tick (les fiches suivantes s'y appuient). Prochaine action exacte pour l'étape 1.2: porter PositionManager et CollisionMap, et les fonctions de collision, validées contre la caractérisation. Commiter.
