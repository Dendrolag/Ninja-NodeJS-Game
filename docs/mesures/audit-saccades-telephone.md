# Audit des saccades sur téléphone (étape 8.5)

Rapport de l'étape 8.5. Fiche: `docs/plan/etape-8-5.md`.

**Statut au 25 septembre 2026: trois parties mesurées sur l'iPhone 14 Pro, le verdict est provisoire.** Sur ce téléphone et dans ces conditions, **le dessin est fluide**: 60 images par seconde tenues trois minutes, en Horde, en Massacre et en Tactique, jusqu'à 300 PNJ. Ce qui reste est un défaut de **réseau** que le lissage amplifie (forme 3), et un gel d'une fraction de seconde au tout début de chaque partie. Les très grosses saccades du 20 septembre, dans les mêmes conditions, ne sont pas reproduites: la cause la plus probable est une variation dans le temps du réseau ou du serveur (section 6.4). Pas de retard ajouté à l'affichage, sur décision du porteur du projet (section 8).

## 1. Le problème, et pourquoi on mesure d'abord

Le 20 septembre 2026, le porteur du projet rapporte **de très grosses saccades sur iPhone 14 Pro**, au point que le jeu n'y est pas jouable.

Tout ce que le projet savait du coût de l'affichage venait d'un **banc de mesure sur ordinateur**: Chromium, processeur ralenti six fois, carte graphique de bureau (sections 17 et 18 de `charge-serveur.md`). Ce banc dit qu'une image coûte environ 5 millisecondes au cadrage d'un téléphone, soit un tiers de ce qu'il faut pour 60 images par seconde. Il le disait lui-même: « un vrai téléphone, à confirmer en jouant ». Le téléphone vient de le contredire.

Aucune optimisation ne part donc d'une intuition. On mesure sur l'appareil, et le remède suit la mesure.

## 2. Les quatre formes de saccade, et comment le relevé les distingue

« Ça saccade » peut décrire quatre choses, qui n'ont pas les mêmes causes. Le relevé est construit pour les séparer.

| Forme                                                  | Ce que le joueur voit                       | Signature dans le relevé                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1. Cadence basse mais régulière                        | Tout est lent et haché, tout le temps       | Peu d'images par seconde, **médiane haute**, neuvième décile proche de la médiane                                              |
| 2. Cadence haute entrecoupée d'images très longues     | Fluide, puis un accroc, puis fluide         | Médiane à 16,7 ms (ou 8,3 ms à 120 Hz), mais **beaucoup d'images d'au moins 50 ms** et un centile 99 élevé                     |
| 3. Dessin fluide, personnages qui avancent par à-coups | L'écran défile bien, les ninjas « sautent » | Images fluides, mais **écarts entre instantanés irréguliers** et beaucoup d'**images tenues** (le lissage attendait le réseau) |
| 4. Dégradation au fil de la partie                     | Fluide au début, de plus en plus haché      | Le **déroulé par fenêtres de 5 s** voit la cadence baisser ou les images lentes monter d'une fenêtre à l'autre                 |

Pour les formes 1 et 2, le relevé désigne ensuite le coupable, en séparant trois temps par image:

- **notre code**: la saisie envoyée, les sons, le lissage, la scène, leur transmission à PixiJS, puis le HUD, chacun chiffré;
- **PixiJS**: le temps qu'il passe à préparer et envoyer le dessin;
- **hors de nos chronomètres**: tout le reste. Sur une image normale, c'est surtout l'attente de l'écran. Sur une image lente, c'est ce qu'aucun chronomètre de la page ne voit: la mise en page du navigateur, la carte graphique, le ramasse-miettes, le téléversement d'une texture.

La liste des vingt pires images donne ces temps image par image. Une image de 120 ms où notre code et PixiJS ne prennent que 3 ms n'est **pas** un problème de notre code.

## 3. L'instrument

### 3.1 Pour s'en servir, sans rien savoir de technique

1. Sur le téléphone, ouvrir Safari à l'adresse **https://ninja.dendrolag.fr/?diagnostic=1**.
2. Un petit bandeau noir apparaît en bas de l'écran: « Relevé: en attente d'une partie ». Il reste là pendant toute la visite, sur tous les écrans.
3. Jouer une partie normalement. Pendant la partie, le bandeau montre quatre nombres:
   - les **images par seconde** (60, ou 120 sur un écran qui le permet, c'est parfait);
   - **p90** et **p99**: la durée d'image, en millisecondes, sous laquelle tombent 90 et 99 images sur 100. 16,7 veut dire fluide à 60 images par seconde;
   - **≥ 50 ms**: le nombre d'images qui ont duré au moins cinquante millisecondes depuis le début de la partie. **C'est le compte des saccades.**
4. À la fin de la partie, sur l'écran des résultats, toucher **« Copier le relevé »**. Le bouton affiche « Copié ». Si le téléphone refuse la copie, le relevé s'affiche en texte: le sélectionner et le copier à la main.
5. Coller le relevé dans la conversation, avec **une phrase sur ce qu'on a ressenti** (« ça saccadait beaucoup », « ça allait », « les ninjas sautaient mais l'écran défilait bien »). Le relevé ne sait pas ce que l'œil a vu.

Sans `?diagnostic=1`, rien de tout cela n'existe: ni bandeau, ni mesure, ni coût.

### 3.2 Les variantes

Chacune retire ou change **une seule chose**, par l'adresse, sans remettre le jeu en ligne. Elles ne valent qu'avec `diagnostic=1`, et le relevé écrit lesquelles étaient en place.

| Ajouter à l'adresse | Ce que ça change                                                           | Hypothèse qu'elle départage |
| ------------------- | -------------------------------------------------------------------------- | --------------------------- |
| `&son=0`            | Aucun son ni musique: aucun lecteur n'est créé                             | 9, le son                   |
| `&hud=0`            | Le HUD et les points gagnés ne sont plus mis à jour                        | 11, le HUD                  |
| `&flou=0`           | Les fonds floutés de l'interface (barre du haut, panneaux) deviennent nets | 11, le HUD                  |
| `&densite=1`        | Le rendu à la densité 1 au lieu de 2: quatre fois moins de pixels          | 3, le coût du dessin        |
| `&cadence=60`       | La cadence plafonnée à 60 images par seconde (ou 30, ou autre)             | 2, les 120 Hz               |
| `&rendu=webgpu`     | PixiJS dessine par WebGPU au lieu de WebGL                                 | 1, le dos de rendu          |
| `&lueur=0`          | Le filtre de lueur des repères n'est pas posé                              | 10, la lueur                |

Exemple: `https://ninja.dendrolag.fr/?diagnostic=1&son=0&densite=1`.

### 3.3 Ce que le relevé contient

- **En-tête**: la date, la version de la page, les variantes, le navigateur, l'écran et sa densité, la fenêtre, le dos de rendu réellement utilisé (WebGL 1 ou 2, WebGPU), la densité de rendu, la taille du canevas, la carte graphique annoncée, la carte, le mode, le nombre de PNJ et la pluie.
- **Images**: la durée mesurée, la cadence, la cadence de l'écran estimée (60 ou 120 Hz), la répartition des durées d'image (moyenne, médiane, p90, p99, maximum), les images d'au moins 25, 50, 100 et 250 ms, les interruptions (page cachée, dont l'écart n'est pas compté), et, depuis le 25 septembre 2026, l'instant où l'écran de préparation s'est levé et le nombre d'images d'au moins 50 ms qui l'ont suivi: celles que le joueur a vues.
- **Où va le temps**: la répartition de notre code, de sa partie rendu, de son HUD, et de PixiJS, et ce qui reste hors de nos chronomètres.
- **Réseau**: les instantanés reçus, leur rythme, les battements sautés, la répartition de l'écart entre deux, ceux d'au moins 100 ms, et les images tenues.
- **Déroulé**: une ligne par fenêtre de 5 secondes, pour voir l'échauffement.
- **Les vingt pires images**, d'au moins 25 ms: quand, combien, et ce que notre code et PixiJS y ont pris.

### 3.4 Comment il est construit

- `packages/client/src/diagnostic/demande.ts`: lit l'adresse. Sans `diagnostic=1`, ne rend rien.
- `packages/client/src/diagnostic/histogramme.ts`: une répartition de durées à taille fixe, par cases d'un dixième de milliseconde jusqu'à deux secondes. Rien n'est alloué pendant la partie: un relevé qui allouerait fabriquerait les saccades du ramasse-miettes qu'il cherche.
- `packages/client/src/diagnostic/releve.ts`: le relevé, pur, sans horloge ni document. Il reçoit les mesures et rend le texte.
- `packages/client/src/diagnostic/diagnostic.ts`: le bandeau, mis à jour deux fois par seconde et non à chaque image, le chronomètre posé sur le dessin de PixiJS (le même que le banc de rendu), et le suivi des instantanés reçus.
- La boucle de rendu (`rendu/boucle.ts`) reçoit une **sonde** facultative. Sans elle, elle ne lit aucune horloge de plus.

Tests: `diagnostic/diagnostic.test.ts` (répartitions et compte d'images lentes sur des séries connues, lecture de l'adresse, rien sans le paramètre), `rendu/interpolation.test.ts` (le lissage qui attend le réseau), et le scénario de bout en bout `tests/e2e/diagnostic.spec.ts`, qui ouvre le jeu sans le paramètre (aucun bandeau, ni à l'accueil ni en partie), avec (le relevé suit la partie et se copie), et avec des variantes (densité, cadence plafonnée, sans son, sans HUD).

Vérifié dans un navigateur de bureau, une partie de 20 secondes sur Tokyo à 50 PNJ: 59,7 images par seconde, deux images de 67 ms au tout début (la préparation, sous l'écran de chargement), notre code à 0,31 ms par image, PixiJS à 0,65 ms, 20,0 instantanés par seconde à 50 ms d'écart médian, 1,5 pour cent d'images tenues. C'est le point de comparaison d'un appareil qui ne saccade pas.

## 4. Le protocole de recette

### 4.1 Les conditions

À noter une fois, en tête des relevés: la version d'iOS, **Wi-Fi ou réseau mobile**, le niveau de batterie, et si le **mode économie d'énergie** est activé (il plafonne l'écran à 60 Hz et bride le processeur: le couper pour les parties 1 à 8). Téléphone tenu **en paysage**, dans Safari, sans autre application ouverte si possible.

Toujours **seul**, par « Partie rapide », en gardant les réglages par défaut sauf mention contraire: Tokyo, pluie, 50 PNJ, trois minutes. Pour une partie d'une minute, la quitter après une minute, ou attendre la fin pour les parties de trois minutes. **Bouger tout le temps**, comme en vraie partie.

### 4.2 Les parties, dans l'ordre

Chaque partie donne un relevé. Les coller au fil de l'eau, ou tous à la fin, en les numérotant.

| N°  | Adresse (après `https://ninja.dendrolag.fr/`) | Réglages                                                               | Durée                        | Ce qu'elle tranche                                 |
| --- | --------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| 1   | `?diagnostic=1`                               | par défaut                                                             | 1 min                        | La référence: la forme de la saccade, et sa taille |
| 2   | `?diagnostic=1&son=0`                         | par défaut                                                             | 1 min                        | Le son (9)                                         |
| 3   | `?diagnostic=1&hud=0&flou=0`                  | par défaut                                                             | 1 min                        | Le HUD et les fonds floutés (11)                   |
| 4   | `?diagnostic=1&densite=1`                     | par défaut                                                             | 1 min                        | Le coût du dessin (3)                              |
| 5   | `?diagnostic=1&cadence=60`                    | par défaut                                                             | 1 min                        | Les 120 Hz (2), si la partie 1 dit 120 Hz          |
| 6   | `?diagnostic=1&rendu=webgpu`                  | par défaut                                                             | 1 min                        | Le dos de rendu (1)                                |
| 7   | `?diagnostic=1`                               | carte **Quartier**                                                     | 1 min                        | Le poids du décor et de la pluie (4)               |
| 8   | `?diagnostic=1`                               | par défaut                                                             | **3 min**, la partie entière | L'échauffement (8), et la référence refaite        |
| 9   | `?diagnostic=1`                               | par défaut, **sans toucher l'écran** pendant 30 s, puis 30 s en jouant | 1 min                        | La saisie tactile (12)                             |

Si la partie 1 est **parfaitement fluide** (aucune image d'au moins 50 ms, et un ressenti fluide), le dire tout de suite: c'est une information en soi (la saccade dépendrait du moment, du réseau ou de la chaleur), et la suite du protocole change.

**Refaire la partie 1 en fin de série** (c'est la partie 8): un téléphone qui chauffe ou une autre application en arrière-plan fausse une partie isolée. Deux références qui divergent se disent aussi.

### 4.3 Ce qu'on fera des relevés

Chaque relevé brut est rangé dans `docs/mesures/releves-8-5/`, un fichier par partie, sous son numéro.

**Ce qui a été joué, le 25 septembre 2026**: pas le protocole ci-dessus, mais trois parties entières de trois minutes, seul, sans variante, ce qui a suffi à trancher la plupart des hypothèses. Les variantes servaient à trouver le coupable d'un dessin lent: le dessin ne l'est pas.

| Relevé                             | Mode     | Carte         | PNJ | Ressenti                   |
| ---------------------------------- | -------- | ------------- | --: | -------------------------- |
| `01-horde-tokyo-50.txt`            | Horde    | Tokyo         |  50 | pas de latence forte       |
| `02-massacre-tokyo-200.txt`        | Massacre | Tokyo         | 200 | quelques faibles latences  |
| `03-tactique-tokyo-miroir-300.txt` | Tactique | Tokyo, miroir | 300 | quelques latences, faibles | L'état des hypothèses (section 5), le verdict (section 6) et le plan d'action (section 8) s'écrivent à partir d'eux, chiffres cités. |

## 5. Les hypothèses

Écrites pour être réfutées. Les dix premières sont celles de la fiche; les deux dernières sont apparues à la lecture du code au début de l'étape. État au 25 septembre 2026, sur les trois relevés de l'iPhone 14 Pro (section 6). « Écartée » veut dire écartée **dans ces conditions**: la section 6.4 dit ce qui reste à éprouver.

| N°  | Hypothèse                                              | Ce que les relevés en disent                                                                                                                    | État                |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | Le dos de rendu choisi par Safari                      | WebGL 2 tourne, et le dessin tient 60 images par seconde: rien à gagner à essayer WebGPU                                                        | écartée             |
| 2   | L'écran à 120 Hz                                       | Le navigateur cadence à 60 Hz (59,8 à 59,9 images par seconde), pas à 120                                                                       | écartée             |
| 3   | Le coût du dessin, sur la carte graphique du téléphone | Notre code 0,28 à 0,43 ms par image, PixiJS 0,37 à 0,52 ms, jusqu'à 300 PNJ: moins de 6 pour cent d'une image                                   | écartée             |
| 4   | Les téléversements de texture                          | **Au début seulement**: les seules images de plus de 100 ms tombent entre 0,13 et 0,40 s, PixiJS y prend jusqu'à 52 ms. Rien ensuite            | confirmée, corrigée |
| 5   | Le ramasse-miettes                                     | Après la première demi-seconde, aucune image au-delà de 30 ms en neuf minutes de jeu                                                            | écartée             |
| 6   | Le lissage entre deux instantanés                      | **Amplificateur**: 15 à 17 pour cent des images tenues sur le dernier instantané, contre 1,5 pour cent au bureau                                | confirmée           |
| 7   | Le réseau                                              | 20 instantanés par seconde, aucun perdu, mais irréguliers: p99 de l'écart de 119 à 151 ms, un écart d'au moins 100 ms toutes les 2 à 3 secondes | confirmée           |
| 8   | L'échauffement et l'économie d'énergie                 | Neuf minutes de jeu presque d'affilée: aucune fenêtre de 5 secondes ne se dégrade                                                               | écartée             |
| 9   | Le son                                                 | Joué avec le son, et le dessin tient                                                                                                            | écartée             |
| 10  | Le filtre de lueur                                     | Aucune image lente pendant la partie, repères compris                                                                                           | écartée             |
| 11  | Le HUD réécrit à chaque image, sur des fonds floutés   | HUD à 0,10 à 0,12 ms par image, et les images tombent à l'heure: la mise en page et la composition tiennent dans le budget                      | écartée             |
| 12  | La saisie tactile                                      | Joué au pouce tout du long, et les images tombent à l'heure                                                                                     | écartée             |

### 5.1 Ce que la lecture du code a déjà appris

Pas un verdict, des faits qui orientent la lecture des relevés.

- **Hypothèse 1: la fiche se trompait sur le dos de rendu par défaut.** PixiJS 8.19 essaie **WebGL d'abord**, puis WebGPU, puis le canevas (`autoDetectRenderer`, ordre `webgl`, `webgpu`, `canvas`). Sur Safari, c'est donc WebGL qui tourne, pas WebGPU. La variante `rendu=webgpu` essaie l'autre.
- **Hypothèse 11, nouvelle: le HUD est réécrit à chaque image.** `hud/surcouche.ts` écrit à chaque image le texte du temps, celui de la pause, chaque ligne du classement, les couleurs et la position de chaque point de la minimap, et **reconstruit entièrement la liste des effets en cours** (`replaceChildren`, puis de nouveaux éléments) tant qu'un bonus ou un malus est actif. Réécrire un texte identique invalide quand même la mise en page. Le coût en JavaScript est faible et le relevé le chiffre (« dont HUD »), mais la mise en page et le dessin qui suivent se font hors de nos chronomètres. Or cinq éléments du HUD posent un **flou d'arrière-plan** (`backdrop-filter`) sur un canevas qui change à chaque image: le navigateur doit alors reflouter leur fond à chaque image. Sur ordinateur, c'est invisible. Sur un écran de densité 3, dont l'interface est composée à pleine densité alors que le jeu est plafonné à 2, c'est à mesurer.
- **Hypothèse 12, nouvelle: la saisie tactile.** La manette écoute `touchmove` en mode non passif, pour empêcher le défilement de la page. Le navigateur doit alors attendre la page avant de traiter chaque contact. Cela retarde la saisie plus que l'image, mais une page occupée la rend sensible.
- **Deux minuteurs dessinent chaque image.** PixiJS a le sien, qui dessine, et la boucle du jeu a le sien, qui prépare la scène. Ils tournent au même pas, si bien que PixiJS dessine la scène préparée à l'image précédente: une image de retard, pas une saccade. La variante `cadence` fait passer la boucle juste avant le dessin, dans le même battement: si elle devenait le réglage du jeu, ce retard disparaîtrait aussi.
- **Hypothèse 6: le lissage s'adapte à l'écart observé entre les deux derniers instantanés.** Un instantané en retard fait attendre les personnages, puis le suivant, arrivé tôt, les fait courir: le mouvement affiché suit l'irrégularité du réseau au lieu de l'absorber. Sur un réseau régulier, c'est invisible (1,5 pour cent d'images tenues au bureau). Sur un accès mobile, c'est exactement la forme 3. Le relevé compte les images tenues et la répartition des écarts.

## 6. Verdict

### 6.1 Les conditions

Trois parties de trois minutes, le 25 septembre 2026 entre 9h04 et 9h17, seul, sur la page du commit `2b5cb4f`. iPhone 14 Pro sous iOS 18.7, **Firefox pour iOS** (FxiOS 156.1, qui dessine avec le moteur de Safari, comme tout navigateur sur iPhone), tenu **en portrait** (fenêtre de 393 sur 779 points). Rendu WebGL 2, densité 2, canevas de 786 sur 1558. Réseau non précisé.

Une précaution de lecture: **ce navigateur arrondit ses chronomètres à la milliseconde**. Une image y mesure 16 ou 17 ms, jamais 16,7, d'où la « cadence estimée à 58 Hz » pour 59,9 images réellement comptées par seconde, et les temps de notre code, image par image, à 0 ou 1 ms. Les moyennes, elles, restent justes sur dix mille images.

### 6.2 Ce qui se voit: la forme 3, et un gel au départ

- **Le dessin est fluide: ni forme 1, ni forme 2, ni forme 4.** 59,8 à 59,9 images par seconde de bout en bout, centile 99 de 21 à 23 ms, **une à deux images d'au moins 50 ms par partie de trois minutes**, toutes dans la première demi-seconde. Aucune des 108 fenêtres de 5 secondes ne se dégrade.
- **Le réseau est irrégulier, et le lissage le rend visible: la forme 3.** Les instantanés arrivent bien vingt fois par seconde, sans aucun battement sauté, mais pas à intervalles réguliers: neuvième décile de l'écart de 71 à 77 ms, centile 99 de 119 à 151 ms, jusqu'à 359 ms. De 60 à 100 écarts d'au moins 100 ms par partie, soit un toutes les deux à trois secondes. Pendant 15 à 17 pour cent des images, le lissage, arrivé au bout de son trajet, tient les personnages immobiles en attendant le suivant; puis le suivant, arrivé en rafale, les fait courir. **C'est ce que le porteur du projet appelle « quelques faibles latences ».**
- **Un gel d'une fraction de seconde au tout début de chaque partie.** Dans les trois relevés, une image de 131 à 257 ms tombe entre 0,13 et 0,26 s, suivie d'une deuxième de 57 à 138 ms. PixiJS y prend jusqu'à 52 ms: c'est le décor et les personnages envoyés à la carte graphique. L'écran de préparation, qui devait couvrir ce moment, se levait après trois images de moins de 100 ms, donc **avant**.

### 6.3 Les causes, et le chiffre qui les désigne

1. **Le lissage adaptatif (hypothèse 6), sur des arrivées irrégulières (hypothèse 7).** Le lissage règle sa vitesse sur l'écart entre les deux derniers instantanés: il suit l'irrégularité au lieu de l'absorber. Chiffre: 16,8, 15,0 et 16,0 pour cent d'images tenues, contre 1,5 au bureau sur le même code. Le relevé ne dit pas d'où vient l'irrégularité: du réseau de l'appareil, d'Internet, ou du serveur, dont le battement tourne sur une offre gratuite de Render. L'action 2 de la section 8 les départage.
2. **L'écran de préparation qui se lève trop tôt (hypothèse 4).** Chiffre: une image de 131 à 257 ms, à 0,13 à 0,26 s, dans chacune des trois parties.

### 6.4 Les très grosses saccades du 20 septembre: une variation dans le temps

Le 20 septembre, le jeu était « injouable » sur le même téléphone. Le 25, il est fluide. **Le porteur du projet confirme que les conditions étaient les mêmes**: même appareil, même navigateur, même réseau, même façon de jouer. Rien dans le dessin n'a changé entre les deux dates.

Ce qui a varié n'est donc ni le téléphone ni le code du dessin, mais **ce qui se trouve entre le serveur et le téléphone**: le réseau, ou le serveur lui-même, hébergé sur une offre gratuite de Render dont la puissance n'est pas garantie. Le relevé du 25 septembre montre déjà la même forme en petit (un écart d'au moins 100 ms toutes les deux à trois secondes). Un jour où ces écarts montent à 300 ms et plus, les personnages se figent un tiers de seconde puis bondissent: c'est exactement une « très grosse saccade » ressentie, sur un dessin pourtant fluide.

**Ce qui reste à faire pour le confirmer**: un relevé `?diagnostic=1` pris un jour où le jeu saccade de nouveau. S'il montre des images fluides et des écarts entre instantanés de plusieurs centaines de millisecondes, la cause est établie. Le porteur du projet refera un essai.

### 6.4 bis Le serveur bat à l'heure (étape 8.6, 25 septembre 2026)

Première mesure du battement en production, une fois le chronomètre de l'étape 8.6 en ligne (commit `f883faf`): une partie privée d'une minute et demie, un joueur, Tokyo, 50 PNJ, jouée depuis l'ordinateur de développement. Relevé brut: `docs/mesures/releves-8-6/01-production-ordinateur.txt`.

| Mesure                                       | Médiane |  p90 |  p99 | Maximum | D'au moins 100 ms |
| -------------------------------------------- | ------: | ---: | ---: | ------: | ----------------: |
| Écart entre deux battements, au serveur (ms) |    49,9 | 50,7 | 52,6 |    70,9 |          0 / 1197 |
| Écart entre deux instantanés, à la page (ms) |    50,0 | 51,6 | 56,6 |   115,6 |          2 / 1717 |
| Durée d'un battement, au serveur (ms)        |     0,6 |  0,9 |  3,9 |    17,9 |                   |

**Le serveur de production part à l'heure**, malgré son offre gratuite: aucun battement en retard en une minute et demie, et un battement lui coûte moins d'une milliseconde. Vue d'un ordinateur relié au même serveur, l'arrivée est presque aussi régulière que le départ. Les écarts de 119 à 151 ms au centile 99 relevés sur l'iPhone le 25 au matin, et les grosses saccades du 20, ne naissent donc probablement **ni au serveur, ni sur Internet**, mais sur le **dernier tronçon, entre le téléphone et le réseau**: le Wi-Fi ou la radio du téléphone, qui peut regrouper ses réceptions pour économiser sa batterie.

**Ce qui reste à faire pour le confirmer**: un relevé de l'iPhone, qui porte désormais les deux côtés dans un même texte. Si la section « Serveur » y reste à 50 ms pendant que la page reçoit ses instantanés en retard, c'est établi. Un seul relevé ne suffit pas pour un phénomène qui varie d'un jour à l'autre: le serveur peut peiner un autre jour, et le relevé le dira.

**Remarque**: dans ce relevé-ci, le navigateur intégré, en arrière-plan, dessinait à 30 images par seconde, et le lissage tenait donc 24 pour cent des images. C'est un effet de la cadence réduite, pas du réseau: à 30 Hz, une image sur trois tombe après la fin du trajet du lissage.

### 6.5 Jouable ou pas, et à quelles conditions

**Oui, sur un iPhone 14 Pro, dans les conditions mesurées**: un joueur, jusqu'à 300 PNJ, trois modes. Le dessin garde plus de 90 pour cent de marge. Ce qui gêne encore est un à-coup des personnages toutes les deux à trois secondes, dû aux arrivées irrégulières, et qui peut grossir certains jours au point de rendre le jeu pénible (section 6.4). La section 8 dit comment en trouver l'origine.

## 7. Ce que le banc de l'étape 5.7 ne voyait pas

- **Ni Safari, ni une carte graphique de téléphone.** Le banc mesure Chromium sur une carte de bureau. Pour ce téléphone, c'était sans conséquence: le banc annonçait 5 ms par image au processeur ralenti six fois, le téléphone en dépense moins d'une. Le ralentissement de Chromium est pessimiste pour un appareil haut de gamme.
- **Ni le réseau.** Le banc fabrique ses instantanés à la cadence parfaite: il ne pouvait pas voir la forme 3, qui est justement le défaut restant. **À lui ajouter**: un test du lissage nourri d'arrivées irrégulières, tirées de la répartition mesurée ici (médiane 50 ms, neuvième décile 75 ms, centile 99 130 ms), qui borne le taux d'images tenues. C'est le test qui prouverait l'action 3.
- **Ni le début de partie.** Le banc s'échauffe une seconde avant de mesurer, exprès: le gel du départ lui était invisible. Le relevé, lui, le voit désormais: il écrit quand l'écran de préparation s'est levé, et combien d'images d'au moins 50 ms ont suivi.
- **Ni le HUD, ni la mise en page, ni la durée.** Invisibles au banc, et sans conséquence sur ce téléphone (hypothèses 8 et 11).

## 8. Plan d'action

Ordonné par gain rapporté au coût.

**Décision du porteur du projet, le 25 septembre 2026: pas de retard ajouté à l'affichage.** L'audit proposait d'abord un lissage à retard fixe: afficher la partie avec un peu plus de deux battements de retard, pour qu'un instantané en retard ne se voie plus. Refusé: le jeu demande d'être réactif pour capturer, et 50 ms de plus entre la réalité du serveur et l'écran nuiraient au ressenti. Tout remède doit donc se passer de retard supplémentaire.

1. **L'écran de préparation attend une demi-seconde réellement fluide** (`STABILITE`, `packages/client/src/rendu/apparence.ts`): trente images d'affilée de moins de 34 ms, au lieu de trois de moins de 100 ms.
   - Gain espéré: le gel de 131 à 257 ms du départ passe sous l'écran de préparation, dans les trois relevés.
   - Risque: l'écran se lève une demi-seconde plus tard. Il se lève toujours au bout de trois secondes au plus.
   - **Réglage, fait à l'étape 8.5**, à remesurer: le relevé dit désormais combien d'images d'au moins 50 ms suivent le lever de l'écran. Il en faut zéro.
2. **Mesurer la régularité du battement du serveur en production.** Le serveur relève l'écart réel entre deux de ses battements et l'expose par sa route `/sante`, et le relevé de la page l'écrit à côté du sien. C'est ce qui dit si l'irrégularité naît au serveur, hébergé gratuitement, ou sur le chemin jusqu'au téléphone. **Fait à l'étape 8.6**: le serveur bat à l'heure (section 6.4 bis).
   - Gain: aucun en soi, mais il décide de la suite. Si le serveur est en cause, un hébergement qui garantit sa puissance corrige tout sans rien changer au jeu. S'il ne l'est pas, seul le lissage peut agir.
   - Risque: aucun pour le jeu.
   - **Étape `8.6`, faite le 25 septembre 2026.**
3. **Adoucir le lissage sans ajouter de retard**, à décider après l'action 2 et seulement si le réseau est en cause. Deux voies, à éprouver en jouant:
   - **régler la vitesse du lissage sur le battement nominal de 50 ms**, et non sur le dernier écart observé. Après un instantané en retard, le lissage ne ralentit plus les personnages pour la suite: il supprime la course qui suit chaque arrêt. Il ne supprime pas l'arrêt lui-même.
   - **prolonger brièvement le mouvement** quand l'instantané suivant tarde, d'au plus un battement, dans la direction connue de chaque personnage. Plus d'arrêt tant que le retard reste court, mais une petite correction visible quand un personnage a tourné entre-temps. C'est contraire au principe écrit du lissage, « on interpole, on n'extrapole jamais »: à trancher par le porteur du projet.
   - Forme: **étape**, à planifier après `8.6` selon son résultat.

**Ce qu'on accepte de ne pas faire, et pourquoi.**

- **Aucun retard ajouté à l'affichage**, sur décision du porteur du projet.
- **Aucune optimisation du dessin.** Il prend moins d'une milliseconde sur ce téléphone: ni WebGPU, ni densité réduite, ni HUD allégé ne se verraient.
- **Pas de prédiction de notre propre ninja.** Faire avancer notre personnage avant la réponse du serveur rendrait la saisie plus vive, mais ce serait rejouer les règles du jeu dans la page, avec les corrections visibles qu'elle impose. Hors de propos tant que la saisie n'est pas jugée molle.

### 8.1 Défaut trouvé en route: les PNJ nés au même point

Relevé par le porteur du projet pendant la partie Tactique: une très grosse majorité des PNJ apparaissait dans une zone arrondie près du joueur, au lieu d'être répartie sur toute la carte. Ce n'était pas l'affichage: c'est le moteur.

**La cause.** Chaque PNJ doit naître à 100 pixels de toutes les autres entités, en cent tirages au plus. Passé environ 150 PNJ sur Tokyo, la carte n'a plus assez de place: les cent tirages échouent, et la recherche de secours part du **centre de la carte** en spirale. Son second passage, qui renonce à l'écart, rend alors **le même point à chaque PNJ**. Mesure sur les vraies cartes, avec leurs murs: **138 PNJ sur 300 exactement au même endroit sur Tokyo**, 335 sur 500; 161 sur 500 sur Spirit & Time; 98 sur 300 sur le Quartier. Le défaut date de l'étape 7.6, qui a porté les plafonds au-delà de ce que l'écart permet. Le jeu d'origine, limité à 150 PNJ et dont l'écart ne s'appliquait jamais (défaut X4), ne le connaissait pas.

**La correction** (`positionDApparition`, `packages/sim/src/etat.ts`). Quand aucun tirage ne tient les 100 pixels, on retire au sort avec un écart de 50, puis 25, puis 0 pixel (`APPARITION.ECARTS_DE_REPLI`), avant de recourir à la spirale. Tant que la carte a la place, les tirages sont exactement ceux d'avant. Après correction, plus aucune pile, sur les quatre cartes, jusqu'à 500 PNJ.

**Ce que cela change aux parties de référence.** La partie à 50 PNJ est identique. Les trois autres, à 150 et 300 PNJ, changent: elles étaient elles-mêmes touchées. À 150 PNJ sur Tokyo avec ses murs, des PNJ naissaient déjà empilés, et les ralliements y passent de 432 à 322. Nouvelles empreintes au handoff de l'étape.
