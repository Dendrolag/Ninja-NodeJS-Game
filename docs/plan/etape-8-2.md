# Fiche étape 8.2 - Carte de travail: un quartier

Brief de session. Objectif unique: **faire exister une carte qui ait une structure**, et savoir ce qu'elle vaut avant d'y jouer. Un quartier de 2400 sur 1800, en noir et blanc, sans graphiste, jugé par les douze critères de l'étude 8.1, puis jouable dans le jeu.

## Origine de cette fiche

Aucune fiche n'existait: l'étape a été ouverte au ROADMAP le 20 septembre 2026 par les réponses du porteur du projet à l'étude 8.1. Elle est rédigée selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- l'entrée `8.2` de la section 3 de `docs/plan/ROADMAP.md`;
- les décisions du porteur du projet, section 7.1 de `docs/mesures/etude-structures-de-carte.md`;
- le handoff 8.1, et l'état du dépôt au commit `935ed97`;
- la fiche 8.1 prise comme modèle.

**Numéro**: 8.2, deuxième étape de la phase 8. Indépendante de `8.3`, le miroir calculé.

## Rituel de début de session

Lire `CLAUDE.md`, le dernier handoff (8.1), cette fiche, puis la section 3 de `docs/plan/ROADMAP.md`. Puis les sections 1, 4, 5.1 et 7.1 de `docs/mesures/etude-structures-de-carte.md`, qui portent tout le contenu technique de l'étape. `.claude/rules/sim-purity.md` n'est pas nécessaire: aucune règle de jeu ne change, et `packages/sim` n'est pas touché.

## Pourquoi cette carte

L'étude 8.1 a mesuré les deux cartes du jeu et a trouvé des terrains ouverts: un détour médian de 1,08 et 1,06, c'est-à-dire un chemin réel qui dépasse le vol d'oiseau de six à huit pour cent. Il n'y a ni couloir, ni raccourci, ni angle mort. Trois des cinq modes de jeu (Tactique, Chasse, Équipes) demandent exactement ce qui manque.

Le porteur du projet a tranché: **la structure avant le contenu**. Avant de commander un décor à un graphiste, on veut savoir si une carte structurée rend le jeu meilleur. Une carte de travail en noir et blanc répond à cette question pour le prix d'un programme, et si la réponse est non, on n'aura rien commandé.

Ce que l'étape doit permettre ensuite, sans le faire elle-même:

1. Jouer une partie sur une carte à vrais pâtés de maisons, et dire si cela change le jeu en bien.
2. Décider si l'on commande un décor, et sur quelle structure.
3. Disposer d'un deuxième point de comparaison mesuré, à côté de Tokyo et de Spirit & Time.

## Ce qui existe déjà, et où

À lire avant d'écrire, pour ne rien réinventer ni contredire.

| Ce qu'on cherche                             | Où c'est                                               |
| -------------------------------------------- | ------------------------------------------------------ |
| Ce qu'est techniquement une carte            | `docs/mesures/etude-structures-de-carte.md`, section 1 |
| Les douze critères de jugement               | La même étude, section 4                               |
| L'archétype du quartier, et ses chiffres     | La même étude, section 5.1                             |
| Les décisions du porteur du projet           | La même étude, section 7.1                             |
| L'outil qui mesure une carte                 | `docs/mesures/mesurer-les-cartes.mjs`                  |
| Les chiffres des deux cartes existantes      | `docs/mesures/cartes.json`                             |
| Le décodage de l'image de collision          | `packages/server/src/terrain.ts`                       |
| Le seuil de luminosité à 128                 | `packages/sim/src/collisions.ts`                       |
| Dimensions, cartes enregistrées, plafonds    | `packages/shared/src/constantes.ts`                    |
| Les chemins des fichiers d'une carte         | `packages/shared/src/ressources.ts`                    |
| Le nom et l'ambiance lus par le joueur       | `packages/client/src/interface/modeles/cartes.ts`      |
| L'énumération des cartes de la base          | `packages/server/src/base/schema.ts`, et `migrations/` |
| Le harnais de charge, et son option de carte | `tests/charge/charge.ts`, `pnpm charge --banc --carte` |
| L'inventaire et la provenance des images     | `assets/README.md`                                     |

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE.

1. **La carte s'appelle `quartier`, et non `map4`.** Les identifiants `map1`, `map2` et `map3` sont des noms de fichiers hérités du jeu d'origine, pas un système de numérotation à poursuivre. Une carte nouvelle porte un nom qui dit ce qu'elle est. Conséquence: l'énumération PostgreSQL des cartes enregistrées reçoit une valeur, donc une migration.
2. **La carte est produite par un programme, pas dessinée à la main.** Un `collision.png` dessiné dans un éditeur d'images ne se corrige pas: chaque essai serait un nouveau dessin. Un programme paramétré se relance, et le couple dessiner-mesurer devient une boucle de quelques minutes. Le programme est commité: c'est lui, et non l'image, qui porte la géométrie de la carte.
3. **Le programme vit à côté de l'outil de mesure**, sous `docs/mesures/dessiner-le-quartier.mjs`. Les deux forment une seule boucle, et l'étude qui les justifie est dans le même dossier. Comme l'outil de mesure, ce n'est pas du code de jeu: rien dans `packages/` ne le connaît, et le jeu tourne sans lui.
4. **Aucun anticrénelage sur l'image de collision.** Chaque pixel y est noir pur ou blanc pur, jamais gris. Le seuil de 128 ne rencontre donc aucun cas limite, et le mur réel est exactement le mur dessiné (piège de la section 1.2 de l'étude).
5. **Les images sont dessinées aux dimensions exactes de la carte**, 2400 sur 1800, et non au format hérité de 3000 sur 2000. Le redimensionnement du serveur et l'étirement du client deviennent l'identité, et les critères 8 et 9 sont tenus par construction.
6. **Le décor est minimal mais honnête**: il montre où sont les murs, parce qu'un mur invisible se vit comme un bug (critère 10). L'avant-plan est une image transparente: une carte de travail ne cache rien.
7. **Le miroir reste quatre images**, produites par retournement horizontal du même programme. C'est le fonctionnement actuel, et l'étape 8.3 le remplacera par un calcul. Les produire ici ne coûte rien et n'engage pas 8.3.
8. **Le plafond de faux ninjas se déduit de la surface tenable mesurée**, à la densité de Tokyo, puis se confirme au banc de charge. Pas de chiffre au jugé (critère 5 et section 1.5 de l'étude).
9. **En cas de conflit entre le détour visé et la part jouable, le détour prime.** Le détour de 1,20 à 1,35 est une décision du porteur du projet; la part jouable de 60 à 70 pour cent est une proposition de la section 5.1 de l'étude, écrite pour un quartier de 2000 sur 1500. Si les deux ne tiennent pas ensemble, on tient le détour, on reste au-dessus du seuil dur de 45 pour cent, et l'écart se déclare dans le handoff.
10. **La carte est livrée jouable, donc visible en ligne.** Le porteur du projet veut la jouer à plusieurs: cela suppose qu'elle parte en production avec le reste. Son nom et son ambiance disent au joueur que c'est un essai, pour que personne ne la prenne pour un décor abandonné en chemin.

## Périmètre

### Lot A. Dessiner la carte

1. Écrire `docs/mesures/dessiner-le-quartier.mjs`: un programme qui décrit le quartier en géométrie (rues, artères, pâtés de maisons, places) et produit les huit images de `assets/cartes/quartier/`, plus la vignette.
2. **La géométrie visée**: 2400 sur 1800, des pâtés de maisons pleins séparés par des rues de 100 à 200 pixels, une artère traversante dans chaque sens, deux ou trois places dégagées, aucune poche isolée, aucun cul-de-sac profond.
3. Les fichiers produits: `normal/collision.png`, `normal/background.png`, `normal/foreground.png`, les trois mêmes dans `mirror/`, et `preview.png` de 120 sur 120. Pas de pluie.

### Lot B. Brancher la carte dans le jeu

Les cinq endroits de la section 1.5 de l'étude, plus la base.

1. `CARTES` et `CARTES_ENREGISTREES` (`packages/shared/src/constantes.ts`).
2. `PLAFONDS_DE_FAUX_NINJAS`, avec le chiffre établi au lot C.
3. `PRESENTATION_CARTES` (`packages/client/src/interface/modeles/cartes.ts`): le nom et l'ambiance lus par le joueur.
4. La migration de l'énumération `carte` de la base (`pnpm base:generer`, puis relecture du SQL produit).
5. `cheminPluie` n'est pas touché: la carte n'a pas de pluie.

### Lot C. Mesurer et juger

1. Ajouter le quartier aux terrains de `mesurer-les-cartes.mjs`, relancer la mesure, mettre `cartes.json` à jour.
2. **Boucler jusqu'à ce que le détour médian tombe entre 1,20 et 1,35**, en changeant la géométrie du lot A, jamais le seuil.
3. Établir le plafond de faux ninjas: densité de Tokyo appliquée à la surface tenable mesurée, puis contrôle au banc (`pnpm charge --banc --carte quartier`).
4. Écrire le jugement des douze critères, un par un, chiffre à l'appui, dans une section nouvelle de l'étude 8.1.

### Lot D. Documentation

1. Une section « La carte de travail » ajoutée à `docs/mesures/etude-structures-de-carte.md`, avec le tableau des douze critères tenus ou ratés, et les chiffres de la carte à côté de ceux des deux autres.
2. `assets/README.md`: la provenance de la carte, qui n'est pas le jeu d'origine mais un programme du dépôt.
3. Une entrée au journal de `docs/design/README.md`.
4. La ligne de l'étape 8.2 dans `docs/plan/ROADMAP.md` passée à « faite », avec ses chiffres.

## Hors périmètre

- **Le décor commandé à un graphiste.** Il ne se commande que si la structure convainc, et c'est une décision du porteur du projet, après jeu.
- **Le miroir calculé**, étape `8.3`. Ici, le miroir reste quatre images.
- **La minimap repensée.** Le porteur du projet a tranché: le repérage se juge à la recette, pas à l'avance.
- **Toute règle de jeu.** Aucun mode ne change, aucun réglage de gameplay ne bouge. `packages/sim` n'est pas touché.
- **Le retrait ou la retouche de Tokyo et de Spirit & Time.** Leurs images ne bougent pas.
- **La pluie sur la carte nouvelle.**
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **La suite unitaire complète au vert.** Plusieurs tests existants couvrent déjà la carte nouvelle sans être modifiés: `ressources.test.ts` vérifie que chaque fichier annoncé existe sur le disque, et les tables indexées par `IdentifiantCarte` ne compilent pas si une entrée manque.
- **Un test de la carte elle-même**, dans `packages/server`: le terrain du quartier se décode, il a des murs, et un ninja tient au point d'apparition. C'est le seul endroit qui peut le vérifier, puisque décoder une image est une entrée-sortie.
- **Les tests de la base**, qui doivent accepter une partie enregistrée sur la carte nouvelle.
- `pnpm verify` vert, formateur passé, CI verte sur le commit de l'étape.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Le détour médian mesuré de la carte est **entre 1,20 et 1,35**.
2. Les douze critères de la section 4 de l'étude sont jugés un par un, chiffre à l'appui, et aucun des quatre interdits techniques (1, 3, 8, 9) n'est raté.
3. Le plafond de faux ninjas est justifié par une mesure, pas par une estimation.
4. La carte se choisit dans les réglages d'une partie, se charge, et se parcourt dans le navigateur.
5. Le programme qui la dessine se relance d'une commande, écrite dans l'étude.
6. Une personne non technique peut lire la section nouvelle de l'étude et comprendre ce que vaut cette carte.

## Points de vigilance

1. **Le détour et la part jouable tirent en sens contraires.** Des pâtés de maisons assez gros pour imposer un détour prennent de la place; des rues assez larges pour laisser respirer le jeu le font retomber. C'est le vrai travail de l'étape, et c'est pourquoi la mesure doit boucler.
2. **Une poche isolée casse la carte** (critère 1). Un pâté de maisons qui touche un bord, ou deux qui se touchent, peuvent fermer un passage sans que cela se voie à l'œil.
3. **Le dégagement du dixième le plus serré doit rester au-dessus de 20 pixels** (critère 4). Une rue de 100 pixels de large n'en laisse que 34 à un ninja de rayon 16, ce qui est confortable, mais un coin mal placé peut descendre bien plus bas.
4. **Le dégagement automatique des faux ninjas n'a jamais connu de passage étroit.** C'est le premier point à observer en jouant, et le handoff 8.1 le signale déjà.
5. **Une carte ajoutée à l'énumération PostgreSQL n'en ressort jamais.** Une valeur retirée rendrait illisibles les parties déjà jouées. Le nom se choisit donc une fois.
6. **Le jeu voit à 500 pixels en Tactique.** Sur une carte de 2400 sur 1800, cela fait moins d'un cinquième de la largeur: c'est le mode où la structure comptera le plus, en bien comme en mal.
7. **Écrire pour une personne non technique**, comme tout le reste de la documentation du projet.

## Rituel de fin de session

Écrire `docs/handoffs/etape-8-2-handoff.md` depuis le modèle, puis commiter. Prochaine action exacte: l'étape `8.3`, le miroir calculé, qui est la seule autre étape ouverte par les décisions du 20 septembre 2026. La suite réelle dépendra de ce que le porteur du projet pensera de la carte une fois jouée.
