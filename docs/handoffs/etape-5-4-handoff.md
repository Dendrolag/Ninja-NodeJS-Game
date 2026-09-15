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
- **Seconde série de signalements, sur iPhone en production** : bots tous blancs, joueur invisible, caméra pas assez zoomée, saccades, bouton de localisation introuvable. Reproduite en pilotant WebKit en émulation iPhone contre la production. Cause principale : la caméra plaçait son point visé en divisant deux fois la taille de l'écran par la densité ; à densité 3, le joueur et ses bots tombaient sous le HUD et la carte s'arrêtait aux deux tiers de l'écran. Corrigée, avec la densité du rendu plafonnée à 2 et un vrai bouton de localisation sous le pouce. Le zoom mobile, celui du legacy, est resserré à 360 pixels de carte en largeur sur décision du porteur du projet.
- **Lancement d'une partie qui rame sur téléphone** : mesuré, les premières images dessinées portaient des tâches longues pendant que le décor partait vers la carte graphique. Le décor et les images se préchargent maintenant dès le compte à rebours du salon, et un écran « Préparation de la partie… » reste posé au-delà du lancement jusqu'à un affichage fluide, trois secondes au plus.
- **Troisième série, en production** : le zoom à 360 ne se voyait pas encore, la mise en ligne de `a781c98` n'étant pas terminée ; en ligne quelques minutes plus tard, vérifié en émulation iPhone. Et les bots naissaient tous blancs, alors que le jeu d'origine leur donne une couleur quelconque (`getRandomColor`) : régression du portage (défaut X36). Ils naissent maintenant d'une couleur tirée de la graine, jamais celle d'un joueur ; la règle 11 se précise pour que ces couleurs ne se répandent pas : seule la couleur d'un joueur présent se transmet.
- **Bonus de vitesse trop rapide sur téléphone** : le moteur n'a pas de défaut, il applique le multiplicateur d'origine. Mais sur téléphone, le jeu d'origine allait moins vite que la réécriture (120 pixels par seconde, mesuré sur son déploiement, contre 150) et montrait une vue plus large (600 pixels contre 360) : à l'écran, près de deux fois plus lent. L'audit et le journal annonçaient à tort 375 pixels par seconde ; corrigés. Le porteur du projet a choisi de garder la même vitesse sur tous les appareils.
- **Grille de recette** : `docs/recette/recette-5-4.md`, 73 cas (14 signalements, 59 cas de recette), chacun avec son attendu, sa source, ses preuves et son verdict. Déroulée en local (un joueur, deux onglets, fenêtre mobile, trois cartes dont une en miroir, mode Tactique) et en production.
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

Commit `79c6cb9`, caméra sur téléphone, densité, bouton de localisation :

- `packages/client/src/rendu/pixi.ts` : la caméra placée par `versEcran` avec l'écran de l'application, en pixels CSS ; densité du rendu plafonnée.
- `packages/client/src/rendu/apparence.ts` : `DENSITE_MAXIMALE`.
- `packages/client/page/styles/jeu.css` : le bouton de localisation en bas à droite sur écran tactile, « Capturer » au-dessus de lui.
- `tests/e2e/rendu-couleurs.spec.ts`, `playwright.config.ts` : l'écran relu, les ninjas visés au milieu, sur le projet mobile aussi.
- `tests/e2e/navigation.spec.ts` : sur téléphone, un bouton de localisation à la taille d'un pouce, dans la moitié basse de l'écran.

Commit du cadrage mobile et du lancement :

- `packages/client/src/rendu/apparence.ts` et `camera.test.ts` : `CADRAGE_MOBILE` à 360 par 271 pixels de carte ; `STABILITE`.
- `packages/client/src/rendu/stabilite.ts` et test (créés) : le juge d'un affichage fluide.
- `packages/client/src/rendu/boucle.ts` et test : l'annonce `surStabilite`.
- `packages/client/src/rendu/pixi.ts` : `prechargerLaPartie`, le décor et les images.
- `packages/client/src/interface/application.ts` et test : `prechargerLeJeu`, appelé au début du compte à rebours.
- `packages/client/src/principal.ts` : le préchargement branché.
- `packages/client/src/interface/ecrans/jeu.ts` : l'écran « Préparation de la partie… », levé à l'annonce de stabilité.

Commit des couleurs de naissance des bots :

- `packages/sim/src/couleurs.ts` et test : `couleurDeBot`, une couleur quelconque qui n'est celle de personne ; `couleurUnique` et elle partagent une seule boucle de tirage, dont le repli théorique n'est plus une instruction jamais exécutée.
- `packages/sim/src/bots.ts` et test : `peuplerDeBots` donne cette couleur à chaque bot ordinaire.
- `packages/sim/src/capture.ts` et test : `aUneCouleurADonner` exige la couleur d'un joueur présent.
- `packages/sim/src/contacts.test.ts` : la contagion entre bots, avec les joueurs qui portent leurs couleurs.
- `packages/sim/src/moteur.test.ts` : une graine où bots noirs, zones et objets jouent tous.
- `packages/sim/src/__snapshots__/partie.test.ts.snap` : l'instantané de la partie de référence, le jeu ayant changé.
- `CLAUDE.md` (comportement à préserver 11), `docs/audit/AUDIT-EXISTANT.md` (X36), `docs/design/README.md`, `docs/plan/ROADMAP.md` (la contrainte que l'étape 2.5 hérite de la règle 11), la grille et ce handoff.

Commit de la vitesse sur téléphone, documentation seule :

- `docs/audit/AUDIT-EXISTANT.md` : la cadence réelle de la manette d'origine, 50 millisecondes et non 16.
- `docs/design/README.md` : l'entrée du 14 août corrigée, la décision du 15 septembre.
- `CLAUDE.md` : précision du comportement à préserver 5.
- La grille (S14) et ce handoff.

Commits de ce handoff :

- `docs/recette/recette-5-4.md` (créé) : la grille.
- `docs/plan/etape-5-4.md` : la réconciliation avec ce que la recette a établi.
- `docs/plan/ROADMAP.md` : étapes 2.5 et 3.4, et leur place dans l'ordre d'exécution.
- `docs/handoffs/etape-5-4-handoff.md` (créé).

Aucune modification de `legacy/`, `tests/caracterisation/` ni `master`.

## Tests

- Ajoutés :
  - **recoloration** : un pixel proche du rouge va au corps, en blanc, les autres restent aux détails ; tolérance de 140 ; opacité gardée ; aucun pixel dans les deux calques ; sur les 17 vraies images et les huit couleurs (palette, blanc, noir), corps teinté et détails redonnent au pixel près la recoloration du legacy ; le sprite n'est pas en niveaux de gris ;
  - **rendu réel** (`rendu-couleurs.spec.ts`), au bureau et en émulation mobile : un joueur vert et un faux ninja blanc dessinés par PixiJS montrent du vert, du blanc, aucun pixel rouge, et presque tous leurs pixels au milieu de l'écran, là où vise la caméra ;
  - **bouton de localisation** (`navigation.spec.ts`, mobile) : au moins 56 pixels, dans la moitié basse de l'écran ;
  - **icônes** : la texture d'un objet est l'image courante de sa planche, qui change toutes les 125 millisecondes ;
  - **points flottants** : un point pour un faux ninja neutre rallié, rien pour un ninja passé à un autre ou pris à un joueur, les points d'un Black Ninja détruit et d'un joueur capturé à leur place, rien deux fois ; l'affichage pose le texte comme du texte, file vers le milieu du score puis disparaît ; la boucle les place à l'écran, trames delta comprises ;
  - **session** : continuer en invité ferme la session côté serveur ;
  - **mise en ligne** : lecture de la version en ligne ; documentation, tests, `legacy/` et `.claude/` écartés, tout le reste et l'inconnu gardés ;
  - **fin de partie** : échec puis réussite sous le même identifiant, échec annoncé seulement après le dernier essai ; en base, une partie enregistrée deux fois ne compte qu'une fois et rend la même évolution ; deux fins de partie n'ont jamais le même identifiant ;
  - **liste vivante** : redemandée toutes les cinq secondes sur son écran, sans recherche affichée, sans empilement, arrêtée en quittant l'écran et à la fermeture ;
  - **cadrage mobile** : 360 pixels de carte en largeur sur un téléphone tenu droit, les proportions gardées couché ;
  - **stabilité de l'affichage** : rien avant que la partie soit dessinée, stable après trois images rapides d'affilée, compte remis à zéro par une image lente, stable au plus tard après trois secondes, et pour de bon ; la boucle l'annonce une seule fois ;
  - **préchargement** : l'application précharge la partie dès le début du compte à rebours, une fois, avec les réglages du salon ;
  - **couleurs de naissance** : une couleur tirée au sort, variée, reproductible, jamais de la palette, blanche, noire ou exclue ; chaque bot peuplé en porte une, jamais celle d'un joueur même hors palette ; un bot de couleur sans propriétaire ne repeint rien, la couleur d'un joueur parti ne se transmet plus, un joueur repeint un bot de couleur quelconque.
- Résultat : **1 740 tests unitaires sur 1 740** (projet `unitaires`) ; **53 tests de base sur 53** contre une branche Neon neuve ; types (paquets, tests, bout en bout), linter et formatage verts.
- Bout en bout en local, bureau et mobile : 15 sur 15 ; joués deux fois en parallèle, 29 sur 30 avant l'alignement des délais, **30 sur 30** après ; **16 sur 16** avec le scénario des couleurs rejoué sur mobile et l'écran de préparation.
- Lancement mesuré sur un téléphone simulé (Chromium, carte graphique, taille Pixel 7, processeur ralenti quatre fois). Avant : deux tâches longues de 134 et 104 millisecondes sur les premières images visibles. Après : les tâches longues (242 et 70 millisecondes) tombent pendant l'écran de préparation, levé à 581 millisecondes du lancement ; aucune ensuite, et l'image la plus longue des trois premières secondes visibles dure 17 millisecondes.
- Couverture des instructions : **99,89 pour cent** sur `sim` et `shared` (99,84 au handoff 5.3) ; `sim` à **99,77** (99,66) ; `shared` à 100.
- Aucune régression de caractérisation.

## Décisions et écarts au plan

Huit entrées au journal de `docs/design/README.md`, datées du 14 septembre 2026 : la recoloration par calques, l'animation des icônes, le retour des points flottants, les quatre manques connus traités, la caméra en pixels CSS avec la densité plafonnée, le cadrage mobile à 360 pixels, la partie préparée pendant le compte à rebours, et les couleurs de naissance des bots ; et une du 15 septembre, la même vitesse sur tous les appareils. Points à lire ici.

### 1. La fiche supposait un défaut d'attribution, c'était un défaut d'affichage

L'hypothèse de la fiche (« l'attribution aléatoire des couleurs ne fonctionnerait pas ») est réconciliée dans la fiche elle-même. La correction ne touche ni le moteur ni le serveur. Elle remplace une teinte posée sur l'image entière, qui ne pouvait pas marcher sur un sprite rouge, par une teinte posée sur le seul corps. Les textures restent partagées, à raison de deux sprites par personnage au lieu d'un.

### 2. Continuer en invité ferme la session : une décision du 11 septembre est renversée

Le 11 septembre, continuer en invité n'était volontairement pas une déconnexion, pour ne pas toucher un compte dont la base était peut-être injoignable. Le porteur du projet a retenu le manque : la session est maintenant fermée, sans attendre la réponse. Le compte n'est jamais touché ; si la base est injoignable, la fermeture échoue en silence et la session expire d'elle-même.

### 3. Une partie retentée ne compte jamais deux fois

Retenter un enregistrement expose à un essai abouti dont la réponse s'est perdue. D'où l'identifiant tiré par le serveur, et une base qui ignore un doublon. Dans ce cas, la progression rendue est relue : l'après est la progression actuelle, l'avant s'en déduit par les gains écrits. C'est exact tant qu'aucune autre partie du même compte ne s'enregistre entre deux essais séparés de quelques secondes.

### 4. La production est celle du dernier commit du jeu

Depuis la mise en ligne ciblée, un commit qui ne touche que la documentation, les tests, `legacy/` ou `.claude/` ne part plus en ligne. `/sante` rend donc la version du dernier commit qui touche le jeu, et plus forcément du dernier commit de la branche. Tout fichier inconnu de la règle déclenche la mise en ligne.

### 5. Sur téléphone, la caméra en pixels CSS et une densité plafonnée à 2

Le défaut de caméra était invisible partout où la densité vaut 1 : au bureau, et dans le navigateur de recette. Il ne s'est vu que sur l'iPhone du porteur du projet, puis en pilotant WebKit à densité 3. Leçon de recette : une vérification mobile doit émuler la densité d'un vrai téléphone. Le projet mobile de Playwright le fait (2,625), et son scénario des couleurs, relancé sur ce projet, garde le défaut fermé. Plafonner la densité à 2 est un choix de coût : l'œil n'y perd rien, le téléphone y gagne plus de la moitié des pixels. Le gain de cadence reste à confirmer sur un vrai iPhone.

### 6. Les bots naissent de couleurs quelconques, et la règle 11 se précise

Aucun test ni aucune décision ne voulait des bots blancs au départ : le portage de l'étape 1.5 les a posés ainsi, et la recette les a pris pour la norme (cas C4 et J4). Rendre la couleur du legacy obligeait à relire la règle 11. Écrite « tout bot non blanc transmet sa couleur », elle aurait laissé des dizaines de couleurs sans propriétaire se répandre, ce que la décision du 14 août voulait justement empêcher pour le blanc. Elle devient « seule la couleur d'un joueur présent se transmet ». Deux effets de bord, assumés et consignés : les couleurs d'une zone de chaos, qui évitent celles des joueurs, ne se répandent plus ; et les bots d'un joueur parti gardent sa couleur sans plus la transmettre. L'étape 2.5 (reconnexion) devra garder le joueur dans la partie pendant son délai de retour, sans quoi ses bots cesseraient de se transmettre sa couleur pendant la coupure.

Conséquence fidèle au jeu d'origine : les bots noirs chassent aussi ces bots de couleur et les rendent blancs. Le scénario du test de pureté sur longue partie (quatre joueurs qui tournent en rond, soixante bots, bots noirs dès le départ), rejoué sur huit graines après la correction : entre 1 et 14 bots rendus blancs par partie, et un joueur attrapé dans deux parties seulement. La graine 5 du test n'en voyait plus aucun ; il est passé à la graine 2 pour garder des captures à observer. Aucune mesure avant la correction n'a été faite : l'effet sur la fréquence des captures de joueurs n'est donc pas chiffré.

### 7. Sur téléphone, la vitesse reste celle du bureau

Le facteur mobile avait été écarté à l'étape 1.6 sur un chiffre faux : l'audit croyait la manette d'origine à 375 pixels par seconde, elle allait à 120. Mesuré le 15 septembre 2026 sur le déploiement d'origine, en émulant la manette tactile : 60 messages de 6 pixels en trois secondes. Présenté au porteur du projet avec trois voies ; il garde la même vitesse partout, équitable entre un joueur au bureau et un joueur sur téléphone. Si le bonus paraît encore trop vif, les deux leviers restants sont le multiplicateur du bonus, pour tous, et le cadrage mobile à 360 pixels, qui grossit tout mouvement à l'écran.

### 8. Écarts à la fiche

- La recette et les corrections n'ont pas été coupées en deux étapes : les défauts se sont corrigés au fil de la grille.
- Les étapes 2.5 et 3.4 sont placées après 6.1, qui n'en dépend pas. Ordre à confirmer ou réordonner par le porteur du projet.
- Les sons et la musique n'ont pas pu être écoutés : ils sont couverts par leurs tests, et restent à écouter par le porteur du projet (cas C21 de la grille).

## Problèmes connus et dette

Nouveau, ouvert par cette étape :

- **Un point flottant a manqué une fois en jeu.** En Classique, pendant une série de ralliements, le score est passé de 1 à 7 sans qu'aucun point flottant ne soit relevé dans la page. Dans une autre partie, la capture suivante en a bien posé un. Ce n'était pas reproductible ; la cause la plus probable est un onglet en arrière-plan, où le navigateur suspend la boucle de rendu. À surveiller en jeu.
- **La fluidité sur iPhone reste à confirmer.** La densité plafonnée divise par plus de deux les pixels de chaque image, mais WebKit sans carte graphique ne mesure pas la cadence d'un téléphone. Si les saccades persistent, les pistes suivantes sont la lueur, calculée sur tout l'écran, et les deux sprites par personnage de la recoloration.
- **Le lancement sur téléphone reste à confirmer.** Le préchargement et l'écran de préparation déplacent le coût des premières images hors du jeu visible, mesuré sur un téléphone simulé ; seul un vrai iPhone dit si trois secondes suffisent. Si la partie rame encore après l'écran, les pistes suivantes sont un décor réduit sur téléphone (deux textures de 3 000 par 2 000 pixels) et la lueur.
- **En haut ou en bas de la carte, le joueur passe sous le HUD sur téléphone** : la caméra s'arrête au bord de la carte, comme dans le legacy, et le panneau du temps couvre le haut de l'écran.

Repris des handoffs précédents, inchangé : les erreurs d'un travailleur échappent aux scénarios de bout en bout ; les limites de tentatives vivent en mémoire de l'instance ; le filtrage du flux par zone d'intérêt est écarté par la mesure ; le relevé des contacts et le lissage du client restent en carré du nombre d'entités ; l'outil de Vercel est téléchargé par npx à chaque mise en ligne ; des déploiements Vercel non promus restent de la première mise en ligne ; les heures gratuites de Render sont partagées avec « To The Point » jusqu'à l'étape 6.1 ; le jeton Vercel expire le 14 septembre 2027.

Résolu par cette étape, repris du handoff 5.3 : la mise en ligne qui coupait les parties à chaque poussée ; la liste des parties qui ne se rafraîchissait pas ; l'enregistrement de fin non retenté ; la session laissée ouverte en continuant en invité ; les scénarios de bout en bout instables en local. Planifiés comme étapes : la reconnexion en cours de partie (2.5) et la gestion du mot de passe (3.4).

## État de la CI

- `4a0a575` (couleurs, icônes, points flottants) : **verte**, exécution 34881081959 ; sa mise en ligne s'est effacée devant le commit suivant, déjà poussé.
- `794e568` (session, mise en ligne ciblée) : **verte**, exécution 34881897038 ; même raison.
- `7accbf0` (fin de partie retentée, liste vivante) : **rouge**, exécution 34882583601 : `finDePartie.test.ts` attendait une partie sans identifiant. La suite unitaire complète n'avait pas été lancée avant de commiter.
- `5502c11` (correction de ce test, délais des parcours) : **verte**, exécution 34883777772 : « Types, linter et tests », « Bout en bout » et « Mise en ligne ». La production sert ce commit, vérifié sur `/sante`, et une partie y a été jouée (cas J4 de la grille).
- `71f1862` (grille, handoff, ROADMAP) : **verte**, exécution 34885103948. Documentation seule : la mise en ligne s'est arrêtée d'elle-même, « seuls des fichiers sans effet sur le jeu ont change » (cas J5 de la grille). La production reste `5502c11`, ce qui est attendu.
- `4e804bc` (dernier cas de la grille) : documentation seule.
- `79c6cb9` (caméra sur téléphone, densité, bouton de localisation) : **verte**, exécution 34889157459 : « Types, linter et tests », « Bout en bout » et « Mise en ligne ». La production sert ce commit, vérifié sur `/sante`. En émulation iPhone (WebKit, densité 3) contre la production : canevas de 780 par 1 328 pixels, joueur au centre de l'écran entouré de ses flèches, carte sur tout l'écran, bouton de localisation de 60 pixels en bas à droite.
- `a99b63d` (seconde série consignée) : documentation seule.
- `a781c98` (cadrage mobile à 360, partie préparée) : **verte**, exécution 34892564825 : « Types, linter et tests », « Bout en bout » et « Mise en ligne ». La production sert ce commit, vérifié sur `/sante`. En émulation iPhone contre la production : vue resserrée, canevas de 780 par 1 328 pixels, bouton de localisation en place. Lancement mesuré contre la production (Chromium, taille Pixel 7, processeur ralenti quatre fois) : écran de préparation levé à 522 millisecondes, tâches longues de 202 et 71 millisecondes sous l'écran, aucune ensuite, image la plus longue des trois premières secondes visibles à 33 millisecondes. Les trois refus de feuille de style relevés dans la console de WebKit viennent des captures d'écran de Playwright : aucun sans capture, un par capture.
- `92fb347` (couleurs de naissance des bots) : **verte**, exécution 34895399195. La production sert ce commit, vérifié sur `/sante`.
- Le commit qui consigne la vitesse sur téléphone ne touche que la documentation.

`master` n'a pas été touché.

## Prochaine action exacte

La section 3 du ROADMAP place ensuite **l'étape 6.1, retrait du legacy** (`docs/plan/etape-6-1.md`). Dans une conversation neuve : lire cette fiche, puis vérifier que les ressources de la version d'origine qu'elle liste sont toujours celles de `docs/deploiement.md` (service Render « To The Point », projets Vercel `ttp` et `neon-ninja`). Viennent ensuite les étapes 2.5 puis 3.4, dont les fiches se rédigent au début de chacune ; leur ordre est à confirmer par le porteur du projet.

Au porteur du projet : écouter les sons et la musique d'une partie (cas C21 de la grille), que l'agent ne peut pas entendre.

## Étape suivante

Fiche à lire: `docs/plan/etape-6-1.md`
