# Fiche étape 4.8 - Des ninjas nets de près

Brief de session. Objectif unique: un ninja coloré reste net et propre en vue rapprochée. Ses bords et ses aplats prennent la couleur de son propriétaire sans escalier ni liseré rouge, fidèles au sprite dessiné.

## Origine de cette fiche

Aucune fiche n'existait. Demande du porteur du projet, le 2 octobre 2026, à la fin de l'étape 5.8: « en vue rapprochée, les ninjas colorés ont un rendu crénelé, la coloration du sprite n'est pas propre ». Entrée 4.8 de la phase 4 du ROADMAP, décision du même jour en section 3.

Rédigée le 2 octobre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de cette entrée, de l'état du dépôt au commit `e81a604` et du handoff 5.8. **Numéro**: 4.8, dans la phase du client et du rendu: un défaut d'affichage, aucune règle de jeu ne change.

## Ce qu'est le rendu aujourd'hui

- **Les dix-sept sprites de ninja font 32 pixels de côté** (`assets/ninja/`) et s'affichent à 32 pixels de carte. Leur corps est dessiné en rouge pur, cerné d'un contour presque noir, `(31, 29, 25)`.
- **Au chargement, chaque image est coupée en deux calques** (`separerLesCalques`, `packages/client/src/rendu/recoloration.ts`): le corps, passé en blanc, que le GPU teint de la couleur du propriétaire, et les détails, intacts, dessinés dessous. Un pixel va tout entier dans l'un ou dans l'autre, selon qu'il est à moins de 140 du rouge pur sur chaque composante. C'est la règle du jeu d'origine (`TARGET_COLOR` et `COLOR_TOLERANCE`, `legacy/client.js:493`).
- **Les textures sont lissées à l'agrandissement** (filtrage linéaire, celui de PixiJS par défaut), et le rendu suit la densité de l'écran jusqu'à 2 (`DENSITE_MAXIMALE`).

## Diagnostic, fait au début de l'étape

Mesuré sur les dix-sept images et vu dans un vrai navigateur, ninjas grossis six fois.

1. **Le corps rouge est adouci vers le contour, et le partage tout ou rien coupe cet adoucissement.** 985 des 3 505 pixels du corps (28 pour cent) et 714 pixels laissés aux détails sont des mélanges exacts du rouge pur et du contour: `(121, 17, 15)` est un mélange à 40 pour cent, `(56, 26, 22)` à 11 pour cent. Au-dessus de 37,5 pour cent de rouge, le pixel prend la couleur pleine; en dessous, il reste rouge sombre. Le dégradé du bord devient une marche: un escalier net autour d'un corps vert, un liseré rouge brun tout autour, et les ombres du corps aplaties. **C'est le crénelage relevé.** Le jeu d'origine avait exactement le même défaut: sa recoloration, rejouée au canevas 2D, donne la même image.
2. **Le filtrage des textures n'est pas en cause.** Le contour, lissé, est flou mais propre; seul le bord de la couleur est en escalier. Un filtrage au plus proche voisin rendrait tout le sprite en escalier.
3. **La densité de pixels n'est pas en cause.** À densité 2 comme à densité 1, le défaut est le même, proportionnel au grossissement.
4. **Effet de bord du partage tout ou rien**: une poignée de pixels d'ombre de la peau, bruns, `(143, 113, 87)` par exemple, sont à moins de 140 du rouge et prenaient la couleur du joueur.

## Décisions prises par cette fiche

1. **Un partage proportionnel.** Chaque pixel se lit comme un mélange `t × rouge + (1 - t) × fond`, où le fond est un détail neutre (contour, gris, blanc des yeux). Pour un fond neutre, la part de rouge est exactement `t = (rouge - max(vert, bleu)) / 255`, et le fond s'en déduit. Le corps reçoit du blanc à l'opacité `t`, les détails reçoivent le fond, à l'opacité qui fait que les deux calques superposés redonnent l'opacité du pixel. Une fois teint, le pixel vaut `t × couleur + (1 - t) × fond`: le dégradé du dessin est gardé, dans la couleur du joueur.
2. **Seuls les mélanges de rouge et de neutre comptent.** Un pixel dont le vert et le bleu s'écartent de plus de 18 n'est pas un mélange avec un neutre: la peau `(249, 202, 157)` et ses ombres brunes restent des détails intacts. Un pixel dont le rouge dépasse le vert et le bleu de moins de 8 est un neutre: le contour `(31, 29, 25)` n'est pas teint. Seuils calés sur les dix-sept images.
3. **Fidélité vérifiable**: repeint dans son propre rouge, chaque sprite redonne son image d'origine à l'octet près, comme aujourd'hui; repeint dans une autre couleur, chaque pixel du corps garde sa part de couleur, là où le partage tout ou rien la mettait à zéro ou à un.
4. **Écart voulu avec le jeu d'origine, au rendu seul.** Le test décisif ne compare plus au calcul du jeu d'origine, qui a le défaut, mais à la recoloration proportionnelle. Le moteur, le serveur et le flux d'état ne changent pas: les empreintes des parties de référence restent identiques.
5. **Ni le filtrage, ni la densité, ni la taille des sprites ne changent.** Le coût du rendu non plus: mêmes textures, mêmes sprites, seul leur contenu change, calculé une fois au chargement.
6. **Les dérivés suivent d'eux-mêmes.** Les rayures de l'Évadé et les yeux rouges du Black Ninja se calculent sur les calques: les rayures gardent l'opacité du corps, adoucie au bord; les reflets clairs mêlés de rouge deviennent des reflets blancs dans les détails, et le Black Ninja les rougit.

## Périmètre

### Lot A. Le partage des calques

1. `separerLesCalques` proportionnel; les seuils dans `apparence.ts` à la place de la tolérance du jeu d'origine.
2. Tests unitaires des pixels de bord, des neutres, de la peau, de l'opacité, et des dix-sept images.

### Lot B. La preuve à l'écran

1. Un scénario de rendu: un ninja repeint, grossi, comparé au pixel près au sprite d'origine repeint proportionnellement.
2. Captures de près, avant et après, sur ordinateur et sur téléphone; banc de rendu sans régression.

### Lot C. Documentation

1. Journal de conception, audit (défaut nouveau), ROADMAP, handoff.

## Hors périmètre

- Les sprites eux-mêmes, et de nouveaux sprites en plus haute définition.
- Le filtrage des textures et la densité du rendu.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Client (TU)**: un mélange de rouge et de contour partagé à sa juste part; le rouge pur entièrement au corps; un neutre et la peau entièrement aux détails; l'opacité d'un pixel à demi transparent conservée; sur les dix-sept images, repeintes dans chaque couleur du jeu, le résultat attendu, et repeintes en rouge, l'image d'origine à l'octet près.
- **Rendu (bout en bout)**: un ninja repeint, grossi, sans pixel rouge résiduel ni marche au bord, comparé au résultat attendu.
- **Banc de rendu**: sans régression.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Plus aucun liseré rouge ni escalier au bord d'un ninja coloré, vérifié dans le navigateur, captures avant et après.
2. Empreintes des parties de référence inchangées.
3. La couverture de `packages/sim` ne baisse pas (il n'est pas touché).

## Rituel de fin de session

Écrire `docs/handoffs/etape-4-8-handoff.md`. Commiter, pousser, vérifier la CI et la mise en ligne.
