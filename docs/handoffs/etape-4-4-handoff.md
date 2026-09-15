# Handoff - Étape 4.4 Bout en bout multi-clients

Date: 10 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Couvrir en bout en bout les parcours réels d'un joueur, avec deux clients simultanés et en fenêtre mobile. Dans le jalon 1, la section 3 du ROADMAP en fixe le périmètre: ni inscription ni progression, deux clients dans la même partie, une capture, un score cohérent, et un test de fumée en fenêtre mobile. Cette étape ferme le jalon 1.

## Ce qui a été fait

- **Le jalon 1 est fermé.** Le jeu d'origine tourne sur le socle réécrit, et des parties entières se jouent maintenant automatiquement: vrai navigateur, vrai serveur, vrais murs, de l'accueil au classement final.
- **Deux scénarios de parties entières.**
  - `parcours-solo.spec.ts`: un joueur entre, règle une partie courte, capture un faux ninja, voit son score, joue jusqu'au bout et retrouve au classement final ce que le serveur a compté. Il est joué au clavier sur bureau, et **au pouce sur la manette virtuelle en fenêtre mobile**.
  - `multijoueur.spec.ts`: Alice sur un ordinateur, au clavier; Bob sur un téléphone, au pouce. Salon identique des deux côtés, capture de joueur annoncée aux deux, classement final identique chez les deux et égal à celui du serveur.
- **Un harnais pour jouer**, sans rien ajouter au jeu:
  - le serveur de scénario expose sa partie en lecture;
  - un pilote conduit les joueurs par de vraies saisies;
  - deux commandes font bouger un joueur, le clavier et le pouce;
  - les gestes communs aux parcours sont rassemblés.
- **Aucune ligne du jeu n'a été modifiée pour les tests.** Seul un commentaire de `interface/ecrans/jeu.ts` change, pour citer les nouveaux scénarios.
- **Trois dettes des handoffs 4.2 et 4.3 sont fermées**:
  - l'écran de fin est joué de bout en bout;
  - la surcouche et la manette tactile tournent dans une vraie partie, pilotées au doigt;
  - des parties se jouent enfin sur un vrai serveur avec les murs des cartes.
- **Aucun défaut du jeu n'a été trouvé.** Chaque échec rencontré en route venait du scénario lui-même. Chacun a été diagnostiqué par la mesure avant d'être corrigé: voir « Stabilité ».
- **Trois commentaires devenus faux sont corrigés** (règle 7):
  - `playwright.config.ts` annonçait un bloc webServer pour cette étape, qui n'en a pas eu besoin;
  - `fumee.spec.ts` disait que le jeu n'existait pas encore;
  - `navigation.spec.ts` renvoyait la fin de partie à cette étape.
- **Les actions Playwright ont maintenant un délai de 15 secondes.** Sans lui, une action qui ne trouve jamais son élément attendait trois minutes et l'échec ne disait pas où.

## Les scénarios, et ce que chacun vérifie

| Scénario                         | Cadrages                                         | Ce qui est vérifié                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `parcours-solo.spec.ts`          | bureau au clavier, mobile au pouce (Pixel 7)     | Réglages enregistrés; capture d'un faux ninja par le déplacement du joueur; score non nul au HUD; en mobile, la manette apparaît sous le doigt et disparaît quand il se lève; classement final égal, cellule par cellule, à celui du serveur; retour à l'accueil; aucune erreur de console. Bonus, malus, zones et Black Ninjas restent en jeu.                                      |
| `multijoueur.spec.ts`            | bureau seulement, il fabrique ses deux appareils | Même titre, mêmes joueurs et même hôte des deux côtés; réglages et lancement invisibles pour l'invité; récapitulatif des réglages identique chez les deux; compte à rebours chez les deux; annonce « Vous avez capturé … : +N ninjas » à l'attaquant et « Capturé par … ! » à la victime, N lu dans le serveur; classement final identique chez les deux et égal à celui du serveur. |
| `navigation.spec.ts` (étape 4.3) | bureau et mobile                                 | Inchangé, sauf son commentaire et le relevé des erreurs mis en commun.                                                                                                                                                                                                                                                                                                               |

**Le serveur est l'arbitre.** Qui capture qui, quand deux joueurs ont chacun le droit de capturer, est tiré au sort par le moteur. Le scénario ne le décide pas: il le lit dans l'état du serveur, puis vérifie que chaque page raconte la même histoire.

## Architecture du harnais

```
scenario ──> page (vraies saisies) ──> client ──> reseau ──> serveur ──> moteur
   │                                                            │
   └───── lit l'etat qui fait foi: jeu.partie() ───────────────┘

pilote: situation lue dans le serveur ──> chemin ──> visee ──> commande ──> page
                                                               (clavier | pouce)
```

| Fichier                               | Responsabilité                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/harnais/serveur-de-jeu.ts` | Le vrai serveur sur un port libre, et `partie()`, la partie ouverte, en lecture                                   |
| `tests/e2e/harnais/pilote.ts`         | `accomplir(mission)`: chemin sur la carte, visée en ligne droite, approche finale, message d'échec géométrique    |
| `tests/e2e/harnais/commandes.ts`      | `commandeAuClavier`, les flèches; `commandeAuPouce`, des contacts tactiles par le protocole de Chromium           |
| `tests/e2e/harnais/parcours.ts`       | Gestes d'un joueur (entrer, régler, lancer, attendre, lire le classement), relevés, lectures du serveur, missions |

## Fichiers créés ou modifiés

Créés

- `tests/e2e/parcours-solo.spec.ts`: le parcours solo, en bureau et en mobile.
- `tests/e2e/multijoueur.spec.ts`: la partie à deux joueurs.
- `tests/e2e/harnais/pilote.ts`, `commandes.ts`, `parcours.ts`: le harnais décrit ci-dessus.

Modifiés

- `tests/e2e/harnais/serveur-de-jeu.ts`: la méthode `partie()`, pour que le scénario lise l'état qui fait foi.
- `tests/e2e/navigation.spec.ts`: son commentaire renvoyait la fin de partie à cette étape; le relevé des erreurs passe par `releverLesErreurs`.
- `tests/e2e/fumee.spec.ts`: son commentaire disait que le jeu n'existait pas encore.
- `playwright.config.ts`: son commentaire annonçait un bloc webServer; la partie à deux est retirée du projet mobile; `actionTimeout` à 15 secondes; le banc de mesure joue après les autres projets, seul (voir « État de la CI »).
- `packages/client/src/interface/ecrans/jeu.ts`: son commentaire cite les scénarios qui le jouent.
- `docs/plan/etape-4-4.md`: section « Réconciliation » à six points.
- `docs/design/README.md`: quatre décisions du 10 septembre 2026.

Aucune modification de `packages/sim`, `packages/shared`, `packages/server`, `legacy/` ni `tests/caracterisation/`. Le code du client ne change que par un commentaire.

## Tests

- Ajoutés: deux scénarios Playwright, qui donnent trois exécutions (solo en bureau, solo en mobile, partie à deux). Aucun test Vitest: l'étape ne touche aucun code du jeu.
- Résultat: **1080 tests Vitest passent, 0 échec**, inchangé. **10 scénarios Playwright passent**: les 4 de fumée, la navigation en bureau et en mobile, le parcours solo en bureau et en mobile, la partie à deux, et le banc de mesure du rendu.
- Banc de mesure, sur carte graphique, joué seul en fin de suite: 59,5, 60,1 et 60,0 images par seconde avec lueur à 100, 200 et 500 sprites, pour un coût de notre code de 0,30, 0,33 et 1,07 ms par image. Joué en parallèle des parties, avant la correction décrite dans « État de la CI », le même banc relevait 2,32 ms à 500 sprites: la charge des autres scénarios se voyait déjà en local.
- Couverture: **99,74 pour cent** sur `packages/sim` et `packages/shared`, inchangée.
- Types, linter, formatage: verts. `pnpm verify` passe.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.
- CI: voir « État de la CI » plus bas.

## Stabilité des scénarios, mesurée

La fiche demande de noter toute instabilité résiduelle. Voici chaque série jouée pendant l'étape, dans l'ordre, avec ce que chaque échec a appris. « À la fois » compte des parties simultanées; une partie à deux ouvre deux pages.

| Série                                      | Conditions                     | Résultat | Ce que l'échec a appris                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Première écriture, solo et partie à deux   | 1 passage chacun               | 2/3      | Blocage de trois minutes sur un localisateur imbriqué du harnais, faute de délai sur les actions                                                                                                         |
| Partie à deux                              | 1 passage                      | 0/1      | L'annonce de la victime était cherchée après coup; elle ne vit que 3,2 secondes                                                                                                                          |
| Partie à deux, trames relevées             | 1 passage                      | 1/1      | Les deux notifications partent et s'affichent correctement: le client n'est pas en cause                                                                                                                 |
| Partie à deux                              | 4 passages, 2 à la fois        | 3/4      | Pilote bloqué douze secondes près d'un faux ninja. Les cartes sont d'un seul tenant, mesuré: ce n'était pas une poche. Grille affinée et visée en ligne droite ensuite, sans nouveau blocage de ce genre |
| Solo et partie à deux                      | 4 passages chacun, 3 à la fois | 11/12    | Deux poursuivants ont tourné autour d'un obstacle                                                                                                                                                        |
| Partie à deux, un seul poursuivant         | 6 passages, 3 à la fois        | 4/6      | Bob arrêté ou lent                                                                                                                                                                                       |
| Partie à deux, images par seconde relevées | 3 passages, 3 à la fois        | 2/3      | 2 à 3 images par seconde pendant la partie, et aucun `touchcancel`: la page est lente, le tactile n'est pas annulé                                                                                       |
| Partie à deux, Bob à la densité de un      | 2 passages, 1 à la fois        | 2/2      | 9 images par seconde pour les deux pages                                                                                                                                                                 |
| Partie à deux, Bob à la densité du Pixel 7 | 2 passages, 1 à la fois        | 1/2      | 5 images par seconde; Bob en orbite autour d'Alice immobile, positions relevées                                                                                                                          |
| **Pilote final**, solo et partie à deux    | 4 passages chacun, 2 à la fois | 12/12    |                                                                                                                                                                                                          |
| **Pilote final**, suite complète           | 1 passage                      | 10/10    |                                                                                                                                                                                                          |
| **Pilote final**, partie à deux            | 6 passages, 3 à la fois        | 6/6      |                                                                                                                                                                                                          |

**Instabilité résiduelle connue: en local, aucune; en CI, deux épisodes**, décrits dans « État de la CI »: Bob immobile aux trois essais d'un passage, cause non établie et non reproduite en local, puis un score du HUD vérifié trop strictement, corrigé. En local, le pilote final a passé 28 exécutions sans échec, dont 11 parties à deux, avec jusqu'à six pages dessinées sans carte graphique en même temps. Deux réserves, dites franchement:

- **la CI est la vraie inconnue**: SwiftShader sur deux processeurs, et `retries: 2`, qui ferait passer un échec isolé au second essai. Le rapport de la CI dit si un scénario n'est passé qu'après un nouvel essai: voir « État de la CI »;
- **les échecs du pilote se lisent directement**: le message donne les positions récentes, la phase, la cible et le point visé. Un échec en CI se diagnostique donc sans rejouer.

## Décisions et écarts au plan

Les décisions de fond sont au journal de `docs/design/README.md`, datées du 10 septembre 2026. Les écarts à la fiche sont dans sa section « Réconciliation ». Sept points méritent d'être lus ici.

### 1. Le serveur est l'arbitre, et le scénario n'y écrit jamais

La page ne dit pas où sont les joueurs, et c'est voulu: l'état du client n'est pas exposé. Le serveur, lui, tourne dans le processus du scénario. `jeu.partie()` le rend lisible.

Le scénario s'en sert pour deux choses:

- **savoir où aller**, pour le pilote;
- **juger ce que les pages affichent**: annonces, classement final.

Il n'appelle jamais une méthode qui change la partie. Tout passe par les pages. L'autre voie, exposer l'état du client sur la page, aurait ajouté au jeu une porte réservée aux tests.

### 2. Le pilote, et pourquoi il est fait ainsi

Chaque règle du pilote répond à un échec mesuré.

- **Un chemin sur une grille de 8 pixels**, avec la règle du moteur (`positionTenable`), pour contourner les murs.
- **La visée du point le plus lointain atteignable en ligne droite** (`trajetTenable`). La première version visait trois mailles devant sans vérifier la ligne droite, sur une grille de 16 pixels; un joueur est resté bloqué douze secondes avec elle, et plus aucun avec la version actuelle.
- **Un seul poursuivant.** Alice attend, Bob vient. Deux poursuivants ont tourné autour d'un obstacle.
- **L'approche finale**: devant une cible immobile, arrêt, puis ruée en ligne droite sans corriger. Voir le point 3.

### 3. Une page lente applique chaque commande en retard, et c'est mesuré

**La saisie n'est lue qu'à chaque image.** `lancerLaBoucle` lit les contrôles et émet `deplacer` dans sa boucle d'affichage, depuis l'étape 4.2. Sur une page à 5 images par seconde, une direction part donc jusqu'à 200 ms après la commande.

Conséquence observée: Bob, qui corrigeait sa direction sans cesse, s'est mis en orbite à 50-70 pixels autour d'Alice immobile. Positions relevées sur 1,7 seconde: (158, 256), (142, 208), (86, 213), (65, 262), (104, 320), autour de (109, 248). Depuis l'arrêt, une ruée en ligne droite passe par la cible: le retard ne fait plus que retarder le contact.

**Ce n'est pas un défaut du jeu.** Lire la saisie une fois par image est la norme. Sur carte graphique, à 60 images par seconde, le retard est de 16 ms. Voir « Problèmes connus » pour ce que cela implique sur un matériel modeste.

### 4. Le téléphone de Bob dessine à la densité de un

PixiJS dessine à la densité de l'écran. Le Pixel 7 a une densité de 2,625, soit sept fois plus de pixels à calculer. Sans carte graphique, les deux pages d'une partie partagent le processeur.

Mesuré une partie à la fois:

- **5 images par seconde** pour les deux pages avec la vraie densité;
- **9 images par seconde** à la densité de un.

Bob garde le cadrage, le tactile et l'identité du Pixel 7. Le parcours solo, seul dans sa page, joue le Pixel 7 à sa vraie densité.

### 5. Les annonces se vérifient par un relevé

Une annonce vit 3,2 secondes. Sous charge, une page a reçu une notification 3,9 secondes après une autre, mesuré par les trames. `releverLesAnnonces` note chaque annonce au moment où elle entre dans le document, comme un lecteur d'écran l'entend. Le scénario vérifie ensuite ce relevé, avec 15 secondes de marge.

### 6. Une partie épurée pour deux joueurs, complète pour un seul

Pour la partie à deux, l'hôte retire par le panneau de réglages ce qui empêcherait le contact en trente secondes: l'invincibilité, les malus (dont les contrôles inversés), les zones et les Black Ninjas. Le parcours solo garde tous les réglages du jeu, sauf la durée (30 secondes, le minimum du serveur) et les faux ninjas (100).

### 7. La capture vérifiée est celle d'un joueur

La fiche admet un joueur ou un bot. La capture de joueur est celle qui transfère des ninjas et touche deux clients à la fois. Chacun capture d'abord un faux ninja, pour que le transfert porte sur quelque chose. Le nombre annoncé est comparé à `botsGagnesAuTotal` lu dans le serveur.

### Ce que cette étape rend structurellement impossible

- **Une chaîne saisie, client, réseau, moteur cassée ne peut plus passer inaperçue**, au clavier comme au pouce: les scénarios ne capturent qu'en jouant.
- **Un classement affiché qui diverge du serveur ne peut plus passer**: il est comparé cellule par cellule, chez les deux joueurs.
- **Une annonce de capture adressée à la mauvaise personne**, ou portant un autre nombre que celui du serveur, fait échouer la partie à deux.
- **Un salon qui diffère entre l'hôte et l'invité** fait échouer la partie à deux.
- **Une action de scénario qui ne trouve pas son élément ne bloque plus trois minutes**: elle échoue en quinze secondes, au bon endroit.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **Sur un matériel qui dessine lentement, chaque commande part en retard.** Voir le point 3. Ce n'est pas un défaut, mais c'est une propriété mesurée qui touche la cible mobile: à 5 images par seconde, 200 ms de retard. L'étape 5.2 prévoit déjà de mesurer le rendu sur un matériel représentatif; c'est là qu'il faudra dire si émettre l'intention au moment de la saisie, plutôt qu'à l'image suivante, vaut la peine.
- **Les contacts tactiles des scénarios passent par le protocole de Chromium.** Les scénarios ne tournent donc que sous Chromium, comme avant. La compatibilité des navigateurs reste à mesurer avant le déploiement (5.3).
- **Les scénarios supposent une seule partie par serveur, et la règle du premier salon en attente.** `jeu.partie()` refuse d'en trouver zéro ou plusieurs, et Bob rejoint Alice sans code. **L'étape 2.4 devra adapter les deux scénarios de parties** quand elle remplacera cette règle par les codes et la file.
- **La suite de bout en bout est plus longue**: deux parcours solo de trente secondes et une partie à deux d'une minute s'y ajoutent, avec leur compte à rebours et le chargement de la carte. En local, scénarios en parallèle, la suite complète prend environ une minute; en CI, où une seule partie tourne à la fois depuis le cinquième passage, sa durée se lit dans le run.
- **Le pilote n'a pas de test unitaire.** C'est du code de test, exercé par les scénarios qui l'utilisent, et son message d'échec donne la géométrie de la situation.

Repris du handoff 4.3, inchangé:

- Sans identifiant de partie, on entre dans la première qui attend. Provisoire, étape 2.4.
- Le retour au salon après une partie n'existe pas: Rejouer ouvre un nouveau salon.
- Aucune reconnexion (3.2), aucune capacité maximale par partie (2.4), aucune mesure de charge (5.1).
- La CI ne valide pas la cadence du rendu, faute de carte graphique.
- `tsc --build` peut laisser une compilation périmée; `tsc --build --force` corrige.
- `app.js` pèse 684 Ko minifié; pas de découpage (5.2).
- La connexion Socket.IO repose sur `connect-src 'self'`; compatibilité des navigateurs non mesurée (5.3).
- Le script d'empaquetage demande Node 22.18 ou plus récent.
- `.claude/launch.json` est exclu localement et non versionné.
- L'icône de la page est celle du legacy.
- `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`.

Fermé par cette étape:

- **l'écran de fin est joué de bout en bout**;
- **la surcouche et la manette tactile sont jouées** dans une vraie partie, au doigt;
- **des parties se jouent sur le vrai serveur avec les murs des cartes**, ce que le handoff 4.2 attendait de cette étape.

## État de la CI

**Premier passage, run 34499406964, commit 98b14ae: rouge**, et c'était un défaut de cette étape.

- « Types, linter et tests »: vert, 1080 tests.
- « Bout en bout »: 9 scénarios sur 10 verts **au premier essai**, sans aucun nouvel essai. Les deux parcours solo et la partie à deux en font partie.
- Le seul rouge est le banc de mesure du rendu. À 500 sprites, notre code a coûté 8,04 ms par image, pour un seuil de 8 ms. Relevé complet: 4,6, 2,6 et 2,1 images par seconde avec lueur à 100, 200 et 500 sprites, pour 1,19, 2,65 et 8,04 ms par image. Les étapes 4.2 et 4.3 relevaient 3,01 à 3,46 ms à 500 sprites.
- **Cause.** La CI joue les scénarios sur deux travailleurs, donc le banc partageait la machine avec d'autres scénarios. Depuis cette étape, ce sont des parties entières qui dessinent une quarantaine de secondes sans carte graphique: le banc mesurait aussi leur charge. Le rapport de la CI ne date pas chaque scénario; le chevauchement est certain, sa part exacte ne l'est pas.
- **Correction, faite aussitôt (règle 7).** Le projet `banc` dépend désormais des projets `bureau` et `mobile` (`playwright.config.ts`): il joue après eux, seul. Le seuil n'a pas été touché: le relever aurait caché ce que le banc doit mesurer.

**Second passage, run 34500244374, commit de8ce7b: rouge.**

- Le banc n'a pas été joué, par construction: il attend désormais les projets `bureau` et `mobile`, et l'un d'eux a échoué.
- **La partie à deux a échoué aux trois essais**, toujours sur « Bob va au contact de Alice ». Dans les trois, Bob était rigoureusement immobile pendant deux secondes, avec un chemin trouvé. Sa première mission avait réussi, mais un faux ninja errant peut toucher un Bob immobile: ce succès ne prouve pas que son pouce agissait.
- Le parcours solo en bureau a échoué au premier essai (Alice lente près d'un bord) et réussi au second.
- **Diagnostic en local.** La page de Bob ralentie six fois (`Emulation.setCPUThrottlingRate`), environ huit images par seconde: 3 passages sur 3. Les contacts envoyés et reçus concordent (trois débuts, trois fins, aucune annulation) et la manette se cache à chaque fin. L'hypothèse d'un « doigt fantôme » qui bloquerait `tactile.ts` n'est pas reproduite, et `tactile.ts` n'est pas modifié. **La cause de l'immobilité de Bob en CI n'est pas établie.**
- **Réponse**, commit f652dd0: un échec de mission joint désormais les signes vitaux de chaque page (images dessinées sur deux secondes, ancienneté de la dernière image, contacts reçus, état de la manette, écran, derniers avertissements et erreurs). S'il se reproduit, le message dira si la page dessinait encore.

**Troisième passage, run 34520628031, commit f652dd0: vert.**

- « Types, linter et tests »: vert, 1080 tests.
- « Bout en bout »: 9 scénarios verts au premier essai, dont la partie à deux, et 1 fragile: le parcours solo en bureau, vert au second essai.
- Le banc, joué seul: 4,6, 4,4 et 3,6 images par seconde avec lueur à 100, 200 et 500 sprites, pour 1,09, 1,66 et 2,95 ms par image. Revenu à l'ordre des étapes 4.2 et 4.3.
- **La fragilité.** `.hud-ligne.moi .hud-points` affichait « 0 » cinq secondes après que le serveur a compté un faux ninja à Alice. Deux causes possibles, non départagées: le score réellement retombé, puisqu'un Black Ninja rend neutre le faux ninja qu'il attrape et que le parcours solo les garde en jeu; ou un HUD qui ne suit plus le serveur. **Correction**: la vérification exige que le HUD affiche exactement le score du serveur, ce qui n'échoue que dans le second cas. Jouée en local en bureau et en mobile: 2 sur 2.

**Quatrième passage, run 34521877123, commit 941323b: vert, sans aucun nouvel essai.**

- « Types, linter et tests »: vert, 1080 tests.
- « Bout en bout »: **10 scénarios sur 10 verts au premier essai**, aucun fragile: fumée, navigation en bureau et en mobile, parcours solo en bureau et en mobile, partie à deux, banc.
- Banc, joué seul: 4,0, 3,8 et 3,0 images par seconde avec lueur à 100, 200 et 500 sprites, pour 1,25, 1,33 et 2,61 ms par image.

Ce passage semblait fermer l'étape. Le suivant a montré que non.

**Cinquième passage, run 34522355452, commit 9f624bd (l'étape 0.3, sans code): rouge**, sur la seule partie à deux, aux trois essais. Les signes vitaux ajoutés au troisième passage donnent enfin la cause:

- **les pages vivent, mais très lentement**: deux à sept images en deux secondes, la dernière vieille de quelques centaines de millisecondes;
- **la boucle du pilote est étouffée**: au deuxième essai, un seul relevé en deux secondes. Chaque contact tactile attend l'accusé de la page, et le pouce en envoyait un pour chaque infime changement d'angle;
- **la partie était finie avant le contact**: au premier essai, la page de Bob montrait déjà l'écran de fin. **C'est l'explication de l'« immobilité » de Bob des passages précédents**: une partie de trente secondes terminée, dans laquelle le serveur ne fait plus bouger personne;
- chaque page répète « GPU stall due to ReadPixels ». **Mesuré en local: aucun appel à `readPixels` depuis la page pendant quinze secondes de partie**, en comptant chaque appel sur les contextes WebGL. Ces relectures sont internes à Chromium quand il dessine sans carte graphique: ni notre code ni PixiJS, aucun défaut du jeu.

**Corrections**, commit 43ad67e:

- une seule partie à la fois en CI (`workers: 1`), pour que deux scénarios de parties ne fassent plus dessiner quatre pages ensemble;
- une partie à deux d'une minute au lieu de trente secondes, et quarante secondes pour aller au contact;
- le pouce n'envoie plus de contact pour un écart d'angle de moins de cinq degrés.

En local: parcours solo en bureau et en mobile, partie à deux, 3 sur 3.

**Sixième passage, run 34523549580, commit 43ad67e: vert, sans aucun nouvel essai.**

- « Types, linter et tests »: vert, 1080 tests.
- « Bout en bout »: une seule partie à la fois (« Running 10 tests using 1 worker »), **10 scénarios sur 10 verts au premier essai**, en 3,3 minutes.
- Banc, joué seul: 4,7, 4,4 et 3,6 images par seconde avec lueur à 100, 200 et 500 sprites, pour 0,99, 1,49 et 2,89 ms par image.

**C'est ce passage qui ferme l'étape.** À surveiller dans les prochaines CI: un échec de la partie à deux dirait désormais, par ses signes vitaux, si la partie était finie, si les pages dessinaient, et si le pilote relisait la situation.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 0.3, cadrage fonctionnel depuis les maquettes. **C'est la section 3 du ROADMAP qui la désigne**: le jalon 1 est fermé, et le jalon 2 enchaîne `0.3` puis `2.4`. La ligne de fin de la fiche 4.4, qui cite l'étape 5.1, suit la numérotation thématique et ne fait pas foi. L'étape 0.3 n'a jamais été exécutée: `docs/design/cadrage.md` n'existe pas.

Quatre points à avoir en tête dès le début:

1. **C'est une étape de documentation, sans code.** Son produit est `docs/design/cadrage.md`, consommé par l'étape 2.4 puis par le jalon 3.
2. **Deux des trois tensions prioritaires de la fiche sont déjà tranchées** par l'étape 4.3: le bouton « Terminer » (tension 7) et l'absence de framework d'interface (tension 8). Les reprendre au journal, ne pas les rouvrir sans raison nouvelle.
3. **Le jeu réel a changé depuis la rédaction de la fiche.** Les bornes des faux ninjas sont celles du serveur, 10 à 150 (`BORNES_REGLAGES`); le panneau de réglages du salon expose tous les réglages de `ReglagesPartie`; le miroir est un réglage de carte. Réconcilier la fiche avec ce qui tourne avant de cadrer.
4. **La fiche demande de lire le handoff de l'étape 0.2**: le handoff qui fait foi sur l'avancement reste celui-ci, le dernier.

## Étape suivante

Fiche à lire: `docs/plan/etape-0-3.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`.
