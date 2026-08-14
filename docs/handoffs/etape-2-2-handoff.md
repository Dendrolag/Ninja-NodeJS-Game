# Handoff - Étape 2.2 Couche Socket.IO et contrats d'événements

Date: 14 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Exposer les rooms au réseau via Socket.IO, avec deux contrats d'événements typés partagés, de sorte qu'un message mal formé devienne une erreur de compilation.

## Ce qui a été fait

- Les deux contrats d'événements existent dans `packages/shared` et sont utilisés des deux côtés. Un client mal formé ne compile pas, et un test le prouve.
- Le serveur tourne pour de bon. `pnpm dev:server` le lance, il répond en HTTP et Socket.IO ouvre ses connexions. C'est la première fois depuis le début de la réécriture qu'il existe un exécutable.
- Les émissions sont cantonnées par partie, via le mécanisme de salles de Socket.IO. Deux parties tournent côte à côte sans qu'un seul message franchisse la frontière, et un test le vérifie message par message.
- Le compte à rebours de démarrage est écrit. C'était le dernier comportement à préserver de CLAUDE.md dont la logique n'existait nulle part.
- La validation de l'étape 1.6 et la limitation de débit sont branchées à la frontière, ce pour quoi elles avaient été écrites.
- Quatre-vingts tests ajoutés. **696 tests passent**, couverture inchangée à 99,73 pour cent.
- Un manque réel du portage a été découvert et planifié: la pause de partie. Voir la section « Décisions et écarts ».

## Les deux contrats, en une page

Ils sont dans `packages/shared/src/evenements.ts`, avec pour chaque événement le nom legacy qu'il remplace.

### Client vers serveur

| Événement          | Charge utile                | Remplace                                                  |
| ------------------ | --------------------------- | --------------------------------------------------------- |
| `rejoindre`        | `DemandeRejoindre` + accusé | `joinWaitingRoom`, `rejoinWaitingRoom`, `joinRunningGame` |
| `quitter`          | rien                        | `leaveWaitingRoom`                                        |
| `deplacer`         | `IntentionDeplacement`      | `move`                                                    |
| `chat`             | `DemandeChat`               | `chatMessage`                                             |
| `reglages`         | `ReglagesPartiels`          | `updateGameSettings`, `updateMapSettings`                 |
| `demarrer`         | rien                        | `startGameFromRoom`                                       |
| `annulerDemarrage` | rien                        | `cancelGameStart`                                         |

**Seul `rejoindre` porte un accusé de réception**, parce que c'est la seule demande dont le joueur ne peut pas deviner le résultat en regardant son écran. Tous les autres refus arrivent par l'événement `refus`, qui dit à quelle action il répond.

### Serveur vers client

Flux d'état: `etat` (`InstantanePartie`), à chaque battement.

Salon: `salon`, `joueurArrive`, `joueurParti`, `chat`.

Cycle de partie: `compteARebours`, `demarrageAnnule`, `partieLancee`, `partieTerminee`.

Notifications adressées: `captureSubie`, `captureReussie`, `captureParBotNoir`, `botNoirDetruit`, `bonusActive`, `malusRamasse`, `malusSubi`.

Refus: `refus`.

### La charge utile du flux d'état, que l'étape 2.3 convertira

```ts
interface InstantanePartie {
  tick: number; // croît de un à chaque instantané
  tempsRestantMs: number; // jamais négatif
  entites: EntiteVue[]; // joueurs, bots et bots noirs mêlés
  objets: ObjetVu[]; // bonus et malus posés
  zones: ZoneVue[];
  classement: LigneClassement[];
}
```

`EntiteVue` est `{ id, x, y, couleur, direction }`, plus `{ pseudo, invincible, protege }` pour un joueur. Volontairement plate: des nombres, des chaînes courtes, aucune table imbriquée profonde, aucune valeur absente. Un format binaire se dérive directement d'une forme pareille.

**Ce que le flux ne contient pas, et ne doit jamais contenir**: le terrain (constant, énorme, déductible de la carte choisie), la graine (elle permettrait de prédire toutes les apparitions à venir), et les compteurs internes des joueurs. Deux tests le vérifient explicitement, dont un qui sérialise l'instantané et cherche les mots interdits.

## Architecture de la couche réseau

`ServeurSocket` fait exactement quatre choses, et aucune n'est de la logique de jeu.

1. **Elle valide.** Chaque message traverse un schéma de `@neon-ninja/shared` avant d'aller plus loin. Les paramètres sont traités comme des `unknown` quoi qu'en dise leur type déclaré: un client modifié n'a jamais compilé le contrat.
2. **Elle limite.** Un seau à jetons par connexion et par famille (`deplacement`, `chat`, `reglages`, `autresActions`). Un joueur qui inonde le chat ne voit pas ses déplacements refusés.
3. **Elle route.** `socket.join(idRoom)` à l'entrée, `io.to(idRoom).emit(...)` partout ailleurs. Jamais un `io.emit` global, que le legacy utilisait partout.
4. **Elle traduit.** `instantaneDe(etat)` pour le flux, `notificationsDe(etat)` pour les faits du battement.

Trois fichiers séparent les responsabilités: `instantane.ts` est **pur** (état vers données, testable sans monter de serveur), `compteARebours.ts` ne connaît que son horloge, `ServeurSocket.ts` est le seul à connaître une socket.

## Fichiers créés ou modifiés

Créés, dans `packages/shared/src/`

- `evenements.ts`: les deux contrats, les types de charge utile, et la liste commentée des événements legacy **non portés** avec la raison de chacun. Cette liste fait partie du contrat: elle évite qu'une étape ultérieure les réintroduise par habitude.

Créés, dans `packages/server/src/`

- `ServeurSocket.ts`: la frontière réseau.
- `ServeurSocket.test.ts`: 36 tests d'intégration, avec de vrais clients `socket.io-client` sur un vrai port.
- `instantane.ts`: la projection vers le réseau, pure.
- `instantane.test.ts`: 16 tests, dont ceux qui vérifient ce qui ne fuit pas.
- `compteARebours.ts`: le décompte de démarrage.
- `compteARebours.test.ts`: 10 tests, la séquence entière annonce par annonce.
- `serveur.ts`: le montage HTTP plus Socket.IO, séparé de l'écoute pour que les tests ouvrent un port libre.
- `principal.ts`: le point de démarrage, avec extinction propre sur `SIGINT` et `SIGTERM`.

Modifiés

- `packages/server/src/GameRoom.ts`: rappel `surBattement`, méthode `changerReglages`, et `StatutRoom` devenu un alias du `StatutPartie` de `shared`.
- `packages/server/src/GameRoom.test.ts`: 9 tests sur les deux ajouts.
- `packages/server/src/RoomManager.ts`: propagation de `surBattement`.
- `packages/server/src/index.ts`: exports de l'étape.
- `packages/server/package.json`: dépendances `socket.io` et `socket.io-client`, scripts `dev` et `start`.
- `packages/shared/src/entrees.ts`: `DemandeRejoindre` et `DemandeChat`.
- `packages/shared/src/bornes.ts`: `BORNES_ROOM`, liste blanche pour l'identifiant de partie.
- `packages/shared/src/validation.ts`: `validerDemandeRejoindre`.
- `packages/shared/src/validation.test.ts`: 9 tests sur ce schéma.
- `packages/shared/src/constantes.ts`: le type `Couleur`, désormais défini une seule fois pour les trois paquets.
- `packages/sim/src/couleurs.ts`: republie ce type au lieu de le redéfinir.
- `packages/shared/src/index.ts`: exports.
- `package.json`: script `dev:server`.
- `vitest.config.ts`: `evenements.ts` exclu de la couverture, comme les autres fichiers de types.
- `CLAUDE.md`: la section Commandes annonçait qu'aucun serveur n'était exécutable. C'est faux depuis cette étape.
- `docs/plan/ROADMAP.md`: étape 1.7 ajoutée, jalon 1 passé à quinze étapes, écart 5 consigné.
- `docs/plan/etape-2-2.md`: section « Réconciliation », sept écarts.
- `docs/design/README.md`: six décisions du 14 août 2026.

Aucune modification de `packages/sim` autre que la republication d'un type, ni de `legacy/`, ni de `tests/caracterisation/`.

## Tests

- Ajoutés: 80 tests. 36 d'intégration réseau, 16 sur la projection, 10 sur le décompte, 9 sur `GameRoom`, 9 sur le nouveau schéma de validation.
- Résultat: **696 tests Vitest passent, 0 échec** (616 au handoff 2.1).
- Couverture: **99,73 pour cent** des instructions sur `packages/sim` et `packages/shared`, inchangée. `packages/shared` est à 100 pour cent.
- Types, linter, formatage: verts. `pnpm verify` passe.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.
- `pnpm audit --prod`: aucune vulnérabilité. C'est la vérification que la faille S5 de l'audit demandait, et elle a maintenant un sens: le serveur a de vraies dépendances (`socket.io` 4.8.3 et sa chaîne). À refaire à chaque ajout de dépendance.
- Vérification manuelle: le serveur lancé sur un port répond en HTTP et complète la poignée de main Socket.IO.

**Les tests d'intégration simulent le temps, pas le réseau.** Le serveur reçoit une horloge manuelle, si bien qu'un décompte de cinq secondes et une partie de trente secondes passent en quelques millisecondes; les messages, eux, font un vrai aller-retour. Conséquence à connaître en écrivant un test: faire avancer l'horloge ne suffit pas à avoir reçu, il faut attendre le message. Et les seaux à jetons se remplissant avec l'horloge manuelle, une connexion ne dispose que de sa rafale de départ tant que le test n'avance pas le temps: c'est ce qui rend le test de limitation de débit possible sans attendre une seconde réelle.

## Décisions et écarts au plan

Les sept écarts à la fiche sont dans sa section « Réconciliation ». Les décisions de fond sont au journal de `docs/design/README.md`, datées du 14 août 2026. Trois points méritent d'être lus ici.

### 1. La pause de partie manque, et c'est devenu l'étape 1.7

Le legacy propose une pause (`togglePause`, `pauseGame`, `resumeGame`). Aucune étape de la phase 1 ne l'a portée: ni `EtatPartie` ni `tick` ne connaissent la notion. Elle ne pouvait pas se rattraper ici, parce que la pause est un état de la **partie**, donc du moteur, et que la fiche de cette étape interdit explicitement toute logique de jeu dans la couche réseau.

Traitée selon la règle 7 de CLAUDE.md: trop gros pour l'étape en cours, donc **planifiée comme étape à part entière** dans `docs/plan/ROADMAP.md`, jamais laissée comme ligne de dette. Elle est placée juste après 2.2 dans le jalon 1, avant le client, qui a besoin du contrat complet. **Sa fiche `docs/plan/etape-1-7.md` n'existe pas**: c'est le cas de repli du PROTOCOLE, la session qui l'exécutera la rédigera depuis l'entrée ROADMAP avant de commencer.

### 2. Deux ajouts à `GameRoom`, tous deux nécessaires au périmètre de l'étape

- **`surBattement`**: le journal `etat.evenements` est remis à zéro au battement suivant. Sans rappel, la couche réseau n'a aucun moment où le lire sans en perdre. Il est appelé **avant** `surFinDePartie`, pour qu'une capture faite dans la dernière demi-seconde parte quand même.
- **`changerReglages`**: sans elle, le salon du legacy n'était pas à parité. Elle refait l'état à neuf plutôt que de le retoucher, puis refait entrer les joueurs dans leur ordre d'arrivée. Un test vérifie que le résultat est identique à celui d'une partie créée d'emblée avec ces réglages. Une partie commencée refuse tout changement, là où le legacy écrivait dans `currentGameSettings` à la volée, carte comprise.

### 3. Express n'est pas ajouté

Le handoff 2.1 l'attendait ici et la pile du projet l'annonce. À cette étape il n'y a rien à servir: ni fichier client, ni route d'interface. Le module `http` de Node suffit et ne s'installe pas. Une dépendance sans usage est une dépendance que personne ne surveille, ce que la faille S5 de l'audit sanctionne précisément. Express arrivera avec le client de la phase 4.

### Ce que cette étape rend structurellement impossible

- **Un message ne peut plus fuir d'une partie vers une autre.** Le legacy diffusait par `io.emit`, à tout le serveur. Ce n'était pas grave tant qu'il ne pouvait exister qu'une partie; ça le deviendrait immédiatement maintenant qu'il peut en exister plusieurs.
- **Un client ne peut plus signer un message au nom d'un autre.** La faille S3 est fermée par construction: `validerMessageChat` appose la signature de la session au lieu de la vérifier, donc le champ fourni par le client n'est jamais lu. Un test envoie un `pseudo` dans le message et vérifie que le message rediffusé porte celui de la session.
- **Un client bavard ne peut plus saturer le serveur.** Faille S4: chaque message `move` du legacy déclenchait un relevé complet des collisions. Ici les seaux à jetons plafonnent le débit, et la vitesse ne dépend de toute façon plus du nombre de messages, ce qu'un test vérifie en comparant un joueur qui émet cinq fois à un joueur qui émet une fois.
- **Un identifiant de partie ne peut plus être n'importe quoi.** Il sert de clé de recherche et de nom de salle Socket.IO: il passe par une liste blanche, comme le pseudo.
- **Aucun décompte ne peut survivre à sa partie.** Le legacy tenait sa minuterie dans une variable de module partagée par toutes les connexions. Un test vérifie qu'une partie vidée pendant son décompte ne part pas toute seule.

## Problèmes connus et dette

- **La pause n'est pas portée.** Voir ci-dessus: c'est l'étape 1.7, pas de la dette.
- **Le terrain n'est toujours pas décodé.** Inchangé depuis 2.1, et c'est maintenant le manque fonctionnel le plus visible: le jeu tourne sans aucun mur. Il demande une dépendance de décodage PNG et le déplacement des images hors de `legacy/`, qui est figé. À traiter au plus tard avec le client, qui a besoin des mêmes images.
- **Sans identifiant de partie, on entre dans la première qui attend, et on en ouvre une s'il n'y en a aucune.** C'est le comportement du legacy, qui n'avait qu'un salon. C'est provisoire et remplacé par l'étape 2.4.
- **Le retour au salon après une partie n'existe toujours pas.** Question ouverte depuis 2.1, non tranchée: une partie terminée refuse les nouveaux joueurs et se détruit quand elle se vide. Le legacy avait un `resetAndReturnToWaitingRoom` réservé à l'hôte.
- **Aucune reconnexion.** Retrouver sa place après une coupure suppose une session qui survit à la connexion, ce qui appartient à 3.2. En attendant, une coupure fait perdre la partie en cours.
- **Aucune capacité maximale par partie.** Inchangé depuis 2.1, se décide avec le matchmaking en 2.4.
- **Le chat ne porte pas d'horodatage.** Le legacy envoyait un `Date.now()`. L'horloge du serveur est monotone et sa valeur absolue n'a aucun sens: le client date le message à l'arrivée. Suffisant tant qu'il n'y a pas d'historique de conversation à reconstituer.
- **Aucune mesure de charge.** La cadence de diffusion est celle du battement, vingt fois par seconde, comme le legacy. C'est l'étape 5.1 qui dira si elle tient avec N parties peuplées, et c'est sa mesure qui décidera de l'étape 2.3.
- **`packages/client` reste vide.** Normal jusqu'à l'étape 4.1.
- **`tsc --build` peut laisser une compilation périmée.** Inchangé depuis 1.1. `tsc --build --force` corrige.
- Le dépôt pèse toujours 157 Mo, `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`. Inchangé depuis les handoffs 0.1 à 2.1.

## Prochaine action exacte

Dans une conversation neuve: rédiger `docs/plan/etape-1-7.md` à partir de l'entrée « 1.7. Pause de partie » de `docs/plan/ROADMAP.md`, en prenant une fiche existante comme modèle, la commiter, puis l'exécuter. Point de départ concret du portage: la pause du legacy vit dans les variables de module `isPaused`, `pauseStartTime` et `totalPauseDuration` de `legacy/server.js`, et `calculateTimeLeft` en soustrait la durée cumulée. Dans le nouveau moteur, cela devient un champ de `EtatPartie` que `tick` consulte pour ne pas faire s'écouler le temps de jeu, ce qui supprime au passage la comptabilité de durée cumulée.

Trois points à avoir en tête dès le début de l'étape 1.7:

1. **Le contrat d'événements est déjà écrit et devra être complété**, pas contourné. Trois événements sont à ajouter dans `packages/shared/src/evenements.ts`, et la liste des événements legacy non portés, en fin de ce fichier, mentionne explicitement la pause: cette mention est à retirer en même temps.
2. **La pause doit arrêter le temps de jeu, pas la boucle.** Arrêter la boucle rendrait le serveur aveugle à ce qui arrive pendant la pause, et ferait ressurgir la question des minuteries orphelines. Le battement continue, le temps de jeu ne s'écoule plus.
3. **Qui a le droit de mettre en pause est une question à trancher**, et le legacy ne fait pas autorité: n'importe qui pouvait le faire chez lui, ce qui donne à chaque joueur un moyen d'interrompre la partie des autres. La poser dans le handoff si elle n'est pas évidente.

## Étape suivante

Fiche à lire: `docs/plan/ROADMAP.md`, entrée « 1.7. Pause de partie », puis rédiger `docs/plan/etape-1-7.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre d'exécution qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 1.7 suit maintenant 2.2, et où l'étape 4.1 suit ensuite.
