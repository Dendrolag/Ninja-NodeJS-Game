# Fiche étape 7.12 - Les mines de zone

Brief de session. Objectif unique: les zones spéciales n'apparaissent plus d'elles-mêmes. À leur place, la carte pose des mines visibles de tous, dont la couleur annonce la zone qu'elles cachent. Un joueur ou un Black Ninja qui passe dessus l'arme, et trois secondes plus tard la zone s'ouvre à cet endroit. Une zone s'ouvre donc là où un joueur l'a décidé.

## Origine de cette fiche

Aucune fiche n'existait. La proposition des mines du porteur du projet, le 28 septembre 2026, disait qu'elles « pourraient déclencher les zones d'effets ». L'étude en a fait une famille à part, la mine que pose la carte, et le porteur du projet a tranché le même jour qu'elle **remplace** les zones qui apparaissaient seules, avec les paramètres avancés de partie modifiés en conséquence. Voir aussi les fiches 7.10 (la fumée) et 7.11 (la mine posée), décidées ensemble.

Rédigée le 28 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- les décisions tranchées avec le porteur du projet, ci-dessous;
- la fiche 7.9 prise comme modèle;
- l'état du dépôt au commit `2a7084a`, et le handoff 3.9.

**Numéro**: 7.12, dans la phase 7, « Modes de jeu ». Elle ne dépend pas de la poche de l'étape 7.10, mais reprend le rendu de la mine armée de l'étape 7.11, qu'elle suit.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (celui de l'étape 7.11), cette fiche, la fiche 7.11, `packages/sim/src/zones.ts`, et `.claude/rules/sim-purity.md`.

## Ce qu'est le jeu aujourd'hui

- **Les zones apparaissent seules** (`avancerLesZones`, `packages/sim/src/zones.ts`, portage de `manageSpecialZones` du jeu d'origine): une tentative toutes les 15 secondes par défaut, trois zones au plus en même temps (`ZONES.SIMULTANEES_MAXIMUM`), chacune d'une nature tirée parmi les natures cochées, d'un rayon tiré entre 150 pixels et le cinquième de la carte, et d'une durée tirée entre 10 et 30 secondes.
- **Quatre natures**: le chaos repeint au hasard les ninjas qui la traversent; la répulsion fait repousser les ninjas par les joueurs présents; l'attraction attire les ninjas vers le joueur le plus proche; l'invisibilité cache les joueurs, un effet que seule la page calcule. En Massacre, le chaos est retiré (`imposerLesReglagesDuMode`).
- **Les zones n'agissent pas sur les Black Ninjas**, comme dans le jeu d'origine.
- **Les paramètres avancés du salon** ont cinq réglages de zones (`ReglagesZones`, `packages/shared/src/reglages.ts`): actives, durée minimale, durée maximale, délai entre deux apparitions, natures cochées. Le plafond de trois n'est pas réglable.
- **Ce comportement vient du jeu d'origine**, mais ne figure pas parmi les comportements à préserver de CLAUDE.md. Les tests de caractérisation qui l'observent restent l'étalon du jeu d'origine.

## Décisions du porteur du projet, 28 septembre 2026

1. **Les mines de zone remplacent les zones qui apparaissaient seules.** Une zone ne s'ouvre plus que par une mine. Les paramètres avancés de partie changent en conséquence.
2. **Elles sont déclenchées par n'importe quel joueur**, de tout camp, pas par les faux ninjas.
3. **Et par les Black Ninjas.** Un Black Ninja ne tombe que sur une mine que sa proie a contournée: c'est une ruse, contourner une mine pour qu'il l'arme derrière soi. Même règle que pour la mine posée, « tout ce qui chasse déclenche, les faux ninjas jamais ». À l'essai.
4. **3 secondes de délai** entre l'armement et l'ouverture de la zone. À l'essai.
5. **Visibles de tous**, leur couleur annonçant la zone qu'elles cachent. C'est ce qui les rend stratégiques: une répulsion pour se protéger, une invisibilité pour disparaître, une attraction sous les pas d'un poursuivant.
6. **Un plafond de mines sur la carte, et un réglage du salon** pour les activer ou les couper.

Écartés: des mines de zone qui s'ajoutent aux zones spontanées; des mines de zone cachées ou d'une couleur neutre; les faux ninjas comme déclencheurs.

## Demande du porteur du projet, consignée le 2 octobre 2026

Pendant l'étape 7.11, le porteur du projet a demandé de revoir l'affichage des zones, « jusqu'ici des tests avec un rendu très brut », pour un rendu adapté et peaufiné, et de leur donner **une taille prédéfinie**. Cela révise la micro-décision 5 ci-dessous: le rayon ne se tire plus, il est fixe. La planche `docs/design/etape-7-12/1-zones.png` propose:

- **trois rendus**, communs aux quatre natures: A, un anneau néon au bord lumineux, fond léger et pictogramme au centre, avec la durée restante en arc pointillé qui se vide; B, un motif vivant qui montre l'effet (éclairs du chaos, ondes et chevrons qui repoussent ou attirent, voile de l'invisibilité); C, un dôme de particules qui suivent l'effet. Dans les trois, la zone pâlit et son bord clignote les trois dernières secondes, et un pictogramme remplace le libellé écrit;
- **trois tailles**: 180, 220 (proposée) ou 260 pixels de rayon, contre un tirage entre 150 et le cinquième de la carte aujourd'hui.

**Choix en attente du porteur du projet**: le rendu et la taille. Ils se construisent dans cette étape, pas dans la 7.11 (règle 6). La durée, elle, reste tirée comme aujourd'hui, faute de décision contraire.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **Les réglages gardent leur structure et prennent un sens nouveau**, pour que l'hôte retrouve ses repères:

   | Réglage                          | Avant                    | Après                                                           |
   | -------------------------------- | ------------------------ | --------------------------------------------------------------- |
   | `actives`                        | Zones actives            | Mines de zone actives                                           |
   | `intervalleApparitionS`          | Délai entre deux zones   | Délai entre deux poses de mine                                  |
   | `dureeMinimumS`, `dureeMaximumS` | Durée de vie d'une zone  | Durée de la zone qui s'ouvre                                    |
   | `types`                          | Natures qui apparaissent | Natures qu'une mine peut cacher                                 |
   | `minesMaximum`, nouveau          | Plafond fixe de 3 zones  | Plafond de mines non déclenchées, 3 par défaut, borné de 1 à 10 |

   Les noms des champs ne changent pas: des réglages partiels déjà écrits (tests, parties de référence, salons en mémoire) restent valides. Les libellés du salon, eux, changent.

2. **La pose remplace l'apparition**: au rythme du délai réglé, avec la même variation au hasard qu'aujourd'hui, une mine est posée si la carte en compte moins que le plafond. La nature cachée se tire à la pose, parmi les natures cochées, et se voit tout de suite.
3. **Une mine se pose loin des joueurs et des Black Ninjas**, par `positionDApparition`, pour que personne ne l'arme en naissant, et loin des autres mines.
4. **Elle reste jusqu'à ce qu'on l'arme**, comme la mine posée.
5. **À l'ouverture**, la zone se centre sur la mine, avec un rayon et une durée tirés comme aujourd'hui. _Révisée le 2 octobre 2026: le rayon devient fixe, voir la demande ci-dessus._ Elle agit exactement comme une zone d'aujourd'hui: seules sa naissance et son annonce changent.
6. **Les zones ouvertes n'ont pas de plafond propre**: chacune vient d'une mine, et le plafond de mines borne leur nombre en pratique. Le compter en jouant; un plafond se remettrait si l'écran se chargeait trop.
7. **Ni la fumée ni l'explosion d'une mine posée** n'arment une mine de zone: seul un contact le fait.
8. **Le flux d'état porte les mines de zone** comme un nouveau type d'entité, en fin de liste (`TYPES_ENTITE`), avec leur nature et, armées, leur temps restant. Une partie sans zones doit s'écrire à l'octet comme avant.
9. **Faits**: la pose, l'armement, l'ouverture, pour les sons et le rendu. Aucun grand titre.
10. **Le rendu se choisit sur planche** au début de l'étape (`docs/design/etape-7-12/`): la mine de zone à la couleur de chacune des quatre natures, armée, et la zone qui s'ouvre. Il se distingue de la mine posée (étape 7.11), dont il reprend le compte à rebours. La zone elle-même a déjà sa planche (`1-zones.png`, ci-dessus); celle de la mine de zone reste à faire.
11. **Le changement se consigne comme voulu**, au journal et au handoff. Les tests de caractérisation ne changent pas. Les tests du moteur qui figeaient l'apparition spontanée sont réécrits pour la pose des mines; ceux des effets des zones ne changent pas.

## Périmètre

### Lot A. Le contrat

1. **Les valeurs**: le délai de 3 secondes, le plafond par défaut et ses bornes (`MINES_DE_ZONE` dans `packages/shared`).
2. **Les réglages**: le champ `minesMaximum`, sa validation, le sens nouveau des autres (micro-décision 1).
3. **Les vues et les événements**: l'entité dans le flux et son codage, les trois faits (micro-décisions 8 et 9).

### Lot B. Le moteur

1. **La pose** à la place de l'apparition spontanée (micro-décisions 2 et 3).
2. **L'armement** par un joueur ou un Black Ninja, et l'ouverture de la zone après 3 secondes (décisions 2 à 4, micro-décisions 5 à 7).
3. **Le retrait de l'apparition spontanée** et du plafond fixe de trois zones.

### Lot C. Le serveur

1. **Tests à travers le vrai serveur**: une mine de zone posée, armée par un joueur, qui ouvre sa zone; une partie aux zones désactivées sans aucune mine.

### Lot D. La page

1. **La planche**, puis le rendu retenu (micro-décision 10).
2. **Les paramètres avancés**: les nouveaux libellés, le réglage du plafond, dans le formulaire de création et le récapitulatif du salon.
3. **L'aide**: les mines de zone, et ce que cache chaque couleur.

### Lot E. Mesure et documentation

1. **Empreinte**: les parties de référence, zones désactivées, identiques à l'octet à celles du handoff 7.11. Puis leurs nouvelles empreintes, zones actives, consignées au handoff: toutes changent, puisque les zones sont actives par défaut.
2. **Banc de charge**: aucun écart attendu, consigné dans `docs/mesures/charge-serveur.md` si la mesure en montre un.
3. **Documentation**: le journal de conception, le ROADMAP, et l'en-tête de `zones.ts`, qui décrit le portage de `manageSpecialZones`.

## Hors périmètre

- La mine posée (étape 7.11) et la poche (étape 7.10).
- Une nature de zone nouvelle.
- Un effet des zones sur les Black Ninjas.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: les valeurs; le réglage `minesMaximum` et ses bornes; le codage de la mine de zone et l'aller-retour; une partie sans zones qui s'écrit à l'octet comme avant.
- **Moteur (TU)**: la pose au rythme réglé, sous le plafond, loin des joueurs, des Black Ninjas et des autres mines, déterministe; la nature tirée parmi les natures cochées, le chaos absent en Massacre; l'armement par un joueur de chaque camp et par un Black Ninja, pas par un faux ninja ni par l'Évadé; l'ouverture après 3 secondes, centrée sur la mine, au rayon et à la durée tirés; aucune zone spontanée; aucune mine quand les zones sont désactivées; ni la fumée ni l'explosion d'une mine posée n'arment une mine de zone.
- **Serveur (TI)**: le lot C.
- **Client (TU)**: le rendu par nature; la mine armée; les paramètres avancés au formulaire.
- **Bout en bout**: une partie où le joueur arme une mine de zone et voit la zone s'ouvrir; les scénarios existants.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Aucune zone n'apparaît seule. Les mines de zone se posent, s'arment et ouvrent leur zone dans les cinq modes, depuis la page.
2. Le rendu correspond à la planche retenue, vérifié dans le navigateur de Claude Code, avec une capture d'écran.
3. L'empreinte des parties de référence, zones désactivées, est identique à celle du handoff 7.11.
4. La couverture de `packages/sim` ne baisse pas.

## Points de vigilance

1. **Le chaos devient une arme**: une mine de chaos armée au milieu du troupeau d'un adversaire le repeint. C'est l'intention, mais le mesurer en jouant.
2. **Les Black Ninjas déclencheurs sont à l'essai** (décision 3): les retirer ne coûte qu'une condition si la ruse ne prend pas.
3. **Le délai de 3 secondes est à l'essai** (décision 4): une valeur de `packages/shared`, pas un réglage du salon.
4. **Le Quartier et ses cours à une porte**: une mine posée dans une cour fermée pourrait n'être jamais armée. Vérifier sur les trois cartes que les mines ne restent pas hors d'atteinte, et sinon exclure les recoins de la pose.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-12-handoff.md`: les décisions construites, les écarts à cette fiche, les deux jeux d'empreintes, l'état de la CI. Prochaine action exacte: l'étape suivante de la section 3 du ROADMAP, ou demander au porteur du projet la suite. Commiter, pousser, vérifier la CI et la mise en ligne.
