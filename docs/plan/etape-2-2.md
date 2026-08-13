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

## Rituel de fin de session

Écrire docs/handoffs/etape-2-2-handoff.md. Lister les interfaces d'événements retenues et la charge utile du flux d'état, car l'étape 2.3 le convertira en binaire. Prochaine action exacte pour l'étape 2.3: remplacer la diffusion d'état complet par un delta binaire. Commiter.
