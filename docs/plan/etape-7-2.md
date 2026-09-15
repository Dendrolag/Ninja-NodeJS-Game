# Fiche étape 7.2 - Mode Équipes

Brief de session. Objectif unique: ajouter au jeu son troisième mode, le mode Équipes, où deux équipes d'une couleur chacune se disputent les ninjas de la carte. C'est la première des fonctionnalités reportées, choisie par le porteur du projet après la fin de la réécriture.

## Origine de cette fiche

Aucune fiche n'existait: le handoff 2.6 ne planifie plus rien, et renvoie aux fonctionnalités reportées (autres modes, pass de saison, skins, clans), dans l'ordre que fixe le porteur du projet. Elle est rédigée le 15 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- la section 3 du ROADMAP (décision du 14 septembre 2026: les autres modes après la fin du socle, en phase 7, chacun avec ses règles tranchées par le porteur du projet);
- la section 6 du cadrage (`docs/design/cadrage.md`), et la fiche 7.1 prise comme modèle;
- la maquette (`docs/design/HANDOFF-CLAUDE-DESIGN.md`): « Équipes, 2x4 J, deux clans s'affrontent pour le contrôle du territoire ». Une proposition non validée (cadrage, tension 2), sans règles;
- l'état du dépôt au commit `36ec3a8`, et le handoff 2.6;
- neuf décisions posées au porteur du projet le 15 septembre 2026.

**Aucune référence de comportement.** Ni la v0.8.6, ni la v0.9.0 n'ont de mode Équipes: il n'y a rien à caractériser. Les règles ci-dessous font foi, et les comportements à préserver de CLAUDE.md s'appliquent partout où elles ne disent pas le contraire.

**Numéro**: 7.2, dans la phase 7, « Modes de jeu », ouverte par l'étape 7.1.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (2.6, ou le handoff partiel de cette étape), cette fiche, `.claude/rules/sim-purity.md`, la section 6 du cadrage et la fiche 7.1.

## Décisions du porteur du projet, 15 septembre 2026

1. **Le mode Équipes vient en premier** parmi les fonctionnalités reportées.
2. **Une couleur par équipe.** Tous les membres d'une équipe portent sa couleur. Le score d'une équipe vaut les bots de sa couleur, plus quinze points par bot noir détruit par l'un de ses membres. La contagion entre bots devient une guerre de territoire: un troupeau d'une équipe qui traverse celui de l'autre le retourne.
3. **Le joueur choisit son équipe au salon.** À son arrivée, il est placé dans l'équipe la moins nombreuse; il peut en changer tant que la partie n'est pas lancée.
4. **Deux équipes, douze joueurs au plus**, soit six contre six.
5. **Un malus frappe l'équipe adverse.** Le ramasseur et ses coéquipiers sont épargnés.
6. **Capturer un adversaire rapporte sa part, au plus près.** La part d'un joueur est le nombre de bots de son équipe divisé par le nombre de membres de son équipe, arrondi en dessous; les bots de sa part sont ceux de son équipe les plus proches de lui. Ils passent à l'équipe de l'attaquant. La victime réapparaît ailleurs, avec sa protection, dans son équipe. En un contre un, c'est exactement le Classique.
7. **Un bot noir fait perdre la moitié de sa part.** Le réglage de l'hôte (50 pour cent par défaut) s'applique à la part du joueur attrapé, et non à tous les bots de l'équipe; les bots perdus, les plus proches de lui, redeviennent blancs.
8. **Les récompenses se calculent par équipe.** Chaque vainqueur est compté comme ayant devancé tous les perdants, et prend les points de ligue du premier. Chaque perdant est compté comme devancé par tous les vainqueurs, et prend les points de ligue du dernier. En cas d'égalité, tous les joueurs présents sont au même rang, au milieu.
9. **On lance avec un joueur par équipe au moins.** Des équipes inégales sont permises.

Écartés par ces décisions: une couleur par joueur avec un score additionné; le tirage des équipes au lancement; la répartition par l'hôte; huit joueurs; deux à quatre équipes; le malus sur tous les autres; les bots autour de la victime, la capture sans butin, l'absence de capture de joueur; la moitié de tous les bots de l'équipe, le bot noir sans perte; le classement par contribution individuelle ou mixte; les équipes obligatoirement équilibrées; le lancement à un seul joueur.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **Nom « Équipes », identifiant `equipes`.** Le nom de la maquette et du cadrage.
2. **Deux équipes, Cyan et Magenta** (identifiants `cyan` et `magenta`), aux couleurs `#00FFFF` et `#FF00FF` de la palette des joueurs: deux couleurs néon, éloignées l'une de l'autre, et qu'aucun bot ne reçoit à sa naissance (`couleurDeBot` exclut la palette). Six membres au plus par équipe.
3. **L'équipe d'un joueur, pour le moteur, c'est sa couleur.** Aucun champ n'est ajouté à l'état: deux joueurs de même couleur sont coéquipiers. `captureAutorisee` refuse déjà une capture entre joueurs de même couleur, `aUneCouleurADonner` transmet la couleur tant qu'un membre est présent, et `scoreDe` compte déjà les bots d'une couleur. L'état d'une partie Classique ne change donc pas, ni son empreinte. Le choix d'équipe est une affaire de salon: `GameRoom` le retient, et fait entrer le joueur avec la couleur de son équipe.
4. **Les membres d'une équipe sont les joueurs de sa couleur présents dans l'état**, absents de l'étape 2.5 compris: ils y sont, et gardent leur place.
5. **« Au plus près »**: distance entre centres au moment de la capture; à distance égale, l'ordre des bots dans l'état. Le calcul de la part se fait avant la réapparition de la victime.
6. **Un joueur qui entre dans une partie en cours** va dans l'équipe la moins nombreuse; à nombre égal, dans celle qui a le moins de points; à points égaux, dans Cyan. Il ne choisit pas: il n'y a plus de salon.
7. **Changer d'équipe** est permis dans le salon, compte à rebours compris; refusé vers une équipe pleine, hors du salon, et hors d'une partie Équipes. Choisir son équipe actuelle ne fait rien.
8. **La condition de lancement se vérifie deux fois**: quand l'hôte demande le démarrage, et à la fin du compte à rebours. Si une équipe s'est vidée entre-temps, le démarrage est annulé et le salon le dit.
9. **Une équipe sans membre présent à la fin n'est pas classée**; l'autre gagne. Ses bots ne comptent pour personne.
10. **Le détail des récompenses (décision 8).** Soit N le nombre de joueurs de la partie, abandons compris, P celui des présents à la fin, et A celui des abandons.
    - Vainqueur: il devance les N moins les vainqueurs présents; points de ligue du premier.
    - Perdant: il ne devance que les abandons; points de ligue du dernier.
    - Égalité: chacun devance les abandons et la moitié des adversaires présents, arrondie en dessous; points de ligue du milieu (la part devancée vaut un demi, soit +5).
    - Abandon: inchangé, compté dernier.
    - Les autres règles de progression ne changent pas: deux joueurs et trois minutes pour la ligue, pièces au dixième de l'XP.
11. **Le placement enregistré** (historique, écran de fin, victoires du profil): 1 pour les vainqueurs, un de plus que le nombre de vainqueurs présents pour les perdants, et en cas d'égalité 1 plus la moitié des présents, arrondie en dessous, pour tous. Une égalité n'est donc jamais une victoire au profil. Les abandons restent placés derniers.
12. **Le classement des équipes se déduit du classement des joueurs**, par une fonction pure de `packages/shared` (couleur, bots portés, points de bots noirs), que le serveur et le client appellent: le flux d'état ne change pas.
13. **La partie rapide ne change pas**: la première partie publique en attente, quel que soit son mode, sinon une nouvelle partie Classique.
14. **Le Tactique ne se joue pas en équipes.** Un mode est une valeur, pas une combinaison.

## État de départ, constaté dans le dépôt

Ce qui existe et se réutilise:

- **Le branchement du mode**: `MODES` et `CAPACITES` (`packages/shared/src/constantes.ts`); `EtatPartie.mode`; `REGLES_DES_MODES` (`packages/sim/src/moteur.ts`), indexée par tous les modes; `JeuDeRegles { agir; resoudreContacts }`.
- **Les règles de contacts par mode**: `regleDeContacts` (`packages/sim/src/contacts.ts`), qui partage l'ordre de résolution et la contagion, et prend ce que le mode fait des contacts où figure un joueur.
- **Les captures autonomes** de `capture.ts`, qui vérifient protection, délai et couleurs différentes.
- **Le mode figé à la création**, porté par `GameRoom`, `InfosSalon` et `PartiePublique`, enregistré par l'énumération `mode_de_jeu` tirée de `MODES`.
- **Côté client**, `NOMS_DES_MODES` et `CAPTURES_DES_MODES` (`interface/modeles/cartes.ts`), et l'écran de création avec sa tuile « À venir ».

Ce qui manque:

- **Trois décisions du mode vivent hors du jeu de règles.** La capture d'un joueur donne une nouvelle couleur à la victime et tous ses bots à l'attaquant (`capturerJoueur`); un bot noir retire une part de tous les bots de sa proie (`depouiller`, `bots.ts`); un malus frappe tous les autres (`infligerLeMalus`, `objets.ts`). Aucune ne consulte le mode.
- **Aucune notion d'équipe au salon**: `JoueurDuSalon` n'a pas d'équipe, aucun événement ne permet d'en changer, `accueillir` tire une couleur libre.
- **Aucune condition de lancement**: le décompte part dès que l'hôte le demande.
- **Le bilan place les joueurs dans l'ordre du classement**, et `recompensesDePartie` déduit tout du placement: le nombre de joueurs devancés comme la part de ligue.
- **Le HUD et l'écran de fin** montrent un classement de joueurs, dont les points, en Équipes, seraient ceux de toute l'équipe.

## Périmètre

Découpé en lots, dans l'ordre d'exécution. Chaque lot se termine vert et se commite; si l'étape déborde d'une session, le handoff partiel s'arrête à la fin d'un lot.

### Lot A. Le jeu de règles Équipes dans le moteur

1. **Le jeu de règles s'élargit aux trois décisions qui dépendent du mode**, sans rien changer à ce qu'elles font en Classique et en Tactique. Proposition: `JeuDeRegles` gagne ce qu'une capture de joueur fait de la victime et de ses bots, la part qu'un bot noir retire, et qui subit un malus; `tick` passe le jeu de règles du mode aux bots et au ramassage des objets. Le Classique et le Tactique reçoivent le code d'aujourd'hui, tel quel.
2. **Le mode `equipes`** rejoint `MODES`, avec sa capacité (12), ses équipes et leurs couleurs dans `packages/shared`; et, dans le même lot, ce que la compilation et la CI exigent dès qu'un mode existe: son nom et sa phrase de capture dans les tables du client, et la migration de l'énumération `mode_de_jeu`, écrite par `pnpm base:generer`. Jusqu'au lot C, l'écran de création ne propose pas le mode.
3. **La part d'un joueur** (décisions 6 et 7, micro-décisions 4 et 5): une fonction pure, testée seule.
4. **La capture d'un adversaire**: la victime garde sa couleur, réapparaît avec sa protection, et les bots de sa part passent à l'attaquant; l'événement de capture dit combien. Les vérifications de `captureAutorisee` restent communes.
5. **Le bot noir**: la moitié (le réglage) de la part du joueur attrapé, au plus près, redevient blanche.
6. **Le malus**: il frappe les joueurs d'une autre couleur que le ramasseur.
7. **Les contacts du mode Équipes**: ceux du Classique, avec la capture d'équipe. Sans dupliquer `regleClassique`: ce qui leur est commun se partage.
8. **Faire entrer un joueur avec la couleur de son équipe, et en changer au salon**: `ajouterJoueur` accepte déjà une couleur imposée; changer de couleur un joueur du salon, s'il faut une fonction, en est une du moteur, testée.

### Lot B. Salon, serveur, contrat, fin de partie et base

1. **Le classement des équipes** (micro-décisions 9 et 12): une fonction pure de `packages/shared`, qui dit aussi la victoire ou l'égalité.
2. **Les récompenses par équipe** (décision 8, micro-décision 10): `recompensesDePartie` accepte le nombre de joueurs devancés et la part de ligue quand le placement ne les dit pas; en Classique, rien ne change, tests de progression compris.
3. **`GameRoom` tient les équipes**: placement à l'arrivée, changement d'équipe, reconstruction de l'état quand les réglages changent sans perdre les équipes, entrée en cours de partie (micro-décision 6), condition de lancement, bilan (micro-décisions 10 et 11).
4. **Le contrat**: l'équipe de chaque joueur dans `JoueurDuSalon`, présente dans une partie Équipes seulement; un événement montant `changerDEquipe`, validé, avec sa famille de débit; ses refus expliqués.
5. **`ServeurSocket`**: le changement d'équipe diffusé au salon; le démarrage refusé sans un joueur par équipe, et le décompte annulé à son terme si la condition ne tient plus (micro-décision 8).
6. **La création** accepte le mode Équipes (`validerDemandeCreation`), et **la base** enregistre une partie Équipes, avec ses placements et ses gains.

### Lot C. Le client

1. **Création**: la tuile Équipes, sélectionnable à côté du Classique et du Tactique, avec sa phrase; la tuile « À venir » reste pour les autres modes.
2. **Salon**: les deux équipes et leurs membres, un bouton pour rejoindre l'autre équipe, plein ou non; « Lancer » suspendu tant qu'une équipe est vide, avec la raison; la phrase de capture du mode.
3. **HUD**: le score de chaque équipe, la nôtre marquée; les membres sans les points trompeurs de l'équipe.
4. **Fin de partie**: le résultat (« Victoire de l'équipe Cyan », « Égalité »), le score des équipes, les membres par équipe; le récapitulatif des gains inchangé.
5. **Aide**: une ligne sur le mode Équipes. **Notifications** de capture: vérifier que leurs mots restent justes quand on ne perd que sa part.

### Lot D. Bout en bout, mesure et documentation

1. **Scénario de bureau** (`tests/e2e/equipes.spec.ts`): un hôte crée une partie Équipes; un second joueur arrive dans l'autre équipe; un changement d'équipe qui vide une équipe suspend « Lancer »; la partie se lance, et chacun voit le score des deux équipes.
2. **Fumée mobile**: le salon Équipes se lit et s'utilise sur un écran de téléphone.
3. **Charge**: une partie Équipes pleine passe au banc (`pnpm charge --banc --mode equipes`), comparée au Classique; chiffres dans `docs/mesures/charge-serveur.md`.
4. **Empreinte**: celle du jeu, pour les quatre parties Classique de `tests/charge/empreinte.ts`, est identique à celle relevée avant le lot A.
5. **Documentation**: cadrage (sections 1, 4, 5 et 6), journal de conception, et le comportement à préserver 4 de CLAUDE.md, qui doit dire ce qu'est « les autres » en Équipes.

## Hors périmètre

- Trois ou quatre équipes, le choix des couleurs d'équipe, un équilibrage automatique en cours de partie.
- Les autres modes (Chasse, Battle Royale, Chaos), et le Tactique en équipes.
- Un chat d'équipe, des indicateurs de coéquipiers hors de l'écran.
- Des statistiques ou des récompenses propres au mode au-delà de la décision 8.
- Toute modification du comportement du Classique ou du Tactique, de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Part (TU)**: un contre un, toute l'équipe; deux membres, la moitié arrondie en dessous; les plus proches d'abord, et l'ordre de l'état à distance égale; aucun bot, aucune part; un membre absent compte.
- **Capture (TU)**: un adversaire cède sa part à l'attaquant; la victime garde sa couleur et reçoit sa protection; deux coéquipiers ne se capturent pas; protection, invincibilité et délai d'une seconde valent comme ailleurs; en un contre un, les mêmes bots changent de couleur qu'en Classique.
- **Bot noir (TU)**: la moitié de la part, la plus proche, redevient blanche; la part d'un joueur seul est toute l'équipe; le réglage de l'hôte s'applique.
- **Malus (TU)**: l'équipe adverse le subit, le ramasseur et ses coéquipiers non.
- **Contacts et monde (TU)**: un joueur repeint un bot à la couleur de son équipe; les bots d'une équipe retournent ceux de l'autre; un invincible détruit un bot noir; une zone de chaos ne donne jamais une couleur d'équipe.
- **Moteur (TU)**: deux parties Équipes de même graine et mêmes entrées sont identiques; en Classique et en Tactique, le jeu de règles élargi rend exactement le code d'avant, et tous les tests existants restent verts sans modification de leurs attentes.
- **Classement et récompenses (TU)**: score d'équipe, victoire, égalité, équipe sans membre; récompenses d'un vainqueur, d'un perdant, d'une égalité et d'un abandon; placements enregistrés; progression Classique inchangée.
- **Salon et serveur (TI)**: arrivée dans l'équipe la moins nombreuse; changement accepté, refusé vers une équipe pleine, hors salon et hors mode Équipes; réglages changés sans perdre les équipes; démarrage refusé sans un joueur par équipe; décompte annulé si une équipe se vide; entrée en cours de partie; `changerDEquipe` limité en débit; une partie Équipes à travers le vrai serveur, capture comprise.
- **Base (TI)**: migration rejouable; une partie Équipes enregistrée, placements et gains compris.
- **Client (TU)**: création d'une partie Équipes; salon (équipes, bouton, « Lancer » suspendu et sa raison); HUD (scores d'équipe); fin (résultat, égalité).
- **Bout en bout**: les scénarios du lot D, sans erreur de console.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie Équipes se crée, se prépare au salon, se joue et s'enregistre depuis la page, au bureau et sur téléphone.
2. **Le Classique et le Tactique n'ont pas changé**: tests existants inchangés, empreinte du jeu des quatre parties de référence identique, partie de référence du flux dans son seuil.
3. Ajouter le mode n'a demandé que des ajouts aux points d'extension, plus l'élargissement du jeu de règles (lot A, point 1), décrit dans la section 6 du cadrage.
4. La couverture de `packages/sim` ne baisse pas (99,78 pour cent au handoff 2.6).
5. Le cadrage, le journal de conception et CLAUDE.md décrivent ce qui a été construit.

## Points de vigilance

1. **Le Classique passe par le jeu de règles élargi à chaque capture, chaque prise d'un bot noir et chaque malus.** L'empreinte du jeu est le garde-fou: relevée avant la première modification, vérifiée à la fin du lot A, pas seulement à la fin de l'étape.
2. **L'ordre des bots d'un bot noir.** Le Classique retire les premiers bots de l'état, pas les plus proches: la règle « au plus près » est celle des Équipes seulement, et la confondre changerait l'empreinte.
3. **La couleur fait l'équipe.** Tout ce qui donne une couleur à un joueur (arrivée, réapparition, réglages changés au salon, retour de l'étape 2.5) doit rendre celle de son équipe; un seul oubli le fait changer de camp sans que rien ne le signale.
4. **Les points d'un joueur en Équipes** comptent tous les bots de son équipe: aucun écran ne doit les présenter comme un score personnel.
5. **Le décompte et les départs.** Un joueur qui quitte le salon pendant le décompte peut vider une équipe: la seconde vérification (micro-décision 8) est ce qui l'empêche de lancer une partie à une équipe.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-2-handoff.md`: les décisions construites, les écarts à cette fiche, les chiffres du banc, l'état de la CI. Prochaine action exacte: demander au porteur du projet la fonctionnalité reportée suivante (Chasse, Battle Royale, Chaos, pass de saison, skins, clans), trancher ses règles, puis rédiger sa fiche. Commiter.
