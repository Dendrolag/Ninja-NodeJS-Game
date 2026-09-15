# Fiche étape 2.2 - Couche Socket.IO et contrats d'événements

Brief de session. Objectif unique: exposer les rooms au réseau via Socket.IO, avec des contrats d'événements typés. Les contrats typés sont une prévention de régression permanente, vérifiée à la compilation.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 2.1 (interfaces de GameRoom et RoomManager), puis cette fiche.

## Objectif

Brancher Socket.IO sur le RoomManager. Chaque connexion rejoint une room et reçoit ou émet des événements scopés à cette room. Définir deux interfaces TypeScript, une pour les événements client vers serveur, une pour serveur vers client, partagées via packages/shared, de sorte qu'un événement mal formé soit une erreur de compilation.

## Reprise du vocabulaire legacy

Le legacy possède déjà un riche jeu d'événements à réorganiser proprement par room. Les regrouper en familles.

- Entrées de jeu (client vers serveur): move, startCapture, endCapture, bonusExpired.
- Salon (client vers serveur): joinWaitingRoom, leaveWaitingRoom, rejoinWaitingRoom, updateGameSettings, requestGameSettings, updateMapSettings, chatMessage.
- Cycle de partie (client vers serveur): startGameFromRoom, cancelGameStart, togglePause, joinRunningGame.
- Flux d'état (serveur vers client): updateEntities, à fort débit, qui deviendra un delta binaire à l'étape 2.3. Le garder ici en JSON, l'étape 2.3 le remplacera.
- Notifications discrètes (serveur vers client): playerJoined, playerLeft, playerCaptured, playerCapturedEnemy, capturedByBlackBot, captureAttemptUsed, captureAttemptRecharged, activateBonus, bonusDeactivated, applyMalus, malusCollected, clearMalusEffects, newChatMessage, gameStarting, gameStartCountdown, gameOver, pauseGame, resumeGame, updateWaitingRoom, error.

Distinction de conception importante: le flux d'état à fort débit (l'état de la partie à chaque tick) et les notifications discrètes (une capture vient d'avoir lieu, un bonus s'active) sont deux choses différentes. Le premier deviendra un delta binaire. Les secondes restent des messages d'événement. Le client reconstruira l'état à partir du flux et appliquera les notifications par-dessus.

## Périmètre

1. Définir les deux interfaces typées d'événements dans packages/shared, à partir des familles ci-dessus, en repartant des charges utiles réelles du legacy.
2. Brancher Socket.IO: à la connexion, le joueur rejoint une room (via le mécanisme Socket.IO de rooms), et les émissions sont scopées à cette room.
3. Acheminer les entrées de jeu reçues vers la GameRoom concernée, et diffuser l'état et les notifications de cette room à ses seuls membres.
4. Gérer la déconnexion: retirer le joueur de sa room, et détruire la room si elle devient vide (via le RoomManager).

## Hors périmètre

- Le delta binaire reste pour l'étape 2.3. Ici updateEntities est diffusé en JSON.
- Le matchmaking et le navigateur de parties restent pour l'étape 2.4.
- Aucune logique de jeu ici. La logique vit dans packages/sim, appelée par GameRoom.

## Tests requis

- TI avec des clients socket.io-client simulés: un client rejoint une room, envoie une entrée, reçoit l'état et les notifications attendues.
- TI vérifiant l'isolation: un client d'une room ne reçoit pas les événements d'une autre room.
- TI sur la déconnexion: le joueur est retiré, la room vide est détruite.
- Vérification des contrats: une charge utile non conforme à l'interface est rejetée à la compilation.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les deux interfaces typées existent dans packages/shared et sont utilisées des deux côtés.
2. Les événements sont scopés par room.
3. Les TI ci-dessus passent.

## Réconciliation (14 août 2026, à l'exécution)

Sept écarts entre la fiche et ce qui a été fait. Les cinq premiers viennent de la fiche elle-même, écrite depuis le corpus d'origine qui visait `mode-strategique` v0.9.0 ; la base de référence est `master` v0.8.6.

1. **`startCapture` et `endCapture` n'existent pas dans la base de référence.** La fiche les liste dans les entrées de jeu. Vérifié : aucune occurrence dans `legacy/server.js` ni `legacy/client.js` de la v0.8.6. Ils appartiennent à la capture par cône du mode tactique, écarté du périmètre v1. Même chose pour `captureAttemptUsed` et `captureAttemptRecharged`, listés dans les notifications.

2. **Les événements sont nommés en français**, comme tout le reste du nouveau code. La fiche cite les noms du legacy ; ils servent de correspondance, pas de nomenclature. Chaque événement du contrat porte en commentaire le nom legacy qu'il remplace.

3. **`bonusExpired` n'est pas porté**, et c'est une décision de sécurité, pas de commodité. Un client qui annonce que son bonus a expiré annonce son **état**, ce que la règle de l'étape 1.6 interdit. Le moteur seul détient les durées. Idem pour `bonusDeactivated` et `clearMalusEffects`, qui n'existaient que pour resynchroniser une comptabilité tenue à deux endroits. La liste complète des événements legacy non portés, avec leur raison, est en fin de `packages/shared/src/evenements.ts` : elle fait partie du contrat, pour qu'une étape ultérieure ne les réintroduise pas par habitude.

4. **`togglePause` n'est pas porté, et c'est un manque réel.** La pause est un état de la **partie**, donc du moteur, et aucune étape de la phase 1 ne l'a portée. La brancher ici mettrait de la logique de jeu dans la couche réseau, ce que la section « Hors périmètre » de cette fiche interdit explicitement. Traité selon la règle 7 de CLAUDE.md : trop gros pour l'étape en cours, donc consigné comme étape à part entière plutôt que comme dette silencieuse.

5. **Trois événements montants fusionnent.** `joinWaitingRoom`, `rejoinWaitingRoom` et `joinRunningGame` faisaient la même chose : ils deviennent `rejoindre`. `updateGameSettings` et `updateMapSettings`, qui se marchaient dessus, deviennent `reglages`. `requestGameSettings` disparaît : le serveur envoie le salon à l'entrée et à chaque changement. Descendants, `updateWaitingRoom` et `gameSettingsUpdated` fusionnent en `salon`, un seul message qui ne peut plus se contredire lui-même.

6. **`GameRoom` a reçu deux ajouts**, tous deux nécessaires au périmètre de cette étape et documentés dans le handoff : un rappel `surBattement`, seul moyen pour la couche réseau de lire `etat.evenements` avant sa remise à zéro ; et `changerReglages`, sans quoi le salon du legacy n'était pas à parité.

7. **Express n'est pas ajouté.** La pile du projet l'annonce et le handoff 2.1 l'attendait ici, mais à cette étape il n'y a rien à servir : ni fichier client, ni route d'interface. Le module `http` de Node suffit et ne s'installe pas. Express arrivera avec le client de la phase 4, quand il aura un travail.

## Rituel de fin de session

Écrire docs/handoffs/etape-2-2-handoff.md. Lister les interfaces d'événements retenues et la charge utile du flux d'état, car l'étape 2.3 le convertira en binaire. Prochaine action exacte pour l'étape 2.3: remplacer la diffusion d'état complet par un delta binaire. Commiter.
