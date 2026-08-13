# Fiche étape 4.2 - Rendu in-game PixiJS

Brief de session. Objectif unique: afficher la partie en cours avec PixiJS sur GPU, pour tenir plus de 100 bots animés, et brancher les contrôles. La lueur néon devient un filtre GPU au lieu du shadowBlur coûteux du legacy.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 4.1 (magasin d'état et interface de rendu), puis cette fiche. Référence de portage: legacy/client.js (boucle de rendu Canvas), legacy/MapManager.js (cartes), legacy/AudioManager.js (sons).

## Objectif

Rendre le terrain de jeu et les entités avec PixiJS, piloté par l'état reconstruit du magasin client. Afficher le HUD en surcouche. Brancher les contrôles de déplacement et de capture. Vérifier par la mesure que le moteur de rendu tient la charge cible.

## Périmètre

1. Terrain et entités: porter la logique de rendu de legacy/client.js vers PixiJS. Afficher joueurs, faux ninjas et black ninjas en sprites regroupés sur GPU. La lueur néon est un filtre GPU, pas un shadowBlur par entité.
2. Cartes: porter le rendu des cartes en s'appuyant sur legacy/MapManager.js.
3. Interpolation: lisser le mouvement entre deux ticks reçus, pour un rendu fluide indépendamment de la fréquence des mises à jour réseau.
4. HUD en surcouche: temps restant, classement, effets en cours (invincibilité avec décompte, révélation), et minimap, en surcouche d'interface au-dessus du terrain PixiJS.
5. Contrôles: déplacement au clavier (ZQSD selon la maquette) émettant l'événement move, capture émettant startCapture et endCapture. En plus, contrôles tactiles fonctionnels pour le mobile (manette virtuelle au pouce pour le déplacement, zone de tap pour la capture), selon la décision d'ambition mobile consignée dans docs/design/README.md, le bureau restant prioritaire pour la finition. Respecter les contrats typés.
6. Sons: brancher legacy/AudioManager.js sur les événements sonores (playerSound).
7. Banc de mesure: mesurer la fréquence d'images avec 100, 200 et 500 sprites animés, pour valider le choix PixiJS.

## Hors périmètre

- Aucune construction des écrans de menu. C'est l'étape 4.3.
- Aucune optimisation de rendu prématurée au-delà des bonnes pratiques de regroupement de sprites. Les optimisations conditionnées à la mesure relèvent de la phase 5.
- Le client ne simule pas le jeu, il affiche l'état reçu.

## Tests requis

- Le banc de mesure de fréquence d'images à 100, 200 et 500 sprites, avec les valeurs consignées.
- Un test vérifiant que le nombre d'entités affichées correspond à l'état reçu.
- Un test des contrôles: une touche de déplacement émet bien l'événement move attendu, la capture émet startCapture et endCapture.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Le terrain et les entités s'affichent en PixiJS, lueur en filtre GPU.
2. Le mouvement est interpolé et fluide.
3. Le HUD en surcouche affiche temps, classement, effets et minimap.
4. Les contrôles émettent les bons événements.
5. La fréquence d'images mesurée valide la charge cible, valeurs consignées.

## Rituel de fin de session

Écrire docs/handoffs/etape-4-2-handoff.md. Donner les fréquences d'images mesurées et la structure du rendu. Prochaine action exacte pour l'étape 4.3: construire les écrans de menu (accueil, navigateur, création, salon, fin, profil) en version réduite v1. Commiter.
