# Handoff - Étape 4.2 Rendu in-game PixiJS

Date: 10 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Afficher la partie en cours avec PixiJS sur GPU, tenir plus de 100 bots animés avec la lueur néon en filtre GPU, afficher le HUD en surcouche, et brancher les contrôles et les sons.

## Ce qui a été fait

- **Le rendu existe.** Terrain, décor, zones, objets, halos et personnages s'affichent en PixiJS. La lueur néon est un seul filtre posé sur le calque des entités, et non plus un flou recalculé par entité.
- **La mesure valide le choix du moteur**: 60 images par seconde à 100, 200 et 500 sprites animés, lueur allumée, sur carte graphique. Détail plus bas.
- **Le mouvement est lissé** entre deux battements reçus, sans jamais extrapoler.
- **Le HUD** calcule le temps restant, le classement, les effets en cours avec leur décompte, la minimap, et il les écrit dans une surcouche DOM.
- **Les contrôles** existent au clavier (ZQSD, WASD, flèches) et au pouce (manette virtuelle). Ils émettent `deplacer`, et seulement quand l'intention change.
- **Les sons** sont déclenchés localement par les faits reçus et les changements d'état. AudioManager est porté.
- **La dette la plus ancienne du projet est soldée.** Le serveur décode enfin les murs des cartes: jusqu'ici, toutes les parties se jouaient sur une carte vide.
- **Les ressources sont rapatriées** de `master` dans `assets/`, soit 18 Mo triés sur les 72 d'origine.
- **Cinq défauts du legacy relevés** (X31 à X35 de l'audit), dont les sons de ramassage que personne n'a jamais entendus.
- **Un défaut trouvé dans mon propre code** en écrivant le test de la boucle: la boucle sonore d'un bonus ne se serait jamais arrêtée. Corrigé avant commit, voir « Décisions », point 6.
- **142 tests ajoutés**: 966 passent, contre 824 au handoff 4.1.

## Fréquences d'images mesurées

Banc `tests/e2e/banc-rendu.spec.ts`, projet Playwright `banc`. Chaque charge est mesurée pendant trois secondes, avec des sprites qui bougent tous en permanence, un nouveau battement toutes les 50 millisecondes, deux objets et une zone. La page fait tourner la **compilation réelle** du paquet client, pas un extrait écrit pour l'occasion.

Sur carte graphique (NVIDIA GeForce RTX 2080 Ti, Direct3D 11 via ANGLE, Chromium de Playwright, fenêtre 1280x720):

| Sprites | Images/s avec lueur | Images/s sans lueur | Coût de notre code par image | Pointe |
| ------: | ------------------: | ------------------: | ---------------------------: | -----: |
|     100 |                59,2 |                60,5 |                      0,30 ms | 2,2 ms |
|     200 |                60,1 |                60,1 |                      0,37 ms | 1,6 ms |
|     500 |                60,0 |                60,0 |                      1,18 ms | 2,6 ms |

La cadence est plafonnée par la synchronisation de l'écran à 60: la charge n'entame pas la cadence. Le coût de notre code (construire la scène et la transmettre à PixiJS) reste sous 1,2 ms à 500 sprites, soit 7 pour cent du budget d'une image.

Sans carte graphique, sur la même machine (avant l'ajout des options GPU au projet `banc`):

| Sprites | Images/s avec lueur | Images/s sans lueur | Coût de notre code par image |
| ------: | ------------------: | ------------------: | ---------------------------: |
|     100 |                10,8 |                19,2 |                      0,57 ms |
|     200 |                10,5 |                17,2 |                      0,73 ms |
|     500 |                 8,8 |                12,0 |                      2,24 ms |

En intégration continue (GitHub Actions, Ubuntu, SwiftShader sur Vulkan, sans carte graphique), relevé au premier passage:

| Sprites | Images/s avec lueur | Images/s sans lueur | Coût de notre code par image | Pointe |
| ------: | ------------------: | ------------------: | ---------------------------: | -----: |
|     100 |                 4,0 |                 4,9 |                      1,05 ms | 2,5 ms |
|     200 |                 3,8 |                 4,3 |                      1,41 ms | 3,0 ms |
|     500 |                 2,7 |                 3,8 |                      3,01 ms | 4,1 ms |

**Ce que ces chiffres disent.** Sur carte graphique, la charge ne coûte rien à la cadence: c'est la propriété recherchée, et la validation de la cible de plus de 100 bots. En rendu logiciel, la cadence baisse avec la charge, parce que chaque sprite y coûte ses pixels calculés un par un par le processeur: ces chiffres mesurent SwiftShader, pas notre rendu. Le coût de notre propre code, lui, reste du même ordre partout, 3 ms au pire sur la machine la plus lente.

**Pourquoi les seuils du banc dépendent du moteur qui dessine.** Le banc lit le nom du moteur de rendu et annote le rapport Playwright avec le mode retenu. Partout, il exige un coût de notre code sous 8 ms par image et toutes les entités dessinées. Ensuite:

- **sur carte graphique**, une cadence d'au moins 30 images par seconde à chaque charge, et une cadence à 500 sprites supérieure à la moitié de celle à 100;
- **en rendu logiciel**, seulement des images qui avancent, soit plus d'une par seconde.

Un seuil de cadence commun aux deux a été essayé d'abord, et il a fait échouer la CI sans qu'aucune régression ait eu lieu: voir « Décisions », point 7.

## Structure du rendu

Le principe est le même dans les quatre dossiers. **Ce qui décide est une fonction pure testée sans navigateur. Ce qui touche au navigateur ne décide rien.**

```
etat du client ─┬─> TamponDeLissage ──> construireScene ──> Rendu (PixiJS) ──> GPU
                ├─> camera (suivre)  ─────────────────────────┘
                ├─> construireHud ────> Surcouche (DOM)
                └─> sonsDuChangement / sonDuFait ──> LecteurDeSons
saisie ──> Controles ──> aEmettre ──> client.deplacer ──> reseau
```

`lancerLaBoucle` est le seul endroit où ces morceaux se rencontrent. Elle lit `client.etat` à chaque image, elle ne s'abonne pas, comme le prévoyait le handoff 4.1.

| Fichier                                | Responsabilité                                                                          | Pur |
| -------------------------------------- | --------------------------------------------------------------------------------------- | --- |
| `rendu/apparence.ts`                   | Couleurs, tailles, cadences, réglage de la lueur. Valeurs du legacy                     | oui |
| `rendu/camera.ts`                      | Grossissement, bornage aux limites de la carte, suivi en fonction du temps écoulé       | oui |
| `rendu/interpolation.ts`               | Les deux derniers battements, et la position intermédiaire à afficher                   | oui |
| `rendu/animation.ts`                   | Image de marche, pulsation des halos, clignotement des objets, en fonction de l'instant | oui |
| `rendu/scene.ts`                       | Ce qu'il faut dessiner: sprites, disques, zones                                         | oui |
| `rendu/pixi.ts`                        | L'adaptateur PixiJS. Calques, sprites réutilisés, textures partagées teintées, lueur    | non |
| `rendu/boucle.ts`                      | La boucle d'images: saisie, sons, lissage, caméra, scène, HUD                           | non |
| `controles/touches.ts`, `intention.ts` | Plan de touches, calcul de la direction demandée                                        | oui |
| `controles/controles.ts`               | État de saisie, et ce qu'il reste à émettre                                             | oui |
| `controles/clavier.ts`, `tactile.ts`   | Écoutes du document, retirables                                                         | non |
| `hud/modele.ts`                        | Ce que la surcouche affiche                                                             | oui |
| `hud/surcouche.ts`                     | Écriture dans le document, `textContent` seulement                                      | non |
| `sons/declencheurs.ts`                 | Quel fait et quel changement d'état produisent quel son                                 | oui |
| `sons/lecteur.ts`                      | Le haut-parleur                                                                         | non |
| `packages/shared/src/ressources.ts`    | La seule définition de l'arborescence des ressources, lue par le serveur et le client   | oui |
| `packages/server/src/terrain.ts`       | Décodage de `collision.png`, redimensionnement aux dimensions de la carte, cache        | non |

**L'ordre des calques** est écrit une seule fois, dans `monterRendu`: décor, zones, libellés, disques, objets, entités, premier plan. **Le monde entier** vit dans un conteneur que la caméra déplace par une matrice. **Les dix-sept images du ninja** servent à toutes les entités, avec la couleur appliquée par teinte GPU. Le legacy fabriquait une image colorée par entité et par couleur.

## Fichiers créés ou modifiés

Créés, dans `packages/client/src/`

- `rendu/apparence.ts`, `camera.ts`, `interpolation.ts`, `animation.ts`, `scene.ts`, `pixi.ts`, `boucle.ts`: le rendu, décrit ci-dessus.
- `controles/intention.ts`, `touches.ts`, `controles.ts`, `clavier.ts`, `tactile.ts`: la saisie.
- `hud/modele.ts`, `surcouche.ts`: le HUD.
- `sons/declencheurs.ts`, `lecteur.ts`: le son.
- Tests: `rendu/scene.test.ts` (20), `interpolation.test.ts` (14), `camera.test.ts` (13), `boucle.test.ts` (7), `controles/controles.test.ts` (20), `hud/modele.test.ts` (16), `sons/sons.test.ts` (21).

Créés ailleurs

- `packages/shared/src/ressources.ts` et `ressources.test.ts` (12 tests, dont deux qui vérifient que chaque fichier annoncé existe sur le disque).
- `packages/server/src/terrain.ts` et `terrain.test.ts` (19 tests, dont le décodage des six vraies cartes et le câblage dans le serveur).
- `assets/`: cartes, sprites, icônes, sons, et `assets/README.md` pour la provenance et ce qui n'a pas été repris.
- `tests/e2e/banc-rendu.spec.ts`: le banc de mesure.
- `tests/e2e/harnais/serveur-statique.ts`: un serveur de fichiers à liste blanche, pour le banc seulement. `harnais/compiler.ts`: compile les paquets avant les scénarios.

Modifiés

- `packages/server/src/ServeurSocket.ts`: charge le terrain à l'ouverture d'une partie et à chaque changement de réglages; un terrain illisible est journalisé, la partie se joue sans mur.
- `packages/server/src/serveur.ts`, `principal.ts`: l'option `terrains`; seul `principal.ts` fournit le `ChargeurDeTerrain`.
- `packages/server/src/index.ts`, `packages/shared/src/index.ts`, `packages/client/src/index.ts`: exports, et carte des modules en tête du client.
- `packages/client/package.json`: `pixi.js` 8.19 et `pixi-filters` 6.1. `packages/server/package.json`: `pngjs` 7 et `@types/pngjs`.
- `playwright.config.ts`: compilation préalable, projet `banc` isolé avec options GPU et sans nouvelle tentative, exclu des projets `bureau` et `mobile`.
- `tsconfig.tests.json`: bibliothèque DOM, justifiée dans le fichier.
- `docs/plan/etape-4-2.md`: section « Réconciliation » à huit points.
- `docs/design/README.md`: huit décisions du 10 septembre 2026.
- `docs/audit/AUDIT-EXISTANT.md`: défauts X31 à X35.
- `CLAUDE.md`: la section Commandes disait que rien ne s'affiche et qu'il n'y a ni rendu ni saisie. Corrigée: tout existe sauf la page.

Aucune modification de `packages/sim`, `legacy/` ni `tests/caracterisation/`.

## Tests

- Ajoutés: 142 tests Vitest, et le banc Playwright.
  - Le test exigé « le nombre d'entités affichées correspond à l'état reçu » est dans `scene.test.ts`. Il est rejoué à travers la boucle entière dans `boucle.test.ts`.
  - Le test exigé « une touche de déplacement émet `deplacer` » tourne sur un vrai client relié au transport d'essai, dans `controles.test.ts`.
- Résultat: **966 tests Vitest passent, 0 échec**. **5 scénarios Playwright passent**: les 4 de fumée et le banc.
- Couverture: **99,74 pour cent** sur `packages/sim` et `packages/shared`, contre 99,73. `ressources.ts` entre dans la mesure et est couvert.
- Types, linter, formatage: verts. `pnpm verify` passe.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.
- CI: le premier passage (run 34461454807) était rouge sur le seul banc de mesure, les tests unitaires verts. Cause et correction au point 7 des décisions. État après correction: à confirmer après la poussée.

## Décisions et écarts au plan

Les décisions de fond sont au journal de `docs/design/README.md`, datées du 10 septembre 2026. Les huit écarts à la fiche sont dans sa section « Réconciliation ». Six points méritent d'être lus ici.

### 1. Trois éléments de la fiche n'existent pas dans le contrat

- **`startCapture` et `endCapture`** appartiennent au mode tactique écarté. En Classique, on capture en touchant. Il n'y a donc ni touche de capture ni zone de tap, et le test des contrôles ne porte que sur `deplacer`.
- **`playerSound`** a été supprimé à l'étape 2.2: le son est local.

Aucun des trois ne pouvait être branché. Leur absence est une conséquence du périmètre, pas un manque.

### 2. Le serveur ne lit le disque que si on le lui demande

`creerServeur` joue **sans mur par défaut**; seul `principal.ts` fournit le `ChargeurDeTerrain`. Un décodage coûte 150 à 400 ms, et les tests montent un serveur par test: les brancher par défaut aurait ajouté une dizaine de secondes à chaque exécution, pour des tests qui vérifient des messages et pas des murs.

Le câblage lui-même est couvert par trois tests dans `terrain.test.ts`, avec une source espionne.

**Conséquence à connaître**: aucun test d'intégration ne joue encore une partie avec de vrais murs. L'étape 4.4 le fera naturellement, en jouant sur le vrai serveur.

### 3. Le redimensionnement du terrain moyenne les pixels

Le legacy confiait la réduction de 3000x2000 vers 2000x1500 au canevas de Node, qui lisse. Prélever un pixel sur trois ferait disparaître un mur fin deux fois sur trois. La moyenne par zone donne le même genre de résultat que le lissage, et elle reste déterministe.

**Écart assumé et non mesuré**: quelques pixels de bord de mur peuvent différer du legacy, sans effet perceptible au rayon de 16 px des entités.

### 4. L'intention de déplacement ne part qu'au changement

C'est possible parce que le serveur conserve la dernière intention d'un battement à l'autre, et parce que le transport garantit l'ordre et la remise. Le legacy envoyait 50 messages par seconde.

Si l'étape 2.3 changeait de transport pour un canal sans garantie, la répétition se réintroduirait dans `controles.ts`, et nulle part ailleurs.

### 5. La perte de focus relâche toutes les touches

C'est la correction de X35: sans cela, un joueur qui change d'onglet en courant continue de courir, puisque le serveur garde sa dernière intention.

Cette correction devient plus importante qu'avant, justement parce qu'on n'émet plus qu'au changement (point 4).

### 6. Un défaut trouvé dans mon propre code, avant commit

La boucle sonore d'un bonus lisait la liste d'effets du magasin, qui ne retire un effet expiré qu'à l'arrivée du suivant. **Le son d'un bonus fini aurait donc tourné jusqu'au prochain ramassage.**

Corrigé en lisant `effetsEnCours(etat, maintenant)`. Le test « démarre la boucle sonore d'un bonus et l'arrête quand il expire » l'empêche de revenir.

Même famille de piège que celle signalée par le handoff 4.1 pour les sélecteurs: toute lecture d'effets destinée à l'affichage doit passer par `effetsEnCours`.

### 7. Les seuils de cadence du banc dépendent du moteur qui dessine

Le premier banc appliquait un plancher de 4 images par seconde partout, calibré sur le rendu logiciel de ma machine, qui en faisait 9 à 11. En CI, SwiftShader en fait 2,7 à 4,9: le banc a échoué à 200 sprites avec 3,8, sans aucune régression. Baisser le plancher aurait seulement déplacé le problème à la prochaine machine plus lente.

Le banc détecte donc le moteur qui dessine. Sur carte graphique, il exige la cadence et la mise à l'échelle, qui valident vraiment la charge. En rendu logiciel, il n'exige que ce qui ne dépend pas du matériel, et le dit dans le rapport.

**Conséquence à connaître**: la CI ne valide plus la cadence, seulement notre propre coût par image. La cadence se valide en lançant `pnpm exec playwright test --project=banc` sur une machine équipée d'une carte graphique, comme pour les valeurs de ce handoff.

### Ce que cette étape rend structurellement impossible

- **La cadence d'affichage ne peut plus dépendre du réseau.** La boucle lit l'état, elle ne s'y abonne pas.
- **La lueur ne peut plus coûter plus cher avec le nombre d'entités.** C'est un filtre de calque, mesuré.
- **Un son ne peut plus être demandé sous un nom qui n'existe pas.** La table est un type.
- **Un chemin de ressource ne peut plus diverger entre serveur et client.** Il n'est fabriqué qu'à un endroit.
- **Une partie ne peut plus tourner sans murs en silence.** Un terrain illisible est journalisé.
- **Les écoutes clavier et tactiles ne peuvent plus s'empiler.** Chaque branchement rend sa fonction de retrait.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **On ne peut toujours pas jouer dans un navigateur.** Toutes les pièces existent et sont couvertes, mais aucune page ne les assemble et rien ne sert le client ni `assets/`. C'est le périmètre de l'étape 4.3.
- **Quatre fichiers ne sont couverts par aucun test unitaire**, faute de DOM dans Vitest: `rendu/pixi.ts`, `hud/surcouche.ts`, `controles/clavier.ts` et `controles/tactile.ts`. Voici ce qui les couvre malgré tout:
  - `pixi.ts` tourne dans le banc Playwright;
  - le branchement du clavier est testé avec une cible d'essai;
  - `surcouche.ts` et `tactile.ts` ne tournent encore nulle part. Ils le feront à l'étape 4.3, et l'étape 4.4 les couvrira en bout en bout, fenêtre mobile comprise.
- **Le HUD n'a pas de feuille de style.** Ses éléments portent des classes (`hud`, `hud-temps`, `hud-classement`, `hud-effets`, `hud-minimap`, `hud-manette`, et leurs dérivées), mais ne sont pas mis en forme. La manette virtuelle n'a pas d'habillage.
- **La CI ne valide pas la cadence du rendu**, faute de carte graphique: seulement le coût de notre code et la bonne marche du rendu. La cadence ne se vérifie qu'en local, sur une machine équipée. Si la cible de plus de 100 bots doit être tenue sur des machines modestes, c'est à l'étape 5.2 de mesurer sur un matériel représentatif.
- **Le dépôt s'alourdit de 18 Mo** de ressources, dont 9,3 Mo pour les quatre fonds de map1 et map2.
- **Les libellés des zones sont écrits dans la police par défaut de PixiJS.** Les polices du jeu restent sur `master`, à rapatrier avec les menus.

Repris du handoff 4.1, inchangé:

- Sans identifiant de partie, on entre dans la première qui attend. Provisoire, étape 2.4.
- Le retour au salon après une partie n'existe pas.
- Aucune reconnexion (étape 3.2), aucune capacité maximale par partie (étape 2.4), aucune mesure de charge (étape 5.1).
- `tsc --build` peut laisser une compilation périmée; `tsc --build --force` corrige. **Cela touche désormais aussi le banc**, qui charge `packages/client/dist`.
- `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`.

Fermé par cette étape: **le terrain n'est plus une dette**, le serveur réel joue avec les murs des cartes.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 4.3, menus et interface. Lire `docs/plan/etape-4-3.md` et la réconcilier avec la section 3 du ROADMAP.

**Dans le jalon 1, seuls les écrans du legacy sont construits**: accueil et pseudo, salon, jeu, fin de partie. La ligne de fin de la fiche 4.2 cite aussi le navigateur, la création et le profil: ils appartiennent aux jalons 2 et 3, et le ROADMAP fait foi.

Quatre points à avoir en tête dès le début:

1. **L'écran de jeu est à assembler, pas à écrire.** Il suffit d'appeler, dans l'ordre:
   - `prechargerLesSprites`, puis `monterRendu` et `chargerLeDecor`, avec la carte et le mode miroir lus dans `etat.salon.reglages`;
   - `monterSurcouche`, `new Controles()`, `brancherClavier`, `brancherTactile` (avec `surChangement` relié à `surcouche.afficherLaManette`) et `creerLecteurDeSons`;
   - enfin `lancerLaBoucle`.

   Tout démonter en quittant l'écran de jeu, et appeler `controles.reinitialiser()` à chaque entrée en partie.

2. **Il faut une page et de quoi la servir.** Le handoff 2.2 réservait Express à ce moment-là. Le serveur doit servir le client compilé et `assets/` à l'adresse `RACINE_RESSOURCES` (`/assets`). La carte d'importation de `tests/e2e/harnais/serveur-statique.ts` montre ce que le navigateur doit résoudre. Le choix d'un empaqueteur est à trancher et à consigner.
3. **Textes et ressources des menus.**
   - Les pseudos et le chat se posent avec `textContent`, jamais `innerHTML` (faille S1).
   - Les polices, `button-click.wav` et `menu-music.mp3` sont à rapatrier de `master`, en suivant `assets/README.md`.
   - La feuille de style du HUD est à écrire avec les classes listées ci-dessus.
4. **Le bouton « Terminer » du HUD de la maquette** (tension 7 du journal de conception) reste à trancher: le client expose `quitter`, `mettreEnPause` et `reprendre`.

## Étape suivante

Fiche à lire: `docs/plan/etape-4-3.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 4.3 suit 4.2, puis 4.4 ferme le jalon 1.
