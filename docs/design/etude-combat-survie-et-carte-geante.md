# Étude - Combat, survie et carte géante (3 octobre 2026)

Neuf idées du porteur du projet, posées après l'étape 3.10. **Rien n'est décidé.** Ce document dit, pour chacune, ce que le jeu a déjà, ce qu'il faudrait construire, ce que ça touche et ce que ça coûte. Il propose ensuite un ordre de construction en étapes, à trancher. Les deux documents qui le précèdent restent la référence sur le très grand (`docs/mesures/etude-grandes-cartes.md`, 16 septembre) et sur la structure d'une carte (`docs/mesures/etude-structures-de-carte.md`, étape 8.1).

Les idées, telles que posées:

1. Une carte géante, 10 000 sur 10 000 au moins, sur plusieurs niveaux, en tuiles pour la performance.
2. La poche qui peut cumuler des objets.
3. Une barre de vie, une barre de bouclier.
4. Des armes: katana, fusil à pulsion, shurikens, mines, nuage de fumée, et d'autres à trouver.
5. Le camouflage: prendre une fausse couleur pendant un temps.
6. Une zone qui se réduit.
7. Le Black Ninja et l'Évadé.
8. Chacun pour soi, le nombre de joueurs, les PNJ.
9. Des PNJ qu'on tue, qui fuient un peu, qui lâchent parfois un objet, et dont le cadavre reste pour dire aux autres qu'on est passé par là.

## 1. Le verdict en une page

| Idée                   | Ce qui existe déjà                                                                         | Faisable sur le socle actuel ?                                                                                    | Coût       |
| ---------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| Carte géante           | Quatre cartes de 3 à 4,2 Mpx, le banc de charge, l'empreinte des parties                   | Non. Quatre plafonds à lever d'abord, plus un cinquième trouvé par cette étude (section 2.3), et le contenu        | Très élevé |
| Plusieurs niveaux      | Rien                                                                                       | Oui, si un niveau est une région de la même image reliée par des passages (section 2.5)                           | Moyen      |
| Poche qui cumule       | Une poche d'une place, deux objets (fumée, mine)                                           | Oui                                                                                                               | Faible     |
| Bouclier               | L'invincibilité (un bonus à durée), la protection d'apparition                              | Oui, comme un objet qui absorbe un coup                                                                            | Faible     |
| Barre de vie           | Rien: tout coup est décisif, une capture ou une mort                                       | Oui techniquement, mais elle change la nature du jeu. À réserver à un mode                                         | Moyen      |
| Armes                  | Le katana (Massacre), le tir en cône (Tactique, Chasse), la mine, la fumée                 | Oui. Le shuriken demande une chose neuve: un projectile qui voyage                                               | Moyen      |
| Camouflage             | Les proies de la Chasse se fondent déjà parmi les PNJ                                      | Oui                                                                                                               | Faible     |
| Zone qui se réduit     | Les crochets du moteur pour finir une partie et mettre un joueur hors jeu (étape 7.3)     | Oui, et dès les cartes actuelles                                                                                  | Faible     |
| Black Ninja, Évadé     | Les deux existent                                                                          | Oui. Reste à dire leur place dans les nouveautés                                                                   | Faible     |
| Joueurs plus nombreux  | 12, 12, 12, 10 et 8 par mode                                                               | Jusqu'à une vingtaine sans rien changer. Au-delà, le flux doit maigrir (filtrage par zone d'intérêt)              | Moyen      |
| PNJ qu'on tue          | Le Massacre tue les PNJ, ses cadavres durent 3,5 secondes, son sang reste au sol           | Oui, comme une nouvelle sorte de PNJ                                                                               | Moyen      |

En deux phrases: **tout sauf la carte géante se construit sur le socle actuel, sur les quatre cartes existantes, et chaque idée y vaut par elle-même.** La carte géante est un chantier de socle et de contenu, qui ne se justifie que par un mode qui en a besoin, une Battle Royale, et qui demande d'abord de trancher la taille, le nombre de joueurs et l'hébergement.

Une recommandation de méthode, tirée de tout le reste: construire d'abord les pièces (zone, bouclier, camouflage, shuriken, gibier) sur les cartes actuelles, les jouer, puis décider si elles forment une Battle Royale qui vaut une carte géante. C'est l'ordre du ROADMAP depuis le début: une tranche jouable, confrontée au réel, avant le chantier lourd.

## 2. La carte géante

### 2.1 Ce que veut dire 10 000 sur 10 000

- **100 millions de pixels**, 33 fois Tokyo (3 Mpx), 24 fois l'ancien Spirit & Time (4,2 Mpx).
- **Le temps de la traverser**: 67 secondes en ligne droite d'un bord à l'autre, 94 en diagonale, à 150 pixels par seconde. Une partie dure 3 minutes par défaut, 10 au plus: on ne fait que deux ou trois traversées.
- **La place de chacun**: à 12 joueurs, 8,3 Mpx par joueur, soit trois Tokyo chacun. Ils ne se croiseraient presque jamais. À 60 joueurs, 1,7 Mpx chacun, un carré de 1 300 pixels de côté, à peine plus que ce que montre l'écran. **Une carte géante n'a de sens qu'avec beaucoup de joueurs, ou avec une zone qui les rapproche** (section 7).
- **Les PNJ**: à la densité de Tokyo et du Quartier (7 580 pixels carrés tenables par PNJ), il en faudrait environ 9 000. Le socle en tient 500 aujourd'hui (2,3 ms par battement sur Spirit & Time, étape 7.6).

### 2.2 Les quatre plafonds déjà connus

L'étude du 16 septembre les a chiffrés, ils tiennent toujours:

| Couche      | Le plafond                                                                                                                     | Ce qui le lève                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Moteur      | Le relevé des contacts examine chaque paire d'entités: coût au carré du nombre. Extrapolé à 9 000 PNJ, environ 650 ms par battement pour 50 de budget | Une grille: chaque entité ne regarde que ses voisines. Coût linéaire. Profite aussi aux modes actuels                 |
| Réseau      | Chaque joueur reçoit toutes les entités                                                                                         | Le filtrage par zone d'intérêt: chacun ne reçoit que ce qui l'entoure. Écarté à l'étape 2.3 « sauf si les cartes grandissent nettement ». Il met fin à la trame unique codée une fois pour toute la salle (`fluxDEtat.ts`): coder par joueur, ou par case de grille regroupée |
| Client      | Le décor est une seule texture par couche, à la taille de la carte                                                              | Le décor en tuiles chargées à la demande. Le dessin limité au champ existe déjà pour les personnages (étape 5.7)       |
| Hébergement | Render en offre gratuite                                                                                                       | Une offre payante, à mesurer (section 2.6)                                                                             |

### 2.3 Un cinquième plafond, trouvé par cette étude: la mémoire au démarrage

Depuis l'étape 8.10, le serveur calcule au démarrage, pour chaque carte, ses places tenables et son morceau principal (`pointsTenables` et le calcul du morceau principal, `packages/sim/src/collisions.ts`). Ce calcul travaille à un octet par pixel, sur deux tableaux, plus une file pour le parcours. À 10 000 sur 10 000, c'est **environ 200 Mo pour les seuls tableaux, et jusqu'à 400 Mo de plus pour la file**, alors que l'offre gratuite de Render donne 512 Mo à tout le processus. Le serveur ne démarrerait pas.

Ce qui le lève: calculer ces données une fois, à la livraison de la carte, et les livrer comme un fichier de plus (un bit par pixel, 12,5 Mo, ou bien moins compressé), au lieu de les recalculer à chaque démarrage. Le contrat d'une carte (compétence `conception-de-cartes`) y gagnerait un fichier, produit par une commande du dépôt.

### 2.4 « En mode tuiles »: deux sens, et le second est le bon

**Premier sens, découper une grande image en tuiles.** Le graphiste dessine 10 000 sur 10 000, un programme découpe en carrés de 1 024 ou 2 048 pixels, la page charge ceux qui sont près de la caméra. Ça règle la mémoire graphique et la taille maximale de texture des téléphones (souvent 4 096 ou 8 192 pixels). Mais pas le contenu: le fond de Tokyo pèse 2,2 Mo pour 3 Mpx, une image géante pèserait de l'ordre de 70 Mo, et il faut quelqu'un pour la dessiner. Le porteur du projet a dit le 16 septembre ne pas avoir cette ressource.

**Second sens, une carte en tuiles réutilisables (un tileset).** La carte n'est plus une image mais une grille de cases, chacune prise dans un jeu de quelques centaines de tuiles dessinées une fois: sol, mur, toit, bord, décor. C'est la technique de la plupart des jeux en vue de dessus. Ce qu'elle apporte:

- **Le contenu devient possible.** Un jeu de tuiles se dessine une fois, ou s'achète sous licence libre (comme la Station lunaire, sous CC BY-NC). La carte se compose dans un éditeur gratuit comme Tiled, qui exporte un fichier de données.
- **Le poids s'effondre.** Une grille de 10 000 sur 10 000 en cases de 32 pixels, c'est 98 000 cases, quelques centaines de Ko, plus le jeu de tuiles.
- **La collision se dérive des tuiles.** Chaque tuile dit si elle est un mur. Un programme du dépôt fabrique `collision.png` à partir de la grille: **le comportement à préserver numéro 9 tient**, la collision reste une image au seuil de 128, produite autrement.
- **Le rendu suit.** PixiJS dessine les cases visibles, regroupées en blocs; c'est la forme pour laquelle le rendu en tuiles est fait.

Le prix: un style graphique plus régulier que les décors peints de Tokyo ou de la Station lunaire, et un chargeur de carte neuf dans la page. Les quatre cartes actuelles ne changent pas: les deux sortes de carte cohabitent.

### 2.5 « Sur plusieurs niveaux »: deux façons, l'une coûte dix fois moins

**Des étages superposés.** Chaque entité gagne une hauteur, chaque calcul de place (contacts, armes, mines, zones, apparition, fuite, chasse du Black Ninja) filtre par étage, chaque étage a sa collision, le rendu montre son étage et estompe les autres. Tout le moteur est touché, et chaque fonctionnalité future devra y penser.

**Des régions de la même image, reliées par des passages.** Le « toit », la « rue » et le « sous-sol » sont dessinés côte à côte dans la même grande image, séparés par du vide que la caméra ne montre jamais. Des escaliers ou des trappes, posés sur la carte, envoient d'une région à l'autre, comme la fumée envoie déjà ailleurs. Le moteur ne gagne aucune dimension: un passage est une case qui déplace qui la touche. Il faut seulement que l'étape 8.10, qui garde toute apparition dans le plus grand morceau d'un seul tenant, accepte plusieurs morceaux reliés par des passages.

La seconde façon donne au joueur la même sensation, monter sur un toit, descendre dans un égout, pour une fraction du prix. Elle marche aussi sur une carte de taille actuelle: une carte de 2 400 sur 1 800 à deux niveaux est un bon premier essai, sans attendre la carte géante.

### 2.6 L'hébergement

**Précision du 3 octobre 2026: le porteur du projet veut rester sur un hébergement gratuit pour l'instant, et toutes ces idées servent un seul but, une Battle Royale.** La question devient: quelle Battle Royale tient sur un hébergement gratuit, et lequel ?

**Ce que donne l'offre gratuite de Render**, sur laquelle tourne le serveur de jeu: 512 Mo de mémoire, un dixième de processeur, 750 heures par mois, et une bande passante sortante comprise dans l'espace de travail. Selon une revue de la plateforme (jwatte.com, « Render.com in Mid-2026 »), cette bande passante comprise est passée de 100 à **5 Go par mois** le 1er août 2026; la documentation de Render ne donne pas le chiffre, qui est **à vérifier dans le tableau de bord de l'espace de travail**. Une fois la bande passante épuisée, Render facture le surplus, ou, sans moyen de paiement enregistré, **suspend le service jusqu'à la fin du mois** (documentation « Deploy for Free »).

Ce que pèse le jeu sur ce fil, la page et les images étant servies par Vercel:

| Partie                                                             | Débit sortant | Par heure de jeu | Heures par mois dans 5 Go |
| ------------------------------------------------------------------ | ------------: | ---------------: | ------------------------: |
| Horde pleine d'aujourd'hui, 12 joueurs, 464 octets par message     |     111 Ko/s |          0,4 Go |                       12 |
| Battle Royale de 30 joueurs, filtrage par zone d'intérêt, 600 octets |     360 Ko/s |          1,3 Go |                         4 |
| Battle Royale de 30 joueurs sans filtrage, 2 000 entités            |     2,1 Mo/s |          7,6 Go |               40 minutes |

Le calcul et la mémoire ferment la porte eux aussi: un dixième de processeur laisse environ 5 ms par battement pour tout le serveur, toutes parties comprises, quand une partie de 1 500 entités en coûterait plusieurs même avec la grille; et 512 Mo ne tiennent pas le calcul des places d'une carte de plus de 5 000 sur 5 000 environ (section 2.3).

**Sur l'offre gratuite de Render, la Battle Royale ne tient donc pas.** Et le chiffre de 5 Go, s'il se confirme, menace le jeu actuel lui-même: une douzaine d'heures de parties pleines par mois suffiraient à suspendre le serveur.

**Une offre gratuite d'un autre ordre existe: Oracle Cloud « Always Free ».** Une machine virtuelle Arm (Ampere A1), 10 To de trafic sortant par mois, et une région à Francfort. La puissance comprise était de 4 cœurs et 24 Go; une source la dit réduite à 2 cœurs et 12 Go depuis juin 2026, à vérifier. Même réduite, c'est vingt fois le processeur et vingt fois la mémoire de Render, et deux mille fois sa bande passante: une Battle Royale de 30 à 50 joueurs y tient, une fois la grille et le filtrage faits. Le prix est ailleurs:

- **Une carte bancaire** est demandée à l'inscription, pour vérifier l'identité, sans débit sur l'offre gratuite.
- **Une machine à tenir soi-même**: système, mises à jour, certificat du domaine, redémarrage. Render faisait tout cela.
- **La mise en ligne change**: `deploiement/` appelle aujourd'hui l'interface de Render; il faudrait pousser vers la machine, par exemple une image Docker lancée par SSH depuis la CI.
- **Les machines A1 gratuites manquent parfois** dans une région, et Oracle récupère une instance gratuite restée inactive. Un serveur de jeu qui tourne n'est pas inactif.

Conclusion: **gratuit, la Battle Royale passe par un changement d'hébergeur du serveur de jeu**, Oracle Always Free, la page restant sur Vercel et la base sur Neon. Sans ce changement, elle attend une offre payante.

### 2.7 Ce qu'il faudrait trancher

La taille visée (10 000 sur 10 000 est-il un minimum ou une image ?), le nombre de joueurs par partie, le nombre de PNJ, le mode qui l'emploie, et le budget d'hébergement. Une piste intermédiaire, à considérer: **4 000 sur 4 000**, 16 Mpx, quatre Tokyo. Elle tient sans tuiles sur la plupart des appareils récents à condition de découper le décor, sans filtrage réseau jusqu'à 1 000 PNJ, avec la grille seule côté moteur, et accueille 24 à 30 joueurs.

**Avec l'hébergement gratuit, la taille se règle d'elle-même.** Sur une machine Oracle Always Free, sans payer, le bon point de départ est une carte de **4 000 à 6 000 pixels de côté**, de 5 à 11 Tokyo, pour **30 à 50 joueurs** et 1 000 à 2 000 PNJ, avec la grille, le filtrage par zone d'intérêt et les données de carte livrées. C'est l'échelle des Battle Royale jouées dans un navigateur: une carte d'une quinzaine d'écrans de large, qu'une zone resserre. 10 000 sur 10 000 reste possible plus tard, sur la même machine, une fois la mesure faite: le socle n'aura pas à changer, seulement le contenu. Sur Render gratuit, aucune taille ne convient (section 2.6).

## 3. La poche qui cumule

**Aujourd'hui** (étapes 7.10 et 7.11): une place. Pleine, elle ne ramasse rien, et l'objet reste par terre pour un autre. Deux objets y vont, la fumée et la mine. Elle se vide à toute prise. Personne d'autre ne sait ce qu'elle contient: elle part au seul joueur, par un message à part.

**Trois façons de cumuler**, de la plus simple à la plus riche:

1. **Empiler le même objet.** Trois mines dans la poche, un compteur sur le bouton. Le bouton reste unique, rien à choisir. Le plafond de trois mines posées par joueur (7.11) reste.
2. **Plusieurs places, une file.** Deux ou trois places; le bouton sert le premier objet entré. Simple au doigt, mais on ne choisit pas.
3. **Plusieurs places, au choix.** Une touche ou un geste pour changer d'objet. Riche au clavier, malcommode au téléphone, où l'écran porte déjà le joystick, le bouton d'arme et le bouton de poche.

**Ce que ça touche.** Le moteur: la poche passe d'un objet à une liste (`Joueur.poche`, `poche.ts`), ramasser vérifie la place restante, toute prise vide toute la liste. Le message privé de la poche, le HUD, le bouton tactile, l'aide. Aucun tirage nouveau: une partie sans objet de poche rejoue à l'octet.

**Ce qui se décide.** Combien de places, et si les bonus ordinaires (vitesse, invincibilité, révélation) peuvent aussi se garder pour plus tard. Ce dernier point change le jeu: aujourd'hui un bonus agit à l'instant, et ses durées se cumulent (comportement à préserver numéro 10). Le garder en poche en ferait une ressource tactique. Une façon de concilier: les bonus ordinaires restent immédiats, et la poche accueille les seuls objets dits « de poche », plus nombreux (sections 4 à 6).

**Recommandation**: la façon 1, empiler le même objet, avec deux places au plus pour deux objets différents servis dans l'ordre. C'est ce qui se joue au pouce.

## 4. La barre de vie et la barre de bouclier

**Aujourd'hui**, tout coup est décisif. En Horde et en Équipes, un contact capture; en Tactique et en Chasse, un tir capture; en Massacre, un coup de katana tue. Cette instantanéité est au cœur du jeu: le score est un stock qu'un seul contact peut vider (comportements à préserver 1 et 2), et c'est ce qui fait la tension de fin de partie.

### 4.1 Le bouclier: oui, partout, comme un objet

Un bouclier qui **absorbe un coup, puis se brise**. Le coup suivant porte normalement. C'est une protection à usage unique, différente de l'invincibilité, qui dure dix secondes par défaut et protège de tout pendant ce temps.

- **Il ne change aucune règle**: il ajoute un cas avant la capture ou la mort. La capture d'un joueur sans bouclier transfère toujours tous ses ninjas.
- **Il se lit d'un coup d'œil**: un anneau autour du ninja, visible de tous, qui éclate quand il prend le coup. Visible, pour que l'attaquant sache pourquoi son contact n'a rien pris.
- **Il demande une règle par mode**, comme la mine en a une: contre quoi protège-t-il ? Un joueur, un Black Ninja, une mine, une arme ? Proposition: contre tout ce qui capture ou tue, sauf la zone qui se réduit.
- **Un détail à régler**: après le coup absorbé, une courte protection (une demi-seconde) pour qu'un contact prolongé ne prenne pas aussitôt le joueur au battement suivant.

Le moteur: un champ de plus sur le joueur, un contrôle dans la capture (`capture.ts`), le Black Ninja (`bots.ts`), la mine (`mines.ts`), le katana et le tir. Le flux: un bit par joueur. Coût faible.

### 4.2 La barre de vie: oui, mais dans un mode à elle

Des points de vie, que chaque coup entame, changent la nature du jeu: plus de capture d'un contact, des échanges de coups, des soins, des duels. Ce n'est plus Neon Ninja tel qu'il se joue depuis deux ans. **Les mettre en Horde casserait ce qui fait la Horde.**

Là où ils prennent sens:

- **Une Battle Royale** (section 7), où l'on meurt une fois, où la zone fait perdre de la vie par seconde, et où les armes ramassées font des dégâts différents.
- **Une variante du Massacre**, où les joueurs ont trois coups à encaisser et les PNJ un seul: les duels deviennent possibles, le massacre de PNJ reste rapide.

Le moteur: des points de vie sur le joueur, une table de dégâts par arme et par mode, une mort qui passe par ce qui existe en Massacre. Le flux: un octet par joueur, une douzaine de joueurs, rien. Le client: une barre au-dessus de chaque ninja de joueur, et la sienne dans le HUD. Coût moyen, dominé par le réglage du jeu.

**Recommandation**: le bouclier d'abord, comme un objet de poche ou un bonus, utilisable partout. La vie seulement avec le mode qui la justifie.

## 5. Les armes

### 5.1 Ce qui existe

| Arme                  | Où                         | Comment                                                     |
| --------------------- | -------------------------- | ----------------------------------------------------------- |
| Katana                | Massacre                   | Un arc de 160 degrés sur 60 pixels, toutes les 400 ms       |
| Tir en cône (fusil)   | Tactique, Chasse           | 90 degrés sur 100 pixels, cinq charges, une toutes les 5 s  |
| Mine                  | Tous les modes, en poche   | Armée par un adversaire, saute 1,5 s plus tard sur 130 px   |
| Fumée                 | Tous les modes, en poche   | Fait reparaître loin des menaces                            |

Deux choses à retenir. Les deux premières armes sont **imposées par le mode**: on ne les ramasse pas. Et la mine a montré la forme qui marche pour un objet utilisable partout: **une conséquence écrite pour chaque mode** (15 pour cent des ninjas en Horde, la mort en Massacre, des points pour une proie en Chasse, la mort pour un Black Ninja).

### 5.2 Ce qu'une arme ramassable demande

Une arme ramassable dans un mode qui n'en a pas, la Horde par exemple, pose la question: **que fait-elle à qui elle touche ?** Une capture à distance ? Elle enlève l'intérêt du contact. Une perte d'une part de ses ninjas, comme la mine ? Un étourdissement ? La réponse se donne par mode, comme pour la mine. La proposition la plus simple: une arme ramassable a des munitions comptées, va dans la poche, et produit en Horde et en Équipes l'effet de la mine (une part des ninjas perdue), en Massacre la mort, en Chasse ce que la mine y fait.

### 5.3 Le shuriken: la seule vraie nouveauté technique

Toutes les armes actuelles frappent dans l'instant: le moteur juge le cône ou l'arc au battement du coup. Un shuriken **voyage**: il part, avance pendant plusieurs battements, rebondit ou se brise sur un mur, touche ce qu'il croise. Il faut:

- **Une nouvelle sorte de chose sur la carte**, avec une place, une direction et une vitesse, que le moteur fait avancer à chaque battement.
- **Sa rencontre avec les murs**, par la carte de collision, en pas assez fins pour ne pas traverser un mur mince.
- **Sa rencontre avec les entités**, par le relevé des contacts, avec la grille si elle existe.
- **Son voyage dans le flux**: un départ, une direction et une vitesse suffisent, la page le fait avancer seule et le serveur dit où il s'arrête. Quelques octets par shuriken lancé.

Coût moyen. Une fois fait, le projectile sert à d'autres armes: kunaï, bombe lancée, filet.

### 5.4 D'autres armes et objets à envisager

Chacun avec ce qu'il réutilise:

| Objet               | Ce qu'il fait                                                         | Réutilise                     |
| ------------------- | --------------------------------------------------------------------- | ----------------------------- |
| Shuriken            | Un projectile qui part droit devant, trois en poche                   | Neuf: le projectile           |
| Leurre              | Un faux soi-même qui part dans une direction, avec sa couleur et son nom | Le comportement d'un PNJ, le camouflage |
| Filet               | Un projectile qui immobilise une seconde au lieu de frapper            | Le projectile                 |
| Grappin, ou bond    | Un saut de 200 pixels dans la direction regardée, pour fuir ou fondre | Le déplacement, la fumée      |
| Sifflet             | Les PNJ proches viennent vers soi pendant trois secondes              | La zone d'attraction          |
| Piège collant       | Une flaque posée qui ralentit qui la traverse                         | La mine posée                 |
| Bouclier            | Absorbe un coup                                                       | Section 4.1                   |
| Camouflage          | Section 6                                                             |                               |

**Recommandation**: le shuriken en premier, parce qu'il ouvre le projectile; puis le leurre et le bond, peu coûteux et très ninja.

### 5.5 Une contrainte transversale: le téléphone

L'écran tactile porte déjà le joystick, le bouton d'arme des trois modes armés et le bouton de poche. Chaque objet nouveau doit passer par l'un des deux boutons existants. C'est un argument de plus pour que les armes ramassables aillent dans la poche, et pour la poche qui empile (section 3).

## 6. Le camouflage

**Aujourd'hui**, la couleur est l'identité: elle dit qui est qui, et en Horde elle dit à qui sont les ninjas (le score est le nombre de ninjas à sa couleur). La Chasse a déjà son camouflage: les proies se fondent parmi les PNJ.

**Deux façons**:

1. **Se fondre parmi les PNJ.** Pendant le temps du camouflage, les autres voient le joueur avec une couleur de PNJ quelconque, sans pseudo, et ne le voient plus sur la minimap. C'est le jeu de la Chasse, rendu disponible partout.
2. **Prendre la couleur d'un autre joueur.** Plus retors, plus confus: deux ninjas de la même couleur sur la carte, et on ne sait plus lequel est le vrai.

**Le piège de la Horde.** Un joueur camouflé suivi de sa horde de ninjas à sa vraie couleur se trahit. Pour que le camouflage tienne, il faut que **ses ninjas prennent aussi la couleur apparente**, aux yeux des autres. C'est faisable sans toucher aux règles: le moteur garde les vraies couleurs, et ce qui part dans le flux remplace, pour tous les autres, la couleur du joueur camouflé par sa couleur apparente. Le joueur camouflé, lui, connaît son identifiant et se voit tel qu'il est.

**Ce qui doit rester vrai.** La contagion entre ninjas (comportement à préserver numéro 11) suit les vraies couleurs: un camouflé ne cesse pas d'être un joueur. Le Black Ninja n'est pas trompé, c'est une machine. Le classement à l'écran montre la vraie couleur, ou la masque, à décider. Le bonus Révélation, qui existe déjà, devient le contre naturel: il montre les camouflés.

**Une subtilité technique.** Le flux d'état est codé une seule fois et envoyé à tous (étape 2.3). La couleur apparente doit donc être la même pour tous les autres joueurs: c'est le cas dans les deux façons. Seul le camouflé doit se voir autrement, et sa page le sait déjà.

**Coût faible.** Un objet de poche, une durée, une couleur apparente dans l'état et dans le flux, et un rendu de transition (un fondu, ou une bouffée de fumée). **Recommandation**: la façon 1, se fondre parmi les PNJ, avec Révélation comme contre.

## 7. La zone qui se réduit

**Aujourd'hui**, rien. Mais le moteur a les crochets qu'il faut depuis la Chasse (étape 7.3): un mode peut dire qu'une partie est décidée avant son terme (`estDecidee`) et mettre des joueurs hors jeu (`horsJeu`).

**Comment elle se construit.** Un cercle dont le centre et le calendrier se tirent de la graine de la partie au lancement: il reste grand un moment, puis se resserre par paliers jusqu'à un petit cercle final. Tout se déduit du temps écoulé et de la graine: **la page peut le dessiner seule**, sans que le flux le porte à chaque battement, comme la course du vaisseau de la Station lunaire (étape 8.9).

**Ce qui arrive dehors** se décide par mode:

| Mode      | Proposition                                                                 |
| --------- | --------------------------------------------------------------------------- |
| Horde     | On perd un ninja par seconde passée dehors, qui redevient neutre             |
| Équipes   | Pareil                                                                      |
| Massacre  | La mort au bout de cinq secondes dehors, ou une perte de vie si la vie existe |
| Tactique  | Comme la Horde, ou une charge perdue                                         |
| Chasse    | Sans objet: la Chasse a déjà sa propre tension                              |

**Ce qui doit suivre la zone**: toute apparition (joueurs, PNJ, objets, mines de zone, Évadé, retour après fumée) se fait dedans. Les PNJ dehors errent vers l'intérieur, ou disparaissent. Il faut le vérifier partout où l'étape 8.10 a posé sa règle du morceau principal: c'est la même liste.

**Sur les cartes actuelles, elle a déjà du sens.** Un Massacre ou une Horde sur Spirit & Time, dont la fin se resserre au milieu de la terrasse, change la fin de partie sans rien d'autre de neuf. Elle peut donc naître comme un **réglage de partie**, au salon, avant d'être le cœur d'une Battle Royale.

**Coût faible**: le cercle et sa règle dans le moteur, un réglage, le dessin du bord, de l'extérieur assombri et du cercle suivant sur la minimap, un avertissement au HUD.

## 8. Le Black Ninja et l'Évadé

Les deux existent: le Black Ninja depuis le jeu d'origine, l'Évadé depuis l'étape 7.9. La question est leur place dans ce qui vient:

- **Avec le bouclier**: un Black Ninja qui touche un bouclier le brise sans rien prendre.
- **Avec le camouflage**: le Black Ninja n'est pas trompé (proposition), ce qui le rend plus redoutable pour un camouflé qui se croit à l'abri.
- **Avec la zone**: le Black Ninja reste dedans, l'Évadé aussi, et l'Évadé, déjà très difficile à attraper sur une carte ouverte, le devient moins quand la zone se resserre.
- **Sur une carte géante**: leur nombre doit suivre la surface, et la recherche de cible du Black Ninja, qui parcourt aujourd'hui toutes les entités, passe par la grille.

Aucune construction propre, seulement des règles à écrire dans chaque étape qui touche l'un des deux.

## 9. Chacun pour soi, le nombre de joueurs, les PNJ

**Chacun pour soi existe**: c'est la Horde, le Tactique et le Massacre à plusieurs. Les Équipes sont le seul mode collectif, la Chasse oppose deux camps.

**Le nombre de joueurs.** La capacité est une propriété du mode (12, 12, 12, 10, 8), pas une limite du serveur. Les mesures disent que le calcul d'une partie ne dépend presque pas de ses joueurs; ce qui grandit avec eux est le flux, envoyé à chacun: 0,07 Mbit/s par joueur à 150 PNJ, 0,20 à 500. Sur les cartes actuelles:

- **Jusqu'à une vingtaine de joueurs**, rien à changer côté technique. La vraie question est de jeu: à vingt sur Tokyo, on ne fait plus que se croiser, et la capture d'un joueur, qui transfère tous ses ninjas, devient une loterie. Plus de joueurs veut plus de place.
- **Au-delà de trente**, le filtrage par zone d'intérêt devient utile pour la bande passante, et la carte doit grandir.

**Les PNJ.** Les plafonds par carte (300, 360, 340, 190) donnent la même densité partout. Une carte de 4 000 sur 4 000 en accueillerait environ 1 500 à cette densité; c'est là que la grille du moteur devient nécessaire (le coût double à peu près quand le nombre passe de 300 à 500).

## 10. Des PNJ qu'on tue: le gibier

**L'idée**: une nouvelle sorte de PNJ, distincte des faux ninjas. On peut le tuer, il fuit un peu, il lâche parfois un objet, et son cadavre reste, si bien qu'un joueur qui passe voit qu'un autre est passé par là.

**Ce qui existe et se réutilise**:

- **Tuer** existe en Massacre, avec ses morts, son sang et ses cadavres. Hors Massacre, sans arme, la façon simple est le contact: toucher un gibier le tue.
- **Fuir** existe avec l'Évadé, qui essaie seize caps toutes les 250 ms. Pour un gibier, une version plus douce et moins chère: fuir le joueur le plus proche à moins de 150 pixels, à la vitesse d'un PNJ ou un peu moins, donc rattrapable.
- **Lâcher un objet** se tire de la graine de la partie, comme toute apparition d'objet.
- **Le cadavre qui reste**: aujourd'hui, un cadavre du Massacre s'efface en 3,5 secondes, et le sang s'imprime sur un calque de sol qui ne coûte plus rien une fois dessiné. Un cadavre qui reste toute la partie s'imprime de la même façon: coût nul. Et il est le même pour tous, puisque la mort part à tous en notification.

**Ce que le gibier apporte au jeu.** Une raison de traverser la carte, une récompense, et surtout **une information**: les cadavres disent où les joueurs sont passés. C'est un contre naturel au camouflage et à la fumée, et un bon outil de traque dans une grande carte. Il sert aussi une Battle Royale, où l'on cherche de quoi s'armer.

**Ce qu'il faut décider.** Ce que rapporte un gibier tué (des points, un objet, rien que l'objet lâché), à quelle fréquence il lâche quelque chose, combien il y en a, s'il compte dans le score en Horde (attention au comportement à préserver numéro 1: le score y est un stock de ninjas, un gain par gibier serait rangé comme les points de Black Ninja), et dans quels modes il vit.

**Ce que ça touche.** Une sorte d'entité nouvelle dans le moteur (`TypeEntite`), dans le flux binaire et dans le rendu (un sprite à lui, à dessiner). C'est le plus coûteux de ce groupe d'idées après le shuriken, sans difficulté de principe.

## 11. Ce que touche l'ensemble, de façon transversale

- **La pureté du moteur** n'est menacée par aucune idée: tout hasard passe par la graine, tout temps par le battement.
- **L'empreinte des parties de référence**: chaque nouveauté désactivée doit rejouer les parties à l'octet, comme pour la fumée, la mine et l'Évadé. C'est la règle « aucun tirage sans la nouveauté ».
- **Le flux binaire** change pour le bouclier, le camouflage, le gibier, le projectile et la vie. La page d'un autre commit est déjà refusée (`VERSION_DU_JEU`): pas de compatibilité ascendante à tenir.
- **La base**: un mode nouveau demande une migration de l'enumeration des modes; de nouveaux faits de partie ouvrent des succès et des défis de la semaine.
- **Les comportements à préserver**: aucun n'est changé par le bouclier, le camouflage, la zone en réglage, le gibier ou le shuriken, à condition d'écrire leurs règles mode par mode. La vie en changerait plusieurs: d'où un mode à elle.
- **Le téléphone**: deux boutons, pas un de plus (section 5.5).
- **Les rendus**: chaque nouveauté visible demande une planche choisie par le porteur du projet, comme pour les étapes 7.9 à 7.12.
- **Les sons**: provisoires, puis fournis par le porteur du projet, comme pour la fumée et les mines.

## 12. Plan d'implémentation proposé

Deux voies, indépendantes. La première enrichit le jeu actuel, sur les cartes actuelles, étape par étape, chacune jouable seule. La seconde prépare la carte géante, et ne se lance qu'une fois les questions de la section 2.7 tranchées. Les numéros sont provisoires; ils suivent la carte thématique du ROADMAP.

### Voie A - Les pièces, sur les cartes actuelles

| Ordre | Étape (provisoire) | Contenu                                                                                                  | Dépend de |
| ----: | ------------------ | -------------------------------------------------------------------------------------------------------- | --------- |
|     1 | 7.13 La zone qui se réduit | Un réglage de partie dans les modes où elle a sens, ses règles par mode, son dessin et sa minimap         | Rien      |
|     2 | 7.14 La poche qui empile   | Deux places, objets empilés, compteur sur le bouton                                                     | Rien      |
|     3 | 7.15 Le bouclier           | Un objet de poche, ou un bonus, qui absorbe un coup, ses règles par mode, son anneau                     | 7.14 si en poche |
|     4 | 7.16 Le camouflage         | Se fondre parmi les PNJ, couleur apparente dans le flux, ses ninjas compris, Révélation comme contre     | 7.14      |
|     5 | 7.17 Le shuriken           | Le projectile dans le moteur et le flux, la première arme ramassable, ses règles par mode                | 7.14      |
|     6 | 7.18 Le gibier             | Une sorte de PNJ qu'on tue, qui fuit, lâche un objet, laisse un cadavre durable                          | 7.17 utile, pas nécessaire |
|     7 | 8.11 Une carte à deux niveaux | Plusieurs morceaux reliés par des passages, une carte de travail de taille actuelle                  | Rien      |

Chaque étape se fait comme les étapes 7.9 à 7.12: règles tranchées avec le porteur du projet au début, rendus choisis sur planche, empreinte des parties de référence identique nouveauté coupée, mesure au banc, version mineure avec sa note.

### Voie B - Le socle de la carte géante, puis la Battle Royale

| Ordre | Étape (provisoire) | Contenu                                                                                                       |
| ----: | ------------------ | ------------------------------------------------------------------------------------------------------------- |
|     0 | 5.9 Le serveur de jeu sur Oracle Always Free | Une machine gratuite, la mise en ligne par la CI, la bascule depuis Render, `docs/deploiement.md` réécrit |
|     1 | 5.10 La mesure en grand  | Le banc à 2 000, 5 000 et 10 000 PNJ sur une grande carte sans mur, et la mémoire au démarrage (section 2.3) |
|     2 | 5.11 La grille du moteur | Contacts, cible du Black Ninja, fuite, apparition par partition spatiale; empreinte identique             |
|     3 | 8.12 Les données de carte livrées | Places tenables et morceaux calculés à la livraison, plus au démarrage                         |
|     4 | 4.10 La carte en tuiles   | Le chargeur d'une carte faite d'un jeu de tuiles, la collision qui s'en dérive, le dessin par blocs visibles |
|     5 | 2.9 Le filtrage par zone d'intérêt | Chacun ne reçoit que ce qui l'entoure                                                         |
|     6 | 8.13 La carte géante      | Le contenu, mesuré au banc et sur l'hébergement visé                                                 |
|     7 | 7.19 La Battle Royale     | Le mode: une vie, la zone, les armes ramassées, le gibier, 30 à 60 joueurs                             |

Les étapes 1 à 3 de la voie B profitent aussi au jeu actuel: la grille rend moins chères les cartes pleines, les données livrées accélèrent le démarrage. Elles peuvent se faire avant toute décision sur la taille.

### Ce qu'il faut au porteur du projet pour lancer la suite

1. **La voie A, dans cet ordre ou un autre ?** Et pour chaque étape, les règles se trancheront à son début, comme d'habitude.
2. **La poche**: empiler, deux places servies dans l'ordre, ou autre ? Les bonus ordinaires restent-ils immédiats ?
3. **La vie**: d'accord pour la réserver à un mode (Battle Royale, ou une variante du Massacre) ?
4. **Le camouflage**: se fondre parmi les PNJ, ou prendre la couleur d'un autre joueur ?
5. **Le gibier**: dans quels modes, et que rapporte-t-il ?
6. **L'hébergement et la taille**: d'accord pour déplacer le serveur de jeu sur Oracle Always Free, condition d'une Battle Royale gratuite (section 2.6) ? Et une carte de 4 000 à 6 000 de côté pour 30 à 50 joueurs comme première cible (section 2.7) ?
7. **Les niveaux**: d'accord pour des régions reliées par des passages plutôt que des étages superposés ?
