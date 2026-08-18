# Fiche étape 1.7 - Pause de partie

Brief de session. Objectif unique: porter la pause du legacy, de l'état du moteur jusqu'aux événements réseau. Étape ajoutée le 14 août 2026, absente du plan d'origine et découverte à l'exécution de l'étape 2.2.

Fiche rédigée au moment de l'exécuter, selon le cas de repli du PROTOCOLE, à partir de l'entrée « 1.7. Pause de partie » de docs/plan/ROADMAP.md, de l'écart 5 de sa section 5, et de la section « Prochaine action exacte » du handoff de l'étape 2.2.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 2.2, `.claude/rules/sim-purity.md`, puis cette fiche.

Base legacy: master v0.8.6.

## Pourquoi cette étape existe

Le legacy propose une pause: `togglePause` côté client, `pauseGame` et `resumeGame` côté serveur, et trois variables de module (`isPaused`, `pauseStartTime`, `totalPauseDuration`) que `calculateTimeLeft` consulte pour ne pas décompter le temps passé en pause.

Aucune étape de la phase 1 ne l'a portée: ni `EtatPartie` ni `tick` ne connaissent la notion. L'étape 2.2 l'a découvert en relevant, un par un, les événements du legacy pour écrire les contrats. Elle ne pouvait pas la rattraper: la pause est un état de la **partie**, donc du moteur, et sa fiche interdit explicitement toute logique de jeu dans la couche réseau.

Traitée selon la règle 7 de CLAUDE.md: trop gros pour l'étape en cours, donc étape à part entière, jamais une ligne de dette. Elle est placée après 2.2 parce qu'elle traverse le moteur, la room et le réseau, et avant le client, qui a besoin du contrat complet.

**Ce n'est pas un défaut de sécurité et ce n'est pas non plus un réglage de gameplay caractérisé**: `tests/caracterisation/` ne contient aucun test de pause. Le legacy fait donc foi sur le principe (une partie se met en pause, le temps de jeu ne s'écoule plus), et ne fait pas autorité sur ses modalités, dont l'une est un défaut de conception franc (voir le point 4 du périmètre).

## Objectif

Une partie en cours peut être suspendue et reprise. Pendant la suspension, le temps de jeu ne s'écoule plus, rien ne bouge, rien n'apparaît, aucune capture n'a lieu, et la partie ne peut pas se terminer. La boucle de battement, elle, continue de battre.

## Périmètre

### 1. Un état de pause dans le moteur

`EtatPartie` gagne un champ `enPause`, faux à la création. Deux fonctions pures le font basculer, sur le modèle des autres transformations de l'état: elles prennent un état et en rendent un nouveau.

Le moteur ne retient PAS qui a mis en pause. L'autorité est une question de session et de salon, donc de la room; le moteur n'a jamais su qui commande une partie et n'a aucune raison de commencer.

Le legacy tenait une comptabilité de durée cumulée de pause, qu'il retranchait du temps écoulé à chaque lecture. Elle disparaît: le temps de jeu du moteur n'avance que de ce que `tick` lui donne, et pendant la pause il ne lui donne rien. Il n'y a donc plus rien à retrancher.

### 2. Le temps de jeu cesse de s'écouler

Pendant la pause, `tick` renvoie un état où tout est identique, à deux exceptions près:

- le compteur de battements avance, parce qu'un battement a bien eu lieu;
- le journal d'événements repart vide.

**Le journal doit repartir vide, et ce n'est pas un détail.** Le journal d'un battement est lu par la couche réseau juste après, puis effacé au battement suivant. Un état de pause rendu strictement inchangé rejouerait donc le journal du dernier battement actif vingt fois par seconde, et chaque joueur recevrait la même notification de capture en boucle pendant toute la pause.

Conséquence directe et à vérifier par un test: le temps écoulé n'augmentant pas, `evaluerFinDePartie` ne peut pas conclure, et une partie en pause ne se termine jamais d'elle-même.

### 3. L'exposition par GameRoom

La room expose l'état de pause en lecture et deux méthodes pour le changer. Elle ne change rien à sa boucle: la pause arrête le temps de jeu, pas le battement.

Arrêter la boucle rendrait le serveur aveugle à ce qui arrive pendant la pause, et ferait ressurgir la question des minuteries qu'il faut penser à relancer, c'est-à-dire le défaut X1 de l'audit sous une autre forme. Le battement continue, le moteur décide que rien ne se passe.

Mettre en pause une partie qui n'est pas en cours est une faute de l'appelant, pas une demande de joueur: la room lève, la couche réseau vérifie le statut avant d'appeler. C'est la règle du 14 août 2026 déjà appliquée à `lancer` et `changerReglages`.

### 4. Qui a le droit de mettre en pause

Question laissée ouverte par le handoff de l'étape 2.2, à trancher ici.

Dans le legacy, **n'importe quel joueur** peut mettre la partie en pause, et seul celui qui l'a mise en pause peut la reprendre (`server.js:2710`). Chaque joueur dispose donc d'un moyen d'interrompre la partie de tous les autres aussi longtemps qu'il le souhaite. Une déconnexion du même joueur reprend la partie, ce qui est un rattrapage et non une règle.

**Décision: la pause est réservée à l'hôte**, comme les réglages, le lancement et l'annulation du décompte. Raisons:

1. C'est le seul modèle d'autorité que le serveur connaisse déjà, et il est vérifié en un seul endroit (`roomDeLHote`). Un deuxième modèle en parallèle serait à maintenir et à tester deux fois.
2. La règle du legacy est une porte ouverte au blocage volontaire, et rien n'indique qu'elle ait été voulue plutôt que subie.
3. Le transfert de propriété du salon (comportement à préserver numéro 8) résout gratuitement le cas de l'hôte qui part pendant une pause: le joueur suivant devient hôte et peut reprendre. Aucun rattrapage de déconnexion n'est nécessaire.

Corollaire assumé: si l'hôte quitte pendant une pause, la partie reste suspendue jusqu'à ce que le nouvel hôte la reprenne. Elle ne redémarre pas toute seule.

### 5. Les événements réseau

À ajouter au contrat de `packages/shared/src/evenements.ts`, qui doit être **complété, pas contourné**. La mention de la pause dans la liste des événements legacy non portés, en fin de ce fichier, se retire dans le même mouvement.

Montants: une demande de mise en pause, une demande de reprise. Descendants: l'annonce de la pause, l'annonce de la reprise.

L'état de pause rejoint AUSSI le flux d'état, sous la forme d'un indicateur dans `InstantanePartie`. Ce n'est pas une redondance avec les deux annonces: la pause est un état, et le fichier de contrats pose que le client reconstruit l'état à partir du flux et pose les notifications par-dessus. Un joueur qui entre dans une partie suspendue apprend ainsi qu'elle l'est sans avoir eu besoin d'assister à l'annonce.

## Hors périmètre

- Aucun écran, aucun bouton, aucune touche. Le client est la phase 4.
- Aucune limite de durée de pause, aucune reprise automatique après un délai. Le legacy n'en avait pas.
- Aucun vote, aucune pause partagée entre plusieurs joueurs.
- Ne pas modifier `legacy/`.

## Tests requis

Ceux de l'entrée ROADMAP, précisés:

- TU: pendant la pause, le temps de jeu n'avance pas, quel que soit le dt fourni.
- TU: pendant la pause, aucune entité ne bouge, aucun objet n'apparaît ni ne vieillit, aucune capture n'a lieu, aucun effet ne se rapproche de sa fin.
- TU: pendant la pause, le journal d'événements est vide.
- TU: une partie dont le temps est presque écoulé ne se termine pas tant qu'elle est en pause, et se termine bien après la reprise.
- TU: reprendre une partie jamais mise en pause, ou mettre en pause une partie déjà en pause, ne change rien.
- TI: la room expose la pause, refuse la manœuvre quand la partie n'est pas en cours, et sa boucle continue de battre.
- TI: l'hôte met en pause, tous les membres de la partie sont prévenus, et le flux d'état porte l'indicateur.
- TI: un joueur qui n'est pas l'hôte reçoit un refus et la partie continue.
- TI: la demande ne franchit pas la frontière d'une partie vers une autre.

## Définition de terminé

Conditions de ROADMAP.md réunies, plus:

1. `EtatPartie` porte l'état de pause, et le moteur reste pur.
2. Le temps de jeu ne s'écoule pas pendant la pause, et une partie en pause ne se termine pas.
3. `GameRoom` expose la pause, sans jamais arrêter sa boucle.
4. Les quatre événements sont dans le contrat partagé, la mention de la pause a disparu de la liste des non-portés, et l'indicateur est dans le flux d'état.
5. La décision sur l'autorité est consignée dans le journal de `docs/design/README.md`.
6. Les tests de caractérisation restent au vert, et la couverture de `packages/sim` ne baisse pas.

## Point de vigilance

Le piège de cette étape est le journal d'événements décrit au point 2 du périmètre. Il ne produit aucune erreur, aucun type ne le signale, et il ne se voit qu'en mettant en pause juste après une capture: la notification part alors en boucle. Le test qui vérifie que le journal est vide pendant la pause est la seule chose qui l'empêche de revenir.

Second point, plus mineur: pendant une pause, l'instantané continue de partir vingt fois par seconde pour dire que rien n'a changé. C'est assumé ici, parce que c'est ce qui permet à un joueur d'entrer dans une partie suspendue et d'y voir quelque chose. Si la mesure de l'étape 5.1 montre que cela coûte, c'est l'étape 2.3 qui le traitera, comme pour tout le reste du flux.

## Réconciliation, faite le 18 août 2026

Écarts entre le plan et ce qui a été fait. Cette fiche ayant été rédigée le jour de son exécution, ils sont peu nombreux; ils portent tous sur l'entrée ROADMAP dont elle est tirée.

1. **Quatre événements réseau et non trois.** L'entrée ROADMAP annonçait « les trois événements réseau correspondants », par report direct du legacy qui avait une bascule montante et deux annonces descendantes. Une bascule n'est pas idempotente: un message réémis, ou deux clics trop rapprochés, laissent la partie dans l'état inverse de celui que le joueur voit. Deux demandes explicites ont donc été retenues, comme pour `demarrer` et `annulerDemarrage`. L'entrée ROADMAP a été corrigée en conséquence.

2. **La question de l'autorité était posée, pas tranchée.** Le handoff 2.2 demandait de la trancher dans cette étape. C'est fait, au point 4 du périmètre, et consigné au journal de conception.

3. **Un piège découvert en cours de route, traité ici.** Le journal d'événements du battement, décrit au point 2 du périmètre et repris au point de vigilance, n'était prévu par aucun document. Il a été trouvé en écrivant le gel du battement, et il a sa propre couverture de test.

## Rituel de fin de session

Écrire `docs/handoffs/etape-1-7-handoff.md`. Consigner la décision sur l'autorité, les écarts au legacy, et l'état de la dette ouverte reprise du handoff 2.2. Prochaine action exacte pour l'étape suivante du jalon 1, `4.1`: squelette client et couche réseau isolée derrière une interface. Commiter.
