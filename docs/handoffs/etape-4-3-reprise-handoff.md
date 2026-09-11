# Handoff - Étape 4.3, reprise du jalon 3: écrans des parties et des comptes

Date: 11 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Donner au joueur, dans la page, tout ce que les étapes 2.4, 3.2 et 3.3 ont construit côté serveur: parcourir et créer des parties, se connecter à un compte, voir sa progression à la fin d'une partie et dans son profil. Cette étape ferme le jalon 3.

## Ce qui a été fait

- **La fiche a été rédigée d'abord**, selon le cas de repli du PROTOCOLE: `docs/plan/etape-4-3-reprise.md`, commitée avant l'exécution (8ad1b35). Le ROADMAP y renvoie.
- **Lot A, la session de compte côté client** (51e55e9): requêtes des comptes derrière une interface, jeton gardé par le navigateur, lien du jeu ouvert avec la session, refus du lien dit à l'écran, écran de connexion et d'inscription, compte dans l'en-tête.
- **Lot B, la fin de partie enrichie** (97b84fb): `progressionDeFin` écouté; XP, barre de niveau, passage de niveau, pièces, points de ligue et palier; l'en-tête suit.
- **Lot C, le profil** (5e83f77): route `GET /api/comptes/profil`, statistiques déduites de tout l'historique par une requête d'agrégat, écran du profil, déconnexion.
- **Lot D, les parties** (07d6b57): liste des parties publiques, entrée par code, écran de création, salon étendu (visibilité, code avec copie, places libres), navigation latérale, « Partie rapide ».
- **Lot E, le bout en bout** (7f36784): scénario des parties (privée par code, publique par la liste) et scénario du compte (de l'inscription à la déconnexion), sur un serveur de scénario doté de comptes en mémoire.
- **Un défaut de l'étape 4.3 trouvé et corrigé** (règle 7): la politique de sécurité du contenu faisait conclure à PixiJS qu'un travailleur ne savait pas décoder les images. Voir « Décisions », point 4.
- **Vérifié dans un vrai navigateur**: accueil, connexion, création en fenêtre étroite avec la navigation en barre, salon d'une partie publique, puis une partie lancée, textures chargées, sans aucune erreur de console.

## Écrans construits, et écarts avec la maquette

Les maquettes sont des propositions (avertissement de `docs/design/README.md`); les écarts ci-dessous sont voulus, et tous tranchés par le cadrage ou le journal.

| Écran      | Repris de la maquette                                                                       | Pas repris, et pourquoi                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| En-tête    | Pièces, anneau de niveau, pseudo et palier, qui mènent au profil                            | Gemmes (reportées avec une boutique). Hors partie seulement cliquable.                                       |
| Navigation | Jouer, Parties, Créer, Profil, barre lumineuse de l'entrée courante                         | Logo dans la barre (il reste dans l'en-tête). Masquée pendant une partie; en barre basse sous 760 pixels.    |
| Accueil    | « Partie rapide », « Créer une partie », « Parcourir »                                      | Bandeau de saison, défis, pass, grille des modes: reportés.                                                  |
| Connexion  | Sans équivalent dans la maquette                                                            | Construit sur l'identité visuelle: onglets connexion et inscription, « Continuer en invité ».                |
| Parties    | Code privé et « Joindre », « Créer », salons avec hôte, mode, carte, joueurs, « Rejoindre » | Latence, compteur de joueurs en ligne, filtres de mode, statut « en jeu » (cadrage).                         |
| Création   | Mode (Classique, tuile « à venir »), carte, visibilité, réglages, récapitulatif sticky      | Cinq tuiles de mode et Shibuya Cross. Tous les réglages du contrat, pas seulement ceux de la maquette.       |
| Salon      | Visibilité, code et bouton de copie, places libres                                          | État « prêt » (cadrage); emplacements vides dessinés: les places libres sont dites en texte.                 |
| Fin        | « +XP », barre de niveau, pièces, points de ligue                                           | Défi accompli (reporté). Ajouts: passage de niveau, changement de palier, attente et échec d'enregistrement. |
| Profil     | Avatar, pseudo, badge de palier, barre d'XP, statistiques, dernières parties                | Pass, skins, succès, clan, rang mondial, ratio, série, temps de jeu (cadrage).                               |

## Le flux de la session, du démarrage à la déconnexion

```
démarrage ──> jeton gardé ?
               non ──────────────────────────────> ouvrir le lien en invité
               oui ──> GET /moi ──> accepté ─────> session de compte, ouvrir avec le jeton
                                └─> 401 ─────────> oublier le jeton, invité « session expirée », ouvrir
                                └─> sans réponse ─> ouvrir avec le jeton; relire /moi une fois le lien établi
lien refusé ──> accueil: motif, « Réessayer », « Continuer en invité » (le jeton est oublié, la session serveur reste)
connexion ou inscription ──> POST ──> GET /moi ──> garder le jeton ──> rouvrir le lien avec lui
déconnexion (profil) ──> oublier le jeton ──> rouvrir en invité ──> POST /deconnexion
```

Rien ne change de session pendant une partie: rouvrir le lien ferait sortir le joueur de son salon. Le jeton n'entre jamais dans l'état du client; seul le coffre (`comptes/coffre.ts`) le connaît.

## Architecture ajoutée au client

Même principe que depuis l'étape 4.2: ce qui décide est pur et testé sans navigateur, ce qui touche au document ne décide rien.

| Fichier                                                                                         | Responsabilité                                                            | Pur |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --- |
| `comptes/api.ts`                                                                                | Requêtes des comptes par `fetch`, et leur version d'essai; aucune ne lève | non |
| `comptes/coffre.ts`                                                                             | Jeton dans le stockage local, en mémoire si refusé                        | non |
| `comptes/session.ts`                                                                            | Démarrage, connexion, inscription, déconnexion, profil                    | non |
| `interface/modeles/{connexion,entete,progression,profil,parties,creation,navigation,pseudo}.ts` | Ce que chaque écran affiche                                               | oui |
| `interface/ecrans/{connexion,profil,parties,creation}.ts`                                       | Les quatre nouveaux écrans                                                | non |
| `interface/composants/{compte,navigation,champPseudo}.ts`                                       | En-tête, navigation, champ du pseudo d'invité                             | non |
| `interface/composants/reglages.ts`                                                              | Le formulaire des réglages, et le panneau du salon qui le contient        | non |

Le transport s'ouvre désormais sur demande: `Reseau.ouvrir(authentification)`, `surRefus(motif)`; une fermeture volontaire ne déclenche pas `surDeconnexion`.

## Fichiers créés ou modifiés

Quatre-vingt-dix fichiers, dont quarante-trois créés. Le détail de chaque lot est dans son message de commit; l'essentiel ici.

Créés, `packages/client`

- `src/comptes/api.ts`, `coffre.ts`, `session.ts` et leurs tests (`api.test.ts`, `coffre.test.ts`, `session.test.ts`, `session.profil.test.ts`).
- `src/interface/modeles/connexion.ts`, `entete.ts`, `progression.ts`, `profil.ts`, `parties.ts`, `creation.ts`, `navigation.ts`, `pseudo.ts`, et les tests des six premiers.
- `src/interface/ecrans/connexion.ts`, `profil.ts`, `parties.ts`, `creation.ts`, et leurs tests; `ecrans/fin.progression.test.ts`.
- `src/interface/composants/compte.ts`, `navigation.ts`, `champPseudo.ts`.
- `src/interface/application.comptes.test.ts`, `application.navigation.test.ts`, `src/reduction.session.test.ts`.

Créés, ailleurs

- `tests/outils/comptes-en-memoire.ts`: un service de comptes pour les tests qui montent un vrai serveur sans base.
- `tests/client/integration/comptes-serveur.test.ts`, `creation-serveur.test.ts`.
- `tests/base/profil.test.ts`: la route du profil contre Neon.
- `tests/e2e/parties.spec.ts`, `compte.spec.ts`.
- `docs/plan/etape-4-3-reprise.md`, `docs/handoffs/etape-4-3-reprise-handoff.md`.

Modifiés, `packages/client`

- `src/reseau.ts`, `reseauSocketIo.ts`: lien ouvert sur demande, avec ou sans jeton; refus du lien.
- `src/etat.ts`, `actions.ts`, `reduction.ts`, `ecrans.ts`, `client.ts`: session, refus du lien, demande de compte, profil, progression de fin, pseudo saisi, liste en cours, écrans de menu et navigation.
- `src/principal.ts`: comptes par HTTP, coffre du navigateur, ouverture du lien après le montage.
- `src/interface/application.ts`: en-tête du compte, navigation, quatre écrans de plus.
- `src/interface/ecrans/accueil.ts`, `fin.ts`, `salon.ts`; `modeles/accueil.ts`, `fin.ts`, `salon.ts`; `composants/reglages.ts` (formulaire extrait du panneau); `icones.ts` (neuf pictogrammes); `index.ts`.
- `page/styles/base.css`, `ecrans.css`.
- Tests alignés: `modeles/accueil.test.ts`, `modeles/fin.test.ts`, `modeles/salon.test.ts`, `ecrans/salon.test.ts`, `application.test.ts`, `parties.test.ts`.

Modifiés, `packages/shared` et `packages/server`

- `shared/src/comptes.ts`, `index.ts`: `ROUTES_COMPTES.profil`, `ProfilDuCompte`, `StatistiquesDuCompte`, `PartieDuProfil`, `PARTIES_DU_PROFIL`, `JOUEURS_POUR_UNE_VICTOIRE`.
- `server/src/base/parties.ts`: `statistiquesDuCompte`.
- `server/src/comptes/annuaire.ts`, `Authentification.ts`, `routes.ts`: le profil; `routes.test.ts`, `ServeurSocket.comptes.test.ts`.
- `server/src/fichiers.ts`: `connect-src 'self' data:`.
- `server/src/index.ts`: exports.

Modifiés, ailleurs

- `tests/client/integration/client-serveur.test.ts`, `parties-serveur.test.ts`, `reglages-serveur.test.ts`: le lien s'ouvre par `client.ouvrir()`.
- `tests/e2e/harnais/serveur-de-jeu.ts` (comptes), `harnais/parcours.ts` et `navigation.spec.ts` (« Partie rapide »), `playwright.config.ts` (nouveaux scénarios en bureau).
- `docs/plan/ROADMAP.md`, `docs/design/README.md` (douze décisions), `docs/design/cadrage.md` (statut des écrans), `CLAUDE.md`.

Aucune modification de `packages/sim`, `legacy/` ni `tests/caracterisation/`. Aucune migration: le schéma de la base n'a pas changé.

## Tests

- Ajoutés, par exigence de la fiche:
  - **navigation entre les écrans**: `application.navigation.test.ts` (navigation latérale, aucun écran de menu pendant une partie, pseudo d'invité qui suit), `application.comptes.test.ts` (en-tête, connexion, lien refusé, session expirée), `ecrans/profil.test.ts`;
  - **formulaire de création**: `modeles/creation.test.ts` et `ecrans/creation.test.ts` (configuration invalide signalée sur son champ, rien ne part), et `tests/client/integration/creation-serveur.test.ts`, qui confronte l'écran à un vrai serveur: même refus, mêmes motifs, mêmes champs; création acceptée telle que l'écran la prépare;
  - **navigateur**: `modeles/parties.test.ts`, `ecrans/parties.test.ts` (liste affichée égale à la liste reçue, rejoindre par la liste et par un code, code mal formé refusé avant l'envoi, refus du serveur affiché, état vide, actualiser);
  - **salon**: code affiché pour une partie privée seulement, copie et refus de copie, places libres (`modeles/salon.test.ts`, `ecrans/salon.test.ts`);
  - **fin de partie**: `modeles/fin.test.ts` et `ecrans/fin.progression.test.ts` (affichage égal au récapitulatif, partie non enregistrée, invité sans progression, en-tête mis à jour);
  - **session du client**: `comptes/session.test.ts`, `session.profil.test.ts`, `api.test.ts`, `coffre.test.ts`, `reduction.session.test.ts`, `modeles/connexion.test.ts`, `ecrans/connexion.test.ts`, et `tests/client/integration/comptes-serveur.test.ts` contre un vrai serveur (jeton rendu par une route accepté par Socket.IO, jeton inconnu refusé des deux côtés, serveur injoignable);
  - **route du profil**: `routes.test.ts` (traduction) et `tests/base/profil.test.ts` contre Neon (profil vide, statistiques sur tout l'historique, dix dernières parties, victoire en solo non comptée, route refusée sans session);
  - **bout en bout**: `parties.spec.ts` (deux scénarios) et `compte.spec.ts`.
- Résultat: **1 427 tests unitaires sur 1 427** (98 fichiers; 1 261 et 78 au handoff 3.3). **Tests de la base**: le nouveau fichier, 4 sur 4 contre Neon en local; la suite entière tourne en CI. **13 scénarios de bout en bout sur 13**: les 10 existants, sans perte de ce qu'ils vérifient, et les 3 nouveaux.
- Banc de mesure du rendu, joué seul en fin de suite: 59,2, 60,0 et 60,0 images par seconde avec lueur à 100, 200 et 500 sprites, pour 0,34, 0,37 et 1,09 ms par image.
- Couverture de `packages/sim` et `packages/shared`: **99,77 pour cent**, inchangée.
- Types (par `tsc`, sans filtre: paquets, tests et bout en bout), linter et formatage: verts. Caractérisation: non touchée, verte dans la suite unitaire.
- État de la CI: voir « État de la CI ».

## Décisions et écarts au plan

Douze décisions au journal du README, datées du 11 septembre 2026. Les écarts à la fiche sont dans sa section « Réconciliation pendant l'étape ». Quatre points à lire ici.

### 1. Le lien du jeu s'ouvre sur demande

Le serveur identifie le compte à l'ouverture du lien (étape 3.2). Le transport ne s'ouvre donc plus à sa création: `client.ouvrir()` vérifie d'abord la session gardée, puis ouvre. Les trois tests d'intégration qui montaient un client l'appellent désormais. Un lien rouvert pour changer de session n'est pas une perte de connexion.

### 2. « Continuer en invité » n'est pas une déconnexion

Le refus d'un lien peut venir d'une base momentanément injoignable (« La session n'a pas pu être vérifiée »). Continuer en invité oublie le jeton sans fermer la session côté serveur; se déconnecter, depuis le profil, la ferme.

### 3. Les lectures partent de la navigation, pas du montage d'un écran

La première version lisait le profil au montage de son écran. Un changement d'état au milieu d'un montage est remis à l'écran qu'on quitte, l'application n'ayant pas encore remplacé sa référence. `client.naviguer` lance donc la lecture du profil, ou de la liste des parties, juste après la navigation.

### 4. Défaut de l'étape 4.3: la politique de sécurité bloquait un test de PixiJS

Trouvé en regardant la console du navigateur de vérification pendant une partie: deux erreurs « Refused to connect » sur une image `data:` de un pixel. PixiJS la lit dans un travailleur (`checkImageBitmap.worker`) pour savoir s'il peut décoder les textures hors de la page; bloquée par `connect-src 'self'`, la lecture lui faisait conclure que non, et il décodait dans la page. `connect-src` accepte désormais `data:`, qui ne sort pas du navigateur. Vérifié ensuite dans une vraie partie: aucune erreur. **Pourquoi aucun scénario ne l'a vu**: ces erreurs sont écrites dans la console du travailleur, que Playwright ne relaie pas à `page.on('console')`. Voir « Problèmes connus ».

### Ce que cette étape rend structurellement impossible

- **Un joueur qui se croit connecté ne peut plus jouer en invité sans le savoir**: un lien refusé s'arrête à l'accueil et le dit, et le choix de continuer en invité est explicite.
- **Le jeton ne peut pas fuir par l'état du client**, ses journaux ou ses tests: il n'y entre pas.
- **Une partie ne peut pas se créer avec un réglage que le salon ne saurait pas changer**: c'est le même formulaire, et la même validation que le serveur.
- **Un compte ne peut plus envoyer de pseudo à la place du sien**: aucune demande d'un compte n'en porte.
- **La progression affichée ne peut pas diverger de celle écrite en base**: la fin et le profil montrent ce que le serveur a rendu, et l'en-tête le suit.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **Les erreurs d'un travailleur échappent aux scénarios de bout en bout.** `releverLesErreurs` n'écoute que la console de la page. Le défaut du point 4 n'a été trouvé qu'à la main. À l'étape 5.3, avant le déploiement, vérifier la console d'une partie dans un vrai navigateur; ou chercher un moyen fiable de relever la console des travailleurs.
- **Continuer en invité laisse la session ouverte côté serveur** jusqu'à son expiration, trente jours. Voulu (point 2), mais un jeton volé resterait utilisable jusque-là; la déconnexion, elle, ferme.
- **Une déconnexion dans un onglet ne touche pas un autre onglet déjà ouvert**: sa connexion réseau reste celle du compte (déjà noté à l'étape 3.2), et son en-tête aussi, jusqu'au rechargement.
- **La liste des parties ne se rafraîchit pas d'elle-même**: une photographie, redemandée à chaque arrivée et sur « Actualiser ». Une partie pleine entre-temps refuse l'entrée, et le refus s'affiche.
- **La copie du code demande un contexte sécurisé**: servie en HTTP hors de la machine locale, la page ne peut pas écrire dans le presse-papiers; le joueur l'apprend, et le code reste sélectionnable. Sans objet en production (HTTPS).
- **Les tests qui utilisent les comptes en mémoire lisent les paquets compilés** (`tests/outils/comptes-en-memoire.ts`, pour servir aussi au bout en bout). En local, compiler avant (`pnpm build` ou `pnpm typecheck`); la CI compile avant les tests.
- **Ni création, ni connexion, ni profil ne sont joués en fenêtre mobile de bout en bout.** Le scénario de navigation traverse l'accueil et le salon en mobile; la navigation en barre a été vue à la main.
- **Aucun changement de mot de passe, oubli de mot de passe, ni suppression de compte.** Hors périmètre.
- **`app.js` pèse désormais 739 Ko minifié, 220 Ko compressé** (684 Ko minifié au handoff 4.3). Toujours sans découpage; la mesure du chargement sur mobile reste à l'étape 5.2.

Repris des handoffs précédents, inchangé: un échec d'enregistrement de fin de partie n'est pas retenté; un compte supprimé pendant une partie ferait échouer l'enregistrement de toute la partie; l'extinction attend les enregistrements sans délai maximal propre; les limites de tentatives vivent en mémoire de l'instance; au déploiement (5.3), poser `MANDATAIRES_DE_CONFIANCE` et `ORIGINES_AUTORISEES`; une session fermée ne coupe pas une connexion réseau déjà ouverte; un même compte peut être dans deux parties à la fois. Le reste: voir le handoff 4.4.

Fermé par cette étape:

- **le client sait se connecter à un compte et afficher la progression** (handoff 3.3);
- **le profil a sa route HTTP** (handoff 3.3);
- **les écrans pour créer, lister et rejoindre par code existent** (handoff 2.4);
- **le salon affiche la capacité, les places libres et le code** (réconciliation de la fiche 4.3, point 4).

## État de la CI

**Verte** sur le dernier commit de code, `7f36784` (lot E): exécution GitHub Actions 34627745998, sur `reecriture`.

- « Types, linter et tests »: réussi, en 1 min 42 s. Il comprend la suite unitaire, la couverture et les tests de la base contre une branche Neon neuve, dont le nouveau `tests/base/profil.test.ts`.
- « Bout en bout »: réussi, en 4 min 50 s, avec les trois nouveaux scénarios.

Ce handoff ne touche que la documentation; sa propre exécution est à confirmer comme les précédentes.

`master` n'a pas été touché. Aucune fusion de `reecriture` avant l'étape 6.1.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 5.1, tests de charge serveur. C'est la section 3 du ROADMAP qui la désigne: le jalon 3 est fermé, et le jalon 4 enchaîne `5.1` puis `5.2`, l'étape `2.3` (delta binaire) n'étant faite que si la mesure de `5.1` la justifie.

Quatre points à avoir en tête dès le début:

1. **Lire la fiche `docs/plan/etape-5-1.md` et la réconcilier** avec l'état du dépôt: plusieurs parties par serveur (2.4), des comptes et un enregistrement en base à chaque fin de partie (3.3), une page complète (jalon 3). Son rituel de début cite un handoff 2.3 qui n'existe pas: l'étape 2.3 n'a pas été faite, elle dépend justement de cette mesure.
2. **Ce qui se mesure**: le temps d'un battement par partie peuplée de plus de 100 bots, avec N parties sur un serveur, et la taille du flux d'état JSON par battement. C'est cette taille qui décide de l'étape 2.3.
3. **Les bornes actuelles sont à confronter à la mesure**: 150 bots au plus au démarrage d'une partie (`BORNES_REGLAGES.nombreBotsInitial`) et 12 joueurs par partie (`CAPACITES`). La fiche vise « plus de 100 bots »: la mesure dira si ces bornes tiennent, pas cette étape.
4. **Le serveur se monte sans base ni murs par défaut** (`creerServeur`): une mesure réaliste fournit les murs (`ChargeurDeTerrain`), et dit si elle compte l'enregistrement de fin de partie.

## Étape suivante

Fiche à lire: `docs/plan/etape-5-1.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`.
