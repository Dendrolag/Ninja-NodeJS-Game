# Fiche étape 8.8 - Le nouveau décor de Spirit & Time, son lointain en parallaxe, et les sons des mines

Brief de session. Objectif unique: Spirit & Time prend le décor livré par le porteur du projet, à 3000 sur 2200, avec une ville au loin qui glisse moins vite que la carte quand la caméra bouge; et les six sons provisoires de la fumée et des mines laissent place aux siens.

## Origine de cette fiche

Aucune fiche n'existait. Demande du porteur du projet, le 2 octobre 2026, après l'étape 4.8: « Met à jour les sons des mines et du bonus nuage en PJ. Update de la map de la salle de l'esprit et du temps (format 3000 par 2200) avec les nouveaux assets en PJ + ajout du background parallax à animer en parallax aux mouvements de caméra pour donner une impression de profondeur. »

Rédigée le 2 octobre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de cette demande, de l'état du dépôt au commit `e90e3c5` et du handoff 4.8. **Numéro**: 8.8, dans la phase des cartes: l'essentiel est une carte qui change de forme. Les sons, demandés dans le même message, tiennent dans la même étape: ils ne touchent qu'une table de noms de fichiers.

## Ce que le porteur du projet a livré

Dans `Documents/Neon Ninja/map3 - La salle de l'esprit et du temps/`, cinq images:

| Fichier                   | Taille      | Ce que c'est                                                                                              |
| ------------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| `background.png`          | 3000 x 2200 | Le toit-terrasse: dalles, cercles au sol, dôme doré, deux sabliers, bornes lumineuses. Transparent autour |
| `foreground.png`          | 3000 x 2200 | Le dôme, les sabliers, une rangée de bornes du bas: ce qui passe devant les ninjas                        |
| `collision.png`           | 3000 x 2200 | Les murs, en **noir opaque sur fond transparent**                                                         |
| `background-parallax.png` | 3000 x 2200 | La ville au loin, vue de haut, avec **un rectangle noir pur au centre**, caché par la terrasse            |
| `preview.png`             | 1254 x 1254 | La vignette                                                                                               |

Et cinq sons, dans `Documents/Neon Ninja/`: `mine-pose.mp3` (0,9 s), `activation-mine.mp3` (4,1 s), `explosion-mine.mp3` (2,2 s), `explosion-mine-zone.mp3` (4,0 s), `bonus-escape-nuage.mp3` (0,4 s).

## Diagnostic, fait au début de l'étape

1. **La collision livrée serait toute en mur.** Le jeu lit la luminosité d'un pixel et ignore son opacité (`SEUIL_MUR_LUMINOSITE`). Or les murs sont du noir opaque et le sol du noir transparent: tout est noir, donc tout est mur. Ce que l'artiste a dessiné, c'est l'image posée sur du blanc. C'est ainsi qu'elle entre dans `assets/`: chaque pixel vaut `255 - opacité`, en niveaux de gris, ce qui place le seuil du jeu à mi-opacité du bord adouci.
2. **La collision suit le décor.** Superposée au fond, elle épouse le bord de la terrasse, les blocs de climatisation des angles, les sabliers et la base du dôme; le haut du dôme est un sol que l'avant-plan recouvre (critère 8, vérifié à l'œil sur une planche).
3. **La carte nouvelle se mesure** (`mesurer-les-cartes.mjs`): un seul morceau, 67,8 pour cent de sol, 65,2 pour cent tenable, 100 pour cent du jouable hors de la bande d'apparition, dixième le plus serré à 57 pixels de dégagement, traversée en 20,3 secondes, détour médian 1,06. Les douze critères tiennent. Elle reste un terrain ouvert, comme avant (1,07).
4. **Le trou noir du lointain borne la parallaxe.** Il couvre `x` de 515 à 2579 et `y` de 407 à 1885. Le pixel le plus proche par où l'on voit le lointain, là où ni le fond ni l'avant-plan ne sont opaques, en est à 174 pixels (distance de l'échiquier, la plus grande des deux composantes). Tant que le lointain ne se décale pas de plus de 174 pixels de sa place, le trou reste caché.
5. **La caméra ne sort jamais de la carte** (`borner`, `rendu/camera.ts`), sauf de la hauteur du HUD en haut. Un lointain de la taille de la carte, décalé de moins que la course de la caméra, couvre donc toujours l'écran.

## Décisions prises par cette fiche

1. **Spirit & Time mesure 3000 sur 2200.** `CARTES.map3` change; tout ce qui en découle suit seul (validation, rayon des zones, bornes de la caméra, apparitions). Les images sont à la taille de la carte: plus d'étirement (critère 9).
2. **Le plafond de faux ninjas reste 500.** La surface tenable passe de 5,66 à 4,30 millions de pixels carrés: 8 600 par faux ninja, entre Tokyo (7 530) et l'ancienne Spirit & Time (11 330), au-dessus des 5 000 du critère 5. Le coût du serveur dépend du nombre d'entités, pas des murs: à confirmer au banc de charge sur le terrain nouveau.
3. **La collision entre aplatie sur du blanc**, et les autres images telles que livrées. La vignette est réduite à 120 sur 120.
4. **Le lointain est une couche de décor de plus, propre à une carte**, sous le fond. Son chemin se fabrique dans `ressources.ts`, comme la pluie: `cheminLointain`, qui ne rend rien pour une carte sans lointain. En miroir, il se retourne comme le reste du décor.
5. **Le décalage du lointain suit la caméra, en partie, et jamais au-delà d'une amplitude.** Sur chaque axe, la caméra a une course: de la moitié de la vue au bord opposé. Le lointain se décale dans le sens de la caméra d'une fraction de son écart au centre de la carte, si bien qu'il glisse moins vite que la terrasse: c'est l'impression de profondeur. La fraction est choisie pour qu'au bout de la course, le décalage vaille l'amplitude, sans dépasser la moitié de l'écart; le décalage est en plus borné à l'amplitude, pour les quelques pixels où la caméra descend sous le HUD. **Amplitude: 150 pixels**, sous les 174 mesurés. Conséquence assumée: plus la vue est petite, plus la course est longue, plus la fraction est faible; l'effet est plus discret sur téléphone (un dixième environ) que sur ordinateur (un cinquième).
6. **Fonction pure, testée seule**: `decalageDuLointain`, dans `rendu/parallaxe.ts`. Le rendu ne fait que l'appliquer au sprite à chaque image.
7. **Une preuve sur les images elles-mêmes**: un test lit le lointain, le fond et l'avant-plan livrés, et vérifie qu'aucun décalage dans l'amplitude ne montre un pixel du trou. Une image relivrée qui rapprocherait le trou du bord ferait échouer ce test, pas la partie.
8. **Les sons.** `fumee` joue `bonus-escape-nuage.mp3`; `minePosee` `mine-pose.mp3`; `mineArmee` et `mineDeZoneArmee` `activation-mine.mp3`, le même armement pour les deux mines; `mineExplosee` `explosion-mine.mp3`; `zoneOuverte` `explosion-mine-zone.mp3`. Plus aucun son provisoire.
9. **Le badge « Prototype » de Spirit & Time n'est pas tranché ici**: il a été posé parce que la carte gardait le décor du jeu d'origine (étape 4.7), ce qui n'est plus vrai. Le retirer, et créditer l'auteur du décor, appartient au porteur du projet: question posée pendant l'étape (réconciliation, point 6).

## Périmètre

### Lot A. Les sons

1. Les cinq fichiers dans `assets/sons/`, les six noms dans `SONS`, la provenance dans `assets/README.md`.

### Lot B. La carte

1. Les images dans `assets/cartes/map3/`, collision aplatie, vignette réduite.
2. `CARTES.map3` à 3000 sur 2200, et les tests qui en dépendent.
3. Les empreintes des murs de map3 relevées à nouveau; le test de symétrie de l'étape 8.3, qui ne vaut plus pour une carte qui n'est plus symétrique, remplacé par le retournement bit à bit.
4. La mesure de la carte (`docs/mesures/cartes.json`) et le banc de charge à 500 faux ninjas.

### Lot C. Le lointain en parallaxe

1. `cheminLointain` et son test d'existence; `decalageDuLointain` et ses tests; le réglage `LOINTAIN` dans `apparence.ts`.
2. Le sprite du lointain dans le rendu, préchargé avec le reste du décor, retourné en miroir, décalé à chaque image.
3. Le test sur les images livrées, et un scénario de rendu: aux quatre coins de la carte, en normal et en miroir, aucun pixel du trou; d'un coin à l'autre, le lointain a glissé moins que la terrasse.

### Lot D. Documentation

1. Compétence `conception-de-cartes` (les nombres de Spirit & Time, la couche du lointain), `assets/README.md`, journal de conception, ROADMAP, handoff.

## Hors périmètre

- Un lointain pour Tokyo ou le Quartier.
- Changer la vitesse, la caméra ou la hauteur de vue.
- Les crédits et le badge, à décider par le porteur du projet.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Partagé (TU)**: dimensions de map3; chemin du lointain, présent pour map3, absent ailleurs, et son fichier existe; chaque son annoncé existe.
- **Serveur (TU)**: les murs de map3, normal et miroir, figés par leur empreinte; le miroir de map3 est le retournement exact de la carte normale; 500 faux ninjas tiennent à leur apparition sur le vrai terrain.
- **Client (TU)**: le décalage du lointain au centre, aux bouts de la course, au-delà, sur une vue plus grande que la carte, sur téléphone et sur ordinateur; les images livrées gardent le trou caché dans l'amplitude.
- **Rendu (bout en bout)**: aucun pixel du trou aux quatre coins, en normal et en miroir; le lointain glisse moins que la terrasse.
- **Empreintes des parties de référence**: inchangées (elles se jouent sur Tokyo).

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. La carte nouvelle se joue dans un vrai navigateur, captures à l'appui, le lointain qui glisse.
2. Les douze critères de la compétence tenus, mesure à l'appui.
3. Plus aucun son provisoire dans `SONS`.
4. La couverture de `packages/sim` ne baisse pas.

## Réconciliation pendant l'étape (2 octobre 2026)

1. **La carte est réduite de 20 pour cent: 2400 sur 1760.** Sur les premières captures, le porteur du projet a trouvé le décor trop grand pour les ninjas, et a demandé de réduire la carte de 20 pour cent par rapport aux personnages. Les quatre images sont réduites à 2400 sur 1760, aux mêmes proportions. Le fond et le lointain, livrés en 450 couleurs, sont ramenés pixel par pixel à la couleur la plus proche de leur palette d'origine: même style, et 4,4 Mo en tout comme les originaux (6,0 Mo sans cela). La collision, posée sur du blanc, est moyennée par zone, comme le serveur le fait. Les décisions 1, 2 et 5 en changent.
2. **Mesures de la carte réduite**: un seul morceau, 67,8 pour cent de sol, 64,6 pour cent tenable, 100 pour cent hors de la bande d'apparition, passage médian de 225,6 pixels de dégagement, traversée en 16,2 secondes, détour médian 1,06. Les douze critères tiennent.
3. **Plafond de faux ninjas: 360**, et non plus 500, sur décision du porteur du projet. La surface tenable tombe à 2,73 millions de pixels carrés; 360 faux ninjas redonnent la densité de Tokyo et du Quartier, environ 7 580 pixels carrés chacun. 500 en aurait fait la carte la plus dense du jeu, à 5 460. La borne des réglages, le plus haut des plafonds, tombe avec lui de 500 à 360. Au banc de charge: 1,61 ms par battement à 360 faux ninjas, contre 1,12 pour Tokyo à 300 au même commit.
4. **Amplitude du lointain: 120 pixels**, et non 150. Le trou se rapproche du bord dans la même proportion: il paraît désormais à 139 pixels d'écart. La part suivie au bout de la course vaut 120 sur 400 sur ordinateur, environ 0,3.
5. **Le trou se mesure là où le terrain laisse voir plus de 2 pour cent du lointain.** Quelques pixels du toit, opaques à 98 pour cent et plus, laissent passer le lointain jusqu'au-dessus du trou: un noir n'y change la couleur que de cinq niveaux sur 255 au plus, invisible. Le test sur les images retient ce seuil.
6. **Le badge « Prototype » reste**, sur décision du porteur du projet: le décor de Spirit & Time reste provisoire pour l'instant. Les crédits ne changent pas.
7. **Une garde de plus**: chaque image de collision doit être opaque partout, et un test le vérifie pour toutes les cartes. C'est le piège trouvé au diagnostic (point 1), qui aurait fait de Spirit & Time un mur plein. Le test des vraies cartes vérifie aussi qu'il y a du sol, et non plus seulement des murs.
8. **Le test de symétrie de l'étape 8.3** est remplacé par le retournement vérifié pixel à pixel: la carte nouvelle n'est plus symétrique.

9. **La première mise en ligne a échoué, et c'était un défaut, corrigé dans l'étape** (règle 7). Sur Render, le nouveau serveur est resté quinze minutes dans ses migrations sans rien dire, jusqu'à l'abandon; l'ancien a redémarré et migré en six secondes. La connexion à la base n'avait aucun délai: une base muette retenait le démarrage indéfiniment. Désormais, une connexion qui ne s'ouvre pas en vingt secondes échoue (`DELAI_DE_CONNEXION_MS`, `base/connexion.ts`), et les migrations du démarrage se reprennent trois fois (`appliquerMigrationsAvecReprises`, `base/migrations.ts`). Tests sans base: un serveur qui accepte la connexion et ne répond jamais, et les reprises.

## Rituel de fin de session

Écrire `docs/handoffs/etape-8-8-handoff.md`. Commiter, pousser, vérifier la CI et la mise en ligne.
