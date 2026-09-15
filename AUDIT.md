# Audit — Neon Ninja

Portée : `server.js`, `public/client.js`, `public/js/`, `server/`, `game-constants.js`, assets, build.
Méthode : lecture intégrale du code exécuté, plus vérification dynamique. Le serveur a été démarré avec un stub `canvas` (voir §7) et sollicité par des clients `socket.io-client` scriptés. Les constats marqués **[reproduit]** ont été observés, pas déduits.

---

## 0. Sur la prémisse : il n'y a pas de réécriture à auditer

Deux chantiers de refonte existent dans le dépôt. Aucun des deux n'est branché sur ce qui tourne.

**`server/` (595 lignes) — squelette mort.**

- Ne démarre pas : `import { v4 as uuidv4 } from 'uuid'` dans `GameManager.js` et `RoomManager.js`, `uuid` n'est pas dans `package.json`. **[reproduit]** `ERR_MODULE_NOT_FOUND`.
- Quatre méthodes sont appelées sans exister : `RoomManager.handleChatMessage`, `RoomManager.handleDisconnect` (`server/server.js:93,100`), `Game.handlePlayerMove`, `Game.togglePause` (`GameManager.js:147,158`).
- `RoomManager.handleJoinWaitingRoom` crée une room neuve à chaque joueur (`RoomManager.js:22`). Chaque joueur est donc seul dans sa room et toujours propriétaire. Le multijoueur est structurellement impossible.
- Couverture : 5 événements socket contre 19 dans `server.js`. Pas de carte de collision, pas de bots, pas de bonus/malus, pas de zones, pas de score, pas de déplacement, pas de pause, pas de fin de partie. `Game.js` place les joueurs par `Math.random() * 1900` sans collision et diffuse un état vide à 20 FPS.
- `server/utils/constants.js` est une troisième copie des constantes, **divergente** : `initialBotCount` 30 au lieu de 50, `PLAYER_BASE_SPEED` 5 au lieu de 3, `BOT_SPEED` 2 au lieu de 5, `SPEED_BOOST_MULTIPLIER` 1.5 au lieu de 1.7.
- `server/server.js:86` : un `setInterval` par socket connecté, jamais nettoyé à la déconnexion.

**`public/js/` (900 lignes) — extraction partielle réelle.**

`AudioManager`, `MapManager` et `game-constants` sont bien sortis de `client.js` et réellement utilisés. C'est le seul morceau de refonte vivant. Il reste 4378 lignes dans `client.js`.

**Conclusion.** Le code en production est `server.js` (2812 l.) + `client.js` (4378 l.). L'audit porte donc sur ce code. Recommandation immédiate : `git rm -r server/`. Il ne sert à rien, il induit en erreur (`nodemon.json` le surveille), et il coûte plus cher à réconcilier qu'à réécrire quand le moment viendra.

---

## 1. Bloquants critiques

### 1.1 N'importe qui peut tuer le serveur avec un événement vide **[reproduit]**

`server.js:2452`

```js
socket.on('startGameFromRoom', (data) => {
    const mapDimensions = MAP_DIMENSIONS[data.settings.selectedMap || 'map1'];
    ...
    const player = waitingRoom.players.get(socket.id);
    if (player?.isOwner) {
```

La lecture de `data.settings` précède le contrôle de propriété. Un client non propriétaire qui émet `startGameFromRoom` sans payload provoque `TypeError: Cannot read properties of undefined (reading 'settings')`, non capturé, qui termine le process.

Observé : deux clients connectés, le second (non propriétaire) émet l'événement nu, le process sort. Comme l'état de jeu est un singleton global (§3.1), c'est tout le serveur et toutes les parties qui tombent, à partir d'une simple page ouverte.

Accessoirement, `data.settings` n'est jamais utilisé ensuite : `currentGameSettings = { ...waitingRoom.settings }` (l.2513). Les trois premières lignes du handler, y compris `gameWidth` et `gameHeight`, sont mortes. Le vecteur de crash est purement gratuit.

### 1.2 Du code client collé dans le serveur **[reproduit]**

`server.js:2288` et `2311`, handler `resetAndReturnToWaitingRoom` :

```js
activeBonusesContainer.innerHTML = '';
playerListContainer.innerHTML = '';
collectedBonusDisplay.classList.add('hidden');
...
document.body.classList.remove('reverse-controls', 'blur-vision', 'negative-vision');
if (canvas.style.filter) { canvas.style.filter = 'none'; }
```

`ReferenceError: activeBonusesContainer is not defined`, process terminé. Réservé au propriétaire, donc moins grave que 1.1, mais c'est la même classe de défaut.

Le client n'émet jamais `resetAndReturnToWaitingRoom` ni `resetAndStartGame` : ces deux handlers sont du code mort qui ne sert que de surface d'attaque.

### 1.3 Aucun garde-fou sur les déplacements **[reproduit]**

`server.js:2604`. Le serveur applique un déplacement fixe par événement `move` reçu, sans horodatage, sans limite de fréquence, sans vérification de cohérence. Pire, il fait confiance à deux champs envoyés par le client :

```js
const speedMultiplier = data.speedBoostActive ? SPEED_CONFIG.SPEED_BOOST_MULTIPLIER : 1;
const mobileFactor   = data.isMobile ? SPEED_CONFIG.MOBILE_SPEED_FACTOR : 1;
```

Le serveur ne consulte jamais `player.speedBoostActive`, qu'il maintient pourtant. Un client peut donc déclarer en permanence `speedBoostActive: true, isMobile: true` (×3,4) et émettre à la fréquence qu'il veut.

Observé : 200 événements `move` émis dans le même tick déplacent le joueur de **949 px instantanément**. Un joueur légitime au clavier fait ~150 px/s.

Conséquence structurelle au-delà de la triche : la vitesse réelle dépend de la cadence d'émission du client. Le mobile émet toutes les 16 ms avec un facteur ×2, le desktop toutes les 20 ms sans facteur. Les deux ne jouent pas au même jeu.

### 1.4 XSS stocké via le pseudo, sur tous les joueurs **[reproduit]**

Le pseudo n'est validé nulle part côté serveur (`server.js:2039`, `joinWaitingRoom` prend la chaîne brute ; le `maxlength="20"` de `index.html:58` est cosmétique). Il ressort dans `playerScores[].nickname`, puis :

`client.js:3948` et `3981`, dans la modale de fin de partie :

```js
<div class="player-name">${player.nickname}</div>
...
scrollableContent.innerHTML = podiumHTML + statsSection;
```

Observé : le serveur accepte et rediffuse `<img src=x onerror="alert(document.domain)">` tel quel. À chaque fin de partie, chez chaque joueur.

Le chat, lui, est correct (`ChatManager.createMessageElement` utilise `textContent`). `showCaptureModal` (l.4222) a le même défaut mais n'est jamais appelée.

### 1.5 Les réglages de partie ne sont pas bornés **[reproduit]**

`server.js:2340`, `updateGameSettings` fusionne le payload du propriétaire sans aucune validation de type ni de plage. Observé : `initialBotCount: 20000` fige le serveur plus de 35 secondes (chaque bot déclenche jusqu'à 100 tentatives de spawn, chacune vérifiant 17 points de collision).

### 1.6 Aucun filet

Pas de `try/catch` dans les handlers, pas de `process.on('uncaughtException')`, pas de `unhandledRejection`. Toute exception dans n'importe quel handler termine le process et toutes les parties. Les cinq points précédents ne seraient que des bugs sans cette absence.

---

## 2. Bugs fonctionnels

### 2.1 Réglages exposés et ignorés

| Réglage | Situation |
|---|---|
| `blackBotStartPercent` | Jamais lu. `spawnBlackBots` (l.1337) code en dur `gameDuration / 2`. |
| `blackBotSpeed` | Jamais lu. `BlackBot.baseSpeed = GAME_CONFIG.BOT_SPEED` (l.1145). |
| `blackBotDetectionRadius` | `BlackBot` utilise `DEFAULT_GAME_SETTINGS` (l.1140), mais le cercle envoyé au client utilise `currentGameSettings` (l.1857). **Le rayon affiché peut différer du rayon réel.** |
| `pointsLossPercent` | `DEFAULT_GAME_SETTINGS` au lieu de `currentGameSettings` (l.1270). |

### 2.2 Le timer d'invincibilité serveur n'atteint jamais le client

`updatePlayerBonuses` désactive l'invincibilité et émet `bonusDeactivated` (l.638). Le client écoute `bonusExpired` (`client.js:1629`). **Les deux noms ne correspondent pas.** Le client continue d'afficher l'invincibilité et de jouer le son en boucle alors que le serveur ne la reconnaît plus. C'est très probablement l'origine des bugs d'invincibilité corrigés à répétition dans le CHANGELOG (0.7.12, 0.7.16).

`speed` et `reveal` n'ont de toute façon aucune expiration serveur : seul le client les décompte.

### 2.3 Autres désaccords de protocole

- Le client émet `startGame` (`client.js:2453`) — aucun handler serveur.
- Le serveur émet `gameInProgress`, `error`, `playerStatusUpdate`, `audioSettingsUpdated` — aucun écouteur client. Les erreurs serveur sont donc silencieuses, et rejoindre une partie en cours n'est jamais proposé.
- Le serveur écoute `updateAudioSettings` — jamais émis. Il stocke un `player.audioSettings` toujours vide.
- `updateWaitingRoom` a **deux formes** : `{players, gameInProgress}` partout, mais un tableau nu dans `rejoinWaitingRoom` (l.2221). `updateWaitingRoomPlayers` gère les deux en forçant `gameInProgress = false` dans le cas tableau — donc après un retour en salle d'attente, le client croit toujours qu'aucune partie n'est en cours.

### 2.4 Handler `joinRunningGame` enregistré deux fois

`server.js:2082` et `2157`. Les deux s'exécutent. Le second écrase le `Player` créé par le premier et le fait respawn, invalidant la position sûre calculée juste avant.

### 2.5 Chaînes de spawn cumulatives

`spawnBonus` et `spawnMalus` se replanifient elles-mêmes (l.1611, l.673). Elles sont amorcées au démarrage du process (l.2806-2808), puis **à nouveau** à chaque `startGameFromRoom` (l.2530), `resetAndStartGame` (l.2598) et `resetGame` (l.1975), sans jamais annuler la précédente. Deux chaînes concurrentes tournent dès la première partie ; chaque relance sans fin de partie intermédiaire en ajoute une. Le taux d'apparition réel n'a plus de rapport avec `bonusSpawnInterval`.

### 2.6 Le glissement le long des murs est inaccessible au clavier

`client.js:2224` : `movePlayer` n'émet `move` que si `mapManager.canMove` accepte le vecteur complet. Le serveur possède pourtant un repli par axe séparé puis par angles (l.2645-2680), qui n'est jamais atteint depuis le clavier. En diagonale contre un mur, le joueur se bloque net.

S'y ajoute un désaccord de vitesse : `BASE_SPEED = 3.5` côté client (`client.js:123`) contre `PLAYER_BASE_SPEED: 3` côté serveur. La prédiction client est structurellement décalée de 17 %.

Les deux implémentations de collision divergent aussi : le serveur teste le centre plus deux cercles concentriques (8+8 points), le client seulement 8 points sur un cercle (`MapManager.canMove`).

### 2.7 Divers

- `PositionManager.getValidPosition` (l.252) référence `startTime`, jamais déclaré. En module ES (mode strict), `ReferenceError` dès que les 100 tentatives échouent — c'est-à-dire précisément dans le cas déjà dégradé.
- `registerEntity` / `updateEntityPosition` / `removeEntity` ne sont **jamais appelés**. `entitiesPositions` reste vide, donc la distance minimale `SAFE_SPAWN_DISTANCE` entre entités n'est jamais vérifiée. Tout le mécanisme est décoratif.
- `Entity` calcule une position de spawn, puis `Player`, `Bot` et `BlackBot` en recalculent une immédiatement dans leur propre constructeur. Chaque entité paie deux fois le coût (jusqu'à 200 tentatives).
- `Bot.unstuck` (l.1062) appelle `collisionMap.findValidSpawnPosition()`, méthode inexistante. Fonction morte, donc latente.
- `handleGameStart` (l.1986) assigne `currentMapWidth` / `currentMapHeight`, variables non déclarées — `ReferenceError` en mode strict. Fonction morte, donc latente.
- `BlackBot.pursueTarget` (l.1216) ignore la carte de collision : les bots noirs traversent les murs.
- `detectCollisions` : la branche `entity.type === 'player' && player.type === 'bot'` (l.1668) est morte, on itère sur `players`. Et les bots se recolorent entre eux (l.1685), ce qui propage les couleurs de proche en proche sans que ce soit documenté nulle part.
- `server.js:98` : la route `/test-maps` appelle `fs.existsSync` alors que `fs` n'est jamais importé — 500 systématique.
- `server.js:76` : `express.static(path.join(__dirname, 'assets'))` pointe un dossier qui n'existe pas.
- `disconnect` (l.2765) supprime `players[socket.id]` avant de tester `if (players[socket.id])` pour annoncer le départ dans le chat. Le message n'est jamais envoyé.
- `game-over-music.wav` est référencé par `AudioManager.js:58` mais absent du dépôt. Comme le chargement passe par un `Promise.all`, **un seul fichier manquant fait échouer tout le préchargement audio** et laisse `isLoaded` à `false`.

---

## 3. Architecture

### 3.1 État global unique

`players`, `bots`, `blackBots`, `bonuses`, `specialZones`, `waitingRoom`, `isPaused`, `gameStartTime` sont des variables de module. Il y a **une seule partie pour tout le processus** : tous les visiteurs du site atterrissent dans la même salle d'attente et la même partie. C'est la contrainte qui rend tout le reste fragile — un crash, une triche ou un réglage absurde affectent tout le monde.

C'est aussi ce que `server/` tentait manifestement de corriger avec `RoomManager` / `GameManager`. L'intention était la bonne.

### 3.2 Deux sources de vérité pour les réglages

`waitingRoom.settings` (édité par le propriétaire) et `currentGameSettings` (copié au lancement) coexistent, et sont lus indifféremment selon les endroits, avec en plus `DEFAULT_GAME_SETTINGS` utilisé directement à quatre endroits (§2.1). C'est la cause directe des réglages ignorés.

### 3.3 Constantes en triple

`game-constants.js` (racine) et `public/js/game-constants.js` sont **identiques sur les 34 clés communes** : duplication pure, aucune divergence pour l'instant, mais rien ne l'empêche. `server/utils/constants.js` est une troisième copie déjà divergente (§0).

La racine sert au serveur, `public/js/` au client. Le seul obstacle au partage est qu'`express.static` ne sert que `public/`. Une ligne de configuration résout le problème.

### 3.4 Frontières client/serveur poreuses

Du code serveur dans le client : `checkGameEndConditions` (`client.js:1557`) manipule `waitingRoom` et `io`. Du code client dans le serveur : §1.2.

Cas particulier à connaître : `client.js` et `MapManager.js` référencent une variable `waitingRoom` qui n'est déclarée nulle part. Ça ne plante pas, parce que `<div id="waitingRoom">` crée `window.waitingRoom` par accès nommé du DOM. `waitingRoom.settings` vaut donc `undefined`, ce qui passe silencieusement dans un spread (`client.js:1118`) et dans un `||` (`MapManager.js:127`). Le code fonctionne par accident.

### 3.5 Diffusion

`sendUpdates` (l.1908) fait `for (let socketId in activeSockets) socket.emit(...)`, ce qui sérialise le payload une fois par destinataire. `io.emit` sérialiserait une fois pour tous.

---

## 4. Performance et ressources

### 4.1 Cartes de collision en tableaux de booléens — mesuré

`CollisionMap.initialize` (serveur) et `MapManager.initializeCollisionData` (client) construisent un `Array` d'`Array` de booléens, un par pixel.

| | map1 (2000×1500) | map3 (3000×2000) |
|---|---|---|
| Implémentation actuelle | **23,0 Mo** | **46,5 Mo** |
| `Uint8Array` | 2,9 Mo | 5,7 Mo |
| Bitset | 0,36 Mo | **0,72 Mo** |

Mesuré sur Node 22. Facteur 65 par rapport à un bitset, payé côté serveur **et** dans chaque onglet client. Sur une instance Render gratuite (512 Mo), map3 seule consomme 9 % de la RAM en pure représentation de collision.

### 4.2 Mode debug actif en production

`client.js:276, 1681, 1872, 2466` : `mapManager` est instancié quatre fois avec `debugMode: true, debugCollisions: true`. Dans `MapManager.draw`, cela déclenche **à chaque frame** un `drawImage` du calque de collision avec `globalAlpha = 0` (travail pur perte) plus un balayage 32×32 de toute la carte : ~2 900 appels `checkCollision` par frame sur map1, ~5 800 sur map3. À 50 FPS, entre 145 000 et 290 000 accès par seconde, pour dessiner des points de debug.

C'est le premier correctif à appliquer : quatre booléens.

### 4.3 Cache de sprites non borné

`SpriteManager.getColoredSprite` (`client.js:617`) met en cache un canvas par clé `direction-couleur-frame`, sans limite ni éviction. Or le serveur donne aux bots des couleurs hexadécimales **aléatoires** (`Entity` → `getRandomColor`, 16,7 M de valeurs possibles). Avec 50 bots × 9 directions × 2 frames, jusqu'à 900 canvas hors écran par partie, chacun créé par une boucle pixel à pixel synchrone (`getImageData` / `putImageData`) exécutée dans la boucle de rendu — d'où des à-coups à chaque nouvelle couleur.

Deux corrections indépendantes : borner le cache (LRU), et faire tirer les couleurs de bots dans la palette `availableColors` plutôt qu'au hasard.

Note connexe : `COLOR_TOLERANCE = 140` sur une cible `(255,0,0)` recolore tout pixel ayant `r ≥ 115`, `g ≤ 140`, `b ≤ 140`. C'est très permissif et déborde probablement largement de la zone rouge voulue.

### 4.4 Réseau — mesuré

Réglages par défaut, 50 bots, 1 joueur : **7,9 Ko par tick, 20 ticks/s, 157 Ko/s par joueur**. À 8 joueurs, ~1,25 Mo/s en sortie.

L'état complet est renvoyé à chaque tick : aucun delta, aucun culling par champ de vision, coordonnées en flottants pleine précision, `blinkState` (opacité et échelle) recalculé côté serveur et transmis alors que le client peut le dériver de `timeLeft`.

### 4.5 Rendu sans culling

`drawEntities` dessine toutes les entités, y compris hors écran. Avec 50 bots sur une carte 3000×2000 et une caméra qui en montre une fraction, la majorité du travail est jetée.

### 4.6 Divers

- `setInterval(updateNeonColors, 3000)` (`client.js:698`) s'exécute au chargement du module et ne s'arrête jamais, y compris en pleine partie. Il écrit deux variables CSS, ce qui invalide le style de tout ce qui en dépend.
- `MapManager` charge les trois calques **deux fois** : `this.mapImages` est rempli dans le constructeur (l.111-113) puis `this.layers` dans `loadLayers` (l.140-142). `mapImages` ne sert qu'à `preloadMapImages`. Trois requêtes réseau en double, dont `collision.png`.
- `playSound('botConvert')` (`AudioManager.js:123`) construit un nouvel objet `Audio` à chaque conversion de bot, sans réutilisation ni plafond.

---

## 5. Fuites et cycle de vie

- `ChatManager.cleanup` (`client.js:3014`) appelle `removeEventListener(..., this.handleToggle.bind(this))`. `bind` produit une fonction neuve à chaque appel : **aucun écouteur n'est jamais retiré**. Comme `initialize` remet `initialized = false` puis en rajoute, les écouteurs s'accumulent à chaque reconnexion (messages envoyés en double, toggle qui s'annule).
- `initializeWaitingRoomTabs` (`client.js:1966`) ajoute un `click` anonyme et un `addButtonClickSound` par bouton à chaque appel, sans retrait. `returnToWaitingRoom` l'appelle **deux fois** (immédiatement puis après 100 ms). Les gestionnaires et les sons de clic s'empilent aller-retour après aller-retour.
- `startGameFromRoom` enregistre `socket.on('cancelGameStart')` à l'intérieur du handler. Le `removeAllListeners` en tête limite les dégâts, mais le motif est fragile.
- `server/server.js:86` : un `setInterval` par socket, jamais nettoyé (module mort, mais à ne pas reproduire).

---

## 6. Code mort et poids du dépôt

**Fonctions jamais appelées** — serveur : `calculatePlayerPoints`, `handleGameStart`, `testNewSpawnSystem`, `unstuck`, `validateMove`, `validatePosition`, `registerEntity`, `updateEntityPosition`, `removeEntity`. Client : `addTemporaryEffect`, `checkGameEndConditions`, `drawBonusEffects`, `handleBonusCollection`, `preloadGameResources`, `restartGame`, `showCaptureModal`, `switchTab`, `updateGameDimensions`, `updateMapButtonState`.

`client.js:219` : `additionalStyles` est un template CSS jamais injecté dans le DOM.

**Assets orphelins — 65 Mo**, jamais référencés :

| Fichier | Taille |
|---|---|
| `audio/game-music-1.wav` | 45 Mo |
| `audio/menu-music-1.wav` | 14 Mo |
| `audio/game-music.mp3` | 3,7 Mo |
| `audio/invincibility-active.wav`, `reveal-active.wav`, `speed-active.wav` | 668 Ko × 3 |
| `audio/bot-convert.wav`, `button-click-2.wav`, `urgent-tick.wav` | ~460 Ko |
| `audio/bot-convert-old.mp3`, `chat-message.mp3` | 40 Ko |
| `assets/map/` (dossier au singulier, remplacé par `maps/`) | 1,2 Mo |
| `images/background-home-old.jpg` | — |

Total `public/assets/audio` : 72 Mo, dont 65 inutiles.

`public/styles-neon-test.css` : 1574 lignes, référencé nulle part.

Sept `.DS_Store` versionnés. `.gitignore` ne contient que `node_modules/` et `.env`.

Ces fichiers restent dans l'historique git même après suppression : le clone restera lourd sans réécriture d'historique. À arbitrer.

---

## 7. Build et déploiement

**`npm install` échoue sur Node moderne. [reproduit]**

`canvas@^2.11.2` n'a pas de binaire précompilé pour Node 22 ni 23 et retombe sur une compilation `node-gyp`, qui échoue ici. Or `.node-version` demande **Node 23**. La combinaison déclarée dans le dépôt ne s'installe pas. Pour un projet dont le README invite explicitement à forker, c'est le premier mur.

Options : `canvas@^3` (binaires à jour), ou se passer complètement de `canvas` — il ne sert qu'à lire les pixels de `collision.png` au démarrage, ce que `sharp` ou un décodeur PNG en pur JS fait sans dépendance native. La seconde option est la plus robuste.

**Autres points**

- `package.json` : `"version": "0.7.0"`, alors que `client.js` affiche `v0.8.6` et que le CHANGELOG en est à 0.8.6.
- Aucun linter, aucun formateur, aucun test, aucune CI.
- Aucun script `dev` alors que `nodemon.json` existe (et surveille `server/`, qui est mort).
- `nodemon` n'est pas dans les dépendances.
- Aucune compression HTTP, aucun cache-control sur les assets statiques.

---

## 8. Ce qui est correct

Pour l'équilibre, et parce que ça oriente la suite :

- La séparation calques background / collision / foreground avec collision par pixel est une bonne idée, simple et efficace.
- `AudioManager` et `MapManager` sont des modules propres, avec une interface claire. C'est le bon modèle à reproduire.
- Le chat échappe correctement (`textContent`).
- Le serveur est autoritaire sur les positions, les captures et les scores. La base est saine, il manque la validation des entrées.
- Le transfert de propriété de la salle à la déconnexion est géré partout.
- Le CHANGELOG est tenu sérieusement.

---

## 9. Plan d'action

**Immédiat, quelques lignes chacun**

1. `server.js:2452` — déplacer la lecture de `data.settings` après le contrôle `isOwner`, ou simplement supprimer ces trois lignes inutilisées. Supprime le crash non authentifié.
2. `server.js:2288` — supprimer les handlers `resetAndReturnToWaitingRoom` et `resetAndStartGame` : le client ne les émet pas.
3. Ajouter `process.on('uncaughtException')` et `process.on('unhandledRejection')` avec journalisation, plus un `try/catch` par handler socket.
4. `client.js:276, 1681, 1872, 2466` — `debugMode: false, debugCollisions: false`.
5. `client.js:3948, 3981` — échapper `player.nickname`, et valider le pseudo côté serveur (longueur, jeu de caractères).
6. Renommer `bonusDeactivated` en `bonusExpired` côté serveur (ou l'inverse côté client).
7. `git rm -r server/`, `git rm public/styles-neon-test.css`, `git rm` les `.DS_Store`, ajouter `.DS_Store` au `.gitignore`.

**Court terme**

8. Valider et borner les réglages dans `updateGameSettings` (types, plages, liste blanche de clés).
9. Limiter la fréquence des `move` côté serveur et ignorer `speedBoostActive` / `isMobile` du client : lire `player.speedBoostActive`. Idéalement, passer à un déplacement intégré au temps (`dt`) plutôt que par événement.
10. Annuler les chaînes `spawnBonus` / `spawnMalus` avant d'en relancer une (garder le handle `setTimeout`).
11. Remplacer `DEFAULT_GAME_SETTINGS` par `currentGameSettings` aux lignes 1140, 1145, 1270, et câbler `blackBotStartPercent` dans `spawnBlackBots`.
12. Aligner `BASE_SPEED` client sur le serveur et faire émettre `move` même en cas de collision, pour que le repli serveur serve à quelque chose.
13. Supprimer les 65 Mo d'audio orphelin et `assets/map/`.
14. `canvas@^3` ou suppression de la dépendance ; aligner `.node-version` ; corriger la version dans `package.json`.

**Fond**

15. Collision en `Uint8Array` ou bitset, partagée par une seule implémentation entre client et serveur. Gain mesuré : 46,5 Mo → 0,72 Mo sur map3.
16. Une seule source de constantes, servie aux deux côtés (ajouter un `express.static` sur le dossier partagé).
17. Encapsuler l'état global dans une classe `Game` instanciable, puis un `RoomManager` au-dessus. C'est le but qu'avait `server/` — mais à faire par extraction incrémentale depuis `server.js`, en gardant le jeu jouable à chaque étape, pas en repartant d'une page blanche à côté.
18. Culling par champ de vision et deltas dans `sendUpdates` : les 157 Ko/s par joueur sont réductibles d'un ordre de grandeur.
19. Borner le cache de sprites et tirer les couleurs de bots dans la palette fixe.
20. Corriger les retraits d'écouteurs (`bind` stocké) dans `ChatManager` et `initializeWaitingRoomTabs`.
21. Poursuivre l'extraction de `client.js` sur le modèle de `MapManager` : `UIManager`, `NetworkManager`, `InputManager`, `Renderer`.

---

## Annexe — reproduction

```bash
# canvas ne compile pas sur Node 22/23
npm install

# les tests dynamiques ont utilisé un stub canvas (createCanvas/loadImage)
# renvoyant une image blanche, puis des clients socket.io-client scriptés :
#   - startGameFromRoom sans payload, depuis un non-propriétaire  -> process terminé
#   - resetAndReturnToWaitingRoom depuis le propriétaire          -> process terminé
#   - 200 move en rafale avec speedBoostActive+isMobile           -> 949 px de téléportation
#   - updateGameSettings { initialBotCount: 20000 }               -> serveur figé > 35 s
#   - joinWaitingRoom('<img src=x onerror=...>')                  -> renvoyé brut dans playerScores

# le serveur réécrit ne démarre pas
node server/server.js   # ERR_MODULE_NOT_FOUND: 'uuid'
```
