# Handoff - Étape 3.4 Gestion du mot de passe

Date: 15 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Un joueur change son mot de passe depuis son profil, en fermant ses autres sessions, et retrouve l'accès à un compte dont il a oublié le mot de passe.

## Ce qui a été fait

- **Décision du porteur du projet au début de l'étape**: pour le mot de passe oublié, un **code de secours**, parmi quatre voies présentées (code de secours, réinitialisation manuelle, courriel facultatif, rien).
- **Fiche rédigée au début de la session** (`docs/plan/etape-3-4.md`, commit `42f846a`), selon le cas de repli du PROTOCOLE.
- **Le code de secours**: seize caractères de l'alphabet de Crockford (80 bits tirés par le serveur), affichés en quatre groupes, saisie tolérante (casse, espaces, tirets, O pour 0, I et L pour 1). La base n'en garde que l'empreinte SHA-256, dans la table `codes_de_secours` (migration `0003_codes_de_secours`). Un nouveau code accompagne chaque nouveau mot de passe (inscription, changement, réinitialisation) et annule le précédent; un nouveau code se demande aussi depuis le profil contre le mot de passe actuel, chemin des comptes créés avant l'étape.
- **Le changement de mot de passe** (`POST /api/comptes/mot-de-passe`): exige le mot de passe actuel même avec une session; remplace le mot de passe et le code, et ferme toutes les autres sessions, en une transaction; la session qui demande reste ouverte. Mot de passe actuel faux: 403, pas 401.
- **La réinitialisation** (`POST /api/comptes/reinitialisation`): pseudo, code et nouveau mot de passe, sans session. Ferme toutes les sessions et en ouvre une neuve. Pseudo inconnu, compte sans code et code faux: même réponse. Code à usage unique, garanti par la base.
- **Le nouveau code depuis le profil** (`POST /api/comptes/code-de-secours`), contre le mot de passe actuel, sans fermer de session.
- **Les tentatives**: chaque vérification d'un secret passe par les deux seaux de la connexion (compte et adresse).
- **Les connexions de jeu d'une session fermée sont coupées**: l'annuaire prévient la couche réseau (`surSessionsFermees`), qui revérifie la session de chaque connexion du compte et coupe celles qui n'ouvrent plus rien. Résout la dette du handoff 3.2.
- **Côté client**: l'écran de connexion a un troisième temps, « Mot de passe oublié ? »; le profil a une section « Sécurité » à deux formulaires; une fenêtre montre le code émis par-dessus n'importe quel écran, et la fermer vaut « noté ».
- **Documentation**: cinq décisions au journal de `docs/design/README.md`, cadrage (table du code), ROADMAP (étape terminée, décision reportée à l'entrée 3.4), grille de recette 5.4, CLAUDE.md (comptes branchés avec `DATABASE_URL`).

## Fichiers créés ou modifiés

Commit `42f846a`: `docs/plan/etape-3-4.md` (créé), la fiche.

Commit de la gestion du mot de passe:

- `packages/shared/src/bornes.ts`: `BORNES_CODE_DE_SECOURS`.
- `packages/shared/src/comptes.ts`: trois routes, `CodeDeSecoursEmis`, `SessionInscrite`, `DemandeChangementMotDePasse`, `DemandeCodeDeSecours`, `DemandeReinitialisation`.
- `packages/shared/src/validation.ts`: `validerCodeDeSecours`, `formaterCodeDeSecours`, les trois validateurs de demandes; `validerMotDePasse` nomme son champ; la règle du mot de passe tapé pour se prouver, extraite de la connexion.
- `packages/shared/src/comptes.test.ts`, `index.ts`.
- `packages/server/src/base/schema.ts`: table `codesDeSecours`. `packages/server/migrations/0003_codes_de_secours.sql` et `meta/` (écrits par drizzle-kit).
- `packages/server/src/base/secrets.ts` (créé): lire les secrets d'un compte, remplacer le mot de passe, consommer le code, remplacer le code.
- `packages/server/src/base/comptes.ts`: le code écrit avec le compte.
- `packages/server/src/comptes/codeDeSecours.ts` et test (créés): fabrication et empreinte.
- `packages/server/src/comptes/Authentification.ts`: `changerMotDePasse`, `nouveauCodeDeSecours`, `reinitialiser`, `surSessionsFermees`, le code à l'inscription, les seaux partagés.
- `packages/server/src/comptes/annuaire.ts`: motif `motDePasseIncorrect`, écoute des sessions fermées, trois méthodes du service.
- `packages/server/src/comptes/routes.ts` et test: trois routes, 403.
- `packages/server/src/ServeurSocket.ts`: jeton gardé par connexion, coupure des sessions fermées. `ServeurSocket.comptes.test.ts`: annuaire d'essai et cinq tests.
- `packages/server/src/index.ts`: exports.
- `packages/client/src/comptes/api.ts` et test: trois requêtes, code dans l'inscription, version d'essai.
- `packages/client/src/comptes/session.ts`: réinitialisation, demandes du profil, code émis, `noterLeCodeDeSecours`. `session.motDePasse.test.ts` (créé); `session.test.ts` adapté.
- `packages/client/src/etat.ts`, `actions.ts`, `reduction.ts`: natures de demandes, `acceptee`, `codeDeSecours` gardé à la perte du lien. `reduction.session.test.ts` adapté.
- `packages/client/src/interface/modeles/connexion.ts` et test: le mot de passe oublié.
- `packages/client/src/interface/modeles/securite.ts` et test (créés).
- `packages/client/src/interface/composants/codeDeSecours.ts`, `securiteDuCompte.ts` et leurs tests (créés).
- `packages/client/src/interface/ecrans/connexion.ts` et test, `ecrans/profil.ts`, `application.ts`.
- `packages/client/page/styles/ecrans.css`, `composants.css`.
- `tests/outils/comptes-en-memoire.ts`: les trois méthodes, `sessionsDe`.
- `tests/base/motDePasse.test.ts` (créé), `tests/base/migrations.test.ts` (sept tables).
- `tests/e2e/mot-de-passe.spec.ts` (créé), `playwright.config.ts` (projet bureau seul).
- `docs/design/README.md`, `docs/design/cadrage.md`, `docs/plan/ROADMAP.md`, `docs/recette/recette-5-4.md`, `CLAUDE.md`.

Commit de ce handoff: `docs/handoffs/etape-3-4-handoff.md` (créé).

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/sim`.

## Tests

- Ajoutés:
  - **paquet partagé** (16): code de secours accepté normalisé, recopie pardonnée (casse, espaces, tirets, O, I, L), alphabet entier, longueurs et U refusés, saisie démesurée refusée; mise en forme relue par la validation; trois validateurs de demandes (erreurs ensemble, chacune sous son champ); `validerMotDePasse` qui nomme son champ;
  - **serveur, sans base** (15): code fabriqué normalisé, jamais deux fois le même, tout l'alphabet à chaque position, empreinte stable; les trois routes (jeton exigé, 403 sans demander de s'authentifier, 401 et 429 d'une réinitialisation, 503 sans comptes); la couche réseau qui coupe la connexion d'une session fermée et garde la session restante, les invités et les autres comptes, fait sortir du salon, garde la connexion si la base ne répond pas, et retire son écoute à la fermeture;
  - **intégration contre Neon** (11): changement accepté qui ferme les autres sessions et garde la courante; code renouvelé au changement; mot de passe actuel faux en 403 sans rien changer; refus sans ancien mot de passe, sans session ou avec un nouveau trop court; essais comptés avec la connexion; connexion de jeu d'une session fermée coupée et plus rouvrable; code de l'inscription qui réinitialise, recopié en minuscules, ferme toutes les sessions et connecte; code à usage unique; code faux, pseudo inconnu et compte sans code à la même réponse; nouveau code depuis le profil qui annule l'ancien sans fermer de session; compte créé avant l'étape qui obtient un code, et dont le profil le dit avant et après;
  - **client** (46): requêtes (jeton en en-tête, réinitialisation sans jeton); session (code montré après inscription, même si la progression ne se lit pas, pas après une connexion, gardé à la perte du lien; réinitialisation qui connecte, ou garde le refus; demandes du profil qui gardent la session, montrent le refus d'un mot de passe faux, oublient une session expirée, ne partent ni pour un invité ni pendant une autre demande); modèles de la connexion (mot de passe oublié) et de la sécurité (fautes, refus, confirmation, blocage, avertissement d'un compte sans code); fenêtre du code (ouverture, oubli au bouton et à Échap, copie selon le presse-papiers); section sécurité (changement qui vide le formulaire, refus oublié à la retouche, fautes à l'envoi, nouveau code, avertissement, pseudo pour le gestionnaire de mots de passe); écran de connexion (formulaire du mot de passe oublié, mot de passe effacé au changement de formulaire, réinitialisation, code mal formé); réduction (profil marqué dès qu'un code est émis);
  - **bout en bout** (`tests/e2e/mot-de-passe.spec.ts`): inscription et code noté; seconde page connectée au même compte; mot de passe actuel faux refusé dans le profil; changement qui renouvelle le code, vide le formulaire et ferme la session de l'autre page, qui se retrouve en invitée, session expirée; ancien mot de passe refusé; mot de passe oublié où l'ancien code est refusé et le nouveau connecte, avec un troisième code.
- Résultat: **1 900 tests unitaires sur 1 900** (projet `unitaires`, 1 823 au handoff 2.5); **64 tests de la base sur 64** contre une branche Neon (53 avant); types des trois projets compilés en appelant tsc directement, linter et formatage verts.
- Bout en bout en local: **27 sur 27** à trois scénarios à la fois (2,7 minutes), sur l'état du premier commit; le scénario du mot de passe et celui des comptes rejoués après le second.
- À l'écran, par un script Playwright temporaire sur un serveur à comptes en mémoire, supprimé ensuite (voir la réconciliation de la fiche, point 7): la fenêtre du code au-dessus de l'accueil, les deux formulaires de la sécurité avec une faute puis un refus, leur empilement sur un écran de 390 pixels, et le formulaire du mot de passe oublié.
- Couverture des instructions: `sim` à **99,77 pour cent** (inchangée, aucun code du moteur touché), `shared` à **100**, ensemble 99,89.
- Aucune régression de caractérisation. `packages/sim` non touché.

## Décisions et écarts au plan

Cinq entrées au journal de `docs/design/README.md`, datées du 15 septembre 2026: le code de secours, le changement contre l'ancien mot de passe, les tentatives partagées avec la connexion, la coupure des connexions d'une session fermée, la fenêtre du code. Points à lire ici.

### 1. Écarts à la fiche

Réconciliés dans la fiche elle-même (section « Réconciliation en cours d'exécution »): les requêtes regroupées dans `base/secrets.ts`; le refus d'une réinitialisation en 401; la couche réseau qui revérifie les sessions plutôt que de recevoir celles qui sont fermées; le code montré avant la lecture de la progression; le profil qui dit si le compte a un code; le scénario limité au projet bureau; la vérification à l'écran par un script temporaire.

### 2. Le profil dit si le compte a un code: ajouté en exécutant

La fiche faisait du profil le chemin des comptes créés avant l'étape, sans code; rien ne le leur disait. Constaté en relisant le parcours avant de pousser, et traité selon la règle 7: `ProfilDuCompte.codeDeSecours`, lu en base à chaque lecture du profil, et un avertissement dans le formulaire du code, qui disparaît dès qu'un code est émis. Commit séparé.

### 3. Ce que les tests ont attrapé avant tout commit

- Un test de la coupure attendait la mise à jour du salon après son arrivée: elle part avec le départ du joueur. Le test l'attend désormais avant de déclencher la coupure.
- Le scénario de bout en bout cherchait « Code de secours » dans toute la page, où la fenêtre « Votre code de secours » répondait aussi; il cherche dans le formulaire.
- Trois tests existants du client comparaient la demande de compte à l'identique, sans le nouveau champ `acceptee`; ils le portent.

### 4. Ce qui n'a pas été fait, volontairement (hors périmètre de la fiche)

Courriel ou autre moyen de joindre le joueur; supprimer son compte ou changer son pseudo; lister ou fermer une à une ses sessions; couper les connexions à la déconnexion volontaire ou à l'expiration.

## Problèmes connus et dette

Limites assumées, relevées par cette étape:

- **L'écoute des sessions fermées vit dans le processus**, comme les limites de tentatives (handoff 3.2): plusieurs instances du serveur derrière un répartiteur ne se préviendraient pas. Suffisant pour le serveur unique de la v1.
- **Une page coupée parce que sa session a été fermée** dit « La connexion au serveur a été perdue » hors partie, et le refus de la session si elle tentait de revenir en partie. Le rétablissement du lien hors partie est l'étape 2.6, déjà planifiée.
- **Fermer la fenêtre du code vaut « noté »**, quelle qu'en soit la façon: un joueur qui la ferme trop vite doit en créer un autre depuis son profil, ce que la fenêtre lui dit, et ce qui demande son mot de passe.

Échec isolé, non reproduit:

- **`routes.test.ts`, « refusent une demande sans jeton, ou avec un jeton mal formé, sans déranger le service »** (test de l'étape 3.2, que cette étape ne touche pas) a échoué une fois, en 13 millisecondes, dans une suite unitaire complète lancée juste après une recompilation. Le message d'erreur n'a pas été gardé (sortie filtrée). Rejoué ensuite cinq fois dans la suite complète, vingt-trois fois seul: aucun échec. Aucune trace dans l'historique de la CI. Piste, non vérifiée: une connexion HTTP gardée ouverte par `fetch` vers un port que le système réattribue au serveur du test suivant. Si l'échec revient, garder la sortie complète avant toute correction.

Question au porteur du projet, relevée par cette étape:

- **Le serveur de développement local parle à la base de `DATABASE_URL`.** `.claude/launch.json` et `pnpm dev` démarrent le serveur avec l'environnement de la machine, qui porte `DATABASE_URL`; d'après `docs/deploiement.md`, la seule base est la branche `production` du projet Neon. Jouer localement avec un compte y écrirait donc des comptes et des parties. Cette étape l'a évité (vérification à l'écran sur des comptes en mémoire). À trancher: une branche Neon de développement pour la machine locale, ou un serveur local sans base par défaut.

Résolu par cette étape, repris du handoff 3.2: une session fermée ne coupait pas une connexion réseau déjà ouverte; c'est désormais le cas après un changement de mot de passe ou une réinitialisation.

Repris du handoff 2.5, inchangé: jusqu'à 45 secondes pour constater une coupure silencieuse; la pluie coûte au chargement du décor; un point flottant manqué une fois en jeu; la fluidité et le lancement sur iPhone restent à confirmer sur un vrai téléphone; en haut ou en bas de la carte, le joueur passe sous le HUD sur téléphone; les erreurs d'un travailleur échappent aux scénarios de bout en bout; les limites de tentatives vivent en mémoire de l'instance; le relevé des contacts et le lissage du client restent en carré du nombre d'entités; l'outil de Vercel est téléchargé par npx à chaque mise en ligne; des déploiements Vercel non promus restent de la première mise en ligne; le jeton Vercel expire le 14 septembre 2027. Les sons et la musique restent à écouter par le porteur du projet (cas C21 de la grille de recette).

## État de la CI

- `42f846a` (fiche): documentation seule.
- `b6d9f30` (gestion du mot de passe) et `4cce16e` (le profil dit si le compte a un code), poussés ensemble: **verte**, exécution 34983983306 sur `4cce16e`: « Types, linter et tests » (2 min 30 s, tests de la base contre une branche Neon et contrôle de la migration compris), « Bout en bout » (6 min 9 s) et **« Mise en ligne »** (2 min 31 s). Le test des routes relevé plus haut y est passé.
- Vérifié ensuite depuis la machine de développement: `https://neon-ninja.onrender.com/sante` rend la version `4cce16e0994dee912bb1c4f96bd6d0229b029d00`; `https://neon-ninja-jeu.vercel.app/` répond 200, et son `app.js` porte ce commit et le champ `code-de-secours`. La migration `0003_codes_de_secours` est appliquée à la base de production: une demande de réinitialisation bien formée, pour un pseudo qui n'existe pas, interroge la table et reçoit 401 « Pseudo ou code de secours incorrect. », sans rien écrire.
- Le commit de ce handoff ne touche que la documentation: sa mise en ligne doit s'arrêter d'elle-même, la production restant sur `4cce16e`.

## Prochaine action exacte

La section 3 du ROADMAP place ensuite **l'étape 2.6, le lien perdu hors partie**. Aucune fiche n'existe encore: dans une conversation neuve, sur `master`, rédiger `docs/plan/etape-2-6.md` selon le cas de repli du PROTOCOLE, à partir de l'entrée 2.6 du ROADMAP (section 4). Son entrée prévoit de trancher au début de l'étape ce qui est dit au joueur et le sort de sa place dans un salon. Puis la commiter et l'exécuter.

## Étape suivante

Fiche à lire: `docs/plan/etape-2-6.md`, à rédiger au début de la session
