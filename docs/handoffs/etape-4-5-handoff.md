# Handoff - Étape 4.5 Textes de présentation

Date: 19 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Réécrire avec le porteur du projet les textes qui présentent le jeu. Ils dataient du jeu d'origine et parlaient de troupeaux et de capture seule, alors que le jeu compte cinq modes, la Horde, l'élimination au katana et la traque.

## Ce qui a été fait

- **Relevé des textes** qui décrivent le jeu: accueil (titre, accroche, trois cartes de règles), tuiles de la création, aide, rappel du salon, réglages, annonces de la Chasse, refus du plafond, description de la page, README. Tableau dans la fiche.
- **Réécriture avec le porteur du projet**, en trois allers-retours, dans un ton court et décalé. Fiche `docs/plan/etape-4-5.md` rédigée selon le cas de repli du PROTOCOLE, textes arrêtés mot pour mot (`9885f25`).
- **Accueil**: titre « Le ninja, c'est vous. Enfin, un des trois cents. », accroche « Plusieurs modes, beaucoup de ninjas. », une carte par mode à la place des trois règles de la Horde, une teinte par carte.
- **Une seule source par mode**: `TEXTES_DES_MODES` (texte) et `GLYPHES_DES_MODES` (pictogramme), lus par l'accueil, la création et l'aide.
- **Aide**: un principe commun, puis une section par mode, texte de présentation en italique puis règles exactes chiffrées depuis les constantes. Bonus et malus aux textes du porteur du projet, précision « En Équipes et en Chasse, ils ne frappent que l'autre camp. ».
- **« PNJ » remplace « faux ninjas »** partout où le joueur le lit: curseur « PNJ au départ », récapitulatifs, rappel du salon, annonces de la Chasse (« C'était un PNJ, 2 vies restantes »), refus du plafond (« Cette carte accepte au plus 300 PNJ au départ. »).
- **Défauts corrigés** (règle 7): l'aide ne citait Espace que pour la Tactique, ni le bouton Katana; elle disait que l'invincibilité détruit les Black Ninjas, faux en Massacre.
- Description de la page et première ligne du README réécrites.
- **Vérifié dans le navigateur de Claude Code** (serveur local): accueil en bureau et en téléphone, cinq cartes de modes, aide complète (principe, cinq modes, bonus, malus, zones, commandes), création avec les nouvelles tuiles et « PNJ 50 » au récapitulatif, « PNJ au départ » sur le curseur, aucune erreur dans la console.

## Fichiers créés ou modifiés

Commit `9885f25`: `docs/plan/etape-4-5.md` (créé).

Commit de l'étape:

- Page: `packages/client/src/interface/modeles/cartes.ts` (`TEXTES_DES_MODES`, rappel du salon réécrit), `interface/icones.ts` (`GLYPHES_DES_MODES`), `interface/ecrans/accueil.ts` (titre, accroche, cartes des modes), `interface/ecrans/creation.ts` (tuiles lues de la source commune), `interface/composants/aide.ts` (aide par mode, bonus, malus, commandes), `interface/modeles/creation.ts`, `modeles/reglages.ts`, `modeles/salon.ts` (libellé « PNJ »), `annonces.ts` (annonces de la Chasse), `index.ts` (export), `page/styles/ecrans.css` (grille des modes, accroche de l'aide), `page/index.html` (description).
- Contrat: `packages/shared/src/validation.ts` (refus du plafond).
- Tests: `packages/client/src/interface/presentation.test.ts` (créé); mis à jour `annonces.test.ts`, `modeles/creation.test.ts`, `modeles/reglages.test.ts`, `modeles/salon.test.ts`, `shared/src/validation.test.ts`, `server/src/ServeurSocket.options.test.ts`, `tests/e2e/navigation.spec.ts` (titre de l'accueil).
- Documentation: `README.md`, `docs/design/README.md` (quatre entrées au journal), `docs/plan/ROADMAP.md` (4.5 faite).

Commit de ce handoff: `docs/handoffs/etape-4-5-handoff.md` (créé).

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/sim`.

## Tests

- Ajoutés: titre et accroche de l'accueil; une carte par mode avec son nom et son texte; le même texte sur chaque tuile de création; une section par mode dans l'aide, ouverte par le texte du mode; Espace et le bouton Katana cités pour les trois modes; aucun écran de présentation ne dit plus « troupeau » ni « faux ninja ».
- Résultat: **2 401 tests Vitest** (unitaires et base) au vert; types des paquets, des tests et du bout en bout compilés en appelant tsc directement; linter et formatage verts. Bout en bout en local: **41 scénarios sur 41**, banc du rendu compris.
- Couverture de `packages/sim`: inchangée, le paquet n'est pas touché.
- État de la CI: ETAT_CI.

## Décisions et écarts au plan

Quatre entrées au journal de `docs/design/README.md`. À retenir:

1. **Ton court et décalé, ponctuation du porteur du projet** dans les textes réécrits. Les textes non réécrits (zones, messages techniques) gardent leurs deux-points.
2. **« PNJ » dans ce que le joueur lit, `bot` et « faux ninja » dans le code**: les commentaires et les noms de tests qui décrivent le moteur ne changent pas.
3. **Une carte par mode sur l'accueil**, texte partagé avec la création et l'aide.
4. **Le paragraphe commun sur les Black Ninjas parle de « score »** et non de ninjas, pour valoir aussi en Massacre, et précise qu'en Massacre seul le katana en vient à bout.

Aucun écart à la fiche.

## Problèmes connus et dette

- **À relire par le porteur du projet sur la page**: les règles de l'aide, le rappel du salon, la description et le README ont été rédigés dans le cadre arrêté, sans relecture mot pour mot. Une retouche se fait dans `aide.ts` (`REGLES_DES_MODES`) et `cartes.ts` (`CAPTURES_DES_MODES`).
- Le titre dit « un des trois cents »: c'est le plafond de Tokyo, Spirit & Time en accepte 500. Choix assumé du porteur du projet.
- `docs/design/HANDOFF-CLAUDE-DESIGN.md` cite encore « Prêt à frapper dans l'ombre ? »: c'est le document de la maquette, conservé tel quel comme référence.

Repris du handoff 7.6, inchangé: le rendu à 500 entités sur téléphone d'entrée de gamme (étape `5.7`); la densité de 300 et 500 PNJ à jouer; l'or du x4 proche de celui des Black Ninjas; l'équilibre de la prime de la Horde; le compteur de combo qui tombe au battement près; et la liste des points ouverts reprise du handoff 5.5.

## Prochaine action exacte

Dans une conversation neuve, sur `master`: ouvrir l'étape `5.6`, référencement. Sa fiche n'existe pas: la rédiger selon le cas de repli du PROTOCOLE à partir de l'entrée 5.6 du ROADMAP (section 4), en partant de la description de la page posée à l'étape 4.5 (`packages/client/page/index.html`).

## Étape suivante

Fiche à lire: aucune encore; celle de l'étape 5.6, référencement, à rédiger au début de la session. Suivra `5.7`, allègement du rendu.
