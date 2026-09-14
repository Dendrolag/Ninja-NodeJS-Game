# Handoff - Étape 5.4 Recette fonctionnelle

Date: 14 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Vérifier en jouant, écran par écran et règle par règle, que la réécriture fonctionne comme prévu, et comme le jeu d'origine là où il fait foi ; corriger ce qui ne va pas.

## Ce qui a été fait

- **Signalements du porteur du projet recueillis d'abord** : tout le monde en rouge, joueurs noirs aux yeux colorés, aucune capture visible, points flottants absents, icônes d'objet doublées, score final à zéro. Circonstances : production et local, seul et à plusieurs, bureau et mobile.
- **Le défaut des couleurs est instruit, et il n'était pas là où la fiche le supposait.** L'attribution aléatoire des couleurs était juste : tirage dans la palette du legacy, graine propre à chaque partie, couleur libre à la réapparition. C'est l'affichage qui était faux. Le sprite du ninja est rouge ; le rendu le teintait en entier, en le croyant en niveaux de gris. Une teinte multiplie : les bots blancs et les joueurs rouges ou jaunes paraissaient rouges, les autres noirs aux yeux colorés, et un bot capturé ne changeait pas d'apparence. Reproduit en local, corrigé par calques : chaque image est coupée une fois en un corps, teinté, et des détails, jamais teintés. Le résultat est celui du legacy au pixel près, sur les dix-sept images et toutes les couleurs.
- **Deux autres défauts corrigés** : l'icône des bonus et malus, une planche de deux images affichée entière, s'anime image par image ; les points flottants du legacy (`createFloatingPoints`), perdus au portage, reviennent avec ses règles.
- **Le « score final à zéro » est expliqué** : c'était une partie Tactique sans tir réussi. En Classique, l'écran de fin compte bien le score (4, puis 5 points observés).
- **Manques connus du handoff 5.3 présentés au porteur du projet**, qui a décidé : traiter ici la mise en ligne ciblée, la liste des parties vivante et la fin de partie fiable ; faire des étapes de la reconnexion en cours de partie (2.5) et de la gestion du mot de passe (3.4). Les scénarios de bout en bout instables relevaient de la règle 7.
- **Fin de partie fiable** : un enregistrement qui échoue est retenté trois fois, à trois secondes d'écart, sous un identifiant tiré par le serveur ; la base ignore une partie déjà écrite et relit ce qui a été appliqué. Continuer en invité ferme maintenant la session côté serveur.
- **Liste des parties vivante** : elle se redemande toutes les cinq secondes sur son écran, sans montrer de recherche ni empiler les demandes.
- **Mise en ligne ciblée** : elle lit la version en ligne et ne part que si un fichier du jeu a changé depuis ; un commit de documentation ne coupe plus les parties.
- **Scénarios de bout en bout** : le parcours de navigation, seul à garder le délai par défaut de trente secondes, en manquait sous charge ; délais alignés sur les autres parcours.
- **Grille de recette** : `docs/recette/recette-5-4.md`, 65 cas (6 signalements, 59 cas de recette), chacun avec son attendu, sa source, ses preuves et son verdict. Déroulée en local (un joueur, deux onglets, fenêtre mobile, trois cartes dont une en miroir, mode Tactique) et en production.
- **Jeu d'origine comme référence** : le déploiement encore en ligne sert exactement le `client.js` et le `styles.css` de `legacy/`, vérifié par empreinte.

## Fichiers créés ou modifiés

Commit `4a0a575`, couleurs, icônes et points flottants :

- `packages/client/src/rendu/recoloration.ts` et test (créés) : le découpage d'une image de ninja en corps et détails, comparé au legacy sur les vraies images.
- `packages/client/src/rendu/textures.ts` (créé) : le nom des textures dérivées (corps, détails, image d'une planche).
- `packages/client/src/rendu/pixi.ts` : calques et images fabriqués au préchargement, deux sprites par personnage, teinte sur le seul corps.
- `packages/client/src/rendu/apparence.ts` : `REPEINTE_DU_NINJA`, `CADENCE_OBJET_MS`.
- `packages/client/src/rendu/animation.ts` : `imageDObjet`.
- `packages/client/src/rendu/scene.ts` et test : texture de l'image courante d'un objet, documentation corrigée de la teinte.
- `packages/shared/src/ressources.ts`, `index.ts` : `IMAGES_PAR_OBJET`, `COTE_IMAGE_OBJET_PX`.
- `packages/client/src/pointsFlottants.ts` et test (créés) : quels points montrer, fonction pure qui compare deux états.
- `packages/client/src/hud/pointsFlottants.ts` et test (créés) : leur affichage et leurs deux animations.
- `packages/client/src/rendu/boucle.ts` et test : le branchement, trames delta comprises.
- `packages/client/src/interface/ecrans/jeu.ts`, `packages/client/src/index.ts` : montage et exports.
- `packages/client/page/styles/jeu.css` : styles et animations des points flottants.
- `tests/e2e/rendu-couleurs.spec.ts` (créé), `playwright.config.ts` : le vrai rendu relu pixel par pixel, sur le seul projet bureau.
- `packages/client/package.json`, `pnpm-lock.yaml` : `pngjs` pour lire les sprites dans les tests.
- `docs/design/README.md` : trois décisions au journal.

Commit `794e568`, session et mise en ligne ciblée :

- `packages/client/src/comptes/session.ts` et test : continuer en invité ferme la session.
- `deploiement/verifications.ts` et test : `versionEnLigne`, `fichiersQuiChangentLeJeu`.
- `deploiement/deployer.ts` : la question « faut-il mettre en ligne » posée avant toute préparation.
- `.github/workflows/ci.yml` : tout l'historique pour le job de mise en ligne.
- `docs/deploiement.md` : la règle, et ce que devient la version en production.

Commit `7accbf0`, fin de partie retentée et liste vivante :

- `packages/server/src/finDePartie.ts` : nombre d'essais, attente, identifiant tiré avant le premier essai.
- `packages/server/src/ServeurSocket.ts` : les essais, l'attente sur l'horloge du serveur, finie à la fermeture.
- `packages/server/src/ServeurSocket.comptes.test.ts` : échec puis réussite sous le même identifiant, échec définitif.
- `packages/server/src/base/parties.ts` : identifiant facultatif, doublon ignoré et relu.
- `tests/base/parties.test.ts` : une partie enregistrée deux fois ne compte qu'une fois.
- `packages/client/src/rafraichissement.ts` et test (créés), `packages/client/src/client.ts` : la liste qui se redemande.
- `docs/design/cadrage.md`, `docs/design/README.md`.

Commit `5502c11`, CI rouge corrigée et délais des parcours :

- `packages/server/src/finDePartie.test.ts` : l'identifiant attendu, et deux fins de partie qui n'en partagent jamais un.
- `tests/e2e/navigation.spec.ts`, `tests/e2e/harnais/parcours.ts` : délais des parcours et du chargement de carte.

Commit de ce handoff :

- `docs/recette/recette-5-4.md` (créé) : la grille.
- `docs/plan/etape-5-4.md` : la réconciliation avec ce que la recette a établi.
- `docs/plan/ROADMAP.md` : étapes 2.5 et 3.4, et leur place dans l'ordre d'exécution.
- `docs/handoffs/etape-5-4-handoff.md` (créé).

Aucune modification de `legacy/`, `tests/caracterisation/` ni `master`.

## Tests

- Ajoutés :
  - **recoloration** : un pixel proche du rouge va au corps, en blanc, les autres restent aux détails ; tolérance de 140 ; opacité gardée ; aucun pixel dans les deux calques ; sur les 17 vraies images et les huit couleurs (palette, blanc, noir), corps teinté et détails redonnent au pixel près la recoloration du legacy ; le sprite n'est pas en niveaux de gris ;
  - **rendu réel** (`rendu-couleurs.spec.ts`) : un joueur vert et un faux ninja blanc dessinés par PixiJS montrent du vert, du blanc, et aucun pixel rouge ;
  - **icônes** : la texture d'un objet est l'image courante de sa planche, qui change toutes les 125 millisecondes ;
  - **points flottants** : un point pour un faux ninja neutre rallié, rien pour un ninja passé à un autre ou pris à un joueur, les points d'un Black Ninja détruit et d'un joueur capturé à leur place, rien deux fois ; l'affichage pose le texte comme du texte, file vers le milieu du score puis disparaît ; la boucle les place à l'écran, trames delta comprises ;
  - **session** : continuer en invité ferme la session côté serveur ;
  - **mise en ligne** : lecture de la version en ligne ; documentation, tests, `legacy/` et `.claude/` écartés, tout le reste et l'inconnu gardés ;
  - **fin de partie** : échec puis réussite sous le même identifiant, échec annoncé seulement après le dernier essai ; en base, une partie enregistrée deux fois ne compte qu'une fois et rend la même évolution ; deux fins de partie n'ont jamais le même identifiant ;
  - **liste vivante** : redemandée toutes les cinq secondes sur son écran, sans recherche affichée, sans empilement, arrêtée en quittant l'écran et à la fermeture.
- Résultat : **1 722 tests unitaires sur 1 722** (projet `unitaires`) ; **53 tests de base sur 53** contre une branche Neon neuve ; types (paquets, tests, bout en bout), linter et formatage verts.
- Bout en bout en local, bureau et mobile : 15 sur 15 ; joués deux fois en parallèle, 29 sur 30 avant l'alignement des délais, **30 sur 30** après.
- Couverture des instructions : **99,84 pour cent** sur `sim` et `shared` (99,84 au handoff 5.3) ; `sim` à **99,67** (99,66) ; `shared` à 100.
- Aucune régression de caractérisation.

## Décisions et écarts au plan

Quatre entrées au journal de `docs/design/README.md`, datées du 14 septembre 2026 : la recoloration par calques, l'animation des icônes, le retour des points flottants, et les quatre manques connus traités. Points à lire ici.

### 1. La fiche supposait un défaut d'attribution, c'était un défaut d'affichage

L'hypothèse de la fiche (« l'attribution aléatoire des couleurs ne fonctionnerait pas ») est réconciliée dans la fiche elle-même. La correction ne touche ni le moteur ni le serveur. Elle remplace une teinte posée sur l'image entière, qui ne pouvait pas marcher sur un sprite rouge, par une teinte posée sur le seul corps. Les textures restent partagées, à raison de deux sprites par personnage au lieu d'un.

### 2. Continuer en invité ferme la session : une décision du 11 septembre est renversée

Le 11 septembre, continuer en invité n'était volontairement pas une déconnexion, pour ne pas toucher un compte dont la base était peut-être injoignable. Le porteur du projet a retenu le manque : la session est maintenant fermée, sans attendre la réponse. Le compte n'est jamais touché ; si la base est injoignable, la fermeture échoue en silence et la session expire d'elle-même.

### 3. Une partie retentée ne compte jamais deux fois

Retenter un enregistrement expose à un essai abouti dont la réponse s'est perdue. D'où l'identifiant tiré par le serveur, et une base qui ignore un doublon. Dans ce cas, la progression rendue est relue : l'après est la progression actuelle, l'avant s'en déduit par les gains écrits. C'est exact tant qu'aucune autre partie du même compte ne s'enregistre entre deux essais séparés de quelques secondes.

### 4. La production est celle du dernier commit du jeu

Depuis la mise en ligne ciblée, un commit qui ne touche que la documentation, les tests, `legacy/` ou `.claude/` ne part plus en ligne. `/sante` rend donc la version du dernier commit qui touche le jeu, et plus forcément du dernier commit de la branche. Tout fichier inconnu de la règle déclenche la mise en ligne.

### 5. Écarts à la fiche

- La recette et les corrections n'ont pas été coupées en deux étapes : les défauts se sont corrigés au fil de la grille.
- Les étapes 2.5 et 3.4 sont placées après 6.1, qui n'en dépend pas. Ordre à confirmer ou réordonner par le porteur du projet.
- Les sons et la musique n'ont pas pu être écoutés : ils sont couverts par leurs tests, et restent à écouter par le porteur du projet (cas C21 de la grille).

## Problèmes connus et dette

Nouveau, ouvert par cette étape :

- **Un point flottant a manqué une fois en jeu.** En Classique, pendant une série de ralliements, le score est passé de 1 à 7 sans qu'aucun point flottant ne soit relevé dans la page. Dans une autre partie, la capture suivante en a bien posé un. Ce n'était pas reproductible ; la cause la plus probable est un onglet en arrière-plan, où le navigateur suspend la boucle de rendu. À surveiller en jeu.
- **Le scénario des couleurs ne joue que sur le projet bureau.** Sous l'émulation du téléphone de Playwright, la relecture des pixels par PixiJS rend une image vide ; le jeu, vérifié à l'œil en fenêtre mobile, affiche bien ses couleurs.

Repris des handoffs précédents, inchangé : les erreurs d'un travailleur échappent aux scénarios de bout en bout ; les limites de tentatives vivent en mémoire de l'instance ; le filtrage du flux par zone d'intérêt est écarté par la mesure ; le relevé des contacts et le lissage du client restent en carré du nombre d'entités ; l'outil de Vercel est téléchargé par npx à chaque mise en ligne ; des déploiements Vercel non promus restent de la première mise en ligne ; les heures gratuites de Render sont partagées avec « To The Point » jusqu'à l'étape 6.1 ; le jeton Vercel expire le 14 septembre 2027.

Résolu par cette étape, repris du handoff 5.3 : la mise en ligne qui coupait les parties à chaque poussée ; la liste des parties qui ne se rafraîchissait pas ; l'enregistrement de fin non retenté ; la session laissée ouverte en continuant en invité ; les scénarios de bout en bout instables en local. Planifiés comme étapes : la reconnexion en cours de partie (2.5) et la gestion du mot de passe (3.4).

## État de la CI

- `4a0a575` (couleurs, icônes, points flottants) : **verte**, exécution 34881081959 ; sa mise en ligne s'est effacée devant le commit suivant, déjà poussé.
- `794e568` (session, mise en ligne ciblée) : **verte**, exécution 34881897038 ; même raison.
- `7accbf0` (fin de partie retentée, liste vivante) : **rouge**, exécution 34882583601 : `finDePartie.test.ts` attendait une partie sans identifiant. La suite unitaire complète n'avait pas été lancée avant de commiter.
- `5502c11` (correction de ce test, délais des parcours) : **verte**, exécution 34883777772 : « Types, linter et tests », « Bout en bout » et « Mise en ligne ». La production sert ce commit, vérifié sur `/sante`, et une partie y a été jouée (cas J4 de la grille).
- Le commit de ce handoff ne touche que la documentation : sa CI doit s'arrêter avant de mettre en ligne (cas J5 de la grille).

`master` n'a pas été touché.

## Prochaine action exacte

La section 3 du ROADMAP place ensuite **l'étape 6.1, retrait du legacy** (`docs/plan/etape-6-1.md`). Dans une conversation neuve : lire cette fiche, puis vérifier que les ressources de la version d'origine qu'elle liste sont toujours celles de `docs/deploiement.md` (service Render « To The Point », projets Vercel `ttp` et `neon-ninja`). Viennent ensuite les étapes 2.5 puis 3.4, dont les fiches se rédigent au début de chacune ; leur ordre est à confirmer par le porteur du projet.

Au porteur du projet : écouter les sons et la musique d'une partie (cas C21 de la grille), que l'agent ne peut pas entendre.

## Étape suivante

Fiche à lire: `docs/plan/etape-6-1.md`
