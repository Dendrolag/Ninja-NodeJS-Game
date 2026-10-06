# Handoff - Étape 2.9 Le flux par destinataire

Date: 6 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Le serveur décide ce que chaque joueur reçoit de l'état d'une partie. En Chasse, un traqueur qui lit le flux depuis son navigateur ne peut plus distinguer une proie d'un PNJ, ni par son type, ni par son identifiant, ni par son pseudo, ni par sa couleur. Les modes qui n'ont rien à cacher gardent une trame commune.

## Ce qui a été fait

- **Fiche rédigée** selon le cas de repli du PROTOCOLE et commitée avant l'exécution (`76dba99`).
- **Décision du porteur du projet, posée au début de l'étape**: la couleur trahissait aussi les proies (palette pour les joueurs, jamais pour les PNJ, couleurs au classement). Choix retenu: en Chasse, les PNJ naissent aux couleurs des joueurs. Écartés: masquer la couleur des proies aux traqueurs, ou ne rien changer.
- **Moteur**: en Chasse, chaque PNJ naît de la couleur d'un joueur présent, tirée au sort, jamais celle des traqueurs (`couleurDeSosie`); la contagion entre bots y est coupée (`sansContagion` dans `regleChasse`); un joueur de la Chasse ne porte aucun ninja (`scoreDe`).
- **Vues** (`packages/server/src/vues.ts`, pur): `cleDeVue` dit la vue de chacun, `vuesDe` les construit, `notificationDansLaVue` passe une notification par la vue de son destinataire. En Chasse, la vue commune va aux proies et à un traqueur sous Révélation; la vue des traqueurs, aux autres traqueurs, éliminés compris, et à un inconnu. Elle montre une proie comme un PNJ, sous un alias (HMAC-SHA256 de l'identifiant sous un secret tiré par partie), range les ninjas par alias, efface une proie cachée dans une zone d'invisibilité, masque le poseur d'une mine.
- **Flux** (`FluxParVue`, `fluxDEtat.ts`): une référence de delta par vue; qui entre, change de vue ou attend une image reçoit l'image de sa vue et pas le delta; une vue sans destinataire est oubliée.
- **Couche réseau**: `diffuserLeBattement` envoie une trame par vue, par un seul envoi Socket.IO à ceux qui la partagent; le secret des alias est tiré à la première diffusion d'une partie.
- **Banc de charge**: la projection et le codage se mesurent vue par vue. Mesure alternée avant/après, section 27 de `docs/mesures/charge-serveur.md`: Chasse +14 pour cent par battement (0,437 à 0,498 ms à 150 bots), même poids de message; Classique inchangé.
- **Version 1.7.4**: la couleur des PNJ de la Chasse se voit. Capture: `docs/design/etape-2-9/1-vue-du-traqueur.png`.

## Fichiers créés ou modifiés

- `packages/sim/src/couleurs.ts`: `couleurDeSosie`. `bots.ts`: le tirage de la couleur selon le mode. `contacts.ts`: `sansContagion`, posé par la Chasse. `score.ts`: zéro ninja porté en Chasse.
- `packages/sim/src/couleurs.test.ts`, `chasse.test.ts`: sosies, contagion coupée, ninjas portés; le test « jamais la couleur des traqueurs » réécrit.
- `packages/server/src/vues.ts` et `vues.test.ts`: créés.
- `packages/server/src/fluxDEtat.ts` et `fluxDEtat.test.ts`: `FluxParVue`, la cadence vérifiée par une fonction partagée.
- `packages/server/src/ServeurSocket.ts`: la diffusion par vue. `index.ts`: les exports pour le banc.
- `packages/server/src/ServeurSocket.test.ts`: le retardataire reçoit trois trames au lieu de quatre. `ServeurSocket.chasse.test.ts`: deux tests d'intégration.
- `tests/charge/battement.ts`: la mesure par vue.
- `packages/shared/src/version.ts`: 1.7.4.
- Documentation: la fiche `docs/plan/etape-2-9.md` (réconciliation), le ROADMAP, le journal `docs/design/README.md`, `CLAUDE.md` (comportement 11), l'étude Among Ninjas (le socle existe), la fiche 7.3 (décision 6 révisée), `docs/mesures/charge-serveur.md` (section 27) et ses trois fichiers JSON, la capture.

Aucune modification de `legacy/`, de `tests/caracterisation/`, du paquet partagé hors version, ni de la page.

## Tests

- Ajoutés: 45. Moteur (sosies, couleur des traqueurs exclue, repli sans joueur, contagion coupée, zéro ninja porté). Vues (clé de chacun, vue commune identique à l'instantané, vue des traqueurs sans type, identifiant ni pseudo de proie, rangement par alias, zone d'invisibilité, poseur de mine, classement, alias stables, distincts, liés au secret, notifications masquées une par une). `FluxParVue` (une trame par vue, image à qui change de vue, clients simulés qui reconstruisent exactement leur vue sur trente battements, cadence, vue oubliée, attente gardée). Réseau: un traqueur ne reçoit ni type, ni identifiant, ni pseudo de proie, et la proie reçoit la vue commune; une proie infectée passe à la vue des traqueurs et la reconstruit à l'identique de celle de l'autre traqueur.
- Résultat: 3 660 tests unitaires au vert; types, linter et formatage au vert; scénarios de bout en bout `chasse`, `retour`, `multijoueur`, `hud-lisible` et `navigation` au vert en local. Tests de la base sautés en local, joués par la CI.
- Couverture de packages/sim: 99,79 pour cent des instructions (99,75 au handoff 8.10); `couleurs.ts` et `score.ts` à 100.
- Empreinte des quatre parties de référence: identique avant et après l'étape, jeu et flux.
- État de la CI: voir la section « Prochaine action exacte » si elle n'est pas encore verte au moment de la lecture.

## Décisions et écarts au plan

Détail dans la section « Réconciliation » de la fiche.

- **Couleur des PNJ de la Chasse**: décision du porteur du projet, ci-dessus.
- **Prises sans le porteur du projet, à signaler**: la vue commune pour un traqueur sous Révélation (le bonus montrait déjà les vrais joueurs); la vue la plus restrictive pour un destinataire inconnu; une proie cachée dans une zone d'invisibilité absente de la vue des traqueurs (la page l'effaçait déjà); la zone d'invisibilité laissée à la page hors Chasse, comme l'étude le jugeait acceptable; le retardataire qui ne reçoit plus le delta inapplicable.
- **Limite assumée**: ce qu'un joueur a vu légitimement, il le garde. Une proie infectée, ou un traqueur sous Révélation, sait où étaient les proies, et un client modifié les suit ensuite sans les perdre dans la foule. Changer les alias n'y ferait rien, les positions se suivant d'un battement à l'autre.

## Problèmes connus et dette

- **La branche de collision des alias n'est pas testée**: une collision de 48 bits ne se provoque pas sans brancher le condensé. Elle recondense jusqu'à trouver un alias libre; une chance sur des milliers de milliards par partie.
- **Le classement dit toujours les points de chacun**: un client modifié peut corréler la montée des points d'une proie, qui marque en marchant, avec les ninjas qui bougent. Un joueur attentif le peut aussi, à l'œil: c'est une règle du jeu, pas une fuite du flux. À poser au porteur du projet s'il veut aller plus loin.
- Rien d'autre d'ouvert.

## Prochaine action exacte

Vérifier que la CI de `master` est verte sur le commit de l'étape et que la mise en ligne a eu lieu (production Oracle et secours Render au même commit). Aucune étape n'est planifiée ensuite: demander au porteur du projet la suite, en lui rappelant les questions ouvertes des études du 3 octobre (`docs/design/etude-combat-survie-et-carte-geante.md`, section 12) et du 5 octobre (`docs/design/etude-mode-among-ninjas.md`, section 19). Vers le 10 novembre 2026, vérifier que la machine Oracle tourne toujours et clore la 5.9.

## Étape suivante

Fiche à lire: aucune, la suite est à demander au porteur du projet.
