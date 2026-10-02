# Fiche étape 5.8 - Plus de faux ninja sombre, et un Black Ninja qui se distingue

Brief de session. Objectif unique: seuls les Black Ninjas sont noirs. Aucun faux ninja ne naît, ni ne devient, d'une couleur trop proche du noir; et le Black Ninja se reconnaît à autre chose que son corps noir et sa zone rouge.

## Origine de cette fiche

Aucune fiche n'existait. Demande du porteur du projet, le 2 octobre 2026, à la fin de l'étape 7.12: « Pas de bot noir ou sombre en dehors du Black Ninja. Des faux ninjas peuvent avoir une couleur noire ou marron foncé, ce qui prête à confusion avec les Black Ninjas. Seuls les Black Ninjas peuvent être noirs; les faux ninjas ne peuvent pas être noirs, marrons, bleus foncés, ni d'aucune couleur trop proche du noir. À étudier: comment démarquer davantage les Black Ninjas au-delà de leur couleur noire et de leur zone rouge. »

Rédigée le 2 octobre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de cette demande, de l'état du dépôt au commit `36ce8a2` et du handoff 7.12. **Numéro**: 5.8, dans la phase 5, au rang du peaufinage (5.5): un défaut de lisibilité, pas une règle de jeu nouvelle.

## Ce qu'est le jeu aujourd'hui

- **Un faux ninja naît d'une couleur tirée au hasard** parmi les seize millions (`couleurDeBot`, `packages/sim/src/couleurs.ts`, portage de getRandomColor), hors de la palette des joueurs, du blanc, du noir et du rose des traqueurs. Un tiers des tirages environ est sombre: noirs, marrons, bleus et rouges foncés.
- **Deux autres chemins donnent une couleur quelconque**, une fois la palette des six couleurs épuisée (`couleurUnique`): un joueur au-delà du sixième, dont les faux ninjas capturés prennent la couleur, et la zone de chaos, qui repeint un faux ninja.
- **Le bleu de la palette des joueurs, `#0000FF`**, est le plus sombre des six (luminance 0,07, plus sombre que bien des marrons): le joueur bleu et ses faux ninjas se confondent aussi avec un Black Ninja.
- **Le Black Ninja** se dessine en corps noir, cerné d'un anneau rouge qui pulse et posé sur un disque de détection rouge très pâle.

## Décisions du porteur du projet, 2 octobre 2026

Sur la planche `docs/design/etape-5-8/1-couleurs-et-black-ninja.png`:

1. **Un seuil de luminance relative de 0,18** pour toute couleur tirée au hasard, soit un contraste d'au moins 4,6 avec le noir. Le noir, les marrons, les bleus et rouges foncés, les gris sombres sont exclus. Il vaut pour les trois chemins: la naissance d'un faux ninja, la couleur d'un joueur hors palette, la zone de chaos.
2. **Le bleu de la palette devient `#3D7DFF`**, un bleu néon éclairci (luminance 0,23), celui des zones de répulsion. Le joueur bleu reste bleu.
3. **Le Black Ninja reçoit deux marques**: des **yeux rouges** qui brillent (les reflets clairs du masque deviennent rouges, sur une lueur rouge), et une **aura de fumée**, des volutes sombres violacées qui tournent autour de lui. Ses marques d'aujourd'hui restent. Écartés: le liseré rouge et la carrure plus grande.

## Décisions prises par cette fiche

1. **La luminance relative** est celle des normes d'accessibilité (WCAG): moyenne pondérée des trois composantes linéarisées. Calculée dans `packages/shared`, pure, à côté de la palette.
2. **Le tirage refait les couleurs trop sombres**, comme il refait déjà les couleurs interdites, dans la même boucle bornée. Un tirage sur trois environ est refait: la boucle de 32 tentatives n'échoue en pratique jamais (une chance sur 10^15).
3. **La palette ne change que d'une couleur.** Les autres sont toutes au-dessus du seuil. Un test vérifie que chaque couleur de la palette, des équipes et des traqueurs, le blanc des neutres, y est.
4. **Le changement est voulu**: toutes les parties de référence et les empreintes changent, la naissance des faux ninjas tirant autrement. Les tests de caractérisation, qui observent le jeu d'origine, ne changent pas. Consigné au journal, à l'audit (défaut nouveau) et au handoff.
5. **Les yeux rouges** sont une image dérivée du sprite, fabriquée au chargement comme les rayures de l'Évadé (étape 7.9); la lueur est un disque rouge pâle posé sous la tête, sans filtre: le rendu reste sans filtre par personnage.
6. **L'aura** se dessine en disques, sous les personnages, comme les halos.

## Périmètre

### Lot A. Le moteur et le contrat

1. `luminance` et `LUMINANCE_MINIMUM_PNJ` dans `packages/shared`; le bleu de `COULEURS_JOUEURS`.
2. `couleurDeBot` et le repli de `couleurUnique` refont les tirages sous le seuil.

### Lot B. La page

1. Les yeux rouges et leur lueur, l'aura de fumée.
2. Vérification dans le navigateur, capture d'écran.

### Lot C. Mesure et documentation

1. Nouvelles empreintes des parties de référence, consignées au handoff.
2. Journal de conception, audit, ROADMAP.

## Hors périmètre

- Les couleurs des zones, des mines et de l'Évadé.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: la luminance de couleurs connues; chaque couleur réservée au-dessus du seuil.
- **Moteur (TU)**: des milliers de faux ninjas nés, tous au-dessus du seuil; la couleur d'un joueur hors palette et celle d'une zone de chaos aussi; le déterminisme.
- **Client (TU)**: l'image aux yeux rouges ne change que les reflets clairs; l'aura et la lueur autour d'un Black Ninja, et d'aucun autre ninja.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Aucun faux ninja d'une couleur sous le seuil, par aucun des trois chemins.
2. Le rendu correspond aux choix de la planche, vérifié dans le navigateur, avec une capture d'écran.
3. La couverture de `packages/sim` ne baisse pas.

## Réconciliation pendant l'étape (2 octobre 2026)

1. **Faite dans la conversation de l'étape 7.12**, à la demande du porteur du projet: écart de méthode à la règle 6, comme pour les étapes 7.10 et 7.11.
2. **L'aura et la lueur renforcées par rapport à la planche**, après une vraie partie où elles se perdaient sur le décor: volutes plus loin (17 à 23 pixels du centre, au-delà de la silhouette) et plus denses, lueur de 15 pixels qui dépasse de la tête. Vu de dos, les yeux sont cachés: c'est la lueur qui signale le regard. Captures: `2-realise-black-ninja.png` (banc de rendu, grossi quatre fois et à l'échelle de la carte) et `3-realise-faux-ninjas-clairs.png` (vraie partie, 150 faux ninjas).
3. **Le tirage brut, `couleurAleatoire`, reste sans condition**: il ne sert qu'aux deux tirages filtrés et aux tests. Le seuil vit dans `couleurAleatoireHorsDe`, par lequel passent la naissance d'un faux ninja et le repli de `couleurUnique` (joueur hors palette, zone de chaos).
4. **Les parties de référence avec la fumée, la mine et l'ouverture d'une zone** changent de graine (47 et 46): leurs objets n'y étaient plus ramassés ni leurs zones ouvertes. Elles restent des preuves de ce qu'elles couvrent.

## Rituel de fin de session

Écrire `docs/handoffs/etape-5-8-handoff.md`. Commiter, pousser, vérifier la CI et la mise en ligne.
