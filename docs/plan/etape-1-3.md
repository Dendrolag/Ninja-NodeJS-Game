# Fiche étape 1.3 - Capture et score

Brief de session. Objectif unique: porter la résolution des captures et le calcul des scores dans le moteur pur, validés contre la caractérisation.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 1.2, puis cette fiche.

Base legacy: master v0.8.6. Tous les numéros de ligne de cette fiche s'y réfèrent.

## Note sur le périmètre, par rapport au plan d'origine

Cette fiche visait initialement le système de capture par cône directionnel du mode tactique (checkEntityInCone, getAngleBetweenVectors, getEntitiesInCaptureRange, updateCaptureAttempts). **Aucune de ces fonctions n'existe dans la base legacy retenue.** La v0.8.6 ne connaît que le mode Classique, où la capture se résout par simple proximité. Le mode tactique reviendra plus tard comme jeu de règles enfichable. Voir la section 5 de docs/plan/ROADMAP.md.

Conséquence de conception: la règle de résolution d'une capture doit être **remplaçable**. On la porte sous une forme qui permettra d'en brancher une autre (cône directionnel, tentatives limitées) sans toucher au reste du moteur. On ne construit pas cette autre règle ici.

## Objectif

Intégrer dans packages/sim la résolution d'une capture et son effet sur l'état et les scores, de sorte que les scénarios figés en étape 0.2 produisent la même sortie.

## Périmètre

À partir de legacy/server.js:

1. Porter la résolution d'une capture de joueur, handlePlayerCapture (ligne 737), en version pure: elle modifie l'état renvoyé, elle n'émet rien. Elle couvre le contrôle d'invincibilité et de protection au spawn, le transfert de tous les bots de la victime vers l'attaquant, la tenue de l'historique (capturedPlayers et capturedBy), et la réapparition de la victime avec une nouvelle couleur.
2. Porter la capture d'un bot par un joueur: dans le legacy, elle se réduit au changement de couleur du bot lors du contact, écrit en ligne dans detectCollisions (lignes 1686 à 1707). En faire une règle de capture explicite, distincte de la détection de contact portée en 1.2.
3. Porter la destruction d'un bot noir par un joueur invincible (lignes 1718 à 1735), qui incrémente blackBotsDestroyed.
4. Porter calculatePlayerScores (ligne 1766) et le brancher, de sorte qu'une capture mette à jour les scores dans l'état.
5. Exposer dans l'état les informations dont le client aura besoin: une capture vient d'avoir lieu, ses participants, le nombre de bots transférés. Le moteur ne gère ni son, ni animation, ni notification.
6. Brancher la résolution des captures dans la boucle tick.

## Comportements à préserver impérativement

Ils font la tension du jeu et sont explicitement listés dans CLAUDE.md.

- Le score est un **stock, pas un cumul**: il vaut le nombre de bots portant actuellement la couleur du joueur, plus 15 points par bot noir détruit. Se faire capturer le ramène à zéro.
- Une capture de joueur transfère **tous** ses bots d'un coup.
- Le classement se départage d'abord au score, puis au nombre de captures.
- Délai de 1 seconde entre deux captures par le même attaquant, protection de 3 secondes au spawn.

## Hors périmètre

- Pas de bonus ni malus (étape 1.4), pas d'IA de bots (étape 1.5). L'invincibilité est ici lue comme un simple indicateur de l'état; son cycle de vie vient en 1.4.
- Aucune logique d'affichage, d'animation ni de son dans le moteur.
- Aucun cône de capture, aucune tentative limitée. Ce sera le mode tactique, plus tard.
- Ne pas modifier legacy/.

## Tests requis

- TU sur la résolution d'une capture de joueur: qui capture qui, combien de bots sont transférés, historique mis à jour des deux côtés.
- TU sur le refus d'une capture: victime invincible, victime sous protection de spawn, attaquant encore en délai de capture.
- TU sur la capture d'un bot et sur la destruction d'un bot noir par un joueur invincible.
- TU sur le calcul des scores, conforme à la caractérisation, dont le retour à zéro de la victime.
- TU sur le départage du classement à égalité de score.
- Au moins un cas limite: deux captures dans le même tick, contact exactement à la distance limite.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. La résolution des captures et le calcul des scores sont portés et purs.
2. La règle de résolution est remplaçable, sans qu'une autre règle soit construite.
3. Les scénarios de capture et de score de l'étape 0.2 passent à l'identique.
4. Le linter confirme la pureté de packages/sim.
5. La couverture de packages/sim ne baisse pas.

## Réconciliation avec le dépôt

Écarts constatés à l'exécution, le 14 août 2026. Une fiche est un plan, pas un contrat figé.

1. **Les bots sont portés ici, en données seulement.** La fiche les supposait présents (points 2, 3 et 4), le handoff de l'étape 1.2 les annonçait pour l'étape 1.5. Ils entrent donc dans l'état à cette étape, réduits à une identité, une place, une couleur et une nature. Leur déplacement et leur intelligence restent en 1.5. Sans eux, ni la capture de bot, ni la destruction de bot noir, ni le score n'auraient eu la moindre entité sur laquelle s'appliquer.

2. **Le score n'est pas rangé dans l'état.** Le point 4 demandait « qu'une capture mette à jour les scores dans l'état ». C'est bien le cas, mais indirectement: une capture repeint des bots, et le score se déduit des bots. Le stocker aurait créé une seconde vérité à tenir à jour, ce qui est la maladie que le projet cherche à quitter. Décision consignée au journal de conception.

3. **La capture d'un joueur par un bot noir n'est pas ici.** La fiche ne la demandait pas, et le domaine de caractérisation la couvre pourtant. Elle relève du comportement du bot noir, donc de l'étape 1.5. Le compteur `capturedByBlackBot` n'est pas porté non plus: on ne pose pas un champ dont personne ne sait encore se servir.

4. **L'invincibilité est portée comme un simple indicateur**, conformément à la section hors périmètre. Rien ne l'active à cette étape; elle est déjà lue par deux règles (un joueur invincible ne peut pas être capturé, et lui seul détruit les bots noirs qu'il touche). Son cycle de vie vient en 1.4.

5. **Deux défauts découverts en portant**, X20 et X21, ajoutés à l'audit. Le second est corrigé par conception; le premier est porté tel quel avec une question posée dans le handoff.

## Rituel de fin de session

Écrire docs/handoffs/etape-1-3-handoff.md. Indiquer comment l'état signale une capture au futur client (forme retenue), et par quel point d'extension une autre règle de capture pourra être branchée. Prochaine action exacte pour l'étape 1.4: porter bonus, malus et zones spéciales avec leurs effets et durées. Commiter.
