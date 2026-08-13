# Fiche étape 2.3 - Diffusion en delta binaire

Brief de session. Objectif unique: remplacer la diffusion de l'état complet en JSON par un delta binaire, qui n'envoie que ce qui a changé. C'est le plus gros levier de bande passante et de coût serveur pour les parties à plus de 100 bots.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 2.2 (charge utile du flux d'état), puis cette fiche.

## Rappel du problème

Le legacy reconstruit tout l'état (tous les joueurs, bots, black bots, bonus, malus, zones) et l'émet en JSON à chaque tick, à chaque client (server.js, fonction sendUpdates). À plus de 100 entités, c'est coûteux en sérialisation et en bande passante. On remplace ce flux par un delta binaire. Les notifications discrètes de l'étape 2.2 ne changent pas, elles restent des événements.

## Objectif

Encoder l'état d'une room sous forme binaire compacte, calculer le delta entre l'état précédent et l'état courant par client, et n'émettre que ce delta. Le client reconstruit l'état complet à partir des deltas successifs.

## Périmètre

1. Définir un format binaire compact pour les entités et leurs attributs variables (position, direction, état). Le format vit dans packages/shared, partagé entre serveur et client.
2. Calculer le delta: pour chaque room et chaque envoi, déterminer ce qui a changé depuis le dernier état confirmé (entités apparues, disparues, modifiées), et n'encoder que cela.
3. Émettre le delta binaire à la place de updateEntities, par room.
4. Côté serveur, fournir le décodeur correspondant pour les tests. Le décodage côté client réel sera utilisé à l'étape 4.1, mais le décodeur partagé doit exister et être testé ici.
5. Gérer l'état de référence: un nouveau client, ou un client désynchronisé, doit pouvoir recevoir un état complet de départ avant de recevoir des deltas.

## Hors périmètre

- Aucune optimisation de culling par zone d'intérêt ici. Si tous les bots sont visibles à l'écran, le culling n'apporte rien. C'est une piste de la phase 5, conditionnée à la mesure et à la taille de carte.
- Aucune modification de la logique de jeu ni des notifications discrètes.
- Pas d'intégration au rendu. C'est la phase 4.

## Tests requis

- TI vérifiant qu'encoder puis décoder un état redonne le même état (aller-retour fidèle).
- TI vérifiant la correction du delta: appliquer une suite de deltas à un état de départ reconstruit le même état que le serveur.
- TI sur l'état de référence: un client qui rejoint reçoit un état complet exploitable.
- Mesure: comparer la taille des messages delta à la taille de l'ancien état JSON complet, sur une room peuplée, et consigner le gain.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Le format binaire et le calcul de delta existent dans packages/shared.
2. L'aller-retour encodage décodage est fidèle, et la reconstruction par deltas est correcte.
3. La réduction de taille par rapport au JSON complet est mesurée et consignée.
4. Les TI passent.

## Rituel de fin de session

Écrire docs/handoffs/etape-2-3-handoff.md. Décrire le format binaire et le protocole de reconstruction, car le client de l'étape 4.1 décodera ce flux. Donner le gain de taille mesuré. Prochaine action exacte pour l'étape 2.4: matchmaking, parties privées et publiques. Commiter.
