# Fiche étape 8.1 - Étude des structures de carte

Brief de session. Objectif unique: écrire une note qui dise ce qu'est techniquement une carte de Neon Ninja, ce qu'une bonne carte doit à une partie à plusieurs, et de quoi juger une structure de carte **avant** de commander un décor au graphiste. Aucun code de jeu, aucune image, aucun prototype: ces derniers feront leurs propres étapes.

## Origine de cette fiche

Aucune fiche n'existait: l'étape a été ajoutée au ROADMAP le 20 septembre 2026, à la demande du porteur du projet, en même temps que l'étape 7.8. Elle est rédigée le même jour selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- l'entrée `8.1` de la section 3 de `docs/plan/ROADMAP.md`, qui ouvre la phase 8;
- la demande du porteur du projet, reprise à la ligne 133 du même ROADMAP: **une étude avant tout prototype**;
- l'état du dépôt au commit `b4bb358`, et le handoff 7.8;
- la fiche 7.8 prise comme modèle.

**Numéro**: 8.1, première étape de la phase 8.

## Rituel de début de session

Lire `CLAUDE.md`, le dernier handoff (7.8), cette fiche, puis la section 3 de `docs/plan/ROADMAP.md`. `.claude/rules/sim-purity.md` n'est pas nécessaire: l'étape ne touche aucun paquet.

## Pourquoi cette étude

Le jeu tourne aujourd'hui sur deux cartes héritées du jeu d'origine, Tokyo et Spirit & Time, dont personne n'a jamais écrit ce qui fait qu'elles marchent ou non. Cinq modes de jeu se sont ajoutés depuis (Horde, Tactique, Équipes, Chasse, Massacre), chacun avec ses exigences sur le terrain, et aucun n'a été pensé avec une carte en tête. Commander un décor à un graphiste sans savoir ce qu'on lui demande coûterait cher pour un résultat injouable.

Ce que l'étude doit permettre de faire ensuite, sans elle-même le faire:

1. Décrire à un graphiste, en une page, ce que doit contenir la carte qu'on lui commande.
2. Juger une carte proposée avant de la dessiner, sur des critères mesurables et non sur un avis.
3. Choisir les tailles à viser, et savoir lesquelles dépassent ce que le socle tient aujourd'hui.

## Ce qui existe déjà, et où

À lire avant d'écrire, pour ne rien réinventer ni contredire.

| Ce qu'on cherche                             | Où c'est                                                          |
| -------------------------------------------- | ----------------------------------------------------------------- |
| Ce que coûte une carte beaucoup plus grande  | `docs/mesures/etude-grandes-cartes.md` (16 septembre 2026)        |
| Le coût mesuré d'une partie par carte        | `docs/mesures/charge-serveur.md`, sections 15 à 19                |
| Le décodage de l'image de collision          | `packages/server/src/terrain.ts`                                  |
| La carte des murs, et le seuil de luminosité | `packages/sim/src/collisions.ts`                                  |
| Dimensions, plafonds de bots, capacités      | `packages/shared/src/constantes.ts`                               |
| Les chemins des fichiers d'une carte         | `packages/shared/src/ressources.ts`                               |
| L'inventaire et la provenance des images     | `assets/README.md`                                                |
| Le tirage d'une position d'apparition        | `positionDApparition`, `packages/sim/src/etat.ts`                 |
| Le cadrage de la vue et la minimap           | `packages/client/src/rendu/apparence.ts`, `rendu/camera.ts`       |
| Le miroir, réglage de carte et non mode      | `docs/design/README.md`, tension 1, décision du 10 septembre 2026 |

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE.

1. **L'étude est un seul document**, `docs/mesures/etude-structures-de-carte.md`, rangé à côté de `etude-grandes-cartes.md`, dont elle est la suite naturelle et qui restera la référence sur les très grandes cartes. Les deux se pointent l'un l'autre.
2. **Elle mesure les deux cartes existantes** au lieu de les décrire à vue d'œil. Une carte est une image: ce qu'on peut en dire de vérifiable (part de sol praticable, largeur des passages, morceaux isolés, temps de traversée) se calcule. Ces mesures deviennent les critères de jugement d'une carte future.
3. **La mesure est reproductible**: le petit programme qui la produit est commité avec l'étude, sous `docs/mesures/mesurer-les-cartes.mjs`, et il réutilise le décodage du serveur au lieu d'en redonner une version approchée. Ce n'est pas du code de jeu: rien dans `packages/` ne le connaît, et le jeu tourne sans lui. C'est le seul écart à « une note, sans code » de l'entrée ROADMAP, et il est assumé ici: sans lui, les chiffres de l'étude ne seraient pas revérifiables.
4. **Trois ou quatre archétypes, décrits en mots et en critères**, pas en images: un archétype dit une taille, une densité de murs, une forme de circulation, les modes qu'il sert et ceux qu'il dessert. Dessiner est le métier du graphiste, et décider revient au porteur du projet.
5. **L'étude ne tranche rien.** Elle pose les questions à trancher et donne de quoi y répondre. Comme `etude-grandes-cartes.md`, elle se termine par ce qu'il faut décider d'abord.

## Périmètre

### Lot A. Mesurer les cartes existantes

1. Écrire `docs/mesures/mesurer-les-cartes.mjs`: décode les quatre images de collision jouées (Tokyo et Spirit & Time, normal et miroir) par le chemin réel du serveur, et calcule pour chacune la part de sol praticable, la part réellement atteignable par un ninja, le nombre et la taille des morceaux isolés, la distribution des largeurs de passage, et le temps de traversée à la vitesse du jeu.
2. Lancer la mesure, garder sa sortie brute à côté des autres, sous `docs/mesures/cartes.json`.

### Lot B. L'étude

`docs/mesures/etude-structures-de-carte.md`, dans cet ordre:

1. **Ce qu'est techniquement une carte**: les quatre images et leur rôle, le redimensionnement à 3000x2000, le seuil de luminosité à 128, le miroir, la vignette, la pluie, les dimensions, ce qui est codé en dur et ce qui ne l'est pas. En clair: la liste exacte de ce qu'il faut livrer pour qu'une carte existe.
2. **Ce que les cartes existantes valent**, chiffres du lot A à l'appui, et ce que ces chiffres disent du jeu qu'on y fait.
3. **Ce qu'une carte doit à une partie à plusieurs**: apparitions et distance de sécurité, distances de poursuite, visibilité selon le cadrage, goulets et culs-de-sac, densité de faux ninjas, ce que chaque mode demande en propre, et le cas du joueur seul.
4. **Les critères de jugement**, sous forme de seuils chiffrés à vérifier sur une carte proposée, avec la raison de chacun.
5. **Trois ou quatre archétypes de structure**, de tailles différentes, avec ce que chacun sert et ce qu'il coûte.
6. **Les limites du socle**: ce qui passe aujourd'hui sans rien changer, et à partir de quelle taille les quatre plafonds de `etude-grandes-cartes.md` cèdent.
7. **Ce qu'il faut trancher d'abord**, et ce que deviendraient les étapes suivantes selon la réponse.

### Lot C. Documentation

1. Une entrée au journal de `docs/design/README.md`.
2. Un renvoi depuis `docs/mesures/etude-grandes-cartes.md`.
3. La ligne de l'étape 8.1 dans `docs/plan/ROADMAP.md` passée à « faite », et l'index de `CLAUDE.md` complété d'une ligne.

## Hors périmètre

- **Tout code de jeu.** Aucun fichier de `packages/`, ni de `tests/`, ni de `assets/` n'est touché.
- **Toute image de carte**, existante ou nouvelle. Aucun décor n'est dessiné, aucun mur n'est retouché.
- **Le prototype d'une carte nouvelle**, et la commande au graphiste: ce sont les étapes que l'étude proposera.
- **Les chantiers de `etude-grandes-cartes.md`** (partition spatiale, zone d'intérêt, décor en tuiles): l'étude les cite, elle ne les ouvre pas.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

**Aucun test nouveau**, c'est une étude (entrée ROADMAP). Restent exigés, parce que le dépôt doit rester sain:

- `pnpm verify` vert: types, linter et suite unitaire complète, inchangés puisque aucun paquet n'est touché.
- Le formateur passé sur les deux fichiers ajoutés dans `docs/mesures/`.
- La CI verte sur le commit de l'étape.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. L'étude répond aux sept sections du lot B, chiffres à l'appui là où un chiffre existe.
2. Les mesures du lot A se relancent d'une commande, et la commande est écrite dans l'étude.
3. Chaque affirmation technique sur ce qu'est une carte pointe le fichier qui la porte, et a été vérifiée dans le dépôt, pas supposée.
4. Une personne non technique peut lire l'étude et comprendre ce qu'on commanderait à un graphiste.
5. Aucune décision n'est prise à la place du porteur du projet: la dernière section liste ce qui lui revient.

## Points de vigilance

1. **Ne pas refaire `etude-grandes-cartes.md`.** Elle traite du très grand (2 000 à 10 000 bots, Battle Royale) et garde ce rôle. Celle-ci traite des cartes qu'on pourrait commander demain, aux tailles que le socle tient.
2. **Les images de collision sont écrasées, pas redimensionnées à proportions égales** (3000x2000 vers 2000x1500 pour Tokyo). Un graphiste à qui on ne le dirait pas livrerait des murs décalés de plusieurs centaines de pixels. C'est le piège principal de la commande.
3. **Le miroir n'est pas une symétrie calculée**: ce sont quatre autres images, livrées à part. Une carte se commande donc en double.
4. **Les plafonds de faux ninjas sont par carte** (`PLAFONDS_DE_FAUX_NINJAS`): une carte nouvelle en demande un, justifié par une mesure, pas un chiffre au jugé.
5. **Écrire pour une personne non technique**, comme tout le reste de la documentation du projet.

## Rituel de fin de session

Écrire `docs/handoffs/etape-8-1-handoff.md` depuis le modèle, puis commiter. La prochaine action exacte dépendra de ce que l'étude proposera: elle nomme les étapes candidates, le porteur du projet choisit.
