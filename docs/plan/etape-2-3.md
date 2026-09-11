# Fiche étape 2.3 - Diffusion en delta binaire

Brief de session. Objectif unique: remplacer la diffusion de l'état complet en JSON par un delta binaire, qui n'envoie que ce qui a changé. C'est le plus gros levier de bande passante et de coût serveur pour les parties à plus de 100 bots.

## Note du 11 septembre 2026: justifiée par la mesure de l'étape 5.1

Cette étape était conditionnée à la mesure de 5.1 (section 3 du ROADMAP). **La mesure la justifie**, et place l'étape après 5.2. Chiffres de départ, dans `docs/mesures/charge-serveur.md`:

- un instantané JSON pèse 21,5 Ko pour une partie de 150 bots et 12 joueurs, et 117 octets de plus par entité;
- soit 3,4 Mbit/s vers chaque joueur, 42 Mbit/s pour une partie pleine;
- compressé (deflate), il pèse 4,3 fois moins: c'est le point de comparaison qu'un format binaire doit battre;
- la sérialisation JSON ne coûte que 0,08 ms par battement à 150 bots: le gain attendu est de bande passante, pas de processeur;
- seuil de régression existant: `OCTETS_PAR_MESSAGE_DE_REFERENCE` dans `tests/charge/seuils.ts`, à mettre à jour avec la nouvelle taille.

## Note du 12 septembre 2026: après l'étape 5.2

L'étape 5.2 a levé le mur de la cadence (`docs/mesures/charge-serveur.md`, mesure de l'étape 5.2). Un processus tient 48 parties pleines au lieu de 16, et c'est désormais un fil réellement plein qui l'arrête. **La bande passante devient la première limite**: 48 parties pleines écrivent 2 Gbit/s. Quatre points à garder en tête:

- la taille des messages n'a pas changé (21 518 octets pour la partie de référence): le point de départ ci-dessus reste exact;
- côté client, décoder un instantané JSON coûte 0,48 ms dans Chromium au processeur ralenti six fois: le gain à viser est de taille, pas de calcul, chez le client comme au serveur;
- l'outil `tests/charge/empreinte.ts` résume l'état du moteur, l'instantané et les notifications de chaque battement. Un changement de format change l'empreinte de l'instantané sans que le jeu change: l'adapter pour résumer séparément ce qui doit rester identique (l'état et les notifications);
- la mesure sous Linux se lance par une branche `mesure-charge/` (`.github/workflows/charge.yml`), pour comparer le flux JSON et le delta sur la même machine;
- **une question à trancher par la mesure en fin d'étape**: le filtrage du flux par zone d'intérêt (candidate 4 de l'étape 5.2), reporté ici. La caméra d'un téléphone ne montre qu'une partie de la carte, et la minicarte ne dessine que les joueurs. Mesurer, avec le format delta, la part du flux qui décrit des bots hors du champ de chaque joueur; si elle est grande et que la bande passante reste la première limite, planifier une étape dédiée au ROADMAP plutôt que de l'ajouter ici. Le point 1 du hors périmètre ci-dessous reste valable pour cette étape.

La fiche a été écrite avant le client. Trois écarts sont à réconcilier en début de session: le client existe et décode déjà le flux JSON derrière l'interface réseau de l'étape 4.1, qui est ce qu'il faut remplacer (point 4 du périmètre, rituel de fin); l'événement diffusé s'appelle `etat` (`InstantanePartie`), pas `updateEntities`; la prochaine action du rituel de fin, l'étape 2.4, est faite depuis longtemps.

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
