# Handoff - Étape 3.3 Progression branchée sur la fin de partie

Date: 11 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

À la fin d'une partie, calculer les récompenses de chaque compte, faire évoluer sa progression (XP, niveau, pièces, points de ligue, palier), enregistrer le résultat de la partie, et fournir au client le récapitulatif de fin. Cette étape clôt la phase 3.

## Ce qui a été fait

- **Valeurs des récompenses proposées au porteur du projet, validées, puis codées** (question 2 de la section 8 du cadrage). Les quatre propositions recommandées ont été retenues; voir « Les règles de récompense » ci-dessous.
- **Règles pures dans `packages/shared/src/progression.ts`**: `recompensesDePartie`, `niveauDeXp`, `xpDuNiveau`, `avancementDuNiveau`, `palierDePoints`, `PALIERS`, `REGLES_DE_PROGRESSION`. Le niveau provisoire de l'étape 3.2 est remplacé; ses appelants n'ont pas changé.
- **Bilan de partie dans la `GameRoom`** (`bilan()`): placement dans l'ordre du classement final, temps passé en jeu par chacun (un joueur entré en cours de partie n'est compté que pour son temps, la pause ne compte pas), et les **abandons**, joueurs partis pendant la partie, placés derniers. Un joueur qui revient dans la partie n'est plus un abandon.
- **Traduction pure dans `packages/server/src/finDePartie.ts`**: du bilan vers la partie et les résultats des comptes à enregistrer (`finPourLesComptes`), et de la progression appliquée vers le récapitulatif (`progressionEnregistree`).
- **Enregistrement transactionnel** (`enregistrerPartie`, `base/parties.ts`): la partie, les résultats et l'ajout des gains à la progression en une seule transaction, progressions verrouillées dans l'ordre des identifiants de compte, points de ligue jamais sous zéro (la variation réduite est celle qui s'enregistre), heure de fin donnée par la base.
- **Branchement sur la fin de partie** (`ServeurSocket`): `partieTerminee` part à tous aussitôt; puis, si la partie avait des comptes, l'annuaire enregistre (`enregistrerFinDePartie`, implémentée par `Authentification`) et chaque compte présent reçoit `progressionDeFin`. Un échec est journalisé et annoncé au compte. À l'extinction, le serveur attend les enregistrements en cours avant de refermer la base.
- **Tests d'intégration requis, contre Neon**, avec un vrai serveur et de vrais clients (`tests/base/progression-de-fin.test.ts`).
- **Tests réseau fiabilisés** (règle 7): un test de cette étape a échoué une fois sous forte charge. Cause: une attente fixe de 30 ms entre une demande (`quitter`, `reglages`, `demarrer`) et l'avance de l'horloge manuelle du jeu. Le même motif existait dans `ServeurSocket.test.ts` (étape 2.2). Toutes les attentes dont dépend la suite attendent désormais une preuve (message en retour, ou état du serveur); cinq exécutions sous charge, vertes.
- **Documentation**: six décisions au journal de conception, cadrage (sections 3, 5 et 8), fiche 3.3 réconciliée, `CLAUDE.md` (progression branchée avec `DATABASE_URL`), commentaires périmés qui renvoyaient à « l'étape 3.3 » mis à jour.

## Les règles de récompense

La fiche demande de les documenter ici, pour l'écran de fin de la reprise des écrans. Code: `packages/shared/src/progression.ts`. Validées par le porteur du projet le 11 septembre 2026.

| Règle           | Valeur                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| XP              | `minutes jouées × (10 + 20 × joueurs devancés)`, arrondi en dessous. Joueurs devancés: invités et abandons compris          |
| Pièces          | `XP ÷ 10`, arrondi en dessous                                                                                               |
| Niveaux         | Passer du niveau n au niveau n + 1 coûte `100 × n` XP; seuil du niveau L: `50 × L × (L − 1)` (niveau 2 à 100, 10 à 4 500)   |
| Points de ligue | `−10 + 30 × devancés ÷ (joueurs − 1)`, arrondi au plus proche (une demie vers le haut); +20 au premier, −10 au dernier      |
| Conditions      | Ligue: au moins 2 joueurs et une partie réglée à 3 minutes ou plus, sinon 0. Jamais sous zéro (appliqué à l'enregistrement) |
| Paliers         | `bronze` 0, `argent` 100, `or` 300, `platine` 600, `diamant` 1 000. Les noms affichés appartiennent au client               |
| Abandon         | Compté dernier: 0 XP, 0 pièce, la variation du dernier. Tous les abandons sont placés derniers, à égalité                   |

Exemple, partie de trois minutes à quatre joueurs: 210, 150, 90 et 30 XP; 21, 15, 9 et 3 pièces; +20, +10, 0 et −10 points de ligue.

Seuls les joueurs qui ont un compte reçoivent un résultat. Une partie jouée uniquement par des invités n'est pas enregistrée.

## La forme du récapitulatif de fin

Contrat dans `packages/shared/src/evenements.ts`.

- **`partieTerminee`** (`FinDePartie`), à tous, inchangé: le classement définitif. C'est tout ce qu'un invité reçoit.
- **`progressionDeFin`** (`ProgressionDeFin`), à chaque compte **présent à la fin**, après `partieTerminee` (le temps de l'écriture en base):

```ts
type ProgressionDeFin =
  | {
      enregistree: true;
      placement: number; // 1 pour le premier
      nombreJoueurs: number; // invités et abandons compris
      xpGagnee: number;
      piecesGagnees: number;
      variationPointsLigue: number; // signée, réellement appliquée
      avant: EtatDeProgression;
      apres: EtatDeProgression;
    }
  | { enregistree: false; motif: string };

interface EtatDeProgression {
  xpTotale: number;
  niveau: number;
  pieces: number;
  pointsLigue: number;
  palier: 'bronze' | 'argent' | 'or' | 'platine' | 'diamant';
}
```

- Les gains sont la **différence entre `apres` et `avant`**, tels que la base les a rendus dans la transaction: le récapitulatif dit ce qui a été écrit, pas ce qui avait été demandé.
- Passage de niveau: `apres.niveau > avant.niveau`; variation de rang: `apres.palier !== avant.palier`. La barre de niveau se calcule par `avancementDuNiveau(xpTotale)` (`niveau`, `xpDansLeNiveau`, `xpDuNiveauEntier`).
- Un compte parti avant la fin ne reçoit rien (son abandon est enregistré). Un compte déjà entré dans une autre partie, ou déconnecté, quand l'enregistrement aboutit, ne reçoit rien non plus.
- Le client ne consomme pas encore ce message: il ne sait pas se connecter à un compte (voir « Problèmes connus »).

## Fichiers créés ou modifiés

Créés

- `packages/server/src/finDePartie.ts`: du bilan de la room vers les résultats à enregistrer, et de la progression appliquée vers le récapitulatif.
- `packages/server/src/finDePartie.test.ts`: résultats des seuls comptes, abandon sans connexion à prévenir, partie d'invités, gains appliqués et perte réduite.
- `packages/server/src/GameRoom.fin.test.ts`: bilan, temps joué (entrée tardive, pause), abandons et retours.
- `tests/base/progression-de-fin.test.ts`: les tests d'intégration requis, contre Neon.

Modifiés

- `packages/shared/src/progression.ts`: les règles de récompense et de déduction, à la place du niveau provisoire.
- `packages/shared/src/progression.test.ts`: réécrit sur les valeurs validées.
- `packages/shared/src/evenements.ts`: `EtatDeProgression`, `ProgressionEnregistree`, `ProgressionNonEnregistree`, `ProgressionDeFin`, et l'événement `progressionDeFin`.
- `packages/shared/src/index.ts`: exports.
- `packages/server/src/GameRoom.ts`: temps d'entrée en jeu, abandons, `bilan()`, types `BilanDePartie` et `JoueurDuBilan`.
- `packages/server/src/base/parties.ts`: `enregistrerPartie` ajoute les gains dans sa transaction et rend `PartieEnregistree`; `termineeLe` facultative; `ProgressionAppliquee`.
- `packages/server/src/comptes/annuaire.ts`: `enregistrerFinDePartie` dans l'annuaire.
- `packages/server/src/comptes/Authentification.ts`: son implémentation.
- `packages/server/src/ServeurSocket.ts`: enregistrement de la fin, envoi de `progressionDeFin`, `enregistrementsTermines`.
- `packages/server/src/serveur.ts`: l'extinction attend les enregistrements en cours.
- `packages/server/src/index.ts`: exports et en-tête.
- `packages/server/src/base/progression.ts`, `base/schema.ts`: commentaires (déduction écrite, gains jamais par `ecrireProgression`). Aucune migration: `pnpm base:generer` le confirme.
- `packages/server/src/ServeurSocket.comptes.test.ts`: annuaire en mémoire qui enregistre; cinq tests de fin de partie; attentes par preuve.
- `packages/server/src/ServeurSocket.test.ts`: attentes par preuve au lieu de délais fixes (lancement, réglages, décompte, pause, reprise, déplacement, déconnexion).
- `packages/server/src/comptes/routes.test.ts`: le service factice suit l'interface.
- `packages/client/src/interface/modeles/fin.ts`, `modeles/fin.test.ts`, `ecrans/fin.test.ts`: commentaires qui annonçaient la progression pour l'étape 3.3.
- `tests/base/parties.test.ts`: nouveau contrat de `enregistrerPartie`; gains ajoutés, plancher à zéro, deux parties simultanées, heure de la base, compte inconnu.
- `tests/base/authentification.test.ts`: 2 500 XP donnent désormais le niveau 7.
- `CLAUDE.md`, `docs/design/README.md`, `docs/design/cadrage.md`, `docs/plan/etape-3-3.md`: documentation.
- `docs/handoffs/etape-3-3-handoff.md`: ce handoff.

## Tests

- Ajoutés:
  - **intégration contre Neon, fin de partie** (5): une partie de trois minutes, deux comptes et un invité, la progression de chaque compte reflète les récompenses de sa place; passage de niveau (99 XP au départ); résultat enregistré et rattaché au bon compte; récapitulatif égal à l'évolution enregistrée, rien pour l'invité; abandon enregistré dernier, sans XP, points de ligue arrêtés à zéro;
  - **intégration contre Neon, parties** (+4): gains ajoutés sans remplacer, plancher à zéro avec perte réduite enregistrée, deux parties simultanées d'un même compte sans perte d'écriture, heure de fin de la base; trois tests existants adaptés au nouveau contrat;
  - **règles** (23, dont 19 nouveaux): niveaux et seuils exacts, paliers, XP et pièces de l'exemple validé, temps joué, arrondis, ligue (2, 3, 4 et 12 joueurs, demie, moins zéro, solo, trois minutes), abandon, places impossibles;
  - **bilan de la room** (8), **traduction de fin** (6), **couche réseau avec comptes** (+5).
- Résultat: **1 261 tests unitaires sur 1 261** (78 fichiers), **48 tests de la base sur 48** (6 fichiers), **10 scénarios de bout en bout sur 10**, sans modification des scénarios.
- Couverture de `packages/sim` et `packages/shared`: **99,77 pour cent** (99,76 au handoff 3.2); `progression.ts` à 100 pour cent.
- Types (par `tsc`, sans filtre), linter et formatage: verts. Caractérisation: non touchée, verte dans la suite unitaire.
- Tests réseau: cinq exécutions de suite des deux fichiers `ServeurSocket*` pendant la suite unitaire complète, vertes.
- État de la CI: voir « État de la CI ».

## Décisions et écarts au plan

Six décisions au journal du README, datées du 11 septembre 2026. Les écarts à la fiche sont dans sa section « Réconciliation pendant l'étape ». Trois points à lire ici.

### 1. L'abandon est une règle ajoutée

La fiche ne parlait que des joueurs présents à la fin. Sans règle d'abandon, quitter juste avant la fin évitait toute perte de points de ligue. Proposée et validée: compté dernier. Conséquence assumée: une coupure de réseau coûte la partie, faute de reconnexion.

### 2. Le récapitulatif ne retarde pas la fin

`partieTerminee` part aussitôt, `progressionDeFin` suit l'écriture en base. L'écran de fin devra afficher le classement tout de suite, puis la progression quand elle arrive (ou le motif d'échec).

### 3. Les tests réseau attendent une preuve, jamais un délai

Hors du périmètre, traité au titre de la règle 7. Il ne reste d'attentes fixes (`laisserPasserLesMessages`) que pour vérifier que rien n'arrive, où un délai trop court ne peut pas faire échouer le test.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **Le client ne sait ni se connecter à un compte ni afficher la progression.** Tout est prêt côté serveur et contrat; c'est la reprise des écrans du jalon 3 (écran de connexion, garde du jeton, `auth` à l'ouverture, écran de fin enrichi).
- **Le profil n'a pas de route HTTP.** `lireHistorique` existe en base, mais aucune route ne rend l'historique ni les statistiques (parties jouées, victoires, meilleur score) que la section 3 du cadrage demande au profil. À ajouter avec l'écran de profil.
- **Un échec d'enregistrement n'est pas retenté**: la partie ne compte pas pour ses comptes, qui en sont prévenus, et l'incident est journalisé.
- **Un compte supprimé pendant une partie ferait échouer l'enregistrement de toute la partie**, pour tous ses comptes. Aucune suppression de compte n'existe en v1; à reconsidérer quand elle arrivera.
- **L'extinction attend les enregistrements en cours sans délai maximal propre au serveur**: si la base ne répond pas, elle attend l'échec de la requête.

Repris des handoffs précédents: les limites de tentatives vivent en mémoire de l'instance; au déploiement (5.3), poser `MANDATAIRES_DE_CONFIANCE` et `ORIGINES_AUTORISEES`; une session fermée ne coupe pas une connexion réseau déjà ouverte; l'observation sur `rtk pnpm typecheck` tient toujours, les types ont été vérifiés par `tsc` sans filtre. Le reste: voir le handoff 4.4.

## État de la CI

À confirmer après la poussée du commit de l'étape.

## Prochaine action exacte

Dans une conversation neuve: reprendre les écrans de l'étape 4.3 pour le jalon 3. C'est la section 3 du ROADMAP qui la désigne: le jalon 3 enchaîne `3.1`, `3.2`, `3.3`, « puis reprise des écrans de 4.3 (navigateur, création, profil, fin de partie enrichie) ». La ligne de fin de la fiche 3.3, qui désigne 4.1, suit la numérotation thématique: 4.1 est faite depuis le jalon 1.

**Cette étape n'a pas de fiche.** Appliquer le cas de repli du PROTOCOLE (boucle d'une étape, point 2): la rédiger d'abord, à partir de l'entrée du ROADMAP, de la section 3 du cadrage (écrans 2, 3, 6 et 7 et l'en-tête commun), de l'état réel du dépôt et de ce handoff, sur le modèle des fiches existantes, puis la commiter avant de l'exécuter. Nom proposé: `docs/plan/etape-4-3-reprise.md`.

Quatre points à avoir en tête dès le début:

1. **Le client doit d'abord pouvoir se connecter**: écran d'inscription et de connexion (`ROUTES_COMPTES`), garde du jeton, `auth: { jeton }` à l'ouverture de Socket.IO, en-tête et accueil avec niveau, palier et pièces (`GET /api/comptes/moi`). Un jeton refusé fait refuser la connexion réseau: l'écran doit le dire.
2. **La fin de partie enrichie consomme `progressionDeFin`**, qui arrive après `partieTerminee`; forme et règles ci-dessus. Les noms des paliers sont à écrire côté client.
3. **Le profil demande une route HTTP** pour l'historique et les statistiques, qui n'existe pas.
4. **Le navigateur de parties et la création** s'appuient sur `listerParties`, `creerPartie` et le code d'invitation de l'étape 2.4, déjà disponibles côté serveur.

## Étape suivante

Fiche à lire: aucune n'existe encore; à rédiger sous `docs/plan/etape-4-3-reprise.md` (voir « Prochaine action exacte »).

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`.
