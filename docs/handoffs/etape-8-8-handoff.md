# Handoff - Étape 8.8 Le nouveau décor de Spirit & Time, son lointain en parallaxe, et les sons des mines

Date: 2 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Spirit & Time prend le décor livré par le porteur du projet, avec une ville au loin qui glisse moins vite que la carte quand la caméra bouge; les six sons provisoires de la fumée et des mines laissent place aux siens.

## Ce qui a été fait

- **Fiche rédigée selon le cas de repli du PROTOCOLE** (`docs/plan/etape-8-8.md`), avec le diagnostic du début d'étape et une section de réconciliation.
- **Les sons**: cinq fichiers dans `assets/sons/`, six noms dans `SONS`. La mine et la mine de zone partagent le même armement. Plus aucun son provisoire.
- **La carte**: un toit-terrasse ceint de murs, dôme doré et sabliers. Livrée à 3000 sur 2200, **réduite de 20 pour cent à la demande du porteur du projet** après les premières captures, les ninjas y paraissant trop petits: **2400 sur 1760**. Le fond et le lointain, livrés en 450 couleurs, sont ramenés à leur palette après réduction (même poids que les originaux, 4,4 Mo en tout).
- **Piège trouvé**: la collision était livrée en noir sur transparent. Le jeu ignore l'opacité: toute la carte aurait été un mur. Elle est posée sur du blanc, et un test exige désormais des collisions opaques pour toutes les cartes.
- **Plafond de faux ninjas: 360**, au lieu de 500, sur décision du porteur du projet: la densité de Tokyo et du Quartier. La borne des réglages tombe de 500 à 360.
- **Le lointain**: une couche sous le fond, chemin `cheminLointain`, décalage calculé par `decalageDuLointain` (fonction pure, `rendu/parallaxe.ts`), borné à 120 pixels. Son centre est un trou noir caché par la terrasse, qui paraîtrait à 139 pixels d'écart: un test le vérifie sur les images livrées.
- **Badge « Prototype » gardé**, sur décision du porteur du projet.
- **Défaut corrigé en route (règle 7)**: la première mise en ligne (CI 37062136259) a échoué. Sur Render, le nouveau serveur est resté quinze minutes dans `migrer.js`, sans rien dire, jusqu'à l'abandon; la production est restée sur `3b670ac`, intacte. La connexion à la base n'avait aucun délai. Désormais elle abandonne au bout de vingt secondes (`DELAI_DE_CONNEXION_MS`), et les migrations du démarrage se reprennent trois fois (`appliquerMigrationsAvecReprises`). Journaux lus par l'API de Render.
- **Vu dans un vrai navigateur**: une partie jouée sur la carte, quatre endroits (`docs/design/etape-8-8/planche-partie.png`), et les murs superposés au décor (`docs/design/etape-8-8/murs-sur-le-decor.png`).

## Fichiers créés ou modifiés

- `assets/cartes/map3/`: les quatre images et la vignette remplacées, `background-parallax.png` ajouté.
- `assets/sons/`: `bonus-escape-nuage.mp3`, `mine-pose.mp3`, `activation-mine.mp3`, `explosion-mine.mp3`, `explosion-mine-zone.mp3` ajoutés.
- `packages/shared/src/constantes.ts`: map3 à 2400 sur 1760, plafond 360. `bornes.ts`: borne des faux ninjas à 360. `ressources.ts`: `SONS`, `cheminLointain`. `index.ts`: export.
- `packages/client/src/rendu/parallaxe.ts` (créé): `decalageDuLointain`, `positionDuLointain`. `apparence.ts`: `LOINTAIN`. `pixi.ts`: le sprite du lointain, préchargé, orienté, placé à chaque image. `stabilite.ts`: commentaire. `interface/modeles/cartes.ts`: commentaire de Spirit & Time.
- `packages/server/src/terrain.ts`: commentaires (images de Tokyo, opacité).
- `packages/server/src/base/connexion.ts`: délai de connexion. `migrations.ts`: `appliquerMigrationsAvecReprises`. `migrer.ts`: s'en sert. Tests: `connexion.test.ts` (base muette), `migrations.test.ts` (créé, reprises). `docs/deploiement.md`: l'incident et la conduite à tenir.
- Tests: `parallaxe.test.ts` (créé), `ressources.test.ts`, `constantes.test.ts`, `validation.test.ts`, `terrain.test.ts` (empreintes, retournement pixel à pixel, collisions opaques, présence de sol), `GameRoom.test.ts`, `ServeurSocket.test.ts`, `ServeurSocket.options.test.ts`, `etat.test.ts`, `collisions.test.ts`, `bots.test.ts`, `reglages.test.ts` (modèle et composant). Bout en bout: `tests/e2e/rendu-parallaxe.spec.ts` (créé), `banc-rendu.spec.ts` (dimensions, plafond au cadrage du téléphone).
- Mesures: `docs/mesures/cartes.json`, `docs/mesures/charge-serveur.md` (section 24), `docs/mesures/charge-serveur-8-8-spirit.json` (créé), `docs/mesures/mesurer-les-cartes.mjs` (commentaire), note dans `etude-structures-de-carte.md`, `tests/charge/charge.ts` (commentaires).
- Documentation: fiche 8.8 (créée), ROADMAP, journal de conception, `assets/README.md`, compétence `conception-de-cartes` (SKILL.md et fiche de commande), ce handoff.

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de la logique de `packages/sim` (seuls trois de ses tests suivent les nouvelles dimensions).

## Tests

- Ajoutés: chemin du lointain et sa taille; sons de la fumée et des mines; décalage du lointain (centre, bouts de course, proportion, téléphone, vue presque aussi grande que la carte, vue plus grande, sous le HUD, toutes positions); trou caché sur les images livrées jusqu'à 138 pixels et visible à 139; collisions opaques et présence de sol sur chaque carte; miroir de map3 retourné pixel à pixel. Bout en bout: aucun pixel noir aux quatre coins, à l'endroit et en miroir, bureau et mobile; le lointain recule de 70 pixels quand le terrain en recule 100. Vérifié qu'il échoue avec une amplitude de 180 (jusqu'à 14 440 pixels noirs).
- Résultat: 3 493 tests unitaires et d'intégration au vert en local, types et linter compris; les tests de la base sautés en local, joués par la CI. Bout en bout en local: les scénarios de rendu, navigation, crédits, parties, mines, fumée et parcours solo au vert.
- Banc de charge: 1,61 ms par battement à 360 faux ninjas sur la carte nouvelle, 1,12 pour Tokyo à 300 au même commit (section 24).
- Banc de rendu sur carte graphique: 60 images par seconde à 500 sprites, notre code à 0,79 ms par image; au cadrage du téléphone, Spirit & Time à 360 entités, 2,31 ms. La série « tout à l'écran » à 500 entités au processeur ralenti a dépassé son plafond local de 4,17 ms dans les deux campagnes complètes (4,20 puis 4,40), après quatre-vingts scénarios; jouée seule, trois fois: 3,57 à 3,76 ms. Elle joue sur Tokyo, où le lointain n'existe pas et où le seul code ajouté est un test sauté: c'est la charge de la machine en fin de campagne. Le plafond ne s'exige pas en CI (décision du 19 septembre 2026).
- Couverture de packages/sim: inchangée, sa logique n'est pas touchée.
- **Empreintes des parties de référence**: inchangées par construction, elles se jouent sur Tokyo.
- État de la CI: verte sur `32b33b7` (exécution 37066990341), types, linter et tests, bout en bout, mise en ligne: le serveur de production répond sur ce commit (`/sante`). L'exécution précédente, sur `8f2a8df` (37062136259), était verte jusqu'à la mise en ligne, qui a échoué (« Ce qui a été fait », défaut corrigé en route).

## Décisions et écarts au plan

1. **Carte réduite de 20 pour cent** en cours d'étape, sur demande du porteur du projet (fiche, réconciliation, point 1).
2. **Plafond à 360**, choisi par le porteur du projet parmi 360, 400 et 500.
3. **Badge « Prototype » gardé**, choisi par le porteur du projet.
4. **Amplitude de 120 pixels**, une mesure: le trou paraît à 139.
5. **Le trou se juge là où le terrain laisse voir plus de 2 pour cent du lointain** (fiche, réconciliation, point 5).
6. **Le banc de rendu au cadrage du téléphone mesure Spirit & Time à 360**, son plafond; la série « tout à l'écran » garde 500 comme marge.

## Problèmes connus et dette

- **À juger en jouant**: les proportions de la carte réduite, l'effet du lointain (plus discret sur téléphone, où la caméra a plus de course), et les sons dans le jeu, notamment l'armement de 4 secondes, plus long que le délai de 1,5 seconde d'une mine posée: il continue après l'explosion.
- Rien d'autre.

## Prochaine action exacte

Exécuter l'étape `4.9`, le numéro de version et la note de version, décidée avec le porteur du projet à la fin de cette étape. Ses décisions et le texte de la note 1.5 sont dans la fiche. Au porteur du projet, en parallèle: jouer une partie sur Spirit & Time, juger les proportions, le lointain et les sons.

## Étape suivante

Fiche à lire: `docs/plan/etape-4-9.md`.
