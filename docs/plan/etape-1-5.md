# Fiche étape 1.5 - Intelligence artificielle des bots

Brief de session. Objectif unique: porter l'IA des bots standards et des BlackBot dans le moteur pur, de façon déterministe. Cette étape termine le cœur de simulation.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 1.4, puis cette fiche.

Base legacy: master v0.8.6. Tous les numéros de ligne de cette fiche s'y réfèrent.

## Objectif

Intégrer dans packages/sim le comportement des bots (déplacement, ciblage, décisions) pour les bots standards et les BlackBot. Toute décision qui repose sur le hasard passe par le générateur à graine, pour que le comportement soit reproductible et testable. À la fin, le moteur simule une partie complète avec joueurs, bots, collisions, captures, bonus et malus, sans réseau ni rendu.

## Périmètre

À partir de legacy/server.js:

1. Porter la classe Bot (ligne 941) et ses méthodes de décision et de déplacement.
2. Porter la classe BlackBot (ligne 1130), qui étend Bot, avec son comportement spécifique.
3. Porter createBots (ligne 1547), addBot (ligne 1553), updateBots (ligne 1558) et spawnBlackBots (ligne 1333), en faisant passer toute apparition et tout choix aléatoire par la graine.
4. Porter resetPlayer (ligne 1456) si la réinitialisation relève de la logique de jeu plutôt que du serveur. Si elle relève du cycle de vie serveur, la laisser pour la phase 2 et le noter dans le handoff.

Ne pas porter Bot.unstuck (ligne 1034): elle n'est jamais appelée dans le legacy et invoque une méthode collisionMap.findValidSpawnPosition qui n'existe pas. C'est du code mort. Le dégagement effectif se fait par findEscapePath (ligne 1007). 5. Brancher la mise à jour des bots dans la boucle tick.

## Hors périmètre

- Aucun réseau, aucune room, aucun rendu. C'est la phase 2 et au-delà.
- Aucune optimisation de l'IA (niveau de détail pour les bots lointains). C'est une optimisation de la phase 5, conditionnée à la mesure.
- Ne pas modifier legacy/.

## Tests requis

- TU vérifiant qu'un bot prend la décision attendue dans une situation donnée, de façon reproductible avec une graine fixée.
- TU sur le comportement spécifique des BlackBot.
- TU de partie complète: sur un état initial et une graine donnés, faire tourner un nombre fixe de ticks et vérifier que l'état final correspond à un instantané de référence. C'est le test d'intégration du moteur pur.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. L'IA des bots et des BlackBot est portée et pure.
2. Le comportement est déterministe via la graine.
3. Le test de partie complète sur N ticks passe et reste stable.
4. Le linter confirme la pureté de packages/sim. La couverture de packages/sim atteint la cible (80 à 90 pour cent).

## Fin du portage du gameplay

Cette étape clôt le portage du gameplay dans le moteur pur.

La porte des maquettes ne se situe plus ici. Dans l'ordre d'exécution retenu (voir la section 3 de docs/plan/ROADMAP.md), le jalon 1 continue avec 1.6, 2.1, 2.2 puis la phase 4, qui ne dépendent pas des maquettes. Les maquettes sont exigées au jalon 2, avant l'étape 0.3 et l'étape 2.4.

## Réconciliation, 14 août 2026

Écarts entre cette fiche et ce qui a réellement été fait, notés en exécutant l'étape.

1. **Le périmètre ne parle pas des réglages du bot noir.** Il fallait les ajouter à `ReglagesPartie`, comme le handoff 1.4 l'avait anticipé: nombre, moment d'apparition, rayon de détection, part de bots perdue. Sans eux, les défauts X14 et X26 se seraient reproduits.

2. **Point 4 tranché: `resetPlayer` n'est pas portée.** Elle relève du cycle de vie serveur, pas de la logique de jeu. Ses deux appelants du legacy (`server.js:1961` dans `resetGame`, `:2495` au lancement du compte à rebours) remettent à zéro les compteurs d'un joueur entre deux parties. Dans le moteur, une partie neuve est un état neuf: il n'y a rien à remettre à zéro. Le seul élément utile de cette fonction, le compteur `capturedByBlackBot`, est porté comme champ de joueur sous le nom `capturesParBotNoirSubies`.

3. **La numérotation du périmètre saute.** Le point 5, « brancher la mise à jour des bots dans la boucle tick », est collé à la fin du paragraphe sur `Bot.unstuck` dans la fiche d'origine. Il a bien été fait: `avancerLesBots` est appelée par `tick`, entre le déplacement des joueurs et les zones, ce qui est l'ordre du legacy (`updateBots` puis `sendUpdates`).

4. **Le test de partie complète compare un résumé, pas l'état brut.** Un état de fin de partie contient une trentaine de bots avec leurs caps et leurs compteurs: un instantané brut ferait plusieurs centaines de lignes illisibles. Le résumé retenu contient l'état du générateur à graine, qui suffit à détecter toute divergence de tirage. Voir l'en-tête de `packages/sim/src/partie.test.ts`.

5. **Quatre défauts découverts en portant**, X26 à X29, tous consignés dans l'audit et corrigés par conception. C'est l'application de la règle 7 de CLAUDE.md.

## Rituel de fin de session

Écrire docs/handoffs/etape-1-5-handoff.md. Confirmer que le moteur simule une partie complète et donner la couverture atteinte. Prochaine action exacte pour l'étape 1.6: durcissement et autorité serveur (validation des entrées, plafonnement du déplacement, limitation de débit). Commiter.
