# Fiche étape 2.9 - Le flux par destinataire

Brief de session. Objectif unique: le serveur décide ce que chaque joueur reçoit de l'état d'une partie. En Chasse, un traqueur qui lit le flux depuis son navigateur ne peut plus distinguer une proie d'un PNJ, ni par son type, ni par son identifiant, ni par son pseudo, ni par sa couleur. Les modes qui n'ont rien à cacher gardent une trame commune.

Fiche rédigée le 6 octobre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 2.9 du ROADMAP (section 4), de l'étude `docs/design/etude-mode-among-ninjas.md` (section 3), du handoff 5.14 et de l'état réel du dépôt.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 5.14, la section 3 de l'étude Among Ninjas, puis cette fiche. Au besoin: les fiches 2.3 (le flux binaire), 7.3 (la Chasse) et 5.4 (la couleur des PNJ).

## Pourquoi

Une seule trame d'état part à toute la partie, et la page choisit ce qu'elle dessine. En Chasse, chaque entité y porte son type (`joueur` ou `bot`), un vrai joueur son pseudo, et son identifiant le relie au classement: un traqueur qui ouvre les outils de son navigateur sait quels ninjas sont des proies. Défaut relevé par l'étude Among Ninjas le 5 octobre 2026, devenu une étape au titre de la règle 7. La même mécanique est le socle du mode Among Ninjas (vision réduite, fantômes, meurtres) et du filtrage par zone d'intérêt d'une Battle Royale.

## État du dépôt au départ (6 octobre 2026)

1. **Une trame pour toute la salle.** `ServeurSocket.diffuserLeBattement` code une trame par battement (`FluxDEtat`, une référence de delta par partie) et l'émet à la salle Socket.IO. Un nouveau venu reçoit le delta, qu'il ignore faute de référence, puis sa propre image. La projection (`instantane.ts`, `instantaneDe`) est pure et identique pour tous.
2. **Un delta ne s'applique qu'à la trame dont il nomme le battement** (`appliquerTrame`, `packages/shared/src/flux.ts`). Deux vues différentes d'un même battement portent le même numéro: un client qui changerait de vue et recevrait le delta de sa nouvelle vue l'appliquerait sur l'ancienne, et fabriquerait un état faux.
3. **Ce qui ne regarde qu'un joueur part déjà à lui seul**: les notifications (`notificationsDe`, adressées) et la poche (étape 7.10). Certaines notifications partent à tous et nomment des joueurs: la fumée, la mine armée, la mine explosée, la mine de zone armée.
4. **La page cache ce que le flux livre.** Elle efface un joueur dans une zone d'invisibilité (`rendu/scene.ts`), réserve la minimap de la Chasse à son camp (`hud/modele.ts`), et dessine un joueur et un PNJ de la même façon, à la couleur près.
5. **En Chasse, la couleur trahit les proies, même à l'œil.** Une proie garde sa couleur de la palette (six couleurs pures), et un PNJ ne naît jamais d'une couleur de la palette ni de celle d'un joueur (`couleurDeBot`, étape 5.4). Le classement montre la couleur de chaque proie. Masquer le type, l'identifiant et le pseudo ne suffit donc pas.
6. **La contagion entre bots reste active en Chasse**, sans effet aujourd'hui puisqu'aucun PNJ n'y porte la couleur d'un joueur (`regleChasse`, `contacts.ts`). Le nombre de ninjas portés vaut zéro en Chasse pour la même raison (`scoreDe`, `score.ts`).
7. **Le banc et l'empreinte** (`tests/charge/battement.ts`, `empreinte.ts`) mesurent la projection et le codage par `instantaneDe` et `FluxDEtat`.

## Décisions de conception

1. **La couleur des PNJ de la Chasse: décision du porteur du projet du 6 octobre 2026**, prise au début de l'étape. En Chasse seulement, chaque PNJ naît de la couleur d'un joueur présent au lancement, tirée au sort par le générateur à graine. Chaque proie a ainsi des sosies exacts parmi les PNJ: sa couleur ne la trahit plus, ni à l'œil ni dans le flux. Écartés: montrer les proies aux traqueurs d'une couleur quelconque et retirer leur couleur du classement; ne rien changer à la couleur.
2. **En Chasse, la contagion entre bots est coupée.** Avec des PNJ aux couleurs des joueurs, elle repeindrait les troupeaux, et une couleur pourrait finir par ne plus avoir de sosie. Les ninjas « ne comptent pour personne » (fiche 7.3, décision 6): le nombre de ninjas portés d'un joueur de la Chasse vaut zéro, explicitement.
3. **Une vue par clé, décidée par une fonction pure** (`vues.ts`). `cleDeVue(etat, joueur)` dit quelle vue un joueur reçoit; `vueDe(etat, cle, alias)` la construit. Les destinataires qui partagent une clé reçoivent la même trame, codée une fois. Hors Chasse, tout le monde a la vue commune: une seule trame, comme aujourd'hui. Pour le mode Among Ninjas, chaque joueur aura sa clé.
4. **En Chasse, deux vues.** La vue commune, que l'instantané d'aujourd'hui décrit, va aux proies et à un traqueur sous révélation: le bonus montre les vrais joueurs, la page les entoure d'un halo comme aujourd'hui. La vue des traqueurs va aux autres traqueurs, éliminés compris, et à tout destinataire que l'état ne connaît pas: le plus restrictif par défaut.
5. **La vue des traqueurs montre une proie comme un PNJ**: type `bot`, sans pseudo, sans protection ni invincibilité, sous un alias. Chaque ninja, PNJ comme proie, y prend un alias, et la liste range les ninjas dans l'ordre de leurs alias, après les traqueurs: ni la forme de l'identifiant, ni la place dans la liste ne distingue une proie. Une proie dans une zone d'invisibilité y est absente, comme la page l'efface aujourd'hui. Le poseur d'une mine passe par l'alias. Le classement ne change pas: il ne dit pas où est qui.
6. **Un alias est stable et imprévisible**: le condensé à clé (HMAC-SHA256) de l'identifiant réel, sous un secret tiré au hasard pour chaque partie par la couche réseau, tronqué, unique dans la partie. Stable, pour que le lissage et le delta suivent un ninja d'un battement à l'autre; imprévisible, pour qu'on ne puisse pas recalculer l'alias d'un PNJ connu.
7. **Les notifications passent par la même vue.** Pour un destinataire de la vue des traqueurs, chaque identifiant de joueur ou de bot d'une notification passe par l'alias, sauf celui d'un traqueur, public. Une fonction exhaustive sur les noms de notification, pour qu'un mode à venir ne puisse pas en oublier une.
8. **Une référence de delta par clé, et une image à qui change de clé** (`FluxParVue`, dans `fluxDEtat.ts`). Chaque clé a son propre flux (image au premier battement, image régulière, delta sinon). Un destinataire qui entre, change de clé ou attend une image reçoit l'image de sa clé et pas son delta. Une clé sans destinataire est oubliée: elle repartira d'une image. Une proie infectée passe ainsi de la vue commune à celle des traqueurs sans état faux.
9. **Limite assumée.** Ce qu'un joueur a vu légitimement, il le garde: une proie infectée, ou un traqueur sous révélation, sait où étaient les proies, et les positions se suivent d'un battement à l'autre. Changer les alias n'y ferait rien. Le flux ne lui en dit pas plus que ses yeux; un client modifié ne les perd simplement pas dans la foule.
10. **Hors Chasse, la zone d'invisibilité reste un filtre de la page**, comme l'étude le juge acceptable (section 3.1): un petit avantage, qui couperait la trame commune de tous les modes dès qu'un joueur s'y cache. Le jour où un mode en fait un secret, sa fonction de vue le dira.

## Périmètre

1. **Moteur** (`packages/sim`): la couleur des PNJ de la Chasse (`couleurs.ts`, `bots.ts`), la contagion coupée en Chasse (`contacts.ts`), les ninjas portés à zéro en Chasse (`score.ts`).
2. **Serveur**: `vues.ts` (clé, vue, alias, notifications), `FluxParVue` dans `fluxDEtat.ts`, la diffusion par vue dans `ServeurSocket.diffuserLeBattement`, le secret des alias par partie.
3. **Banc de charge**: la projection et le codage mesurés par vue, comme la couche réseau les fait; une mesure Chasse et Classique avant et après, nouvelle section de `docs/mesures/charge-serveur.md`. L'empreinte des parties Classique de référence ne bouge pas.
4. **Aucun changement** du format du flux, du paquet partagé, de la page, ni des règles des autres modes.

## Hors périmètre

- Le mode Among Ninjas et sa vision par rayon.
- Le filtrage par zone d'intérêt d'une Battle Royale.
- La zone d'invisibilité filtrée par le serveur hors Chasse (décision 10).

## Tests requis

- TU du moteur: en Chasse, chaque PNJ naît de la couleur d'un joueur présent, et toutes les couleurs des joueurs sortent; ailleurs, rien ne change. La contagion entre bots est coupée en Chasse et reste ailleurs. Les ninjas portés valent zéro en Chasse.
- TU des vues: hors Chasse, une seule clé et la vue d'aujourd'hui. En Chasse, la clé de chacun (proie, traqueur, traqueur éliminé, traqueur sous révélation, inconnu, Chasse non lancée). La vue des traqueurs ne contient aucun joueur qui soit une proie, aucun identifiant ni pseudo de proie, ses ninjas sont rangés par alias, une proie cachée en est absente, le poseur d'une mine est masqué; les traqueurs y restent eux-mêmes. Les alias sont stables, distincts, et changent avec le secret.
- TU des notifications masquées: chaque notification qui nomme un joueur, pour la vue des traqueurs; rien ne change pour la vue commune.
- TU de `FluxParVue`: une clé, une trame à tous; deux clés, deux trames; un changement de clé reçoit l'image et pas le delta; un client simulé qui applique ses trames reconstruit exactement sa vue à chaque battement, changements de clé compris; image régulière par clé; une clé abandonnée repart d'une image; l'attente explicite d'une image.
- TI de la couche réseau (Chasse): un traqueur reçoit des trames où aucune entité ne porte l'identifiant ni le type d'une proie; la proie, elle, voit le traqueur et se voit; après l'infection, l'ancienne proie reçoit la vue des traqueurs, sans état faux.
- Non-régression: toute la suite unitaire, l'empreinte des quatre parties Classique, les scénarios de bout en bout, dont la Chasse.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. En Chasse, aucune trame ni notification reçue par un traqueur sans révélation ne permet de distinguer une proie d'un PNJ par son type, son identifiant, son pseudo, sa place dans la liste ou sa couleur, vérifié par les tests du serveur.
2. Hors Chasse, une seule trame par battement, identique à celle d'avant l'étape: l'empreinte des parties Classique ne bouge pas.
3. Le coût par battement d'une partie Chasse est mesuré et écrit.
4. La couverture de `packages/sim` ne baisse pas.

## Rituel de fin de session

Écrire `docs/handoffs/etape-2-9-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP (étape terminée), l'étude Among Ninjas (le socle existe), la fiche 7.3 si besoin, et `CLAUDE.md` (comportement à préserver 11, la couleur des PNJ). Version: la couleur des PNJ de la Chasse se voit, le troisième chiffre avance. Prochaine action exacte: l'étape qui suit 2.9 dans la section 3 du ROADMAP. Commiter.
