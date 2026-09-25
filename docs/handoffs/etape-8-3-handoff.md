# Handoff - Étape 8.3 Le miroir calculé

Date: 25 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Une carte ne se livre plus qu'une fois: le mode miroir cesse d'être un second jeu d'images, le serveur retourne la collision, la page retourne le décor. Rien ne change de ce qui se voit ni de ce qui se joue.

## Ce qui a été fait

- **La fiche**, rédigée selon le cas de repli du PROTOCOLE et commitée avant l'exécution (`a2bd4b5`).
- **La mesure avant tout changement.** Chaque image de miroir comparée, pixel par pixel, au retournement de l'image normale, couleurs rapportées à leur opacité. Trois constats, dont deux contredisent l'étude 8.1:
  - les miroirs de Tokyo (collision, fond, avant-plan) et du Quartier sont **le retournement exact** des normales, au pixel visible près;
  - **l'avant-plan de Tokyo n'est pas retouché**: les 9 pour cent qui différaient sont tous des pixels entièrement transparents, seule leur couleur invisible change;
  - **le miroir de Spirit & Time n'est pas retourné du tout**: c'est la carte normale, octet pour octet, déjà dans le jeu d'origine (défaut X37 de l'audit).
  - La pluie de Tokyo en miroir était une pluie tirée à nouveau, dont les zones sèches suivaient le fond retourné (94 pour cent des blocs de 40 pixels concordent).
- **Le rappel du porteur du projet, en cours d'étape**: la pluie est liée au décor, elle ne tombe pas dans les intérieurs vus en coupe. Elle se retourne donc exactement comme le fond, image par image de sa planche.
- **Les empreintes des murs relevées avant la suppression des images**, pour les trois cartes dans les deux sens, puis figées dans un test.
- **Serveur**: `retournerHorizontalement`, appliquée à l'image source **avant** l'étirement. Retourner après l'étirement aurait déplacé des murs, l'étirement de Tokyo (3000 vers 2000) n'étant pas symétrique. Résultat: murs de Tokyo et du Quartier en miroir **identiques à l'octet près** à ceux des images livrées.
- **Page**: `orienterLeDecor` donne au fond, à la pluie et à l'avant-plan une échelle horizontale négative, posée au bord droit de la carte. Rien d'autre ne se retourne: les positions du serveur sont déjà celles du terrain retourné. PixiJS garde le signe de l'échelle quand la texture change, donc la pluie reste retournée d'une image à l'autre. Les adresses ne dépendent plus du miroir: une carte jouée dans les deux sens ne se télécharge qu'une fois.
- **Images**: les images normales remontent à la racine de leur carte (`assets/cartes/<carte>/`), les dossiers `mirror/` sont supprimés (dix images, 3,4 Mo), les dossiers `normal/` disparaissent.
- **Outils**: `dessiner-le-quartier.mjs` n'écrit plus qu'une orientation, et réécrit les mêmes images octet pour octet; `mesurer-les-cartes.mjs` retourne comme le serveur. `cartes.json` relancé: seul le parcours typique du miroir de Spirit & Time bouge d'un dixième de seconde, la carte reste d'un seul tenant, au même détour.
- **Documentation**: `assets/README.md`, la compétence `conception-de-cartes` et sa fiche de commande, l'étude 8.1 (section 1.4 corrigée), l'audit (X37), le journal de conception, le ROADMAP.

## Fichiers créés ou modifiés

- `docs/plan/etape-8-3.md` (créé): la fiche.
- `packages/shared/src/ressources.ts`: `cheminCarte(carte, couche)` et `cheminPluie(carte)`, sans miroir. `ressources.test.ts`: les chemins, et un test qui interdit tout dossier d'orientation.
- `packages/server/src/terrain.ts`: `retournerHorizontalement`, et `terrainDepuisImage(image, dimensions, modeMiroir)`. `terrain.test.ts`: le retournement, l'équivalence avec une image livrée sur un étirement à échelle non entière, le chargeur à une seule image, les empreintes figées des murs.
- `packages/client/src/rendu/miroir.ts` et `miroir.test.ts` (créés): l'orientation d'une image du décor.
- `packages/client/src/rendu/pixi.ts`: le décor orienté; `prechargerLaPartie(carte, pluie)`. `principal.ts`, `interface/modeles/cartes.ts`, `interface/modeles/reglages.ts`: les nouveaux appels.
- `packages/client/scripts/sortieVercel.test.ts`: les chemins publiés.
- `tests/e2e/rendu-miroir.spec.ts` (créé): le rendu réel de Tokyo en miroir, pluie comprise.
- `assets/cartes/`: déplacements et suppressions.
- `docs/mesures/dessiner-le-quartier.mjs`, `mesurer-les-cartes.mjs`, `cartes.json`.
- `assets/README.md`, `.claude/skills/conception-de-cartes/SKILL.md`, `fiche-de-commande.md`, `docs/mesures/etude-structures-de-carte.md`, `docs/audit/AUDIT-EXISTANT.md`, `docs/design/README.md`, `docs/plan/ROADMAP.md`, ce handoff.

Aucune modification de `packages/sim`, de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: dix unitaires côté serveur (retournement, équivalence avec l'image livrée, chargeur, empreintes des trois cartes, Spirit & Time désormais retourné), quatre côté page, un sur l'absence de dossier d'orientation; un scénario de bout en bout.
- Résultat: **2 479 tests unitaires au vert** (2 449 au handoff 8.5, dont les ajouts de l'étape 8.6). Types (trois compilations), linter et formatage verts.
- **Bout en bout du miroir: zéro pixel différent** entre le rendu de Tokyo en miroir et le retournement de son rendu normal, pluie comprise, sur 120 000 pixels au bureau et 480 000 en émulation mobile; 53 pour cent des pixels diffèrent sans retournement.
- **Suite de bout en bout complète: 51 scénarios au vert** en local, bureau, mobile et banc de rendu.
- **Vu dans le navigateur**: une partie Horde sur Tokyo, miroir et pluie, par le vrai serveur. Le décor est retourné, la pluie tombe dans les rues et s'arrête aux intérieurs retournés.
- **Empreintes des parties de référence inchangées** (`tests/charge/empreinte.ts`), les quatre du handoff 8.5: `21c9a22d…`, `c64c0e08…`, `ffbc1f1f…`, `cf86bff3…`. Elles se jouent sans miroir.
- Couverture de packages/sim: non touchée.
- État de la CI: **verte** sur `f883faf` (types, linter, tests, bout en bout), mise en ligne faite. La production répond `f883faf` sur `/sante`, sert les images à leurs nouveaux chemins et plus les anciens.

## Décisions et écarts au plan

1. **Aucune image livrée conservée.** Le ROADMAP demandait de décider si l'on garde une image livrée quand elle existe, à cause de la retouche supposée de l'avant-plan de Tokyo. La retouche n'existe pas: la question tombe.
2. **Les dossiers `normal/` disparaissent aussi**, au-delà de la fiche du ROADMAP: un dossier `normal/` seul dans son dossier serait une arborescence qui ment. Les chemins en deviennent plus courts, et un test interdit le retour d'un dossier d'orientation.
3. **Spirit & Time en miroir devient un vrai miroir** (X37, règle 7). C'est le seul changement de jeu de l'étape: 0,05 pour cent des murs, la carte étant presque symétrique. L'empreinte figée de son miroir est donc nouvelle; celles de Tokyo et du Quartier sont celles d'avant.
4. **L'étude 8.1 est corrigée en place** (section 1.4), avec la date, plutôt que réécrite.
5. **L'étape 8.6 n'a pas de handoff** au moment où celle-ci commence: son commit `66b49ca` est poussé, sa mesure en production attend. Elle a été laissée telle quelle.

## Problèmes connus et dette

- Aucune dette ouverte par l'étape.
- Repris des handoffs précédents, inchangé: la carte du Quartier reste à juger en jouant à plusieurs; rien ne surveille que la production suit `master`; l'étape 8.5 attend deux relevés du porteur du projet, et l'étape 8.6 sa mesure en production.

## Prochaine action exacte

Aucune étape planifiée ne suit `8.3`. Au porteur du projet: jouer une partie en miroir sur Tokyo avec la pluie, pour voir la pluie s'arrêter aux intérieurs retournés, puis clore `8.5` et `8.6` avec leurs relevés, et dire ce qui vient ensuite (le Quartier joué à plusieurs, un décor pour lui, ou une fonctionnalité reportée).

## Étape suivante

Fiche à lire: aucune nouvelle. `docs/plan/etape-8-5.md` et `docs/plan/etape-8-6.md` pour clore les étapes ouvertes, relevés en main.
