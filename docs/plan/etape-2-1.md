# Fiche étape 2.1 - GameRoom et RoomManager

Brief de session. Objectif unique: faire tourner plusieurs parties en parallèle, en enveloppant le moteur pur dans une room et en gérant le cycle de vie des rooms. C'est le déblocage central pour les parties privées et publiques.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff de docs/handoffs/ (l'étape 1.6, qui clôt la phase 1), le contrat de configuration de partie, puis cette fiche.

Note du 14 août 2026: `docs/design/cadrage.md` n'existe pas encore, l'étape 0.3 étant placée au jalon 2 par la section 3 de ROADMAP.md, donc après celle-ci. Le contrat de configuration de partie se lit en attendant dans `packages/shared/src/reglages.ts`, où `ReglagesPartie` est complet et documenté depuis l'étape 1.5.

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

## Réconciliation, faite le 14 août 2026

Écarts entre cette fiche et l'état réel du dépôt au moment de l'exécuter.

1. **Le cadrage de l'étape 0.3 n'existe pas encore**, l'ordre d'exécution du ROADMAP plaçant 0.3 au jalon 2. Le contrat de configuration de partie a donc été pris dans `packages/shared/src/reglages.ts`. Aucune perte: `ReglagesPartie` couvre les quarante réglages du legacy, groupés et bornés, et la room ne fait que le transporter jusqu'au moteur.

2. **La room porte le terrain, mais ne le décode pas.** Le point 1 du périmètre ne mentionne pas le terrain; le handoff 1.6 le signalait. Le terrain est une option de la room, injectée par l'appelant, exactement comme dans `creerEtatInitial`. Décoder l'image de collision d'une carte demande une dépendance de décodage PNG et le déplacement des images hors de `legacy/`: cela appartient à l'étape qui fera réellement tourner le serveur (2.2), pas à celle-ci. Sans terrain, une partie se joue sur une carte sans mur, ce qui suffit à tout ce que cette étape vérifie.

3. **Le statut « salon » ne porte pas le compte à rebours de cinq secondes.** La fiche liste trois statuts, et le compte à rebours du legacy se déclenche et s'annule par messages (`gameStartCountdown`, `cancelGameStart`): c'est de la couche réseau, donc de l'étape 2.2. `lancer()` lance la partie pour de bon. Rappel pour 2.2: le compte à rebours doit être une donnée qui décroît, pas un `setInterval`, sinon le défaut X1 revient par la fenêtre.

4. **L'unicité du pseudo est traitée ici**, sur consigne du handoff 1.6: c'est une propriété d'un salon, pas d'une chaîne de caractères. Deux pseudos identiques dans une même room sont refusés, la comparaison se faisant sur le texte normalisé et sans distinction de casse. Le legacy ne vérifiait rien.

5. **Le point 3 du périmètre parle des lignes 2350 à 2748 de `server.js`.** Les conditions `isEmptyRoom`, `hasNoOwner` et `wasOwner` sont en réalité aux lignes 2042, 2196, 2251, 2319 et 2751: le legacy recopiait la même règle à cinq endroits, avec des conditions légèrement différentes. Elle est réécrite une seule fois. `wasOwner` n'est pas porté: il sert à une reconnexion, qui suppose une session persistante et appartient à l'étape 2.2.

## Rituel de fin de session

Écrire docs/handoffs/etape-2-1-handoff.md. Décrire l'interface de GameRoom et de RoomManager, car l'étape 2.2 les exposera au réseau. Prochaine action exacte pour l'étape 2.2: définir les contrats d'événements Socket.IO typés et router les événements par room. Commiter.
