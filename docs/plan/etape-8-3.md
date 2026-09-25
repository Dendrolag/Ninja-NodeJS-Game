# Fiche étape 8.3 - Le miroir calculé

Brief de session. Objectif unique: **une carte ne se livre plus qu'une fois**. Le mode miroir cesse d'être un second jeu d'images: le serveur retourne la collision, la page retourne le décor. Rien ne change de ce qui se voit ni de ce qui se joue.

## Origine de cette fiche

Étape ouverte le 20 septembre 2026 par les réponses du porteur du projet à l'étude 8.1 (section 7.1 de `docs/mesures/etude-structures-de-carte.md`, question 5): « le jeu le calcule ». Placée après `8.5` et `8.6` par la section 3 du ROADMAP.

Rédigée selon le cas de repli du PROTOCOLE, à partir de l'entrée 8.3 du ROADMAP, de l'état du dépôt au commit `66b49ca`, et de la fiche 8.2 prise comme modèle.

**Numéro**: 8.3, troisième étape de la phase 8.

## Rituel de début de session

Lire `CLAUDE.md`, le dernier handoff, cette fiche, puis la section 3 de `docs/plan/ROADMAP.md`. La compétence `conception-de-cartes` se charge d'elle-même. `.claude/rules/sim-purity.md` n'est pas nécessaire: `packages/sim` n'est pas touché.

## Ce qu'on sait en entrant, et ce que la mesure a corrigé

Mesuré au début de l'étape, pixel par pixel, sur les images du dépôt (couleurs rapportées à leur opacité, parce qu'un pixel transparent ne se voit pas quelle que soit sa couleur).

| Image                       | Le miroir livré est...                                                    |
| --------------------------- | ------------------------------------------------------------------------- |
| Tokyo, collision            | le retournement exact du normal                                           |
| Tokyo, fond                 | le retournement exact du normal                                           |
| Tokyo, avant-plan           | le retournement exact du normal, **à l'œil comme à l'écran**              |
| Tokyo, pluie                | une pluie tirée à nouveau, dont les zones sèches suivent le fond retourné |
| Spirit & Time, trois images | **l'image normale elle-même, octet pour octet: pas retournée du tout**    |
| Quartier, trois images      | le retournement exact du normal (produit par `dessiner-le-quartier.mjs`)  |

Deux affirmations de l'étude 8.1 tombent.

1. **L'avant-plan de Tokyo n'a pas été retouché.** L'étude le disait identique à 91 pour cent seulement, « sans doute pour les enseignes ». Les 9 pour cent qui diffèrent sont tous des pixels **entièrement transparents**, dont seule la couleur invisible change. Aucun pixel visible ne diffère. La réserve du ROADMAP, « décider si l'on conserve une image livrée quand elle existe », est donc sans objet.
2. **Le miroir de Spirit & Time n'était pas un miroir.** L'étude le disait retourné « à 99,9 pour cent »: c'est la carte elle-même qui est symétrique à 99,9 pour cent, et le dossier `mirror` en est une simple copie. C'était déjà le cas dans le legacy (`legacy/assets/maps/map3/`). Cocher « Miroir » sur Spirit & Time n'a jamais rien changé.

**La pluie est liée au décor** (rappel du porteur du projet au début de l'étape): elle ne tombe pas dans les intérieurs vus en coupe. Elle doit donc se retourner exactement comme le fond, image par image de sa planche, pour que ses zones sèches restent sous les toits retournés.

## Décisions prises par cette fiche

1. **Un seul jeu d'images par carte, à la racine de son dossier**: `assets/cartes/<carte>/{collision,background,foreground}.png`, plus `rain.png` pour Tokyo. Les dossiers `normal/` et `mirror/` disparaissent: garder un dossier `normal/` seul dans son dossier serait une arborescence qui ment. Les images normales s'y déplacent, les images miroir sont supprimées (elles restent dans l'histoire du dépôt).
2. **Le serveur retourne l'image source avant de l'étirer**, et non la carte des murs après. C'est ce qui rend les murs identiques à l'octet près à ceux que donnait l'image livrée: l'étirement moyenne des zones dont les bords tombent sur des pixels entiers, et il n'est pas symétrique quand l'échelle ne l'est pas (3000 vers 2000 pour Tokyo).
3. **La page retourne les sprites du décor** (fond, pluie, avant-plan), en échelle horizontale négative posée au bord droit de la carte. **Rien d'autre ne se retourne**: les positions reçues du serveur sont déjà celles du terrain retourné, et le sol du Massacre s'imprime en coordonnées de la carte.
4. **La pluie se retourne image par image**, ce que fait naturellement le sprite retourné: chaque image de la planche est découpée, puis affichée retournée. Son ordre d'animation ne change pas.
5. **Aucune image livrée n'est conservée**, Tokyo compris (constat 1).
6. **Spirit & Time en miroir devient un vrai miroir.** C'est un défaut du legacy (X37 de l'audit), corrigé par conception au titre de la règle 7: le réglage promet une carte retournée. La carte étant symétrique à 99,9 pour cent, 0,05 pour cent des pixels de collision changent; ses mesures sont relancées pour vérifier qu'elle reste d'un seul tenant.
7. **Les programmes de mesure et de dessin suivent**: `mesurer-les-cartes.mjs` retourne comme le serveur, `dessiner-le-quartier.mjs` n'écrit plus qu'une orientation.

## Périmètre

### Lot A. Le serveur

- `packages/shared/src/ressources.ts`: `cheminCarte(carte, couche)` et `cheminPluie(carte)`, sans miroir.
- `packages/server/src/terrain.ts`: `retournerHorizontalement(pixels, dimensions)`, appelée par `terrainDepuisImage` quand le terrain est en miroir. Le cache garde sa clé carte et miroir.

### Lot B. La page

- `packages/client/src/rendu/miroir.ts` (créé): orienter un sprite du décor.
- `packages/client/src/rendu/pixi.ts`: le décor d'une carte en miroir est retourné; les adresses ne dépendent plus du miroir, si bien qu'une carte jouée dans les deux sens ne se télécharge qu'une fois.

### Lot C. Les images et les outils

- `assets/cartes/*`: déplacement et suppression.
- `docs/mesures/dessiner-le-quartier.mjs`, `docs/mesures/mesurer-les-cartes.mjs`, `docs/mesures/cartes.json` relancé.

### Lot D. Documentation

- `assets/README.md`, la compétence `conception-de-cartes` et sa `fiche-de-commande.md`, l'étude 8.1 (sections 1.4 et 7), l'audit (X37), le journal de conception, le ROADMAP.

## Hors périmètre

- Toute règle de jeu, `packages/sim`.
- Une vignette par orientation: il n'y en a toujours qu'une par carte.
- Le rognage des pixels transparents des images, qui allégerait les fichiers.

## Tests requis

- Le retournement du serveur, sur une petite image: il retourne, et deux retournements rendent l'image de départ.
- **Les murs retournés par le calcul identiques à ceux de l'image livrée jusqu'ici**: pour Tokyo et le Quartier, l'empreinte des murs décodés en miroir est figée dans un test, relevée avant la suppression des images.
- Le chargeur distingue la carte de son miroir à partir d'une seule image.
- Chaque carte jouable, dans les deux sens, a de vrais murs; le Quartier n'enferme personne dans les deux sens.
- Les chemins: plus aucun dossier d'orientation, et chaque fichier annoncé existe.
- L'orientation d'un sprite du décor, côté page.
- Bout en bout: le vrai rendu d'une carte en miroir est le retournement de son rendu normal, pluie comprise.
- L'empreinte des parties de référence inchangée (elles se jouent sans miroir).

## Définition de terminé

1. Il n'existe plus un seul dossier `mirror/` ni `normal/` dans `assets/cartes/`.
2. Tokyo et le Quartier en miroir ont exactement les murs d'avant.
3. Le décor d'une carte en miroir s'affiche retourné, pluie comprise, et se superpose aux murs.
4. La documentation d'une carte dit qu'elle se livre une fois.
5. Suite complète verte, CI verte, mise en ligne vérifiée.

## Rituel de fin de session

Écrire `docs/handoffs/etape-8-3-handoff.md`, commiter, pousser, vérifier la CI et la mise en ligne. Plus aucune étape planifiée ne reste ouverte après celle-ci: la suite dépend du porteur du projet.
