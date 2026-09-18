# Fiche étape 7.5 - Réglages du Classique

Brief de session. Objectif unique: changer en une seule fois les règles du mode d'origine que le porteur du projet a demandées en jouant. Le Classique prend le nom de « Horde »; les faux ninjas touchés à la suite font monter un multiplicateur de combo, sur le modèle du Massacre, qui ajoute une prime au score; les points flottants changent de couleur et de taille avec le combo; joueurs, faux ninjas et Black Ninjas vont tous à 150 pixels par seconde hors bonus. Ces changements touchent deux comportements protégés par CLAUDE.md (le score comme stock, les vitesses relatives) et l'empreinte des parties: on les fait ensemble, et l'empreinte ne change qu'une fois.

## Origine de cette fiche

Aucune fiche n'existait: l'étape a été ajoutée le 18 septembre 2026, au tri de l'étape 5.5. Elle est rédigée le 18 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- l'entrée 7.5 de la section 4 du ROADMAP, et la fiche 7.4 prise comme modèle;
- l'entrée du 18 septembre 2026 du journal de `docs/design/README.md` (vitesse commune choisie: 150 pixels par seconde);
- l'état du dépôt au commit `191a65b`, et le handoff 5.5;
- les décisions posées au porteur du projet le 18 septembre 2026, ci-dessous.

**Aucune référence de comportement pour le combo.** Aucune version du jeu d'origine n'en avait en Classique. Les tests de caractérisation restent l'étalon de tout le reste, et ne sont pas touchés: ils décrivent le jeu d'origine, dont la réécriture s'écarte ici volontairement, sur décision du porteur du projet.

**Numéro**: 7.5, dans la phase 7, « Modes de jeu ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (5.5, ou le handoff partiel de cette étape), cette fiche, `.claude/rules/sim-purity.md` et la fiche 7.4.

## Décisions du porteur du projet, 18 septembre 2026

1. **La prime de combo.** Chaque faux ninja capturé reste un point de stock, perdable. Au-delà de x1, chaque capture ajoute en plus une prime égale au multiplicateur moins un, rangée dans une réserve à part. Le score affiché vaut les ninjas portés, plus les points de Black Ninjas, plus la réserve. **Se faire capturer vide la réserve**: le score reste un stock qui retombe à zéro, Black Ninjas mis à part. La réserve n'est pas transférée au capteur.
2. **Les règles du Massacre**: une capture qui suit la précédente de **2 secondes** au plus prolonge le combo; le multiplicateur monte d'un cran toutes les **5 captures** (x2 à la cinquième, x3 à la dixième), **plafonné à x5**. Le combo retombe quand sa fenêtre est dépassée, quand on se fait capturer, et quand un Black Ninja nous prend.
3. **Seuls nos contacts directs comptent**: tout faux ninja que l'on touche soi-même et qui passe à notre couleur, qu'il soit neutre ou pris à un autre joueur. La contagion entre ninjas ne compte pas, capturer un joueur non plus (ses ninjas arrivent d'un bloc).
4. **Horde seulement.** Le Tactique et les Équipes gardent leur score actuel.
5. **La prise par un Black Ninja** coûte à la réserve la même part qu'aux ninjas (la part réglée, cinquante pour cent par défaut, arrondie en dessous), et fait retomber le combo.
6. **Les points flottants, du froid vers le chaud**: x1 blanc, x2 cyan, x3 vert néon, x4 or, x5 magenta avec une lueur; la taille monte de 100 à 180 pour cent, par pas de 20. L'échelle s'applique aussi au Massacre, qui partage la règle du combo.
7. **Le Classique s'appelle désormais « Horde »**, partout où le joueur lit le nom. L'identifiant interne `classique` reste, pour que les parties et records enregistrés restent lisibles.
8. **Vitesse commune de 150 pixels par seconde** (décision du 18 septembre 2026, étape 5.5), confirmée ce jour pour les Black Ninjas: ils iront aussi vite que les joueurs, et on ne les distance plus sans bonus de vitesse; on les évite par les murs.

Écartés: le score en points rangés comme au Massacre, la réserve transférée au capteur ou jamais perdue; une fenêtre de 3 secondes, un cran toutes les trois captures; les ninjas neutres seuls, la contagion comprise; le combo en Tactique et en Équipes; la réserve entière perdue ou intacte face à un Black Ninja; une échelle du blanc vers le rouge, une échelle propre à la Horde; garder le nom « Classique »; des Black Ninjas plus lents.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **Une règle de combo, deux modes.** La fenêtre, le cran et le plafond quittent `MASSACRE` pour des constantes `COMBO` de `packages/shared`, que le Massacre et la Horde lisent toutes deux, avec `multiplicateurDuCombo`. Valeurs inchangées: l'empreinte du Massacre ne bouge que par la vitesse.
2. **L'état du combo vit dans un champ facultatif propre au mode** (`EtatPartie.horde`), posé au lancement, comme le Massacre. Il porte, pour chaque joueur, les captures de son combo en cours, le temps qui reste à sa fenêtre, et sa réserve. Un joueur qui n'y figure pas encore (entré en cours de partie) a l'état de départ. Une partie d'un autre mode n'a pas ce champ.
3. **Le combo avance dans la règle de contacts de la Horde**: un contact entre un joueur et un faux ninja qui fait réellement passer le ninja à sa couleur prolonge le combo, relance la fenêtre, et ajoute à la réserve le multiplicateur atteint moins un. La contagion entre ninjas passe par le même code qu'avant, sans combo.
4. **La fenêtre s'épuise, et les Black Ninjas se paient, dans ce que le mode fait des entrées**, avant le relevé des contacts, d'après les prises de Black Ninja du battement, comme au Massacre. Le combo ne retombe qu'une fois sa fenêtre dépassée: une capture qui suit la précédente d'exactement deux secondes le prolonge encore.
5. **Une capture de joueur en Horde** est celle du Classique, suivie de la remise à zéro de la réserve et du combo de la victime. Le combo du capteur ne bouge pas.
6. **Un Black Ninja détruit par un joueur invincible** rapporte ses quinze points, sans multiplicateur, et ne touche pas au combo: ce n'est pas un faux ninja passé à notre couleur.
7. **Le score d'un joueur en Horde** ajoute sa réserve aux ninjas portés et aux points de Black Ninjas. Le classement, le bilan, les récompenses et les records suivent, sans changer de forme.
8. **Un fait nouveau du moteur, le ralliement**: le joueur, le ninja, sa position, le combo et le multiplicateur atteints. Sa notification ne va qu'au joueur concerné: elle nourrit ses points flottants, son compteur de combo et le son de ses captures.
9. **La page de la Horde lit ses ralliements**: un point flottant par ralliement, qui vaut le multiplicateur (le ninja plus sa prime), le son des captures, le compteur de combo du Massacre repris (« 12 ninjas »), et l'annonce d'un palier. Le Tactique et les Équipes gardent les points et le son déduits des couleurs.
10. **Le niveau d'un point flottant** est le multiplicateur de sa capture ou de sa mort, de 1 à 5, et se dessine par une classe de style; les points des Black Ninjas et des joueurs capturés gardent leurs couleurs.
11. **La vitesse commune vaut dans tous les modes**: les vitesses du moteur ne dépendent pas du mode. Les vitesses par pas du jeu d'origine restent écrites, pour les tests de caractérisation qui les figent.
12. **Le nom « Horde »** remplace « Classique » dans les libellés de la page, l'aide, les annonces et les écrans. Dans le code et la documentation, l'identifiant reste `classique`, et « Horde » se dit du mode joué.

## Périmètre

### Lot A. Le moteur et le contrat

1. **Les constantes** `COMBO` et la vitesse commune (micro-décisions 1 et 11).
2. **L'état de la Horde** et son lancement (micro-décision 2).
3. **Le combo, la réserve et le ralliement** (micro-décisions 3, 5, 6 et 8), **la fenêtre et les Black Ninjas** (micro-décision 4).
4. **Le score** (micro-décision 7).

### Lot B. Le serveur

1. **La notification du ralliement**, au seul joueur concerné (micro-décision 8), dans le contrat et le serveur.
2. **Tests à travers le vrai serveur**: un combo en Horde, la réserve au classement, la réserve perdue à la capture.

### Lot C. La page

1. **Le nom « Horde »** partout où il se lit (micro-décision 12).
2. **Les points flottants** de la Horde tirés des ralliements, et leur niveau en Horde et en Massacre (micro-décisions 9 et 10), avec l'échelle de couleurs et de tailles.
3. **Le compteur de combo** de la Horde, **l'annonce d'un palier**, **le son des captures** (micro-décision 9). **Aide**: la ligne de la Horde dit le combo.

### Lot D. Mesure et documentation

1. **Empreinte**: les quatre parties de référence changent, par la vitesse et le combo; relever les nouvelles, qui deviennent la référence.
2. **Documentation**: CLAUDE.md (comportements à préserver 1, 3 et 5, datés), le cadrage, le journal de conception, le ROADMAP.

## Hors périmètre

- Le combo en Tactique, en Équipes ou en Chasse.
- Un fait de ralliement pour la contagion entre ninjas.
- Tokyo unique, l'option pluie, plus de 150 bots: étape 7.6.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Combo (TU)**: une capture directe prolonge le combo; la prime aux paliers x2 à x5 et le plafond; la fenêtre de 2 secondes (prolongée à 2 secondes pile, retombée au-delà); un ninja déjà à notre couleur ne compte pas; un ninja pris à un autre joueur compte; la contagion ne compte pas; le ralliement au journal.
- **Réserve (TU)**: vidée à la capture, avec le combo; le capteur n'en reçoit rien; la moitié perdue face à un Black Ninja, et le combo; un Black Ninja détruit ne touche pas au combo.
- **Score (TU)**: ninjas portés, Black Ninjas et réserve; le Tactique et les Équipes sans réserve.
- **Vitesse (TU)**: joueur, faux ninja et Black Ninja à 150 pixels par seconde; le bonus inchangé.
- **Moteur (TU)**: déterminisme; les autres modes sans champ `horde`.
- **Serveur (TI)**: la notification au seul joueur concerné; une partie Horde où le combo fait monter le classement.
- **Client (TU)**: le nom « Horde » dans les écrans; les points flottants tirés des ralliements, leur niveau, le niveau des morts du Massacre; le compteur de combo et l'annonce de palier en Horde; le son des captures en Horde.
- **Bout en bout**: les scénarios existants, avec le nouveau nom.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie Horde se crée, se joue et s'enregistre depuis la page, avec le combo visible et les points flottants colorés, au bureau et sur téléphone.
2. **Le Tactique, les Équipes, la Chasse et le Massacre ne changent que par la vitesse**: leurs tests existants passent, sauf ceux qui figent une vitesse, mis à jour.
3. La couverture de `packages/sim` ne baisse pas (99,84 pour cent au handoff 5.5).
4. Les nouvelles empreintes des quatre parties de référence sont relevées dans le handoff.
5. CLAUDE.md, le cadrage et le journal de conception décrivent ce qui a été construit.

## Points de vigilance

1. **Le score reste un stock**: la réserve se perd avec les ninjas, sinon la tension de fin de partie disparaît. Un test le fige.
2. **La contagion ne doit pas faire monter le combo**: la règle distingue le contact d'un joueur de celui d'un ninja; un test le fige.
3. **Le volume des ralliements**: un joueur qui traverse un troupeau en fait plusieurs par battement; la notification ne va qu'à lui.
4. **Les tests qui figent une vitesse de faux ninja ou de Black Ninja** changent volontairement; ceux de caractérisation, non.

## Réconciliation pendant l'étape (18 septembre 2026)

Écarts entre la fiche et ce qui a été construit, consignés au journal de `docs/design/README.md` quand ils touchent une décision.

1. **Les ralliements d'un battement voyagent en une seule notification** (`ralliement`, charge `RalliementVu`), regroupés par le serveur: la micro-décision 8 prévoyait une notification par ralliement. Le fil des faits de la page est plafonné à cinquante, et un troupeau traversé en ferait plusieurs d'un coup.
2. **Le compteur de combo du HUD est devenu commun**: `Hud.massacre` s'appelle `Hud.combo` (type `ComboHud`), et son compte se dit en morts au Massacre, en ninjas en Horde; la ligne des ninjas restants se cache en Horde. Il tombe aussi à la capture d'un joueur.
3. **Les constantes du combo ont quitté `MASSACRE`** pour `COMBO` (`FENETRE_MS`, `COUPS_PAR_CRAN`, `MULTIPLICATEUR_MAXIMUM`), et `multiplicateurDuCombo` vit dans `packages/shared/src/combo.ts`, qui remplace `massacre.ts`.
4. **La partie de référence du moteur et l'outil d'empreinte lancent désormais leurs parties** (`lancerLaPartie`), comme le serveur: sans cela, la Horde y aurait joué sans combo. L'instantané de `partie.test.ts` a changé en conséquence, et par la vitesse.
5. **Le test d'intégration du serveur ne force pas de prime**: la graine d'une partie est tirée au hasard par le serveur, et une prime nulle y reste possible. Il vérifie l'accord entre les notifications, l'état et le classement; les paliers se testent dans le moteur.
6. **`.claude/launch.json` passe en port automatique**: le port 3000 était pris par le serveur d'une autre conversation. Le serveur lit déjà `PORT`.
7. **À regarder par le porteur du projet**: l'or du x4 est très proche de l'or des points d'un Black Ninja détruit, que seule sa taille distingue.
8. **Le niveau d'un point flottant se pose en attribut** (`data-niveau`), pas en classe: la feuille de style le lit tel quel.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-5-handoff.md`: les décisions construites, les écarts à cette fiche, les nouvelles empreintes, l'état de la CI. Prochaine action exacte: ouvrir l'étape 7.6, options de partie (Tokyo unique avec une option pluie, plus de 150 bots). Commiter.
