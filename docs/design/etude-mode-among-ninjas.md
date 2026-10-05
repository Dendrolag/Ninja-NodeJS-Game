# Étude - Le mode « Among Ninjas » (5 octobre 2026)

Proposition du porteur du projet, posée après l'étape 5.13: un mode de déduction sociale, copie assumée d'Among Us. Des tueurs anonymes éliminent en secret des proies, qui font des tâches sur la carte, signalent les cadavres et votent pour éjecter les tueurs. **Rien n'est décidé.** Ce document dit ce que le jeu a déjà, ce qu'il faudrait construire, ce que ça touche et ce que ça coûte, propose des valeurs de départ et des façons de s'approprier la formule, puis un ordre de construction en étapes. Les questions à trancher sont à la section 19.

L'intention, telle que posée:

1. Des parties en plusieurs tours, qui alternent le jeu et la délibération.
2. Un ou plusieurs tueurs, anonymes pour les autres joueurs, et des proies.
3. Des tâches à faire sur la carte. Les tueurs éliminent les proies en secret.
4. Une proie qui trouve un cadavre le signale, ce qui met fin au tour.
5. Une délibération et un vote pour identifier et éjecter les tueurs.
6. Les proies tuées jouent en fantôme, invisibles des vivants: elles finissent leurs tâches et gênent les tueurs.
7. Une minimap et une carte consultable qui montrent les zones de tâches.
8. Les tueurs ont des tâches de sabotage, voient les tâches des proies sur la carte et ne peuvent pas les faire.
9. Une vision réduite, d'un rayon différent pour les tueurs et les proies. Les pas des autres s'entendent, spatialisés.
10. L'hôte choisit le nombre de tueurs, selon le nombre de joueurs, et le nombre de tâches qui fait gagner les proies. Les rôles sont tirés au sort.
11. Des tâches en mini-jeux (Tetris, touché-coulé, Snake, Space Invaders) et en gestes (aiguiser un katana, nettoyer des lunettes, du sang, relier des couleurs à leur nom, ranger des mines, recharger des munitions, remplir de fumée des bonus fumée).
12. Des sabotages pris dans les malus du jeu: zone d'invisibilité réservée aux tueurs, commandes inversées, négatif, flou.
13. Des tâches à des places fixes de la carte, qui changent d'une partie à l'autre. Tokyo pour l'essai.

## 1. Le verdict en une page

**Faisable sur le socle actuel, et de loin le plus gros mode jamais construit.** Les modes précédents changeaient une règle de capture. Celui-ci ajoute au jeu des choses qu'il n'a jamais eues: des phases (jouer, délibérer, voter), des informations que chaque joueur reçoit différemment, et des mini-jeux dans la page. Ordre de grandeur: six à huit étapes, contre une pour la Chasse.

Trois constats conditionnent tout le reste:

1. **Le secret ne tient pas avec le flux d'état actuel.** Une seule trame part à toute la partie (`packages/server/src/fluxDEtat.ts`, règle 1). Tout ce qu'un joueur ne doit pas voir, un client modifié le lirait: les positions au-delà du rayon de vision, les fantômes, l'auteur d'un meurtre. Le jeu applique déjà le bon principe à la poche (étape 7.10: « la poche ne regarde que son porteur »), mais pas encore à l'état de la carte. **Il faut d'abord un flux par destinataire** (section 3). Cette étude a trouvé au passage que la Chasse a ce défaut aujourd'hui: le flux dit à un traqueur quels ninjas sont de vrais joueurs (section 3.2).
2. **Tokyo convient pour l'essai, avec une vision par rayon seul.** Ses bâtiments ne sont pas des pièces closes: la collision montre des murs ouverts sur au moins un côté, et le détour médian vaut 1,08 (`docs/mesures/etude-structures-de-carte.md`). Calculer ce que les murs cachent coûterait cher pour presque rien sur cette carte (section 7.2). Le Quartier, avec ses cours à une seule porte, serait la carte où l'occlusion par les murs paierait.
3. **Les pas des autres joueurs ne s'entendent pas aujourd'hui.** C'était vrai dans le jeu d'origine, mais l'étape 4.11 l'a exclu (fiche, section « hors périmètre »): seul notre propre pas est joué. C'est à construire, et pas en l'état: envoyer la position exacte d'un pas hors de vue rendrait la vision réduite inutile pour un client modifié (section 7.4).

| Brique                            | Ce qui existe déjà                                                                    | À construire                                                              | Coût      |
| --------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------- |
| Flux par destinataire             | Une trame commune, une poche envoyée à part                                            | Une trame et une référence de delta par joueur, filtrées par le serveur  | Élevé     |
| Rôles tirés au sort               | La Chasse tire ses traqueurs à la graine, au lancement                                 | Révélation privée, tueurs qui se connaissent                              | Faible    |
| Phases jeu, réunion, vote         | La pause (étape 1.7) suspend le temps de jeu                                           | Une machine à phases dans le moteur, l'écran de réunion                   | Élevé     |
| Meurtre, cadavre, signalement     | Le katana, le sang et les traces de pas du Massacre, le bouton de capture              | Le cadavre qui reste, le signalement, la portée et la recharge            | Moyen     |
| Fantômes                          | Le traqueur éliminé de la Chasse, retiré du flux                                       | Un état fantôme qui bouge, invisible des vivants                          | Moyen     |
| Vision réduite                    | La caméra, le filtre de lueur PixiJS                                                   | Le masque sombre dans la page, le filtrage au serveur                     | Moyen     |
| Pas entendus                      | Les sons situés de 4.11, les quatre bruits de pas                                      | Les pas des autres, sans livrer leur position                             | Moyen     |
| Tâches et stations                | Rien                                                                                   | Les stations de la carte, la validation au serveur, chaque mini-jeu       | Élevé     |
| Minimap et carte consultable      | La minimap, limitée à son camp en Chasse                                               | Les stations, la carte plein écran                                        | Moyen     |
| Sabotages                         | Les trois malus dans le moteur, la zone d'invisibilité                                 | Le déclenchement par un tueur, la panne de néons, le sabotage critique    | Moyen     |
| Délibération                      | Le chat de partie (`surChat`, `composants/chat.ts`)                                    | Des canaux (vivants en réunion, fantômes), l'écran de vote                | Moyen     |
| Réglages de l'hôte                | Les réglages de partie validés (`reglages.ts`), imposés par mode depuis la Chasse      | Les réglages du mode                                                      | Faible    |

## 2. Ce que le jeu a déjà, et qui sert

- **Le jeu de règles d'un mode** (`JeuDeRegles`, `packages/sim/src/moteur.ts`): `agir` pour les actions (tuer, signaler, utiliser, voter), `resoudreContacts` vide (plus de capture au contact), `victimeDuMalus` (les proies), `lancer` (le tirage des rôles), `estDecidee` (les conditions de victoire), `horsJeu`. Le mode s'ajoute par les points d'extension, comme les cinq précédents.
- **Le tirage à la graine** (`packages/shared/src/alea.ts`): rôles, tâches de la partie, stations actives. Mêmes entrées, même partie.
- **Le katana du Massacre** (`dansLeCone`, `packages/sim/src/tactique.ts`, rendu `katana.ts`), **son sang et ses traces de pas** (`rendu/sang.ts`, `rendu/traces.ts`, dessin reproductible dérivé de l'identifiant). Un meurtre a déjà un geste, un son et une tache.
- **Les malus** (`TYPES_MALUS`: `controlesInverses`, `flou`, `negatif`), appliqués dans le moteur depuis le 14 août 2026 pour l'inversion, et **la zone d'invisibilité** (`TYPES_ZONE`).
- **La Chasse**: des rôles tirés au sort, une minimap limitée à son camp, l'entrée refusée dans une partie lancée, un joueur hors jeu qui reste classé.
- **La fumée** (étape 7.10): une téléportation, et la preuve que le serveur sait envoyer une information à un seul joueur.
- **Le chat de partie**, déjà signé par la session et limité en débit.
- **La reconnexion** (étape 2.5): trente secondes pour revenir, place et rôle gardés.
- **Les sons situés** (étape 4.11, `sons/espace.ts`): volume et côté selon la distance.

## 3. Le point dur: garder les secrets

### 3.1 Ce qu'un client modifié lirait aujourd'hui

Le flux d'état part en une seule trame, codée une fois pour toute la salle. Le client choisit ensuite quoi dessiner. Pour la zone d'invisibilité, c'est déjà le cas: le serveur envoie les joueurs cachés, la page les efface (`rendu/scene.ts`, `dansUneZoneInvisible`). Ça ne gêne pas un mode où l'invisibilité est un petit avantage. Dans un mode de déduction, chaque information volée finit la partie:

| Secret                                   | Ce que lirait un client modifié avec la trame commune                     |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Les positions hors du rayon de vision    | Tout le monde, partout: la vision réduite n'existe plus                    |
| Les fantômes                             | Leur position, donc qui est mort avant tout signalement                   |
| Le meurtre                               | L'événement et son auteur, donc le tueur                                  |
| Les cadavres                             | Leur position dès la mort, sans avoir à les trouver                       |
| Le rôle                                  | Rien, à condition qu'il ne soit jamais dans le flux (à garantir par test) |
| Les tâches faites                        | Qui fait vraiment des tâches, donc qui fait semblant                      |

Le jeu a une règle pour ça: « Les tests de caractérisation ne figent jamais les failles. Un défaut de sécurité se corrige par conception » (CLAUDE.md). La conception ici, c'est que **le serveur décide ce que chaque joueur reçoit**.

### 3.2 Un défaut trouvé en route: la Chasse livre ses proies

En Chasse, le traqueur doit repérer les vrais joueurs parmi les PNJ. Or le flux décrit chaque entité avec son type: `JoueurVu` (`type: 'joueur'`, avec son pseudo) ou `BotVu` (`type: 'bot'`), et ces champs partent à tous (`packages/shared/src/evenements.ts`, `packages/server/src/instantane.ts`). Un traqueur qui ouvre les outils de son navigateur voit quelles silhouettes sont des proies. Ce n'est noté nulle part. Trop gros pour une étude, il relève de la règle 7: il devient une étape, `2.9`, planifiée au ROADMAP le même jour (section 18).

### 3.3 Le flux par destinataire

Ce qu'il faudrait construire, une fois, pour la Chasse, ce mode et plus tard la Battle Royale (où l'étude du 3 octobre prévoyait déjà « le filtrage par zone d'intérêt », numéro provisoire `2.9`):

1. **Une fonction pure par destinataire**, qui dit ce qu'un joueur voit de l'état: `vuePour(etat, idJoueur)`. Elle est testable sans réseau. En Chasse, elle montre une proie à un traqueur comme un PNJ. Dans ce mode, elle retire ce qui est hors du rayon, les fantômes pour les vivants, les cadavres hors de vue.
2. **Une trame par joueur**, et donc une référence de delta par joueur au lieu d'une par partie. La règle 1 de `fluxDEtat.ts` change, les règles 2 et 3 (images régulières, image pour qui entre) se gardent par destinataire.
3. **Les événements filtrés de la même façon**: un meurtre part au tueur, à la victime, et aux seuls témoins qui voient l'endroit.

Ce que ça coûte: le serveur code jusqu'à douze trames par battement au lieu d'une. Chacune est plus petite: un disque de 260 pixels de rayon couvre 7 pour cent de Tokyo, contre 48 pour cent pour un écran entier, donc moins d'entités par trame. Le débit par joueur baisse, le calcul du serveur monte. À mesurer au banc (`pnpm charge`, nouvelle section de `docs/mesures/charge-serveur.md`). La machine Oracle (étape 5.13) tient vingt-quatre parties pleines: la marge existe, il faut la chiffrer.

Ce qui ne change pas: les modes qui n'ont rien à cacher reçoivent la même vue pour tous. Le serveur peut alors coder une seule trame, comme aujourd'hui. L'empreinte des parties de référence n'est pas touchée: le moteur ne change pas, seule la couche réseau choisit.

## 4. La boucle de jeu

### 4.1 Les phases

```
lancement -> révélation des rôles (5 s)
          -> JEU (les proies font leurs tâches, les tueurs tuent et sabotent)
               fin du tour: un cadavre signalé, ou le gong d'urgence
          -> RÉUNION: discussion (45 s), puis vote (45 s)
          -> ÉJECTION: le résultat du vote (5 s)
          -> retour au JEU, tous replacés autour du point de réunion
          ... jusqu'à une condition de victoire
```

« Tour » dans l'intention du porteur du projet se lit comme un passage de jeu entre deux réunions. C'est le rythme d'Among Us, où aucun tour n'a de durée fixe. **Proposition d'appropriation: un tour à durée maximale**, réglage de l'hôte (aucune, 2, 3 ou 5 minutes). À son terme, la réunion se tient d'office. Ça empêche les tours qui s'éternisent quand personne ne trouve de cadavre, et ça donne au mode le rythme à rebours que les autres modes de Neon Ninja ont déjà.

Dans le moteur, la phase est un état (`jeu`, `reunion`, `ejection`), avec son compte à rebours, et les votes sont des entrées. Pendant la réunion, le temps de jeu ne s'écoule pas, comme en pause, mais les minuteries de la réunion avancent: c'est une phase à elle, pas la pause existante.

### 4.2 Les conditions de victoire

- **Les proies gagnent** quand toutes les tâches sont faites, fantômes compris, ou quand tous les tueurs sont éjectés.
- **Les tueurs gagnent** quand les tueurs vivants sont au moins aussi nombreux que les proies vivantes, ou quand un sabotage critique n'est pas réparé à temps.
- Un tueur qui quitte la partie et ne revient pas dans les trente secondes compte comme éjecté. Une proie qui part retire ses tâches restantes du total.

Pas de chronomètre de partie: la partie finit par une victoire. Le classement de fin est par camp, comme la Chasse avant sa révision, avec le détail par joueur (tâches faites, meurtres, bons votes).

### 4.3 La réunion

- **Déclenchée** par un signalement (une proie ou un tueur près d'un cadavre) ou par le gong d'urgence (un par joueur et par partie, pas dans les 15 premières secondes d'un tour, pas pendant un sabotage critique).
- **Discussion** par le chat existant, en canaux: les vivants parlent entre eux, les fantômes lisent les vivants et parlent entre eux, jamais l'inverse. Le chat des vivants est fermé pendant le jeu, comme dans Among Us. Pas de vocal: les joueurs qui veulent parler utilisent leur propre outil.
- **Vote**: chaque vivant vote pour un joueur ou passe. La majorité relative éjecte, une égalité n'éjecte personne. Votes anonymes ou non, réglage de l'hôte.
- **Éjection**: « X a été éjecté », suivi ou non de « X était un tueur », réglage de l'hôte (« Confirmer les éjections »).
- **Les cadavres sont retirés** à la fin de la réunion.

## 5. Les rôles et le nombre de joueurs

| Joueurs | Tueurs possibles | Proposé par défaut |
| ------: | ---------------- | ------------------ |
|   5 à 6 | 1                | 1                  |
|   7 à 8 | 1 à 2            | 2                  |
|  9 à 12 | 1 à 3            | 2                  |

- **Cinq joueurs au minimum pour lancer, douze au plus**, la capacité des autres modes. À quatre, un seul meurtre réduit la partie à un face-à-face. Le genre se joue bien de sept à dix.
- **Tirage à la graine au lancement**, comme les traqueurs de la Chasse. La révélation part à chaque joueur, seul, comme la poche: « Tu es une proie » ou « Tu es un tueur, avec Y ». Les tueurs se connaissent.
- **Pas d'entrée dans une partie lancée**, comme en Chasse.
- **Les couleurs doivent se nommer.** Toute accusation passe par « j'ai vu Rose ». La palette compte six couleurs, au-delà les couleurs sont tirées (défaut X38, étape 5.8). Il faut ici douze couleurs distinctes, nommées, lisibles sur le décor, et le pseudo affiché au-dessus du ninja quand il est en vue.

## 6. Le meurtre et le cadavre

- **Le geste**: le bouton de capture, réservé au tueur, avec le coup de katana du Massacre. Il prend la proie la plus proche dans une portée de 70 pixels (le ninja en fait une trentaine, le passage médian de Tokyo 128). Recharge de 25 secondes, réglable de 10 à 60, et 10 secondes au début de chaque tour.
- **Le cadavre** reste au sol jusqu'à la fin de la réunion: le sprite du ninja couché du Massacre, à sa couleur, avec sa tache de sang.
- **Proposition d'appropriation: les traces de sang.** Le tueur qui s'éloigne laisse quelques empreintes rouges, comme un joueur qui marche dans le sang en Massacre (`rendu/traces.ts`). Elles s'effacent en une dizaine de secondes. Un indice que les proies lisent, et un risque que le tueur calcule.
- **Le signalement**: le bouton d'action, à 100 pixels d'un cadavre en vue. Un tueur peut signaler sa propre victime, comme dans Among Us: c'est un bluff classique.
- **Pas de meurtre** pendant une réunion, sur un autre tueur, ni sur un fantôme.

## 7. La vision et l'ouïe

### 7.1 Les rayons proposés

| Qui                                         | Rayon proposé | Ce que ça montre                                       |
| ------------------------------------------- | ------------: | ------------------------------------------------------ |
| Proie                                       |       260 px  | Un tiers d'une pièce de Tokyo, 1,7 s de course         |
| Tueur                                       |       380 px  | De quoi choisir sa victime avant d'être vu             |
| Proie pendant la panne de néons             |       110 px  | Juste autour de soi                                    |
| Fantôme                                     |  Toute la carte | Tout, comme dans Among Us                           |

Réglables par l'hôte, en trois paliers par rôle plutôt qu'au pixel. Un écran d'ordinateur montre 1 600 pixels de carte de large (`HAUTEUR_DE_VUE_PX` vaut 900): le cercle de vision tient largement dedans, le reste de l'écran montre le décor assombri, sans personne. Le Tactique a déjà une hauteur de vue à lui (étape 7.7), ce mode pourra en avoir une.

### 7.2 Les murs cachent-ils la vue ?

Dans Among Us, oui: on ne voit pas à travers un mur. Sur Tokyo, la collision le montre, **les bâtiments sont ouverts**: la salle d'arcade s'ouvre au sud sur plus de 200 pixels, le restaurant au nord aussi, la maison et la salle violette n'ont que des pans de murs, et les murs occupent 11 pour cent de la surface. Calculer la ligne de vue (un lancer de rayons sur la grille des murs, au serveur pour filtrer et dans la page pour dessiner) cacherait peu de chose sur cette carte.

**Recommandation: une vision par rayon seul pour l'essai sur Tokyo.** L'occlusion par les murs se garde pour une carte qui a de vraies pièces, le Quartier ou une carte dessinée pour ce mode, et se décide après l'essai.

### 7.3 Le rendu

Un masque sombre sur tout l'écran, percé d'un disque au bord adouci autour de notre ninja, en filtre PixiJS comme la lueur néon. Le décor reste visible et assombri, les ninjas hors du disque ne sont pas dessinés (ils ne sont de toute façon pas envoyés, section 3).

### 7.4 Les pas

Aujourd'hui, la page joue nos seuls pas (`rendu/boucle.ts`, étape 4.11). Ce qu'il faudrait:

- **Les pas des joueurs vivants qui bougent**, entendus jusqu'à 500 pixels, au-delà du rayon de vision: on entend venir quelqu'un avant de le voir. Le volume et le côté suivent `placeDuSon`.
- **Sans livrer la position.** Pour un pas hors de vue, le serveur envoie une direction arrondie (huit secteurs) et une distance en trois paliers, jamais les coordonnées. Assez pour l'oreille, trop peu pour un radar.
- **Les PNJ marchent sans bruit, les fantômes aussi.** Un pas, c'est donc un vivant: un indice de plus, et une raison pour un tueur de s'arrêter.

## 8. Les PNJ

Trois options:

1. **Aucun PNJ.** Le plus proche d'Among Us, le plus éloigné de Neon Ninja.
2. **Une foule neutre**, une quarantaine sur Tokyo, d'un gris uniforme pour ne jamais se confondre avec une couleur de joueur. Ils errent, ne se capturent pas, ne transmettent aucune couleur, ne font pas de bruit. Ils peuplent la vision de silhouettes qui font sursauter, et cachent un peu les cadavres.
3. **Une foule qui sert au jeu**: la foule de l'option 2, plus un déguisement pour les tueurs (prendre l'apparence d'un PNJ quelques secondes, l'idée du camouflage de l'étude du 3 octobre, section 6), et la tâche « ninjas égarés » (section 9.4).

**Recommandation: l'option 2 pour l'essai, l'option 3 ensuite si l'essai plaît.** Pas de Black Ninja, pas d'Évadé, pas de bonus ni de malus ramassables, pas de mines: les sabotages remplacent les malus, et tout ce qui frappe au hasard brouille la déduction.

## 9. Les tâches

### 9.1 Le modèle

Deux façons de compter:

- **Une liste par proie** (Among Us): chaque proie reçoit k tâches tirées au sort, k réglé par l'hôte (2 à 8, 5 par défaut). Les proies gagnent quand la somme est atteinte. Chacun a un alibi à défendre (« j'étais aux bornes d'arcade »), et un tueur qui fait semblant ne sait pas quelle tâche prétendre.
- **Une réserve commune**: N tâches actives sur la carte, N réglé par l'hôte, que n'importe quelle proie fait. Plus simple, plus proche de la lettre de la demande (« le nombre d'activités à faire pour gagner »), mais les alibis s'effacent et une proie rapide fait le travail de toutes.

**Recommandation: la liste par proie**, l'hôte réglant le nombre de tâches par proie. Le total pour gagner s'affiche au salon (« 6 proies x 5 tâches = 30 tâches »).

### 9.2 Ce qui se vérifie au serveur

Un mini-jeu se joue dans la page, que le serveur ne voit pas. Ce qu'il garde en main:

- **La présence**: la proie se tient dans le disque de la station pendant toute la tâche. S'éloigner l'annule.
- **Une durée minimale par tâche**: une demande « tâche finie » plus rapide est refusée. Un tricheur peut sauter le mini-jeu, il ne peut pas aller plus vite qu'un bon joueur, ni faire la tâche de loin.
- **Le rôle**: une demande d'un tueur ne compte jamais.

### 9.3 Les tueurs qui font semblant, et les tâches visuelles

- **Le tueur voit les stations des proies** sur sa carte et peut ouvrir une tâche « pour de faux »: le même écran, sans effet. Les autres ne voient pas qui fait quoi.
- **Proposition: des tâches visuelles**, réglage de l'hôte. Certaines tâches se voient de près (des étincelles pour le katana, une bouffée pour la fumée), et seule une vraie proie peut les produire. C'est une preuve d'innocence, comme le scan médical d'Among Us.
- **La barre des tâches** commune se met à jour toujours, en réunion seulement, ou jamais, réglage de l'hôte. Toujours, elle trahit un tueur qui fait semblant sous les yeux d'une proie.

### 9.4 Le catalogue

Deux familles. Les tâches courtes, des gestes de 3 à 6 secondes. Les tâches longues, des mini-jeux de 15 à 25 secondes, pendant lesquels la proie est vulnérable: c'est voulu, c'est là que le tueur frappe. Chacune doit se jouer au clavier, à la souris et au doigt.

| Tâche                             | Famille  | Geste et critère proposés                                                                 | Durée   | Coût   |
| --------------------------------- | -------- | ----------------------------------------------------------------------------------------- | ------- | ------ |
| Aiguiser un katana                | Courte   | Glisser la lame cinq fois sur la pierre, dans le bon sens                                 | 4 s     | Faible |
| Nettoyer une paire de lunettes    | Courte   | Frotter les deux verres jusqu'à effacer les traces                                        | 4 s     | Faible |
| Nettoyer du sang au sol           | Courte   | Frotter trois taches (le dessin du sang du Massacre)                                      | 5 s     | Faible |
| Relier des couleurs à leur nom    | Courte   | Tirer quatre fils, chaque couleur vers son nom écrit. Lisible des daltoniens: le nom est du texte | 5 s | Faible |
| Ranger des mines                  | Courte   | Glisser quatre mines dans leurs alvéoles                                                  | 5 s     | Faible |
| Recharger des munitions           | Courte   | Glisser cinq cartouches dans le fusil du Tactique                                         | 5 s     | Faible |
| Remplir de fumée les bonus fumée  | Courte   | Maintenir appuyé, relâcher quand la jauge est dans la bande                               | 4 s     | Faible |
| Mini Tetris                       | Longue   | Une grille préparée, placer trois pièces pour faire deux lignes                           | 20 s    | Moyen  |
| Mini Snake                        | Longue   | Manger cinq fruits sur une petite grille, sans se mordre                                  | 20 s    | Moyen  |
| Mini Space Invaders               | Longue   | Abattre une rangée de huit envahisseurs                                                   | 20 s    | Moyen  |
| Mini touché-coulé                 | Longue   | Couler deux bateaux d'une grille de 6 sur 6 en douze tirs au plus. Échec: la grille se retire | 25 s | Moyen |

Chaque mini-jeu est une petite application de la page, avec ses tests. Les tâches longues demandent un réglage fin pour rester dans leur durée, surtout au doigt. **Recommandation: l'essai avec les sept tâches courtes, les quatre longues dans une étape à part.**

Idées de tâches propres à Neon Ninja, à étudier:

- **Ninjas égarés**: rassembler trois PNJ perdus et les ramener au dojo, en se servant du ralliement des ninjas à la suite de la Horde (étape 7.5). Une tâche qui se joue sur la carte et non dans un écran: la proie reste à découvert, mais voit autour d'elle.
- **La ronde des néons**: toucher quatre lampadaires dans l'ordre indiqué, en traversant la rue. Une tâche qui oblige à se déplacer.

### 9.5 D'une partie à l'autre

Chaque carte déclare des **stations à des places fixes**, chacune avec deux ou trois tâches qui lui vont. Au lancement, le moteur tire à la graine les stations actives, la tâche de chacune, puis la liste de chaque proie. Les places ne changent jamais, ce qui s'y fait change. Le nombre de stations actives suit le nombre de tâches demandé.

## 10. Les stations sur Tokyo

Propositions lues sur le décor (`assets/cartes/map1/background.png`) et la collision, en pixels de carte (2000 sur 1500). **À vérifier à l'étape**: chaque station doit tomber dans le morceau principal de la carte (étape 8.10) et hors des murs, et se retourner pour le miroir (x devient 2000 moins x, étape 8.3). La compétence `conception-de-cartes` porte la commande qui mesure.

| Lieu                                   | Place proposée | Tâches possibles                               |
| -------------------------------------- | -------------- | ---------------------------------------------- |
| Bornes d'arcade (salle d'arcade)       | (990, 190)     | Mini Tetris, Mini Snake, Mini Space Invaders   |
| Table de jeu (salle d'arcade)          | (770, 150)     | Mini touché-coulé                              |
| Lavabos (salle d'arcade)               | (700, 340)     | Nettoyer les lunettes                          |
| Pierre du jardin zen                   | (170, 180)     | Aiguiser un katana                             |
| Distributeur à l'entrée du jardin      | (415, 450)     | Remplir de fumée les bonus fumée               |
| Camionnette du parking                 | (1320, 110)    | Recharger des munitions                        |
| Ordinateur de la maison                | (1690, 110)    | Relier des couleurs à leur nom                 |
| Table de la maison                     | (1840, 165)    | Mini touché-coulé, Nettoyer les lunettes       |
| Cuisine du restaurant                  | (630, 1295)    | Nettoyer du sang, Aiguiser un katana           |
| Comptoir du salon                      | (1100, 1350)   | Ranger des mines                               |
| Tapis du salon                         | (1320, 1070)   | Remplir de fumée les bonus fumée               |
| Casiers de la salle violette           | (1760, 1240)   | Recharger des munitions, Ranger des mines      |
| Bureaux de la salle violette           | (1600, 1045)   | Relier des couleurs à leur nom                 |

Les lieux du jeu lui-même:

| Lieu                                   | Place proposée                                  | Rôle                                            |
| -------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Passage piéton central                 | (1145, 630)                                     | Le gong d'urgence, et le point de réunion       |
| Boîtier de la rue                      | (1330, 495)                                     | Réparer la panne de néons                       |
| Lampadaires nord-ouest et sud-est      | (485, 320) et (1860, 890)                       | Les deux consoles du sabotage critique          |
| Les quatre bouches d'égout de la rue   | (210, 700), (740, 700), (1265, 700), (1795, 700) | Les égouts des tueurs (section 15)             |

## 11. Les sabotages

### 11.1 Les nuisances, prises dans les malus

| Sabotage                    | Ce qui existe                                        | Effet proposé                                       |
| --------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| Commandes inversées         | Le malus, appliqué dans le moteur                    | Les proies, 10 s. Les mini-jeux aussi s'inversent ? |
| Négatif                     | Le malus, un filtre de la page                       | Les proies, 10 s                                    |
| Flou                        | Le malus, un filtre de la page                       | Les proies, 10 s                                    |
| Zone d'invisibilité         | La zone, cachée par la page                          | Un disque où les tueurs ne sont vus que des tueurs  |

Les trois malus frappent déjà « les autres »: ici, les proies vivantes. La zone d'invisibilité ne devient fiable qu'avec le flux par destinataire: aujourd'hui, la page efface les joueurs cachés, que le flux envoie quand même.

### 11.2 Ce qui manque à la liste: ce qui force à se regrouper

Les nuisances gênent, elles ne changent pas où sont les proies. Dans Among Us, ce sont les sabotages critiques qui font le jeu: ils obligent les proies à converger, ou à se séparer, au moment que choisit le tueur. Deux propositions dans l'univers du jeu:

- **La panne de néons**: les néons s'éteignent, le rayon des proies tombe à 110 pixels jusqu'à ce qu'une proie répare le boîtier de la rue. Le thème du jeu en fait le sabotage naturel.
- **La surchauffe**: deux consoles, aux deux bouts de la carte, à tenir en même temps par deux proies dans les 45 secondes. Sinon, les tueurs gagnent.

Une recharge commune de 30 secondes entre deux sabotages, un seul actif à la fois, aucun pendant une réunion.

### 11.3 Comment un tueur sabote

- **Depuis la carte plein écran**, n'importe où (Among Us). Le tueur se crée un alibi en sabotant loin de lui. Sur téléphone, c'est la seule façon qui tienne dans deux boutons (section 13).
- **À des stations de sabotage**, comme le suggère « des tâches spécifiques de sabotage ». Le tueur se rend à un poste et y passe deux secondes: il prend un risque, qu'Among Us ne lui fait pas prendre.

La demande se lit de deux façons, à trancher (section 19): des actions de sabotage, ou de vraies tâches de tueur, qui leur donneraient une seconde voie de victoire (une course aux tâches de chaque côté).

## 12. Les fantômes

- **Invisibles des vivants**, et absents de leur flux. Ils se voient entre eux.
- **Vision totale**, vitesse de 150 pixels par seconde comme tout le monde, ou un peu plus. Traverser les murs est le choix d'Among Us: dans le moteur, c'est un déplacement sans collision pour eux seuls.
- **Une proie fantôme finit ses tâches.** Un tueur fantôme peut encore saboter, pas tuer.
- **Ni signalement, ni gong, ni vote.** Ils lisent la réunion et parlent entre eux.

**« Gêner les tueurs », le piège.** Un fantôme sait qui l'a tué. Toute gêne visible des vivants et dirigée vers un tueur trahit ce tueur: si un joueur se met à ralentir sans raison, c'est un tueur. Deux formes sûres:

- **Une gêne que le tueur seul perçoit**: un fantôme proche d'un tueur ralentit la recharge de son katana, et seul le tueur voit un frisson sur son bouton.
- **Une aide qui ne vise personne**: un fantôme répare la panne de néons, ou rallonge de 10 secondes le délai d'une surchauffe.

## 13. La minimap, la carte et les commandes

- **Minimap**: notre position, nos stations à faire (les proies), les stations des proies et les égouts (les tueurs), les sabotages en cours. Jamais les autres joueurs.
- **Carte plein écran**: touche M, et un bouton carte sur téléphone. Elle sert aussi au tueur pour saboter.
- **Le téléphone garde deux boutons** (contrainte de l'étude du 3 octobre, section 5.5). Un bouton d'action, contextuel: utiliser une station, signaler, réparer, sonner le gong, entrer dans un égout. Un bouton de meurtre pour le tueur, celui de la capture. Les sabotages passent par la carte. Une proie n'a donc qu'un bouton.
- **Clavier**: la touche de capture pour tuer, E pour l'action (celle de la poche, qui n'a pas d'objet dans ce mode), M pour la carte.

## 14. Ce que le joueur voit, écran par écran

À dessiner sur planche, comme les étapes 7.9 à 7.12: la révélation du rôle, le cercle de vision, le cadavre et le bouton signaler, l'écran de chaque tâche, la barre des tâches, la carte plein écran des deux rôles, l'écran de réunion (chat, vignettes des joueurs, votes), l'éjection, le fantôme vu par un fantôme, la victoire de chaque camp. Les sons à fournir: la révélation, le meurtre, le signalement, le gong, le vote, l'éjection, la panne et la surchauffe.

## 15. S'approprier la formule

Ce qui ferait de ce mode autre chose qu'une copie, à partir de ce que Neon Ninja a déjà:

| Idée                                   | D'où elle vient dans le jeu       | Pour l'essai ? |
| -------------------------------------- | --------------------------------- | -------------- |
| La panne de néons comme sabotage majeur | Le thème néon, le rayon de vision | Oui            |
| Le tour à durée maximale, puis la réunion d'office | Les modes à rebours     | Oui, en réglage |
| Les traces de sang du tueur            | Le sang et les traces du Massacre | Oui            |
| Les pas qui trahissent les vivants, les PNJ muets | Les bruits de pas, 4.11 | Oui            |
| Les égouts, conduits des tueurs, entre les quatre bouches de la rue | Le décor de Tokyo, la fumée | Après |
| Le déguisement en PNJ                  | Le camouflage de l'étude du 3 octobre | Après     |
| Les ninjas égarés à ramener            | Le ralliement de la Horde         | Après          |
| La gêne des fantômes que le tueur seul perçoit | Section 12                | Après          |
| Des tâches de tueur et une seconde victoire | Section 11.3                  | À trancher     |

## 16. Ce que touche l'ensemble

- **La pureté du moteur**: rien ne la menace. Rôles, tâches et stations se tirent à la graine, minuteries et recharges avancent par le battement. Les mini-jeux sont dans la page, le moteur ne connaît qu'une tâche commencée, interrompue ou finie.
- **Le flux et les événements**: par destinataire (section 3). Le rôle n'y entre jamais, un test le vérifie.
- **La base**: un mode nouveau demande une migration de l'énumération des modes (`MODES`, `packages/shared/src/constantes.ts`). Le résultat d'une partie se lit par camp. De nouveaux faits de partie ouvriront des succès et des défis.
- **CLAUDE.md, comportements à préserver**: le score (1), la capture (2) et le malus (4) ont chacun leur précision par mode. Ce mode en demande une: pas de score en stock, pas de capture, un malus qui frappe les proies.
- **L'empreinte des parties de référence**: identique pour tous les autres modes, à chaque étape.
- **Le téléphone**: deux boutons, et des mini-jeux jouables au doigt.
- **Les rendus**: une planche par étape visible. **Les sons**: provisoires, puis fournis par le porteur du projet.

## 17. Les risques

1. **Le nombre de joueurs.** C'est le premier mode qui ne se joue pas à deux ou trois, et que les PNJ ne peuvent pas compléter: il en faut cinq au minimum, sept pour bien jouer. Les autres modes se lancent seul ou presque. Le mode vivra surtout en parties privées entre amis, avec le lien d'invitation (étape 2.7), et la partie rapide ne devrait pas y mener tant qu'un salon n'a pas cinq joueurs.
2. **La parole.** La déduction se joue en parlant. Le chat suffit à un ordinateur, il est lent au téléphone. Les groupes d'amis joueront avec leur propre outil vocal: c'est ce qu'ils font déjà pour Among Us.
3. **Les mini-jeux**: onze petits jeux, chacun à rendre jouable au doigt et à tester. C'est le gros du coût des tâches.
4. **Le nom.** « Among Us » est une marque d'Innersloth. Les mécaniques d'un jeu ne se protègent pas, son nom et son apparence oui. « Among Ninjas » s'en réclame ouvertement sur une page publique. Je ne suis pas juriste: à vérifier si le jeu grandit. Un nom en français irait aussi avec les autres modes (Horde, Chasse, Massacre): « Traîtres », « Infiltrés », « Le Traître ».

## 18. Plan d'implémentation proposé

Les numéros sont provisoires et suivent la carte thématique du ROADMAP. Les numéros 7.13 à 7.19 sont déjà pris, provisoirement, par l'étude du 3 octobre.

| Ordre | Étape (provisoire)                    | Contenu                                                                                                                                    | Dépend de |
| ----: | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
|     1 | 2.9 Le flux par destinataire          | Planifiée le 5 octobre au titre de la règle 7. La vue par joueur, une trame et une référence de delta par joueur, mesure au banc. Corrige la Chasse. | Rien |
|     2 | 7.20 Le socle du mode                 | Rôles, phases, meurtre, cadavre, signalement, gong, réunion au chat, vote, éjection, victoire, fantômes, vision par rayon. Une seule tâche provisoire (« maintenir le bouton 5 s ») pour jouer | 2.9 |
|     3 | 7.21 Les tâches courtes et les stations | Les stations de Tokyo, le tirage par partie, la validation au serveur, les sept tâches courtes, la minimap et la carte plein écran     | 7.20      |
|     4 | 7.22 Les sabotages                    | Les trois nuisances, la zone d'invisibilité des tueurs, la panne de néons, la surchauffe, le sabotage depuis la carte                       | 7.21      |
|     5 | 7.23 Les pas entendus                 | Les pas des vivants hors de vue, en direction arrondie, les PNJ et les fantômes muets                                                      | 2.9       |
|     6 | 7.24 Les tâches longues               | Les quatre mini-jeux d'arcade                                                                                                              | 7.21      |
|     7 | 7.25 L'appropriation                  | Ce que l'essai aura retenu: égouts, déguisement, ninjas égarés, gêne des fantômes, tâches de tueur                                          | 7.22      |

L'étape 7.20 est jouable seule, entre amis, sur Tokyo: c'est là qu'on saura si la formule prend avant d'investir dans les mini-jeux. Chaque étape se fait comme les étapes 7.9 à 7.12: règles tranchées avec le porteur du projet au début, rendus choisis sur planche, empreinte des parties de référence identique, mesure au banc, version mineure avec sa note.

## 19. Ce qu'il faut au porteur du projet pour lancer la suite

1. **Le nom du mode**: « Among Ninjas », ou un nom en français (section 17.4) ?
2. **Les tâches**: une liste par proie, l'hôte réglant le nombre par proie, ou une réserve commune, l'hôte réglant le total (section 9.1) ?
3. **Les « tâches spécifiques de sabotage »**: des actions de sabotage, depuis la carte ou à des postes, ou de vraies tâches de tueur qui leur donnent une seconde voie de victoire (section 11.3) ?
4. **Les PNJ**: aucun, une foule neutre, ou une foule qui sert au jeu (section 8) ?
5. **Les fantômes qui gênent**: une gêne que le tueur seul perçoit, une aide qui ne vise personne, ou les deux (section 12) ?
6. **Le tour à durée maximale**: le garder comme réglage de l'hôte (section 4.1) ?
7. **L'ordre**: d'accord pour `2.9` d'abord, puis le socle `7.20` joué entre amis avant les tâches ?
