# Handoff - Étape 1.7 Pause de partie

Date: 18 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Porter la pause du legacy, restée sur le bord de la route pendant toute la phase 1: un état de pause dans le moteur, le temps de jeu qui cesse de s'écouler, l'exposition par `GameRoom`, et les événements réseau correspondants.

## Ce qui a été fait

- **La fiche de l'étape n'existait pas.** Elle a été rédigée depuis l'entrée ROADMAP et le handoff 2.2, selon le cas de repli du PROTOCOLE, puis commitée avant exécution (commit `64f581e`, séparé de l'implémentation).
- Le moteur connaît la pause. `EtatPartie` porte un indicateur, deux fonctions pures le font basculer, et `tick` gèle tout le reste.
- La comptabilité de durée cumulée du legacy a disparu, sans être remplacée. Voir la section « Décisions ».
- La room expose la pause **sans jamais arrêter sa boucle**, ce qui était la principale consigne du handoff 2.2.
- Le contrat d'événements est complété, pas contourné: quatre événements ajoutés, et la mention de la pause retirée de la liste des événements legacy non portés.
- La question laissée ouverte par le handoff 2.2, qui a le droit de mettre en pause, est tranchée: l'hôte.
- Un piège que personne n'avait vu a été trouvé et fermé: le journal d'événements du battement. Voir la section « Décisions ».
- Trente-deux tests ajoutés. **728 tests passent**, couverture inchangée à 99,73 pour cent.

## Comment la pause fonctionne, en une page

**Dans le moteur.** `EtatPartie.enPause` est faux à la création. `mettreEnPause(etat)` et `reprendre(etat)` rendent un nouvel état, comme toutes les autres transformations. Le moteur ne retient PAS qui a demandé la pause: il n'a jamais connu ni session ni hôte, et n'a aucune raison de commencer.

**Pendant un battement suspendu**, `tick` rend un état identique à deux exceptions près, et chacune a sa raison:

1. **Le compteur de battements avance**, parce qu'un battement a réellement eu lieu. C'est ce qui tient la promesse du contrat réseau, où le numéro de battement d'un instantané croît de un à chaque envoi.
2. **Le journal d'événements repart vide.** C'est le piège de l'étape, décrit plus bas.

Rien d'autre ne bouge: pas une position, pas une durée de bonus, pas un compte à rebours d'apparition, pas le temps écoulé. Conséquence directe: `evaluerFinDePartie` ne peut pas conclure, et **une partie suspendue ne se termine jamais d'elle-même**.

**Dans la room.** `enPause` en lecture, `mettreEnPause()` et `reprendre()` en écriture. Une demande qui ne change rien ne fait rien. Agir sur une partie qui n'est pas en cours lève, parce que c'est une faute de l'appelant et non un refus adressé à un joueur: la couche réseau vérifie le statut avant d'appeler. La boucle continue de battre.

**Sur le réseau.** Deux montants, `mettreEnPause` et `reprendre`, réservés à l'hôte. Deux descendants, `partieEnPause` (avec le pseudo de l'hôte, pour que le bandeau puisse le nommer) et `partieReprise`. Plus un indicateur `enPause` dans `InstantanePartie`, parce que la pause est un **état** et pas seulement un événement: un joueur qui entre dans une partie déjà suspendue l'apprend par le flux, sans avoir eu à assister à l'annonce.

## Fichiers créés ou modifiés

Créés

- `docs/plan/etape-1-7.md`: la fiche de l'étape, absente jusque-là.
- `packages/sim/src/pause.ts`: les deux fonctions pures, et l'explication de ce que le legacy faisait à la place.
- `packages/sim/src/pause.test.ts`: 16 tests unitaires.

Modifiés, dans `packages/sim/src/`

- `etat.ts`: le champ `enPause` dans `EtatPartie`, faux à la création.
- `moteur.ts`: le gel du battement, dans une fonction `battementSuspendu` isolée et commentée.
- `index.ts`: exports de l'étape.

Modifiés, dans `packages/shared/src/`

- `evenements.ts`: les deux événements montants, les deux descendants, la charge utile `PartieEnPause`, l'indicateur dans `InstantanePartie`, et le retrait de la mention de la pause dans la liste des non-portés.
- `index.ts`: export de `PartieEnPause`.

Modifiés, dans `packages/server/src/`

- `GameRoom.ts`: le getter, les deux méthodes, et un garde-fou commun `exigerUnePartieEnCours`.
- `GameRoom.test.ts`: 6 tests.
- `ServeurSocket.ts`: un gestionnaire unique pour les deux demandes, branché sur les deux événements.
- `ServeurSocket.test.ts`: 9 tests d'intégration, plus l'indicateur ajouté à la liste des clés attendues du flux d'état.
- `instantane.ts`: l'indicateur dans la projection.
- `instantane.test.ts`: 1 test, plus la même liste de clés.

Modifiés, dans `docs/`

- `plan/ROADMAP.md`: l'entrée 1.7 annonçait « les trois événements réseau »; il y en a quatre. Corrigé.
- `plan/etape-1-7.md`: section « Réconciliation ».
- `design/README.md`: cinq décisions datées du 18 août 2026.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: 32. Seize sur le moteur (le gel du temps, des entités, des effets, des objets, du journal, et la fin de partie impossible), six sur la room (dont le fait que la boucle continue de battre), neuf d'intégration réseau (autorité, annonces, cantonnement à une partie, idempotence), un sur la projection.
- Résultat: **728 tests Vitest passent, 0 échec** (696 au handoff 2.2).
- Couverture: **99,73 pour cent** des instructions sur `packages/sim` et `packages/shared`, inchangée. `pause.ts` et `moteur.ts` sont à 100 pour cent sur les quatre indicateurs.
- Types, linter, formatage: verts. `pnpm verify` passe.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés. Ils ne couvraient pas la pause, et ne la couvrent toujours pas: le legacy n'en avait aucun test et la caractérisation de l'étape 0.2 ne l'a pas relevée.
- CI: **verte**. Run 32150492816 sur `reecriture`, tous les travaux au vert, y compris les quatre scénarios Playwright de bout en bout.

## Décisions et écarts au plan

Les cinq décisions de fond sont au journal de `docs/design/README.md`, datées du 18 août 2026. Les écarts à la fiche sont dans sa section « Réconciliation ». Quatre points méritent d'être lus ici.

### 1. La pause est réservée à l'hôte

C'était la question laissée ouverte par le handoff 2.2, et le legacy ne faisait pas autorité. Chez lui (`server.js:2710`), **n'importe quel joueur** peut suspendre la partie de tous les autres, et seul celui qui l'a suspendue peut la reprendre; sa déconnexion la reprend automatiquement, ce qui est un rattrapage et non une règle.

Décision: la pause suit la même autorité que les réglages, le lancement et l'annulation du décompte. Trois raisons. C'est le seul modèle d'autorité que le serveur connaisse déjà, et il est vérifié en un seul endroit. La règle du legacy donne à chaque joueur un moyen d'interrompre la partie des autres aussi longtemps qu'il le souhaite. Et le transfert de propriété du salon (comportement à préserver numéro 8) règle gratuitement le cas de l'hôte qui part pendant une pause.

**Corollaire assumé**: une partie suspendue par un hôte qui s'en va reste suspendue jusqu'à ce que le nouvel hôte la reprenne. Elle ne redémarre pas toute seule. C'est un choix, pas un oubli.

### 2. Le piège du journal d'événements

Il ne figurait dans aucun document et n'a été trouvé qu'en écrivant le gel du battement.

Le journal `etat.evenements` est lu par la couche réseau juste après le battement, puis effacé au battement suivant. Un état de pause rendu **strictement** inchangé, ce qui semble la définition même de « rien ne se passe », rejouerait donc le journal du dernier battement actif à chaque battement de la pause, soit vingt fois par seconde. Un joueur capturé juste avant la pause recevrait la même notification en boucle jusqu'à la reprise.

Rien dans les types ne le signale, aucune erreur n'est levée, et cela ne se voit qu'en mettant en pause juste après une capture. Un test lui est consacré, et c'est la seule chose qui l'empêche de revenir.

### 3. Deux demandes explicites, et non une bascule

Le legacy avait un `togglePause` unique, ce qui l'obligeait à retenir qui l'avait actionné pour savoir qui pouvait le défaire. Une bascule n'est pas idempotente: un message réémis, ou deux clics trop rapprochés, laissent la partie dans l'état inverse de celui que le joueur voit sur son écran.

D'où quatre événements réseau au lieu des trois annoncés par le ROADMAP, qui reportait simplement le compte du legacy. L'entrée ROADMAP a été corrigée. C'est déjà la forme retenue pour `demarrer` et `annulerDemarrage`.

### 4. La comptabilité de durée de pause disparaît

Le legacy cumulait le temps passé en pause dans `totalPauseDuration` et le retranchait de l'heure du mur à chaque lecture du temps restant. Il recopiait cette comptabilité dans les cinq endroits qui remettaient une partie à zéro.

Ici il n'y a rien à cumuler: le temps de jeu n'avance que de ce que `tick` lui donne, et pendant la pause il ne lui donne rien. Le problème disparaît avec la comptabilité qui le résolvait, et avec elle cinq occasions de se tromper.

### Ce que cette étape rend structurellement impossible

- **Un joueur ne peut plus bloquer la partie des autres.** La pause passe par le même contrôle d'autorité que le reste.
- **Une pause ne peut plus dériver le temps de jeu.** Il n'y a plus de durée cumulée à tenir juste; le temps ne passe pas, donc il n'y a rien à rattraper.
- **Une partie ne peut plus se terminer pendant qu'elle est suspendue.** Ce n'est pas une garde ajoutée quelque part, c'est une conséquence du fait que le temps écoulé n'augmente pas.
- **Une demande de pause ne peut pas franchir la frontière d'une partie.** Comme tout le reste depuis l'étape 2.2, l'annonce part à la salle Socket.IO de la room, et un test le vérifie.

## Problèmes connus et dette

Rien de nouveau n'est laissé ouvert par cette étape. La dette listée ci-dessous est celle du handoff 2.2, reprise telle quelle, moins la pause qui vient d'être portée.

- **Une pause coûte la même bande passante qu'une partie qui tourne.** L'instantané continue de partir vingt fois par seconde pour dire que rien n'a changé. C'est assumé: c'est ce qui permet à un joueur d'entrer dans une partie suspendue et d'y voir quelque chose. Si la mesure de l'étape 5.1 montre que cela coûte, c'est l'étape 2.3 qui le traitera, comme pour tout le reste du flux.
- **Le terrain n'est toujours pas décodé.** Inchangé depuis 2.1, et c'est le manque fonctionnel le plus visible: le jeu tourne sans aucun mur. Il demande une dépendance de décodage PNG et le déplacement des images hors de `legacy/`, qui est figé. À traiter au plus tard avec le client, qui a besoin des mêmes images.
- **Sans identifiant de partie, on entre dans la première qui attend, et on en ouvre une s'il n'y en a aucune.** Comportement du legacy, provisoire, remplacé par l'étape 2.4.
- **Le retour au salon après une partie n'existe toujours pas.** Question ouverte depuis 2.1, non tranchée: une partie terminée refuse les nouveaux joueurs et se détruit quand elle se vide.
- **Aucune reconnexion.** Retrouver sa place après une coupure suppose une session qui survit à la connexion, ce qui appartient à 3.2. En attendant, une coupure fait perdre la partie en cours.
- **Aucune capacité maximale par partie.** Inchangé depuis 2.1, se décide avec le matchmaking en 2.4.
- **Le chat ne porte pas d'horodatage.** Le client date le message à l'arrivée. Suffisant tant qu'il n'y a pas d'historique à reconstituer.
- **Aucune mesure de charge.** C'est l'étape 5.1, et c'est sa mesure qui décidera de l'étape 2.3.
- **`packages/client` reste vide.** Normal jusqu'à l'étape 4.1.
- **`tsc --build` peut laisser une compilation périmée.** Inchangé depuis 1.1. `tsc --build --force` corrige.
- Le dépôt pèse toujours 157 Mo, `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`. Inchangé depuis les handoffs 0.1 à 2.2.

Question ouverte pour la phase 4, sans effet sur le code d'aujourd'hui: la tension numéro 7 de `docs/design/README.md` demande si le bouton « Terminer » du HUD de la maquette est un abandon de partie, une pause renommée, ou un artefact. La pause existant désormais côté serveur, la question se tranche à l'étape 0.3 ou 4.3 avec un contrat complet sous les yeux.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 4.1, squelette client et couche réseau. Lire `docs/plan/etape-4-1.md`, et lui appliquer les trois adaptations que le jalon 1 impose, écrites à la section 3 de `docs/plan/ROADMAP.md`: le flux d'état reste en JSON, pas de session authentifiée, et les écrans sont ceux du legacy (accueil et pseudo, salon, jeu, fin de partie) et non les sept écrans de la maquette. L'exigence de conception à ne pas manquer: **isoler la couche réseau derrière une interface**, pour que le passage éventuel au delta binaire en 2.3 ne touche qu'elle.

Deux points à avoir en tête dès le début de l'étape 4.1:

1. **Le contrat d'événements est complet et fait foi.** Il est dans `packages/shared/src/evenements.ts`, il est typé des deux côtés, et la liste des événements legacy non portés en fin de fichier dit pourquoi chaque absent est absent. Le client s'écrit contre ce fichier, jamais contre le client du legacy.
2. **Le client ne doit surtout pas inverser ses commandes** quand le malus de contrôles inversés est actif: c'est le moteur qui s'en charge depuis l'étape 1.4, et le faire des deux côtés annulerait le malus. Décision du 14 août 2026 au journal de conception.

## Étape suivante

Fiche à lire: `docs/plan/etape-4-1.md`, avec les adaptations de la section 3 de `docs/plan/ROADMAP.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre d'exécution qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 4.1 suit maintenant 1.7, puis viennent 4.2, 4.3 et 4.4 pour fermer le jalon 1.
