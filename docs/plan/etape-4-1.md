# Fiche étape 4.1 - Squelette client et couche réseau

Brief de session. Objectif unique: poser un client propre, avec une séparation nette entre l'état et le rendu, et la couche réseau isolée derrière une interface. C'est l'opposé du legacy, qui mêlait 140 variables globales et l'accès direct au DOM.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff de `docs/handoffs/` (étape 1.7), le handoff de l'étape 2.2 (contrats typés et couche Socket.IO), puis cette fiche et la section 3 de `docs/plan/ROADMAP.md`, qui porte les adaptations du jalon 1.

## Objectif

Dans packages/client, créer la structure du client: un magasin d'état séparé du rendu, la connexion réseau via les contrats typés de packages/shared, la reconstruction de l'état de jeu à partir du flux, et la gestion des écrans du legacy. Aucun rendu PixiJS ici, les écrans sont des coquilles.

## Périmètre

1. Magasin d'état client: une source de vérité unique pour l'état courant (écran affiché, salon, état de jeu reconstruit, effets et faits récents). Aucune variable globale mutable éparpillée.
2. Connexion réseau: se connecter en Socket.IO avec les interfaces typées de packages/shared. **Exigence de conception du jalon 1: isoler la couche réseau derrière une interface**, pour que le passage éventuel au delta binaire de l'étape 2.3 ne touche qu'elle.
3. Reconstruction du flux: reconstruire l'état complet de la partie à partir du flux d'état, dans un seul module qui sera le seul touché si le format change. Appliquer par-dessus les notifications discrètes (capture, bonus, malus, chat).
4. Gestion des écrans: un état d'écran et les transitions entre eux.

## Hors périmètre

- Aucun rendu PixiJS. C'est l'étape 4.2.
- Aucune construction visuelle des menus, aucune saisie clavier. C'est l'étape 4.3. Ici les écrans sont des coquilles minimales.
- Aucune logique de jeu côté client. Le client affiche l'état reçu, il ne simule pas.

## Tests requis

- TU sur la reconstruction d'état: une suite de messages du serveur reconstruit le même état que celui dont il est parti.
- TU sur l'application des notifications discrètes par-dessus l'état reconstruit.
- TU sur la logique de transition entre écrans.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Le magasin d'état existe, sans variable globale mutable.
2. La connexion réseau typée fonctionne.
3. La reconstruction du flux restitue fidèlement l'état.
4. La gestion des écrans fonctionne.
5. Les TU passent.

## Réconciliation, faite le 18 août 2026

Cette fiche a été écrite dans l'ordre d'exécution d'origine, par couches, où 4.1 arrivait après toute la phase 2 et toute la phase 3. L'ordre en tranches verticales de la section 3 de ROADMAP.md la place au contraire juste après 1.7, ce qui rend caduques trois de ses hypothèses. Les adaptations étaient déjà écrites dans le ROADMAP; elles sont reportées ici, avec ce qui s'est ajouté à l'exécution.

1. **Le rituel de début de session citait des handoffs qui n'existent pas.** Il renvoyait aux étapes 3.3, 3.2 et 2.3, toutes postérieures dans l'ordre d'exécution. Corrigé ci-dessus.

2. **Pas de delta binaire: le flux reste en JSON.** L'étape 2.3 est conditionnée à la mesure de l'étape 5.1 et rattachée au jalon 4. La reconstruction porte donc sur les instantanés complets de l'étape 2.2. Elle est isolée dans `reconstruction.ts`, qui sera le seul fichier à changer si le format évolue, et les tests portent sur le résultat de la reconstruction et non sur la manière dont elle s'y prend: ils garderont leur sens.

3. **Pas de session authentifiée.** L'authentification est l'étape 3.2. L'identité vient de la connexion, comme le serveur la fabrique depuis l'étape 2.2.

4. **Quatre écrans et non sept.** Ceux du legacy: accueil, salon, jeu, fin. Le navigateur de parties et la création arrivent avec l'étape 2.4, le profil avec la phase 3.

5. **Aucune donnée de compte dans le magasin.** Le point 1 du périmètre en prévoyait; elles n'existent pas avant la phase 3.

6. **Un test d'intégration ajouté hors des tests requis.** La définition de terminé demande que la connexion réseau typée FONCTIONNE, ce qu'aucun test unitaire sur banc d'essai ne peut établir. Un test d'intégration monte donc le vrai serveur et un vrai client Socket.IO. Il ne pouvait vivre dans aucun des deux paquets sans créer une dépendance entre eux: il est dans `tests/client/integration/`.

7. **Deux ajouts au magasin, non prévus par la fiche.** Le nom de l'hôte qui a suspendu la partie, que l'annonce de pause porte et que le flux d'état ne porte pas; et les effets en cours, que le contrat d'événements confie explicitement au client depuis l'étape 2.2 (« le client apprend la durée au ramassage et l'affiche »). Ce dernier point est de l'affichage, pas de la simulation: aucune décision de jeu n'en dépend.

## Rituel de fin de session

Écrire `docs/handoffs/etape-4-1-handoff.md`. Décrire la forme du magasin d'état et l'interface qu'utilisera le rendu. Prochaine action exacte pour l'étape 4.2: porter le rendu in-game vers PixiJS, avec la lueur néon en filtre GPU, et le banc de mesure de fréquence d'images. Commiter.
