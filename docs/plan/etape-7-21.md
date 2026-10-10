# Fiche étape 7.21 - Among Ninjas, les tâches courtes et la carte

Brief de session. Objectif unique: remplacer la tâche provisoire d'Among Ninjas (tenir le bouton d'action à une station) par les sept tâches courtes de l'étude, de petits gestes de quatre à cinq secondes joués dans la page, et donner au mode sa carte plein écran. En réglage de l'hôte: les tâches visuelles, preuves d'innocence, et la barre commune des tâches (toujours, en réunion, jamais). Les tâches longues (mini-jeux d'arcade), les sabotages et les pas entendus restent aux étapes suivantes.

## Origine de cette fiche

Rédigée le 10 octobre 2026, au début de l'étape, selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2): aucune fiche n'avait été fournie. Sources: la section 18 de l'étude `docs/design/etude-mode-among-ninjas.md` (le contenu de l'étape), ses sections 9 (les tâches), 10 (les stations), 13 (la carte et les commandes) et 21 (le socle construit), la fiche 7.20 prise comme modèle, le handoff `docs/handoffs/etape-7-20-handoff.md`, et l'état du dépôt au commit `62d1777`. La section 8 de l'étude (les PNJ) ne concerne pas cette étape: la foule neutre reste celle de 7.20.

**Aucune référence de comportement.** Ni la v0.8.6 ni la v0.9.0 n'ont ce mode: rien à caractériser. Les règles ci-dessous font foi, avec celles de la fiche 7.20.

**Numéro**: 7.21, dans la phase 7, « Modes de jeu ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (7.20, ou le handoff partiel de cette étape), cette fiche, `.claude/rules/sim-purity.md`, les sections 9, 10, 13 et 21 de l'étude, et la fiche 7.20.

**Les règles et les valeurs ci-dessous sont des propositions**, à confirmer par le porteur du projet avant de construire (section « Valeurs à confirmer »). Les rendus se choisissent ensuite sur planche, comme à l'étape 7.20.

## Décisions du porteur du projet

Du 5 et du 6 octobre 2026 (demande et section 20 de l'étude), et du 10 octobre 2026 (handoff 7.20):

1. **Des tâches en gestes**: aiguiser un katana, nettoyer des lunettes, du sang, relier des couleurs à leur nom, ranger des mines, recharger des munitions, remplir de fumée des bonus fumée. Les mini-jeux d'arcade viennent à l'étape 7.24.
2. **Une liste de tâches par proie**, tirée à la graine, à des stations fixes de Tokyo dont la tâche change d'une partie à l'autre (inchangé depuis 7.20).
3. **Une minimap et une carte consultable** qui montrent les zones de tâches. Les assassins voient les tâches des proies et ne peuvent pas les faire.
4. **Le mode ne se déploie qu'avec ses étapes suivantes**, sur accord du porteur du projet: `master` ne se pousse pas à la fin de cette étape. Avant toute poussée, la suite de bout en bout complète se rejoue.
5. **Les sons des tâches** sont prévus dans cette fiche, pour que le porteur du projet les fournisse (section « Les sons »).

## Deux sujets ouverts à l'étape 7.20, à trancher en début d'étape

### Le cercle de vision dépasse l'écran

Depuis le cadrage serré de 7.20 (le plus petit côté de l'écran montre 450 pixels de carte, `COTE_DE_VUE_AMONG_PX`), le diamètre du cercle d'une proie (520 pixels au palier normal) et d'un assassin (640) dépasse l'écran en hauteur sur ordinateur, et en largeur sur un téléphone en portrait. L'écart entre les paliers ne se voit donc plus que dans un sens. Trois façons d'en sortir:

- **A. Resserrer les paliers de vision** à la mesure du cadrage, en gardant leurs rapports. Proposé: proie 140, 180 (défaut) ou 225; assassin 180, 225 (défaut) ou 265. Le cercle d'une proie tient dans l'écran avec une marge, celui d'un assassin le touche au palier normal. Le jeu devient plus étouffant.
- **B. Desserrer le cadrage** pour que le plus grand cercle de la partie tienne: le plus petit côté montre le diamètre du cercle de l'assassin plus une marge, 720 pixels aux paliers par défaut. Les ninjas redeviennent plus petits, ce que le cadrage serré corrigeait.
- **C. Un cadrage par rôle**, celui de son propre cercle plus une marge. Rien ne fuit vers les autres joueurs (seul notre écran change), mais un assassin voit ses ninjas plus petits que ses victimes ne les voient.

**Recommandation: A.** Le porteur du projet a voulu le cadrage serré, et c'est la vision qu'il faut mettre à sa mesure. Le changement tient dans `RAYONS_DE_VISION` et ses tests.

### Les sons à fournir

Ceux de 7.20 (le meurtre, l'alerte de la victime, le gong, la réunion, l'exécution) attendent toujours, avec des sons du jeu en provisoire. Ceux des tâches sont listés à la section « Les sons ».

## Valeurs à confirmer par le porteur du projet

Les propositions de l'étude, précisées par cette fiche. Toutes se révisent après une partie d'essai.

### Les sept tâches courtes

Chacune se joue à la souris, au doigt et au clavier (étude, section 9.4). La « durée visée » est celle d'un joueur moyen; la « durée minimale » est ce que le serveur exige entre l'ouverture de la tâche et sa fin (section suivante).

| Tâche                            | Au pointeur (souris, doigt)                                                  | Au clavier                                                       | Visée | Minimale |
| -------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----: | -------: |
| Aiguiser un katana               | Glisser la lame sur la pierre, de la garde à la pointe, cinq fois            | Flèche droite, cinq fois; chaque passe se joue en entier         |   4 s |      3 s |
| Nettoyer une paire de lunettes   | Frotter les deux verres jusqu'à effacer les traces                           | Flèches pour le verre, Espace tenu pour frotter                  |   4 s |      3 s |
| Nettoyer du sang au sol          | Frotter trois taches, le dessin du sang du Massacre                          | Flèches pour la tache, Espace tenu pour frotter                  |   5 s |    3,5 s |
| Relier des couleurs à leur nom   | Tirer quatre fils, chaque couleur vers son nom écrit                         | Haut et bas pour le fil, Droite, haut et bas pour le nom, Espace |   5 s |    3,5 s |
| Ranger des mines                 | Glisser quatre mines dans leurs alvéoles                                     | Flèches pour l'alvéole, Espace pour y poser la mine suivante     |   5 s |    3,5 s |
| Recharger des munitions          | Glisser cinq cartouches dans le fusil du Tactique                            | Espace, cinq fois; chaque cartouche se joue en entier            |   5 s |    3,5 s |
| Remplir de fumée les bonus fumée | Maintenir appuyé, relâcher quand la jauge est dans la bande, sur trois bonus | Espace tenu, relâché dans la bande                               |   4 s |      3 s |

- **Relier des couleurs se lit sans distinguer les couleurs**: le nom est du texte, et la couleur porte aussi son nom sur le fil (étude, section 9.4). Les quatre couleurs sont tirées parmi les douze couleurs nommées du mode.
- **Un geste raté ne coûte que du temps**: une passe à l'envers ne compte pas, une fumée relâchée hors de la bande se vide et se recommence. Aucune tâche ne se perd par un échec.
- **Ce que montre chaque tâche** (place des taches, ordre des noms, place de la bande) se tire dans la page, d'une graine dérivée de la partie, du joueur et de la tâche: la même tâche se ressemble d'une ouverture à l'autre, et les tests de la page la reproduisent. Le moteur n'en sait rien.

### Les tâches de chaque station

Chaque station de Tokyo porte une ou deux tâches qui lui vont; au lancement, le moteur tire à la graine la tâche de chaque station active. Les stations qui n'avaient que des mini-jeux d'arcade dans l'étude reçoivent une tâche courte, et gagneront leurs mini-jeux à l'étape 7.24.

| Station                           | Tâches courtes                               |
| --------------------------------- | -------------------------------------------- |
| Bornes d'arcade                   | Relier des couleurs (le câblage d'une borne) |
| Table de jeu de la salle d'arcade | Ranger des mines                             |
| Lavabos de la salle d'arcade      | Nettoyer les lunettes, Nettoyer du sang      |
| Pierre du jardin zen              | Aiguiser un katana                           |
| Distributeur à l'entrée du jardin | Remplir de fumée                             |
| Camionnette du parking            | Recharger des munitions                      |
| Ordinateur de la maison           | Relier des couleurs                          |
| Table de la maison                | Nettoyer les lunettes                        |
| Cuisine du restaurant             | Nettoyer du sang, Aiguiser un katana         |
| Comptoir du salon                 | Ranger des mines                             |
| Tapis du salon                    | Remplir de fumée                             |
| Casiers de la salle violette      | Recharger des munitions, Ranger des mines    |
| Bureaux de la salle violette      | Relier des couleurs                          |

Chaque station prend aussi un nom, montré sur la carte plein écran: « j'étais à la pierre du jardin zen » est un alibi. Deux tâches de même nature peuvent tomber dans une même liste.

### Ce que garde le serveur

Le geste se joue dans la page, que le serveur ne voit pas (étude, section 9.2). Il garde en main:

- **L'ouverture**: une proie, vivante ou fantôme, qui appuie sur l'action dans le disque d'une station de sa liste ouvre sa tâche. Le serveur note qu'elle est commencée, et la page ouvre l'écran du geste.
- **La présence**: sortir du disque, une réunion, la mort ou la fin de la partie annulent la tâche. Sa prochaine ouverture repart de zéro.
- **La durée minimale** de la tâche (tableau ci-dessus): une fin annoncée plus tôt est refusée, et la tâche reste ouverte. Un tricheur peut sauter le geste, il ne peut ni aller plus vite qu'un bon joueur, ni faire la tâche de loin. La page règle le rythme de chaque geste pour qu'un joueur rapide et honnête finisse juste au-dessus de cette durée, et ne soit jamais refusé.
- **Le rôle**: une fin annoncée par un assassin ne compte jamais.

La tâche provisoire disparaît: plus de bouton tenu, plus de durée tirée de 5 à 10 secondes.

### Les assassins qui font semblant

Un assassin vivant qui appuie sur l'action à une station active ouvre le même écran, avec la tâche de cette station, sans effet: la page seule le joue, le serveur n'en est pas averti. Rien ne le distingue d'une proie pour qui le regarde: il s'arrête à la station comme elle. Un assassin fantôme ne fait pas semblant (inchangé depuis 7.20).

### Pendant une tâche

- **On ne bouge pas.** L'écran du geste recouvre le centre de l'écran de jeu; la page n'envoie plus de direction tant qu'il est ouvert, et cache le joystick sur téléphone.
- **On reste vulnérable**: le jeu continue autour, un assassin peut frapper. C'est voulu (étude, section 9.4). La mort ferme l'écran, et « TU SUBIS LE DÉCÈS » s'affiche.
- **On ferme** par Échap ou la croix de l'écran: la tâche est perdue, à refaire en entier.
- **Une réunion ferme l'écran**, comme elle interrompt déjà la tâche provisoire.

### Les tâches visuelles, réglage de l'hôte

Deux tâches se voient de près quand une vraie proie vivante les finit: **le katana jette une gerbe d'étincelles** sur la pierre, **la fumée lâche une bouffée** au-dessus du distributeur ou du tapis. Une seconde et demie, à la station. Seul le serveur les déclenche, à la fin validée d'une tâche: un assassin qui fait semblant n'en produit pas, et un fantôme non plus, puisqu'on ne le voit pas. C'est la preuve d'innocence de l'étude (section 9.3), comme le scan médical d'Among Us.

- Réglage « Tâches visuelles », **activé par défaut**.
- L'effet part aux seuls vivants qui voient la station, par la vue de chacun, et à la vue des fantômes.

### La barre des tâches, réglage de l'hôte

La barre commune (« Tâches 12/30 ») se montre **toujours** (défaut, comportement de 7.20), **en réunion seulement** (elle se fige au compte de la dernière réunion pendant le jeu), ou **jamais**. Le filtre se fait au serveur, dans la vue de chaque vivant: masquée dans la page seulement, elle se lirait dans le flux. Les fantômes la voient toujours à jour, puisqu'ils voient tout. À la fin, le compte réel se montre à tous.

### La carte plein écran

- **Ouverte par la touche M**, ou en touchant la mini-carte, sur ordinateur comme sur téléphone: le téléphone garde ses deux boutons (étude, section 13). Elle se ferme de même, ou par Échap.
- **Ce qu'elle montre**: tout Tokyo, nous, le gong, et nos stations à faire avec leur nom et le nom de leur tâche; nos tâches faites, cochées; pour un assassin, toutes les stations actives et leur tâche. **Jamais les autres joueurs**, ni les cadavres. À côté, la liste de nos tâches.
- **Le jeu continue derrière.** On peut se déplacer la carte ouverte, au risque de ne pas voir venir un assassin: comme dans Among Us. La carte prend le dessus de l'écran, mais laisse passer le clavier et le joystick.
- À l'étape 7.22, c'est d'elle que les assassins saboteront.

### La version

Une nouveauté majeure pour le joueur. Mais la 1.9.0 (le socle, étape 7.20) n'est pas en ligne, et sa note n'a pas encore été soumise. **Proposé: ne pas ouvrir de 1.10, et livrer le socle et les tâches ensemble sous la 1.9.0**, dont la note dira les tâches. Sinon, 1.10.0 et sa propre note.

## Les sons

Tous se jouent chez le seul joueur qui fait la tâche: un son de tâche entendu des autres dirait qui fait vraiment une tâche, et qui fait semblant. Exception, les deux effets des tâches visuelles, situés, entendus de ceux qui les voient. Chaque son a un provisoire, pris dans ceux du jeu, jusqu'à ce que le porteur du projet fournisse le sien (mp3, court, sans silence en tête; « en boucle » veut dire qu'il doit pouvoir se répéter sans à-coup).

| Son à fournir                       | Quand                                         | Provisoire               |
| ----------------------------------- | --------------------------------------------- | ------------------------ |
| Ouverture d'une tâche               | L'écran du geste s'ouvre                      | `button-click.wav`       |
| Tâche réussie                       | Toute tâche finie (et validée pour une proie) | `collect-bonus.wav`      |
| Lame sur la pierre                  | Chaque passe du katana                        | `katana-swing.mp3`       |
| Frottement de chiffon, en boucle    | Tant qu'on frotte les lunettes ou le sang     | aucun                    |
| Fil branché                         | Chaque fil relié à son nom                    | `button-click.wav`       |
| Mine dans son alvéole               | Chaque mine rangée                            | `mine-pose.mp3`          |
| Cartouche insérée                   | Chaque cartouche                              | `shotgun-reload.mp3`     |
| Remplissage de fumée, en boucle     | Tant qu'on tient la jauge                     | aucun                    |
| Fumée ratée                         | Relâchée hors de la bande                     | `collect-malus.wav`      |
| Étincelles (tâche visuelle, située) | Fin validée d'un katana                       | `katana-hit.mp3`         |
| Bouffée (tâche visuelle, située)    | Fin validée d'une fumée                       | `bonus-escape-nuage.mp3` |
| Carte ouverte et fermée             | Touche M, mini-carte touchée                  | `button-click.wav`       |

Rappel des sons de 7.20, toujours attendus: le meurtre (assassin et témoins, provisoire `katana-hit.mp3`), l'alerte de la victime (provisoire `player-captured.mp3`), la réunion qui s'ouvre et le gong (provisoire `final-tick.wav`), l'exécution (provisoire `player-captured.mp3`).

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE, à réviser en exécutant si le dépôt le demande. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite.

1. **Les natures de tâche sont une liste du contrat** (`NATURES_DE_TACHE`, `packages/shared/src/among.ts`), avec la durée minimale de chacune. Les stations de `LIEUX_DES_CARTES` prennent un nom et leurs natures possibles.
2. **Le tirage du lancement s'allonge d'un pas**: après les tueurs et les stations actives, la nature de chaque station active, puis les listes. Toujours dans ce mode seul: l'empreinte des quatre parties de référence ne bouge pas.
3. **Une tâche de la liste porte sa nature** à la place de sa durée tirée. `TacheAmong.dureeMs` disparaît; l'état privé (`TacheVue`) dit la nature, et la nature de chaque station de `EtatPriveAmong.stations` pour un assassin.
4. **Deux demandes nouvelles**, validées par les schémas (étape 1.6) et limitées en débit: « tâche finie » et « tâche fermée ». L'ouverture reste l'appui sur l'action (`agir`), la règle d'appui de 7.20 (signaler et sonner à l'appui) s'étendant à la tâche: on ouvre à l'appui, on ne tient plus.
5. **Le moteur compte le temps de la tâche ouverte**, comme il le fait aujourd'hui, et juge la fin annoncée contre la durée minimale de sa nature. Une fin refusée ne ferme rien.
6. **L'effet d'une tâche visuelle est un événement du moteur**, à la place de la station, routé par la vue comme un meurtre: aux vivants qui voient l'endroit, et aux fantômes.
7. **La barre en réunion seulement** se fige dans l'état: le moteur retient le compte des tâches faites à l'ouverture de chaque réunion, et la vue d'un vivant lit celui-là pendant le jeu.
8. **Les écrans de geste sont des composants de la page**, un par nature, avec leur modèle pur et ses tests, comme l'écran de réunion. Ils partagent un cadre commun: le titre de la tâche, sa station, la croix, le geste, et le pied qui dit la touche du clavier.
9. **La carte plein écran** est un composant de la page, qui lit le même modèle que la mini-carte (`MinimapAmong`), agrandi des noms et de la liste des tâches.

## Rendus à choisir sur planche

Après confirmation des règles, une planche `docs/design/etape-7-21/1-planche.png` (source `planche.html` à côté), dessinée en code sur les sprites et le décor de Tokyo, comme en 7.20:

1. **Le cadre d'une tâche**, trois propositions sur une même tâche (aiguiser le katana): une fenêtre néon au centre, un panneau plein écran, un parchemin.
2. **La carte plein écran**, pour une proie et un assassin, trois propositions.
3. **Les tâches visuelles**: les étincelles et la bouffée, trois propositions.
4. **La liste des tâches**: dans la carte seulement, ou aussi sous la mini-carte.

Puis une seconde planche, les sept tâches dans le cadre choisi, au bureau et sur téléphone en portrait. Les captures dans le vrai jeu, au fil de la construction, à côté.

## Périmètre

### Lot A. Le contrat et le moteur

1. Les natures de tâche, leurs durées minimales, les noms et les natures des stations. Les deux réglages nouveaux (tâches visuelles, barre des tâches), leurs valeurs par défaut et leur validation.
2. Le tirage de la nature des stations, la liste par nature.
3. L'ouverture, la fin annoncée, la fermeture, l'annulation; la durée minimale; l'assassin dont rien ne compte.
4. L'événement de la tâche visuelle. Le compte figé à chaque réunion.
5. Si le porteur du projet choisit l'option A: les paliers de vision resserrés.
6. L'empreinte des quatre parties de référence identique avant et après.

### Lot B. Le serveur

1. Les deux demandes, leur schéma et leur débit.
2. L'état privé: les natures. La vue d'un vivant: la barre selon le réglage, l'effet visuel selon ce qu'il voit.
3. Tests à travers le vrai serveur: une proie ouvre une tâche, la finit après la durée minimale, une fin trop tôt refusée, une sortie du disque qui l'annule, un assassin dont la fin ne compte pas, l'étincelle vue d'un témoin et pas d'un vivant hors de vue, la barre figée hors réunion.

### Lot C. La page

1. Le cadre d'une tâche, puis les sept gestes, au pointeur et au clavier, jouables sur téléphone en portrait. L'immobilité pendant une tâche, la fermeture, la mort qui ferme.
2. L'assassin qui fait semblant.
3. Les effets des tâches visuelles.
4. La carte plein écran et la liste des tâches; la mini-carte qui l'ouvre.
5. Le salon: les deux réglages nouveaux.
6. Les sons, provisoires.
7. L'aide et les consignes du mode: les tâches, la carte.

### Lot D. Bout en bout, mesure et documentation

1. Le scénario `tests/e2e/among.spec.ts`: la proie de la page fait une vraie tâche, au clavier, jusqu'à la victoire des proies. Une tâche jouée au doigt sur le projet téléphone, si le temps de la CI le permet.
2. Banc: la mesure de 7.20 rejouée, pour vérifier que les tâches ne coûtent rien de visible (section 29 de `docs/mesures/charge-serveur.md`, complétée).
3. Journal de conception, ROADMAP, étude (section 21 complétée), `assets/README.md` si des sons sont fournis.
4. La version et la note, selon le choix du porteur du projet.
5. **Avant toute poussée**, sur accord du porteur du projet: la suite de bout en bout complète, bureau et téléphone, rejouée.

## Hors périmètre

- Les tâches longues, les mini-jeux d'arcade (étape 7.24).
- Les sabotages, depuis la carte ou ailleurs, l'aide et la malédiction des fantômes (étape 7.22).
- Les pas entendus (étape 7.23).
- Les ninjas égarés, la ronde des néons, les égouts, le déguisement (étape 7.25).
- L'égout de l'exécution à affiner (dette de 7.20), sauf demande du porteur du projet.
- Toute modification des autres modes, de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: les natures et leurs durées, chaque station avec au moins une nature, les réglages et leur validation.
- **Lancement (TU)**: la nature de chaque station tirée parmi les siennes, reproductible à graine égale; aucun tirage dans les autres modes.
- **Tâches (TU)**: ouverture à l'appui dans le disque, fin acceptée à la durée minimale et refusée avant, annulation en sortant, en réunion, à la mort; fermeture; la tâche d'un fantôme; un assassin dont rien ne compte; une station hors de la liste.
- **Tâches visuelles (TU)**: l'événement à la fin validée d'une vraie proie vivante seulement, et seulement avec le réglage.
- **Barre (TU)**: les trois réglages dans la vue d'un vivant, la vue des fantômes à jour.
- **Vues (TU)**: l'effet visuel aux seuls témoins; aucune nature de tâche, aucune tâche ouverte dans ce que reçoit un autre joueur.
- **Serveur (TI)**: le lot B, point 3.
- **Page (TU)**: le modèle de chaque geste (une passe à l'envers, une fumée hors de la bande, le geste fini), le rythme qui ne passe jamais sous la durée minimale, le clavier de chaque geste, la carte plein écran (jamais un autre joueur), les réglages du salon.
- **Bout en bout**: le scénario du lot D.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les sept tâches se jouent dans la page à la souris, au clavier et au doigt, sur ordinateur et sur téléphone en portrait, vérifiées dans le navigateur.
2. **Une tâche ne se fait ni de loin, ni plus vite que sa durée minimale, ni par un assassin**, vérifié par les tests du serveur.
3. **Rien de ce que reçoit un vivant ne dit qui fait une tâche**, hors de l'effet d'une tâche visuelle qu'il voit.
4. **Les cinq autres modes n'ont pas changé**: tests existants inchangés, empreinte des quatre parties de référence identique.
5. La couverture de `packages/sim` ne baisse pas (99,83 pour cent au handoff 7.20).
6. `master` n'est pas poussé sans l'accord du porteur du projet, et jamais avant la suite de bout en bout complète.

## Points de vigilance

1. **Un son, une animation ou un temps de réponse ne doit rien trahir.** Un assassin qui fait semblant doit avoir l'air d'une proie, à l'écran des autres comme dans ce qu'ils reçoivent. Seul l'effet d'une tâche visuelle, voulu, distingue une proie.
2. **Le rythme de la page et la durée minimale du serveur sont liés**: un joueur rapide refusé par le serveur serait un défaut. Un test de la page le garde, nature par nature.
3. **Le téléphone en portrait** n'a pas été vérifié en vrai à l'étape 7.20: les écrans de geste s'y essaient dans le navigateur, à 375 sur 812, avant d'être déclarés finis.
4. **Le clavier**: Échap ferme la tâche et la carte, M ouvre la carte, E ouvre une tâche; aucune touche d'un geste ne doit faire bouger le ninja derrière.

## Réconciliation

Écarts entre cette fiche et ce qui sera construit, relevés pendant l'étape.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-21-handoff.md`: les décisions confirmées en début d'étape, les écarts à cette fiche (section « Réconciliation »), les chiffres du banc, l'état de la CI et de `master` (non poussé). Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP et l'étude. Prochaine action exacte: l'étape 7.22, les sabotages, dont la fiche se rédige au début de l'étape selon le cas de repli du PROTOCOLE. Commiter.
