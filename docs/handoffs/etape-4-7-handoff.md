# Handoff - Étape 4.7 Les crédits

Date: 28 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Créditer Bribz, qui a réalisé le décor de la carte Tokyo et les ninjas, et dire que le jeu est une création originale de Dendrolag, de façon visible sans charger les écrans; marquer les autres cartes comme prototypes.

## Ce qui a été fait

- **L'étape passe avant `3.8`**, à la demande du porteur du projet. Consigné au ROADMAP et dans la fiche.
- **La fiche** `docs/plan/etape-4-7.md`, rédigée selon le cas de repli du PROTOCOLE. Les quatre points que le ROADMAP laissait à trancher l'ont été par le porteur du projet, tous sur la recommandation: le texte en deux lignes, pas de lien vers Bribz tant que son accord manque, « Prototype » sur les seules vignettes, et l'ambiance du Quartier réduite à « Plan au trait ».
- **Un bouton « Crédits »** dans le pied de l'accueil, à côté de la version, à la voix de la ligne de version (texte faible, souligné). Il ouvre la fenêtre commune de l'interface: « Neon Ninja est une création originale de Dendrolag. » puis « Avec l'aimable participation de Bribz pour la carte Tokyo et les ninjas. » Elle se ferme par sa croix, Échap ou un clic à côté, et rend le focus au bouton. Sur téléphone, la version et les crédits prennent chacun leur ligne.
- **Les crédits sont des données** (`modeles/credits.ts`). Une participation peut porter une adresse: la fenêtre fait alors du nom un lien, dans un nouvel onglet, `noopener noreferrer`. Aucune n'est renseignée.
- **Un badge « Prototype »** sur l'image des vignettes de Spirit & Time et du Quartier, avec l'infobulle « Décor provisoire », à la création et dans les réglages du salon, qui partagent le composant. `prototype` est une propriété obligatoire de la présentation de chaque carte.
- **Défaut corrigé hors périmètre (règle 7)**: `docs/design/README.md` portait des marqueurs de conflit de fusion commités (`<<<<<<< HEAD`, `=======`, `>>>>>>> origin/master`), laissés par le commit de fusion `d68bc15` de l'étape 3.7. Les deux côtés étaient des entrées valides du journal: les cinq sont gardées, rangées par date. Aucun autre fichier n'en porte.

Ni `packages/sim`, ni `packages/server`, ni les règles de jeu ne changent.

## Fichiers créés ou modifiés

- `packages/client/src/interface/modeles/credits.ts` (créé): les crédits en données, et la phrase d'une participation.
- `packages/client/src/interface/modeles/cartes.ts`: `prototype` dans `PresentationCarte`, et l'ambiance du Quartier.
- `packages/client/src/interface/composants/credits.ts` (créé): la fenêtre, et le lien sûr pour un nom avec adresse.
- `packages/client/src/interface/ecrans/accueil.ts`: le bouton du pied, la fenêtre montée et démontée avec l'écran, la version dans son propre élément (`.accueil-version`).
- `packages/client/src/interface/composants/reglages.ts`: le badge sur la vignette, après le nom dans le document.
- `packages/client/page/styles/ecrans.css`: le pied en ligne souple, le bouton, la fenêtre, le badge, et leurs réglages sur téléphone.
- Tests: `modeles/credits.test.ts` et `composants/credits.test.ts` (créés), `composants/reglages.test.ts`, `application.test.ts`, `tests/e2e/credits.spec.ts` (créé).
- Documentation: `docs/plan/etape-4-7.md` (créée), `docs/plan/ROADMAP.md` (ordre, étape terminée), `docs/design/README.md` (marqueurs de conflit retirés, une entrée au journal), ce handoff. `docs/design/cadrage.md` ne décrit ni le pied de l'accueil ni les vignettes: rien à y changer.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - modèle: les deux lignes mot pour mot, aucune adresse tant que Bribz n'a pas consenti, les cartes prototypes (Spirit & Time et le Quartier, pas Tokyo, ni l'ancienne Tokyo de l'historique), l'ambiance du Quartier;
  - fenêtre: fermée au montage et titrée, les deux lignes, le nom sans lien sans adresse, le lien vers l'adresse dans un nouvel onglet `noopener noreferrer` avec des crédits d'essai, la fermeture par Échap et par la croix;
  - vignettes: le badge et son infobulle sur Spirit & Time et le Quartier, pas sur Tokyo, le nom lu avant le badge;
  - application: le bouton du pied est un vrai bouton, il ouvre la fenêtre qui prend le focus, Échap la ferme et rend le focus au bouton; la version se lit dans `.accueil-version`, avec son infobulle;
  - bout en bout (`tests/e2e/credits.spec.ts`), sur ordinateur et sur téléphone: ouverture au clavier, lecture des deux lignes, fermeture par Échap puis au clic ou au doigt et par la croix, sans erreur de console; le badge sur les vignettes de la création.
- Résultat: 2 998 tests unitaires et d'intégration au vert, 120 tests de la base sautés en local (pas de variables Neon dans ce conteneur: la CI les joue); types, linter et formatage verts; les 63 scénarios de bout en bout des projets bureau et mobile au vert en local. Vérification visuelle par captures Playwright, ordinateur et téléphone: le pied en développement et avec un libellé de production, la fenêtre, les vignettes.
- Couverture de packages/sim: inchangée, aucun code du paquet touché.
- État de la CI: **verte sur `53c3b0d`** (run `36379815383`) du premier coup, tests de la base Neon et scénarios de bout en bout compris, sans relance. La mise en ligne est sautée hors de `master` (« Décisions et écarts », point 3).

## Décisions et écarts au plan

1. **`4.7` avant `3.8`**, sur demande du porteur du projet. Rien de `3.8` n'est tiré en avant.
2. **Le pied passe sur deux lignes sur téléphone**, sans le point séparateur: le libellé de production (« Version du 20 septembre 2026, 19h44 · ee18151 ») ne tient pas sur une ligne avec « Crédits », et le point serait resté seul en bout de ligne. Constaté sur capture, non prévu par la fiche.
3. **Branche de travail**: cette session a travaillé sur la branche `claude/etape-4-7-credits-rg5wk2`, imposée par son environnement, et non sur `master` comme le prévoit le PROTOCOLE. La CI y tourne, mais la mise en ligne ne part que de `master`: les crédits seront en production quand la branche y sera fusionnée.
4. **Playwright en local**: le Chromium préinstallé de ce conteneur n'avait pas la révision attendue par la version de Playwright du dépôt. Les scénarios ont tourné avec une configuration locale, non commitée, qui pointait vers le Chromium disponible. Rien ne change pour la CI.

## Problèmes connus et dette

- **Le lien vers la page de Bribz** attend son accord. Le jour venu: renseigner `adresse: 'https://www.tiktok.com/@bribz0u'` dans `CREDITS` (`packages/client/src/interface/modeles/credits.ts`) et adapter le test « ne renvoient vers aucune page »; la fenêtre et son test du lien sûr sont déjà en place.
- Rien d'autre.

## Prochaine action exacte

Exécuter l'étape `3.8`, les exploits de partie. Rédiger sa fiche selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.8 du ROADMAP et des sections 4 et 5 de `docs/design/etude-succes.md`.

## Étape suivante

Fiche à lire: `docs/plan/etape-3-8.md`, à rédiger au début de l'étape (cas de repli du PROTOCOLE).
