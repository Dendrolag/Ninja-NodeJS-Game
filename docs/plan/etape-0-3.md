# Fiche étape 0.3 - Cadrage fonctionnel depuis les maquettes

Brief de session. Objectif unique: transformer les maquettes en un document de référence qui fige le périmètre v1, les données à modéliser, et les contrats. C'est une étape de documentation, sans code. Son produit, docs/design/cadrage.md, est consommé par les phases 2 et 3.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 0.2, cette fiche, puis docs/design/README.md, **en commençant par l'avertissement en tête de fichier et la section « Tensions relevées entre la maquette et le jeu réel »**.

Ensuite seulement, consulter les maquettes: ouvrir `docs/design/Neon Ninja.html` dans un navigateur (prototype autonome, les sept écrans sont navigables), les sept captures dans `docs/design/screenshots/`, et `docs/design/HANDOFF-CLAUDE-DESIGN.md` pour le détail des jetons de conception et des données.

Réconcilier avec legacy/MapManager.js pour les cartes réellement disponibles.

**Posture obligatoire pour cette étape.** Les maquettes sont des propositions denses, produites avec beaucoup de projections. Le document de passation se déclare « haute fidélité » et « définitif »: cette affirmation n'engage pas le projet. Instruire chaque écart, décider, et consigner la décision avec sa raison dans le journal de docs/design/README.md. Ne rien reprendre par défaut au seul motif que la maquette le montre.

## Tensions à instruire en priorité

Les neuf tensions listées dans docs/design/README.md sont l'entrée principale de cette étape. Trois appellent une décision qui engage l'architecture, et doivent être tranchées ici:

1. **Le miroir est-il un mode ou un réglage ?** La maquette en fait un mode à part entière avec sa propre capacité. Le jeu réel en fait une case à cocher applicable à n'importe quelle carte. Le traiter comme un mode créerait une combinatoire artificielle avec tous les autres modes. Cette décision touche directement le principe des modes enfichables (point 5 ci-dessous) et le contrat de configuration de partie (point 3).
2. **Quelle borne haute pour les faux ninjas ?** La maquette propose 10 à 80 avec 40 par défaut. Le jeu réel démarre à 50 et l'objectif du projet est de dépasser 100. Le contrat de configuration doit refléter l'objectif, pas la maquette.
3. **Le bouton « Terminer » du HUD**: abandon de partie, pause renommée, ou artefact de navigation de la maquette ? Le jeu réel propose une pause.

## Objectif

Produire docs/design/cadrage.md. Ce document acte le tri de périmètre validé, l'inventaire des écrans avec leurs besoins en données, le contrat de configuration de partie, la forme des données de progression, et le principe d'architecture des modes. Aucun code, aucun schéma implémenté ici.

## Périmètre (contenu à produire dans cadrage.md)

1. Tri de périmètre v1, validé:
   - Construire en v1: le mode Classique uniquement, le flux création et salon (navigateur public plus code privé), les comptes et l'authentification, la progression de base affichée par les écrans (niveau, XP, pièces, points de ligue, rang, historique de parties).
   - Modéliser de façon extensible sans construire: laisser des points d'extension dans le schéma pour le pass de saison, les skins et les clans, sans créer ces tables tant que la fonctionnalité n'existe pas.
   - Reporter entièrement: les cinq autres modes (Miroir, Chasse, Battle Royale, Équipes, Chaos), le pass de saison, la boutique de skins, les clans, l'échelle de ligue au-delà du stockage du rang.

2. Inventaire des écrans. Les sept écrans de la maquette: accueil, navigateur de parties publiques, création de partie, salon, jeu en cours, fin de partie, profil. Pour chacun, indiquer s'il est v1 ou réduit, et lister les données qu'il affiche. Les écrans v1 sont des versions réduites qui n'affichent que les données v1 (par exemple l'accueil sans le bloc pass de saison, le profil sans skins ni clan). C'est cet inventaire qui relie chaque écran au schéma et aux contrats.

3. Contrat de configuration de partie, entrée précise pour la phase 2 et pour le moteur. Champs issus de la maquette: mode (énumération, v1 limité à classique), carte (énumération, disponibilité v1 réconciliée avec le legacy), visibilité (publique ou privée, privée avec code d'invitation), durée, nombre de faux ninjas, présence de black ninjas, bonus actifs, malus actifs, zones spéciales, capacité (déduite du mode). Donner pour chaque champ son type et sa valeur par défaut.

4. Forme des données de progression, entrée pour le schéma de la phase 3.1. Au minimum: compte (identifiant, pseudo, date de création), progression (niveau, XP, pièces, gemmes, points de ligue, palier de rang), résultat de partie (mode, carte, placement, score, XP gagnée, pièces gagnées, variation de points de ligue, horodatage), et défis du jour si retenus en v1. Marquer explicitement les points d'extension prévus pour les fonctionnalités reportées.

5. Principe d'architecture des modes, à acter. Le mode est un jeu de règles enfichable dans le moteur. Le moteur reste agnostique au mode. Le mode Classique est le premier jeu de règles. Ajouter un mode plus tard est un ajout, pas une refonte. Le contrat de configuration de partie est l'interface stable.

6. Renvois. Indiquer quelle partie du cadrage alimente quelle fiche aval (configuration de partie vers l'étape 2.4, données de progression vers l'étape 3.1, inventaire des écrans vers la phase 4).

## Hors périmètre

- Aucun code, aucun schéma de base implémenté. Le schéma se construit en 3.1, à partir de ce cadrage.
- Aucune construction d'interface. C'est la phase 4.
- Ne pas élargir le périmètre v1 au-delà du tri validé.
- Ne pas sur-modéliser les fonctionnalités reportées. On laisse des points d'extension, on ne crée pas de structures spéculatives.

## Vérifications requises (cette étape produit un document, pas du code)

- Chaque écran v1 a ses besoins en données listés.
- Le contrat de configuration de partie est complet et correspond à la maquette.
- Les champs de progression couvrent tout ce que les écrans v1 affichent.
- Le tri de périmètre est sans ambiguïté.

## Définition de terminé

1. docs/design/cadrage.md existe et est commité.
2. Il couvre le tri de périmètre, l'inventaire des écrans, le contrat de configuration de partie, la forme des données de progression, et le principe des modes.
3. Il est cohérent avec les maquettes et réconcilié avec les cartes du legacy.

## Réconciliation, faite le 10 septembre 2026

Cette fiche a été écrite pour une étape exécutée avant la phase 1. La section 3 du ROADMAP la place au jalon 2, après la fermeture du jalon 1: quand elle s'exécute, le moteur, le serveur, le contrat de réglages et quatre écrans tournent déjà. Les écarts, point par point.

1. **Le cadrage part du jeu qui tourne.** Le contrat de configuration étend `ReglagesPartie` et `BORNES_REGLAGES`, qui existent depuis les étapes 1.4 à 1.6, au lieu d'en écrire un à partir de la maquette.
2. **La tension 3 de cette fiche, « Terminer », est déjà tranchée** par l'étape 4.3, comme la tension 8 sur le framework. Le cadrage les reprend sans les rouvrir.
3. **Les cartes se réconcilient avec `legacy/game-constants.js`** (`MAP_DIMENSIONS`) et `legacy/js/MapManager.js`: le chemin `legacy/MapManager.js` cité par la fiche n'existe pas.
4. **« Cinq autres modes (Miroir, Chasse, Battle Royale, Équipes, Chaos) »**: le miroir n'étant pas un mode (tension 1), il en reste quatre, plus le mode tactique prévu au jalon 5.
5. **La progression ne stocke ni niveau, ni palier, ni gemmes.** La fiche les liste parmi les données; le niveau et le palier se déduisent de l'XP et des points de ligue, et les gemmes sont reportées avec une boutique. Voir la section 5 du cadrage.
6. **Défis du jour: reportés.** La fiche les laissait optionnels.
7. **La prochaine action exacte de la fiche pointe vers l'étape 1.1**, faite depuis longtemps. La section 3 du ROADMAP désigne l'étape 2.4.

## Rituel de fin de session

Écrire docs/handoffs/etape-0-3-handoff.md. Résumer le contrat de configuration de partie et la forme des données de progression, car les fiches de la phase 2 et de la phase 3 s'appuieront dessus. Prochaine action exacte: étape 1.1, créer le squelette du moteur pur et le modèle d'état, en notant que le moteur acceptera le contrat de configuration de partie défini ici. Commiter.
