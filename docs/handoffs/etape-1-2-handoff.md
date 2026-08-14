# Handoff - Étape 1.2 Déplacements et collisions

Date: 14 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Porter le terrain, la résolution du déplacement contre les murs et la détection des contacts entre entités dans le cœur de simulation pur, validés contre les tests de caractérisation.

## Ce qui a été fait

- Une carte de collisions taille-agnostique, en données pures, à résolution du pixel comme le legacy, mais stockée à raison d'un bit par pixel.
- La conversion des pixels d'une image de collision en carte, avec le seuil de luminosité à 128, sans jamais lire un fichier depuis le moteur.
- La résolution du déplacement: mouvement complet, glissement le long d'un mur, contournement angulaire, immobilité en dernier recours.
- Le relevé des contacts entre entités, séparé de la règle qui en tire les conséquences.
- Le branchement des deux dans le battement du moteur, à la place du simple bornage à la carte.
- L'apparition d'une entité valide désormais sa position: pas de mur, et cent pixels d'écart avec les entités déjà en place.
- Cinq défauts de l'audit traités par conception: X3, X4, X15, plus X18 et X19 découverts en portant.
- Cinquante-huit tests unitaires ajoutés. Couverture de `packages/sim`: 99,54 pour cent, en hausse.

## Ce que le moteur sait faire de plus, en une page

Le contrat de `tick(etat, entrees, dtMs)` est inchangé, y compris son nombre d'arguments. Ce qui change est dans l'état et dans le comportement du déplacement.

### Le terrain vit dans l'état

```ts
interface EtatPartie {
  // ... inchangé
  readonly terrain: CarteCollisions;
}

interface CarteCollisions {
  readonly largeur: number;
  readonly hauteur: number;
  readonly murs: Uint8Array; // un bit par pixel, lecture seule après construction
}
```

C'est une donnée de configuration, constante pendant toute la partie, partagée par tous les états successifs et jamais recopiée. Elle n'a pas vocation à être diffusée aux clients à chaque battement: la couche réseau choisira ce qu'elle envoie (étape 2.2).

`creerEtatInitial` accepte un terrain optionnel. Sans terrain, la partie se joue sur une carte sans mur, bornée par ses seuls bords, comme le repli du legacy quand son image de collision manquait. **Un terrain aux dimensions différentes de la carte choisie lève une erreur**: c'est exactement la nature du défaut X5, et on refuse au lieu de laisser passer.

### Les fonctions du terrain

```ts
creerCarteCollisions(dimensions, estUnMur?) // depuis une règle
carteSansMur(dimensions)
carteDepuisPixels(donnees, dimensions)      // depuis une image déjà décodée, seuil 128
estMur(carte, x, y)                          // hors carte = mur
positionTenable(carte, position, rayon?)     // centre plus seize points de contour
trajetTenable(carte, depart, arrivee, rayon?) // balaie le trajet, pixel par pixel
```

`resoudreDeplacement(carte, depart, pas, rayon?)` renvoie la position atteinte. Le `pas` est un déplacement complet, déjà mis à la bonne longueur: cette fonction ne connaît ni vitesse ni durée, et les bots de l'étape 1.5 l'utiliseront telle quelle.

### Les contacts

```ts
interface Contact { premier: IdentifiantEntite; second: IdentifiantEntite; distance: number }
detecterContacts(etat): readonly Contact[]   // paires, distance < 20, chaque paire une fois
resoudreContacts(etat, contacts): EtatPartie // renvoie l'état inchangé pour l'instant
```

**C'est ici que l'étape 1.3 doit écrire.** `resoudreContacts` est le point de branchement de la règle de résolution d'un mode de jeu, appelé en fin de `tick`. Il ne fait encore rien, la capture et le score étant hors du périmètre de 1.2.

Point de conception à connaître pour 1.3: les contacts sont des **paires sans vainqueur désigné**. Le legacy appelait `detectCollisions` sur la seule entité qui venait de bouger, ce qui donnait l'avantage à celle dont le message arrivait en dernier. Ici tout le monde avance dans le même battement, donc l'ordre des messages ne décide plus rien: c'est à la règle de 1.3 de dire qui capture qui, selon l'invulnérabilité, le délai entre captures et les règles du jeu.

### Une nuance sur l'indifférence au pas de temps

Le handoff 1.1 annonçait que vingt appels à 50 ms produisent le même déplacement qu'un appel à 1000 ms. **C'est toujours vrai en terrain dégagé, et ça ne l'est plus près d'un mur**: un déplacement refusé n'a pas lieu du tout, donc plus le pas de temps est grand, plus tôt il est refusé. Un joueur qui avance d'un seul pas de 750 pixels vers un mur ne bouge pas, là où cent pas de 7,5 pixels l'amènent au contact. C'est la contrepartie normale d'un monde solide, et c'est le comportement du legacy, qui était tout aussi « tout ou rien » à chaque message. Le commentaire en tête de `moteur.ts` a été corrigé en conséquence.

## Fichiers créés ou modifiés

Créés, dans `packages/sim/src/`

- `collisions.ts`: la carte de collisions. Portage de `CollisionMap` (legacy/server.js:327).
- `collisions.test.ts`: 24 tests. Seuillage, bornes, contour, balayage, trois tailles de carte, instantané.
- `deplacement.ts`: la résolution du déplacement. Portage du gestionnaire `move` (:2604), sans le réseau.
- `deplacement.test.ts`: 11 tests. Glissement, contournement, murs fins, blocage complet.
- `contacts.ts`: le relevé des contacts et le point de branchement de leur résolution. Portage de la partie entité contre entité de `detectCollisions` (:1671).
- `contacts.test.ts`: 9 tests. Seuil et son inégalité stricte, paires uniques, déterminisme.
- `__snapshots__/collisions.test.ts.snap`: l'instantané des positions tenables autour d'un mur.

Modifiés

- `packages/sim/src/etat.ts`: l'état porte le terrain; `creerEtatInitial` le reçoit ou en crée un sans mur, et refuse un terrain aux mauvaises dimensions; `positionDApparition` valide la position et prend en charge le repli en spirale; `positionsOccupees` ajoutée.
- `packages/sim/src/etat.test.ts`: 10 tests ajoutés, dont ceux des défauts X3, X4 et X5.
- `packages/sim/src/moteur.ts`: le déplacement passe par la résolution contre le terrain, le bornage à la carte disparaît, les contacts sont relevés en fin de battement.
- `packages/sim/src/moteur.test.ts`: 4 tests ajoutés et 3 réécrits, ceux du bord ayant changé de sens.
- `packages/sim/src/index.ts`: le point d'entrée expose le terrain, le déplacement et les contacts.
- `packages/shared/src/constantes.ts`: `APPARITION.PAS_SPIRALE` ajouté, valeur du legacy.
- `docs/audit/AUDIT-EXISTANT.md`, `docs/design/README.md`, `docs/plan/etape-1-2.md`: voir plus bas.

Aucune modification de `legacy/`, ni de `tests/caracterisation/`.

## Tests

- Ajoutés: 58 tests unitaires, dont 44 dans trois nouveaux fichiers (24 pour le terrain, 11 pour le déplacement, 9 pour les contacts) et 14 dans les deux fichiers existants (10 pour l'état, 4 pour le moteur).
- Résultat: **245 tests Vitest passent, 0 échec** (187 préexistants, plus 58 nouveaux).
- Couverture de `packages/sim`: **99,54 pour cent** des instructions, 99,30 pour cent des branches, contre 98,89 et 98,41 au handoff 1.1. Elle monte. La cible reste 80 à 90.
- Seules lignes non couvertes: le repli de `couleurUnique` quand trente-deux tirages tombent tous sur une couleur interdite, déjà signalé au handoff 1.1 et hors d'atteinte en pratique.
- Types, linter, formatage: verts. Le linter confirme l'absence d'import et d'appel interdits dans `packages/sim`.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.

**L'instantané des positions tenables autour d'un mur est identique au caractère près à celui du legacy**, dans `tests/caracterisation/__snapshots__/collisions.test.ts.snap`. C'est la meilleure preuve que la géométrie du contact avec un mur a été portée fidèlement: même seuil, mêmes seize points de contour, mêmes limites au pixel près.

## Décisions et écarts au plan

1. **Un bit par pixel, à résolution inchangée.** La fiche laissait ouvert le choix de la représentation, en signalant le coût mémoire des grandes cartes. Le legacy construisait un tableau de tableaux de booléens: six millions d'entrées pour `map3`, plusieurs dizaines de mégaoctets. La même information tient ici dans 750 kilo-octets. Une grille plus grossière aurait été moins chère encore, mais elle aurait déplacé les murs dessinés depuis deux ans: le coût mémoire était un problème de représentation, pas de résolution. Consigné au journal de conception.

2. **La distance de sécurité au spawn est remise en service (défaut X4).** La fiche demandait de trancher consciemment. Elle vit, parce qu'apparaître collé à un adversaire ou à un bot noir est une mauvaise expérience de jeu et que c'était manifestement l'intention du code d'origine. Elle reste un souhait et non une obligation: si la carte est trop encombrée, une place libre l'emporte sur la distance. Il n'y a plus de registre à tenir à jour, les positions occupées se lisent dans l'état, donc le défaut ne peut plus se reproduire.

3. **Le chemin de secours fonctionne (défaut X3).** La spirale depuis le centre de la carte est portée, en deux passages: le premier respecte la distance de sécurité, le second se contente d'un espace libre, et à défaut on renvoie le centre. La variable `startTime` jamais déclarée qui faisait planter le legacy n'a pas d'équivalent: le moteur n'écrit nulle part.

4. **Le trajet est balayé (défaut X15).** Le `canMove` du legacy ne lisait jamais son point de départ: un mur de deux pixels se traversait d'un bond. Le trajet est maintenant balayé pixel par pixel, ce qui est la résolution de la carte elle-même: aucun mur ne peut plus se glisser entre deux contrôles. C'est l'écart assumé avec la caractérisation, que celle-ci désigne elle-même comme une limite de méthode et non comme un réglage de jeu.

5. **Deux défauts découverts en portant, corrigés en même temps (règle 7).** Ils sont décrits dans l'audit, section « Défauts découverts à l'étape 1.2 ».
   - **X18**: les six directions de contournement du legacy étaient calculées à partir de l'axe des abscisses et non de la direction voulue. Un joueur bloqué en allant vers l'ouest repartait vers l'est. Les écarts d'angle sont maintenant relatifs au cap demandé.
   - **X19**: le glissement testait les deux axes depuis la même position de départ puis appliquait les deux résultats. Quand les deux passaient séparément alors que la diagonale ne passait pas, le joueur atterrissait exactement sur la position qui venait d'être refusée, coupant l'angle du mur. Les deux axes s'enchaînent désormais, le second partant de la position atteinte par le premier.

6. **Le point 5 de la fiche est porté en deux morceaux.** `detecterContacts` constate, `resoudreContacts` décidera. Les conséquences d'un contact appartiennent aux étapes 1.3 (capture, couleur d'un bot) et 1.5 (bots). Cette séparation est exactement ce que demande la note sur les modes en fin de périmètre: rendre la règle de résolution remplaçable sans la construire ici.

7. **Le point 3 de la fiche était déjà fait à l'étape 1.1.** `getCurrentMapDimensions` avait déjà disparu au profit de `etat.carte`. Il restait à empêcher terrain et dimensions de diverger, ce que fait la vérification de `creerEtatInitial`.

8. **Le bornage à la carte disparaît du moteur.** Hors de la carte, tout est mur: aucun déplacement ne peut en sortir, le bornage explicite du legacy n'avait donc rien à corriger. Conséquence visible dans les tests: un joueur s'arrête à son rayon du bord, seize pixels, et non le centre collé au bord. C'est déjà ce que le legacy faisait réellement.

9. **Une entité posée de force dans un mur y reste.** Le balayage part de la position courante sans la tester, donc aucun déplacement ne libère une entité déjà dans un mur. Ce n'est atteignable qu'en imposant une position depuis l'extérieur: toutes les positions du jeu viennent soit d'une apparition validée, soit d'un déplacement lui-même validé. Documenté sur `ajouterJoueur` et couvert par un test.

10. **Une lecture indexée sûre, déclarée à un seul endroit.** Le dépôt compile avec `noUncheckedIndexedAccess`, qui suppose toute lecture indexée possiblement vide. Sur les index de la carte, bornés juste avant, un repli « ou zéro » aurait ajouté des cas qu'aucun test ne peut atteindre, donc des lignes mortes déguisées en prudence. L'invariant est déclaré une fois, dans `caseSure`, avec son commentaire.

## Suites données aux découvertes (règle 7 de CLAUDE.md)

- `docs/audit/AUDIT-EXISTANT.md`: nouvelle sous-section « Défauts découverts à l'étape 1.2 », avec X18 et X19.
- `docs/design/README.md`: trois décisions ajoutées au journal, un bit par pixel, distance de sécurité remise en service, balayage du trajet.
- `docs/plan/etape-1-2.md`: section « Réconciliation avec le dépôt », quatre points.
- `packages/sim/src/moteur.ts`: le commentaire d'en-tête annonçait une indifférence totale au pas de temps, ce qui cesse d'être vrai près d'un mur. Corrigé, avec l'explication.
- Aucune correction de `CLAUDE.md` nécessaire cette fois: rien de ce qui y est écrit n'a été démenti par le portage.

## Problèmes connus et dette

- **La comparaison profonde de deux états est lente dans les tests.** Trois tests dépassent 700 millisecondes, parce que `toEqual` compare octet par octet deux terrains de 375 kilo-octets. La suite complète tient en 4 secondes, donc rien d'urgent, mais le coût grandira avec le nombre de tests qui comparent des états entiers. À reprendre si la suite devient pénible: comparer les états sans leur terrain.
- **Aucune optimisation spatiale.** `detecterContacts` compare toutes les paires, ce qui est quadratique. Avec plus de cent bots et cinquante bots noirs, cela fera plusieurs milliers de comparaisons par battement. C'est volontaire: la fiche exclut l'optimisation, et la grille spatiale est l'étape 5.2, conditionnée à la mesure de 5.1.
- **Le balayage du trajet coûte un test de position par pixel parcouru.** À la cadence prévue, un joueur avance de sept à huit pixels par battement, soit une centaine de lectures de carte. C'est négligeable, mais c'est le premier endroit à regarder si l'étape 5.1 trouve le moteur lent avec beaucoup d'entités.
- **`packages/server` et `packages/client` restent vides.** Normal à ce stade. C'est `packages/server` qui décodera les images `collision.png` et appellera `carteDepuisPixels`, à l'étape 2.1.
- **Le facteur mobile et le multiplicateur de bonus ne sont toujours pas appliqués.** Inchangé depuis 1.1: le premier relève de l'autorité serveur (étape 1.6, faille S2), le second des bonus (étape 1.4).
- **`tsc --build` peut laisser une compilation périmée.** Inchangé depuis 1.1. `tsc --build --force` corrige. Sans conséquence sur les tests, qui lisent les sources.
- Le dépôt pèse toujours 157 Mo, `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`. Inchangé depuis les handoffs 0.1, 0.2 et 1.1.

## Prochaine action exacte

Dans une conversation neuve: créer `packages/sim/src/capture.ts` et y porter `handlePlayerCapture` (legacy/server.js:737) en fonction pure, puis remplir `resoudreContacts` dans `packages/sim/src/contacts.ts`, qui est le point de branchement déjà appelé par `tick` et qui ne fait rien pour l'instant.

Trois points à avoir en tête dès le début de l'étape 1.3:

1. **Les contacts arrivent en paires sans vainqueur.** Le legacy laissait l'ordre des messages désigner l'attaquant. Il faut une règle explicite: qui capture qui quand deux joueurs se touchent, et que faire de deux captures dans le même battement. C'est une décision de conception à consigner au journal.
2. **Le score est un stock, pas un cumul.** Il se recalcule à partir des couleurs portées par les bots, plus quinze points par bot noir détruit. Se faire capturer le remet à zéro. C'est le comportement à préserver numéro 1, celui qui fait la tension de fin de partie.
3. **Les bots n'existent pas encore** (étape 1.5). La capture d'un bot se réduit à un changement de couleur: la règle peut être écrite et testée, mais elle n'aura d'entités sur lesquelles s'appliquer qu'en 1.5. Décider en début d'étape si l'on porte le type `Bot` minimal ici, ou si l'on écrit la règle sur le type `Entite` générique et on la branche en 1.5. La seconde option respecte mieux le périmètre.

Lire `tests/caracterisation/capture.test.ts` et `tests/caracterisation/score.test.ts` avant de porter: ils décrivent précisément ce que le portage doit reproduire.

## Étape suivante

Fiche à lire: `docs/plan/etape-1-3.md`

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre d'exécution qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 1.3 suit bien 1.2.
