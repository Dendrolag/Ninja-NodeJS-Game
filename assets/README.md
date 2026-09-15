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

## Arborescence

| Dossier                            | Contenu                                                                              | Qui le lit                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `cartes/<carte>/<normal\|mirror>/` | `background.png`, `collision.png`, `foreground.png`, et `rain.png` pour map1         | `collision.png` par le serveur, les autres par le client |
| `cartes/<carte>/preview.png`       | La vignette de la carte, montrée dans les réglages du salon                          | Le client                                                |
| `ninja/`                           | Les dix-sept sprites du personnage: huit directions à deux images, plus l'immobilité | Le client                                                |
| `objets/`                          | Les six icônes de bonus et de malus, reprises aussi dans l'aide                      | Le client                                                |
| `sons/`                            | Les sons de jeu, le clic des menus, la musique des menus et celle de la partie       | Le client                                                |

Les chemins ne se recopient nulle part: ils se fabriquent dans `packages/shared/src/ressources.ts`, qui est le seul endroit à connaître cette arborescence. Un test y vérifie que chaque fichier annoncé existe.

## Les noms de fichiers sont restés en anglais

Contrairement au code et à la documentation. Ce sont des noms de contenu, pas de code: les renommer obligerait à retoucher des images inchangées depuis deux ans, pour un gain nul, et couperait le lien avec la branche `master` d'où ils viennent. Les noms des dossiers, eux, suivent la convention du projet.

## Les images de carte font toutes 3000x2000

Y compris celles de map1 et map2, dont la carte mesure 2000x1500. Ce n'est pas une erreur: le jeu d'origine **redimensionne** ces images aux dimensions de la carte au chargement, sans conserver les proportions. Le décodage du terrain (`packages/server/src/terrain.ts`) et l'affichage (`packages/client/src/rendu/`) reproduisent tous les deux ce redimensionnement, sans quoi les murs ne seraient pas là où le décor les montre.

## map1 et map2 partagent décor et vignette

Leurs `background.png` et leurs `preview.png` sont identiques octet pour octet. Ce n'est pas un oubli du rapatriement: Rainy Tokyo est Tokyo sous la pluie, et c'est `rain.png` qui fait la différence.

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
