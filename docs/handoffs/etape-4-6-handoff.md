# Handoff - Étape 4.6 Un HUD qui se lit d'un coup d'œil

Date: 25 septembre 2026
Auteur: session Claude Code
Statut: terminée (sous réserve de la validation des textes par le porteur du projet)

## Objectif de l'étape

Rendre plus visibles, surtout sur ordinateur, l'annonce d'un bonus ou d'un malus, les effets en cours avec leur temps restant, et notre score, chaque objet à sa couleur. Aucune règle de jeu ne change.

## Ce qui a été fait

- **Le grand titre des objets** (direction B des planches). Un bonus activé, un malus envoyé ou un malus subi s'annonce au centre de l'écran, un peu au-dessus du milieu: l'icône de l'objet dans un disque de sa couleur, un surtitre (« Bonus », « Malus envoyé », « Malus »), le nom en 58 pixels à sa couleur avec une lueur, et une ligne qui dit l'effet et sa durée, ou qui l'a causé. Le malus subi se penche et se brouille. Un seul titre à la fois, 1,8 seconde, retiré à la fin de son animation, sans minuterie. Les autres annonces restent dans le fil.
- **Les cartes à jauge** (direction A). Une carte par effet en bas à gauche: icône, nom, secondes en gros à la couleur de l'objet, jauge qui se vide, bordure en pointillé pour un malus, mention « aux autres » pour un malus que nous avons envoyé, clignotement pendant les trois dernières secondes. Les cartes sont réutilisées d'une image à l'autre.
- **Le classement agrandi** (direction A). Lignes de 34 pixels et police de 16 sur ordinateur; notre ligne plus haute, cadrée, pseudo en 18 et points en 24 avec une lueur.
- **Le téléphone garde ses tailles**: sous `(pointer: coarse), (max-width: 640px)`, les cartes, le classement et le grand titre reprennent des tailles proches d'avant, et le grand titre monte à 25 pour cent de la hauteur pour ne pas couvrir notre ninja.
- **Vérifié dans un vrai navigateur**, sur une vraie partie à deux joueurs, un ordinateur et un téléphone, des objets posés sous les ninjas depuis le serveur par un outil jetable: planches 9 et 10 de `docs/design/etape-4-6/`.

## Fichiers créés ou modifiés

- `packages/client/src/annonces.ts` (et son test): le grand titre (`GrandTitre`), ses textes et les descriptions des six bonus.
- `packages/client/src/interface/composants/annonces.ts` et `annonces.test.ts` (créé): le grand titre posé à part du fil, un seul à la fois.
- `packages/client/src/hud/modele.ts` (et son test): la part restante, la fin proche, « aux autres » et l'icône de chaque effet.
- `packages/client/src/hud/surcouche.ts` et `surcouche.test.ts` (créé): les cartes à jauge, réutilisées.
- `packages/client/src/etat.ts`, `reduction.ts` (et son test): un effet retient sa durée au dernier ramassage (`dureeMs`), pour sa jauge.
- `packages/client/src/rendu/apparence.ts`: `adresseDeLIcone`, seul endroit de l'adresse de l'icône d'un objet; `interface/composants/aide.ts` l'emploie.
- `packages/client/page/styles/jeu.css`, `composants.css`: la mise en forme.
- `packages/client/src/rendu/scene.test.ts`, `selecteurs.test.ts`: le champ `dureeMs` dans leurs effets d'essai.
- `tests/e2e/hud-lisible.spec.ts` (créé): les tailles et la place mesurées par un vrai navigateur, sur ordinateur et sur écran tactile.
- `docs/design/etape-4-6/9-realise-bureau.png`, `10-realise-telephone.png` (créés): le rendu construit.
- `docs/plan/etape-4-6.md` (réconciliation), `docs/plan/ROADMAP.md`, `docs/design/README.md`, ce handoff.

Aucune modification de `packages/sim`, `packages/server`, `packages/shared`, `legacy/` ni `tests/caracterisation/`.

## Tests

- Ajoutés: le grand titre des douze objets (couleur, icône, libellé, durée, brouillage), les descriptions, les faits qui restent dans le fil; le fil et le grand titre dans le document (remplacement, retrait, texte jamais posé en balisage); la part, la fin proche, « aux autres » et l'icône d'un effet; les cartes (couleur, jauge, réutilisation, clignotement, retrait, ordre); la jauge qui repart pleine au cumul d'un bonus et à la relance d'un malus; le scénario de bout en bout qui mesure le HUD dans les deux cadrages.
- Résultat: **2 565 tests unitaires au vert**. Types, linter et formatage verts. Bout en bout en local: `hud-lisible`, `hud-telephone`, `peaufinage` et `tactique`, 14 sur 14.
- Couverture de packages/sim: inchangée, le paquet n'est pas touché.
- Empreinte des parties de référence: inchangée par construction, rien du moteur ni du serveur n'ayant changé.
- État de la CI: **verte sur `8986c2e`**, types, tests, bout en bout et mise en ligne; le serveur de production répond sur ce commit (`/sante`).

## Décisions et écarts au plan

1. **Écart de méthode, demandé par le porteur du projet**: l'étape s'est faite dans la conversation qui l'a décidée, avec l'étape 7.9 à sa suite, et avant `8.7` que l'ordre proposé plaçait en premier.
2. Les six écarts de construction sont à la section « Réconciliation » de la fiche: le malus envoyé ne se brouille pas, le grand titre monte sur écran tactile, le téléphone se reconnaît au pointeur, la jauge se rapporte au dernier ramassage, l'adresse de l'icône a un seul endroit, les descriptions sont rédigées dans l'étape.

## Problèmes connus et dette

- **Les descriptions des bonus sous le grand titre restent à valider** par le porteur du projet, à la recette.
- **Les scénarios Tactique au pouce échouent par intermittence en CI** (étape `8.7`, inchangé).

## Prochaine action exacte

Réaliser l'étape `7.9`, l'Évadé, dans cette même conversation, à la demande du porteur du projet.

## Étape suivante

Fiche à lire: `docs/plan/etape-7-9.md`.
