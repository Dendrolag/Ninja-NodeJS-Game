# Fiche étape 4.1 - Squelette client et couche réseau

Brief de session. Objectif unique: poser un client propre, avec une séparation nette entre l'état et le rendu, et la couche réseau qui décode le flux delta binaire. C'est l'opposé du legacy, qui mêlait 140 variables globales et l'accès direct au DOM.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 3.3, les handoffs de l'étape 2.2 (contrats typés) et 2.3 (format binaire et reconstruction), le handoff de l'étape 3.2 (authentification), puis cette fiche.

## Objectif

Dans packages/client, créer la structure du client: un magasin d'état séparé du rendu, la connexion réseau authentifiée via les contrats typés, le décodage du flux delta binaire pour reconstruire l'état de jeu, et la gestion des écrans (accueil, navigateur, création, salon, jeu, fin, profil) sur le modèle de la maquette. Aucun rendu PixiJS ici, les écrans sont des coquilles.

## Périmètre

1. Magasin d'état client: une source de vérité unique pour l'état courant (écran affiché, état de jeu reconstruit, données du compte). Aucune variable globale mutable éparpillée.
2. Connexion réseau: se connecter en Socket.IO avec les interfaces typées de packages/shared, en utilisant la session authentifiée de l'étape 3.2.
3. Décodage du flux: décoder les deltas binaires (format de l'étape 2.3) et reconstruire l'état complet de la partie, en partant de l'état de référence puis en appliquant les deltas. Appliquer par-dessus les notifications discrètes (capture, bonus, malus, chat).
4. Gestion des écrans: un état d'écran qui reflète la maquette (accueil, navigateur, création, salon, jeu, fin, profil) et les transitions entre eux.

## Hors périmètre

- Aucun rendu PixiJS. C'est l'étape 4.2.
- Aucune construction visuelle des menus. C'est l'étape 4.3. Ici les écrans sont des coquilles minimales.
- Aucune logique de jeu côté client. Le client affiche l'état reçu, il ne simule pas.

## Tests requis

- TU sur le décodage des deltas et la reconstruction d'état: une suite de deltas reconstruit le même état que le serveur.
- TU sur l'application des notifications discrètes par-dessus l'état reconstruit.
- TU sur la logique de transition entre écrans.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Le magasin d'état existe, sans variable globale mutable.
2. La connexion réseau typée et authentifiée fonctionne.
3. Le décodage du flux reconstruit fidèlement l'état.
4. La gestion des écrans fonctionne.
5. Les TU passent.

## Rituel de fin de session

Écrire docs/handoffs/etape-4-1-handoff.md. Décrire la forme du magasin d'état et l'interface qu'utilisera le rendu. Prochaine action exacte pour l'étape 4.2: porter le rendu in-game vers PixiJS, avec la lueur néon en filtre GPU, et le banc de mesure de fréquence d'images. Commiter.
