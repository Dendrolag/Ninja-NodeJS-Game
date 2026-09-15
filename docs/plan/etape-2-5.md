# Fiche étape 2.5 - Reconnexion en cours de partie

Brief de session. Objectif unique: un joueur dont le lien se coupe, ou qui recharge la page, retrouve sa partie, sa couleur et ses ninjas, dans un délai borné.

Fiche rédigée le 15 septembre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 2.5 du ROADMAP (section 4), du handoff 6.1, de la contrainte héritée de l'étape 5.4 (règle 11) et de l'état réel du dépôt.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 6.1, puis cette fiche. Au besoin: le journal de `docs/design/README.md` (entrées du 18 août 2026 sur la reconnexion automatique coupée, du 11 septembre sur l'abandon compté dernier, du 12 septembre sur le flux d'état en trames).

## Pourquoi

Depuis l'étape 4.1, la reconnexion automatique de Socket.IO est coupée, pour une bonne raison: une place dans une partie est attachée à la connexion, et une reconnexion silencieuse redonnerait un joueur inconnu du serveur. Conséquence, toute coupure coûte la partie: un rechargement de page, un téléphone qui change d'antenne, une page privée de processeur (vu à l'étape 5.4). Pour un compte, c'est aussi une défaite enregistrée: un départ en cours de partie est un abandon, compté dernier (décision du 11 septembre 2026), qui notait déjà « à reconsidérer si la reconnexion arrive ».

## État du dépôt au départ (15 septembre 2026)

1. **L'identité d'un joueur est celle de sa connexion.** `ServeurSocket.faireEntrer` fabrique la session avec `id: socket.id`; le moteur, la room, les notifications adressées (`pour`), le flux d'état et la fin de partie s'en servent comme clé. Le client se reconnaît par `moi`, rempli avec l'identifiant du lien à la connexion (`connexionEtablie`).
2. **Une déconnexion est un départ immédiat.** Le gestionnaire `disconnect` appelle `surQuitter`, comme la demande `quitter`: le joueur sort de l'état, ses bots gardent sa couleur sans plus la transmettre (règle 11), et un départ en partie en cours est retenu comme abandon.
3. **La room sait déjà oublier un abandon**: `GameRoom.accueillir` efface l'abandon d'un compte, ou d'un invité de même pseudo, qui revient. Mais revenir par `rejoindre` fait un joueur neuf: autre couleur, zéro ninja, protection d'apparition.
4. **Le client a un réveil** (`reveil.ts`, étape 5.3) qui réessaie d'ouvrir un lien qui n'a jamais abouti. Ce n'est pas une reconnexion, et il ne doit pas en devenir une.
5. **La session de compte est un jeton gardé dans le stockage local** (`comptes/coffre.ts`), présenté à l'ouverture du lien.

## Décisions de conception

1. **Un jeton de retour, secret, remis à chaque entrée en partie.** Le serveur le tire du générateur cryptographique (32 octets, même forme qu'un jeton de session) et l'envoie à la seule connexion qui entre, par une notification adressée: jamais dans le salon, qui part à tous. Il est renouvelé à chaque retour, si bien qu'un jeton déjà servi ne vaut plus rien.
2. **Revenir est une demande explicite** (`revenir`, avec le jeton), sur une connexion ouverte comme toute autre, avec ou sans session de compte. La reconnexion automatique de Socket.IO reste coupée. Le serveur accepte ou refuse, avec un motif.
3. **Un retour usurpé est refusé.** Un jeton inconnu, expiré ou déjà renouvelé est refusé. Une place de compte ne se reprend que depuis une connexion de ce même compte; une place d'invité, que depuis une connexion d'invité. Le refus ne dit pas lequel de ces cas s'applique.
4. **La place n'est gardée que pendant une partie en cours**, et trente secondes (`DELAI_DE_RETOUR_MS`, dans `@neon-ninja/shared`). Dans le salon, une déconnexion reste un départ immédiat: rien n'y est perdu, et une place fantôme bloquerait l'hôte et la capacité. Une fois la partie terminée, la place n'ouvre plus rien: le classement est déjà parti.
5. **Pendant son absence, le joueur reste dans l'état de la partie**, immobile (son intention est effacée), avec sa couleur, ses ninjas, son pseudo et sa place dans la capacité. C'est la contrainte de l'étape 5.4: ses bots continuent de transmettre sa couleur. Il reste capturable, comme un joueur qui ne bouge pas.
6. **Au-delà du délai, son départ est un abandon**, exactement comme aujourd'hui.
7. **L'identité d'un joueur se détache de la connexion.** L'identifiant du joueur reste celui de la connexion par laquelle il est entré; après un retour, la nouvelle connexion porte l'ancien identifiant de joueur. Le serveur tient l'index joueur vers connexion; le client apprend son identifiant de joueur du serveur, et non plus de son lien.
8. **Une page qui revient reprend la place à une page qui la tient encore.** Après un rechargement ou une coupure silencieuse, le serveur peut ne pas avoir encore constaté la fin de l'ancienne connexion (jusqu'à 45 secondes avec les battements par défaut de Socket.IO). Le jeton faisant preuve, la nouvelle connexion l'emporte; l'ancienne est détachée de la partie et en est prévenue, sans être coupée.
9. **Un hôte absent cède la main** au plus ancien joueur présent, sans quoi une partie suspendue ne pourrait plus reprendre. Il ne la retrouve pas à son retour, sauf si personne n'était présent.
10. **Le jeton de retour vit dans le stockage de session du navigateur**: il survit au rechargement de l'onglet, pas à sa fermeture, et deux onglets ne se le partagent pas. Il est oublié en quittant la partie, à la fin de la partie, et au premier refus.

## Périmètre

1. **Contrats partagés**: la demande `revenir` et sa validation, la notification de la place attribuée (identifiant du joueur, jeton de retour), la notification de la place reprise ailleurs, le délai de retour.
2. **Serveur**: le registre des places (jetons, index joueur vers connexion, délais, sur l'horloge injectée); la déconnexion en partie en cours qui suspend au lieu de faire sortir; le retour; l'expiration en abandon; l'absence dans `GameRoom` (intention effacée, succession de l'hôte); notifications, images du flux et progression de fin adressées par joueur.
3. **Client**: l'identifiant du joueur appris du serveur; le coffre du jeton de retour; à une perte de lien en pleine partie, de nouveaux essais d'ouverture puis la demande de retour, pendant le délai, sans que le réveil ne s'en mêle; au chargement de la page, la demande de retour si un jeton est gardé; le refus, la place reprise ailleurs.
4. **Interface**: l'écran de jeu dit que le lien est perdu et que la page tente de revenir; l'accueil dit qu'un retour est en cours, puis pourquoi il a échoué.

## Hors périmètre

- Garder la place dans le salon, ou montrer l'écran de fin à qui revient après la fin.
- Montrer aux autres joueurs qu'un joueur est absent.
- Retrouver les faits manqués pendant la coupure (annonces, chat, jauges de bonus): l'état revient par le flux, pas l'historique.
- Revenir depuis un autre onglet ou un autre appareil.

## Tests requis

- TU du registre des places: attribution, jeton renouvelé, suspension et expiration sur l'horloge, reprise, libération.
- TU de `GameRoom`: un absent reste dans l'état et ne bouge plus; l'hôte absent cède la main; un retour le rend présent.
- TI (vrais clients Socket.IO, horloge manuelle): retour dans le délai, même joueur, même couleur, mêmes ninjas, flux reçu; refus au-delà du délai, et abandon; refus d'un jeton inconnu ou déjà servi; refus d'une place de compte reprise par une autre connexion; reprise à une page qui tient encore la place; déconnexion dans le salon toujours immédiate; départ volontaire qui libère la place.
- TU du client: identifiant du joueur appris du serveur; essais de retour après une perte en partie, arrêtés au délai; retour au chargement; refus et place reprise.
- Bout en bout: rechargement de la page en pleine partie, le joueur retrouve sa partie, sa couleur et ses ninjas.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Un rechargement de page en pleine partie ramène le joueur dans sa partie, vérifié de bout en bout.
2. Un retour après le délai, usurpé ou déjà servi est refusé, vérifié en intégration.
3. Pendant l'absence, le joueur reste dans l'état et ses bots transmettent sa couleur.
4. Classique inchangé: la couverture de `packages/sim` ne baisse pas, l'empreinte des parties ne change pas (aucun changement du moteur attendu).

## Rituel de fin de session

Écrire `docs/handoffs/etape-2-5-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, et revoir celle du 11 septembre sur l'abandon. Prochaine action exacte pour l'étape 3.4, gestion du mot de passe, dont la fiche se rédige au début de la session. Commiter.
