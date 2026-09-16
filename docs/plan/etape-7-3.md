# Fiche étape 7.3 - Mode Chasse

Brief de session. Objectif unique: ajouter au jeu son quatrième mode, la Chasse. Des traqueurs doivent repérer les vrais joueurs cachés parmi les faux ninjas et les attraper d'un tir en cône, au risque de perdre une vie s'ils visent un faux ninja. Les proies attrapées deviennent traqueurs, et les proies marquent des points en restant mobiles. C'est la deuxième des fonctionnalités reportées, choisie par le porteur du projet après le mode Équipes.

## Origine de cette fiche

Aucune fiche n'existait: le handoff 7.2 renvoie aux fonctionnalités reportées (Chasse, Battle Royale, Chaos, pass de saison, skins, clans), dans l'ordre que fixe le porteur du projet. Elle est rédigée le 16 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- la section 3 du ROADMAP, et la fiche 7.2 prise comme modèle;
- la section 6 du cadrage (`docs/design/cadrage.md`), et la fiche 7.1 pour la capture en cône;
- la maquette (`docs/design/HANDOFF-CLAUDE-DESIGN.md`): « Chasse, 5-10 J, un traqueur, des proies. Survivez jusqu'au bout. » Une proposition non validée (cadrage, tension 2), sans règles;
- l'état du dépôt au commit `8264f69`, et le handoff 7.2;
- les décisions posées au porteur du projet le 16 septembre 2026, en deux temps (voir « Révision des règles »).

**Aucune référence de comportement.** Ni la v0.8.6, ni la v0.9.0 n'ont de mode Chasse: il n'y a rien à caractériser. Les règles ci-dessous font foi, et les comportements à préserver de CLAUDE.md s'appliquent partout où elles ne disent pas le contraire.

**Numéro**: 7.3, dans la phase 7, « Modes de jeu ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (7.2, ou le handoff partiel de cette étape), cette fiche, `.claude/rules/sim-purity.md`, la section 6 du cadrage et les fiches 7.1 et 7.2.

## Révision des règles, 16 septembre 2026

La fiche a d'abord porté une première version des règles: infection au contact, survie seule au score, victoire par camp. Les lots A (`d70c719`) et B (`a23af12`) l'ont construite. Pendant le lot C, en voyant la page, le porteur du projet a fait évoluer le mode. Le traqueur doit distinguer les vrais joueurs des faux ninjas, avec trois vies et une visée. Les proies se cachent, mais doivent bouger pour marquer. Les décisions ci-dessous remplacent les premières là où elles diffèrent, et le périmètre reprend les lots A et B en conséquence.

## Décisions du porteur du projet, 16 septembre 2026

Première série, toujours valable:

1. **La Chasse vient après les Équipes** parmi les fonctionnalités reportées.
2. **Infection.** Une proie attrapée par un traqueur devient traqueur à son tour.
3. **Les premiers traqueurs sont tirés au sort** au lancement, **un par tranche de cinq joueurs**, arrondi au-dessus.
4. **Dix joueurs au plus**, **deux pour lancer**.
5. **Un nouveau traqueur ne capture qu'au bout de trois secondes**; les proies ont trois secondes d'avance au lancement.
6. **Les ninjas servent de camouflage** et ne comptent pour personne; **pas de Black Ninjas**; bonus et malus en jeu, **un malus frappe l'autre camp**.
7. **Les traqueurs portent une couleur commune**, le rose-rouge `#FF2E7E`; les proies gardent la leur.
8. **Si les traqueurs quittent tous la partie**, une proie tirée au sort devient traqueur, et la partie continue.
9. **On n'entre pas dans une Chasse lancée**; le retour après une coupure reste permis.
10. **La minimap ne montre que son camp.**

Seconde série, qui remplace la survie seule au score et la victoire par camp:

11. **Le traqueur capture par un cône, comme en Tactique.** Le tir ne prend que l'entité la plus proche dans le cône, hors traqueurs. Un vrai joueur, c'est une infection. Un faux ninja coûte une vie.
12. **Trois vies par traqueur.** Un traqueur qui les a toutes perdues est **éliminé**. Si tous les traqueurs sont éliminés, la partie s'arrête.
13. **Un tir dans le vide ne coûte rien; une seconde entre deux tirs.** Pas de charges.
14. **Une proie marque à la distance parcourue**: un point par tranche de cent pixels, tant qu'elle est proie. Immobile, elle est cachée et ne marque rien.
15. **Un traqueur marque par ses captures et ses vies**: cinquante points par proie attrapée, et vingt-cinq par vie qui lui reste.
16. **Classement individuel aux points**, comme en Classique, quel que soit le camp. La partie s'arrête au terme du temps, quand il ne reste plus de proie, ou quand tous les traqueurs sont éliminés.

Écartés: la survie seule au score, la victoire par camp; la désignation d'une cible au clic, le contact suivi d'une confirmation; la proie éliminée, la proie qui perd ses points; le traqueur redevenu proie ou paralysé; les points au temps en mouvement, le bonus de survie; les charges du Tactique en plus des vies, le tir dans le vide payant; la fin de partie quand les traqueurs partent.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **Nom « Chasse », identifiant `chasse`.**
2. **Le rôle d'un joueur vit dans l'état, dans un champ facultatif propre au mode** (`EtatPartie.chasse`), comme l'état tactique. Il porte, pour chaque traqueur, le moment où il l'est devenu, ses vies, son orientation et l'attente avant son prochain tir. Il porte aussi, pour chaque joueur, la distance parcourue en tant que proie et sa dernière position. S'y ajoute un indicateur « traqueurs épuisés ». Un traqueur à zéro vie est éliminé. Une seule fonction fait d'un joueur un traqueur, et pose sa couleur avec son rôle. Une partie Classique n'a pas ce champ.
3. **`COULEUR_DES_TRAQUEURS` est réservée**: aucun joueur, aucun faux ninja, aucune zone de chaos ne la reçoit hors du rôle.
4. **Le tir d'un traqueur** se joue dans ce que le mode fait des entrées, après les déplacements. Les tireurs du battement passent dans un ordre tiré au sort, comme en Tactique. Pour tirer, il faut être un traqueur non éliminé, prêt (trois secondes) et sans tir depuis une seconde. Parmi les proies et les faux ninjas dans le cône, la plus proche est prise; à distance égale, l'ordre de l'état (joueurs d'abord) départage. Une proie protégée ou invincible ne produit rien et ne coûte aucune vie, mais le tir compte pour l'attente. Le cône et la portée sont ceux du Tactique (90 degrés, 100 pixels). L'orientation d'un traqueur est celle de son dernier déplacement.
5. **L'infection a lieu sur place**, la proie reçoit trois vies et le délai de trois secondes. L'événement de capture existant la décrit, avec zéro ninja transféré.
6. **Une vie perdue est un événement du moteur**, qui dit au traqueur combien il lui en reste, et s'il est éliminé.
7. **Un traqueur éliminé est hors jeu**: il ne bouge plus, ne ramasse rien, ne subit aucun malus, ne tire plus et n'est pas une cible. Il reste membre de la partie et figure au classement. Le serveur le retire des entités du flux: il regarde la suite sans être vu.
8. **« Tous les traqueurs sont partis » ou « tous éliminés »**: s'il ne reste aucun traqueur en jeu à la suite d'une élimination, les traqueurs sont épuisés et la partie s'arrête. Si c'est à la suite d'un départ, une proie tirée au sort devient traqueur, à condition qu'il reste deux proies; seule, une proie joue jusqu'au terme.
9. **La distance d'une proie** s'ajoute à chaque battement, d'après sa position de fin de déplacement comparée à la précédente. Elle cesse de croître quand la proie devient traqueur, et la proie garde ce qu'elle a gagné.
10. **Le score d'un joueur en Chasse**: un point par tranche de cent pixels parcourus en tant que proie, arrondi en dessous, plus cinquante points par capture, plus vingt-cinq points par vie d'un traqueur en jeu. Le score se lit ainsi pendant toute la partie: le HUD ne contredit jamais le classement final.
11. **Les joueurs sont classés comme en Classique**: aux points, puis aux captures. Le bilan, les récompenses et le placement sont ceux du Classique. Une chasse terminée avant le terme vaut une partie entière pour l'XP: le temps joué court jusqu'à la durée réglée.
12. **Le flux d'état ne change pas de forme.** L'état de l'arme d'un traqueur passe par l'état tactique d'un joueur (orientation, charges): en Chasse, ses charges sont ses vies. Le client lit le mode pour savoir ce qu'il affiche. Le rôle se lit à la couleur.
13. **Les contacts ne produisent rien en Chasse**: toucher ne capture pas, et un joueur ne repeint aucun ninja.
14. **Refus d'entrée**: « Cette chasse a déjà commencé. »

## État après les lots A et B de la première version

Construit et conservé: le mode dans le contrat, sa capacité, la couleur réservée, les réglages imposés par le mode (pas de Black Ninjas), la migration, le jeu de règles élargi (`lancer`, `estDecidee`), le tirage des premiers traqueurs, le remplacement d'un traqueur parti, le malus sur l'autre camp, la fin quand il ne reste plus de proie, `GameRoom` (capacité, entrée refusée, deux joueurs pour lancer, tirage au lancement), la place par camp partagée (`camps.ts`), toujours utile aux Équipes.

À reprendre: l'infection au contact (remplacée par le tir), le score de survie (remplacé par les points), le classement « proies d'abord » et le bilan par camp (remplacés par le classement du Classique), `placeDansLaChasse`, devenue sans objet.

## Périmètre

### Lot A (fait, `d70c719`) et lot B (fait, `a23af12`): première version

Voir « État après les lots A et B ».

### Lot A2. Le moteur révisé

1. **L'état de la Chasse** (micro-décision 2), et devenir traqueur avec trois vies.
2. **Le tir** (micro-décisions 4 à 6): cible la plus proche dans le cône, infection, vie perdue, élimination, attente d'une seconde, tir dans le vide gratuit; `dansLeCone` et l'ordre des tirs du Tactique réutilisés.
3. **Le hors-jeu d'un traqueur éliminé** (micro-décision 7): un ajout au jeu de règles d'un mode, lu par le déplacement, le ramassage et le malus; rien pour les autres modes.
4. **Les contacts sans effet** (micro-décision 13).
5. **La distance des proies et le score** (micro-décisions 9 et 10), le classement du Classique (micro-décision 11).
6. **La fin et le remplacement** (micro-décision 8).
7. **Empreinte** du Classique identique à celle relevée avant le lot A.

### Lot B2. Le serveur révisé

1. **Le bilan** redevient celui du Classique, temps joué jusqu'à la durée réglée compris; `placeDansLaChasse` et `campVainqueur` disparaissent s'ils ne servent plus.
2. **Le tir en Chasse** passe par la demande de capture existante.
3. **Le flux**: l'état tactique d'un traqueur (orientation, vies), le traqueur éliminé retiré des entités.
4. **Les notifications**: une vie perdue et une élimination, adressées au traqueur.
5. **Tests à travers le vrai serveur**: une chasse jouée jusqu'à une infection par un tir, une vie perdue sur un faux ninja, et la fin quand les traqueurs sont épuisés.

### Lot C. La page

1. **Création**: la tuile Chasse et sa phrase; les Black Ninjas non proposés.
2. **Salon**: « Lancer » suspendu à un joueur, avec la raison; pas de Black Ninjas au récapitulatif.
3. **Jeu**: le bouton et la touche de capture pour un traqueur en jeu, son cône, ses vies; le rôle et les proies restantes; la minimap limitée à son camp; les points au classement.
4. **Fin de partie**: le classement et le podium du Classique, et l'issue au titre.
5. **Annonces**: l'infection, la vie perdue et l'élimination. **Aide**: une ligne sur le mode.

### Lot D. Bout en bout, mesure et documentation

1. **Scénario** (`tests/e2e/chasse.spec.ts`): « Lancer » suspendu seul; un second joueur arrive, la partie se lance, chacun voit son rôle; le traqueur a un bouton de capture et ses vies. Sur un ordinateur et sur un téléphone.
2. **Charge**: `pnpm charge --banc --mode chasse`, comparé au Classique; chiffres dans `docs/mesures/charge-serveur.md`.
3. **Empreinte** du Classique identique.
4. **Documentation**: cadrage, journal de conception, ROADMAP, et CLAUDE.md (comportements à préserver 1, 2 et 4 en Chasse).

## Hors périmètre

- Des traqueurs plus rapides, un radar, un temps de survie récompensé.
- Les autres modes (Battle Royale, Chaos), la Chasse en équipes.
- Le mode spectateur au-delà de la micro-décision 7, l'entrée en cours de partie.
- Toute modification du comportement du Classique, du Tactique ou des Équipes, de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Rôles (TU)**: devenir traqueur pose la couleur, le moment et trois vies; le délai de trois secondes.
- **Lancement et remplacement (TU)**: nombre de traqueurs tirés; remplacement après un départ, à deux proies au moins; aucun remplacement après une élimination.
- **Tir (TU)**: la plus proche dans le cône est prise; infection d'une proie; vie perdue sur un faux ninja; élimination à la troisième; rien sur une proie protégée; tir dans le vide gratuit; une seconde d'attente; un traqueur non prêt ou éliminé ne tire pas; les traqueurs ne sont pas des cibles; ordre des tirs reproductible.
- **Hors-jeu (TU)**: un traqueur éliminé ne bouge plus, ne ramasse rien, ne subit pas de malus; rien de tel dans les autres modes.
- **Score et fin (TU)**: distance d'une proie, figée quand elle devient traqueur; points de capture et de vies; classement; fin sans proie, fin par traqueurs épuisés, temps.
- **Moteur (TU)**: déterminisme; les trois autres modes inchangés.
- **Serveur (TI)**: entrée refusée, lancement à deux, tir à travers le réseau, vie perdue annoncée, fin par épuisement, bilan.
- **Base (TI)**: une partie Chasse enregistrée.
- **Client (TU)**: création, salon, HUD (rôle, vies, bouton), fin, annonces.
- **Bout en bout**: le scénario du lot D.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie Chasse se crée, se prépare au salon, se joue et s'enregistre depuis la page, au bureau et sur téléphone.
2. **Le Classique, le Tactique et les Équipes n'ont pas changé**: tests existants inchangés, empreinte du jeu des quatre parties de référence identique.
3. La couverture de `packages/sim` ne baisse pas (99,79 pour cent au handoff 7.2).
4. Le cadrage, le journal de conception et CLAUDE.md décrivent ce qui a été construit.

## Points de vigilance

1. **Les tirages ne se font qu'en Chasse**: ordre des tirs, tirage des traqueurs, remplacement. L'empreinte est le garde-fou.
2. **Le hors-jeu touche le déplacement et le ramassage de tous les modes**: pour les autres modes, la question doit rendre « personne », sans aucun coût ni tirage.
3. **Épuisement et départ** mènent à deux issues différentes: le test doit couvrir les deux ordres (un éliminé puis un départ, un départ puis une élimination).
4. **Les charges d'un traqueur sont ses vies**: aucun écran ne doit les présenter comme des charges du Tactique.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-3-handoff.md`: les décisions construites, la révision des règles en cours d'étape, les écarts à cette fiche, les chiffres du banc, l'état de la CI. Prochaine action exacte: demander au porteur du projet la fonctionnalité reportée suivante (Battle Royale, Chaos, pass de saison, skins, clans), trancher ses règles, puis rédiger sa fiche. Commiter.
