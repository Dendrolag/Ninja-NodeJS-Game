# Mesures de charge du serveur

Document de référence de l'étape 5.1. Il consigne ce que coûte le serveur sous charge, dit où il sature en premier, et pose les seuils qui serviront de base de comparaison à l'étape 5.2 et à la détection des régressions de performance. Une mesure refaite plus tard s'ajoute à ce document, datée, sans effacer celle-ci.

**Mise à jour du 12 septembre 2026, étape 5.2.** La section 11 consigne la mesure d'après les optimisations, sur la même machine et avec la même commande. Ses seuils (section 11.11) remplacent ceux de la section 7 comme référence. Les sections 1 à 10 restent la mesure de l'étape 5.1.

Chiffres bruts de cette mesure: `docs/mesures/charge-serveur-5-1.json`, écrit par le harnais lui-même.

## 1. L'essentiel

- **Une partie pleine tient largement.** 150 bots et 12 joueurs, le maximum du salon: 0,8 ms de calcul par battement, 1,9 ms sur le vrai serveur, diffusion comprise. Les bornes actuelles tiennent, et l'objectif de plus de 100 bots à l'écran est atteint.
- **Un processus tient 16 parties pleines, pas 24**, sur la machine de mesure. En mélangeant parties par défaut (50 bots) et parties pleines, 24 tiennent à coup sûr, et 32 sont à la limite (tenues une fois sur deux). Le budget de la section 7 (35 ms utilisables par battement, divisées par le coût réel d'une partie) prédit cette saturation.
- **Ce qui sature en premier sur un processus est la cadence des battements**, qui décroche quand le fil du serveur est occupé à plus de 60 à 75 pour cent. Le ramasse-miettes, la bande passante seule et les minuteries seules sont écartés par la mesure; le mécanisme exact reste à identifier (étape 5.2).
- **Ce qui sature en premier pour un joueur est la bande passante.** Un instantané pèse 21,5 Ko à 150 bots: 3,4 Mbit/s en continu vers chaque joueur, 78 Mo pour une partie de trois minutes, 42 Mbit/s sortants par partie pleine. Cela justifie l'étape 2.3.
- **Deux coûts cachés**: le moteur croît presque comme le carré du nombre d'entités (1000 bots coûtent 20 ms, une seule partie par cœur), et une partie plus peuplée que les précédentes dans le même processus coûte 2,6 à 3,7 fois plus cher.

## 2. Conditions de la mesure

| Élément     | Valeur                                                                         |
| ----------- | ------------------------------------------------------------------------------ |
| Date        | 11 septembre 2026                                                              |
| Code        | commit `2bbac65` (fin du jalon 3), plus le harnais de l'étape 5.1              |
| Machine     | AMD Ryzen 7 3800X, 8 cœurs et 16 fils, 32 Go de mémoire                        |
| Système     | Windows 11 Pro, Node.js 24.16.0                                                |
| Commande    | `pnpm charge --sortie docs/mesures/charge-serveur-5-1.json`                    |
| Code mesuré | la compilation des paquets (`dist/`), c'est-à-dire ce qui tourne en production |

**Deux réserves de transposition.** La production tournera sous Linux, sur une machine plus lente par cœur qu'un processeur de bureau: les **durées** et la **saturation** sont à remesurer sur la cible avant de dimensionner l'hébergement (étapes 5.2 ou 5.3). Les **tailles** de messages, elles, sont les mêmes partout.

## 3. Ce qui est mesuré, et comment

Le harnais vit dans `tests/charge/` et se lance par `pnpm charge`. Il joue trois mesures, **chacune dans un processus neuf** par configuration ou par palier: la section 5 montre qu'autrement les chiffres dépendent de l'ordre des mesures.

### 3.1 Le banc du battement

Une vraie `GameRoom`, avec les murs de la carte map1, est avancée battement après battement aussi vite que possible: douze joueurs qui changent de cap toutes les 0,5 à 1,5 seconde, les bots demandés, les réglages par défaut pour le reste (bonus, malus, zones, deux bots noirs à mi-partie). 1200 battements mesurés, soit une minute de jeu, après 200 battements d'échauffement.

Trois postes sont chronométrés séparément: **le moteur** (`tick`), **la projection** (`instantaneDe` et `notificationsDe`), **la sérialisation** (le texte JSON du message `etat`). La taille est celle de la trame WebSocket, `42["etat",{...}]`, vérifiée sur de vrais clients par la troisième mesure.

Le banc est **déterministe pour les tailles**: même graine, mêmes intentions tirées au générateur à graine, même pas de temps. Deux exécutions rendent les mêmes octets, à l'unité près; un test le vérifie.

### 3.2 Les populations mêlées

Plusieurs parties jouées l'une après l'autre dans un même processus, comparées à la même partie mesurée seule. C'est ce que vit un vrai serveur, où des parties de tailles différentes se côtoient.

### 3.3 La charge du serveur complet

Le serveur tel que `pnpm dev` le lance (Express, Socket.IO, murs des cartes, horloge du système), sur un port local. Des clients simulés, répartis sur 7 processus, s'y connectent par WebSocket comme le vrai client: chaque partie est créée privée par son hôte, rejointe par code par onze autres joueurs, lancée par le compte à rebours réel. Les démarrages sont étalés sur un battement, comme des parties lancées à des instants quelconques. Chaque joueur émet une intention quand son cap change, et compte les octets de chaque trame reçue.

La mesure passe par **l'horloge injectée du serveur**, enveloppée par le harnais: chaque rappel répété toutes les 50 ms est chronométré, et ce rappel est exactement la boucle d'une partie, moteur puis diffusion à ses joueurs. **Aucune ligne du serveur n'est modifiée.** Sont relevés aussi, sur la fenêtre de mesure: l'écart réel entre deux battements d'une partie, l'occupation du fil du serveur (`eventLoopUtilization`), les pauses du ramasse-miettes, le retard de la boucle d'événements, le processeur et la mémoire du processus serveur, et le processeur des processus de clients (pour vérifier qu'ils ont suivi: jamais plus de 17 pour cent ici).

Paliers de 1, 2, 4, 8, 16, 24, 32, 48, 64 et 96 parties, 20 secondes de mesure chacun après 5 secondes d'échauffement, arrêtés au premier palier non tenu. Deux scénarios: toutes les parties à 150 bots, le maximum du salon; et une partie sur deux à 50 bots (le réglage par défaut), l'autre à 150.

Un serveur **tient** quand chaque partie bat à au moins 19 battements par seconde (95 pour cent de la cible), sans que l'écart entre deux battements dépasse 100 ms au 99e centile, et sans connexion perdue (`verdictDeTenue`, `tests/charge/seuils.ts`).

### 3.4 Ce qui n'est pas mesuré

- **La base de données.** L'enregistrement de fin de partie a lieu une fois par partie, hors de la boucle de battement, et la charge tourne sans base.
- **Un vrai réseau.** Les clients sont sur la même machine: ni latence, ni perte, ni limite de débit. Le débit sortant mesuré est ce que le serveur écrirait vers de vrais joueurs.
- **Le coût du client.** Décoder et dessiner vingt instantanés par seconde est l'affaire de l'étape 5.2, sur un matériel représentatif. Mesuré à l'étape 5.2: section 11.9.

## 4. Le banc du battement

Douze joueurs, carte map1, une ligne par processus neuf. Durées en millisecondes par battement, tailles en octets par message. « Parties par cœur » applique le budget de la section 7 au seul coût du battement mesuré ici, sans diffusion: c'est une borne haute, que la section 6 corrige.

| Bots | Entités | Moteur | Projection | Sérialisation | Total moyen | Total p99 | Octets par message | Compressé (deflate) |        Débit par joueur | Parties par cœur | Bots par cœur |
| ---: | ------: | -----: | ---------: | ------------: | ----------: | --------: | -----------------: | ------------------: | ----------------------: | ---------------: | ------------: |
|   50 |      63 |  0,156 |      0,015 |         0,038 |       0,209 |     0,510 |              9 905 |               2 332 |    198 Ko/s, 1,6 Mbit/s |              167 |         8 350 |
|  100 |     113 |  0,351 |      0,027 |         0,059 |       0,438 |     0,858 |             15 783 |               3 686 |    316 Ko/s, 2,5 Mbit/s |               79 |         7 900 |
|  150 |     163 |  0,648 |      0,041 |         0,084 |       0,772 |     1,382 |             21 567 |               5 043 |    431 Ko/s, 3,4 Mbit/s |               45 |         6 750 |
|  200 |     213 |  1,048 |      0,055 |         0,106 |       1,208 |     1,978 |             27 453 |               6 365 |    549 Ko/s, 4,4 Mbit/s |               28 |         5 600 |
|  300 |     313 |  2,001 |      0,077 |         0,150 |       2,227 |     3,052 |             39 027 |               9 009 |    781 Ko/s, 6,2 Mbit/s |               15 |         4 500 |
|  500 |     513 |  5,239 |      0,143 |         0,255 |       5,637 |     7,260 |             62 469 |              14 389 | 1 249 Ko/s, 10,0 Mbit/s |                6 |         3 000 |
| 1000 |    1013 | 19,100 |      0,307 |         0,487 |      19,895 |    22,958 |            120 834 |              27 394 | 2 417 Ko/s, 19,3 Mbit/s |                1 |         1 000 |

Ce que le tableau dit:

- **Le moteur fait l'essentiel du battement**: 84 pour cent à 150 bots, 96 pour cent à 1000. Projection et sérialisation réunies coûtent 0,13 ms à 150 bots: le JSON n'est pas un problème de processeur.
- **Le coût du moteur croît presque comme le carré du nombre d'entités.** De 150 à 1000 bots, 6,7 fois plus d'entités coûtent 29 fois plus, soit une puissance de 1,8. C'est la forme du relevé des contacts, qui compare chaque paire d'entités (`detecterContacts`, `packages/sim/src/contacts.ts`): premier poste du profil du processeur à 300 bots. Conséquence directe: le nombre de **bots par cœur baisse** quand les parties grossissent, de 8 350 en parties de 50 à 1 000 en une seule partie de 1000.
- **Chaque entité ajoute 117 octets à chaque message**, vingt fois par seconde, à chaque joueur. Positions en nombres à virgule complets, identifiants, couleur et direction en texte.
- **La compression divise la taille par 4,3.** Elle est désactivée par défaut dans Socket.IO.

## 5. Les populations mêlées

Même processus, parties jouées l'une après l'autre. « Facteur » compare le coût à celui de la même partie mesurée seule, dans un processus neuf (section 4).

| Suite        | Partie mesurée | Total moyen | Mesurée seule | Facteur |
| ------------ | -------------- | ----------: | ------------: | ------: |
| 50 puis 150  | 150 bots       |       2,088 |         0,772 |  × 2,70 |
| 150 puis 50  | 50 bots        |       0,228 |         0,209 |  × 1,09 |
| 150 puis 300 | 300 bots       |       8,137 |         2,227 |  × 3,65 |

Les premières parties de chaque suite coûtent ce qu'elles coûtent seules (× 0,99 à × 1,00).

**Une partie plus peuplée que les précédentes coûte 2,6 à 3,7 fois plus cher**, à travail identique à l'octet près; l'effet inverse est faible. Rejouer la même population ne dégrade rien (vérifié à 150 puis 150, et 300 puis 300). Ce n'est pas une avalanche de désoptimisations du compilateur à la volée: la trace de V8 en compte moins dans la suite dégradée que dans la partie seule. La cause la plus probable est un code resté optimisé mais devenu polymorphe sur la forme des objets (les tables de bots indexées par identifiant, recopiées à chaque battement). **C'est à diagnostiquer à l'étape 5.2**, avec les outils de V8 (`--trace-ic`, `--prof`). Diagnostiqué et corrigé à l'étape 5.2: section 11.3.

Le serveur complet y est exposé aussi. Avant que chaque palier ait son processus, un palier de 2 parties pleines, joué dans le processus du palier précédent, coûtait 2,48 ms par battement; en processus neuf, 1,24 ms.

## 6. La charge du serveur complet

Durées en millisecondes. « Processeur par partie » divise tout le processeur du serveur par le nombre de battements: il compte, en plus du battement, ce que le serveur fait entre deux battements pour cette partie (réception des intentions, envoi effectif des octets, ramasse-miettes). C'est le vrai coût d'une partie.

### 6.1 Parties pleines: 150 bots et 12 joueurs

| Parties | Battement moyen (p99) | Écart p99 | Fréquence min | Fil occupé | Ramasse-miettes | Processeur | Processeur par partie | Mémoire | Octets par message | Débit sortant | Verdict  |
| ------: | --------------------: | --------: | ------------: | ---------: | --------------: | ---------: | --------------------: | ------: | -----------------: | ------------: | -------- |
|       1 |           1,35 (2,60) |      51,2 |       20,0 Hz |        4 % |           0,1 % |        5 % |                  2,26 |  100 Mo |             21 837 |     42 Mbit/s | tenu     |
|       2 |           1,24 (1,91) |      51,5 |       19,9 Hz |        6 % |           0,1 % |        6 % |                  1,63 |  233 Mo |             21 808 |     84 Mbit/s | tenu     |
|       4 |           1,66 (2,78) |      51,4 |       19,9 Hz |       14 % |           0,3 % |       16 % |                  1,97 |  242 Mo |             21 876 |    168 Mbit/s | tenu     |
|       8 |           1,62 (2,73) |      51,7 |       19,9 Hz |       28 % |           0,5 % |       27 % |                  1,72 |  245 Mo |             21 812 |    334 Mbit/s | tenu     |
|      16 |           1,64 (2,94) |      54,6 |       19,8 Hz |       56 % |           1,7 % |       61 % |                  1,92 |  261 Mo |             21 827 |    664 Mbit/s | tenu     |
|      24 |           1,60 (3,84) |      88,7 |       18,0 Hz |       73 % |           2,3 % |       82 % |                  1,91 |  334 Mo |             21 837 |    905 Mbit/s | non tenu |

### 6.2 Parties mêlées: une sur deux à 50 bots, l'autre à 150, 12 joueurs

| Parties | Battement moyen (p99) | Écart p99 | Fréquence min | Fil occupé | Ramasse-miettes | Processeur | Processeur par partie | Mémoire | Octets par message | Débit sortant | Verdict  |
| ------: | --------------------: | --------: | ------------: | ---------: | --------------: | ---------: | --------------------: | ------: | -----------------: | ------------: | -------- |
|       1 |           0,80 (1,45) |      51,2 |       19,9 Hz |        3 % |           0,1 % |        4 % |                  1,88 |   92 Mo |             10 295 |     20 Mbit/s | tenu     |
|       2 |           1,26 (3,14) |      51,2 |       19,9 Hz |        6 % |           0,1 % |        7 % |                  1,70 |  293 Mo |             16 122 |     62 Mbit/s | tenu     |
|       4 |           1,11 (2,80) |      51,4 |       20,0 Hz |       10 % |           0,1 % |       10 % |                  1,28 |  295 Mo |             16 057 |    123 Mbit/s | tenu     |
|       8 |           1,53 (2,96) |      51,5 |       19,9 Hz |       26 % |           0,6 % |       28 % |                  1,73 |  239 Mo |             16 019 |    245 Mbit/s | tenu     |
|      16 |           1,48 (2,71) |      52,0 |       19,9 Hz |       50 % |           1,4 % |       55 % |                  1,74 |  242 Mo |             15 998 |    489 Mbit/s | tenu     |
|      24 |           1,07 (2,67) |      53,0 |       19,8 Hz |       55 % |           1,4 % |       60 % |                  1,26 |  256 Mo |             16 044 |    733 Mbit/s | tenu     |
|      32 |           1,50 (2,83) |      64,7 |       18,9 Hz |       98 % |           3,7 % |      104 % |                  1,72 |  325 Mo |             16 089 |    937 Mbit/s | non tenu |

### 6.3 Où le serveur sature en premier

**Sur un processus, c'est la cadence des battements.** Aux paliers non tenus, les parties ne battent plus que 18 à 19 fois par seconde, et un battement sur cent arrive avec 15 à 40 ms de retard. Le jeu reste juste, le moteur recevant le temps réellement écoulé, mais les joueurs reçoivent moins d'instantanés et ressentent des à-coups.

Ce qui est établi sur la cause:

| Hypothèse                                   | Mesure qui la teste                                                                                                                                     | Verdict                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Le fil du serveur est plein                 | Fil occupé à 73 pour cent au premier palier non tenu des parties pleines, 62 à un joueur par partie                                                     | écartée, sauf à 32 mêlées (98 %) |
| Le ramasse-miettes bloque les battements    | 2,3 pour cent du temps au premier palier non tenu, pause la plus longue 6,5 ms                                                                          | écartée                          |
| La bande passante, ou l'écriture des octets | Mêmes parties de 150 bots à **un seul joueur**: 24 parties décrochent aussi (19,0 Hz, fil à 62 %), avec 67 Mbit/s sortants seulement                    | écartée comme cause unique       |
| Les minuteries de Node (`setInterval`)      | Test isolé: 24 à 32 boucles de 50 ms travaillant 1,3 ms chacune, avec ou sans à-coups de 10 à 20 ms, tiennent 19,7 Hz jusqu'à 84 pour cent d'occupation | écartée comme cause unique       |
| La diffusion à douze joueurs                | Elle ajoute une dizaine de points d'occupation (73 contre 62 pour cent à 24 parties de 150 bots)                                                        | aggrave, ne cause pas            |

Le serveur réel fait entre ses battements ce qu'aucun des tests isolés ne fait: recevoir les intentions et écrire les instantanés sur des centaines de connexions, avec les rappels de fin d'écriture qui en découlent. C'est la piste restante, à diagnostiquer à l'étape 5.2. Diagnostiqué et corrigé à l'étape 5.2, et confirmé sous Linux: section 11.4. Le test isolé montre aussi qu'une programmation des battements qui vise l'heure prévue garde 20,00 Hz là où `setInterval` descend à 19,7 Hz: un levier candidat, à valider sur le vrai serveur. Tout ceci est mesuré sous Windows; la production tournera sous Linux, où l'ordonnancement des minuteries et des entrées-sorties diffère: **à remesurer sur la cible**.

**Ce qui est établi sur le seuil**: sur tous les passages, les pertes de cadence apparaissent à partir de 62 pour cent d'occupation du fil, et aucun palier n'a tenu au-delà de 72 pour cent. Le budget par cœur de la section 7, qui réserve 30 pour cent de marge, prédit les paliers observés.

**Pour un joueur, et sans doute pour l'hébergement, c'est la bande passante.** 42 Mbit/s sortants par partie pleine, 664 Mbit/s au dernier palier tenu. Sur cette machine le réseau local ne limite rien; sur un hébergement, le débit sortant et son coût deviendront une limite à mesurer à l'étape 5.3. Côté joueur, 3,4 Mbit/s en continu et 78 Mo par partie de trois minutes sont déjà une limite, sur mobile en particulier.

**La mémoire n'est pas une limite**: 334 Mo au premier palier non tenu, pour 288 connexions.

### 6.4 Mesure complémentaire: un seul joueur par partie

Pour séparer le calcul de la diffusion: parties de 150 bots, un joueur chacune, joué avec `pnpm charge --reseau --joueurs 1 --bots 150 --rooms "16,24,32" --sans-arret`.

| Parties | Battement moyen (p99) | Écart p99 | Fréquence min | Fil occupé | Processeur | Processeur par partie | Débit sortant | Verdict  |
| ------: | --------------------: | --------: | ------------: | ---------: | ---------: | --------------------: | ------------: | -------- |
|      16 |           1,32 (2,70) |      52,7 |       19,8 Hz | non relevé |       47 % |                  1,46 |     46 Mbit/s | tenu     |
|      24 |           1,29 (3,00) |      67,0 |       19,0 Hz |       62 % |       68 % |                  1,50 |     67 Mbit/s | non tenu |
|      32 |           1,20 (3,49) |     109,1 |       17,3 Hz |       69 % |       76 % |                  1,37 |     81 Mbit/s | non tenu |

La ligne à 16 parties vient d'un passage antérieur à l'ajout de la mesure d'occupation du fil. À 24 parties, la fréquence la plus basse vaut 18,97 Hz, sous le plancher de 19.

## 7. Les seuils de référence

Seuils de l'étape 5.1. **Depuis le 12 septembre 2026, les seuils en vigueur sont ceux de la section 11.11.**

### 7.1 Le budget par cœur

Un processus Node.js fait battre toutes ses parties sur un seul fil. Le budget réserve aux battements **70 pour cent d'un battement, soit 35 ms**, et divise par le coût d'une partie. Le reste va à tout ce que le même fil fait aussi; la section 6.3 montre que la cadence se perd bien avant 100 pour cent.

Le coût à utiliser est le **processeur par partie mesuré sur le vrai serveur**, à un palier chargé (16 parties), et non le coût du banc, qui ignore la diffusion et le travail entre deux battements, et surestime la capacité d'un facteur 2,5.

| Configuration                    | Coût par partie (16 parties) | Budget: parties par cœur | Bots par cœur | Mesuré                                 |
| -------------------------------- | ---------------------------: | -----------------------: | ------------: | -------------------------------------- |
| 150 bots, 12 joueurs             |                      1,92 ms |                       18 |         2 700 | 16 tenues, 24 non                      |
| 50 et 150 bots mêlés, 12 joueurs |                      1,74 ms |                       20 |         2 000 | 24 tenues; 32 tenues une fois sur deux |
| 150 bots, 1 joueur               |                      1,46 ms |                       23 |         3 450 | 16 tenues, 24 non (de justesse)        |
| 150 bots, banc seul              |                      0,77 ms |                       45 |         6 750 | non joué: borne haute sans diffusion   |

**Seuil de référence retenu, sur la machine de mesure: 16 parties pleines par processus (2 400 bots, 192 joueurs), et 24 parties en mélange par défaut et pleines.** L'étape 5.2 compare ses résultats à ces paliers, et au coût de 1,9 ms par partie pleine.

### 7.2 Valeurs de comparaison pour l'étape 5.2

À comparer sur la même machine, avec `pnpm charge`, dans les mêmes conditions (section 9).

| Grandeur                                                 | Référence 5.1              | Tolérance avant de parler de changement |
| -------------------------------------------------------- | -------------------------- | --------------------------------------- |
| Battement du banc, 150 bots, 12 joueurs                  | 0,77 ms (p99 1,38)         | 5 pour cent (section 8)                 |
| Battement du banc, 1000 bots                             | 19,9 ms                    | 5 pour cent                             |
| Populations mêlées, 150 après 50                         | × 2,70                     | 0,15                                    |
| Processeur par partie pleine, 16 parties                 | 1,92 ms                    | 10 pour cent                            |
| Dernier palier tenu, parties pleines                     | 16 parties                 | un palier                               |
| Dernier palier tenu, parties mêlées                      | 24 parties, 32 à la limite | un palier                               |
| Taille d'un instantané, 150 bots, 12 joueurs, sur le fil | 21 837 octets              | 2 pour cent (parties à graine libre)    |
| Taille d'un instantané, partie de référence du banc      | 21 518 octets              | exacte, vérifiée en CI à 5 pour cent    |

## 8. Reproductibilité

**Le banc**, trois exécutions complètes le même jour, chacune en processus neufs:

| Bots | Exécution 1 | Exécution 2 | Exécution 3 (référence) | Écart maximal |
| ---: | ----------: | ----------: | ----------------------: | ------------: |
|   50 |    0,210 ms |    0,209 ms |                0,209 ms |         0,5 % |
|  150 |    0,769 ms |    0,799 ms |                0,772 ms |         3,9 % |
|  300 |    2,235 ms |    2,287 ms |                2,227 ms |         2,7 % |
| 1000 |   20,014 ms |   19,758 ms |               19,895 ms |         1,3 % |

Les tailles sont identiques à l'octet d'une exécution à l'autre. Les populations mêlées donnent × 2,66, × 2,61 et × 2,70 pour 150 après 50, et × 3,61, × 3,43 et × 3,65 pour 300 après 150.

**Le serveur complet**, passage de référence et second passage complet joué juste après, chacun en processus neufs. Chiffres bruts du second: `docs/mesures/charge-serveur-5-1-reproductibilite.json`.

| Grandeur                                              | Référence           | Second passage      | Écart         |
| ----------------------------------------------------- | ------------------- | ------------------- | ------------- |
| Parties pleines: dernier palier tenu                  | 16                  | 16                  | aucun         |
| Parties pleines: fréquence la plus basse à 24 parties | 18,0 Hz             | 17,7 Hz             | 1,7 %         |
| Parties pleines: processeur par partie, 16 parties    | 1,92 ms             | 1,99 ms             | 3,6 %         |
| Parties pleines: fil occupé à 16 puis 24 parties      | 56 puis 73 %        | 58 puis 75 %        | 2 points      |
| Parties pleines: taille d'un instantané, 16 parties   | 21 827 octets       | 21 856 octets       | 0,1 %         |
| Parties mêlées: processeur par partie, 16 parties     | 1,74 ms             | 1,82 ms             | 4,6 %         |
| Parties mêlées: 32 parties                            | 18,9 Hz, fil à 98 % | 19,2 Hz, fil à 72 % | tenu une fois |
| Parties mêlées: dernier palier tenu                   | 24                  | 32 (48 non tenu)    | un palier     |

Deux autres passages, joués pendant l'étape avec le même harnais, concordent pour les parties pleines: 16 tenues et 24 non (18,0 Hz), processeur par partie de 1,96 et 2,03 ms à 16 parties. **Les parties pleines se reproduisent donc à quelques pour cent près; le mélange se joue à la limite à 32 parties**, d'où le palier de référence de 24 retenu à la section 7.

## 9. Les seuils vérifiés automatiquement

Deux seuils tournent à chaque intégration continue, dans `tests/charge/battement.test.ts`, sur la **partie de référence**: 150 bots, 12 joueurs, carte map1, graine 42, 600 battements mesurés après 100 d'échauffement (`PARTIE_DE_REFERENCE`, `tests/charge/seuils.ts`).

| Seuil                                        | Valeur                                            | Pourquoi il tient sur toute machine                                                                                          |
| -------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Taille moyenne d'un instantané               | 21 518 octets, à 5 pour cent près                 | Le banc est déterministe pour les tailles: la même partie donne les mêmes octets partout.                                    |
| Coût moyen d'un battement de la partie seule | moins de 35 ms, la part utilisable d'un battement | Mesuré à 0,8 ms à l'étape 5.1, 0,43 ms depuis l'étape 5.2: quatre-vingts fois de marge pour une machine d'intégration lente. |

Le premier est un vrai seuil de régression: ajouter un champ à chaque entité, ou changer le format du flux, le fait échouer. Une modification voulue se mesure, puis se reporte dans `OCTETS_PAR_MESSAGE_DE_REFERENCE` et dans ce document. Le second ne détecte qu'un effondrement: une régression de durée ne se juge que sur une même machine, en relançant le harnais.

Deux autres tests vérifient que le harnais mesure juste: deux exécutions de même graine rendent les mêmes octets, et une charge courte sur le vrai serveur mesure sur le fil la taille que le banc calcule, à 15 pour cent près (`tests/charge/charge-reseau.test.ts`).

## 10. Relancer la mesure et comparer

```bash
pnpm charge --sortie docs/mesures/charge-serveur-5-2.json
```

- `--banc`, `--melange`, `--reseau` pour ne jouer qu'une partie; sans aucune, les trois.
- `--bots-banc 150,300` pour le banc; `--sequence 50,150` (répétable) pour les populations mêlées.
- `--rooms 8,16,24`, `--bots 150` ou `--bots 50,150` (répétable), `--joueurs 12`, `--duree-mesure 20`, `--echauffement 5`, `--processus 7` pour la charge du serveur; `--sans-arret` pour jouer tous les paliers même après un palier non tenu.
- `--rapide` pour vérifier en une minute que le harnais fonctionne.

Pour comparer deux mesures, garder la même machine et les mêmes options, puis rapprocher les deux fichiers JSON. Trois précautions, toutes tirées de l'étape 5.1:

1. **Rien d'autre ne tourne sur la machine.** Une vérification de types lancée pendant une mesure la décale.
2. **Un processus neuf par mesure.** Le harnais le fait déjà. Mesurer à la main dans un même processus fausse les résultats (section 5).
3. **Les tailles se comparent à l'octet, les durées à quelques pour cent.** Voir la section 8 pour l'écart observé entre deux exécutions.

Deux outils ajoutés à l'étape 5.2:

- **Prouver qu'une optimisation ne change rien au jeu**: `tests/charge/empreinte.ts` résume quatre parties déterministes, état du moteur, instantanés et notifications, à chaque battement. Les empreintes d'avant et d'après doivent être identiques (mode d'emploi en tête du fichier).
- **Mesurer sous Linux**: pousser une branche `mesure-charge/<nom>` dont le dernier commit porte les lignes « Mesurer: » (les commits, joués sur la même machine) et « Options: » (celles de `pnpm charge`). Le workflow `.github/workflows/charge.yml` conserve les fichiers JSON en artefact. Supprimer la branche ensuite.

## 11. Mesure de l'étape 5.2 (12 septembre 2026)

Chiffres bruts: `docs/mesures/charge-serveur-5-2.json`, écrit par le harnais sur le commit `1eaccd3`, même machine et même commande qu'à la section 2. Mesures intermédiaires (chaque optimisation seule) et mesures sous Linux: `docs/mesures/5-2/`. Les fichiers intermédiaires portent le commit `8b3992d`: ils ont été joués sur l'arbre de travail, avant le commit des optimisations.

### 11.1 L'essentiel

- **Un processus tient 48 parties pleines au lieu de 16, et 64 parties mêlées au lieu de 24.** Une partie pleine coûte 0,95 ms par battement sur le vrai serveur (1,92 en 5.1), 0,43 ms au banc (0,77).
- **Trois optimisations, chacune partie d'un point chaud mesuré.** Aucune ne change le jeu: les tests du moteur restent au vert, et l'empreinte de quatre longues parties est identique à l'octet avant et après.
- **Les deux questions ouvertes de 5.1 ont leur cause.** Les populations mêlées venaient de la table des bots recopiée pour chaque bot; la perte de cadence, de `setInterval`, qui perd pour de bon chaque retard. Les deux se reproduisent, et se corrigent, sous Linux.
- **Le premier mur d'un processus est désormais un fil réellement plein**, et la première limite pratique la bande passante: 2 Gbit/s sortants pour 48 parties pleines. C'est l'objet de l'étape 2.3.
- **Écartés par la mesure**: la grille spatiale, le niveau de détail d'IA, toute optimisation du client.

### 11.2 Méthode

1. **Profiler avant de toucher**: profil du processeur de V8 (`--cpu-prof`) sur le banc à 150 bots, seul puis après une partie de 50, et sur le serveur complet à 24 parties pleines, le premier palier non tenu de 5.1.
2. **Une optimisation à la fois**, mesurée par le harnais dans les conditions de 5.1: le banc et les populations mêlées en processus neufs, puis la charge du serveur complet.
3. **Prouver que le jeu n'a pas changé**, deux fois: les tests du moteur, et l'empreinte (`tests/charge/empreinte.ts`) de quatre parties déterministes, relevée sur le code de 5.1 puis après chaque optimisation. Empreintes, identiques à chaque fois: `1f879047…a2d9` (150 bots, 12 joueurs, murs, 3 000 battements), `b769d565…6bed` (50 bots), `c343f05d…0b44` (300 bots sans mur), `20bda0b3…d8a3` (150 bots, 2 joueurs). Ces parties comptent 11 à 13 captures de joueurs, 3 à 15 captures par bot noir, des bonus, des malus et des zones.

### 11.3 Diagnostic des populations mêlées

| Profil du banc, 1 400 battements | `poser` (temps propre) | `detecterContacts` (temps propre) |
| -------------------------------- | ---------------------: | --------------------------------: |
| 150 bots seuls                   |                  38 ms |                            562 ms |
| 150 bots après une partie de 50  |               1 551 ms |                            578 ms |

**Une seule fonction explique tout l'écart.** `avancerLesBots` rangeait chaque bot en recopiant la table entière des bots: autant de copies que de bots, soit un travail en carré de la population. Après une première partie plus petite, le code que V8 garde pour cette copie devient quarante fois plus lent. Le relevé des contacts, lui, ne bouge pas. Sur le serveur complet, où toutes les parties passent par un salon vide avant d'être peuplées, la même fonction pesait 8,4 pour cent du temps, contre 11,9 pour le relevé des contacts: l'effet y était permanent.

Correction: la table est copiée une fois par battement, et chaque bot y est rangé (décision du 12 septembre 2026 au journal de `docs/design/README.md`). Populations mêlées: × 2,70 devient × 1,01, et × 3,65 devient × 1,08.

### 11.4 Diagnostic de la perte de cadence

Sur le code de 5.1, à 24 parties pleines (17,8 Hz, fil occupé à 72 pour cent), l'écart entre deux battements d'une partie vaut 51,1 ms en médiane, mais 56,1 ms en moyenne, 71 ms au 95e centile et 96 ms au 99e. **Chaque battement perd en moyenne 6 ms, et ne les rattrape jamais.**

Le mécanisme: une minuterie répétée de Node repart de l'instant où son rappel a commencé. Un battement qui arrive à échéance pendant que le fil fait battre une autre partie, ou traite les fins d'écriture des centaines de connexions, attend son tour; ce retard est perdu pour de bon, et la fréquence baisse d'autant. Le test isolé de 5.1 ne voyait rien, faute d'écritures réseau entre ses battements: ses retards restaient sous la milliseconde.

La preuve, même code du moteur (optimisé), seule la programmation des battements change:

| Palier             | `setInterval`: fréquence min, fil | Heure prévue: fréquence min, fil | Verdicts           |
| ------------------ | --------------------------------: | -------------------------------: | ------------------ |
| 32 parties pleines |                     19,8 Hz, 57 % |                    20,0 Hz, 58 % | tenu, tenu         |
| 48 parties pleines |                     19,4 Hz, 86 % |                    19,9 Hz, 86 % | tenu, tenu         |
| 64 parties pleines |                     17,7 Hz, 98 % |                   17,4 Hz, 100 % | non tenu, non tenu |
| 48 parties mêlées  |                     19,7 Hz, 65 % |                    20,0 Hz, 67 % | tenu, tenu         |
| 64 parties mêlées  |                     19,3 Hz, 84 % |                    20,0 Hz, 88 % | tenu, tenu         |
| 96 parties mêlées  |                          non joué |                   14,5 Hz, 100 % | non tenu           |

Correction: chaque battement programme le suivant à l'échéance précédente plus 50 ms (`rappelSuivant`, `packages/server/src/horloge.ts`); un retard d'un intervalle ou plus repart de maintenant, sans rafale. **La fréquence tient 20 Hz jusqu'à ce que le fil soit réellement plein.** Le palier ne bouge pas, mais la marge sous le plancher de 19 Hz est retrouvée. À saturation, où plus rien ne tient, les écarts deviennent un peu plus irréguliers (84,9 à 90,1 ms au 99e centile, contre 74,9).

### 11.5 Les optimisations retenues, et leur gain

| Optimisation                                                | Point chaud mesuré                  | Fichier                          |
| ----------------------------------------------------------- | ----------------------------------- | -------------------------------- |
| 1. La table des bots copiée une fois par battement          | `poser`, populations mêlées         | `packages/sim/src/bots.ts`       |
| 2. Relevé des contacts sans tableau par entité, tri par axe | `detecterContacts`, premier poste   | `packages/sim/src/contacts.ts`   |
| 3. La boucle d'une partie vise l'heure prévue               | perte de cadence avant un fil plein | `packages/server/src/horloge.ts` |

Le tri par axe écarte une paire éloignée d'au moins 20 pixels sur un axe sans calculer sa distance: la distance entre deux points n'est jamais plus petite que leur écart sur un axe. Les paires restantes sont jugées par la même distance qu'avant; un test compare le relevé à la comparaison naïve de toutes les distances, dans une mêlée de 92 entités.

Gain au banc, chaque optimisation ajoutée à la précédente, en processus neufs:

| Grandeur                          |       5.1 | 1. Copie unique | 2. Contacts | Référence 5.2 |
| --------------------------------- | --------: | --------------: | ----------: | ------------: |
| Battement, 150 bots               |  0,772 ms |        0,670 ms |    0,441 ms |      0,434 ms |
| Battement, 300 bots               |  2,227 ms |        1,907 ms |    1,087 ms |      1,078 ms |
| Battement, 1000 bots              | 19,895 ms |       16,905 ms |    7,623 ms |      7,804 ms |
| Populations mêlées, 150 après 50  |    × 2,70 |          × 1,01 |      × 1,00 |        × 1,01 |
| Populations mêlées, 300 après 150 |    × 3,65 |          × 1,03 |      × 1,07 |        × 1,08 |

Gain sur le serveur complet des deux premières, avant la troisième: à 24 parties pleines, le processeur par partie passe de 1,91 à 0,99 ms, le fil de 73 à 43 pour cent, la fréquence de 18,0 à 19,9 Hz. La troisième ne change pas le coût: elle garde la fréquence (section 11.4).

### 11.6 Le banc du battement

Douze joueurs, carte map1, une ligne par processus neuf. Durées en millisecondes. Les tailles sont identiques à l'octet à celles de la section 4: aucune optimisation ne touche au flux.

| Bots | Moteur 5.1 | Moteur 5.2 | Total 5.1 | Total 5.2 | Total p99 5.2 | Octets par message | Parties par cœur 5.2 |
| ---: | ---------: | ---------: | --------: | --------: | ------------: | -----------------: | -------------------: |
|   50 |      0,156 |      0,105 |     0,209 |     0,157 |         0,419 |              9 905 |                  222 |
|  100 |      0,351 |      0,197 |     0,438 |     0,284 |         0,683 |             15 783 |                  123 |
|  150 |      0,648 |      0,313 |     0,772 |     0,434 |         0,891 |             21 567 |                   80 |
|  200 |      1,048 |      0,494 |     1,208 |     0,650 |         1,298 |             27 453 |                   53 |
|  300 |      2,001 |      0,858 |     2,227 |     1,078 |         1,815 |             39 027 |                   32 |
|  500 |      5,239 |      2,166 |     5,637 |     2,523 |         3,755 |             62 469 |                   13 |
| 1000 |     19,100 |      7,077 |    19,895 |     7,804 |        10,736 |            120 834 |                    4 |

Le moteur croît encore plus vite que le nombre d'entités (puissance 1,7 de 150 à 1000 bots, contre 1,8): le relevé des contacts examine toujours chaque paire, mais chaque paire coûte beaucoup moins. À 150 bots il ne pèse plus que 0,15 ms. Populations mêlées: 150 après 50, × 1,01; 50 après 150, × 0,91; 300 après 150, × 1,08.

### 11.7 La charge du serveur complet

Mêmes colonnes qu'à la section 6, durées en millisecondes.

Parties pleines, 150 bots et 12 joueurs:

| Parties | Battement moyen (p99) | Écart p99 | Fréquence min | Fil occupé | Ramasse-miettes | Processeur | Processeur par partie | Mémoire | Octets par message | Débit sortant | Verdict  |
| ------: | --------------------: | --------: | ------------: | ---------: | --------------: | ---------: | --------------------: | ------: | -----------------: | ------------: | -------- |
|       1 |           1,09 (1,59) |      51,9 |       20,0 Hz |        3 % |           0,1 % |        6 % |                  2,81 |   91 Mo |             21 829 |     42 Mbit/s | tenu     |
|       2 |           1,04 (1,66) |      51,9 |       20,0 Hz |        5 % |           0,1 % |       10 % |                  2,50 |   98 Mo |             21 758 |     84 Mbit/s | tenu     |
|       4 |           0,96 (1,48) |      51,9 |       20,0 Hz |        9 % |           0,2 % |       10 % |                  1,25 |  113 Mo |             21 765 |    167 Mbit/s | tenu     |
|       8 |           0,83 (1,10) |      52,2 |       20,0 Hz |       15 % |           0,1 % |       16 % |                  1,00 |  247 Mo |             21 848 |    336 Mbit/s | tenu     |
|      16 |           0,81 (1,10) |      52,5 |       20,0 Hz |       28 % |           0,3 % |       30 % |                  0,95 |  243 Mo |             21 878 |    672 Mbit/s | tenu     |
|      24 |           0,81 (1,18) |      52,8 |       20,0 Hz |       42 % |           0,5 % |       43 % |                  0,89 |  243 Mo |             21 860 |  1 007 Mbit/s | tenu     |
|      32 |           0,82 (1,17) |      53,1 |       19,9 Hz |       57 % |           0,7 % |       63 % |                  0,99 |  245 Mo |             21 858 |  1 343 Mbit/s | tenu     |
|      48 |           0,81 (1,24) |      57,9 |       20,0 Hz |       84 % |           1,4 % |       92 % |                  0,96 |  314 Mo |             21 855 |  2 014 Mbit/s | tenu     |
|      64 |           0,79 (1,18) |      84,9 |       18,3 Hz |      100 % |           1,8 % |      107 % |                  0,90 |  298 Mo |             21 844 |  2 511 Mbit/s | non tenu |

Parties mêlées, une sur deux à 50 bots, l'autre à 150, 12 joueurs:

| Parties | Battement moyen (p99) | Écart p99 | Fréquence min | Fil occupé | Ramasse-miettes | Processeur | Processeur par partie | Mémoire | Octets par message | Débit sortant | Verdict  |
| ------: | --------------------: | --------: | ------------: | ---------: | --------------: | ---------: | --------------------: | ------: | -----------------: | ------------: | -------- |
|       1 |           0,70 (1,25) |      51,3 |       20,0 Hz |        2 % |           0,1 % |        3 % |                  1,49 |   88 Mo |             10 103 |     19 Mbit/s | tenu     |
|       2 |           0,80 (1,24) |      51,6 |       20,0 Hz |        4 % |           0,1 % |        6 % |                  1,62 |   98 Mo |             15 924 |     61 Mbit/s | tenu     |
|       4 |           0,74 (1,21) |      52,7 |       20,0 Hz |        7 % |           0,2 % |        8 % |                  0,98 |  110 Mo |             16 014 |    123 Mbit/s | tenu     |
|       8 |           0,66 (1,12) |      52,7 |       20,0 Hz |       12 % |           0,1 % |       14 % |                  0,84 |  234 Mo |             16 057 |    247 Mbit/s | tenu     |
|      16 |           0,65 (1,25) |      52,8 |       20,0 Hz |       23 % |           0,2 % |       22 % |                  0,69 |  244 Mo |             16 057 |    493 Mbit/s | tenu     |
|      24 |           0,64 (1,13) |      52,7 |       20,0 Hz |       33 % |           0,2 % |       30 % |                  0,63 |  251 Mo |             16 011 |    738 Mbit/s | tenu     |
|      32 |           0,64 (1,17) |      53,0 |       20,0 Hz |       44 % |           0,5 % |       47 % |                  0,73 |  248 Mo |             16 045 |    986 Mbit/s | tenu     |
|      48 |           0,62 (1,12) |      53,8 |       20,0 Hz |       65 % |           0,7 % |       68 % |                  0,71 |  265 Mo |             16 051 |  1 479 Mbit/s | tenu     |
|      64 |           0,62 (1,13) |      55,8 |       20,0 Hz |       86 % |           1,2 % |       93 % |                  0,72 |  310 Mo |             16 041 |  1 971 Mbit/s | tenu     |
|      96 |           0,63 (1,15) |      98,2 |       15,0 Hz |      100 % |           1,6 % |      106 % |                  0,71 |  307 Mo |             16 054 |  2 296 Mbit/s | non tenu |

À une ou deux parties, le processeur par partie est dominé par le coût fixe du processus et ne se compare pas; c'était déjà le cas en 5.1.

**Reproductibilité**: la charge des paliers de 32 à 96 parties a été jouée deux fois sur ce code (`5-2/reseau-moteur-optimise-heure-prevue.json`, puis la référence). Verdicts identiques: parties pleines, 48 tenues (19,9 puis 20,0 Hz) et 64 non (17,4 puis 18,3 Hz); parties mêlées, 64 tenues (20,0 Hz deux fois) et 96 non (14,5 puis 15,0 Hz). Processeur par partie à 48 parties pleines: 0,95 puis 0,96 ms. Au banc, entre la mesure intermédiaire et la référence: 1,6 pour cent à 150 bots, 2,4 à 1000.

### 11.8 Où le serveur sature désormais

**Sur un processus, le fil.** La fréquence tient 20 Hz jusqu'à 84 à 86 pour cent d'occupation; les premiers paliers non tenus ont un fil plein (100 pour cent). Le ramasse-miettes reste sous 2 pour cent du temps, la mémoire sous 320 Mo.

**Une partie pleine coûte 0,95 ms sur le vrai serveur, dont 0,43 au banc**: plus de la moitié de son coût est désormais hors du moteur (diffusion à douze joueurs, écriture des octets, réception des intentions, ramasse-miettes). Le flux plus léger de l'étape 2.3 en réduira une part.

**Pour un joueur et pour l'hébergement, la bande passante**, inchangée: 3,4 Mbit/s par joueur, et 2 Gbit/s sortants pour les 48 parties pleines qu'un processus tient désormais. C'est la première limite pratique, et l'objet de l'étape 2.3.

### 11.9 Le coût du client

Mesuré dans Chromium (Playwright), sur le vrai code du client (`packages/client/dist`, lueur néon active), avec 200 instantanés successifs d'une partie pleine produits par le serveur (21 517 octets en moyenne, 162 entités), dans une fenêtre de téléphone (412 × 915 pixels, densité 2,6). Le processeur est ralenti par Chromium lui-même, comme dans ses outils de développement: × 4 approche un téléphone de milieu de gamme, × 6 un téléphone d'entrée de gamme.

| Processeur  | Décoder un instantané (JSON puis reconstruction) | Notre code par image: lissage, scène, dessin | Pointe par image | Images par seconde |
| ----------- | -----------------------------------------------: | -------------------------------------------: | ---------------: | -----------------: |
| normal      |                                          0,07 ms |                        0,10 + 0,05 + 0,17 ms |           2,4 ms |               59,7 |
| ralenti × 4 |                                          0,30 ms |                        0,14 + 0,15 + 0,60 ms |           5,6 ms |               60,4 |
| ralenti × 6 |                                          0,48 ms |                        0,20 + 0,21 + 0,83 ms |           7,7 ms |               60,5 |

À × 6, décoder vingt instantanés par seconde coûte moins de 1 pour cent d'un cœur, et notre code par image 1,2 ms sur les 16,7 d'une image. **Aucune optimisation du client n'est justifiée.** Deux réserves: le ralentissement ne reproduit ni la carte graphique ni l'échauffement d'un téléphone (le dessin est celui de la carte graphique de la machine de mesure); et le lissage cherche la position précédente de chaque entité par un parcours complet, un coût en carré du nombre d'entités, négligeable aux bornes actuelles (0,20 ms à × 6).

La page du jeu, `app.js`, pèse 739 Ko minifiée, 219 Ko compressée en gzip et 183 Ko en brotli. Express la sert sans compression; l'hébergement prévu du client (Vercel) compresse lui-même: à vérifier au déploiement, étape 5.3.

### 11.10 Sous Linux

Machine d'intégration de GitHub (AMD EPYC 7763, 4 cœurs, Linux 6.17, Node.js 24.20.0), commits `8b3992d` (5.1) et `1eaccd3` (5.2) joués l'un après l'autre sur la même machine, clients sur deux processus, 15 secondes de mesure par palier. Chiffres bruts: `5-2/linux-charge-8b3992d.json` et `5-2/linux-charge-1eaccd3.json`.

| Grandeur                                  | 5.1                           | 5.2                       |
| ----------------------------------------- | ----------------------------- | ------------------------- |
| Battement du banc, 150 bots               | 0,866 ms                      | 0,531 ms                  |
| Battement du banc, 300 bots               | 2,530 ms                      | 1,258 ms                  |
| Populations mêlées, 150 après 50          | × 2,32                        | × 0,94                    |
| Processeur par partie, 16 parties pleines | 1,96 ms                       | 1,08 ms                   |
| 16 parties pleines                        | tenu, 19,8 Hz, fil à 57 %     | tenu, 20,0 Hz, fil à 30 % |
| 24 parties pleines                        | non tenu, 17,6 Hz, fil à 79 % | tenu, 20,0 Hz, fil à 49 % |

**Les deux diagnostics se reproduisent sous Linux**: les populations mêlées, et la cadence perdue alors que le fil n'est occupé qu'aux trois quarts. Ce n'était pas un effet de Windows. Les gains se reproduisent aussi, dans les mêmes proportions. Réserve: quatre cœurs partagés entre le serveur et ses clients, qui occupaient à eux deux 1,2 cœur à 24 parties; cette machine compare deux versions, elle ne dit pas ce que tiendra l'hébergement, à mesurer sur la cible à l'étape 5.3.

### 11.11 Les seuils de référence après l'étape 5.2

Budget par cœur, même règle qu'à la section 7.1 (35 ms utilisables par battement, divisées par le processeur par partie mesuré à 16 parties):

| Configuration                    | Coût par partie (16 parties) | Budget: parties par cœur | Bots par cœur | Mesuré                |
| -------------------------------- | ---------------------------: | -----------------------: | ------------: | --------------------- |
| 150 bots, 12 joueurs             |                      0,95 ms |                       36 |         5 400 | 48 tenues, 64 non     |
| 50 et 150 bots mêlés, 12 joueurs |                      0,69 ms |                       50 |         5 000 | 64 tenues, 96 non     |
| 150 bots, banc seul              |                      0,43 ms |                       81 |        12 150 | non joué: borne haute |

**Le budget est désormais prudent**: il prédit 36 parties pleines, et 48 tiennent. En 5.1, la cadence se perdait dès 62 pour cent d'occupation et justifiait ses 30 pour cent de marge; la programmation à l'heure prévue la tient jusqu'à 84 à 86 pour cent. La marge est gardée: le même fil servira aussi les connexions, les routes des comptes et la base, que la charge ne sollicite pas, et l'hébergement ne sera pas la machine de mesure.

**Seuil de référence retenu, sur la machine de mesure: 48 parties pleines par processus (7 200 bots, 576 joueurs), et 64 parties en mélange par défaut et pleines.**

Valeurs de comparaison pour les mesures suivantes (étapes 2.3 et 5.3), sur la même machine, dans les conditions de la section 10:

| Grandeur                                                 | Référence 5.1              | Référence 5.2      | Tolérance avant de parler de changement |
| -------------------------------------------------------- | -------------------------- | ------------------ | --------------------------------------- |
| Battement du banc, 150 bots, 12 joueurs                  | 0,77 ms (p99 1,38)         | 0,43 ms (p99 0,89) | 5 pour cent                             |
| Battement du banc, 1000 bots                             | 19,9 ms                    | 7,8 ms             | 5 pour cent                             |
| Populations mêlées, 150 après 50                         | × 2,70                     | × 1,01             | 0,15                                    |
| Processeur par partie pleine, 16 parties                 | 1,92 ms                    | 0,95 ms            | 10 pour cent                            |
| Fil occupé au dernier palier tenu, parties pleines       | 56 %, à 16 parties         | 84 %, à 48 parties | un palier                               |
| Dernier palier tenu, parties pleines                     | 16 parties                 | 48 parties         | un palier                               |
| Dernier palier tenu, parties mêlées                      | 24 parties, 32 à la limite | 64 parties         | un palier                               |
| Taille d'un instantané, 150 bots, 12 joueurs, sur le fil | 21 837 octets              | 21 878 octets      | 2 pour cent (parties à graine libre)    |
| Taille d'un instantané, partie de référence du banc      | 21 518 octets              | 21 518 octets      | exacte, vérifiée en CI à 5 pour cent    |

Les deux seuils vérifiés en intégration continue (section 9) ne changent pas: la taille des messages est la même, et le plafond de durée ne détecte qu'un effondrement.

### 11.12 Ce que la mesure écarte

- **La grille spatiale.** Le relevé des contacts reste en carré, mais ne coûte plus que 0,15 ms à 150 bots, dans un battement de 0,43 ms. Elle redevient une candidate si les bornes du salon doivent monter au-delà de 150 bots: à 1000 bots, le moteur coûte 7,1 ms.
- **Le niveau de détail d'IA.** Le comportement des bots n'a jamais dominé un profil. Ce qui pesait dans `avancerLesBots` était la recopie de la table, pas l'intelligence des bots.
- **Toute optimisation du client** (section 11.9).
- **Le filtrage du flux par zone d'intérêt, reporté après l'étape 2.3.** La bande passante est bien la première limite, et la caméra d'un téléphone ne montre qu'une partie de la carte. La minicarte ne dessine que les joueurs: filtrer les bots hors champ ne la priverait de rien. Mais le levier retenu pour la bande passante est le flux delta de 2.3, qui n'envoie déjà plus ce qui ne bouge pas, et le gain d'un filtrage dépend de ce format. Il se mesure donc à la fin de 2.3 (voir la fiche 2.3).
