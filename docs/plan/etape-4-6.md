# Fiche étape 4.6 - Un HUD qui se lit d'un coup d'œil

Brief de session. Objectif unique: rendre plus visibles, surtout sur ordinateur, l'annonce d'un bonus ou d'un malus, les effets en cours avec leur temps restant, et notre score. Chaque objet s'annonce et se décompte à sa couleur. Aucune règle de jeu ne change.

## Origine de cette fiche

Aucune fiche n'existait. Le porteur du projet a ouvert cette étape le 25 septembre 2026, avec l'Évadé (étape 7.9), en ces termes: rendre l'affichage du score et des bonus et malus en cours « plus visibles, plus gros sur desktop », et « styliser le message des bonus/malus en adéquation avec le code couleur de ceux-ci ». Il a demandé des propositions de rendu.

Rédigée le même jour selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- trois directions dessinées sur une vraie partie, avec les feuilles de style du jeu, et rangées dans `docs/design/etape-4-6/` (planche 1, l'existant; planches 2 à 5, les directions A, B et C sur ordinateur; planches 6 à 8, sur téléphone);
- les choix du porteur du projet parmi ces directions, ci-dessous;
- la fiche 7.8 prise comme modèle pour une étape d'affichage;
- l'état du dépôt au commit `9deed8e`, et le handoff 8.6.

**Numéro**: 4.6, dans la phase 4, « Client et rendu PixiJS ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff, cette fiche, et regarder les planches de `docs/design/etape-4-6/`.

## Ce qu'est le HUD aujourd'hui

Tout est en DOM, par-dessus le terrain (`packages/client/src/hud/`): `modele.ts` calcule ce qu'il faut montrer, `surcouche.ts` l'écrit dans le document, et la mise en forme est dans `packages/client/page/styles/jeu.css`.

- **Les annonces** passent toutes par le même fil, en haut au centre (`annonces.ts`, `interface/composants/annonces.ts`, `.annonce` dans `composants.css`): une bulle sombre, un liseré vert pour une bonne nouvelle et rose pour une mauvaise, 3,2 secondes, quatre au plus. Un bonus y dit « Bonus : Boost », dans la même bulle qu'une arrivée de joueur. La couleur de l'objet n'y figure pas.
- **Les effets en cours** sont de petites cartes en bas à gauche (`.hud-effet`): un point à la couleur de l'objet, le nom en 13 pixels, les secondes en 12. Rien ne dit quelle part de l'effet est écoulée.
- **Notre score** est une ligne du classement, en haut à gauche, en 12,5 pixels, à peine distinguée des autres.

Sur téléphone, ces tailles se lisent correctement, l'écran étant petit. Sur ordinateur, tout paraît minuscule (planche 1).

## Décisions du porteur du projet, 25 septembre 2026

1. **L'annonce d'un bonus ou d'un malus devient un grand titre au centre de l'écran** (direction B, planches 3 et 4). L'icône de l'objet dans son disque de couleur, au-dessus la mention BONUS ou MALUS, le nom de l'objet en très grand et à sa couleur avec une lueur, et dessous une ligne qui dit l'effet ou qui l'a causé. Un malus se distingue par un titre penché et un effet de brouillage.
2. **Les effets en cours deviennent des cartes à jauge** (direction A, planche 2). Une carte par effet, en bas à gauche, avec l'icône de l'objet, son nom, les secondes restantes en gros et à sa couleur, et une jauge qui se vide. Un malus a une bordure en pointillé. Une carte clignote pendant ses trois dernières secondes.
3. **Notre score se lit dans un classement agrandi** (direction A, planche 2). Sur ordinateur, le classement grandit, et notre ligne se détache: plus haute, cadrée, les points en gros.
4. **Plus gros sur ordinateur, à peu près inchangé sur téléphone**: les planches 6 à 8 montrent qu'agrandir sur téléphone couvrirait le terrain.

Écartés: le bandeau coloré en haut au centre (direction A) et la bulle actuelle agrandie (direction C) pour l'annonce; les pastilles rondes (B) et les cartes actuelles agrandies (C) pour les effets; le score dans la barre du haut (B) et le compteur en bas au centre (C).

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **Seules les annonces d'objet prennent le grand titre**: bonus activé, malus ramassé, malus subi. Les captures, les arrivées, les départs et les combos restent dans le fil d'aujourd'hui, qui garde ses règles. L'étape 7.9 y ajoutera l'apparition, la capture et la fuite de l'Évadé.
2. **Un seul grand titre à la fois**: un nouveau remplace le précédent. Il reste 1,8 seconde, fondu compris, et ne reçoit ni clic ni contact. Deux objets ramassés coup sur coup ne s'empilent donc pas au milieu de l'écran.
3. **La ligne sous le titre** dit l'effet pour un bonus (« Vitesse x1,7 pendant 10 s »), le texte de l'étape 4.3 pour un malus ramassé ou subi (« Bot42 a trafiqué vos contrôles »). La durée vient de l'effet reçu, pas d'une constante: l'hôte règle les durées. Les descriptions des douze objets sont rédigées dans l'étape et soumises au porteur du projet à la recette.
4. **La couleur vient de `APPARENCE_OBJET`**, la même que l'objet posé sur la carte. Les objets du Tactique partagent une couleur par paire (étape 7.7): le bonus et son contraire se distinguent par la mention BONUS ou MALUS, et par le brouillage et le pointillé du malus.
5. **L'icône est celle de l'objet posé**, première image de sa planche pour les six objets d'origine, dessin du code pour les six du Tactique, dans un disque de sa couleur. Un seul endroit la fournit à la carte et au HUD.
6. **La jauge d'un effet se rapporte à sa durée totale**, que l'effet affiché retient (`EffetActif`) et qui s'allonge quand un bonus identique s'y ajoute (comportement à préserver 10). Un malus relancé repart de sa durée pleine, comme dans le moteur.
7. **Un malus que nous avons ramassé** garde sa carte, avec la mention « aux autres »: il nous épargne (comportement à préserver 4) et ne doit pas se lire comme subi.
8. **Mouvement réduit**: sous `prefers-reduced-motion`, le grand titre apparaît sans zoom ni brouillage, et les cartes ne clignotent pas.
9. **Accessibilité**: le grand titre garde `role="status"` et `aria-live="polite"`, comme le fil. Les textes sont posés avec `textContent`, jamais avec `innerHTML`.
10. **Le seuil entre ordinateur et téléphone** est celui que la feuille de style emploie déjà (`max-width: 640px`, `pointer: coarse`), pour ne pas créer un troisième cadrage.

## Périmètre

### Lot A. Le modèle

1. **Le grand titre**: quelles annonces le prennent, leur texte, leur couleur, leur icône (micro-décisions 1 à 5).
2. **Les effets**: la part écoulée de chaque effet, sa catégorie, la mention « aux autres », la fin proche (micro-décisions 6 et 7).
3. **Le classement**: notre ligne marquée comme aujourd'hui. Il n'y a rien à ajouter au modèle, tout est dans la mise en forme.

### Lot B. La page

1. **Le grand titre**: son élément, son remplacement, sa disparition par animation de feuille de style sans minuterie (comme le fil d'annonces).
2. **Les cartes à jauge** en bas à gauche.
3. **Le classement agrandi** sur ordinateur, et notre ligne détachée.
4. **Le téléphone**: les tailles d'aujourd'hui, ou à peine plus, vérifiées sur le cadrage du scénario `hud-telephone.spec.ts`.
5. **L'aide** de la page, si elle décrit ces éléments.

### Lot C. Documentation

1. Le journal de conception, le ROADMAP, et les planches retenues citées depuis le journal.

## Hors périmètre

- Toute règle de jeu, et `packages/sim`.
- Le badge « x2 » de l'Évadé au classement et sur la carte: étape 7.9, qui s'appuiera sur ce que celle-ci construit.
- Les annonces qui ne concernent pas un objet.
- Les points flottants (étape 7.5), la minimap, le bouton d'action, le bandeau de la Chasse et le compteur de combo.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Modèle (TU)**: les faits qui prennent le grand titre et ceux qui n'en prennent pas; le texte, la couleur et l'icône de chacun des douze objets, bonus et malus, ramassé et subi; la part écoulée d'un effet, cumul d'un bonus et relance d'un malus compris; la mention « aux autres »; la fin proche à trois secondes.
- **Surcouche (TU)**: un grand titre remplace le précédent; les cartes portent leur couleur, leur icône et leur jauge; aucun texte n'est posé en balisage.
- **Bout en bout**: sur ordinateur, un bonus ramassé montre le grand titre puis sa carte à jauge; sur téléphone, le scénario du HUD reste vert; les autres scénarios existants restent verts.
- **Banc de rendu**: inchangé, le HUD étant en DOM.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Le grand titre, les cartes à jauge et le classement agrandi correspondent aux planches retenues, vérifiés dans le navigateur de Claude Code sur ordinateur et sur téléphone, avec une capture d'écran de chaque.
2. Les descriptions des objets sont validées par le porteur du projet.
3. L'empreinte des parties de référence est identique, rien du moteur n'ayant changé.

## Points de vigilance

1. **Le grand titre cache l'action**: 1,8 seconde, et un seul à la fois. Si la recette le trouve envahissant, réduire sa taille avant sa durée.
2. **Deux effets identiques ne font qu'une carte**: le cumul allonge la jauge, il n'en ajoute pas une deuxième.
3. **Le flou et le négatif**: Vision floue et Vision négative troublent notre écran. Vérifier que le grand titre et les cartes, qui sont en DOM, restent lisibles sous ces deux malus, comme aujourd'hui.

## Rituel de fin de session

Écrire `docs/handoffs/etape-4-6-handoff.md`: les décisions construites, les écarts à cette fiche, les captures, l'état de la CI. Prochaine action exacte: l'étape suivante de la section 3 du ROADMAP. Commiter, pousser, vérifier la CI et la mise en ligne.
