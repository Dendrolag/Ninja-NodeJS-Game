# Fiche étape 7.10 - La poche et la fumée

Brief de session. Objectif unique: donner à chaque joueur une poche d'une place, qui garde un objet ramassé jusqu'à ce qu'il choisisse de s'en servir, et y mettre le premier de ces objets, la fumée. Déclenchée, elle enveloppe le ninja d'un nuage et le fait réapparaître ailleurs sur la carte, loin des menaces.

## Origine de cette fiche

Aucune fiche n'existait. Le porteur du projet a proposé le 28 septembre 2026: « Ajout bonus "escape" : nuage de fumée (comme dans l'imaginaire des ninjas), le joueur réapparait dans un autre endroit aléatoire de la map (Ou skill présent, activable X fois par partie ?) ». Dans la même conversation, il a proposé les mines, qui deviennent les étapes 7.11 et 7.12. Les trois ont été étudiées ensemble, et les règles tranchées le même jour.

Rédigée le 28 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- les décisions tranchées avec le porteur du projet, ci-dessous;
- la fiche 7.9 prise comme modèle;
- l'état du dépôt au commit `2a7084a`, et le handoff 3.9.

**Numéro**: 7.10, dans la phase 7, « Modes de jeu ». Elle précède les étapes 7.11, la mine posée, qui se range dans la même poche, et 7.12, les mines de zone.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff, cette fiche, les fiches 7.11 et 7.9, et `.claude/rules/sim-purity.md`.

## Ce qu'est le jeu aujourd'hui

- **Tous les bonus agissent dès qu'on les ramasse**, pour une durée qui se cumule (comportement à préserver 10). Aucun objet ne se garde pour plus tard.
- **Chaque nature de bonus tente sa chance à part** (`tenterUneApparitionDeBonus`, `packages/sim/src/objets.ts`): ajouter une nature met plus d'objets sur la carte, sauf à baisser les taux. Une nature désactivée ne consomme aucun tirage. En Tactique, chaque bonus tente sa chance à la moitié de son taux (`OBJETS_TACTIQUES.PART_DU_TAUX_DES_BONUS`).
- **Une seule intention d'action existe**, `capturer` (`EntreeJoueur`, `packages/sim/src/moteur.ts`): le tir en Tactique et en Chasse, le katana en Massacre, sur la barre d'espace (`TOUCHE_CAPTURER`) et sur un bouton tactile qui n'est monté que dans ces modes (`packages/client/src/hud/surcouche.ts`). En Horde et en Équipes, un joueur ne fait que se déplacer.
- **Le tirage d'une position existe** (`positionDApparition`, `packages/sim/src/etat.ts`): à la graine, hors des murs, à distance des positions occupées, avec des écarts de repli quand la carte est pleine.
- **Tout le monde va à 150 pixels par seconde** hors bonus (étape 7.5). Un Black Ninja lancé ne se distance qu'avec le bonus de vitesse.
- **Les faux ninjas ne suivent pas le joueur**: ils changent de couleur, pas de maître. Se téléporter ne laisse aucun cortège en plan.

## Décisions du porteur du projet, 28 septembre 2026

1. **La fumée est un bonus qu'on garde et qu'on déclenche**, et non un effet au ramassage, ni une compétence de base à X utilisations par partie. Écartés: l'effet immédiat, qui déplace au hasard un joueur qui n'est pas menacé et tient de la loterie; la compétence de base, qui affaiblirait la capture d'un joueur, seule remontée au score, puisque le premier garderait toujours sa fumée pour la fin, et rendrait les proies de la Chasse presque imprenables.
2. **Destination**: tirée au hasard, loin des joueurs et des Black Ninjas, et au moins à un tiers de la carte du point de départ, pour qu'elle serve vraiment à fuir.
3. **Déclenchement immédiat**. Tout son intérêt est dans le réflexe. La parade adverse: une petite icône sur le ninja dit à tous qu'il a une fumée en poche.
4. **Aucune protection à l'arrivée**. Le tirage évite déjà les menaces.
5. **Un nuage au départ et un à l'arrivée**, vus de tous.
6. **Une fumée au plus en poche**, perdue si l'on est capturé.
7. **Dans tous les modes**. En Chasse, c'est l'outil de la proie, et les traqueurs peuvent aussi s'en servir.
8. **La poche n'a qu'une place**, commune à la fumée et à la mine posée de l'étape 7.11: c'est l'une ou l'autre, il faut choisir.

Écartés: la forme A (effet au ramassage) et la forme C (compétence de base); une protection à l'arrivée; un nuage d'arrivée caché aux autres; plusieurs fumées en poche. Idée notée sans suite: un malus fumée, qui téléporterait au hasard tous les autres joueurs.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **Les objets de poche forment une famille à part** (`TYPES_OBJETS_DE_POCHE` dans `packages/shared`), qui ne contient que `fumee` à cette étape et recevra `mine` à l'étape 7.11. Ce sont des bonus pour le moteur (catégorie `bonus` d'un objet posé), mais ils ne portent aucune durée: le ramassage remplit la poche au lieu de lancer un effet.
2. **Ils tentent leur chance après les bonus existants**, dans le même passage, chacun à son taux, et à la moitié de son taux en Tactique comme les autres bonus. Le réglage de chaque objet de poche est celui d'un bonus: actif et taux d'apparition, sans durée. Taux par défaut: celui du plus rare des trois bonus d'origine, la fumée devant rester un objet qu'on remarque.
3. **Une poche pleine ne ramasse pas**: le joueur passe sur l'objet sans le prendre, et l'objet reste sur la carte pour un autre.
4. **La poche vit dans l'état du joueur** (`Joueur.poche`, absente ou la nature de l'objet). Elle se vide à toute prise: capture par un joueur, prise par un Black Ninja, infection en Chasse, mort en Massacre. Un joueur dont le lien tombe la garde pendant les 30 secondes du retour (étape 2.5).
5. **Une seconde intention d'action**, `utiliserLaPoche`, à côté de `capturer`: un drapeau d'entrée, jamais un état, comme le veut `entrees.ts`. Une entrée qui la porte sans rien en poche ne fait rien. Elle a son propre seau de cadence (`packages/shared/src/bornes.ts`).
6. **La touche E** au clavier, et un **second bouton tactile rond**, monté dans tous les modes, grisé quand la poche est vide et portant l'icône de l'objet quand elle est pleine. La touche et la place du bouton se valident à la recette, sur la planche.
7. **La fumée se résout avec les intentions, avant les contacts**: un joueur qui la déclenche dans le battement où un adversaire le touche s'échappe. C'est le réflexe que la décision 3 récompense.
8. **La destination**: `positionDApparition`, avec pour positions occupées les joueurs, les Black Ninjas et l'Évadé, et une distance au point de départ d'au moins un tiers de la plus grande dimension de la carte. Si aucun tirage ne tient les deux, on relâche la distance au départ avant l'écart aux menaces, comme les écarts de repli relâchent l'écart aux entités. La valeur (un tiers) vit dans `packages/shared` et se règle à la recette.
9. **Rien d'autre ne change pour le joueur qui s'enfuit**: ses ninjas, son score, son combo en Horde, le x2 de l'Évadé, ses effets en cours, son délai entre deux captures.
10. **Deux faits pour tous**, le nuage de départ et celui d'arrivée, avec leurs positions, pour que la page les dessine. Aucune annonce en grand titre: un nuage se voit sur la carte, et un grand titre à chaque fumée saturerait l'écran.
11. **Le flux d'état porte la poche** de chaque joueur, pour l'icône que tous voient (décision 3): un indicateur de plus dans l'octet des indicateurs d'un joueur, comme le x2 de l'étape 7.9. Une partie sans objet de poche doit s'écrire à l'octet comme avant, sans changer `VERSION_DU_FLUX`.
12. **Le rendu se choisit sur planche** au début de l'étape (`docs/design/etape-7-10/`): le nuage (particules ou disque qui s'évase et se dissipe), l'icône de poche sur le ninja, la carte de poche au HUD, le bouton tactile. Aucun fichier d'image nouveau: tout se dessine en code.
13. **Un son**: la fumée prend un son existant, choisi dans l'étape.

## Périmètre

### Lot A. Le contrat

1. **Les valeurs**: la distance minimale au départ, le taux par défaut (`POCHE` ou `FUMEE` dans `packages/shared`).
2. **La famille des objets de poche** et son réglage, dans les réglages de bonus (micro-décisions 1 et 2), avec sa validation aux bornes.
3. **L'intention** `utiliserLaPoche`, sa validation et sa cadence (micro-décision 5).
4. **Les vues et les événements**: la poche dans le flux, les deux faits de nuage (micro-décisions 10 et 11).

### Lot B. Le moteur

1. **Le ramassage**: la poche se remplit, une poche pleine ne ramasse pas (micro-décision 3).
2. **Le vidage** à toute prise, dans chacun des cinq modes (micro-décision 4).
3. **La fumée**: la destination, l'ordre de résolution, ce qui ne change pas (micro-décisions 7 à 9).

### Lot C. Le serveur

1. **Le relais de l'intention** depuis Socket.IO jusqu'à l'entrée du moteur, avec son seau de cadence.
2. **Tests à travers le vrai serveur**: un joueur qui ramasse une fumée et s'en sert, dans une Horde et dans une Chasse.

### Lot D. La page

1. **La planche**, puis le rendu retenu: les deux nuages, l'icône de poche sur le ninja, la carte de poche au HUD (micro-décision 12).
2. **La touche et le bouton tactile** (micro-décision 6).
3. **Le réglage** dans le formulaire de création et dans le récapitulatif du salon.
4. **L'aide**: la fumée, la poche et sa touche.

### Lot E. Mesure et documentation

1. **Empreinte**: les parties de référence, fumée désactivée, identiques à l'octet à celles du dernier handoff. Puis leurs nouvelles empreintes, fumée active, consignées au handoff comme changement voulu.
2. **Banc de charge**: aucun écart attendu, consigné dans `docs/mesures/charge-serveur.md` si la mesure en montre un.
3. **Documentation**: le journal de conception, le ROADMAP.

## Hors périmètre

- La mine posée (étape 7.11) et les mines de zone (étape 7.12).
- Une poche de plus d'une place, une fumée à plusieurs charges, une compétence de base.
- Un malus fumée.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: les valeurs; le réglage et ses bornes; la validation de l'intention; le codage de la poche et l'aller-retour; une partie sans objet de poche qui s'écrit à l'octet comme avant.
- **Moteur (TU)**: le ramassage, la poche pleine qui laisse l'objet; le vidage à chaque sorte de prise, dans chaque mode; la destination loin des menaces et loin du départ, déterministe, avec le repli sur une carte encombrée; la fumée qui l'emporte sur un contact du même battement; l'intention sans objet sans effet; ce qui ne change pas (ninjas, score, combo, x2, effets); aucun tirage de plus quand la fumée est désactivée.
- **Serveur (TI)**: le lot C.
- **Client (TU)**: la touche et le bouton; l'icône de poche; la carte du HUD; le réglage au formulaire.
- **Bout en bout**: une partie où le joueur ramasse une fumée et s'en sert; les scénarios existants.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. La fumée se ramasse et se déclenche dans les cinq modes, depuis la page, au clavier et au tactile.
2. Le rendu correspond à la planche retenue, vérifié dans le navigateur de Claude Code, avec une capture d'écran.
3. L'empreinte des parties de référence, fumée désactivée, est identique à celle du dernier handoff.
4. La couverture de `packages/sim` ne baisse pas.

## Points de vigilance

1. **L'intention n'est jamais un état**: le client dit « j'utilise ma poche », jamais « j'ai une fumée ». C'est le moteur qui sait ce que contient la poche (règle de `entrees.ts`, failles S2 et S3 de l'audit).
2. **La fumée ne doit pas devenir imprenable**: à surveiller en jouant, avec le taux par défaut, que la capture d'un joueur reste la remontée au score.
3. **Le miroir** (étape 8.3): la destination est une position du terrain retourné, comme toutes les autres.
4. **La Chasse et le Massacre** ont déjà une touche d'action: vérifier sur téléphone que les deux boutons ne se gênent pas.
5. **La poche prépare l'étape 7.11**: la construire pour deux natures, sans rien coder de la mine.

## Réconciliation pendant l'étape (28 septembre 2026)

Écarts entre la fiche et ce qui a été construit, consignés au journal de `docs/design/README.md`.

1. **Rendus choisis par le porteur du projet** sur la planche `docs/design/etape-7-10/1-fumee.png`: le nuage C, cerné comme les sprites, qui gonfle puis se dissipe en bouffées qui montent; au HUD, la carte A parmi les effets, sans jauge, qui porte la touche E; sur téléphone, le bouton A, un disque de brume à gauche de la minimap, caché quand la poche est vide.
2. **La poche n'est visible de personne d'autre** (décision 3 révisée par le porteur du projet: « ça trahirait trop les joueurs qui en possèdent »). Aucune marque sur le ninja. La poche ne voyage pas dans le flux d'état, commun à toute la partie: un premier jet la codait dans l'octet des indicateurs d'un joueur (micro-décision 11), retiré. Elle part au seul joueur, par un message `poche`, à chaque changement (`annoncerLesPoches`, dans `ServeurSocket.ts`); la mémoire de ce qui a été annoncé repart de zéro à l'entrée dans une partie et au retour après une coupure, comme la page, qui vide sa poche au lancement.
3. **Le pictogramme reprend la forme du nuage C**, à la demande du porteur du projet: lobes cernés et trois bouffées (`assets/objets/fumee.svg`). C'est un fichier SVG, comme les pictogrammes des objets du Tactique (étape 7.7): la fiche disait « aucun fichier d'image », un pictogramme d'objet en demande un, et il est dessiné en code.
4. **Un son à l'activation, que le porteur du projet fournira.** Le nom `fumee` est posé dans la table des sons (`SONS`, `packages/shared/src/ressources.ts`), entendu de tous, comme le nuage se voit de tous; il joue provisoirement le souffle du katana (`katana-swing.mp3`). Une fumée empochée sonne comme un bonus ramassé.
5. **L'annonce**: à l'empochement, un grand titre « En poche », « Fumée », « Disparaissez quand vous voulez », à la couleur de la fumée. Aucun titre au nuage.
6. **La touche E** s'ignore dans un champ de saisie, le chat par exemple, et maintenue ne sert qu'une fois. Le rappel des touches en jeu ajoute « E pour la fumée » quand elle est en jeu; l'aide a une section « À garder en poche », et E et le bouton de la poche parmi les commandes.
7. **Les réglages**: un groupe `objetsDePoche` à la racine des réglages (actif, taux), dans tous les modes. Au formulaire, la fumée est une section du groupe Bonus, sans durée; le récapitulatif du salon a une ligne « Fumée ». Taux par défaut: 15, celui de l'Invincibilité.
8. **Le nuage** est une couche de la scène à part (`fumees`), au-dessus des personnages et sous les toits: il cache le ninja qui part, et celui qui reparaît en sort. Le nuage d'un autre joueur dans une zone d'invisibilité ne se montre pas, comme l'éclair d'un tir. Les trois scénarios de rendu qui composent leur scène à la main ont reçu le champ `fumees`, comme ils avaient reçu `marques` à l'étape 7.9.
9. **Le scénario de bout en bout s'appelle `poche.spec.ts`**: `fumee.spec.ts` est le test de fumée (le « smoke test ») de l'étape 0.1. Un premier jet l'avait écrasé, restauré aussitôt depuis Git. Le scénario guide Alice au clavier ou au pouce jusqu'à une fumée, en lisant le serveur sans y écrire, puis la fait s'en servir par E ou par le bouton.
10. **Une demande servie ne se teste pas dans la room seule**, qui ne laisse pas poser une fumée dans une poche: elle se joue à travers le vrai serveur (`ServeurSocket.poche.test.ts`), dans une arène fermée.
11. **Le banc**: la fumée ne coûte rien de mesurable; avec la graine du banc, elle change la partie jouée, plus chargée à 300 faux ninjas. Section 21 de `docs/mesures/charge-serveur.md`.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-10-handoff.md`: les décisions construites, les écarts à cette fiche, les deux jeux d'empreintes, l'état de la CI. Prochaine action exacte: l'étape 7.11, ou l'étape suivante de la section 3 du ROADMAP. Commiter, pousser, vérifier la CI et la mise en ligne.
