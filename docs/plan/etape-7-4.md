# Fiche étape 7.4 - Mode Massacre

Brief de session. Objectif unique: ajouter au jeu son cinquième mode, le Massacre. On ne capture plus: un coup de katana en arc tue les bots et les joueurs qu'il balaie, chaque mort laisse une effusion de sang, les joueurs y impriment des traces de pas, et les morts enchaînées font monter un multiplicateur de points. La carte se vide; la partie s'arrête quand tout est tué ou au terme du temps. Le mode se joue seul ou à plusieurs. C'est la troisième des fonctionnalités reportées, choisie par le porteur du projet après la Chasse.

## Origine de cette fiche

Aucune fiche n'existait: le handoff 7.3 renvoie au mode Massacre, dont l'intention et l'étude sont consignées dans `docs/design/idee-mode-massacre.md`. Elle est rédigée le 16 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- la section 3 du ROADMAP, et la fiche 7.3 prise comme modèle;
- la note `docs/design/idee-mode-massacre.md` (intention, coup de katana, sang et traces de pas tout en code, sons);
- l'état du dépôt au commit `a8e1609`, et le handoff 7.3;
- les décisions posées au porteur du projet le 16 septembre 2026, ci-dessous.

**Aucune référence de comportement.** Aucune version du jeu d'origine n'a de mode Massacre: il n'y a rien à caractériser. Les règles ci-dessous font foi, et les comportements à préserver de CLAUDE.md s'appliquent partout où elles ne disent pas le contraire.

**Numéro**: 7.4, dans la phase 7, « Modes de jeu ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (7.3, ou le handoff partiel de cette étape), cette fiche, `.claude/rules/sim-purity.md`, la note `docs/design/idee-mode-massacre.md` et la fiche 7.3.

## Décisions du porteur du projet, 16 septembre 2026

1. **Nom « Massacre ».**
2. **Plus de capture: un coup de katana tue.** Le coup balaie un arc de **160 degrés sur 60 pixels** devant le joueur, dans la direction de son dernier déplacement, avec le bouton et la touche de capture du Tactique. **400 millisecondes** entre deux coups.
3. **La carte se vide.** Un bot tué ne revient pas. La partie s'arrête quand le dernier bot tombe, ou au terme du temps. **Quand la carte est vide avant le terme, chaque joueur reçoit 5 points par seconde restante.**
4. **Combos.** Un bot tué vaut **10 points fois le multiplicateur**. Une mort qui suit la précédente de **2 secondes** au plus prolonge le combo; au-delà, il retombe. Le multiplicateur monte d'un cran toutes les **5 morts** du combo (x2 à la cinquième, x3 à la dixième), **plafonné à x5**.
5. **Le katana tue aussi les joueurs (PvP).** La victime perd son combo et **la moitié de ses points, qui vont au tueur**. Elle réapparaît ailleurs, protégée 3 secondes. Une seconde au moins entre deux joueurs tués par le même tueur.
6. **Black Ninjas, bonus, malus et zones gardés, adaptés.** Un Black Ninja attrape comme ailleurs: la victime perd la moitié de ses points et son combo. Il se tranche pour **15 points fois le multiplicateur**, et ne compte pas pour vider la carte. Les bonus restent; un malus frappe les autres joueurs, donc personne en solo; les zones restent, sauf le chaos, qui repeint des couleurs sans objet ici.
7. **Solo lançable, et record personnel.** Un joueur seul lance depuis le salon, comme en Classique. Les règles de progression ne changent pas (XP au temps, pas de ligue seul). Le profil garde le **meilleur score en Massacre joué seul**.
8. **Le sang est une préférence du joueur**: normal, discret (petites taches qui s'effacent, pas de traces de pas), désactivé (un éclat lumineux seul). Chacun choisit pour lui, dans les préférences de la page; rien ne change au jeu.
9. **Les sons du katana sont générés par un script** (un balayage de lame, un impact tranchant) et enregistrés en fichiers dans `assets/sons`, remplaçables plus tard sans toucher au code.
10. **Huit joueurs au plus.**

Écartés: la réapparition des bots, les vagues; la coopération, la prime fixe par joueur tué, le vol d'un quart; la fin sans bonus, le PvP qui continue sur une carte vide; le retrait des Black Ninjas ou des malus et zones; le solo sans progression; le sang réglé par l'hôte, le sang sans option; des sons cherchés en ligne ou fournis plus tard; douze ou quatre joueurs.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **Nom « Massacre », identifiant `massacre`.**
2. **L'état du mode vit dans un champ facultatif propre au mode** (`EtatPartie.massacre`), posé au lancement de la partie, comme la Chasse. Il porte, pour chaque joueur, son orientation, l'attente avant son prochain coup, ses points, les morts de son combo en cours et le temps qui reste à sa fenêtre, et ses bots tués; plus un indicateur « carte vidée ». Un joueur qui n'y figure pas encore (entré en cours de partie) a l'état de départ. Une partie d'un autre mode n'a pas ce champ.
3. **Le cône du Tactique devient réglable.** `dansLeCone` reçoit la géométrie d'un cône (ouverture et portée); le Tactique et la Chasse passent la leur, inchangée. L'empreinte des parties le garde.
4. **Le coup** se joue dans ce que le mode fait des entrées, après les déplacements. Les coups du battement partent dans un ordre tiré au sort, comme les tirs du Tactique; un joueur tué par un coup précédent perd le sien. Un coup part si le joueur est présent et que son attente est écoulée; il relance l'attente même dans le vide. Les cibles sont jugées sur les positions d'avant le coup: les autres joueurs d'abord, puis les bots et les Black Ninjas, dans l'ordre de l'état.
5. **Tuer un joueur** exige ce qu'exige une capture: la victime n'est ni protégée ni invincible, et le tueur a laissé passer une seconde depuis son dernier joueur tué. La victime garde sa couleur (elle n'a rien à céder qui la porte), réapparaît ailleurs avec une protection neuve et un combo à zéro. Les points volés sont la moitié des siens, arrondie en dessous, et s'ajoutent tels quels au tueur, sans multiplicateur; tuer un joueur ne prolonge pas le combo. Les compteurs et le journal des captures avancent comme pour une capture.
6. **Tuer un bot ou un Black Ninja** le retire de la carte. La mort prolonge le combo, puis rapporte sa valeur fois le multiplicateur atteint. Un Black Ninja tué compte aussi comme détruit.
7. **Toucher ne produit rien en Massacre**: ni capture, ni repeinte, ni destruction d'un Black Ninja par un joueur invincible. L'invincibilité protège du katana et des Black Ninjas. C'est l'adaptation du Black Ninja: le katana est la seule arme.
8. **La perte face à un Black Ninja** (la part réglée des points, cinquante pour cent par défaut, et le combo) s'applique dans ce que le mode fait des entrées, d'après les prises de Black Ninja du même battement, qui ont eu lieu juste avant. Aucun bot ne change de couleur: les bots n'appartiennent à personne.
9. **La carte vidée**: quand un coup tue le dernier bot ordinaire, chaque joueur présent reçoit cinq points par seconde entière restante, et la partie est décidée. Les Black Ninjas n'en sont pas.
10. **Les réglages imposés par le mode** retirent la zone de chaos, quoi que l'hôte ait choisi.
11. **Le score d'un joueur en Massacre** est la somme de ses points, rangée dans l'état parce qu'elle ne se déduit pas des bots. Les joueurs sont classés comme en Classique: aux points, puis aux joueurs tués. Le bilan, les récompenses et le placement sont ceux du Classique; le temps joué est le temps réellement joué, le bonus de fin payant déjà la vitesse.
12. **Le record personnel se déduit, il ne se stocke pas** (cadrage, section 5): c'est le meilleur score des résultats du compte en Massacre dans une partie d'un seul joueur. Aucune colonne n'est ajoutée.
13. **Le flux d'état ne change pas de forme.** L'arme d'un joueur passe par l'état tactique (orientation; une charge si le coup est prêt, zéro sinon; l'attente avant le prochain coup). Le combo n'y figure pas: il se lit dans les coups qui ne concernent que soi.
14. **Trois faits nouveaux du moteur**, et leurs notifications à toute la partie, parce que le sang se voit de tous: un coup de katana (d'où, vers où, les morts qu'il a faites avec leur position et leur nature, les points gagnés, le multiplicateur et le combo atteints), un joueur tué (tueur, victime, position, direction du coup, points volés), la carte vidée (le bonus). La prise par un Black Ninja garde sa notification.
15. **Le sang et les traces de pas vivent dans la page.** Le dessin d'une éclaboussure se tire d'un générateur à graine dérivé de l'identifiant du mort, pour que tous les joueurs voient les mêmes taches; il se décrit par une fonction pure, testée, et s'imprime une fois sur un calque de sol persistant. Les traces de pas se décident par une fonction pure qui suit chaque joueur affiché.
16. **La préférence de sang** se range dans le navigateur, à côté des préférences de son, et se règle dans la même fenêtre.

## Périmètre

### Lot A. Le moteur et le contrat

1. **Le mode dans le contrat**: `MODES`, capacité (8), constantes du Massacre (arc, portée, attente, fenêtre et barème des combos, part volée, bonus de temps), réglages imposés (pas de chaos), migration de l'énumération des modes.
2. **Le cône réglable** (micro-décision 3).
3. **L'état du Massacre** et son lancement (micro-décision 2).
4. **Le coup, les morts, les combos, le joueur tué** (micro-décisions 4 à 6), les trois faits du moteur (micro-décision 14).
5. **La perte face à un Black Ninja** (micro-décision 8), **les contacts sans effet** (micro-décision 7).
6. **La carte vidée, le bonus et la fin** (micro-décision 9), **le score et le classement** (micro-décision 11).
7. **Empreinte** des quatre parties Classique de référence identique à celle relevée avant le lot.

### Lot B. Le serveur et la base

1. **Le flux**: l'arme d'un joueur en Massacre (micro-décision 13).
2. **Les notifications** des trois faits, envoyées à tous (micro-décision 14).
3. **Le bilan**: celui du Classique, temps réellement joué.
4. **Le record personnel** dans les statistiques du compte et la route du profil (micro-décision 12).
5. **Tests à travers le vrai serveur**: une partie Massacre lancée seul, un coup qui tue, un combo, un joueur tué à deux, la carte vidée qui termine la partie avec son bonus; une partie Massacre enregistrée, et le record relu.

### Lot C. La page

1. **Création**: la tuile Massacre, sa phrase et son pictogramme; la zone de chaos non proposée.
2. **Salon**: rien à attendre pour lancer seul; pas de chaos au récapitulatif.
3. **Jeu**: le bouton et la touche du katana, l'arc de visée, la traînée du coup qui balaie l'arc, l'éclat sur chaque mort, un micro-arrêt et une légère secousse de caméra; le combo au HUD (multiplicateur, morts, fenêtre qui s'épuise); les points qui s'envolent.
4. **Sang**: éclaboussures sur un calque de sol persistant, cadavre couché et assombri qui s'efface, traces de pas; la préférence (normal, discret, désactivé).
5. **Sons**: le script qui génère le balayage et l'impact, les fichiers, leurs déclencheurs.
6. **Annonces**: un joueur tué (par soi, par un autre), la carte vidée et son bonus, un palier de combo. **Aide**: une ligne sur le mode.
7. **Fin de partie** et **profil**: le classement du Classique; le record en Massacre solo au profil.

### Lot D. Bout en bout, mesure et documentation

1. **Scénario** (`tests/e2e/massacre.spec.ts`): une partie Massacre créée et lancée seul, le bouton du katana visible, un coup donné, le combo au HUD.
2. **Charge**: `pnpm charge --banc --mode massacre`, comparé au Classique; chiffres dans `docs/mesures/charge-serveur.md`.
3. **Empreinte** du Classique identique.
4. **Documentation**: cadrage, journal de conception, ROADMAP, CLAUDE.md (comportements à préserver 1, 2, 3, 4 et 11 en Massacre), la note d'idée marquée comme construite, crédits des sons.

## Hors périmètre

- Les poses d'attaque dessinées du ninja, des taches de sang en image, une image de ninja mort.
- La visée à la souris, un katana en plusieurs battements.
- Un classement des records entre joueurs, un record à plusieurs.
- Les autres modes (Battle Royale, Chaos), le Massacre en équipes.
- Toute modification du comportement du Classique, du Tactique, des Équipes ou de la Chasse, de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Cône (TU)**: la géométrie du katana; le Tactique et la Chasse inchangés.
- **Coup (TU)**: tout ce que l'arc contient meurt; hors de l'arc et hors de portée, rien; attente de 400 ms, coup dans le vide qui la relance; ordre des coups reproductible; un joueur tué perd son coup.
- **Combos (TU)**: points d'une mort, paliers x2 à x5 et plafond, fenêtre de 2 secondes (prolongée, retombée), plusieurs morts d'un même coup.
- **Joueur tué (TU)**: moitié des points volée, combo perdu, réapparition protégée; victime protégée ou invincible épargnée; une seconde entre deux joueurs tués.
- **Black Ninja (TU)**: tranché pour 15 fois le multiplicateur; sa prise coûte la part réglée et le combo; il ne compte pas pour vider la carte; toucher ne fait rien.
- **Fin (TU)**: carte vidée, bonus au temps restant, partie décidée; le temps; un joueur entré en cours de partie.
- **Moteur (TU)**: déterminisme; les quatre autres modes inchangés.
- **Serveur (TI)**: flux de l'arme, notifications, bilan, partie jouée seul jusqu'à la carte vidée, joueur tué à deux.
- **Base (TI)**: une partie Massacre enregistrée; le record solo, qui ignore les parties à plusieurs et les autres modes.
- **Client (TU)**: création, salon, HUD (combo, bouton), dessin d'une éclaboussure reproductible, traces de pas, préférence de sang, annonces, sons déclenchés, profil.
- **Bout en bout**: le scénario du lot D.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie Massacre se crée, se prépare au salon, se joue seul ou à plusieurs et s'enregistre depuis la page, au bureau et sur téléphone.
2. **Le Classique, le Tactique, les Équipes et la Chasse n'ont pas changé**: tests existants inchangés, empreinte du jeu des quatre parties de référence identique.
3. La couverture de `packages/sim` ne baisse pas (99,82 pour cent au handoff 7.3).
4. Le cadrage, le journal de conception et CLAUDE.md décrivent ce qui a été construit.

## Points de vigilance

1. **Les tirages ne se font qu'en Massacre**: ordre des coups, réapparition d'un joueur tué. L'empreinte est le garde-fou.
2. **Le cône réglable touche le Tactique et la Chasse**: leurs tests et l'empreinte doivent rester identiques.
3. **La perte face à un Black Ninja lit les faits du battement**: la prise doit avoir lieu avant ce que fait le mode, ce que l'ordre du moteur garantit; un test le fige.
4. **Le calque de sang coûte de la mémoire graphique**: il s'imprime à demi-résolution et se libère en quittant la partie.
5. **Le sang ne dépend que de ce que le serveur envoie**: jamais de tirage non reproductible dans son dessin.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-4-handoff.md`: les décisions construites, les écarts à cette fiche, les chiffres du banc, l'état de la CI. Prochaine action exacte: demander au porteur du projet la fonctionnalité reportée suivante (Battle Royale, Chaos, pass de saison, skins, clans), trancher ses règles, puis rédiger sa fiche. Commiter.
