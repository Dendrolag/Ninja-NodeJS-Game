# Audit des saccades sur téléphone (étape 8.5)

Rapport de l'étape 8.5. Fiche: `docs/plan/etape-8-5.md`.

**Statut au 21 septembre 2026: l'instrument est prêt et en ligne, les mesures sur le vrai téléphone sont à faire.** Les sections 1 à 5 sont écrites: le problème, l'instrument, le protocole de recette et les douze hypothèses, toutes ouvertes. Le verdict (section 6) et le plan d'action (section 8) attendent les relevés de l'iPhone 14 Pro, et la section 7 n'en dit que ce qui est déjà su.

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
- **Images**: la durée mesurée, la cadence, la cadence de l'écran estimée (60 ou 120 Hz), la répartition des durées d'image (moyenne, médiane, p90, p99, maximum), les images d'au moins 25, 50, 100 et 250 ms, et les interruptions (page cachée, dont l'écart n'est pas compté).
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

Chaque relevé brut est rangé dans `docs/mesures/releves-8-5/`, un fichier par partie, sous son numéro. L'état des hypothèses (section 5), le verdict (section 6) et le plan d'action (section 8) s'écrivent à partir d'eux, chiffres cités.

## 5. Les hypothèses

Écrites pour être réfutées. Les dix premières sont celles de la fiche; les deux dernières sont apparues à la lecture du code au début de l'étape. **Toutes sont ouvertes** tant que les relevés du téléphone ne sont pas là.

| N°  | Hypothèse                                              | Ce qui la confirmerait                                                                                 | Ce qui l'écarterait                                            | Partie | État    |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------ | ------- |
| 1   | Le dos de rendu choisi par Safari                      | WebGPU nettement meilleur ou pire que WebGL, à tout le reste égal                                      | Aucun écart entre les parties 1 et 6                           | 1, 6   | ouverte |
| 2   | L'écran à 120 Hz                                       | Cadence estimée à 120 Hz, et images lentes qui disparaissent plafonnées à 60                           | Cadence estimée à 60 Hz dès la partie 1                        | 1, 5   | ouverte |
| 3   | Le coût du dessin, sur la carte graphique du téléphone | PixiJS ou le temps hors chronomètres qui baisse nettement à la densité 1                               | Aucun écart entre les parties 1 et 4                           | 1, 4   | ouverte |
| 4   | Les téléversements de texture                          | Pires images groupées au début, ou à l'apparition d'un effet; partie 7 plus fluide                     | Pires images réparties sur toute la partie, partie 7 identique | 1, 7   | ouverte |
| 5   | Le ramasse-miettes                                     | Images longues à intervalles réguliers, hors de nos chronomètres, sans cause visible                   | Aucune image longue inexpliquée                                | 1, 8   | ouverte |
| 6   | Le lissage entre deux instantanés                      | Images fluides mais beaucoup d'images tenues, ou lissage lent dans notre code                          | Peu d'images tenues, lissage bon marché                        | 1      | ouverte |
| 7   | Le réseau                                              | Écarts entre instantanés irréguliers (p99 au-delà de 100 ms), battements sautés, écart Wi-Fi et mobile | Instantanés réguliers à 50 ms                                  | 1, 8   | ouverte |
| 8   | L'échauffement et l'économie d'énergie                 | Le déroulé de la partie 8 se dégrade au fil des fenêtres                                               | Déroulé stable sur trois minutes                               | 8      | ouverte |
| 9   | Le son                                                 | Partie 2 nettement plus fluide que la partie 1                                                         | Aucun écart                                                    | 2      | ouverte |
| 10  | Le filtre de lueur                                     | Images lentes pendant les repères seulement (apparition, capture)                                      | Aucune corrélation                                             | 1      | ouverte |
| 11  | Le HUD réécrit à chaque image, sur des fonds floutés   | Partie 3 nettement plus fluide que la partie 1, temps hors chronomètres qui baisse                     | Aucun écart                                                    | 3      | ouverte |
| 12  | La saisie tactile                                      | Fluide sans toucher, haché en jouant                                                                   | Aucun écart entre les deux moitiés de la partie 9              | 9      | ouverte |

### 5.1 Ce que la lecture du code a déjà appris

Pas un verdict, des faits qui orientent la lecture des relevés.

- **Hypothèse 1: la fiche se trompait sur le dos de rendu par défaut.** PixiJS 8.19 essaie **WebGL d'abord**, puis WebGPU, puis le canevas (`autoDetectRenderer`, ordre `webgl`, `webgpu`, `canvas`). Sur Safari, c'est donc WebGL qui tourne, pas WebGPU. La variante `rendu=webgpu` essaie l'autre.
- **Hypothèse 11, nouvelle: le HUD est réécrit à chaque image.** `hud/surcouche.ts` écrit à chaque image le texte du temps, celui de la pause, chaque ligne du classement, les couleurs et la position de chaque point de la minimap, et **reconstruit entièrement la liste des effets en cours** (`replaceChildren`, puis de nouveaux éléments) tant qu'un bonus ou un malus est actif. Réécrire un texte identique invalide quand même la mise en page. Le coût en JavaScript est faible et le relevé le chiffre (« dont HUD »), mais la mise en page et le dessin qui suivent se font hors de nos chronomètres. Or cinq éléments du HUD posent un **flou d'arrière-plan** (`backdrop-filter`) sur un canevas qui change à chaque image: le navigateur doit alors reflouter leur fond à chaque image. Sur ordinateur, c'est invisible. Sur un écran de densité 3, dont l'interface est composée à pleine densité alors que le jeu est plafonné à 2, c'est à mesurer.
- **Hypothèse 12, nouvelle: la saisie tactile.** La manette écoute `touchmove` en mode non passif, pour empêcher le défilement de la page. Le navigateur doit alors attendre la page avant de traiter chaque contact. Cela retarde la saisie plus que l'image, mais une page occupée la rend sensible.
- **Deux minuteurs dessinent chaque image.** PixiJS a le sien, qui dessine, et la boucle du jeu a le sien, qui prépare la scène. Ils tournent au même pas, si bien que PixiJS dessine la scène préparée à l'image précédente: une image de retard, pas une saccade. La variante `cadence` fait passer la boucle juste avant le dessin, dans le même battement: si elle devenait le réglage du jeu, ce retard disparaîtrait aussi.
- **Hypothèse 6: le lissage s'adapte à l'écart observé entre les deux derniers instantanés.** Un instantané en retard fait attendre les personnages, puis le suivant, arrivé tôt, les fait courir: le mouvement affiché suit l'irrégularité du réseau au lieu de l'absorber. Sur un réseau régulier, c'est invisible (1,5 pour cent d'images tenues au bureau). Sur un accès mobile, c'est exactement la forme 3. Le relevé compte les images tenues et la répartition des écarts.

## 6. Verdict

À écrire à partir des relevés. Il dira laquelle des quatre formes, à quel moment, et la ou les causes, avec le chiffre qui les désigne.

## 7. Ce que le banc de l'étape 5.7 ne voyait pas

Ce qui est déjà su, avant même les relevés:

- **Ni Safari, ni une carte graphique de téléphone.** Le banc mesure Chromium sur une carte de bureau. Il ralentit le processeur, pas la carte graphique ni sa mémoire.
- **Ni le HUD, ni la mise en page.** Le banc fait tourner sa propre boucle, sans surcouche ni document autour du canevas: les coûts de l'hypothèse 11 lui sont invisibles par construction.
- **Ni le réseau.** Le banc fabrique ses instantanés à la cadence parfaite. Il ne peut pas voir la forme 3.
- **Ni la durée.** Le banc mesure quelques secondes après échauffement: il ne voit ni la chaleur ni une fuite.

Ce qu'il faudra lui ajouter se décidera avec le verdict.

## 8. Plan d'action

À écrire à partir du verdict: les actions ordonnées par gain rapporté au coût, chacune avec son gain espéré et d'où vient l'estimation, son risque pour le jeu, et si elle tient dans un réglage (faite dans l'étape et remesurée) ou demande une étape (proposée au ROADMAP).
