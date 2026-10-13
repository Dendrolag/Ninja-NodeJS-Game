# Étude - Jouer à la manette

Date: 13 octobre 2026
Statut: étude seulement, rien n'est décidé. Les questions au porteur du projet sont en section 10.

## 1. La demande

Étudier la possibilité de rendre le jeu jouable à la manette: une manette de console (Xbox, PlayStation, ou compatible) branchée en USB ou en Bluetooth sur un ordinateur, une tablette ou un téléphone, sans clavier ni souris.

## 2. En bref

- **C'est faisable, et le code s'y prête bien.** Les commandes du jeu sont déjà séparées en deux couches: une classe qui retient ce que le joueur demande (`packages/client/src/controles/controles.ts`), et des branchements minces qui lui transmettent le clavier et le doigt (`clavier.ts`, `tactile.ts`). La manette serait un troisième branchement, sans toucher ni au serveur, ni au moteur, ni au protocole.
- **Le jeu sait déjà recevoir une direction analogique**: la manette virtuelle du tactile en envoie une depuis le début. Un stick de manette donne exactement la même chose.
- **Toutes les tâches d'Among Ninjas se jouent déjà au clavier**, aux flèches et à Espace. Une manette qui imite ces touches les rend jouables sans rien y changer.
- **Ce qui coûte, ce sont les menus**, faits de boutons de page que l'on vise à la souris. Les parcourir à la croix directionnelle demande une couche de navigation à part. Le vote et le sabotage d'Among Ninjas sont dans ce cas.
- **Ce qui ne se fera pas à la manette**: écrire. Le chat, le pseudo, le code d'une partie privée et la connexion demandent un clavier.
- **L'étude a trouvé un défaut** dans l'envoi des directions, qui existe déjà au tactile et que la manette aggraverait (section 8). Il se corrige avant, et indépendamment.

Recommandation: une première étape qui rend **la partie** jouable à la manette (section 6, niveau 1), les menus restant à la souris. C'est l'essentiel de la valeur pour une étape de taille ordinaire.

## 3. Ce qui existe déjà

**Les commandes, côté page.** `Controles` tient l'état de la saisie et ne touche ni au document ni au réseau. À chaque image, la boucle de rendu (`packages/client/src/rendu/boucle.ts`) lui demande s'il y a quelque chose de nouveau à envoyer: une direction, un tir, la poche, le bouton d'action. Elle ne connaît que des gestes, jamais des touches. La traduction des touches en directions est une table pure (`touches.ts`), celle d'une position de pouce en direction est une fonction pure (`intention.ts`).

**Ce que le serveur reçoit.** Une intention de déplacement ne contient qu'une direction, jamais une vitesse (règle de l'étape 1.6). Le moteur ramène toujours le vecteur reçu à la vitesse du joueur. Une manette ne change donc rien au jeu ni à ses règles: elle produit les mêmes messages qu'un téléphone.

**Les gestes d'une partie, et leur touche.**

| Geste | Clavier | Tactile | Modes |
|---|---|---|---|
| Se déplacer | ZQSD, WASD, flèches (8 directions) | Manette virtuelle (toutes directions) | Tous |
| Capturer, trancher, tuer | Espace | Bouton Capturer ou Katana | Tactique, Chasse, Massacre, Among Ninjas |
| Sortir l'objet de la poche | E | Bouton de la poche | Tous sauf Among Ninjas |
| Bouton d'action, tenu | E | Bouton d'action | Among Ninjas |
| Retrouver son ninja | F | Bouton Localiser | Tous |
| Carte plein écran | M | Minimap | Among Ninjas |

**Les tâches d'Among Ninjas.** Les sept gestes et les quatre mini-jeux reçoivent leurs commandes sous une forme commune (`interface/modeles/gestes/commun.ts`): le pointeur, ou l'une de cinq touches, gauche, droite, haut, bas, Espace. Chacun a son mode d'emploi au clavier (`AIDES_DES_TACHES`). Échap ferme la fenêtre.

**Les menus.** Tout ce qui se clique dans la page est un vrai bouton, qui prend le focus et se parcourt déjà à la touche Tab, avec un contour visible. C'est la base sur laquelle une navigation à la manette se poserait.

## 4. Ce que le navigateur offre

L'interface Gamepad des navigateurs donne, pour chaque manette branchée, l'état de ses boutons (enfoncé ou non, et de combien pour les gâchettes) et de ses axes (de moins un à un).

- **On la lit, elle ne prévient pas.** Il n'y a pas d'événement « bouton enfoncé »: on relit l'état à chaque image, et on compare à l'image d'avant. La boucle de rendu tourne déjà à chaque image, c'est là que la lecture se ferait.
- **La disposition standard.** Quand le navigateur reconnaît la manette (Xbox, PlayStation, Switch Pro, la plupart des manettes génériques sous Chrome et Edge), il range ses boutons dans un ordre fixe: le bouton du bas de la croix des quatre boutons est toujours le numéro 0, le stick gauche les axes 0 et 1, et ainsi de suite. Une manette mal reconnue n'a pas cette disposition: la première version l'ignorerait, et le dirait.
- **Rien n'apparaît avant le premier appui.** Pour éviter qu'un site reconnaisse un visiteur à ses manettes, le navigateur ne montre une manette qu'après qu'on a appuyé sur l'un de ses boutons. La page doit donc dire « appuyez sur un bouton » plutôt que « aucune manette ».
- **Il faut une page en HTTPS**, ce qui est le cas en production (Vercel) et en local (localhost).
- **La prise en charge.** Chrome, Edge et Firefox sur ordinateur, Chrome sur Android, Safari sur Mac, iPhone et iPad avec une manette Bluetooth reconnue par le système. La vibration n'existe que sous Chrome et Edge, et partiellement ailleurs. Ces points sont à vérifier sur appareil réel, pas seulement sur la documentation.

## 5. Le plan de boutons proposé

Disposition standard, noms Xbox (entre parenthèses, PlayStation).

| Bouton | En partie | Dans une tâche d'Among Ninjas |
|---|---|---|
| Stick gauche | Se déplacer, toutes directions | Flèches |
| Croix directionnelle | Se déplacer, 8 directions | Flèches |
| A (croix) | Capturer, trancher, tuer: Espace | Espace |
| X (carré) | Poche, ou bouton d'action tenu: E | |
| Y (triangle) | Retrouver son ninja: F | |
| B (rond) | Fermer la carte plein écran | Fermer la tâche: Échap |
| Gâchette droite | Comme A, pour qui préfère tirer à l'index | Espace |
| Vue (Share) | Carte plein écran: M | |

Trois choix derrière ce plan:

- **Chaque bouton imite une touche existante.** Rien de nouveau à expliquer, et les fenêtres qui écoutent déjà le clavier (tâches, carte) n'ont qu'une règle à suivre.
- **Le stick va dans toutes les directions, comme le doigt.** Ce n'est pas un avantage nouveau sur le clavier: le joueur sur téléphone l'a depuis le début.
- **Pencher un peu le stick ne fait pas aller moins vite.** La vitesse est commune à tous depuis l'étape 7.5, et le serveur ne lit que la direction. Une marche lente serait une règle de jeu nouvelle, sans usage dans aucun mode. Une zone morte de 20 pour cent, celle de la manette virtuelle, évite qu'un stick au repos ne fasse partir le ninja.

## 6. Trois niveaux de prise en charge

### Niveau 1: la partie à la manette

Ce qu'on joue avec, une fois dans la partie. Les menus restent à la souris, comme sur un ordinateur de salon où la souris est à portée.

- Un branchement `manetteDeJeu.ts` à côté de `clavier.ts`, lu à chaque image, qui transmet à `Controles` les mêmes appels que le clavier et le doigt. Le nom « manette » est déjà pris par la manette virtuelle du tactile dans tout le code: la manette physique s'appellerait « manette de jeu » pour ne pas les confondre.
- La traduction de l'état de la manette en gestes, en fonction pure testée sans navigateur, comme `touches.ts`: quel bouton vient d'être enfoncé, quel stick dépasse sa zone morte.
- La fenêtre de tâche reçoit les boutons de la manette comme des touches.
- Les indications à l'écran. Le HUD affiche la touche de chaque bouton (« Espace », « E »), l'aide liste les touches, chaque tâche dit son geste au clavier. Quand la manette est la dernière chose touchée, ces libellés deviennent ceux de la manette. Le plus simple est un nom de bouton (« A », « X »), les pictogrammes viennent au niveau 3.
- La perte de focus de la fenêtre relâche tout, comme pour le clavier.
- Les tests: la traduction se teste en unitaire, le branchement en lui donnant une fausse manette. Playwright ne sait pas brancher une manette, mais une page d'essai peut remplacer la lecture de l'état de la manette par la sienne.

Taille: une étape ordinaire.

### Niveau 2: les menus et les écrans d'Among Ninjas

Ce qui permet de ne jamais lâcher la manette, de l'accueil à la fin de partie.

- Une navigation par le focus: la croix ou le stick passe au bouton le plus proche dans la direction poussée, A le clique, B revient en arrière ou ferme la fenêtre. Les boutons existent et prennent déjà le focus: il manque le choix du voisin, qui se calcule sur leurs positions à l'écran.
- Il faut un point de départ sur chaque écran, le bouton principal, et ne jamais perdre le focus quand un écran se redessine. C'est là qu'est l'essentiel du travail, écran par écran.
- Le vote et la carte des sabotages d'Among Ninjas en dépendent: ce sont des boutons qu'on vise.
- Les champs de texte restent hors d'atteinte. Un joueur à la manette joue en invité avec un pseudo tiré au sort, rejoint par « Partie rapide » ou par un lien d'invitation, et ne parle pas au chat. En Among Ninjas, il vote sans débattre: c'est une vraie limite de ce mode, à dire au joueur.

Taille: une étape, peut-être une et demie selon le nombre d'écrans à reprendre.

### Niveau 3: les finitions

Chacune indépendante des autres, à prendre ou non.

- **Les pictogrammes de la manette branchée**: les lettres Xbox ou les symboles PlayStation, reconnus au nom que le navigateur donne à la manette.
- **La vibration**: à la capture, quand on est capturé, au coup de katana. Chrome et Edge seulement.
- **La reconfiguration des boutons**, dans les réglages. `touches.ts` a été écrit pour la permettre un jour, pour le clavier comme pour la manette.
- **Un clavier à l'écran** pour le pseudo et le chat. Coûteux, et utile seulement si le jeu vise un vrai salon sans clavier.

## 7. Ce que l'étude écarte

- **Deux joueurs sur le même écran avec deux manettes.** Le jeu est un multijoueur en ligne à une caméra par joueur: l'écran partagé serait un autre jeu. La première manette qui appuie sur un bouton est celle du joueur, les autres sont ignorées.
- **Viser au stick droit.** Aucun mode ne vise: le tir part dans la direction du déplacement. Le stick droit reste libre.
- **Une marche lente au stick à demi penché**, voir section 5.

## 8. Le défaut trouvé: une direction peut se perdre

**Ce qui se passe.** La page n'envoie une direction que lorsqu'elle change, au plus une fois par image (`Controles.aEmettre`). Le serveur en accepte au plus 60 par seconde, avec une réserve de 10 (`LIMITES_DEBIT.deplacement`, `packages/shared/src/bornes.ts`), et ignore les autres en silence. Mais la page, elle, retient la direction comme envoyée, qu'elle soit acceptée ou non. Si la dernière direction d'un mouvement tombe dans un dépassement, le serveur garde l'avant-dernière, et la page ne la renverra jamais puisqu'à ses yeux rien n'a changé.

**Quand cela arrive aujourd'hui.** Sur un téléphone dont l'écran tourne à 90 ou 120 images par seconde, un pouce qui balaie la manette virtuelle change la direction à chaque image. Au-delà de quelques dixièmes de seconde de balayage, la réserve est vide et une direction sur deux environ est ignorée. Quand le pouce s'arrête, la dernière a une chance sur deux d'être perdue. L'écart est petit, un ou deux degrés, mais le ninja file dans une direction que le joueur n'a pas choisie, jusqu'au prochain mouvement du pouce.

**Pourquoi la manette l'aggraverait.** Un stick tenu en butée n'est jamais parfaitement immobile: ses mesures tremblent de quelques millièmes, assez pour dépasser la tolérance de 0,01 qui décide qu'une direction a changé. Sur un écran d'ordinateur à 144 images par seconde, un joueur qui court tout droit enverrait sans arrêt plus que le serveur n'accepte.

**La correction.** Elle est dans la page et vaut pour toutes les saisies: ne pas envoyer plus d'une direction toutes les 25 millisecondes environ, sous la limite du serveur, et toujours envoyer la dernière quand le délai est passé, même si plus rien ne bouge. C'est un changement de `Controles`, avec ses tests, qui se fait avant la manette et indépendamment d'elle (règle 7).

## 9. Découpage proposé

1. La correction de la section 8, seule.
2. Niveau 1, la partie à la manette.
3. Niveau 2, si le niveau 1 trouve ses joueurs. Rien ne permet aujourd'hui de savoir qui joue à la manette: le niveau 1 pourrait ajouter au bulletin de surveillance de l'étape 5.15, qui dit déjà si l'appareil est tactile, si une manette a servi pendant la partie.
4. Niveau 3, à la carte.

## 10. Questions au porteur du projet

1. **Pour qui?** Un joueur sur ordinateur qui préfère la manette, un joueur sur tablette ou téléphone avec une manette Bluetooth, ou un vrai salon (télévision, console portable comme le Steam Deck)? Le premier cas se contente du niveau 1, le dernier demande le niveau 2 et sans doute le clavier à l'écran.
2. **Le plan de boutons de la section 5 convient-il?** En particulier A pour capturer et X pour la poche.
3. **Commence-t-on par le niveau 1 seul**, les menus restant à la souris?
4. **La vibration** vaut-elle d'être faite pour Chrome et Edge seulement?
5. **Mesure-t-on l'usage de la manette** dans le bulletin de surveillance, pour décider du niveau 2?
