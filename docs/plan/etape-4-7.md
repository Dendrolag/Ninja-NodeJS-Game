# Fiche étape 4.7 - Les crédits

Brief de session. Objectif unique: **créditer Bribz**, qui a réalisé le décor de la carte Tokyo et les ninjas, et dire que le jeu est une création originale de Dendrolag, de façon visible sans charger les écrans; et **marquer les autres cartes comme prototypes**, parce que leur décor n'est ni définitif ni de Bribz.

## Origine de cette fiche

Étape ajoutée le 27 septembre 2026, à la demande du porteur du projet, pendant l'étape 3.9. Rédigée le 28 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- l'entrée 4.7 de la section 4 du ROADMAP, et les fiches 4.5 et 8.4 prises comme modèles;
- l'état du dépôt au commit `2a7084a`, et le handoff 3.9;
- les réponses du porteur du projet aux quatre points que le ROADMAP laissait à trancher, dans la conversation du 28 septembre 2026.

**Numéro**: 4.7, dans la phase 4, « Client et rendu PixiJS ».

**Écart d'ordre**: le ROADMAP plaçait `4.7` après `3.8`. Le porteur du projet a demandé de l'exécuter d'abord. Rien de `3.8` n'en dépend, et `4.7` ne tire rien de `3.8` en avant.

## Rituel de début de session

Lire `CLAUDE.md`, le dernier handoff, cette fiche, puis la section 3 de `docs/plan/ROADMAP.md`. L'étape ne touche pas `packages/sim`.

## Ce qui existe déjà, et où

| Ce qu'on cherche                                        | Où c'est                                               |
| ------------------------------------------------------- | ------------------------------------------------------ |
| La présentation des cartes (nom, ambiance)              | `packages/client/src/interface/modeles/cartes.ts`      |
| Les vignettes, seul endroit où une carte a une image    | `packages/client/src/interface/composants/reglages.ts` |
| L'accueil et son pied de page (la version, étape 8.4)   | `packages/client/src/interface/ecrans/accueil.ts`      |
| Le modèle de fenêtre commun (Échap, clic à côté, focus) | `packages/client/src/interface/composants/fenetre.ts`  |
| Les styles de l'accueil et des vignettes                | `packages/client/page/styles/ecrans.css`               |
| Les crédits d'origine, dans le journal du jeu d'origine | `docs/legacy-CHANGELOG.md` (« by Bribz »)              |

Les vignettes se montrent à deux endroits, par le même composant: la création d'une partie, et la fenêtre des réglages du salon. Le récapitulatif du salon, la liste des parties, la fin de partie et l'historique du profil ne disent de la carte que son nom, en texte.

## Décisions du porteur du projet, 28 septembre 2026

1. **Le texte de la fenêtre des crédits tient en deux lignes**: « Neon Ninja est une création originale de Dendrolag. » puis « Avec l'aimable participation de Bribz pour la carte Tokyo et les ninjas. » Écarté: un générique par rôle (« Tokyo et ninjas · Bribz »).
2. **Pas encore de lien vers le TikTok de Bribz**: son accord n'est pas acquis. Le nom s'affiche seul. Le lien s'ajoutera, le jour où l'accord sera donné, en renseignant l'adresse dans les données des crédits: la fenêtre sait déjà l'afficher.
3. **« Prototype » ne se lit que sur les vignettes**, au choix de la carte, là où l'on choisit un décor. Ailleurs, le nom de la carte reste nu. Écartés: le récapitulatif du salon en plus, et partout où la carte se lit, répétitif, et faux pour l'historique qui parle de parties passées.
4. **Le Quartier perd son « Essai »**: son ambiance devient « Plan au trait », le badge « Prototype » portant désormais l'idée d'essai.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE.

1. **Un lien « Crédits » dans le pied de l'accueil, à côté de la version**, qui ouvre une petite fenêtre, comme le proposait le porteur du projet. C'est la place qu'un joueur connaît pour ce genre de mention, elle ne charge aucun écran, et une mention par vignette se répéterait partout. C'est un bouton, pas un lien: il ouvre une fenêtre, il ne mène nulle part.
2. **La fenêtre est celle de toute l'interface** (`monterFenetre`): elle se ferme par sa croix, par Échap ou d'un clic à côté, et rend le focus au bouton qui l'a ouverte.
3. **Les crédits sont des données**, dans le modèle (`modeles/credits.ts`), séparées de la fenêtre qui les affiche. Une participation porte un nom, ce qu'elle a apporté, et une adresse facultative. Avec une adresse, le nom devient un lien qui s'ouvre dans un nouvel onglet, sans transmettre la page d'origine (`target="_blank"`, `rel="noopener noreferrer"`). La fenêtre se teste avec des crédits d'essai qui en portent une, pour que le jour venu le lien soit déjà éprouvé.
4. **« Prototype » est une propriété de la carte**, dans `PRESENTATION_CARTES`, à côté de son nom et de son ambiance: une carte ajoutée au contrat doit dire si elle l'est, sinon la compilation échoue. Tokyo ne l'est pas, Spirit & Time et le Quartier le sont. L'ancienne Tokyo sans pluie (`map2`), qui ne se montre que dans l'historique, suit Tokyo.
5. **Le badge se pose sur l'image de la vignette**, en haut à gauche, petit, en police de données. Une infobulle dit « Décor provisoire »: la mention ne porte que sur le décor, les ninjas sont les mêmes sur toutes les cartes.
6. **La ligne de version garde son texte et son infobulle**; elle passe dans un élément à elle (`.accueil-version`), pour que le pied puisse porter deux choses.

## Périmètre

### Lot A. Le modèle

1. `packages/client/src/interface/modeles/credits.ts` (créé): les crédits, en données.
2. `packages/client/src/interface/modeles/cartes.ts`: `prototype` dans la présentation de chaque carte, et l'ambiance du Quartier.

### Lot B. L'interface

1. `packages/client/src/interface/composants/credits.ts` (créé): la fenêtre.
2. `packages/client/src/interface/ecrans/accueil.ts`: le bouton « Crédits » dans le pied, la fenêtre montée et démontée avec l'écran.
3. `packages/client/src/interface/composants/reglages.ts`: le badge « Prototype » sur la vignette.
4. `packages/client/page/styles/ecrans.css` et `composants.css`: le pied, le bouton, la fenêtre, le badge.

### Lot C. Documentation

1. `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/design/cadrage.md` si l'accueil ou la création y sont décrits à ce niveau, et le handoff.

## Hors périmètre

- Le lien vers le TikTok de Bribz, tant que son accord n'est pas donné.
- « Prototype » ailleurs que sur les vignettes.
- Toute autre mention d'auteur (sons, icônes, polices): la demande ne porte que sur Bribz et Dendrolag.
- `packages/sim`, `packages/server`, `legacy/`, `tests/caracterisation/`.

## Tests requis

- **Modèle**: Tokyo n'est pas un prototype, Spirit & Time et le Quartier le sont, et toute carte jouable dit si elle l'est; le texte des crédits, mot pour mot.
- **Fenêtre**: fermée au montage; le bouton du pied l'ouvre, au clic comme au clavier (c'est un vrai bouton); elle porte les deux lignes; elle se ferme par Échap et par sa croix, et rend le focus au bouton; sans adresse, le nom n'est pas un lien; avec une adresse, c'est un lien vers elle, dans un nouvel onglet, `noopener noreferrer`.
- **Vignettes**: le badge « Prototype » sur Spirit & Time et le Quartier, et pas sur Tokyo.
- **Pied**: la version se lit toujours, avec son infobulle.
- **Bout en bout**: depuis l'accueil, ouvrir les crédits, lire les deux lignes, fermer, sur ordinateur et sur téléphone.
- La suite complète, types, linter et formatage verts; CI verte.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les textes arrêtés avec le porteur du projet sont en place, mot pour mot.
2. Vérifié dans le navigateur, sur ordinateur et sur téléphone: le pied de l'accueil, la fenêtre, les vignettes.
3. Le pied reste discret: le bouton « Crédits » a la voix de la ligne de version, pas celle d'un bouton d'action.

## Points de vigilance

1. **Le pied était testé par son texte entier** (`application.test.ts`): la version passe dans son propre élément, et les tests le lisent là.
2. **La vignette est un `label`**: le badge fait partie de son nom accessible. Il se place après le nom de la carte, pour que « Spirit & Time » reste lu d'abord et que le scénario de navigation, qui clique sur ce texte, n'en soit pas dérangé.
3. **Un bouton minuscule sur téléphone** se touche mal: le bouton « Crédits » garde une zone de toucher raisonnable sans grossir la ligne.

## Rituel de fin de session

Écrire `docs/handoffs/etape-4-7-handoff.md` depuis le modèle, puis commiter. Prochaine action exacte: l'étape `3.8`, les exploits de partie, dont la fiche se rédige au début de l'étape.
