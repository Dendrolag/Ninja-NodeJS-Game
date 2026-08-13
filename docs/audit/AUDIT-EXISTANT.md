# Audit de l'existant - Neon Ninja

Date de l'audit: 13 aout 2026. Branche auditee: `master`, commit `fe8c955` (version 0.8.5).

Ce document est la base de connaissance du projet tel qu'il est reellement, par opposition au projet tel qu'il est decrit dans CLAUDE.md. Il sert de point de depart a toute remise sur les rails. Il ne propose pas de plan, il constate.

---

## 1. Constat central: deux projets coexistent sur le papier

Il y a un ecart total entre la constitution du projet et le code reel.

**Ce que decrit CLAUDE.md** (le projet cible): un depot en paquets separes (`packages/sim`, `packages/server`, `packages/client`, `packages/shared`), du TypeScript partout, un coeur de simulation pur et deterministe, PixiJS pour le rendu, PostgreSQL via Neon pour les comptes, Vitest et Playwright pour les tests, une integration continue GitHub Actions, et une methode de travail par etapes avec `docs/plan/ROADMAP.md`, `docs/plan/PROTOCOLE.md` et `docs/handoffs/`.

**Ce qui existe reellement**: un monolithe JavaScript de deux fichiers. Aucun des repertoires cites ci-dessus n'existe. Aucun des fichiers cites n'existe.

Verifie concretement:

| Element promis par CLAUDE.md | Etat reel |
| --- | --- |
| `packages/*` | N'existe pas |
| TypeScript | Aucun fichier `.ts`, aucun `tsconfig.json` |
| PixiJS | Absent. Le rendu est en Canvas 2D natif |
| PostgreSQL / Neon | Absent. Aucune persistance, aucune dependance base de donnees |
| Vitest / Playwright | Absents du `package.json`. Aucune dependance de test installee |
| GitHub Actions | Aucun repertoire `.github/` |
| `docs/plan/ROADMAP.md`, `docs/plan/PROTOCOLE.md` | N'existent pas |
| `docs/handoffs/` et son `_TEMPLATE.md` | N'existent pas |
| `.claude/rules/` (regle de purete de sim) | N'existe pas |
| Section "Commandes" de CLAUDE.md | Laissee vide, "a completer a la fin de l'etape 0.1" |

Deux fiches d'etape sont presentes a la racine, `etape-3-1.md` (base de donnees) et `etape-5-3.md` (deploiement en parallele), mais elles ne sont pas dans `docs/plan/`, elles ne sont pas suivies d'un ROADMAP, et elles decrivent des etapes tres avancees d'un plan dont les etapes 0, 1 et 2 n'ont jamais ete faites. Ces deux fiches sont orphelines.

**Consequence pratique**: une session Claude Code qui suit CLAUDE.md a la lettre cherchera des fichiers inexistants, croira que l'etape 0.1 est faite, et travaillera dans le vide. C'est le premier point a corriger, avant toute ligne de code.

---

## 2. Le produit tel qu'il fonctionne aujourd'hui

Le jeu est fonctionnel et joue. C'est un jeu de capture en temps reel dans un navigateur.

### Boucle de jeu

Les joueurs se deplacent sur une carte en vue de dessus peuplee de bots. Toucher un bot le convertit a sa couleur. Le score d'un joueur est le nombre de bots portant sa couleur a l'instant present, plus 15 points par bot noir detruit. Toucher un autre joueur le capture: on lui vole d'un coup tous ses bots, et il reapparait ailleurs avec une nouvelle couleur. La partie dure un temps configurable (180 secondes par defaut) et se termine par un classement.

Point de conception important: le score est un **stock, pas un cumul**. Se faire capturer remet le compteur a zero. C'est ce qui rend la fin de partie tendue, et c'est un comportement a preserver absolument.

### Elements de jeu

**Bots standards** (50 par defaut): errance aleatoire avec changement de direction periodique, detection de blocage et tentative de degagement.

**Bots noirs** (2 par defaut, apparition a 50 pour cent du temps de partie): poursuivent les joueurs dans un rayon de detection de 150 pixels, a vitesse 6 contre 3 pour un joueur. Capturer un joueur lui fait perdre 50 pour cent de ses points. Un joueur invincible qui les touche les detruit et gagne 15 points.

**Bonus** (apparition periodique, taux configurables): vitesse (multiplicateur 1,7), invincibilite, revelation (montre les vrais joueurs parmi les bots).

**Malus**: controles inverses, vision floue, vision en negatif. Un malus ramasse s'applique aux **autres** joueurs, pas a celui qui le ramasse.

**Zones speciales** (maximum 3 simultanees): Chaos, Repulsive, Attractive, Invisibilite. Elles apparaissent et expirent au fil de la partie.

**Cartes**: map1 (2000x1500), map2 Tokyo (2000x1500), map3 Room of Spirit and Time (3000x2000, marquee "test"). Chaque carte a une variante miroir. Les collisions sont derivees d'une image `collision.png`: un pixel dont la luminosite moyenne est inferieure a 128 est un mur.

**Salle d'attente**: un joueur est proprietaire (le premier arrive, ou le suivant par transfert automatique). Seul le proprietaire regle les parametres et lance la partie, avec un compte a rebours de 5 secondes annulable jusqu'a 2 secondes. Chat integre. Un joueur peut rejoindre une partie en cours.

**Autres**: support mobile avec joystick virtuel, gestion audio complete (musiques et sons spatialises), mode miroir, systeme de pause.

### Ce qui n'existe pas dans master, contrairement a ce qu'annonce CLAUDE.md

- **Le mode tactique n'existe pas.** CLAUDE.md parle de "modes classique et tactique". Aucune trace de mode tactique dans `master` (recherche exhaustive sur `tactic`, `tactique`, `strateg`, `captureCone`: zero resultat). Il n'existe que dans la branche abandonnee `modular-architecture-broken`, sous `server/game/TacticalMode.js`.
- **Les parties privees et publiques n'existent pas.** Il n'y a qu'une seule partie globale pour tout le serveur (voir section 3).
- **La progression de compte n'existe pas.** Aucune persistance d'aucune sorte.

---

## 3. Architecture reelle

### Inventaire des fichiers

| Fichier | Lignes | Role |
| --- | --- | --- |
| `server.js` | 2 812 | Tout le serveur: Express, Socket.IO, etat, entites, boucle de jeu |
| `public/client.js` | 4 367 | Tout le client: interface, rendu, entrees, reseau, audio |
| `public/styles.css` | 3 761 | Styles |
| `public/index.html` | 592 | Structure |
| `public/js/MapManager.js` | 465 | Rendu des cartes et collisions cote client |
| `public/js/AudioManager.js` | 364 | Sons et musiques |
| `game-constants.js` | 134 | Constantes serveur |
| `public/js/game-constants.js` | 71 | Constantes client (duplication partielle) |

Deux fichiers concentrent 7 179 lignes, soit l'essentiel de la logique.

### Le probleme structurant: l'etat global mutable unique

`server.js` declare son etat en variables de module (lignes 121 a 164):

```
let players = {};          let bots = {};        let blackBots = {};
let bonuses = [];          let malusItems = [];  let specialZones = new Set();
let isPaused = false;      let isGameOver = false;
const waitingRoom = { players: new Map(), settings: {...}, ... };
```

Il n'y a **pas de notion de partie ni de salon**. Il y a une seule partie, un seul salon d'attente, un seul chat, pour tout le serveur. Toutes les diffusions sont des `io.emit(...)`, c'est-a-dire vers tous les clients connectes, sans exception. Les rooms de Socket.IO ne sont jamais utilisees.

**Consequence directe**: deux groupes de joueurs ne peuvent pas jouer en meme temps. Si un second groupe arrive, il rejoint la partie du premier. Les parties privees et publiques annoncees comme objectif sont structurellement impossibles sans refonte de cette couche. C'est le blocage numero un du projet.

C'est aussi la cause de fond identifiee par CLAUDE.md lui-meme: "Aucune variable globale mutable, c'etait la cause des blocages du legacy."

### La boucle de jeu

```
setInterval(() => {
    if (!isPaused && !isGameOver) { updateBots(); updatePlayerBonuses(); sendUpdates(); }
}, 50);   // 20 fois par seconde
```

Elle demarre au lancement du serveur et tourne en permanence, y compris quand personne ne joue. `sendUpdates()` serialise l'integralite de l'etat (toutes les entites, tous les scores, tous les bonus, tous les malus, toutes les zones) et l'envoie a chaque socket, 20 fois par seconde. Pas de compression differentielle, pas de filtrage par champ de vision, pas d'arrondi des coordonnees. Avec 50 bots et 100 bots vises, la charge reseau croit lineairement et sans plafond.

### Le modele de mouvement

Le client calcule lui-meme son deplacement et l'envoie au serveur:

```
socket.emit('move', { x: move.x, y: move.y, speedBoostActive, isMoving: true });
```

Le serveur applique ce deplacement a la reception de chaque message. Deux consequences majeures:

1. **La vitesse d'un joueur est proportionnelle a son debit de messages**, pas au temps ecoule. Le client emet toutes les 20 millisecondes via `setInterval`, mais rien cote serveur ne le verifie ni ne le limite.
2. **Il n'y a ni prediction cote client, ni interpolation.** La position affichee est la position brute recue du serveur.

### Le rendu client: le point noir de la fluidite

Il n'existe **aucune boucle de rendu**. `drawEntities()` n'est appelee qu'a un seul endroit: dans le gestionnaire de l'evenement reseau `updateEntities` (`public/client.js:2548`).

Autrement dit, **le jeu s'affiche a la cadence du reseau, soit 20 images par seconde au mieux**, et chaque gigue ou perte de paquet se traduit par un a-coup visible. Un ecran 60 ou 144 Hz n'apporte rien. La camera aggrave le probleme: elle interpole vers sa cible avec un facteur de 0,08 par appel, mais comme elle n'est appelee qu'une fois par tick reseau, elle traine loin derriere le joueur.

C'est probablement la cause principale de la sensation de manque de fluidite, et c'est corrigeable independamment du reste.

### Duplication de la logique de collision

La carte de collision est analysee **deux fois**, une fois cote serveur (`CollisionMap` dans `server.js`) et une fois cote client (`MapManager.initializeCollisionData`). Deux implementations distinctes du meme calcul, avec deux seuils et deux representations. Le client s'en sert pour bloquer l'envoi du mouvement, le serveur pour valider. Toute divergence entre les deux produit un joueur qui se voit bouger sans que le serveur suive, ou l'inverse.

Cote serveur, la representation est un tableau de tableaux de booleens de la taille de la carte en pixels: 3 millions d'entrees pour map1, 6 millions pour map3. C'est tres couteux en memoire, et cet objet est unique et partage, donc non transposable tel quel a plusieurs parties simultanees.

---

## 4. Defauts identifies, par gravite

### Bloquants pour les objectifs annonces

**B1. Une seule partie possible sur tout le serveur.** Detaille en section 3. Empeche parties privees, parties publiques, et toute montee en charge.

**B2. Le rendu est pilote par le reseau.** Detaille en section 3. Plafonne le jeu a 20 images par seconde.

**B3. Aucun test, d'aucune sorte.** Le repertoire `tests/` existe mais est **entierement vide** (seuls subsistent `tests/client/unit/` et `tests/client/integration/`, vides, vestiges d'un basculement de branche). Aucune dependance de test dans `package.json`. Aucun script de test. La regle "Tests d'abord" de CLAUDE.md n'a aucun support.

### Failles de securite

**S1. Injection de code par le pseudonyme (stored XSS).** Le pseudonyme n'est valide nulle part: le client verifie seulement qu'il n'est pas vide, le serveur ne verifie rien du tout (ni longueur, ni caracteres, ni unicite). Il est ensuite injecte tel quel dans du HTML a plusieurs endroits:
- `public/client.js:3937` et `:3970`, modale de fin de partie
- `public/client.js:4211`, modale de capture

Un pseudonyme contenant du code s'execute donc dans le navigateur de **tous** les autres joueurs a la fin de la partie. Le chat, lui, est correctement protege (il utilise `textContent`), ce qui montre que la protection a ete pensee a un endroit et oubliee aux autres.

**S2. Vitesse de deplacement non controlee.** Trois problemes cumulables dans le gestionnaire `move` (`server.js:2604`):
- `data.speedBoostActive` est cru sur parole: envoyer `true` en permanence donne un bonus de vitesse permanent (x1,7).
- `data.isMobile` est cru sur parole: l'envoyer donne le facteur mobile (x2). Cumule avec le precedent: x3,4.
- **Aucune limitation du debit de messages**: la vitesse etant appliquee par message recu, un client modifie qui emet 1 000 messages par seconde se deplace 50 fois plus vite qu'un joueur normal.

Le serveur normalise bien la norme du vecteur recu, ce qui bloque la triche la plus naive, mais pas celles-ci.

**S3. Usurpation d'identite dans le chat.** `chatMessage` diffuse le champ `nickname` fourni par le client sans le comparer a l'identite de la socket. N'importe qui peut ecrire sous le nom de n'importe qui.

**S4. Deni de service trivial.** Chaque message `move` declenche `detectCollisions`, qui parcourt tous les joueurs, tous les bots et tous les bots noirs. Un client qui inonde le serveur de `move` sature un coeur processeur. Aucune limitation de debit n'existe sur aucun evenement.

**S5. Dependances vulnerables.** `npm audit` remonte 12 vulnerabilites, dont 1 critique et 8 elevees, notamment sur `ws` via `socket.io-adapter`.

### Bugs confirmes dans le code

**X1. Fuite de minuteries, degradation progressive du jeu.** `spawnBonus` et `spawnMalus` se replanifient elles-memes via `setTimeout`. Elles sont demarrees au lancement du serveur, **et** a chaque `startGameFromRoom` (`server.js:2530`), **et** a chaque `resetAndStartGame` (`:2598`), **et** a chaque `resetGame` (`:1975`, appelee notamment quand le dernier joueur quitte). Aucun `clearTimeout` n'existe nulle part dans `server.js` (verifie: seuls deux `clearInterval` sur le compte a rebours). Chaque partie ajoute donc une chaine de minuteries parallele qui ne s'arrete jamais. Apres cinq parties, les bonus apparaissent environ cinq fois plus vite. **Cela explique la sensation que le jeu devient incoherent au fil des parties et redevient normal apres un redemarrage du serveur.**

**X2. Gestionnaire `joinRunningGame` declare deux fois.** Aux lignes 2082 et 2157. Socket.IO execute **les deux**. Rejoindre une partie en cours cree donc le joueur deux fois, calcule deux positions de spawn dont la premiere est jetee, perd la protection au spawn appliquee par la premiere version, et emet `gameStarting` deux fois.

**X3. `getValidPosition` plante sur son chemin de secours.** `server.js:252` utilise une variable `startTime` qui n'est jamais declaree. En module ES, c'est une `ReferenceError`. Ce chemin est atteint lorsque 100 tirages aleatoires de position echouent d'affilee, ce qui devient probable sur une carte tres encombree.

**X4. La distance de securite au spawn ne s'applique jamais.** `PositionManager` maintient une carte `entitiesPositions` pour empecher deux entites d'apparaitre l'une sur l'autre, mais `registerEntity`, `updateEntityPosition` et `removeEntity` ne sont **jamais appelees**. La carte reste vide, donc `SAFE_SPAWN_DISTANCE` (100 pixels) est lettre morte. Un joueur peut reapparaitre colle a un bot noir.

**X5. Les dimensions dynamiques de `GAME_CONFIG` ne fonctionnent pas.** Les accesseurs `GAME_CONFIG.WIDTH` et `HEIGHT` (`game-constants.js:22-30`) lisent une variable `waitingRoom` qui n'existe pas dans ce module. La condition `typeof waitingRoom !== 'undefined'` est toujours fausse, donc ils renvoient toujours 2000x1500, meme sur map3 qui fait 3000x2000. Utilises seulement dans `_findBackupPosition`, donc l'impact est limite, mais le mecanisme est trompeur.

**X6. La route `/test-maps` plante systematiquement.** `server.js:98` appelle `fs.existsSync` alors que `fs` n'est jamais importe.

**X7. Le message de depart dans le chat n'est jamais envoye.** Le gestionnaire `disconnect` supprime `players[socket.id]` a la ligne 2742, puis teste `if (players[socket.id])` a la ligne 2786. La condition est toujours fausse.

**X8. Contrat `updateWaitingRoom` incoherent.** Partout le serveur emet un objet `{ players, gameInProgress }`, sauf dans `rejoinWaitingRoom` (`server.js:2216`) ou il emet un tableau nu.

**X9. `MapManager.loadLayers` lit une variable serveur.** `public/js/MapManager.js:127` fait `waitingRoom.settings`, or `waitingRoom` n'existe que cote serveur. Cela leve une `ReferenceError` interceptee par le `catch` de la fonction, qui renvoie alors `false` en silence. La variable n'etant pas utilisee ensuite, l'effet reel depend du moment, mais le chargement des calques peut echouer silencieusement.

**X10. Code mort et pieges.** `handleGameStart` (`server.js:1980`) n'est jamais appelee et referencerait deux variables non declarees si elle l'etait. `Bot.unstuck` (`:1034`) n'est jamais appelee et appelle une methode `collisionMap.findValidSpawnPosition` qui n'existe pas.

### Poids et proprete du depot

**P1. 72 Mo d'audio dont l'essentiel est mort.** `game-music-1.wav` pese 44,8 Mo et `menu-music-1.wav` 13,9 Mo. **Ni l'un ni l'autre n'est reference par le code.** S'y ajoutent `game-music.mp3` (3,7 Mo) et une dizaine de fichiers `.wav` doublons de `.mp3` effectivement utilises, eux aussi non references.

**P2. Le depot Git pese 157 Mo** a cause de ces binaires versionnes. Chaque clone les telecharge.

**P3. Autres elements morts**: `public/assets/map/` (1,2 Mo, ancienne carte remplacee par `public/assets/maps/`), `public/assets/images/background.mp4` (581 Ko), `public/styles-neon-test.css` (1 574 lignes non chargees par `index.html`), le repertoire `server/` (7 fichiers, architecture modulaire inachevee jamais branchee: `package.json` demarre `server.js` a la racine), un repertoire vide nomme `-p` a la racine (residu d'un `mkdir -p` mal forme), des fichiers `.DS_Store` versionnes.

**P4. Aucun outillage.** Pas de linter, pas de formateur, pas de `.editorconfig`, pas d'integration continue. Le `package.json` ne contient qu'un script `start`. La version y est figee a 0.7.0 alors que le jeu affiche 0.8.5.

---

## 5. Historique: ce qui a deja ete tente

C'est le point le plus important pour ne pas repeter les memes erreurs.

Le depot contient huit branches. Trois racontent des tentatives de refonte abandonnees:

| Branche | Derniere activite | Contenu |
| --- | --- | --- |
| `refacto` | nov. 2024 | "refacto complete 1.0", arborescence `src/`, abandonnee |
| `team-mode` | nov. 2024 | Mode equipe, commit intitule "non fonctionnel" |
| `mode-strategique` | aout 2025 | Documentation d'architecture, premiers tests |
| `refactoring/modular-architecture` | aout 2025 | Refonte modulaire complete, 24 modules, tests, optimisations |
| `modular-architecture-broken` | 13 aout 2025 | Suite de la precedente, +149 000 lignes, **nom explicite** |

### La lecon a retenir

La branche `refactoring/modular-architecture` contient des documents qui declarent la refonte terminee et reussie. Extraits litteraux de `REFACTORING-STATUS.md` et `MIGRATION-COMPLETE.md`:

- "Refactoring Termine avec Succes"
- "Zero regression : Toutes fonctionnalites preservees"
- "Performance : +30-50% gain global"
- "Tests complets : Couverture > 80% avec benchmarks"
- "L'ancien serveur monolithique a ete officiellement decommissionne"

La suite de cette meme branche s'appelle `modular-architecture-broken`, et `master` n'a jamais integre une seule ligne de ce travail. Le monolithe pretendument decommissionne est toujours en production aujourd'hui.

**Autrement dit: la refonte precedente a echoue en se declarant reussie.** Les indicateurs de succes etaient auto-proclames dans des documents, jamais mesures contre le comportement reel du jeu. C'est exactement le risque que la regle "Tests d'abord" et les "tests de caracterisation" de CLAUDE.md cherchent a prevenir, et c'est vraisemblablement pourquoi cette regle y figure.

### Ce qui reste recuperable dans ces branches

A ne pas jeter sans examen:

- `tests/client/comprehensive-monolith.test.js`, `tests/server.test.js`, `tests/zones-tactical.test.js`, `tests/blackbot-shield-bug.test.js` et le reste de `tests/` sur `modular-architecture-broken`. Meme imparfaits, ce sont des descriptions ecrites du comportement attendu, matiere premiere pour des tests de caracterisation.
- `server/core/GameRoom.js` et `server/core/RoomManager.js`: une premiere modelisation du multi-parties, le blocage numero un.
- `server/game/TacticalMode.js`: la seule implementation existante du mode tactique.
- `RESUME-ANALYSE-COMPLETE.md`: un inventaire fonctionnel du client (95 fonctions, 30 evenements Socket.IO, 19 sons) avec une auto-evaluation par domaine plus honnete que les autres documents (audio a 30 pour cent, rendu a 72 pour cent, reseau a 75 pour cent).
- `ARCHITECTURE.md`, `FUNCTION.MD`, `SERVER-FUNCTION.MD`.

Ces documents doivent etre lus comme des **temoignages**, pas comme des references: leurs affirmations de succes sont dementies par les faits.

---

## 6. Ce qu'il faut preserver a tout prix

Le gameplay est regle depuis deux ans. Ce sont les comportements a couvrir par des tests de caracterisation avant toute modification:

1. **Le score est un stock, pas un cumul.** Se faire capturer remet a zero. C'est ce qui fait la tension de fin de partie.
2. **Une capture de joueur transfere tous ses bots d'un coup.** C'est le pic d'intensite du jeu.
3. **Un bot noir fait perdre 50 pour cent des points**, un bot noir detruit en rapporte 15.
4. **Un malus ramasse frappe les autres, pas soi.** Contre-intuitif, mais voulu.
5. **Les vitesses relatives**: joueur 3, bot 5, bot noir 6, bonus de vitesse x1,7, facteur mobile x2. Le journal des versions montre au moins quatre corrections successives sur ce seul reglage (0.7.12, 0.7.13, 0.7.14, plus deux commits dedies). C'est fragile et cela demande des tests.
6. **La protection de 3 secondes au spawn** et le delai de 1 seconde entre deux captures.
7. **Le compte a rebours de 5 secondes annulable jusqu'a 2 secondes.**
8. **La cinematique de transfert de propriete** du salon quand le proprietaire part.
9. **Les collisions derivees d'une image**, seuil de luminosite a 128. Le journal montre plusieurs series d'ajustements manuels des cartes: ce reglage est du contenu, pas du code.

Le journal des versions est d'ailleurs un indicateur de fragilite en soi: sur les 30 dernieres entrees, la grande majorite sont des corrections de regressions, souvent dans les memes zones (mode miroir, vitesse, audio, chat, invincibilite, persistance des malus d'une partie a l'autre). Chaque ajout casse quelque chose d'autre. C'est la signature d'un systeme sans filet de tests.

---

## 7. Synthese

Le jeu **fonctionne et est joue**. Ce n'est pas un echec technique, c'est un prototype qui a reussi et qui a atteint sa limite structurelle.

Trois blocages empechent d'aller plus loin:

1. **Une seule partie par serveur.** Verrouille les parties privees et publiques.
2. **Le rendu cadence par le reseau.** Verrouille la fluidite a 20 images par seconde.
3. **Aucun test.** Verrouille toute modification sure, et a deja fait echouer une refonte complete.

Trois risques immediats, independants de toute refonte:

1. **L'injection par le pseudonyme** touche tous les joueurs d'une partie.
2. **La vitesse non controlee** rend la triche triviale.
3. **La fuite de minuteries** degrade le jeu au fil des parties.

Et un prealable de methode: **CLAUDE.md decrit un projet qui n'existe pas.** Tant que la constitution et le depot ne parlent pas du meme projet, chaque session repartira sur de fausses bases. C'est le tout premier point a traiter, avant toute decision technique.
