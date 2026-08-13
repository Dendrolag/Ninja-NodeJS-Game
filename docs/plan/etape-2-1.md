# Fiche étape 2.1 - GameRoom et RoomManager

Brief de session. Objectif unique: faire tourner plusieurs parties en parallèle, en enveloppant le moteur pur dans une room et en gérant le cycle de vie des rooms. C'est le déblocage central pour les parties privées et publiques.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 1.5 (le moteur pur est complet), le cadrage docs/design/cadrage.md (contrat de configuration de partie), puis cette fiche.

## Objectif

Dans packages/server, créer une classe GameRoom qui détient l'état d'une partie et appelle le moteur pur de packages/sim, et un RoomManager qui crée, retrouve et détruit des rooms. Chaque room a sa propre boucle de tick, et le temps lui est injecté. Le moteur ne sait toujours pas qu'un réseau existe.

## Périmètre

1. GameRoom: détient un état de partie (créé via le moteur), sa configuration (le contrat de configuration de partie du cadrage), la liste de ses joueurs, et son statut (salon, en cours, terminée). Expose des méthodes pour appliquer les entrées des joueurs et avancer d'un tick en appelant le moteur pur avec un dt mesuré côté serveur.
2. Boucle de tick par room: une horloge serveur appelle le tick à intervalle régulier, fournit le dt au moteur, et conserve l'état renvoyé. Le hasard de la partie part de la graine de la room.
3. RoomManager: crée une room à partir d'une configuration, l'enregistre, permet de la retrouver par identifiant, gère l'ajout et le retrait de joueurs, et détruit une room vide. Reprendre la logique d'attribution de l'hôte du legacy (server.js, conditions isEmptyRoom, hasNoOwner, wasOwner autour des lignes 2350 à 2748), réécrite proprement par room.
4. Plusieurs rooms isolées: vérifier que deux rooms n'interfèrent pas, états et graines indépendants.

## Hors périmètre

- Pas encore de réseau Socket.IO. C'est l'étape 2.2. Ici on pilote GameRoom et RoomManager directement dans les tests.
- Pas de matchmaking ni de navigateur de parties. C'est l'étape 2.4.
- Pas de delta binaire. C'est l'étape 2.3.
- Ne pas réintroduire d'état global. Tout état vit dans une room.

## Tests requis

- TI sur le cycle de vie d'une room: création depuis une configuration, ajout et retrait de joueurs, attribution de l'hôte, destruction quand vide.
- TI vérifiant que plusieurs rooms tournent en parallèle sans interférence (états et graines indépendants).
- TI vérifiant qu'une room avance bien d'un tick en appelant le moteur pur, avec un dt fourni.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. GameRoom et RoomManager existent et sont typés.
2. La boucle de tick par room fonctionne avec temps injecté.
3. Aucune variable globale mutable d'état de partie.
4. Les TI ci-dessus passent.

## Rituel de fin de session

Écrire docs/handoffs/etape-2-1-handoff.md. Décrire l'interface de GameRoom et de RoomManager, car l'étape 2.2 les exposera au réseau. Prochaine action exacte pour l'étape 2.2: définir les contrats d'événements Socket.IO typés et router les événements par room. Commiter.
