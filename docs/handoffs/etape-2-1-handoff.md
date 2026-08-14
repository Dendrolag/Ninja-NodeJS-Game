# Handoff - Étape 2.1 GameRoom et RoomManager

Date: 14 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Faire tourner plusieurs parties en parallèle, en enveloppant le moteur pur dans une room qui détient l'état d'une partie, et un RoomManager qui gère le cycle de vie des rooms. **Cette étape ouvre la phase 2.**

## Ce qui a été fait

- `packages/server` cesse d'être vide. Trois fichiers de code, trois fichiers de tests.
- Le temps entre dans le jeu par une **horloge injectée**, avec une horloge manuelle qui permet de jouer une partie entière en quelques millisecondes de test.
- `GameRoom` détient une partie: son état, ses réglages, ses joueurs, son hôte, son statut, la dernière intention de chacun, et sa propre boucle de battement.
- `RoomManager` ouvre, retrouve et ferme des parties. Deux parties tournent côte à côte sans se voir.
- La règle d'attribution de l'hôte du legacy, recopiée à cinq endroits là-bas, est écrite une seule fois.
- L'unicité du pseudo dans un salon est traitée, comme le demandait le handoff 1.6.
- Soixante-cinq tests ajoutés. 616 tests passent, couverture inchangée à 99,73 pour cent.

## L'interface de GameRoom, en une page

C'est ce que l'étape 2.2 exposera au réseau.

### Construire

```ts
new GameRoom({
  id,                 // attribué par le RoomManager
  graine,             // deux rooms de même graine et mêmes entrées sont identiques
  reglages?,          // ReglagesPartiels, complétés par les valeurs par défaut
  terrain?,           // CarteCollisions, décodée hors du moteur. Sans lui: carte sans mur
  horloge?,           // celle du système par défaut
  cadenceMs?,         // 50 par défaut, la cadence du legacy
  surFinDePartie?,    // appelé une fois, au battement où le temps de jeu est écoulé
});
```

### Lire

| Lecture        | Ce que ça rend                                             |
| -------------- | ---------------------------------------------------------- |
| `id`           | L'identifiant de la room. Ne change jamais.                |
| `graine`       | La graine de la partie, conservée pour pouvoir la rejouer. |
| `statut`       | `'salon'`, `'enCours'` ou `'terminee'`.                    |
| `etat`         | L'`EtatPartie` du moteur. À lire, jamais à modifier.       |
| `reglages`     | Les `ReglagesPartie` complets.                             |
| `hote`         | Qui commande. `undefined` quand la room est vide.          |
| `joueurs`      | `{ id, pseudo, hote }[]`, dans l'ordre d'arrivée.          |
| `estVide`      | Plus personne: le RoomManager la détruira.                 |
| `enMarche`     | La boucle de battement tourne-t-elle.                      |
| `classement()` | Le classement du moteur, du meilleur au moins bon.         |

### Agir

```ts
accueillir(session: SessionJoueur): ResultatValidation<JoueurDeRoom>
faireSortir(id): boolean
lancer(): void                          // lève si la partie a déjà commencé
enregistrerIntention(id, intention): void
avancer(dtMs): void                     // lève si la partie n'est pas en cours
arreter(): void                         // arrête la boucle, sans rien changer d'autre
```

### Deux façons de refuser, et elles ne se mélangent pas

- **Ce qu'un joueur peut légitimement demander** rend un verdict à afficher: `accueillir` rend un `ResultatValidation<JoueurDeRoom>`, le même type que les schémas de l'étape 1.6. Trois refus possibles: la partie est terminée (`champ: 'partie'`), la connexion est déjà dans la partie (`'session'`), le pseudo est déjà pris (`'pseudo'`).
- **Ce qui ne peut venir que d'une faute du code serveur** lève une erreur: `lancer` sur une partie commencée, `avancer` sur une partie qui n'a pas commencé. **L'étape 2.2 vérifie le statut et la qualité d'hôte avant d'appeler ces méthodes**, et attrape ce qui remonterait quand même.

### Ce que la room ne fait pas

1. **Elle ne valide pas les entrées.** Les schémas de `@neon-ninja/shared` s'appliquent à la frontière réseau, avant d'arriver ici. La room reçoit du typé. Le moteur, lui, garde sa dernière barrière, parce qu'il ne connaît pas ses appelants.
2. **Elle ne parle à personne.** Aucune diffusion, aucun message. Prévenir les clients est le travail de 2.2, qui lira `room.etat` et `room.etat.evenements`.
3. **Elle ne lit pas l'heure elle-même.** Son horloge lui est fournie.
4. **Elle ne tient pas les seaux à jetons.** La limitation de débit se branche par connexion, donc en 2.2 (voir handoff 1.6).

## L'interface de RoomManager

```ts
new RoomManager({ horloge?, cadenceMs?, genererGraine? })

creer({ graine?, reglages?, terrain?, surFinDePartie? }): GameRoom
room(id): GameRoom | undefined
rejoindre(idRoom, session): ResultatValidation<JoueurDeRoom>   // room inconnue = refus, champ 'room'
quitter(idRoom, idJoueur): boolean                             // détruit la room si elle se vide
detruire(idRoom): boolean                                      // arrête la boucle puis oublie la room
toutFermer(): void
nombreDeRooms, toutesLesRooms
```

Le RoomManager n'est pas une variable de module: c'est une classe qu'on instancie. Le point d'entrée du serveur en créera un à l'étape 2.2, et les tests en créent autant qu'ils veulent sans qu'ils se voient. `genererGraine` est le **seul endroit du serveur où du hasard non maîtrisé a sa place**: une partie doit différer de la précédente, et une fois la graine tirée tout ce qui suit en découle.

## Ce que cette étape rend structurellement impossible

- **Deux parties ne peuvent plus s'écraser.** Le legacy tenait `players`, `bots`, `currentGameSettings`, `waitingRoom` et `gameStartTime` dans des variables de module: il ne pouvait exister qu'une partie par serveur. Tout l'état d'une partie tient maintenant dans une instance. C'est la règle 5 de CLAUDE.md rendue structurelle, et c'est le déblocage central de la phase 2.
- **Aucune boucle ne survit à sa partie.** Une boucle appartient à la room qui l'a démarrée. Elle s'arrête à la fin du temps de jeu, à la destruction de la room, et l'arrêter deux fois ne fait rien. C'est le défaut X1 traité au niveau du serveur, après l'avoir été au niveau des apparitions à l'étape 1.4.
- **La vitesse ne dépend toujours pas du débit.** La room range **une intention par joueur**, pas une file de messages: recevoir dix messages entre deux battements ne produit qu'un déplacement. Un test le vérifie en comparant un joueur bavard à un joueur discret. C'est la faille S2 tenue à distance au niveau du serveur cette fois, et non plus seulement du moteur.
- **La succession de l'hôte ne dépend pas de la forme des identifiants.** La room tient l'ordre d'arrivée dans une liste, parce que l'ordre des clés d'une table JavaScript n'est pas l'ordre d'insertion dès qu'une clé ressemble à un entier, et que les identifiants viennent des connexions. Un test le vérifie avec les identifiants `10` et `2`.

## Fichiers créés ou modifiés

Créés, dans `packages/server/src/`

- `horloge.ts`: l'interface `Horloge`, l'horloge du système (`performance.now` et `setInterval`), et `creerHorlogeManuelle` pour les tests.
- `horloge.test.ts`: 12 tests. Nombre de rappels, heure lue par un rappel, arrêt depuis l'intérieur d'un rappel, cadences multiples.
- `GameRoom.ts`: la classe, `CADENCE_BATTEMENT_MS` (50) et `DT_MAXIMUM_MS` (250).
- `GameRoom.test.ts`: 35 tests. Cycle de vie du salon, attribution de l'hôte, lancement, battement, boucle, classement.
- `RoomManager.ts`: la classe et ses options.
- `RoomManager.test.ts`: 18 tests. Cycle de vie et, surtout, isolation entre plusieurs parties.

Modifiés

- `packages/server/src/index.ts`: exporte les trois modules, et dit ce que l'étape a posé.
- `docs/plan/etape-2-1.md`: section « Réconciliation », cinq écarts.
- `docs/design/README.md`: cinq décisions du 14 août 2026.

Aucune modification de `packages/sim`, de `packages/shared`, de `legacy/` ni de `tests/caracterisation/`. **Le moteur pur n'a pas eu à bouger d'une ligne pour être enveloppé**, ce qui est le meilleur signal que la phase 1 a été faite correctement.

## Tests

- Ajoutés: 65 tests d'intégration. Ils couvrent les trois tests requis par la fiche (cycle de vie d'une room, plusieurs rooms sans interférence, avancement d'un battement avec dt fourni) et ceux de ROADMAP.md.
- Résultat: **616 tests Vitest passent, 0 échec** (551 au handoff 1.6).
- Couverture: **99,73 pour cent** des instructions et 99,36 pour cent des branches sur `packages/sim` et `packages/shared`, inchangée. La mesure ne porte volontairement pas sur `packages/server`, conformément à la section « Cible de couverture » de CLAUDE.md: on couvre profond là où vit le gameplay, léger sur le code de liaison.
- Types, linter, formatage: verts.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.
- `pnpm audit --prod`: aucune vulnérabilité. C'est la vérification que le handoff 1.6 demandait pour la faille S5, et elle reste facile: `packages/server` n'a toujours aucune dépendance hors du dépôt. Les vraies dépendances (Express, Socket.IO) arrivent en 2.2, il faudra la refaire.

## Décisions et écarts au plan

Les écarts à la fiche sont dans sa section « Réconciliation ». Les décisions de fond sont au journal de `docs/design/README.md`, datées du 14 août 2026. En résumé:

1. **L'horloge est injectée**, comme la graine l'est pour le hasard. Rien d'autre dans le serveur n'appelle `Date.now` ni `setInterval`. `performance.now()` plutôt que `Date.now()`: la première est monotone, la seconde peut reculer quand la machine se resynchronise sur un serveur de temps, et un dt négatif ferait lever le moteur.

2. **La boucle appartient à la room.** `lancer()` la démarre, la fin de partie et `arreter()` l'arrêtent. L'alternative, un gestionnaire de boucles à part, laissait la porte ouverte à une boucle sans propriétaire, c'est-à-dire au défaut X1.

3. **Un battement rattrape au plus 250 millisecondes.** Protection du serveur, pas règle de jeu: elle ne s'applique qu'à la boucle, `avancer(dt)` reste fidèle. Un test simule un serveur figé dix secondes.

4. **Il n'y a pas de seconde liste de joueurs.** L'état de la partie dit qui joue; la room ajoute seulement l'ordre d'arrivée et l'identité de l'hôte, deux faits que le moteur ne porte pas. Un joueur du salon est donc déjà placé sur la carte avant le lancement, ce qui a un effet voulu: les bots, posés au lancement, évitent les positions des joueurs.

5. **Deux pseudos identiques sont refusés dans une même room**, comparaison faite sur le texte normalisé et sans distinction de casse. Le même pseudo reste libre dans une autre partie.

6. **Le terrain est injecté, pas décodé ici.** Voir le point 2 de la réconciliation.

7. **Aucun défaut hors périmètre à corriger au titre de la règle 7.** Rien de nouveau n'a été découvert, ni dans le legacy ni dans le nouveau code. Le seul point relevé en lisant `server.js` est que la règle d'attribution de l'hôte y est recopiée à cinq endroits avec des conditions légèrement différentes: ce n'est pas un défaut à corriger dans le legacy, c'est ce que le portage supprime en l'écrivant une seule fois.

## Ce que la prochaine étape doit savoir

L'étape 2.2 branche Socket.IO sur ces deux classes. Points d'attache, dans l'ordre où elle les rencontrera:

1. **Valider avant d'appeler.** `validerPseudo` puis `accueillir`, `validerIntentionDeplacement` puis `enregistrerIntention`, `validerReglages` avant de créer la room. La room ne valide rien.
2. **Tenir un seau à jetons par joueur et par type d'entrée** (`LIMITES_DEBIT` et `consommer`, écrits à l'étape 1.6), et lui passer le temps écoulé depuis le message précédent.
3. **La session fait autorité sur l'identité.** `accueillir` prend une `SessionJoueur`, jamais un nom fourni dans un message.
4. **Le compte à rebours de cinq secondes est à écrire**, annulable jusqu'à deux secondes (comportement à préserver numéro 7). Il se déclenche et s'annule par messages, donc il vit en 2.2. **Le faire décroître comme une donnée, pas avec un `setInterval`**, sinon le défaut X1 revient par la fenêtre.
5. **Décoder l'image de collision** de la carte choisie et passer le terrain à `creer`. Les images sont dans `legacy/assets/maps/<carte>/<normal|mirror>/collision.png`, à sortir de `legacy/` puisque ce dossier est figé. `carteDepuisPixels` attend quatre octets par pixel, ligne par ligne depuis le coin supérieur gauche. Sans terrain, le jeu tourne sans aucun mur: c'est jouable mais ce n'est pas le jeu.
6. **Le retour au salon après une partie n'existe pas.** Une room terminée refuse les nouveaux joueurs et se détruit quand elle se vide. Le legacy avait un `resetAndReturnToWaitingRoom` réservé à l'hôte. Deux voies: ouvrir une room neuve, ou ajouter une remise à zéro à la room. À trancher en 2.2.
7. **Ce que la room expose au réseau est déjà prêt**: `etat` pour la diffusion, `etat.evenements` pour les notifications du battement, `classement()` pour le tableau des scores, `joueurs` pour le salon.

## Problèmes connus et dette

- **Le terrain n'est pas encore décodé.** Voir le point 5 ci-dessus. C'est le seul manque fonctionnel de cette étape, et il est assumé: il demande une dépendance de décodage PNG et le déplacement des images hors de `legacy/`.
- **Aucune capacité maximale par room.** Le legacy n'en avait pas non plus. La palette ne contient que six couleurs de joueur distinctes, au-delà desquelles les couleurs sont tirées au hasard parmi seize millions: c'est dégradé, pas cassé. La capacité se décide avec le matchmaking, à l'étape 2.4.
- **Aucune reconnexion.** `wasOwner` du legacy n'est pas porté: retrouver sa place après une coupure suppose une session qui survit à la connexion, ce qui appartient à 2.2, voire à 3.2.
- **Une room vide est détruite immédiatement.** Pas de délai de grâce. Si la reconnexion arrive un jour, ce délai sera à ajouter ici.
- **La faille S5 de l'audit reste sans objet**, vérifié ce jour. À revérifier quand `packages/server` aura Express et Socket.IO.
- **Aucune optimisation spatiale**, inchangé depuis 1.3. La grille spatiale est à l'étape 5.2, conditionnée à la mesure de 5.1. C'est cette étape-ci qui fournit de quoi mesurer: N rooms peuplées, temps par battement.
- **Le contrôle de blocage des bots échantillonne**, inchangé depuis 1.5. Le pas de temps de la boucle étant fixé à 50 millisecondes et le rattrapage borné, il reste dans la plage où il a été réglé.
- **`packages/client` reste vide.** Normal jusqu'à l'étape 4.1.
- **`tsc --build` peut laisser une compilation périmée.** Inchangé depuis 1.1. `tsc --build --force` corrige. Sans conséquence sur les tests, qui lisent les sources.
- Le dépôt pèse toujours 157 Mo, `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`. Inchangé depuis les handoffs 0.1 à 1.6.

## Prochaine action exacte

Dans une conversation neuve: lire `docs/plan/etape-2-2.md`, puis définir dans `packages/shared` les contrats d'événements Socket.IO typés, dans les deux sens, avant d'écrire la moindre ligne de serveur. Point de départ concret: la liste des événements du legacy se relève dans `legacy/server.js` (les `socket.on` et `io.emit` de la section `io.on('connection')`, à partir de la ligne 2036), et chacun doit être confronté à la règle de l'étape 1.6, « le message d'un joueur ne contient que son intention, jamais son état ».

Trois points à avoir en tête dès le début de l'étape 2.2:

1. **Le serveur n'a encore aucune dépendance externe.** Express et Socket.IO sont à ajouter, et `pnpm audit --prod` est à relancer ensuite: c'est ce que demande la faille S5 de l'audit.
2. **La room ne valide rien et ne diffuse rien.** Tout ce qui manque entre le réseau et elle est le travail de 2.2, et la liste est dans la section « Ce que la prochaine étape doit savoir » ci-dessus.
3. **Le compte à rebours de démarrage est à écrire**: c'est le seul comportement à préserver de CLAUDE.md dont la logique n'existe encore nulle part dans le nouveau code. Sa durée est déjà une constante, `DUREES.COMPTE_A_REBOURS_S`. Le transfert de propriété du salon, le comportement voisin numéro 8, est porté par cette étape-ci.

## Étape suivante

Fiche à lire: `docs/plan/etape-2-2.md`

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre d'exécution qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 2.2 suit bien 2.1, et où l'étape 4.1 suit ensuite.
