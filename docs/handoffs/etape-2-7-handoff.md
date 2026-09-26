# Handoff - Étape 2.7 Le lien d'invitation

Date: 26 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Qu'une adresse `?partie=CODE` ouvre le jeu sur l'entrée dans cette partie privée, et que le salon d'une partie privée propose de partager ce lien.

## Ce qui a été fait

- **La fiche** `docs/plan/etape-2-7.md`, rédigée selon le cas de repli du PROTOCOLE, à partir de l'entrée du ROADMAP et de l'étude des amis. Sept décisions de conception, aucune soumise au porteur du projet: l'étude, qu'il a validée, fixait le besoin.
- **La lecture de l'adresse** (`invitation.ts`): `?partie=` est lu au démarrage de la page et vérifié par `validerCodeInvitation`, la règle du serveur. Un code bien formé est ramené à sa forme canonique; un code mal formé, ou un paramètre vide, devient une invitation « mal formée » avec son motif.
- **L'invitation dans l'état du client**: posée à la création du client, effacée à la première entrée acceptée et quand le joueur l'ignore, gardée par une sortie de partie (un retour en partie de l'étape 2.5 passe avant elle).
- **L'accueil avec invitation**: un bloc « Invitation · Une partie privée vous attend · Code K7XM3Q » et « Ignorer »; le bouton principal devient « Rejoindre la partie » et envoie la demande d'entrée par ce code. Un invité choisit d'abord son pseudo, un compte entre d'un clic. Un code refusé par le serveur (inconnu, partie pleine ou lancée) s'affiche sous le formulaire, comme toute entrée refusée. Un lien mal formé se dit en rose (« Ce lien d'invitation n'est pas valable. » et le motif), la partie rapide reste, rien du lien ne part au serveur.
- **L'adresse oublie l'invitation dès qu'elle a servi**: `history.replaceState`, sans recharger ni ajouter d'entrée à l'historique; les autres paramètres, dont `diagnostic`, restent.
- **Le partage depuis le salon d'une partie privée**: un bouton à côté du code, « Partager le lien » sur un appareil tactile qui sait partager (`navigator.share`, pointeur principal tactile), « Copier le lien » ailleurs. Partage annulé: rien ne se dit. Partage en échec: copie. Copie impossible: le lien s'affiche, à sélectionner. Le lien est l'adresse de la page, pas du serveur de jeu, avec le seul paramètre `partie`.
- **Un pictogramme `partager`**, dessiné dans le style de la maquette.
- **Règle 7**: le commentaire de tête de `icones.ts` annonçait quatre glyphes absents de la maquette; il y en avait huit. Corrigé.

Ni le serveur, ni la base, ni le transport, ni `packages/shared`, ni `packages/sim` ne changent.

## Fichiers créés ou modifiés

- `packages/client/src/invitation.ts` (créé): lecture du code dans l'adresse, fabrication du lien, adresse sans invitation, branchement qui la retire de l'adresse.
- `packages/client/src/etat.ts`, `actions.ts`, `reduction.ts`: le champ `invitation`, les actions `invitationOuverte` et `invitationIgnoree`, l'effacement à l'entrée acceptée, la survie à une sortie de partie.
- `packages/client/src/client.ts`: l'option `invitation`, appliquée à la création, et la commande `ignorerLInvitation`.
- `packages/client/src/principal.ts`: lit l'invitation, la donne au client, branche l'adresse.
- `packages/client/src/interface/modeles/accueil.ts`: l'invitation affichée, le libellé du bouton, le code d'entrée.
- `packages/client/src/interface/ecrans/accueil.ts`: le bloc d'invitation, « Ignorer », le bouton qui rejoint par le code.
- `packages/client/src/interface/composants/partage.ts` (créé): partager ou copier, et ce qui en est sorti.
- `packages/client/src/interface/ecrans/salon.ts`: le bouton de partage du lien et son retour.
- `packages/client/src/interface/icones.ts`: le glyphe `partager`, le commentaire de tête corrigé.
- `packages/client/page/styles/ecrans.css`: le bloc d'invitation, le bouton de partage, le retour de copie qui passe à la ligne.
- Tests: `invitation.test.ts`, `interface/ecrans/accueil.test.ts`, `interface/composants/partage.test.ts` (créés); `interface/modeles/accueil.test.ts`, `interface/ecrans/salon.test.ts`, `tests/e2e/parties.spec.ts` (complétés).
- Documentation: `docs/plan/etape-2-7.md` (créée), `docs/plan/ROADMAP.md` (étape terminée, prochaine `3.5`), `docs/design/README.md` (journal), `docs/design/etude-amis-et-fiche-joueur.md` (statut), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - lecture de l'adresse: absente, bien formée, en minuscules, entourée d'espaces, parmi d'autres paramètres, mal formée (trop courte, trop longue, caractère hors de l'alphabet, balise), vide; lien fabriqué sans les paramètres ni le fragment de la page, et qui se relit; adresse sans invitation qui garde le reste;
  - état et client: invitation posée à la création, ignorée, gardée par un refus, effacée à l'entrée acceptée, gardée par une sortie de partie; « Ignorer » emporte le refus d'entrée et lui seul;
  - adresse de la page: intacte tant que l'invitation n'a pas servi, nettoyée une seule fois après « Ignorer » ou l'entrée, plus rien après l'arrêt de l'écoute;
  - modèle et écran d'accueil: annonce, pseudo exigé d'un invité, compte d'un clic, lien attendu, demande envoyée par le code, refus du serveur affiché, « Ignorer », lien mal formé sans rien envoyer, accueil sans invitation inchangé;
  - partage: partager sur un appareil tactile, copier sur ordinateur, sans `matchMedia`, partage annulé, partage en échec rabattu sur la copie, `canShare` négatif, copie impossible;
  - salon: lien copié sur ordinateur, lien montré quand la copie est impossible, lien partagé sur un appareil tactile;
  - bout en bout (bureau): Alice crée une partie privée et copie le lien; Bob, invité, l'ouvre, voit l'invitation, choisit son pseudo et entre dans le salon d'Alice; son adresse ne porte plus le code.
- Résultat: RESULTATS_A_COMPLETER
- Couverture de packages/sim: inchangée, aucun code du paquet touché.
- État de la CI: CI_A_COMPLETER

## Décisions et écarts au plan

1. **Les sept décisions de la fiche** ont été prises sans le porteur du projet, parce qu'elles découlent de l'étude qu'il a validée. Celles qu'il pourrait vouloir revoir: l'entrée sur l'accueil plutôt qu'un écran à part (décision 1), un compte qui entre d'un clic plutôt que d'office (décision 2), la copie plutôt que le partage du système sur ordinateur (décision 7).
2. **Le texte de l'invitation** est « Une partie privée vous attend. », et non « Vous êtes invité… », qui aurait genré le joueur.
3. **Écart de branche**: la session travaille sur la branche imposée `claude/etape-2-7-p27ge7`, et non directement sur `master` comme le veut le PROTOCOLE. Elle ne part pas en ligne tant qu'elle n'a pas rejoint `master`, ce que décide le porteur du projet.

## Problèmes connus et dette

- **Le partage du système n'a pas été essayé sur un vrai téléphone**: il est couvert par des tests avec une fenêtre d'essai, et le scénario de bout en bout joue la copie sur ordinateur (le Chromium sans interface ne sait pas partager). À vérifier à la recette par le porteur du projet: sur téléphone, « Partager le lien » ouvre la liste des messageries, et le lien reçu ouvre l'accueil sur l'invitation.
- **Un lien vers une partie qui a été lancée ou qui a disparu** ne s'annonce pas comme tel avant le clic: l'accueil propose de rejoindre, et c'est le refus du serveur qui le dit. Un aperçu demanderait un message réseau nouveau, hors du périmètre.
- Pour rejouer les scénarios de bout en bout dans un conteneur de Claude Code sur le web, même remarque qu'au handoff 8.7: passer `executablePath` vers le Chromium préinstallé par un fichier de configuration temporaire.

## Prochaine action exacte

Exécuter l'étape `3.5`, la fiche joueur: rédiger sa fiche selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.5 du ROADMAP et des sections 3.3, 4.3 et 7 de `docs/design/etude-amis-et-fiche-joueur.md`.

## Étape suivante

Fiche à lire: `docs/plan/etape-3-5.md`, à rédiger au début de l'étape (cas de repli du PROTOCOLE).
