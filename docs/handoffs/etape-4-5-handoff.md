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
- **CI rouge, deux tests instables corrigés** (règle 7). Le commit de l'étape (`25b47e3`, run 35438462543) a échoué sur le banc du rendu au processeur ralenti, qui échouait déjà sur le handoff 7.6 (`ca27863`, run 35424800622): 9,32 ms à 300 sprites pour un plafond de 8, sur une machine de CI lente, pour un code inchangé. Sur décision du porteur du projet, ce plafond ne s'exige plus qu'en local sur carte graphique (`tests/e2e/banc-rendu.spec.ts`). Le scénario Massacre au pouce était lui aussi instable (échec puis succès à la relance, runs 35424800622 et 35438439204): la mission d'approche exige désormais la cible dans l'arc de l'arme (`tests/e2e/harnais/parcours.ts`, `massacre.spec.ts`, `tactique.spec.ts`), 20 passages sur 20 sans relance en local.
- **Compte connecté**: l'accueil dit « Bienvenue, Alice. » au lieu de « Vous jouez avec votre compte, Alice. », à la demande du porteur du projet (`ecrans/accueil.ts`, test `application.comptes.test.ts`), dans un commit à part.
- **Vérifié dans le navigateur de Claude Code** (serveur local): accueil en bureau et en téléphone, cinq cartes de modes, aide complète (principe, cinq modes, bonus, malus, zones, commandes), création avec les nouvelles tuiles et « PNJ 50 » au récapitulatif, « PNJ au départ » sur le curseur, aucune erreur dans la console.

## Fichiers créés ou modifiés

Commit `9885f25`: `docs/plan/etape-4-5.md` (créé).

Commit de l'étape:

- Page: `packages/client/src/interface/modeles/cartes.ts` (`TEXTES_DES_MODES`, rappel du salon réécrit), `interface/icones.ts` (`GLYPHES_DES_MODES`), `interface/ecrans/accueil.ts` (titre, accroche, cartes des modes), `interface/ecrans/creation.ts` (tuiles lues de la source commune), `interface/composants/aide.ts` (aide par mode, bonus, malus, commandes), `interface/modeles/creation.ts`, `modeles/reglages.ts`, `modeles/salon.ts` (libellé « PNJ »), `annonces.ts` (annonces de la Chasse), `index.ts` (export), `page/styles/ecrans.css` (grille des modes, accroche de l'aide), `page/index.html` (description).
- Contrat: `packages/shared/src/validation.ts` (refus du plafond).
- Tests: `packages/client/src/interface/presentation.test.ts` (créé); mis à jour `annonces.test.ts`, `modeles/creation.test.ts`, `modeles/reglages.test.ts`, `modeles/salon.test.ts`, `shared/src/validation.test.ts`, `server/src/ServeurSocket.options.test.ts`, `tests/e2e/navigation.spec.ts` (titre de l'accueil).
- Documentation: `README.md`, `docs/design/README.md` (quatre entrées au journal), `docs/plan/ROADMAP.md` (4.5 faite).

Commit de correction de la CI et de l'accueil d'un compte: `packages/client/src/interface/ecrans/accueil.ts` et `application.comptes.test.ts` (« Bienvenue »), `tests/e2e/banc-rendu.spec.ts`, `tests/e2e/harnais/parcours.ts`, `tests/e2e/massacre.spec.ts`, `tests/e2e/tactique.spec.ts`, `docs/design/README.md` (deux entrées), `docs/mesures/charge-serveur.md` (section 17), `docs/plan/etape-4-5.md` (décision 8), ce handoff.

Commit de ce handoff: `docs/handoffs/etape-4-5-handoff.md` (créé), mis à jour par le commit de correction.

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/sim`.

## Tests

- Ajoutés: titre et accroche de l'accueil; une carte par mode avec son nom et son texte; le même texte sur chaque tuile de création; une section par mode dans l'aide, ouverte par le texte du mode; Espace et le bouton Katana cités pour les trois modes; aucun écran de présentation ne dit plus « troupeau » ni « faux ninja ».
- Résultat: **2 401 tests Vitest** (unitaires et base) au vert; types des paquets, des tests et du bout en bout compilés en appelant tsc directement; linter et formatage verts. Bout en bout en local: **41 scénarios sur 41**, banc du rendu compris.
- Couverture de `packages/sim`: inchangée, le paquet n'est pas touché.
- État de la CI: `25b47e3` rouge (banc ralenti instable, voir plus haut); **`12ab3e8` verte** (exécution 35441155010), avec « Types, linter et tests », « Bout en bout » (41 sur 41, aucun instable) et « Mise en ligne »: les nouveaux textes sont en production. Ce dernier commit ne touche que la documentation: sa mise en ligne doit s'arrêter d'elle-même.

## Décisions et écarts au plan

Six entrées au journal de `docs/design/README.md`. À retenir:

1. **Ton court et décalé, ponctuation du porteur du projet** dans les textes réécrits. Les textes non réécrits (zones, messages techniques) gardent leurs deux-points.
2. **« PNJ » dans ce que le joueur lit, `bot` et « faux ninja » dans le code**: les commentaires et les noms de tests qui décrivent le moteur ne changent pas.
3. **Une carte par mode sur l'accueil**, texte partagé avec la création et l'aide.
4. **Le paragraphe commun sur les Black Ninjas parle de « score »** et non de ninjas, pour valoir aussi en Massacre, et précise qu'en Massacre seul le katana en vient à bout.
5. **Le banc au processeur ralenti n'exige ses 8 ms qu'en local**, sur carte graphique (décision du porteur du projet). Consigné aussi à la section 17 de `docs/mesures/charge-serveur.md`.
6. **La mission d'approche du bout en bout exige la cible dans l'arc de l'arme.**

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
