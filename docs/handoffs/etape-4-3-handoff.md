# Handoff - Étape 4.3 Menus et interface

Date: 10 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Construire les écrans hors jeu et la page qui les assemble, pour relier le joueur au flux accueil, salon, partie et fin de partie. Dans le jalon 1, seuls les écrans du legacy sont construits (section 3 du ROADMAP).

## Ce qui a été fait

- **Le jeu est de nouveau jouable dans un navigateur.** `pnpm dev`, puis http://localhost:3000. C'était la première fois depuis le début de la réécriture.
- **Quatre écrans**: accueil et pseudo, salon, jeu, fin de partie. Ils sont enchaînés par une application qui monte l'écran désigné par l'état et démonte le précédent.
- **La page est empaquetée par esbuild et servie par Express.** Le serveur envoie une politique de sécurité du contenu stricte, et aucune erreur n'apparaît dans la console.
- **L'identité visuelle de la maquette est reprise**: jetons de conception, les trois polices embarquées avec la page, pictogrammes SVG, mise en page. La navigation latérale et tout ce qui est reporté sont absents.
- **La création de partie du jalon 1 est le panneau de réglages du salon.** Il couvre tous les réglages de la partie, carte comprise. La validation à l'écran est la fonction même du serveur, et un test d'intégration le prouve contre un vrai serveur.
- **La faille S1 est fermée.** Tout texte de joueur est posé avec `textContent`, et des tests le vérifient sur le salon, le chat et la fin de partie. La politique de sécurité du contenu s'ajoute par-dessus.
- **Trois manques de l'étape 4.2 rattrapés**, selon la règle 7:
  - la localisation de son ninja: touche F, bouton sur mobile, et automatiquement à l'apparition et après une capture;
  - les annonces en jeu: « Capturé par Bob ! », le bonus ramassé, le malus subi;
  - la manette virtuelle, qui restait visible sans aucun doigt posé.
- **Quatre défauts trouvés et corrigés en route**, détaillés dans « Décisions »:
  - les messages montrés au joueur étaient sans accents ni apostrophes;
  - une connexion perdue s'annonçait comme une connexion en cours;
  - l'accueil laissait redemander à entrer pendant l'attente de la réponse;
  - une fenêtre restait invisible quand son animation d'entrée était suspendue.
- **114 tests ajoutés**: 1080 tests Vitest passent, contre 966 au handoff 4.2. S'y ajoute un scénario Playwright de navigation, joué en cadrage bureau et mobile.

## Écrans construits, et écarts avec la maquette

La fiche demande de les lister. Les maquettes sont des propositions (avertissement de `docs/design/README.md`); les écarts ci-dessous sont voulus.

| Écran    | Repris de la maquette                                                                               | Pas repris, et pourquoi                                                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accueil  | Bannière, titre, accroche, ambiance, trois cartes de règles                                         | Résumé du compte, modes, défis, pass de saison: comptes et progression (3.2, 3.3). Boutons « Créer » et « Parcourir »: matchmaking (2.4).                                                         |
| Salon    | Titre « Salon de … », cartes des joueurs avec initiales et badge d'hôte, chat, lancement par l'hôte | État « prêt », places libres, capacité, code d'invitation: ni le legacy ni le contrat ne les portent (2.4). Niveau des joueurs: 3.3.                                                              |
| Réglages | Choix de la carte avec vignette, curseurs de durée et de faux ninjas, interrupteurs                 | Choix du mode et de la visibilité: un seul mode, pas de parties privées avant 2.4. Bornes des curseurs: celles du serveur (10 à 150 faux ninjas), pas celles de la maquette (10 à 80, tension 4). |
| Jeu      | Temps en haut au centre, classement, effets, minimap, verre flouté                                  | Bouton « Terminer » (tension 7, tranchée): remplacé par Quitter et Pause.                                                                                                                         |
| Fin      | Contexte, « 2e place — Bien joué ! », podium à trois marches, Rejouer et Accueil                    | Expérience, pièces, points de ligue, défi accompli: 3.3. Le classement complet est ajouté, la maquette n'en montrait que le podium.                                                               |

Hors maquette et repris du legacy: l'aide (« Comment jouer » et commandes), le panneau du son avec volumes et coupure, et le compte à rebours annulable par l'hôte.

## Architecture de l'interface

Même principe que le rendu de l'étape 4.2: **ce qui décide est une fonction pure testée sans navigateur, ce qui touche au document ne décide rien.**

```
client.abonner ──> application ──> ecran.afficher(etat)
                     │  monte, démonte selon etat.ecran
                     ├─ sonsDuChangement ──> lecteur (hors partie)
                     └─ annoncesDuChangement ──> fil d'annonces
écran ──> modèle pur (interface/modeles) ──> écriture du document
```

L'application est le **seul abonné** du client. Un écran ne s'abonne jamais: il reçoit l'état, et ne peut donc pas laisser d'abonnement derrière lui.

| Fichier                                                             | Responsabilité                                                        | Pur     |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- |
| `src/principal.ts`                                                  | Point de départ dans le navigateur: fabrique les pièces de production | non     |
| `interface/application.ts`                                          | En-tête, écran affiché, sons de passage, annonces, aide, son          | non     |
| `interface/ecrans/{accueil,salon,jeu,fin}.ts`                       | Les quatre écrans                                                     | non     |
| `interface/composants/{fenetre,chat,reglages,aide,son,annonces}.ts` | Les briques partagées                                                 | non     |
| `interface/modeles/{accueil,salon,fin,reglages,cartes}.ts`          | Ce que chaque écran affiche                                           | oui     |
| `interface/preferences.ts`                                          | Lecture tolérante des réglages du son                                 | oui     |
| `interface/dom.ts`, `icones.ts`                                     | Fabrication d'éléments et de pictogrammes, texte par `textContent`    | non     |
| `src/annonces.ts`                                                   | Les phrases qui disent ce qui vient d'arriver                         | oui     |
| `rendu/localisation.ts`                                             | Les flèches qui désignent notre personnage                            | oui     |
| `scripts/empaqueter.ts`                                             | L'empaqueteur                                                         | non     |
| `page/`                                                             | `index.html`, les feuilles de style, les icônes de la page            | contenu |
| `packages/server/src/fichiers.ts`                                   | Express: la page, `/assets`, la santé, les en-têtes de sécurité       | non     |

## Fichiers créés ou modifiés

Créés, dans `packages/client/`

- `src/principal.ts`, `src/annonces.ts` et son test, `src/rendu/localisation.ts` et son test.
- `src/interface/`: `application.ts`, `dom.ts`, `icones.ts`, `preferences.ts`, `essais.ts` (pièces d'essai des tests, exclues de la compilation), `ecrans/` (quatre écrans et `types.ts`), `composants/` (six composants), `modeles/` (cinq modèles).
- Tests: `interface/application.test.ts` (16, navigation), `ecrans/salon.test.ts` (11), `ecrans/fin.test.ts` (6), `composants/reglages.test.ts` (7), `modeles/accueil.test.ts` (7), `modeles/salon.test.ts` (10), `modeles/fin.test.ts` (8), `modeles/reglages.test.ts` (8), `preferences.test.ts` (4), `annonces.test.ts` (13), `rendu/localisation.test.ts` (5).
- `scripts/empaqueter.ts`, `page/index.html`, `page/styles/` (sept feuilles), `page/favicon.ico` et `page/icones/`.

Créés ailleurs

- `packages/server/src/fichiers.ts` et `fichiers.test.ts` (7 tests, dont le refus des remontées de dossier).
- `tests/client/integration/reglages-serveur.test.ts` (3 tests contre un vrai serveur).
- `tests/e2e/navigation.spec.ts` et `tests/e2e/harnais/serveur-de-jeu.ts`.
- `assets/cartes/<carte>/preview.png`, `assets/sons/button-click.wav`, `assets/sons/menu-music.mp3`, rapatriés de `master`.

Modifiés

- `packages/client/src/etat.ts`, `reduction.ts`: l'état de connexion `perdue` et le champ `entreeEnCours`.
- `rendu/scene.ts`, `rendu/pixi.ts`, `rendu/boucle.ts`, `rendu/apparence.ts`: les flèches de localisation, un calque de repères au-dessus du premier plan, les libellés accentués, la police des libellés de zone.
- `controles/controles.ts`, `touches.ts`, `clavier.ts`: la demande de localisation par F.
- `hud/surcouche.ts`: la manette cachée au montage.
- `sons/lecteur.ts`: deux musiques, menus et partie.
- `src/index.ts`: les exports de l'étape.
- `packages/client/package.json` et `tsconfig.json`: polices Fontsource, esbuild, script `empaqueter`, exclusion de `essais.ts`.
- `packages/shared/src/ressources.ts`, `index.ts` et `ressources.test.ts`: `MUSIQUES` remplace `MUSIQUE_DE_JEU`, le son `clic`, `cheminApercuCarte`.
- `packages/shared/src/validation.ts`, `packages/server/src/ServeurSocket.ts`, `GameRoom.ts`: les motifs accentués.
- `packages/server/src/serveur.ts`, `principal.ts`, `index.ts`, `package.json`: Express, l'option `fichiers`, la variable `CHEMIN_CLIENT`.
- Tests alignés: `client.test.ts`, `reduction.test.ts`, `ecrans.test.ts`, `controles.test.ts`, `boucle.test.ts`, `tests/client/integration/client-serveur.test.ts`.
- `tests/e2e/harnais/compiler.ts`: empaquette le client après la compilation. `serveur-statique.ts`: son commentaire, devenu faux, dit maintenant pourquoi le banc le garde.
- `package.json`: scripts `build` et `dev`, `jsdom`. `.gitignore`, `.prettierignore`, `eslint.config.js`: `packages/client/web/`. `tsconfig.tests.json`: les scripts des paquets.
- `CLAUDE.md`: la section Commandes disait qu'il n'y avait pas de page.
- `docs/plan/etape-4-3.md`: section « Réconciliation » à dix points.
- `docs/design/README.md`: douze décisions du 10 septembre 2026, tensions 7 et 8 marquées.
- `docs/audit/AUDIT-EXISTANT.md`: S1 fermée.
- `assets/README.md`: les nouvelles ressources, et ce qui n'est pas repris.

Aucune modification de `packages/sim`, `legacy/` ni `tests/caracterisation/`.

## Tests

- Ajoutés: 114 tests Vitest et un scénario Playwright.
  - **Navigation entre écrans**: `interface/application.test.ts`, sur l'application entière dans un document, avec l'écran de jeu remplacé par une pièce d'essai. Il couvre l'accueil, le salon, le jeu, la fin, Rejouer, Accueil, la perte de connexion, les sons, les annonces et l'aide.
  - **Formulaire de création**: `composants/reglages.test.ts` vérifie qu'une configuration invalide est signalée sur son champ et ne part pas. `tests/client/integration/reglages-serveur.test.ts` vérifie que le vrai serveur refuse la même configuration avec **exactement** les mêmes erreurs.
  - **Salon**: `ecrans/salon.test.ts` couvre les joueurs, le badge d'hôte, le lancement et l'annulation réservés à l'hôte, le chat, et les pseudos posés comme du texte.
  - **Fin**: `ecrans/fin.test.ts` vérifie que chaque cellule du classement affiché égale le classement reçu.
  - **Bout en bout**: `tests/e2e/navigation.spec.ts` parcourt la vraie page sur le vrai serveur: pseudo refusé puis accepté, réglages refusés puis enregistrés, chat, lancement, partie PixiJS, retour à l'accueil, **et aucune erreur de console**.
- Résultat: **1080 tests Vitest passent, 0 échec**. **7 scénarios Playwright passent**: les 4 de fumée, la navigation en cadrage bureau et mobile, et le banc de mesure du rendu, qui reste à 59,2, 60,1 et 60,0 images par seconde avec lueur à 100, 200 et 500 sprites sur carte graphique, pour un coût de notre code de 0,49, 0,37 et 1,58 ms par image. Le calque de repères ajouté au rendu n'a rien changé à la cadence.
- Couverture: **99,74 pour cent** sur `packages/sim` et `packages/shared`, inchangée.
- Types, linter, formatage: verts. `pnpm verify` passe.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.
- CI: en attente au moment du commit de l'étape; son résultat est confirmé dans le commit qui suit.

**Vérifié à la main dans un vrai navigateur**, sur le serveur lancé par `principal.ts`: l'accueil; le salon; le panneau de réglages; le compte à rebours; une partie avec HUD, flèches de localisation et libellés de zone; la confirmation de sortie; une partie de trente secondes jusqu'à l'écran de fin; Rejouer vers un salon neuf; le salon en fenêtre mobile de 375 pixels. C'est cette vérification qui a trouvé la fenêtre invisible et le chevauchement du rappel des touches.

## Décisions et écarts au plan

Les décisions de fond sont au journal de `docs/design/README.md`, datées du 10 septembre 2026. Les écarts à la fiche sont dans sa section « Réconciliation ». Huit points méritent d'être lus ici.

### 1. Le jalon 1 construit quatre écrans, et la création est un panneau du salon

Le ROADMAP fait foi sur la fiche. Le navigateur de parties et la création arrivent avec l'étape 2.4, le profil et la fin enrichie avec l'étape 3.3.

Le panneau de réglages se dessine à partir d'une description unique, `interface/modeles/reglages.ts`, qu'un test confronte à `REGLAGES_PAR_DEFAUT`: un réglage ajouté au contrat sans champ fait échouer ce test.

### 2. La validation du client est celle du serveur, pas une copie

Le formulaire convertit la saisie en réglages **sans rien corriger**: un champ vide devient un nombre invalide, `12.5` reste `12.5`. Puis il appelle `validerReglages`.

Deux conséquences:

- **à l'écran**, le motif est exactement celui du serveur;
- **sur le réseau**, une valeur invalide envoyée quand même est sérialisée en `null` et refusée avec le même motif, ce que le test d'intégration vérifie.

### 3. esbuild et Express, et une politique de sécurité du contenu

**L'empaqueteur lit les sources des paquets**, pas leur compilation, pour ne jamais embarquer un `dist` périmé.

**Express sert la page et `assets/`.** Sans l'option `fichiers`, un serveur ne sert aucun fichier: c'est le cas de tous les tests, comme pour les murs.

**La politique de sécurité du contenu** interdit tout ce qui ne vient pas du serveur, ainsi que l'évaluation de code; PixiJS est chargé avec `pixi.js/unsafe-eval`. Le scénario de bout en bout échoue sur toute erreur de console, donc sur tout blocage par cette politique.

### 4. L'état du client gagne `perdue` et `entreeEnCours`

**Trouvé par le test de navigation.** Quand la connexion tombait dans le salon, l'application montait un accueil neuf, qui ne savait pas que le lien avait existé: il affichait « Connexion au serveur… » au lieu de proposer de recharger. L'information vivait dans l'écran, qui disparaît justement à ce moment-là. Elle est maintenant dans l'état.

**Même raisonnement pour `entreeEnCours`.** Rejouer quitte la partie finie, passe un instant par l'accueil et redemande à entrer. Sans ce champ, l'accueil de cet instant aurait laissé envoyer une seconde demande, que le serveur aurait refusée.

### 5. Rejouer ouvre un nouveau salon

Le retour au salon n'existe pas (handoff 2.1). Rejouer mène au premier salon en attente, où se retrouvent les joueurs qui rejouent ensemble.

### 6. Tension 7 tranchée: pas de bouton « Terminer »

L'écran de jeu propose **Quitter**, pour soi et après confirmation, et **Pause**, réservée à l'hôte.

### 7. Les manques de l'étape 4.2, rattrapés

- **La localisation** reprend les flèches, distances et durées du legacy. Un repérage est une date de fin, sans minuterie.
- **Les annonces** passent par un seul mécanisme (`annonces.ts`), avec les textes du legacy, et s'effacent par une animation de feuille de style plutôt que par des `setTimeout`.
- **La manette virtuelle** est cachée tant qu'aucun doigt ne la tient. Aucune page n'affichait le HUD à l'étape 4.2, si bien que personne ne l'avait vue.

### 8. Deux défauts trouvés en regardant la page

- **Une fenêtre pouvait rester invisible.** Son animation d'entrée partait d'une opacité nulle, et le navigateur de vérification la laissait suspendue à son instant zéro. Mesuré par `document.getAnimations()`, pas supposé. Plus aucune apparition ne passe par l'opacité.
- **Le rappel des touches chevauchait le temps restant** sous 1100 pixels de large. Il y est masqué; les touches restent décrites dans l'aide.

Et un défaut de fond, trouvé dès que la page a affiché des messages: **les motifs de validation et de refus étaient écrits sans accents ni apostrophes**, par exemple « Un pseudo n accepte que ». Ils sont destinés au joueur. Corrigés dans `validation.ts`, `ServeurSocket.ts` et `GameRoom.ts`; aucun test n'en dépendait.

### Ce que cette étape rend structurellement impossible

- **Un texte de joueur ne peut plus devenir du balisage.** L'interface ne contient aucun `innerHTML`, et la page refuserait de toute façon d'exécuter un script injecté.
- **Le client ne peut plus valider autrement que le serveur.** C'est la même fonction.
- **Un écran quitté ne peut plus laisser d'écoute, de boucle ou de GPU derrière lui.** Il est démonté, et il n'a jamais été abonné.
- **Un réglage ne peut plus exister d'un côté du salon et pas de l'autre.** Le formulaire se dessine à partir de la structure des réglages, et un test les confronte.
- **Une annonce ne peut plus survivre à l'écran qui l'a posée par une minuterie oubliée.** Il n'y a pas de minuterie.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **`interface/ecrans/jeu.ts` n'est couvert que par le scénario de bout en bout**, faute de GPU dans les tests unitaires. L'application est testée avec un écran de jeu d'essai.
- **L'écran de fin n'est pas joué de bout en bout**: une partie dure au moins trente secondes. Il est couvert dans un document, et vérifié à la main. L'étape 4.4, qui joue des parties entières, peut l'ajouter.
- **`app.js` pèse 684 Ko minifié**, dont l'essentiel est PixiJS. Pas de découpage en morceaux: une seule page, chargée une fois. À mesurer en 5.2 si le temps de chargement sur mobile le justifie.
- **La connexion Socket.IO passe par `connect-src 'self'`**, que les navigateurs actuels appliquent aussi aux WebSockets. Un navigateur ancien qui ne le ferait pas refuserait la connexion. La compatibilité des navigateurs n'a pas été mesurée: à faire avant le déploiement (5.3).
- **Le script d'empaquetage est lancé par Node sans compilation préalable**, grâce à l'effacement des types: il faut Node 22.18 ou plus récent. Le dépôt en exige 22 et utilise 24, en local comme en CI.
- **`.claude/launch.json`**, qui sert à l'aperçu du navigateur de Claude Code, est exclu localement par `.git/info/exclude` et n'est pas versionné.
- **L'icône de la page est celle du legacy**, alors que le logo de l'en-tête reprend le 忍 de la maquette. À harmoniser le jour où un vrai logo existe.

Repris du handoff 4.2, inchangé:

- Sans identifiant de partie, on entre dans la première qui attend. Provisoire, étape 2.4.
- Le retour au salon après une partie n'existe pas: Rejouer ouvre un nouveau salon.
- Aucune reconnexion (3.2), aucune capacité maximale par partie (2.4), aucune mesure de charge (5.1).
- La CI ne valide pas la cadence du rendu, faute de carte graphique.
- `tsc --build` peut laisser une compilation périmée; `tsc --build --force` corrige. L'empaqueteur, lui, lit les sources et n'y est plus sensible.
- `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`.

Fermé par cette étape: **la page n'est plus une dette**, le jeu est jouable dans un navigateur. `surcouche.ts` et `tactile.ts` tournent enfin dans une vraie page.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 4.4, bout en bout multi-clients. Lire `docs/plan/etape-4-4.md` et la réconcilier avec la section 3 du ROADMAP, qui l'adapte au jalon 1: **ni inscription ni progression**, deux clients dans la même partie, une capture, un score cohérent, et un test de fumée en fenêtre mobile.

Quatre points à avoir en tête dès le début:

1. **Le harnais existe.** `tests/e2e/harnais/serveur-de-jeu.ts` monte le vrai serveur sur un port libre, avec murs, page et ressources. Il en faut un par scénario: sans code de partie, deux scénarios parallèles sur un même serveur se retrouveraient dans le même salon.
2. **Deux clients se retrouvent dans le même salon sans rien faire de plus.** Il suffit que le premier entre, puis le second: la règle provisoire du « premier salon en attente » les y réunit. Le second n'est pas hôte, et seul le premier peut lancer.
3. **Provoquer une capture demande une idée, et c'est la première question de l'étape.** Les positions d'apparition sont tirées au sort par le serveur, le terrain est un canevas, et l'état du client n'est exposé nulle part à la page: un scénario ne peut pas lire où se trouvent les joueurs. Pour une partie courte, la durée minimale est de 30 secondes (`BORNES_REGLAGES.dureePartieS`), et le panneau de réglages se pilote par `[data-chemin="…"]`.
4. **Le scénario de navigation tourne déjà en cadrage mobile (Pixel 7).** La fumée mobile de 4.4 peut s'appuyer dessus plutôt que de le dupliquer.

## Étape suivante

Fiche à lire: `docs/plan/etape-4-4.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 4.4 ferme le jalon 1.
