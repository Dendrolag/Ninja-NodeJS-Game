# assets - Ressources du jeu

Images et sons dont le jeu a besoin pour s'afficher et se faire entendre. C'est du **contenu**, pas du code: ces fichiers ne sont ni compilés, ni vérifiés par le linter, ni formatés.

Déposés à l'étape 4.2, quand le rendu PixiJS en a eu besoin pour la première fois, et complétés à l'étape 4.3 pour les menus. Jusque-là, seules les six images de collision existaient, dans `legacy/assets/`, et elles n'étaient lues par personne.

Le serveur du jeu sert ce dossier à l'adresse `/assets` (`packages/server/src/fichiers.ts`).

## Provenance

Tout vient de la branche `master`, dossier `public/assets/`, extrait sans changer de branche:

```bash
git show master:public/assets/images/ninja/north_1.png > assets/ninja/north_1.png
```

Les six `collision.png` ont été comparées octet par octet à celles de `legacy/assets/maps/`: elles sont identiques. Les tests de caractérisation de l'étape 0.2 continuent donc de décrire exactement les images que le jeu utilise.

Exception, les deux sons du katana du mode Massacre (étape 7.4), `sons/katana-swing.mp3` et `sons/katana-hit.mp3`: ils ne viennent pas de `master`. Synthétisés par un script à l'étape 7.4, ils ont été remplacés à l'étape 5.5 par deux sons fournis par le porteur du projet, le 18 septembre 2026.

De même, les deux sons du fusil du mode Tactique, `sons/shotgun-wave.mp3` (chacun de nos tirs) et `sons/shotgun-reload.mp3` (une charge qui revient), fournis par le porteur du projet à l'étape 5.5, le même jour.

Les six sons de la fumée et des mines, fournis par le porteur du projet à l'étape 8.8, le 2 octobre 2026, à la place des sons du jeu qui en tenaient lieu depuis les étapes 7.10 à 7.12: `sons/bonus-escape-nuage.mp3` (la fumée), `sons/mine-pose.mp3` (une mine posée), `sons/activation-mine.mp3` (une mine ou une mine de zone armée), `sons/explosion-mine.mp3` (une mine qui saute) et `sons/explosion-mine-zone.mp3` (une zone qui s'ouvre).

**Le décor de `cartes/map3/`, Spirit & Time, ne vient plus du jeu d'origine** depuis l'étape 8.8: un toit-terrasse au-dessus d'une ville, livré par le porteur du projet à 3000 sur 2200, avec sa collision, son lointain (`background-parallax.png`) et sa vignette. À sa demande, la carte a été réduite de 20 pour cent, pour que les ninjas n'y paraissent pas trop petits: les images sont à 2400 sur 1760. Trois transformations, faites une fois:

- le fond et le lointain, réduits, sont ramenés pixel par pixel à la couleur la plus proche de leur palette d'origine (450 couleurs): même style, même poids que les fichiers livrés;
- l'avant-plan, qui n'était pas réduit à une palette, est seulement réduit;
- la collision, livrée en noir sur transparent, est posée sur du blanc, puis moyennée par zone: le jeu ignore l'opacité, et telle quelle toute la carte aurait été un mur. La vignette est ramenée à 120 sur 120.

**Le décor de `cartes/station/`, la Station lunaire, est l'œuvre de 2-Minute Tabletop** (https://www.patreon.com/2minutetabletop), sous licence Creative Commons BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/): livré par le porteur du projet à l'étape 8.9, le 3 octobre 2026. La licence oblige à nommer l'auteur et à renvoyer à la licence, ce que font les crédits du jeu, à dire ce qui a été changé, ce que fait ce paragraphe, et interdit tout usage commercial. Les images sont à la taille de la carte, 2000 sur 1524:

- `background.png`, le fond de jour, et `background-night.png`, le fond de nuit, tels que livrés (`background-day.png` et `background-night.png`);
- `spaceship.png`, le vaisseau qui survole la carte, tel que livré: l'arrière en haut, l'avant en bas;
- `collision.png`, en noir et blanc, **ses murs trop fins épaissis**: le trait livré entre le toit et le quai ne faisait que cinq pixels, et le moteur, qui regarde le disque d'un ninja par points écartés de huit pixels au plus, jugeait tenables des places à cheval sur lui, au pied du toit, coupées du reste de la carte (étape 8.10). Tout mur plus fin que neuf pixels a été épaissi de deux pixels de chaque côté, soit 2 596 pixels de mur ajoutés, le long du bord du toit, invisibles à l'œil. La mesure des passages n'en bouge pas (dixième le plus serré à 34 pixels de dégagement, avant comme après);
- `preview.png`, la vignette, découpée au centre du fond de jour en carré de 1524 de côté, puis réduite à 120 sur 120.

Pas d'avant-plan: seul le vaisseau passe devant les ninjas.

Exception plus large, **la carte `cartes/quartier/`**: elle ne vient de nulle part. Ses quatre images sont produites par un programme du dépôt, `docs/mesures/dessiner-le-quartier.mjs`, à l'étape 8.2. C'est la première carte dessinée pour ce jeu-ci, et la seule qui se refait d'une commande:

```bash
node docs/mesures/dessiner-le-quartier.mjs
```

Ne pas retoucher ses images à la main: le programme les réécrirait. La géométrie du quartier se change dans le programme, et se juge ensuite par `docs/mesures/mesurer-les-cartes.mjs`.

## Arborescence

| Dossier                      | Contenu                                                                                                                                                                                                                                                                                      | Qui le lit                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `cartes/<carte>/`            | `background.png`, `collision.png`, `foreground.png` (sauf la Station lunaire), `rain.png` pour map1 (Tokyo), `background-parallax.png` pour map3 (Spirit & Time), `background-night.png` et `spaceship.png` pour la Station lunaire. Une seule orientation: le miroir se calcule (étape 8.3) | `collision.png` par le serveur, les autres par le client |
| `cartes/<carte>/preview.png` | La vignette de la carte, montrée dans les réglages du salon                                                                                                                                                                                                                                  | Le client                                                |
| `ninja/`                     | Les dix-sept sprites du personnage: huit directions à deux images, plus l'immobilité                                                                                                                                                                                                         | Le client                                                |
| `objets/`                    | Les icônes des objets: six images du jeu d'origine, et les six du Tactique en SVG (étape 7.7), reprises aussi dans l'aide                                                                                                                                                                    | Le client                                                |
| `sons/`                      | Les sons de jeu, le clic des menus, la musique des menus et celle de la partie                                                                                                                                                                                                               | Le client                                                |

Les chemins ne se recopient nulle part: ils se fabriquent dans `packages/shared/src/ressources.ts`, qui est le seul endroit à connaître cette arborescence. Un test y vérifie que chaque fichier annoncé existe.

## Les noms de fichiers sont restés en anglais

Contrairement au code et à la documentation. Ce sont des noms de contenu, pas de code: les renommer obligerait à retoucher des images inchangées depuis deux ans, pour un gain nul, et couperait le lien avec la branche `master` d'où ils viennent. Les noms des dossiers, eux, suivent la convention du projet.

## Les images de Tokyo font 3000x2000

Alors que la carte mesure 2000x1500. Les images du jeu d'origine faisaient toutes cette taille. Ce n'est pas une erreur: le jeu d'origine **redimensionne** ces images aux dimensions de la carte au chargement, sans conserver les proportions. Le décodage du terrain (`packages/server/src/terrain.ts`) et l'affichage (`packages/client/src/rendu/`) reproduisent tous les deux ce redimensionnement, sans quoi les murs ne seraient pas là où le décor les montre.

Le Quartier, lui, est dessiné à ses dimensions exactes, 2400x1800, Spirit & Time l'est depuis l'étape 8.8, 2400x1760, et la Station lunaire depuis sa livraison, 2000x1524. Le redimensionnement du serveur et l'étirement du client s'y appliquent aussi, et n'y changent rien. C'est ce qu'il faudra demander à un graphiste: dessiner à la taille de la carte évite le seul piège vraiment coûteux de la commande.

## map2 a disparu: Tokyo est une seule carte

Le jeu d'origine avait deux cartes Tokyo, map1 (Rainy Tokyo) et map2 (Tokyo), dont le décor, l'avant-plan, les murs et la vignette étaient identiques octet pour octet: seule la pluie de `rain.png` les distinguait. Depuis l'étape 7.6, c'est une seule carte, map1, et la pluie est un réglage de partie. Les images de map2 ont été retirées de ce dossier; elles restent dans l'histoire du dépôt et sous l'étiquette `v0.8.6`. Les parties enregistrées sur map2 se lisent toujours, sous le nom « Tokyo ».

## Ce qui n'est pas ici

L'ensemble pèse 72 Mo sur `master`, dont beaucoup de contenu mort recensé dans `docs/audit/AUDIT-EXISTANT.md`. On n'a repris que ce qui est réellement affiché ou joué.

Laissé de côté:

- `audio/game-music-1.wav` (47 Mo) et `menu-music-1.wav` (15 Mo), remplacés depuis par leurs versions mp3 et jamais chargés.
- `audio/game-music.mp3`, `bot-convert-old.mp3`, `button-click-2.wav`, et les doublons `.wav` de sons existant aussi en `.mp3`.
- `audio/countdown.wav`, chargé par le jeu d'origine mais jamais joué.
- `assets/map/`, ancienne carte remplacée par `assets/maps/`.
- Les polices du jeu d'origine (Permanent Marker, Bruno Ace et quatre autres jamais chargées): l'interface utilise celles de la maquette, empaquetées avec la page depuis les paquets Fontsource. Décision du 10 septembre 2026.
- Les pictogrammes d'interface du jeu d'origine (`leave.svg`, `settings.svg`, les GIF animés des bonus): l'interface dessine ceux de la maquette (`packages/client/src/interface/icones.ts`).
- Les fonds d'accueil (`background-home.jpg`, `background.mp4`): l'ambiance est dessinée en CSS.

Rangé ailleurs: les icônes de la page (`favicon.ico`, `favicon.svg`, `apple-touch-icon.png`), qui viennent aussi de `master`, sont dans `packages/client/page/`. Elles appartiennent à la page, pas au jeu, et l'empaqueteur les copie à sa racine.

Une référence morte à signaler, trouvée en rapatriant: le gestionnaire audio d'origine charge `audio/game-over-music.wav`, **qui n'existe pas sur `master`**. Le chargement de tout l'audio échouait donc systématiquement à cette ligne (défaut X32 de l'audit).
