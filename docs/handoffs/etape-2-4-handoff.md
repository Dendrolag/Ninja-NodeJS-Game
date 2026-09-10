# Handoff - Étape 2.4 Matchmaking, parties privées et publiques

Date: 10 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Créer et rejoindre des parties: en public par une liste des parties ouvertes et par la partie rapide, en privé par un code d'invitation. Le tout au-dessus du RoomManager et des contrats de l'étape 2.2, sans interface. L'étape clôt le jalon 2.

## Ce qui a été fait

- **Le contrat de configuration existe** (`packages/shared`): `MODES` (`classique` seul), `CAPACITES` (12), `VISIBILITES` (`publique`, `privee`), `ConfigurationPartie { mode, visibilite, reglages? }` et `DemandeCreation { pseudo, configuration }`. Il étend `ReglagesPartiels`, validés par `validerReglages` comme avant: rien n'est réécrit.
- **Deux nouvelles demandes au contrat réseau**: `creerPartie(demande, accusé)` et `listerParties(accusé)`. `rejoindre` accepte un `idRoom`, un `code`, ou rien du tout (partie rapide), jamais les deux.
- **Validation partagée**: `validerDemandeCreation` (mode inconnu, visibilité inconnue, réglages hors bornes) et `validerCodeInvitation` (six caractères de l'alphabet, saisie normalisée). Mêmes fonctions pour le client et le serveur.
- **Le mode arrive jusqu'au moteur.** `EtatPartie.mode`, et `tick` choisit sa règle dans `REGLES_DES_MODES`. Comportement inchangé, un seul mode.
- **La room connaît son mode, sa visibilité, son code et sa capacité.** Une partie pleine refuse l'entrée.
- **Le RoomManager fabrique les codes** (`node:crypto`, uniques parmi les parties ouvertes), retrouve une partie par son code, et liste les parties publiques ouvertes.
- **Ce que reçoit le salon** porte désormais mode, visibilité, capacité, et le code pour une partie privée. La liste publique donne, par partie: identifiant, pseudo de l'hôte, mode, carte, miroir, nombre de joueurs, capacité. Pas de latence (cadrage).
- **Le client sait créer, lister et rejoindre par code** (`creerPartie`, `listerParties`, `rejoindre(pseudo, { idRoom } | { code })`), et l'état garde la dernière liste reçue (`partiesPubliques`).
- **Incohérence corrigée en passant**: l'état du client enregistrait tout refus d'entrée comme un refus de `rejoindre`. Il retient maintenant à quelle demande il répond.
- **Fiche 2.4 réconciliée** (section à sept points), **six décisions** au journal de `docs/design/README.md`, et les mentions périmées du « premier salon en attente » corrigées dans CLAUDE.md, le ROADMAP, le cadrage et deux commentaires.

## Le flux, de la création au lancement

La fiche demande de le décrire ici.

**Créer.** Le joueur envoie `creerPartie` avec son pseudo et une configuration. Le serveur valide la configuration, crée la room (avec un code si elle est privée), puis y fait entrer le joueur, qui en devient l'hôte. Si l'entrée échoue, la room est détruite aussitôt: aucune partie vide ne reste ouverte. L'accusé rend ce que reçoit le salon, code compris.

**Rejoindre.** Trois accès, tous par `rejoindre`:

- **par identifiant**, choisi dans la liste publique. Une partie privée visée ainsi reçoit le même refus qu'une partie inexistante, « Cette partie n'existe plus. »;
- **par code**, pour une partie privée: « Aucune partie ne correspond à ce code. » sinon;
- **sans rien, la partie rapide**: la première partie publique en attente et non pleine, ou une nouvelle partie publique aux réglages par défaut. C'est ce qu'appelle le bouton « Jouer » de l'étape 4.3.

Dans tous les cas, la room vérifie ensuite dans cet ordre: partie terminée, connexion déjà présente, partie complète, pseudo déjà pris.

**Lister.** `listerParties` rend les parties publiques encore au salon et non pleines, dans l'ordre de création. C'est une photographie, pas un flux: l'écran du jalon 3 la redemandera. La demande est limitée en débit comme les autres actions.

**Le salon, jusqu'au lancement**: inchangé depuis les étapes 2.1 et 2.2. L'hôte règle `ReglagesPartie` et lance, avec le compte à rebours annulable; la propriété passe au suivant si l'hôte part. Mode et visibilité, eux, ne changent plus après la création.

**Source temporaire du pseudo et du niveau.** Le pseudo vient de la demande d'entrée, validé par `BORNES_PSEUDO` et unique dans la partie, comme depuis l'étape 2.2. **Aucun niveau n'est affiché ni transmis**: il n'en existe aucune source avant les comptes, et une valeur factice aurait été une donnée fausse à l'écran. Il arrivera avec l'étape 3.2 (compte) et 3.3 (déduction de l'XP).

## Fichiers créés ou modifiés

Créés

- `packages/sim/src/modes.test.ts`: chaque mode a sa règle, l'état porte son mode, et `tick` applique la règle du mode de l'état.
- `packages/server/src/parties.test.ts`: capacité et mode d'une room, codes du RoomManager (forme, unicité, tirage défaillant), liste publique, projections `salonDe` et `partiePubliqueDe`.
- `packages/client/src/parties.test.ts`: câblage client de la création, de la liste et des trois accès.
- `tests/client/integration/parties-serveur.test.ts`: client contre vrai serveur, partie privée par code, partie publique depuis la liste, refus d'un code inconnu montré au joueur sans quitter l'accueil.
- `docs/handoffs/etape-2-4-handoff.md`: ce handoff.

Modifiés, `packages/shared`

- `constantes.ts`: `MODES`, `CAPACITES`, `VISIBILITES` et leurs types.
- `bornes.ts`: `BORNES_CODE_INVITATION`.
- `entrees.ts`: `DemandeRejoindre` gagne `code`; `ConfigurationPartie` et `DemandeCreation`.
- `evenements.ts`: `InfosSalon` gagne mode, visibilité, code et capacité; `PartiePublique`; demandes `creerPartie` et `listerParties`.
- `validation.ts`, `validation.test.ts`: validation de la création, du code, et du rejoindre par code.
- `index.ts`: exports.

Modifiés, `packages/sim`

- `etat.ts`: `EtatPartie.mode`, option `mode` de `creerEtatInitial`.
- `moteur.ts`, `index.ts`: `REGLES_DES_MODES`, lue par `tick`.

Modifiés, `packages/server`

- `GameRoom.ts`: mode, visibilité, code, capacité, refus d'une partie pleine.
- `RoomManager.ts`: tirage des codes, recherche par code, liste des parties publiques ouvertes.
- `instantane.ts`: nouveaux champs du salon, projection `partiePubliqueDe`.
- `ServeurSocket.ts`, `ServeurSocket.test.ts`: gestionnaires `creerPartie` et `listerParties`, recherche de la room selon l'accès, partie rapide publique; tests des parties privées, publiques, de la capacité et des créations refusées.
- `index.ts`: en-tête du paquet.

Modifiés, `packages/client`

- `client.ts`, `actions.ts`, `etat.ts`, `reduction.ts`: commandes `creerPartie` et `listerParties`, accès par identifiant ou code, liste dans l'état, refus d'entrée qui retient sa demande.
- `annonces.ts`: le refus d'une création s'affiche sur place, comme celui d'une entrée.
- `interface/modeles/cartes.ts`, `modeles/salon.ts`, `modeles/fin.ts`: le nom du mode se lit dans le salon (`NOMS_DES_MODES`) au lieu d'une constante.
- `interface/ecrans/fin.ts`, `ecrans.ts`, `index.ts`: commentaires et exports.
- Tests `annonces`, `client`, `ecrans`, `reduction`, `selecteurs`, `rendu/boucle`, `interface/application`, `modeles/fin`, `modeles/salon`, `ecrans/fin`, `ecrans/salon`: leurs salons d'exemple portent les nouveaux champs.

Modifiés, ailleurs

- `tests/client/integration/client-serveur.test.ts`: nouvel appel de `rejoindre` par identifiant.
- `tests/e2e/harnais/serveur-de-jeu.ts`, `tests/e2e/harnais/parcours.ts`: commentaires, les scénarios entrent par la partie rapide.
- `CLAUDE.md`: « Jouer » est la partie rapide; la phrase sur le premier salon en attente était périmée.
- `docs/plan/etape-2-4.md`: réconciliation.
- `docs/plan/ROADMAP.md`: la « file » des parties publiques devient la liste et la partie rapide, comme l'a tranché le cadrage.
- `docs/design/cadrage.md`: la proposition de code devient la règle retenue.
- `docs/design/README.md`: six décisions.

## Tests

- Ajoutés: les quatre fichiers ci-dessus, plus des blocs dans `validation.test.ts` et `ServeurSocket.test.ts`. Ils couvrent les tests requis par la fiche:
  - partie privée créée, rejointe par code valide, code invalide refusé, et non joignable par identifiant;
  - partie publique créée, présente dans la liste, rejointe depuis la liste; absente de la liste une fois pleine ou lancée;
  - configuration aberrante refusée (mode inconnu, visibilité inconnue, durée hors bornes), et treizième joueur refusé;
  - salon: présence des joueurs, réglage et lancement par l'hôte seulement, déjà couverts depuis l'étape 2.2 et toujours verts. L'état « prêt » est retiré par le cadrage.
- Résultat: **1131 tests sur 1131** dans 66 fichiers (51 de plus qu'au handoff 0.3). Bout en bout: **10 scénarios sur 10**, sans modification des scénarios.
- Couverture de `packages/sim` et `packages/shared`: **99,75 pour cent** (99,74 au handoff précédent); `shared` 100, `sim` 99,63.
- État de la CI: voir la section en fin de document.

## Décisions et écarts au plan

Les six décisions sont au journal du README. Trois points méritent d'être lus ici.

### 1. Les scénarios de bout en bout n'avaient rien à adapter

Le handoff 0.3 annonçait qu'ils seraient à reprendre. La partie rapide conserve la règle du premier salon en attente, restreinte aux parties publiques, et toutes les parties créées sans configuration sont publiques: Bob rejoint toujours Alice sans code, et `jeu.partie()` trouve toujours une seule partie. Seuls deux commentaires du harnais parlaient encore de l'ancienne règle.

### 2. Pas de niveau au salon

La fiche autorisait une source temporaire. Il n'y en a aucune qui ne soit pas inventée: le niveau se déduit de l'XP d'un compte (cadrage, section 5), et les comptes n'existent pas encore. Le champ n'est donc pas ajouté au contrat, plutôt que d'être rempli d'une valeur fausse.

### 3. Une partie privée ne se trouve pas par son identifiant

L'identifiant d'une room n'est pas un secret: il circule dans les messages. Accepter une entrée par identifiant aurait rendu le code décoratif. Le refus est mot pour mot celui d'une partie inexistante, pour ne pas confirmer qu'elle existe.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **Aucun écran pour créer, lister ou saisir un code.** C'est le périmètre de la fiche (« aucune interface »): la reprise des écrans de l'étape 4.3 au jalon 3 les construira sur les commandes déjà câblées.
- **Un code d'invitation ne se renouvelle pas.** Il vit autant que la partie. Suffisant pour une partie entre amis; à reprendre si des codes se mettent à circuler publiquement.

Repris du handoff 0.3, inchangé: **deux questions attendent le porteur du projet** (section 8 du cadrage), jouer sans compte (à trancher avant l'étape 3.2) et les valeurs des récompenses (étape 3.3). Le reste: voir la section « Problèmes connus et dette » du handoff 4.4.

## État de la CI

À compléter après la poussée.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 3.1, base de données et schéma. **C'est la section 3 du ROADMAP qui la désigne**: le jalon 3 enchaîne `3.1`, `3.2`, `3.3`.

Quatre points à avoir en tête dès le début:

1. **Lire la section « Ajustements venus du cadrage » de la fiche 3.1**, puis la section 5 du cadrage: ni niveau ni palier stockés, pas de gemmes, pas de table de défis; le résultat de partie porte aussi l'identifiant commun de la partie, le miroir, la durée, le nombre de joueurs, les captures et les Black Ninjas détruits.
2. **L'étape a besoin d'un accès à Neon**: un projet, une chaîne de connexion par le pooler, et une clé d'API pour créer et supprimer une branche de test par exécution. Vérifier d'abord ce qui est disponible sur la machine et dans les secrets de la CI. S'il manque, c'est une condition d'arrêt: le demander au porteur du projet plutôt que de simuler la base.
3. **Le mode d'une partie existe maintenant** (`MODES`, `EtatPartie.mode`): le résultat de partie peut le référencer tel quel.
4. **La question de l'accès sans compte** n'est pas un préalable à 3.1, mais à 3.2: la rappeler dans le handoff 3.1 si elle n'est pas tranchée.

## Étape suivante

Fiche à lire: `docs/plan/etape-3-1.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`.
