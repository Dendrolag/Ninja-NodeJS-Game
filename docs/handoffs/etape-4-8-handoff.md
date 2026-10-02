# Handoff - Étape 4.8 Des ninjas nets de près

Date: 2 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Un ninja coloré reste net et propre en vue rapprochée: ses bords et ses aplats prennent la couleur de son propriétaire sans escalier ni liseré rouge, fidèles au sprite dessiné.

## Ce qui a été fait

- **Fiche rédigée selon le cas de repli du PROTOCOLE** et commitée avant l'exécution (`57d909f`), avec le diagnostic fait au début de l'étape.
- **Diagnostic**: le corps rouge des sprites est adouci vers son contour presque noir, en mélanges exacts du rouge et du contour (28 pour cent des pixels du corps). Le partage tout ou rien entre le calque à teindre et les détails, repris du jeu d'origine, coupait cet adoucissement en un escalier bordé de rouge. Ni le lissage des textures ni la densité du rendu n'étaient en cause, vu dans un vrai navigateur.
- **Correction**: chaque pixel donne au corps sa part de rouge, en opacité, et son fond neutre aux détails, à l'opacité qui fait que les deux calques superposés redonnent celle du pixel. La peau et ses ombres brunes, qui ne sont pas des mélanges de rouge et de neutre, restent intactes.
- **Vérifié dans un vrai navigateur**: planche avant et après à l'échelle de l'ordinateur, au cadrage du téléphone à densité 2, et grossie six fois, avec un Black Ninja et l'Évadé (`docs/design/etape-4-8/1-avant-apres.png`). Le Black Ninja perd son liseré rouge autour du corps, l'Évadé garde des rayures au bord adouci.
- **Défaut X39** ajouté à l'audit.

## Fichiers créés ou modifiés

- `packages/client/src/rendu/recoloration.ts`: `separerLesCalques` proportionnel, `partDeRouge` (exportée, le scénario de rendu s'en sert).
- `packages/client/src/rendu/apparence.ts`: `REPEINTE_DU_NINJA` porte les deux seuils, `ecartNeutre` (18) et `excesMinimum` (8), à la place de la tolérance du jeu d'origine.
- `packages/client/src/rendu/recoloration.test.ts`: tests de la part de rouge, du partage des pixels de bord, et des dix-sept images.
- `tests/e2e/rendu-couleurs.spec.ts`: scénario du bord des ninjas.
- Documentation: fiche 4.8 (créée), ROADMAP, journal de conception, `docs/audit/AUDIT-EXISTANT.md` (X39), planche `docs/design/etape-4-8/1-avant-apres.png` (créée), ce handoff.

Aucune modification de `legacy/`, de `tests/caracterisation/`, de `packages/sim`, de `packages/shared` ni de `packages/server`.

## Tests

- Ajoutés: la part de rouge du rouge pur, du contour, du blanc, d'un gris, de mélanges connus, de la peau et de ses ombres; le partage d'un pixel de bord, d'un pixel à demi transparent, d'un pixel transparent; sur les dix-sept images, repeintes dans leur rouge, l'image d'origine, et dans chaque couleur du jeu, la part de couleur de chaque pixel, aucun liseré rouge en vert (là où le jeu d'origine en laissait), un bord en parts intermédiaires. Bout en bout: un ninja vert comparé au pixel près à l'attendu (écart 1,3 au plus), et grossi six fois, aucun pixel rouge. Ce scénario échoue sur l'ancien partage (écart 133, 125 pixels rouges).
- Résultat: 3 468 tests unitaires et d'intégration au vert en local (types, linter); les tests de la base sautés en local, joués par la CI. Bout en bout en local: `rendu-couleurs`, `parcours-solo`, `evade`, `massacre`, `multijoueur`, 13 sur 13, bureau et mobile. Banc de rendu au vert sur carte graphique: 60 images par seconde à 500 sprites, notre code à 0,73 ms par image, 4,04 au processeur ralenti six fois.
- Le formatage local signale 258 fichiers: ce sont les fins de ligne CRLF de l'extraction Windows (`core.autocrlf` à `true`), le dépôt est en LF. Les fichiers de l'étape passent.
- Couverture de packages/sim: inchangée, le paquet n'est pas touché.
- **Empreintes**: inchangées par construction, ni le moteur, ni le serveur, ni le contrat ne changent.
- État de la CI: verte sur `3b670ac` (exécution 37048241045), types, linter et tests, bout en bout, mise en ligne: le serveur de production répond sur ce commit (`/sante`).

## Décisions et écarts au plan

1. **Partage proportionnel, et non changement du filtrage ou de la densité**: les deux autres pistes de la ROADMAP ont été écartées sur mesure (fiche, diagnostic).
2. **Écart vert-bleu de 18** (fiche, réconciliation, point 2).
3. **Écart voulu avec le jeu d'origine, au rendu seul**: le test décisif ne compare plus à sa recoloration, qui a le défaut.

## Problèmes connus et dette

- **Les six sons provisoires** du handoff 7.12 attendent toujours les fichiers du porteur du projet.
- **À juger en jouant**: les ninjas de près sur téléphone, et les marques du Black Ninja (handoff 5.8).
- Rien d'autre.

## Prochaine action exacte

**Au porteur du projet**: regarder la planche `docs/design/etape-4-8/1-avant-apres.png`, jouer une partie sur téléphone pour juger les ninjas de près, et dire la suite. Aucune étape planifiée ne reste ouverte à la section 3 du ROADMAP.

## Étape suivante

Fiche à lire: aucune. La prochaine étape est à décider avec le porteur du projet.
