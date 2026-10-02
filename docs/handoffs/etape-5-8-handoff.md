# Handoff - Étape 5.8 Plus de faux ninja sombre, et un Black Ninja qui se distingue

Date: 2 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Seuls les Black Ninjas sont noirs: aucun faux ninja ne naît, ni ne devient, d'une couleur trop proche du noir, et le Black Ninja se reconnaît à autre chose que son corps noir et sa zone rouge.

## Ce qui a été fait

- **Faite dans la conversation de l'étape 7.12**, à la demande du porteur du projet (écart de méthode à la règle 6). Fiche rédigée selon le cas de repli du PROTOCOLE: `docs/plan/etape-5-8.md`.
- **La planche** `docs/design/etape-5-8/1-couleurs-et-black-ninja.png`, et trois choix du porteur du projet: un seuil de luminance relative de 0,18; le bleu de la palette éclairci en `#3D7DFF`; pour le Black Ninja, des yeux rouges et une aura de fumée.
- **Le moteur**: toute couleur tirée au hasard passe le seuil, sur les trois chemins (faux ninja qui naît, joueur au-delà du sixième, zone de chaos). Le tirage refait les couleurs trop sombres dans sa boucle bornée.
- **La page**: une image aux yeux rougis par direction, fabriquée au chargement; une lueur rouge sous la tête et des volutes violacées autour du Black Ninja, en disques, sans filtre.
- **Vérifié dans un vrai navigateur**: une vraie partie à 150 faux ninjas, tous vifs (planche 3), et les Black Ninjas au banc de rendu, de face, de profil et de dos (planche 2). L'aura et la lueur ont été renforcées après ce premier essai, où elles se perdaient sur le décor.
- **Défaut X38** ajouté à l'audit.

## Fichiers créés ou modifiés

- `packages/shared/src/constantes.ts`: le bleu de `COULEURS_JOUEURS`, `LUMINANCE_MINIMUM_PNJ`, `luminance`; `index.ts`: les exports; `constantes.test.ts`: la luminance, le seuil, la palette.
- `packages/sim/src/couleurs.ts`: le seuil dans `couleurAleatoireHorsDe`; `couleurs.test.ts`: les trois chemins, le tirage refait, les couleurs réservées; `partie.test.ts` et son instantané: les références changent, graines 47 et 46 pour la poche et les zones.
- `packages/client/src/rendu/`: `blackNinja.ts` et `blackNinja.test.ts` (créés), `recoloration.ts` (`rougirLesYeux`) et son test, `textures.ts` (`adresseAuxYeuxRouges`), `apparence.ts` (`YEUX_DU_BLACK_NINJA`, `AURA_DU_BLACK_NINJA`), `pixi.ts` (les textures aux yeux rouges), `scene.ts` (les marques, la texture), `scene.test.ts`.
- `CLAUDE.md`: précision datée au comportement à préserver 11.
- Documentation: fiche 5.8 (créée), ROADMAP, journal de conception, `docs/audit/AUDIT-EXISTANT.md` (X38), planches `docs/design/etape-5-8/1` à `3` (créées), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: la luminance de couleurs connues et le seuil; mille faux ninjas nés, mille couleurs hors palette, toutes au-dessus du seuil et variées; un tirage sombre refait; les couleurs que le jeu donne de lui-même au-dessus du seuil, le noir du Black Ninja à zéro; les yeux rougis (reflet, cerne, peau, vide, calque intact, vraie image); les marques du Black Ninja et d'aucun autre ninja.
- Résultat: 3 285 tests unitaires et d'intégration au vert en local (types, linter, tests, formatage); les tests de la base sautés en local, joués par la CI. Bout en bout en local: `rendu-couleurs`, `parcours-solo`, `multijoueur`, `equipes`, 8 sur 8.
- Couverture de packages/sim: 99,84 pour cent des instructions et 99,09 des branches, contre 99,84 et 99,08 au handoff 7.12 (`couleurs.ts` 100 et 100).
- **Empreintes**: toutes changent, comme voulu, les faux ninjas naissant d'autres couleurs dès le lancement; aucune option ne peut rejouer l'ancien tirage. Nouvelles empreintes, réglages par défaut:
  - 150 bots, 12 joueurs, murs: jeu `9c422c82ab52744b4b272bbfed36d3a3a3ae62506197a064476113771f30acb9`, flux `69f815789b2517d61f5d484a52775f716135bbd02c49d05d5138bc57bd73e329`
  - 50 bots, 12 joueurs, murs: jeu `5b0ec6122ba23b71cb3ad524f15191dbf52818b5af76c01d24728018fa3e8beb`, flux `71ef3e4df00b32aa9fa588ff7956840de344a5662799c8fe3b38d91ac436e815`
  - 300 bots, 12 joueurs, sans mur: jeu `61c135dacfec026a153abbe287e75b49b6e8c9cb80f3f931fe30340db922ffeb`, flux `2298f9c0d5522f5fb667215713e539f8e245eddd26a9e815149e9ba7f69c9519`
  - 150 bots, 2 joueurs, murs: jeu `b301410e5fd6308a6cb8cfc32f0d59148b39321afc4582e9fb936fcaf9a21016`, flux `4ec3aadda8db5b7ac7f188891b418df2670d929d80943bd50e6d21bb4a858935`
- État de la CI: à relever après la poussée sur `master`.

## Décisions et écarts au plan

1. **Seuil 0,18, bleu `#3D7DFF`, yeux rouges et aura de fumée**, choisis sur la planche par le porteur du projet.
2. **Aura et lueur renforcées** par rapport à la planche (fiche, réconciliation, point 2).
3. **Numérotée 5.8**, au rang du peaufinage de la phase 5: un défaut de lisibilité, pas une règle nouvelle.

## Problèmes connus et dette

- **Les six sons provisoires** du handoff 7.12 attendent toujours les fichiers du porteur du projet.
- **À juger en jouant**: la lisibilité de l'aura sur les trois cartes, en particulier sur les sols violets du Quartier et de Tokyo.
- Rien d'autre.

## Prochaine action exacte

**À la session suivante**: l'étape `4.8`, des ninjas nets de près, planifiée à la section 3 du ROADMAP le 2 octobre 2026. Rédiger sa fiche selon le cas de repli du PROTOCOLE, puis trouver d'où vient le crénelage des ninjas colorés avant de le corriger. **Au porteur du projet**: jouer une partie avec des Black Ninjas pour juger leurs marques.

## Étape suivante

Fiche à lire: `docs/plan/etape-4-8.md`, à rédiger au début de l'étape. L'entrée correspondante est à la section 3 de `docs/plan/ROADMAP.md`.
