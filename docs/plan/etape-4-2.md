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

## Réconciliation, faite le 10 septembre 2026

La fiche supposait trois choses que le dépôt contredit, et en ignorait une quatrième. Les écarts sont repris ici, avec ce qui s'est ajouté à l'exécution.

1. **Les événements `startCapture` et `endCapture` n'existent pas.** Ils appartiennent à la capture par cône du mode tactique de la v0.9.0, écartée du périmètre v1 (section 5 du ROADMAP), et le contrat d'événements de l'étape 2.2 les recense explicitement comme non portés. Dans le mode Classique, on capture en touchant: le moteur résout le contact, le joueur n'a rien à déclencher. Conséquences: aucune commande de capture au clavier, aucune « zone de tap pour la capture » sur mobile, et le test des contrôles ne porte que sur `deplacer`.

2. **L'événement `playerSound` n'existe pas.** Sa suppression est une décision de l'étape 2.2: le son est un réglage local, il n'a rien à faire sur le réseau. Les sons sont déclenchés chez le client, par les notifications reçues et par la comparaison de deux états successifs.

3. **Les ressources n'étaient pas sur la branche.** Seules les six `collision.png` avaient été copiées dans `legacy/` à l'étape 0.1. Fonds, premiers plans, sprites, icônes et sons ont été rapatriés de `master` dans `assets/`, à la racine, en ne gardant que ce qui est réellement affiché ou joué (18 Mo sur 72). Provenance dans `assets/README.md`.

4. **La dette du terrain est soldée ici.** Dessiner une carte sans savoir où sont ses murs n'avait pas de sens: `packages/server/src/terrain.ts` décode l'image de collision et la fournit au moteur. Les six images mesurent 3000x2000 alors que map1 et map2 font 2000x1500: le jeu d'origine les redimensionne sans garder les proportions, le décodage et le décor font de même.

5. **Il n'y a ni page ni empaqueteur.** Ils appartiennent à l'étape 4.3. Le rendu est donc livré comme bibliothèque. Le banc de mesure fait tourner la compilation du paquet client dans Chromium, servie par un petit serveur de fichiers de test et une carte d'importation; la configuration Playwright compile les paquets avant les scénarios.

6. **Le HUD livre sa structure et son contenu, pas son apparence.** La feuille de style se décidera avec les écrans de l'étape 4.3. La minimap ne montre que les joueurs. Les libellés des effets sont ceux du jeu d'origine; « Invincibilité » et « Révélation » de la maquette correspondent aux bonus du même nom, ce qui répond pour moitié à la question ouverte 6 du journal de conception (les trois malus n'apparaissent pas dans la maquette).

7. **Le banc mesure deux choses, et ses seuils portent sur celle qui ne dépend pas du matériel.** L'intégration continue n'a pas de carte graphique: tout y est rasterisé par le processeur, à une dizaine d'images par seconde quelle que soit la charge. Les seuils stricts portent donc sur le coût par image de notre propre code et sur la mise à l'échelle entre 100 et 500 sprites; la cadence absolue n'a qu'un plancher. Les valeurs mesurées sur carte graphique sont consignées dans le handoff.

8. **`tsconfig.tests.json` reçoit la bibliothèque DOM.** Les tests importent désormais des modules du client qui parlent au navigateur; ils doivent être vérifiés avec le même langage que celui qui compile ces modules.

## Rituel de fin de session

Écrire docs/handoffs/etape-4-2-handoff.md. Donner les fréquences d'images mesurées et la structure du rendu. Prochaine action exacte pour l'étape 4.3: construire les écrans de menu (accueil, navigateur, création, salon, fin, profil) en version réduite v1. Commiter.
