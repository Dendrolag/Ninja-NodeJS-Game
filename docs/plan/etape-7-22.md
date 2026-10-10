# Fiche étape 7.22 - Among Ninjas, les sabotages et la malédiction des fantômes

Brief de session. Objectif unique: donner aux assassins leurs sabotages, et aux proies mortes leur riposte. Les assassins sabotent depuis la carte plein écran: trois nuisances prises dans les malus du jeu, un nuage où seuls les assassins voient, la panne de néons, la surchauffe. Les proies fantômes réparent la panne et maudissent les assassins. Les pas entendus, les tâches longues et l'appropriation restent aux étapes suivantes.

## Origine de cette fiche

Rédigée le 10 octobre 2026, au début de l'étape, selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2): aucune fiche n'avait été fournie. Sources: la section 18 de l'étude `docs/design/etude-mode-among-ninjas.md` (le contenu de l'étape), ses sections 4.3 (le gong), 10 (les lieux du jeu), 11 (les sabotages), 12 (les fantômes), 13 (la carte et les commandes) et 20 (les réponses du porteur du projet, et la révision qui fait de la malédiction le miroir des sabotages), la fiche 7.21 prise comme modèle, le handoff `docs/handoffs/etape-7-21-handoff.md`, et l'état du dépôt au commit `900ff3a`.

**Aucune référence de comportement.** Ni la v0.8.6 ni la v0.9.0 n'ont ce mode: rien à caractériser. Les règles ci-dessous font foi, avec celles des fiches 7.20 et 7.21.

**Numéro**: 7.22, dans la phase 7, « Modes de jeu ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (7.21, ou le handoff partiel de cette étape), cette fiche, `.claude/rules/sim-purity.md`, les sections 11, 12, 13 et 20 de l'étude, et les fiches 7.20 et 7.21.

**Les règles et les valeurs ci-dessous ont été soumises au porteur du projet le 10 octobre 2026**, avant toute construction (section « Réponses du porteur du projet »). Les rendus se choisissent ensuite sur planche, comme aux étapes 7.20 et 7.21.

## Décisions du porteur du projet

Du 5 et du 6 octobre 2026 (demande, section 20 de l'étude et sa révision), et du 10 octobre 2026 (handoff 7.21):

1. **Des sabotages pris dans les malus du jeu**: zone d'invisibilité réservée aux tueurs, commandes inversées, négatif, flou (demande, point 12).
2. **Les « tâches spécifiques de sabotage » sont des actions de sabotage**, pas de vraies tâches de tueur qui donneraient une seconde voie de victoire (une course aux tâches de chaque côté). Où elles se déclenchent, depuis la carte ou à des postes, se tranche au début de cette étape.
3. **La gêne des fantômes, l'aide qui ne vise personne**: un fantôme peut réparer la panne de néons, pas la surchauffe, qui perdrait sinon son danger en fin de partie.
4. **La malédiction des fantômes** (révision du 6 octobre): une proie fantôme déclenche un malus sur tous les assassins vivants, sans en viser un. Elle se construit avec les sabotages, dont elle est le miroir. Ses règles se tranchent au début de cette étape.
5. **Le mode ne se déploie qu'avec ses étapes suivantes**, sur accord du porteur du projet: `master` ne se pousse pas à la fin de cette étape. Avant toute poussée, la suite de bout en bout complète se rejoue.
6. **Les sons** sont prévus dans cette fiche, pour que le porteur du projet les fournisse (section « Les sons »).

## Questions soumises au porteur du projet

1. **Où sabote-t-on ?** Recommandé: **depuis la carte plein écran**, n'importe où, comme dans Among Us. C'est la seule façon qui tienne dans deux boutons sur téléphone, et l'assassin se fait un alibi en sabotant loin de lui. L'autre voie, des postes de sabotage où l'assassin passe deux secondes, lui fait prendre un risque, mais demande des postes de plus sur Tokyo et un détour à chaque sabotage.
2. **Les commandes inversées.** Pour les proies seulement, elles désignent les assassins: pendant dix secondes, tout le monde titube sauf eux. Recommandé: **elles frappent tous les vivants, assassins compris**; le saboteur n'a que l'avantage de savoir quand. Sinon, les retirer de la liste.
3. **La surchauffe non réparée.** L'étude (section 4.2) la fait gagner aux assassins, comme le réacteur d'Among Us. Mais le ROADMAP résume la décision du 6 octobre par « sans seconde voie de victoire pour les tueurs ». La décision visait les tâches de tueur; la fiche lit donc la surchauffe comme permise. Recommandé: **les assassins gagnent**, sans quoi elle n'a plus de danger. L'autre voie: chaque proie vivante perd la dernière tâche qu'elle a faite.
4. **La version.** Comme à 7.21, la 1.9.0 n'est pas en ligne: **tout sous la 1.9.0**, dont la note dira les sabotages, ou une 1.10.0 à part.

## Réponses du porteur du projet, 10 octobre 2026

1. **Depuis la carte plein écran**, comme recommandé.
2. **Les commandes inversées frappent les proies seulement**, comme les deux autres nuisances, contre la recommandation de la fiche. Le risque est connu: pendant dix secondes, un ninja qui marche droit peut être un assassin, à moins qu'il ne fasse semblant de tituber. Il se juge à la partie d'essai; s'il décide trop de parties, les deux autres voies restent (tous les vivants, ou retirer ce sabotage).
3. **La surchauffe non réparée fait gagner les assassins**, comme recommandé.
4. **Tout sous la 1.9.0**, dont la note dira aussi les sabotages.

## Retours d'essai du porteur du projet, 10 octobre 2026

Arrivés pendant la rédaction de cette fiche, après une partie en local des étapes 7.20 et 7.21.

1. **Ne pas proposer deux tâches identiques à un joueur dans une partie.** Défaut de 7.21 (la fiche l'admettait: « deux tâches de même nature peuvent tomber dans une même liste »), corrigé au titre de la règle 7, voir « Corrigé en début d'étape ».
2. **Les lettres de déplacement (Z, Q, S, D, A, W) ne s'écrivaient pas dans le chat.** Défaut, corrigé.
3. **En réunion, M ouvrait la carte une demi-seconde, et F montrait le repère.** Défauts, corrigés.
4. **Les fantômes infligent aux assassins des malus comme les assassins aux proies.** La malédiction change en conséquence (section « La malédiction des fantômes »).
5. **L'exécution d'un joueur désigné par le vote le coupe en deux.** Un rendu nouveau, à choisir sur la planche (rangée 7). Il frappe tout exécuté, assassin ou non: une exécution ne dit jamais le rôle (décision du 6 octobre 2026, section 21 de l'étude), et une animation réservée aux assassins le dirait.

## Corrigé en début d'étape

Au titre de la règle 7, avant la construction des sabotages:

1. **Des tâches toutes différentes dans une liste.** Le moteur tire les stations actives en gardant de quoi faire chaque nature à une station différente, puis chaque proie prend ses stations, des moins prises aux plus prises, chacune avec une nature que la liste n'a pas encore (un appariement, `apparier` dans `packages/sim/src/among.ts`). **L'hôte règle désormais 7 tâches par proie au plus, au lieu de 8**: il n'y a que sept gestes, et une liste de huit en répéterait un. La limite remontera avec les tâches de l'étape 7.26. Effet de bord mesuré: les listes se répartissent un peu moins également sur les stations, de 4 à 7 tâches par station au lieu de 5 ou 6 pour dix proies à cinq tâches, parce que trois stations ne proposent que « relier des couleurs », qu'une proie ne fait plus qu'une fois.
2. **Le chat reçoit toutes ses lettres**: une touche frappée dans un champ de saisie ne commande plus rien (`controles/clavier.ts`).
3. **La carte ne s'ouvre qu'en phase de jeu** (`carteAmong.ts`), **et le repère ne répond plus hors du jeu** (`rendu/boucle.ts`).

## Les règles et les valeurs

Les propositions de l'étude, précisées par cette fiche. Toutes se révisent après une partie d'essai.

### Ce que les sabotages ont en commun

- **Qui sabote**: un assassin, vivant ou fantôme (étude, section 12). Jamais une proie.
- **D'où**: la carte plein écran (réponse 1). Elle porte, pour un assassin, un panneau des sabotages: chacun avec son nom, prêt ou grisé, et le temps qu'il reste avant le prochain.
- **Un seul sabotage à la fois**, pour toute la partie.
- **Une recharge commune de 30 secondes** à tous les assassins, qui part de la fin du sabotage précédent. Elle repart à **15 secondes au début de chaque tour**, comme le gong.
- **Aucun sabotage en réunion**, ni pendant la révélation ou l'exécution. **Une réunion qui s'ouvre finit le sabotage en cours**, quel qu'il soit, comme le signalement d'un cadavre pendant le réacteur d'Among Us.
- **Le gong ne sonne pas pendant la surchauffe** (étude, section 4.3). Il sonne pendant les autres. Signaler un cadavre reste toujours possible.
- **Le terme du tour attend la fin de la surchauffe**: une réunion d'office l'annulerait, et les assassins y perdraient le seul sabotage qui peut les faire gagner.
- **Le saboteur ne se nomme jamais**: rien de ce que reçoit un vivant ne dit quel assassin a saboté, ni s'il était vivant ou fantôme.

### Les trois nuisances

| Sabotage            | Effet                                                    | Durée |
| ------------------- | -------------------------------------------------------- | ----: |
| Vision floue        | Le flou du malus, sur l'écran de chaque proie vivante    |  10 s |
| Vision négative     | Le négatif du malus, sur l'écran de chaque proie vivante |  10 s |
| Commandes inversées | Le malus du moteur, sur chaque proie vivante (réponse 2) |  10 s |

- Elles passent par les malus du jeu, tels qu'ils sont dans le moteur et la page: le frappé le voit et reçoit l'annonce du malus, adressée à lui seul (`malusSubi`). Le flux ne porte les malus de personne.
- **Les gestes d'une tâche ne s'inversent pas**: seul le déplacement s'inverse. Une tâche reste une tâche (l'étude posait la question).
- Les fantômes n'en subissent aucune.

### Le nuage noir, la zone d'invisibilité

La demande parle d'une zone d'invisibilité réservée aux tueurs. Prise à la lettre, un assassin qui y entre disparaît aux yeux des proies, et se désigne: une proie qui voit un ninja s'effacer sait qu'elle a vu un assassin. La fiche propose donc un nuage **qui cache tout le monde, et où seuls les assassins voient**:

- **Où**: sur l'une des stations actives, choisie par l'assassin sur sa carte. Un disque de **150 pixels** de rayon autour de la station.
- **Combien de temps**: **20 secondes**.
- **Ce qu'il cache**: à une proie vivante, tout ce qui se tient dans le nuage, ninjas, PNJ et cadavres, hors d'elle-même. Dedans comme dehors, elle n'y voit rien. Le filtre se fait au serveur, dans la vue de chaque proie vivante: caché dans la page seulement, tout se lirait dans le flux.
- **Ce qu'il montre**: le nuage lui-même, à qui voit l'endroit. Les assassins y voient tout, comme les fantômes.
- Une proie peut y faire sa tâche: c'est le piège.

### La panne de néons

- **Effet**: le rayon de vision des proies vivantes tombe à **110 pixels**, quel que soit leur palier. Celui des assassins ne change pas. Les fantômes voient toujours tout.
- **Jusqu'à quand**: jusqu'à ce qu'on la répare, sans limite de durée.
- **Réparer**: tenir le bouton d'action **3 secondes** dans le disque du **boîtier de la rue** (étude, section 10: 1330, 495; 50 pixels de rayon, comme une station). Sortir du disque, ou lâcher, remet la réparation à zéro. Une proie vivante ou fantôme peut réparer (décision 3), un assassin vivant aussi: il bluffe, et comme sa réparation compte, personne ne le démasque à côté d'un boîtier qui ne revient pas.
- **Tout le monde le sait**: une annonce à tous, le boîtier marqué sur la mini-carte et la carte plein écran le temps de la panne.

### La surchauffe

- **Effet**: les deux **consoles**, aux lampadaires nord-ouest et sud-est (étude, section 10: 485, 320 et 1860, 890), s'emballent. Il faut les tenir **en même temps**, une proie à chacune.
- **Le délai**: **45 secondes**. Les consoles sont à 1 490 pixels l'une de l'autre, dix secondes de course.
- **Réparer**: le bouton d'action tenu dans le disque de chaque console (50 pixels de rayon); dès que les deux sont tenues ensemble **une seconde**, la surchauffe est réparée. Un vivant peut tenir une console, assassin compris, pour la même raison que la panne. **Un fantôme ne peut pas** (décision 3).
- **Non réparée**: les assassins gagnent (réponse 3).
- **Tout le monde le sait**: une alarme à tous, le compte à rebours, les deux consoles marquées sur la mini-carte et la carte plein écran, et pour chacune, si quelqu'un la tient.

### La malédiction des fantômes

Le miroir des sabotages: les assassins gênent les proies vivantes, les proies mortes gênent les assassins (révision du 6 octobre, section 20 de l'étude).

- **Qui**: une proie fantôme. Jamais un assassin fantôme, qui sabote déjà.
- **Qui elle frappe**: **tous les assassins vivants à la fois**. Le fantôme sait qui l'a tué, mais il n'a pas de victime à choisir: son geste ne dit rien de ce qu'il sait.
- **Quoi**: **l'un des trois malus des nuisances, au choix du fantôme**, comme l'assassin choisit la sienne (retour d'essai 4): vision floue, vision négative ou commandes inversées, **8 secondes**. Le risque des commandes inversées est le même qu'à la réponse 2, dans l'autre sens: un ninja qui titube sans raison peut être un assassin maudit. Il se juge à la partie d'essai.
- **Une recharge commune à tous les fantômes, 45 secondes**, et non une par fantôme: sinon la malédiction grandirait avec le nombre de morts. Ni dans les 15 premières secondes d'un tour, ni en réunion.
- **L'assassin maudit le sait**: il voit le filtre, et une annonce lui dit qu'un fantôme l'a maudit. Les vivants ne reçoivent aucune annonce. Les fantômes voient la recharge commune repartir.
- **Le geste**: depuis la carte plein écran, comme les sabotages. Une proie fantôme y trouve le panneau des malédictions: les trois malus, prêts ou grisés, et la recharge commune. Sur téléphone, la carte s'ouvre en touchant la mini-carte: toujours deux boutons.
- Une proie fantôme garde l'aide qui ne vise personne: elle répare aussi la panne de néons.

### Ce que voit l'assassin sur la carte plein écran

Le panneau des sabotages à côté de la liste: les six sabotages, avec leur nom, prêts ou grisés, la recharge commune, et le sabotage en cours. Pour le nuage, toucher une station de la carte (ou la choisir au clavier) après avoir choisi le sabotage. La carte reste ce qu'elle est pour une proie: pas de panneau.

## Les sons

Chaque son a un provisoire, pris dans ceux du jeu, jusqu'à ce que le porteur du projet fournisse le sien (mp3, court, sans silence en tête; « en boucle » veut dire qu'il doit pouvoir se répéter sans à-coup). Un son ne doit jamais désigner le saboteur: aucun ne se joue chez lui seul au moment où il sabote, sauf dans sa page, que personne n'entend.

| Son à fournir                   | Qui l'entend                        | Provisoire proposé       |
| ------------------------------- | ----------------------------------- | ------------------------ |
| Sabotage lancé (confirmation)   | L'assassin qui sabote               | `button-click.wav`       |
| Les néons qui s'éteignent       | Tous                                | `final-tick.wav`         |
| Les néons qui reviennent        | Tous                                | `collect-bonus.wav`      |
| Réparation en cours, en boucle  | Qui tient le boîtier ou une console | aucun                    |
| Alarme de surchauffe, en boucle | Tous, pendant la surchauffe         | `final-tick.wav` répété  |
| Surchauffe réparée              | Tous                                | `collect-bonus.wav`      |
| Le nuage qui tombe (situé)      | Qui voit la station                 | `bonus-escape-nuage.mp3` |
| Malédiction                     | Les assassins maudits, les fantômes | `collect-malus.wav`      |

Les nuisances gardent le son du malus subi, comme dans les autres modes.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE, à réviser en exécutant si le dépôt le demande. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite.

1. **Les natures de sabotage sont une liste du contrat** (`NATURES_DE_SABOTAGE`, `packages/shared/src/among.ts`), avec leurs durées, la recharge commune et celle du début de tour, le rayon de la panne, le rayon du nuage. Les lieux du mode (`LIEUX_DES_CARTES`) gagnent le boîtier et les deux consoles, retournés avec le miroir, et vérifiés sur le vrai terrain par le test des lieux (`terrain.test.ts`). Sondés au début de l'étape: centres tenables, dans le morceau principal, disques praticables à 100, 68 et 91 pour cent.
2. **Le sabotage en cours est un état du mode** (`EtatAmong.sabotage`): sa nature, ce qu'il en reste, sa station pour le nuage, et la réparation en cours. La recharge commune des sabotages et celle de la malédiction aussi. Tout avance par le battement, sans horloge.
3. **Deux demandes nouvelles**, validées par les schémas (étape 1.6) et limitées en débit: « saboter » (la nature, et la station du nuage) et « maudire » (le malus choisi). Le moteur refuse tout ce que la règle refuse: une proie qui sabote, un sabotage pendant un autre ou dans la recharge, un assassin qui maudit.
4. **Réparer passe par le bouton d'action tenu** (`agir`), comme la tâche provisoire de 7.20: le boîtier et les consoles n'ont pas de geste dans la page. La règle d'appui de 7.20 reste: signaler, sonner, ouvrir une tâche se font à l'appui; réparer, en tenant. Dans le disque du boîtier ou d'une console, l'action tenue répare.
5. **Les nuisances et la malédiction passent par les malus du moteur** (`effets.ts`), qui expirent seuls et partent au frappé par `malusSubi`. Les malus restent retirés des réglages du mode: ce sont des malus posés par le mode, pas des objets ramassables.
6. **La panne passe par `rayonDeVision`**, que lisent déjà la vue de chaque vivant et la page: aucun autre chemin.
7. **Le nuage se filtre dans la vue d'une proie vivante** (`vues.ts`), comme le disque de vision: ce qui s'y tient en est retiré. Le nuage lui-même est une entité de la vue, à qui voit l'endroit.
8. **Ce que tout le monde sait d'un sabotage voyage dans `AmongVu`**: la panne, la surchauffe, son compte à rebours et les consoles tenues. Le nuage n'y est pas: seul qui voit l'endroit le voit. Le saboteur n'y est jamais.
9. **Ce que seuls les assassins savent** (la recharge commune, le sabotage prêt) **voyage dans leur état privé** (`EtatPriveAmong`); la recharge de la malédiction, dans celui des proies fantômes.
10. **La victoire de la surchauffe** passe par la lecture de victoire existante (`decider`): un motif de plus, montré à la fin (« La surchauffe a tout emporté »).

## Rendus à choisir sur planche

Après confirmation des règles, une planche `docs/design/etape-7-22/1-planche.png` (source `planche.html` à côté), dessinée en code sur les sprites et le décor de Tokyo, comme en 7.20 et 7.21, trois propositions par rangée:

1. **Le panneau des sabotages** sur la carte plein écran d'un assassin, au bureau et sur téléphone en portrait.
2. **La panne de néons** vue d'une proie: le disque réduit, le décor éteint, le boîtier.
3. **La surchauffe**: l'alarme, le compte à rebours, les consoles sur le décor et sur la mini-carte.
4. **Le nuage noir**, vu d'une proie et d'un assassin.
5. **La malédiction**: le panneau des malédictions sur la carte d'une proie fantôme, l'annonce chez l'assassin maudit.
6. **Le boîtier et les consoles dans le décor**, hors sabotage.
7. **L'exécution qui coupe en deux** le joueur désigné par le vote (retour d'essai 5), à la place de l'égout de 7.20.

Les captures dans le vrai jeu, au fil de la construction, à côté.

## Périmètre

### Lot A. Le contrat et le moteur

1. Les natures de sabotage et leurs valeurs, les lieux nouveaux et leur miroir, le test des lieux étendu.
2. Le sabotage: qui, quand, la recharge commune, un seul à la fois, la fin à l'ouverture d'une réunion, le gong refusé pendant la surchauffe, le terme du tour qui l'attend.
3. Les nuisances par les malus; la panne et `rayonDeVision`; le nuage; la surchauffe, ses consoles, sa victoire.
4. La réparation tenue, au boîtier et aux consoles, et qui peut réparer quoi.
5. La malédiction: qui, sa recharge commune, ses interdits, le malus choisi.
6. L'empreinte des quatre parties de référence identique avant et après.

### Lot B. Le serveur

1. Les deux demandes, leur schéma et leur débit.
2. Les vues: le nuage dans celle de chaque proie vivante, la panne par le rayon, le sabotage public dans `AmongVu`, la recharge dans l'état privé.
3. Tests à travers le vrai serveur: un assassin sabote depuis sa carte, une proie qui tente est refusée, la panne réduit ce qu'une proie reçoit puis se répare, la surchauffe réparée à deux et perdue seule, le nuage qui cache un ninja à une proie et pas à un assassin, la malédiction qui frappe tous les assassins vivants et n'annonce rien aux vivants.

### Lot C. La page

1. Le panneau des sabotages sur la carte d'un assassin, au pointeur, au doigt et au clavier.
2. La panne: le disque réduit, le boîtier marqué, la réparation et sa jauge.
3. La surchauffe: l'alarme, le compte à rebours, les consoles et leur état.
4. Le nuage, dessiné à qui le voit.
5. La malédiction: le panneau des malédictions sur la carte d'une proie fantôme, la recharge, l'annonce chez le maudit.
6. L'exécution coupée en deux, selon le rendu choisi.
7. Les sons, provisoires. L'aide et les consoles du mode: les sabotages, la malédiction.

### Lot D. Bout en bout, mesure et documentation

1. Le scénario `tests/e2e/among.spec.ts`: un assassin de la page sabote les néons depuis la carte, une proie répare au boîtier.
2. Banc: la mesure de 7.21 rejouée (section 30 de `docs/mesures/charge-serveur.md`), avec un sabotage en cours pendant la mesure.
3. Journal de conception, ROADMAP, étude (section 23), `assets/README.md` si des sons sont fournis.
4. La note de la 1.9.0 complétée des sabotages (réponse 4), à soumettre au porteur du projet; le numéro reste 1.9.0.
5. **Avant toute poussée**, sur accord du porteur du projet: la suite de bout en bout complète, bureau et téléphone, rejouée.

## Hors périmètre

- Les pas entendus (étape 7.23).
- Les tâches longues, les mini-jeux d'arcade (étape 7.24).
- L'appropriation: égouts, déguisement, ninjas égarés, traces de sang du tueur (étape 7.25). La hantise, remplacée par la malédiction.
- D'autres tâches courtes (étape 7.26).
- Toute modification des autres modes, de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: les natures et leurs valeurs, les lieux nouveaux et leur miroir, sur le vrai terrain.
- **Sabotages (TU)**: qui peut saboter, la recharge commune et celle du début de tour, un seul à la fois, aucun hors du jeu, la fin à l'ouverture d'une réunion, le gong refusé pendant la surchauffe, le terme du tour qui attend.
- **Nuisances (TU)**: qui est frappé, la durée, les fantômes et les assassins épargnés.
- **Panne (TU)**: le rayon des proies vivantes et lui seul, la réparation tenue, remise à zéro en sortant ou en lâchant, qui peut réparer.
- **Surchauffe (TU)**: la réparation à deux, une seconde ensemble, le fantôme qui ne compte pas, la victoire des assassins au terme.
- **Nuage (TU)**: ce qu'une proie vivante en voit, dedans et dehors; ce qu'un assassin et un fantôme en voient.
- **Malédiction (TU)**: qui, tous les assassins vivants, chacun des trois malus, la recharge commune, ses interdits.
- **Vues (TU)**: aucun saboteur nommé, aucune recharge des assassins dans ce que reçoit une proie, aucun malus d'un autre joueur.
- **Serveur (TI)**: le lot B, point 3.
- **Page (TU)**: le panneau des sabotages (jamais pour une proie), celui des malédictions (pour une proie fantôme seulement), la panne, la surchauffe, le nuage.
- **Bout en bout**: le scénario du lot D.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les six sabotages et la malédiction se jouent dans la page, au pointeur, au clavier et au doigt, sur ordinateur et sur téléphone en portrait, vérifiés dans le navigateur.
2. **Rien de ce que reçoit un vivant ne dit qui a saboté**, ni ne trahit un assassin dans un nuage, vérifié par les tests des vues.
3. **Les cinq autres modes n'ont pas changé**: tests existants inchangés, empreinte des quatre parties de référence identique.
4. La couverture de `packages/sim` ne baisse pas (99,83 pour cent au handoff 7.21).
5. `master` n'est pas poussé sans l'accord du porteur du projet, et jamais avant la suite de bout en bout complète.

## Points de vigilance

1. **Un sabotage ne doit désigner personne.** Ni le saboteur dans le flux, ni un assassin dans un nuage. Seule exception acceptée par le porteur du projet: les commandes inversées, qui épargnent les assassins (réponse 2), à juger en jouant.
2. **La malédiction ne doit rien apprendre aux vivants**: ni annonce, ni changement visible dans ce qu'ils reçoivent.
3. **Le cercle de vision dépasse l'écran** depuis le cadrage serré de 7.20 (gardé tel quel, décision du 10 octobre). La panne, à 110 pixels, tient dans l'écran: elle se juge à l'œil sur ordinateur et sur téléphone.
4. **Le téléphone garde deux boutons**: le panneau des sabotages vit dans la carte, la malédiction aussi.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-22-handoff.md`: les décisions confirmées en début d'étape, les écarts à cette fiche (section « Réconciliation », à créer), les chiffres du banc, l'état de la CI et de `master` (non poussé). Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP et l'étude. Prochaine action exacte: l'étape suivante de la section 3 du ROADMAP. Commiter.
