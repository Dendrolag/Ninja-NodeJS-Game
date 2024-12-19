/**
 * Neon Ninja - Serveur de jeu
 * 
 * Architecture générale du serveur :
 * 
 * 1. Configuration et imports
 *    - Express et Socket.IO pour la communication temps réel
 *    - Configuration des fichiers statiques et des routes
 * 
 * 2. Configuration du jeu 
 *    - Dimensions de la zone de jeu (GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)
 *    - Paramètres par défaut (DEFAULT_GAME_SETTINGS)
 *    - Types de bonus et malus
 *    - Configuration des zones spéciales
 * 
 * 3. Gestion des collisions et du terrain
 *    - Classe CollisionMap : gère la carte des collisions
 *    - Détection des collisions entre entités et avec le terrain
 * 
 * 4. Classes principales
 *    - Entity : classe de base pour tous les éléments du jeu
 *    - Player : gestion des joueurs (mouvements, captures, bonus)
 *    - Bot : IA des bots standards (mouvements, comportements)
 *    - BlackBot : IA spéciale pour les bots noirs (poursuite, capture)
 *    - Bonus/Malus : gestion des power-ups et handicaps
 * 
 * 5. Salle d'attente
 *    - Liste des joueurs connectés
 *    - Attribution des rôles (propriétaire)
 *    - Gestion des paramètres de partie
 * 
 * 6. Gestion de partie
 *    - Démarrage/fin de partie
 *    - Spawn des entités
 *    - Mise à jour des états (positions, scores)
 *    - Gestion des zones spéciales
 * 
 * 7. Communications Socket.IO
 *    - Connexion/déconnexion des joueurs
 *    - Synchronisation des états de jeu
 *    - Chat et notifications
 */

// Configuration initiale du serveur et des middlewares
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

// Import des configurations
import { 
    GAME_CONFIG, 
    DIRECTIONS, 
    DEFAULT_GAME_SETTINGS, 
    SPAWN_CONFIG,
    TIME_CONFIG,
    SPEED_CONFIG,
    MAP_DIMENSIONS 
} from './game-constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

/**
 * Configuration des fichiers statiques
 * - /assets : dossier des ressources (images, sons, etc.)
 * - /public : fichiers publics (HTML, CSS, JS client)
 */
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets/maps', express.static(path.join(__dirname, 'public', 'assets', 'maps')));

app.use((req, res, next) => {
    if (req.url.endsWith('.js')) {
        res.type('application/javascript');
    }
    next();
});

// Route de test pour vérifier la présence des maps
app.get('/test-maps', (req, res) => {
    const mapsBasePath = path.join(__dirname, 'public', 'assets', 'maps');
    const maps = ['map1']; // Liste des maps disponibles
    
    const mapStatus = maps.map(mapName => {
        const normalPath = path.join(mapsBasePath, mapName, 'normal', 'collision.png');
        const mirrorPath = path.join(mapsBasePath, mapName, 'mirror', 'collision.png');
        
        return {
            map: mapName,
            normal: fs.existsSync(normalPath),
            mirror: fs.existsSync(mirrorPath)
        };
    });

    res.json({
        mapsBasePath,
        status: mapStatus
    });
});

// =========================================================================
// CONFIGURATION SERVEUR
// =========================================================================
const PORT = process.env.PORT || 3000;

// =========================================================================
// ÉTATS GLOBAUX DU JEU
// =========================================================================

/**
 * État général de la partie
 */
let gameStartTime = Date.now();           // Horodatage du début de partie
let isPaused = false;                     // État de pause
let isGameOver = false;                   // État de fin de partie
let pauseStartTime = null;                // Horodatage de la mise en pause
let totalPauseDuration = 0;              // Durée totale des pauses
let pausedBy = null;                      // ID du joueur qui a mis en pause
let startCountdown = null;                // Timer du compte à rebours de départ

/**
 * Collections d'entités du jeu
 */
let players = {};                         // Joueurs connectés
let bots = {};                           // Bots standards
let blackBots = {};                      // Bots noirs spéciaux
let bonuses = [];                        // Bonus actifs
let malusItems = [];                     // Malus actifs
let botsInitialized = false;             // État d'initialisation des bots

/**
 * Zones spéciales et effets
 */
let specialZones = new Set();            // Zones spéciales actives
let zoneSpawnTimeout = null;             // Timer de spawn des zones
let activemalus = new Map();             // Malus actifs par joueur

/**
 * Gestion des connexions et du son
 */
const activeSockets = {};                // Sockets actifs des joueurs
const playerLastSoundEmit = new Map();   // Dernier son émis par joueur

// =========================================================================
// SALLE D'ATTENTE
// =========================================================================

/**
 * Configuration et état de la salle d'attente
 */
const waitingRoom = {
    players: new Map(),                  // Joueurs dans la salle
    isGameStarted: false,                // État de la partie
    settings: { ...DEFAULT_GAME_SETTINGS },  // Paramètres de la partie
    playersInGame: new Set()             // Joueurs actuellement en jeu
};

// =========================================================================
// CONSTANTES VISUELLES
// =========================================================================

/**
 * Couleurs disponibles pour les joueurs
 * Palette de couleurs vives et distinctes
 */
const availableColors = [
    '#FF0000',  // Rouge
    '#00FF00',  // Vert
    '#0000FF',  // Bleu
    '#FFFF00',  // Jaune
    '#FF00FF',  // Magenta
    '#00FFFF'   // Cyan
];

/**
 * Configuration des zones spéciales
 * Définit l'apparence et les propriétés de chaque type de zone
 */
const ZONE_TYPES = {
    CHAOS: {
        id: 'CHAOS',
        name: 'Zone de Chaos',
        color: 'rgba(255, 64, 64, 0.2)',      // Rouge transparent
        borderColor: 'rgba(255, 64, 64, 0.6)'  // Bordure rouge plus opaque
    },
    REPEL: {
        id: 'REPEL',
        name: 'Zone Répulsive',
        color: 'rgba(64, 64, 255, 0.2)',      // Bleu transparent
        borderColor: 'rgba(64, 64, 255, 0.6)'  // Bordure bleue plus opaque
    },
    ATTRACT: {
        id: 'ATTRACT',
        name: 'Zone Attractive',
        color: 'rgba(64, 255, 64, 0.2)',      // Vert transparent
        borderColor: 'rgba(64, 255, 64, 0.6)'  // Bordure verte plus opaque
    },
    STEALTH: {
        id: 'STEALTH',
        name: 'Zone d\'Invisibilité',
        color: 'rgba(128, 0, 128, 0.2)',      // Violet transparent
        borderColor: 'rgba(128, 0, 128, 0.6)'  // Bordure violette plus opaque
    }
};

/**
 * Gestionnaire centralisé des positions et mouvements dans le jeu
 * Gère la validation des positions, les collisions et les déplacements
 */
/**
 * Gestionnaire centralisé des positions et mouvements dans le jeu
 * Gère la validation des positions, les collisions et les déplacements
 */
class PositionManager {
    constructor(collisionMap) {
        this.collisionMap = collisionMap;
        this.entitiesPositions = new Map(); // Pour suivre les positions des entités
    }

    getValidPosition(radius = 16) {
        const currentMap = currentGameSettings.selectedMap || 'map1';
        const mapDimensions = MAP_DIMENSIONS[currentMap];
        const currentWidth = mapDimensions.width;
        const currentHeight = mapDimensions.height;
    
        const maxAttempts = SPAWN_CONFIG.MAX_ATTEMPTS;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            const x = GAME_CONFIG.SPAWN_MARGIN + 
                     Math.random() * (currentWidth - 2 * GAME_CONFIG.SPAWN_MARGIN);
            const y = GAME_CONFIG.SPAWN_MARGIN + 
                     Math.random() * (currentHeight - 2 * GAME_CONFIG.SPAWN_MARGIN);
            
            if (this.isValidPosition(x, y, radius)) {
                return { x, y };
            }
            attempts++;
        }
    
        // Si aucune position valide n'est trouvée, utiliser la position de backup
        const position = this._findBackupPosition(radius);
        const endTime = performance.now();
        console.log(`Position de backup générée en ${endTime - startTime}ms après ${maxAttempts} tentatives`);
        return position;
    }

    isValidPosition(x, y, radius = 16) {
        // Vérification des collisions avec le terrain
        if (!this.collisionMap.canMove(x, y, x, y, radius)) {
            return false;
        }

        // Vérification de la distance avec les autres entités
        for (const pos of this.entitiesPositions.values()) {
            const dx = x - pos.x;
            const dy = y - pos.y;
            if (Math.sqrt(dx * dx + dy * dy) < GAME_CONFIG.SAFE_SPAWN_DISTANCE) {
                return false;
            }
        }

        return true;
    }

    validateMove(fromX, fromY, toX, toY, radius = 16) {
        if (!this.collisionMap.canMove(fromX, fromY, toX, toY, radius)) {
            return false;
        }
    
        // Récupérer les dimensions actuelles de la map
        const currentMap = currentGameSettings.selectedMap || 'map1';
        const mapDimensions = MAP_DIMENSIONS[currentMap];
        const currentWidth = mapDimensions.width;
        const currentHeight = mapDimensions.height;
    
        // Vérification des limites avec les dimensions actuelles
        if (toX < 0 || toX > currentWidth || toY < 0 || toY > currentHeight) {
            return false;
        }
    
        return true;
    }

    registerEntity(id, x, y) {
        this.entitiesPositions.set(id, { x, y });
    }

    updateEntityPosition(id, x, y) {
        if (this.entitiesPositions.has(id)) {
            this.entitiesPositions.set(id, { x, y });
        }
    }

    removeEntity(id) {
        this.entitiesPositions.delete(id);
    }

    // Méthode interne, convention de nommage avec _ pour indiquer qu'elle est "privée"
    _findBackupPosition(radius) {
        const startX = GAME_CONFIG.WIDTH / 2;
        const startY = GAME_CONFIG.HEIGHT / 2;
        
        for (let r = 1; r < 20; r++) {
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
                const x = startX + Math.cos(angle) * (r * SPAWN_CONFIG.GRID_SIZE);
                const y = startY + Math.sin(angle) * (r * SPAWN_CONFIG.GRID_SIZE);
                
                if (this.isValidPosition(x, y, radius)) {
                    return { x, y };
                }
            }
        }
        
        return { x: startX, y: startY };
    }
}

class CollisionMap {
    constructor() {
        this.collisionData = null;
        this.initialize();
    }

    async initialize(mapId = 'map1', mirrorMode = false) {
        try {
            // Récupérer les dimensions spécifiques à la map
            const mapDimensions = MAP_DIMENSIONS[mapId];
            const mapWidth = mapDimensions.width;
            const mapHeight = mapDimensions.height;
    
            // Construction du chemin vers l'image de collision
            const collisionPath = path.join(__dirname, 'public', 'assets', 'maps', mapId, mirrorMode ? 'mirror' : 'normal', 'collision.png');
            
            console.log('Chargement de la carte de collision depuis:', collisionPath);
            console.log('Dimensions de la map:', { width: mapWidth, height: mapHeight });
            
            // Charger l'image de collision
            const originalImage = await loadImage(collisionPath);
            
            // Créer un canvas avec les dimensions spécifiques à la map
            const canvas = createCanvas(mapWidth, mapHeight);
            const ctx = canvas.getContext('2d');
            
            // Dessiner l'image avec les dimensions correctes
            ctx.drawImage(originalImage, 0, 0, mapWidth, mapHeight);
            
            // Obtenir les données de l'image pour l'analyse des collisions
            const imageData = ctx.getImageData(0, 0, mapWidth, mapHeight);
            
            // Initialiser le tableau de collision avec les bonnes dimensions
            this.collisionData = new Array(mapHeight);
            let collisionCount = 0;
            
            // Parcourir chaque pixel pour créer la carte de collision
            for (let y = 0; y < mapHeight; y++) {
                this.collisionData[y] = new Array(mapWidth);
                for (let x = 0; x < mapWidth; x++) {
                    const index = (y * mapWidth + x) * 4;
                    const r = imageData.data[index];
                    const g = imageData.data[index + 1];
                    const b = imageData.data[index + 2];
                    // Un pixel est considéré comme une collision si sa luminosité moyenne est < 128
                    const isCollision = (r + g + b) / 3 < 128;
                    this.collisionData[y][x] = isCollision;
                    if (isCollision) collisionCount++;
                }
            }
            
            console.log(`Carte de collision initialisée: ${collisionCount} points de collision`);
            console.log(`Dimensions finales de la collision: ${mapWidth}x${mapHeight}`);
            return true;
            
        } catch (error) {
            console.error('Erreur lors du chargement de la carte de collision:', error);
            this.initializeEmptyCollisionMap(mapId);
            return false;
        }
    }

    // Ajout d'une méthode pour mettre à jour les collisions
    async updateCollisions(mapId, mirrorMode) {
        return this.initialize(mapId, mirrorMode);
    }

    canMove(fromX, fromY, toX, toY, radius = 16) {
        // Vérifier d'abord le point central
        if (this.checkCollision(toX, toY)) {
            return false;
        }
    
        const mapDimensions = MAP_DIMENSIONS[currentGameSettings?.selectedMap || 'map1'];
        const currentWidth = mapDimensions.width;
        const currentHeight = mapDimensions.height;
    
        // Vérifier si le point est dans les limites de la map
        if (toX < 0 || toX > currentWidth || toY < 0 || toY > currentHeight) {
            return false;
        }
    
        // Vérifier plusieurs points autour de l'entité pour une meilleure précision
        const points = 8;  // Nombre de points à vérifier sur le périmètre
        const radiusInner = radius * 0.7;  // Rayon intérieur plus petit pour une détection progressive
        
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2;
            
            // Vérifier deux cercles concentriques pour une meilleure détection
            const checkX1 = toX + Math.cos(angle) * radius;
            const checkY1 = toY + Math.sin(angle) * radius;
            const checkX2 = toX + Math.cos(angle) * radiusInner;
            const checkY2 = toY + Math.sin(angle) * radiusInner;
            
            if (this.checkCollision(checkX1, checkY1) || this.checkCollision(checkX2, checkY2)) {
                return false;
            }
        }
    
        return true;
    }

    checkCollision(x, y) {
        if (!this.collisionData) return false;
    
        // Récupérer les dimensions de la map actuelle
        const mapDimensions = MAP_DIMENSIONS[currentGameSettings?.selectedMap || 'map1'];
        const currentWidth = mapDimensions.width;
        const currentHeight = mapDimensions.height;
    
        const pixelX = Math.floor(x);
        const pixelY = Math.floor(y);
    
        if (pixelX < 0 || pixelX >= currentWidth || pixelY < 0 || pixelY >= currentHeight) {
            return true;
        }
    
        if (!this.collisionData[pixelY] || typeof this.collisionData[pixelY][pixelX] === 'undefined') {
            return true;
        }
    
        return this.collisionData[pixelY][pixelX];
    }

    // Les autres méthodes restent les mêmes, juste mettre à jour les références aux constantes

    initializeEmptyCollisionMap(mapId = 'map1') {
        const mapDimensions = MAP_DIMENSIONS[mapId];
        const mapWidth = mapDimensions.width;
        const mapHeight = mapDimensions.height;
    
        console.warn(`Initialisation d'une carte de collision vide pour ${mapId} (${mapWidth}x${mapHeight})`);
        this.collisionData = new Array(mapHeight);
        for (let y = 0; y < mapHeight; y++) {
            this.collisionData[y] = new Array(mapWidth).fill(false);
        }
    }
}

// Fonction utilitaire pour obtenir les dimensions actuelles de la map
function getCurrentMapDimensions() {
    const currentMap = currentGameSettings?.selectedMap || 'map1';
    return MAP_DIMENSIONS[currentMap] || MAP_DIMENSIONS['map1'];
}

let currentGameSettings = { ...DEFAULT_GAME_SETTINGS };  // Initialisation avec les paramètres par défaut
const collisionMap = new CollisionMap();

// Après la création de collisionMap
const positionManager = new PositionManager(collisionMap);

// Fonction de test
function testNewSpawnSystem() {
    const position = positionManager.getValidPosition();
    console.log('Test nouvelle position:', position);
    return position;
}

// Classe pour gérer les zones
class SpecialZone {
    constructor() {
        this.type = this.getRandomType();
        this.duration = this.getRandomDuration();
        this.shape = this.generateRandomShape();
        this.createdAt = Date.now();
        this.id = `zone_${Date.now()}_${Math.random()}`;
    }

    getRandomType() {
        // Filtrer les types de zones activées
        const availableTypes = Object.entries(ZONE_TYPES)
            .filter(([id, _]) => currentGameSettings.enabledZones[id])
            .map(([_, type]) => type);
    
        if (availableTypes.length === 0) return null;
        return availableTypes[Math.floor(Math.random() * availableTypes.length)];
    }

    getRandomDuration() {
        return Math.floor(
            currentGameSettings.zoneMinDuration * 1000 + 
            Math.random() * (currentGameSettings.zoneMaxDuration - currentGameSettings.zoneMinDuration) * 1000
        );
    }

    generateRandomShape() {
        const { width: currentWidth, height: currentHeight } = getCurrentMapDimensions();
        
        // Calculer la taille maximale (1/5 de la zone de jeu)
        const maxArea = (currentWidth * currentHeight) / 5;
        
        // Calculer le rayon maximal à partir de l'aire
        const maxRadius = Math.sqrt(maxArea / Math.PI);
        
        // Générer un rayon aléatoire entre 150 et maxRadius
        const minRadius = 150;
        const radius = Math.random() * (maxRadius - minRadius) + minRadius;
        
        // Positionner le cercle en s'assurant qu'il reste dans les limites du jeu
        const x = radius + Math.random() * (currentWidth - 2 * radius);
        const y = radius + Math.random() * (currentHeight - 2 * radius);
        
        return {
            type: 'circle',
            x,
            y,
            radius
        };
    }

    isExpired() {
        return Date.now() - this.createdAt > this.duration;
    }

    isEntityInside(entity) {
        if (this.shape.type === 'circle') {
            const dx = entity.x - this.shape.x;
            const dy = entity.y - this.shape.y;
            return Math.sqrt(dx * dx + dy * dy) <= this.shape.radius;
        } else {
            return entity.x >= this.shape.x && 
                   entity.x <= this.shape.x + this.shape.width &&
                   entity.y >= this.shape.y && 
                   entity.y <= this.shape.y + this.shape.height;
        }
    }

    applyEffect(entity, entities) {
        switch(this.type.id) {
            case 'CHAOS':
                if (entity.type === 'bot' && Math.random() < 0.05) { // 5% de chance par frame
                    entity.color = getUniqueColor();
                }
                break;

                case 'REPEL':
                    if (entity.type === 'bot') {
                        // Ne faire l'effet de répulsion que si des joueurs sont dans la zone
                        let totalForceX = 0;
                        let totalForceY = 0;
                        const REPEL_STRENGTH = 4;
        
                        Object.values(entities)
                            .filter(e => e.type === 'player' && this.isEntityInside(e)) // Ne considérer que les joueurs dans la zone
                            .forEach(player => {
                                const dx = entity.x - player.x;
                                const dy = entity.y - player.y;
                                const distSq = dx * dx + dy * dy;
                                if (distSq > 0 && distSq < 200 * 200) { // Limiter la portée de l'effet
                                    const force = REPEL_STRENGTH / Math.sqrt(distSq);
                                    totalForceX += dx * force;
                                    totalForceY += dy * force;
                                }
                            });
        
                        if (totalForceX !== 0 || totalForceY !== 0) {
                            entity.x += Math.min(Math.max(totalForceX, -5), 5);
                            entity.y += Math.min(Math.max(totalForceY, -5), 5);
                        }
                    }
                    break;

            case 'ATTRACT':
                if (entity.type === 'bot') {
                    let nearestPlayer = null;
                    let minDist = Infinity;
                    const ATTRACT_STRENGTH = 3;

                    Object.values(entities)
                        .filter(e => e.type === 'player')
                        .forEach(player => {
                            const dx = player.x - entity.x;
                            const dy = player.y - entity.y;
                            const distSq = dx * dx + dy * dy;
                            if (distSq < minDist) {
                                minDist = distSq;
                                nearestPlayer = player;
                            }
                        });

                    if (nearestPlayer) {
                        const dx = nearestPlayer.x - entity.x;
                        const dy = nearestPlayer.y - entity.y;
                        const dist = Math.sqrt(minDist);
                        entity.x += (dx / dist) * ATTRACT_STRENGTH;
                        entity.y += (dy / dist) * ATTRACT_STRENGTH;
                    }
                }
                break;

            case 'STEALTH':
                if (entity.type === 'player') {
                    entity.isInvisible = true;
                }
                break;
        }
    }
}

function updatePlayerBonuses() {
    const now = Date.now();
    
    Object.values(players).forEach(player => {
        if (!player.bonusTimers) return;
        
        if (player.invincibilityActive && player.bonusTimers.invincibility > 0) {
            const timeElapsed = (now - player.bonusStartTime) / 1000;
            if (timeElapsed >= player.bonusTimers.invincibility) {
                player.invincibilityActive = false;
                player.bonusTimers.invincibility = 0;
                //console.log(`Invincibilité désactivée pour ${player.nickname} (timer serveur)`);
                
                // Notifier le client
                const socket = activeSockets[player.id];
                if (socket) {
                    socket.emit('bonusDeactivated', { type: 'invincibility' });
                }
            }
        }
    });
}

// Fonction de spawn des malus
function spawnMalus() {
    if (isPaused || isGameOver || !currentGameSettings.enableMalus) return;

    const availableMalus = [
        { type: 'reverse', enabled: currentGameSettings.enableReverseControls },
        { type: 'blur', enabled: currentGameSettings.enableBlurVision },
        { type: 'negative', enabled: currentGameSettings.enableNegativeVision }
    ].filter(m => m.enabled);

    // Ne rien faire s'il n'y a aucun malus activé
    if (availableMalus.length === 0) return;

    // Limiter le nombre de malus simultanés à 5
    if (malusItems.length < 5 && Math.random() * 100 < currentGameSettings.malusSpawnRate) {
        const selectedMalus = availableMalus[Math.floor(Math.random() * availableMalus.length)];
        malusItems.push(new Malus(selectedMalus.type));
    }

    // Planifier le prochain spawn
    const interval = currentGameSettings.malusSpawnInterval * 1000;
    const randomVariation = interval * 0.5;
    const nextSpawnTime = interval + (Math.random() * randomVariation - randomVariation / 2);
    setTimeout(spawnMalus, nextSpawnTime);
}

function clearMalusEffects() {
    // Vider la Map des malus actifs
    activemalus.clear();
    // Informer tous les clients de nettoyer leurs effets visuels
    io.emit('clearMalusEffects');
}

// Fonction de gestion de la collection des malus
function handleMalusCollection(player, malus) {
    console.log('handleMalusCollection appelé:', { 
        playerId: player.id, 
        malusType: malus.type 
    });

    const socket = activeSockets[player.id];
    if (!socket) {
        console.log('Socket non trouvé pour le joueur');
        return;
    }

    const malusDurations = {
        reverse: currentGameSettings.reverseControlsDuration,
        blur: currentGameSettings.blurDuration,
        negative: currentGameSettings.negativeDuration
    };

    const duration = malusDurations[malus.type];
    
    // Envoyer à tous les sockets connectés
    io.emit('malusEvent', {
        type: malus.type,
        duration: duration,
        collectorId: player.id, 
        collectorNickname: player.nickname
    });
    
    console.log('Événement malusEvent émis à tous les clients');

    // Notifier d'abord le collecteur
    console.log('Envoi de malusCollected au collecteur:', player.nickname);
    socket.emit('malusCollected', {
        type: malus.type,
        duration: malusDurations[malus.type]
    });

    // Ensuite appliquer le malus aux autres joueurs
    Object.entries(players).forEach(([playerId, targetPlayer]) => {
        if (playerId !== player.id) {
            const targetSocket = activeSockets[playerId];
            if (targetSocket) {
                //console.log('Envoi de applyMalus à:', targetPlayer.nickname);
                targetSocket.emit('applyMalus', {
                    type: malus.type,
                    duration: malusDurations[malus.type],
                    collectedBy: player.nickname
                });
            }
        }
    });
}

function handlePlayerCapture(attacker, victim) {
    // Vérifier l'invincibilité et la protection au spawn
    if (victim.invincibilityActive || victim.isInvulnerable() || !attacker.canCapture()) return;

    const attackerSocket = activeSockets[attacker.id];
    const victimSocket = activeSockets[victim.id];
    const victimColor = victim.color;

    // Compter les bots avant le transfert
    const botsToCapture = Object.values(bots).filter(bot => bot.color === victimColor).length;
    
    // Mettre à jour les statistiques de capture
    attacker.captures++;
    attacker.addCapturedBots(botsToCapture);

    // Enregistrer la capture dans l'historique
    if (!attacker.capturedPlayers[victim.id]) {
        attacker.capturedPlayers[victim.id] = {
            nickname: victim.nickname,
            count: 0
        };
    }
    attacker.capturedPlayers[victim.id].count++;

    if (!victim.capturedBy[attacker.id]) {
        victim.capturedBy[attacker.id] = {
            nickname: attacker.nickname,
            count: 0
        };
    }
    victim.capturedBy[attacker.id].count++;

    // Transférer les bots
    Object.values(bots).forEach(bot => {
        if (bot.color === victimColor) {
            bot.color = attacker.color;
        }
    });

    attacker.lastCapture = Date.now();
    victim.respawn([attacker.color], false); // Capture normale, on change la couleur

    // Notifications avec les sons appropriés
    if (victimSocket) {
        victimSocket.emit('playerCaptured', {
            newColor: victim.color,
            capturedBy: attacker.nickname,
            totalTimesCaptured: Object.values(victim.capturedBy)
                .reduce((sum, cap) => sum + cap.count, 0),
            playSound: 'player-captured' // Indiquer explicitement quel son jouer
        });
    }

    if (attackerSocket) {
        attackerSocket.emit('playerCapturedEnemy', {
            capturedNickname: victim.nickname,
            captures: attacker.captures,
            botsControlled: attacker.botsControlled,
            captureDetails: attacker.capturedPlayers,
            capturedId: victim.id,
            botsGained: botsToCapture, 
            playSound: 'player-capture' // Indiquer explicitement quel son jouer
        });
    }
}

function manageSpecialZones() {
    if (!currentGameSettings.enableSpecialZones) {
        specialZones.clear();
        return;
    }

    // Nettoyer les zones expirées
    for (const zone of specialZones) {
        if (zone.isExpired()) {
            specialZones.delete(zone);
        }
    }

    // Créer une nouvelle zone si nécessaire
    if (specialZones.size < 3 && !zoneSpawnTimeout) {
        zoneSpawnTimeout = setTimeout(() => {
            if (specialZones.size < 3) {
                const newZone = new SpecialZone();
                // Ne pas ajouter la zone si aucun type n'est disponible
                if (newZone.type) {
                    specialZones.add(newZone);
                }
            }
            zoneSpawnTimeout = null;
        }, currentGameSettings.zoneSpawnInterval * 1000);
    }
}

// Classes
class Entity {
    constructor(id, color = null) {
        this.id = id;
        const spawnPos = positionManager.getValidPosition();
        this.x = spawnPos.x;
        this.y = spawnPos.y;
        this.color = color || getRandomColor();
        this.direction = DIRECTIONS.IDLE;
        this.lastX = this.x;
        this.lastY = this.y;
    }

    determineDirection(dx, dy) {
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
            return DIRECTIONS.IDLE;
        }

        const angle = Math.atan2(dy, dx);
        const degrees = angle * (180 / Math.PI);

        if (degrees >= -22.5 && degrees < 22.5) return DIRECTIONS.EAST;
        if (degrees >= 22.5 && degrees < 67.5) return DIRECTIONS.SOUTH_EAST;
        if (degrees >= 67.5 && degrees < 112.5) return DIRECTIONS.SOUTH;
        if (degrees >= 112.5 && degrees < 157.5) return DIRECTIONS.SOUTH_WEST;
        if (degrees >= 157.5 || degrees < -157.5) return DIRECTIONS.WEST;
        if (degrees >= -157.5 && degrees < -112.5) return DIRECTIONS.NORTH_WEST;
        if (degrees >= -112.5 && degrees < -67.5) return DIRECTIONS.NORTH;
        if (degrees >= -67.5 && degrees < -22.5) return DIRECTIONS.NORTH_EAST;
        
        return DIRECTIONS.IDLE;
    }

    updateDirection(dx, dy) {
        this.direction = this.determineDirection(dx, dy);
    }
    validatePosition(x, y) {
        const mapDimensions = MAP_DIMENSIONS[currentGameSettings?.selectedMap || 'map1'];
        const currentWidth = mapDimensions.width;
        const currentHeight = mapDimensions.height;

        return x >= 0 && x <= currentWidth && y >= 0 && y <= currentHeight;
    }
}

class Player extends Entity {
    constructor(id, nickname) {
        super(id, getUniqueColor());
        this.nickname = nickname;
        const spawnPos = positionManager.getValidPosition();
        this.x = spawnPos.x;
        this.y = spawnPos.y;
        this.captures = 0;
        this.capturedPlayers = {};
        this.capturedBy = {};
        this.botsControlled = 0;
        this.totalBotsCaptures = 0;
        this.capturedByBlackBot = 0;
        this.spawnProtection = Date.now() + TIME_CONFIG.SPAWN_PROTECTION_TIME;
        this.lastCapture = 0;
        this.type = 'player';
        this._invincibilityActive = false; 
        this.speedBoostActive = false;
        this.bonusStartTime = 0;
        this.blackBotsDestroyed = 0; 
    }

    get invincibilityActive() {
        return this._invincibilityActive;
    }

    set invincibilityActive(value) {
        this._invincibilityActive = Boolean(value);
        //console.log(`Invincibilité changée pour ${this.nickname}:`, this._invincibilityActive);
    }

    deactivateInvincibility() {
        this._invincibilityActive = false;
        if (this.bonusTimers) {
            this.bonusTimers.invincibility = 0;
        }
        //console.log(`Invincibilité désactivée pour ${this.nickname}`);
    }

    isInvulnerable() {
        const now = Date.now();
        // Retourner true si le joueur a soit la protection au spawn, soit l'invincibilité active
        return this.invincibilityActive || now < this.spawnProtection;
    }

    addCapturedBots(count) {
        this.totalBotsCaptures += count;
    }

    respawn(excludeColors = [], keepColor = false) {
        const spawnPos = positionManager.getValidPosition();
        this.x = spawnPos.x;
        this.y = spawnPos.y;
        
        if (!keepColor) {
            this.color = getUniqueColor(excludeColors);
        }
        this.spawnProtection = Date.now() + TIME_CONFIG.SPAWN_PROTECTION_TIME;
    }

    canCapture() {
        return Date.now() - this.lastCapture > TIME_CONFIG.CAPTURE_COOLDOWN;
    }
}

class Bot extends Entity {
    constructor(id) {
        super(id);
        const spawnPos = positionManager.getValidPosition();
        this.x = spawnPos.x;
        this.y = spawnPos.y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.changeDirectionInterval = Math.random() * 2000 + 1000;
        this.lastDirectionChange = Date.now();
        this.isMoving = true;
        this.stateDuration = Math.random() * 2000 + 1000;
        this.lastStateChange = Date.now();
        this.type = 'bot';
        this.stuckCheckInterval = 500; // Vérifier si bloqué toutes les 500ms
        this.lastPosition = { x: this.x, y: this.y };
        this.lastMoveCheck = Date.now();
        this.stuckCount = 0;
    }

    update() {
        if (isPaused || isGameOver) return;

        const now = Date.now();

        // Gestion des états de mouvement/pause
        if (now - this.lastStateChange > this.stateDuration) {
            this.isMoving = !this.isMoving;
            this.lastStateChange = now;
            this.stateDuration = Math.random() * 2000 + 1000;

            // Lors d'une pause, sauvegarder la position comme point de référence
            if (!this.isMoving) {
                this.direction = DIRECTIONS.IDLE;
                this.lastPosition = { x: this.x, y: this.y };
                this.stuckCount = 0; // Réinitialiser le compteur de blocage
            }
        }

        // Vérifier si le bot est bloqué seulement quand il essaie de se déplacer
        if (this.isMoving && now - this.lastMoveCheck > this.stuckCheckInterval) {
            const dx = this.x - this.lastPosition.x;
            const dy = this.y - this.lastPosition.y;
            const distanceMoved = Math.sqrt(dx * dx + dy * dy);

            if (distanceMoved < 1) { // Si le bot n'a presque pas bougé alors qu'il essaie
                this.stuckCount++;
                if (this.stuckCount > 3) { // Augmenté pour plus de tolérance
                    this.changeDirection(); // D'abord essayer de changer de direction
                    if (this.stuckCount > 5) { // Si toujours bloqué après plusieurs tentatives
                        this.findEscapePath();
                    }
                }
            } else {
                this.stuckCount = 0;
            }

            this.lastPosition = { x: this.x, y: this.y };
            this.lastMoveCheck = now;
        }

        if (this.isMoving) {
            this.move();
        }
    }

    findEscapePath() {
        const angles = [0, 45, 90, 135, 180, 225, 270, 315];
        
        // Essayer d'abord de trouver un chemin de sortie
        for (const angle of angles) {
            const radians = (angle * Math.PI) / 180;
            const testX = this.x + Math.cos(radians) * GAME_CONFIG.BOT_SPEED * 2;
            const testY = this.y + Math.sin(radians) * GAME_CONFIG.BOT_SPEED * 2;

            if (collisionMap.canMove(this.x, this.y, testX, testY, 8)) {
                this.x = testX;
                this.y = testY;
                this.vx = Math.cos(radians);
                this.vy = Math.sin(radians);
                this.stuckCount = 0;
                return;
            }
        }

        // En dernier recours seulement, téléporter à une nouvelle position
        const spawnPos = positionManager.getValidPosition();
        this.x = spawnPos.x;
        this.y = spawnPos.y;
        this.changeDirection();
        this.stuckCount = 0;
    }

    unstuck() {
        const spawnPos = positionManager.getValidPosition();
        this.x = spawnPos.x;
        this.y = spawnPos.y;
        this.stuckCount = 0;
        this.changeDirection();
        // Essayer plusieurs directions pour s'échapper
        const angles = [0, 45, 90, 135, 180, 225, 270, 315];
        for (const angle of angles) {
            const radians = (angle * Math.PI) / 180;
            const testX = this.x + Math.cos(radians) * GAME_CONFIG.BOT_SPEED * 2;
            const testY = this.y + Math.sin(radians) * GAME_CONFIG.BOT_SPEED * 2;

            if (collisionMap.canMove(this.x, this.y, testX, testY, 8)) {
                // Position valide trouvée, téléporter le bot légèrement plus loin
                const escapeX = this.x + Math.cos(radians) * GAME_CONFIG.BOT_SPEED * 4;
                const escapeY = this.y + Math.sin(radians) * GAME_CONFIG.BOT_SPEED * 4;
                if (collisionMap.canMove(this.x, this.y, escapeX, escapeY, 8)) {
                    this.x = escapeX;
                    this.y = escapeY;
                    this.changeDirection(); // Nouvelle direction aléatoire
                    this.stuckCount = 0;
                    return;
                }
            }
        }

        // Si toujours bloqué, essayer de trouver une nouvelle position valide
        const newPos = collisionMap.findValidSpawnPosition();
        this.x = newPos.x;
        this.y = newPos.y;
        this.stuckCount = 0;
    }

    move() {
        const mapDimensions = MAP_DIMENSIONS[currentGameSettings?.selectedMap || 'map1'];
        const currentWidth = mapDimensions.width;
        const currentHeight = mapDimensions.height;
    
        const now = Date.now();
    
        if (now - this.lastDirectionChange > this.changeDirectionInterval) {
            this.changeDirection();
            this.lastDirectionChange = now;
            this.changeDirectionInterval = Math.random() * 2000 + 1000;
        }
    
        const newX = this.x + this.vx * GAME_CONFIG.BOT_SPEED;
        const newY = this.y + this.vy * GAME_CONFIG.BOT_SPEED;
    
        if (collisionMap.canMove(this.x, this.y, newX, newY, 8)) {
            this.x = newX;
            this.y = newY;
            this.updateDirection(this.vx, this.vy);
        } else {
            this.changeDirection();
        }
    
        // S'assurer que le bot reste dans les limites actuelles de la map
        this.x = Math.max(0, Math.min(currentWidth, this.x));
        this.y = Math.max(0, Math.min(currentHeight, this.y));
    }

    changeDirection() {
        let foundValidDirection = false;
        let attempts = 0;
        const maxAttempts = 8;

        while (!foundValidDirection && attempts < maxAttempts) {
            const angleChange = (Math.random() - 0.5) * Math.PI;
            const currentAngle = Math.atan2(this.vy, this.vx);
            const newAngle = currentAngle + angleChange;
            
            const testVx = Math.cos(newAngle);
            const testVy = Math.sin(newAngle);
            
            const testX = this.x + testVx * GAME_CONFIG.BOT_SPEED * 2;
            const testY = this.y + testVy * GAME_CONFIG.BOT_SPEED * 2;

            if (collisionMap.canMove(this.x, this.y, testX, testY, 8)) {
                this.vx = testVx;
                this.vy = testVy;
                foundValidDirection = true;
            }
            
            attempts++;
        }

        if (!foundValidDirection) {
            // Si aucune direction n'est valide, inverser la direction
            this.vx = -this.vx;
            this.vy = -this.vy;
        }
    }
}

class BlackBot extends Bot {
    constructor(id) {
        super(id);
        const spawnPos = positionManager.getValidPosition();
        this.x = spawnPos.x;
        this.y = spawnPos.y;
        this.color = '#000000';
        this.type = 'blackBot';
        this.lastCaptureTime = 0;
        this.captureCooldown = 2000; // 2 secondes entre chaque capture
        this.detectionRadius = DEFAULT_GAME_SETTINGS.blackBotDetectionRadius;
        this.targetEntity = null;
        this.baseSpeed = GAME_CONFIG.BOT_SPEED; // Utiliser la même vitesse que les autres bots
        this.lastTargetSearch = 0;
        this.targetSearchInterval = 500;
        this.stuckCheckInterval = 300; // Vérifier plus souvent si bloqué
    }

    update(entities) {
        if (isPaused || isGameOver) return;
        const now = Date.now();
        
        // Si on n'a pas de cible ou si la dernière recherche date de plus d'une seconde
        if (!this.targetEntity || now - this.lastTargetSearch > 500) {
            this.findNewTarget(entities);
            this.lastTargetSearch = now;
        } else {
            // Vérifier si un joueur est entré dans le rayon pendant la poursuite d'un bot
            if (this.targetEntity && this.targetEntity.type === 'bot') {
                const nearbyPlayer = Object.values(entities)
                    .find(e => e.type === 'player' &&
                              !e.invincibilityActive &&
                              this.getDistanceTo(e) < this.detectionRadius);
                
                if (nearbyPlayer) {
                    this.targetEntity = nearbyPlayer;
                }
            }
    
            // Vérifier si la cible existe toujours et est à portée
            const target = entities[this.targetEntity?.id];
            if (!target || this.getDistanceTo(target) > this.detectionRadius) {
                this.targetEntity = null;
            }
        }
    
        // Si on a une cible, on la poursuit
        if (this.targetEntity) {
            this.pursueTarget();
        } else {
            // Comportement normal de bot si pas de cible
            super.update();
        }
    }

    findNewTarget(entities) {
        let nearestPlayer = null;
        let nearestPlayerDistance = Infinity;
        let nearestNormalBot = null;
        let nearestBotDistance = Infinity;
    
        Object.values(entities).forEach(entity => {
            if (entity.id === this.id) return;
            const distance = this.getDistanceTo(entity);
    
            // Ne considérer que les entités dans le rayon de détection
            if (distance < this.detectionRadius) {
                // Pour les joueurs, vérifier l'invincibilité
                if (entity.type === 'player') {
                    // Vérifier si le joueur n'est PAS invincible
                    if (!entity.invincibilityActive && !entity.isInvulnerable()) {
                        if (distance < nearestPlayerDistance) {
                            nearestPlayerDistance = distance;
                            nearestPlayer = entity;
                        }
                    }
                }
                // Pour les bots, ne considérer que ceux qui ne sont pas déjà blancs
                else if (entity.type === 'bot' && entity.color !== '#FFFFFF') {
                    if (distance < nearestBotDistance) {
                        nearestBotDistance = distance;
                        nearestNormalBot = entity;
                    }
                }
            }
        });
    
        // Prioriser un joueur si présent dans le rayon
        if (nearestPlayer) {
            this.targetEntity = nearestPlayer;
        } else if (nearestNormalBot) {
            this.targetEntity = nearestNormalBot;
        } else {
            this.targetEntity = null;
        }
    }

    pursueTarget() {
        // Récupérer les dimensions de la map actuelle
        const mapDimensions = MAP_DIMENSIONS[currentGameSettings?.selectedMap || 'map1'];
        const currentWidth = mapDimensions.width;
        const currentHeight = mapDimensions.height;
    
        const dx = this.targetEntity.x - this.x;
        const dy = this.targetEntity.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
    
        if (distance > 0) {
            // Normaliser et appliquer la vitesse
            this.vx = (dx / distance) * this.baseSpeed;
            this.vy = (dy / distance) * this.baseSpeed;
        }
    
        // Calculer la nouvelle position
        const newX = this.x + this.vx;
        const newY = this.y + this.vy;
    
        // Garder dans les limites de la map actuelle
        this.x = Math.max(0, Math.min(currentWidth, newX));
        this.y = Math.max(0, Math.min(currentHeight, newY));
    
        // Vérifier collision avec la cible
        if (distance < 20) {  
            this.captureEntity(this.targetEntity);
        }
    }
    
    captureEntity(entity) {
        const now = Date.now();
        if (now - this.lastCaptureTime < this.captureCooldown) return;
    
        if (entity.type === 'player') {
            // Double vérification de l'invincibilité
            if (entity.invincibilityActive || entity.isInvulnerable()) {
                // Le joueur est invincible, mais on ne détruit plus le bot noir
                return;
            }
    
            // Si le joueur n'est pas invincible, procéder à sa capture
            const currentBots = Object.values(bots).filter(bot => bot.color === entity.color).length;
            const pointsLost = Math.floor(currentBots * (DEFAULT_GAME_SETTINGS.pointsLossPercent / 100));
    
            // Transformer la moitié des bots existants en blancs
            let transformedCount = 0;
            Object.values(bots).forEach(bot => {
                if (bot.color === entity.color && transformedCount < pointsLost) {
                    bot.color = '#FFFFFF';
                    transformedCount++;
                }
            });
    
            // Créer des bots blancs additionnels si nécessaire
            this.createWhiteBots(pointsLost);
            
            // Faire respawn le joueur en gardant sa couleur
            this.notifyPlayerCapture(entity, pointsLost);
            entity.respawn([], true);  // true pour garder la couleur
    
        } else if (entity.type === 'bot' && entity.color !== '#FFFFFF') {
            entity.color = '#FFFFFF';
        }
    
        this.lastCaptureTime = now;
        this.targetEntity = null;
    }

    calculatePlayerPoints(player) {
        // Calculer les points du joueur (bots contrôlés + captures)
        let controlledBots = Object.values(bots)
            .filter(bot => bot.color === player.color).length;
        return controlledBots + player.captures;
    }

    createWhiteBots(count) {
        for (let i = 0; i < count; i++) {
            const whiteBotId = `bot_${Date.now()}_${Math.random()}`;
            const whiteBot = new Bot(whiteBotId);
            whiteBot.color = '#FFFFFF';
            bots[whiteBotId] = whiteBot;
        }
    }

    notifyPlayerCapture(player, pointsLost) {
        // Incrémenter le compteur de captures par les bots noirs
        player.capturedByBlackBot++;

        const socket = activeSockets[player.id];
        if (socket) {
            socket.emit('capturedByBlackBot', {
                pointsLost: pointsLost,
                message: `Capturé par un Bot Noir ! Vous avez perdu ${pointsLost} points.`,
                playSound: 'playerCaptured' // Ajout de cette ligne
            });
        }
    }

    getDistanceTo(entity) {
        const dx = this.x - entity.x;
        const dy = this.y - entity.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

function spawnBlackBots() {
    if (!currentGameSettings.enableBlackBot) return;
    
    const timeElapsed = (Date.now() - gameStartTime - totalPauseDuration) / 1000;
    const halfGameTime = currentGameSettings.gameDuration / 2;
    
    if (timeElapsed >= halfGameTime && Object.keys(blackBots).length === 0) {
        for (let i = 0; i < currentGameSettings.blackBotCount; i++) {
            const blackBotId = `blackBot_${Date.now()}_${Math.random()}`;
            blackBots[blackBotId] = new BlackBot(blackBotId);
        }
    }
}

class Bonus {
    constructor(type) {
        this.id = `bonus_${Date.now()}_${Math.random()}`;
        this.type = type;
        const { width: currentWidth, height: currentHeight } = getCurrentMapDimensions();
        
        // Trouver une position valide
        const x = Math.random() * currentWidth;
        const y = Math.random() * currentHeight;
        
        this.x = x;
        this.y = y;
        this.createdAt = Date.now();
        this.lifetime = 8000;
        this.warningThreshold = 3000;
        this.lastUpdateTime = Date.now();
    }

    isExpired() {
        return Date.now() - this.createdAt >= this.lifetime;
    }

    getTimeLeft() {
        return Math.max(0, this.lifetime - (Date.now() - this.createdAt));
    }

    shouldBlink() {
        return this.getTimeLeft() <= this.warningThreshold;
    }

    getBlinkState() {
        if (!this.shouldBlink()) return { opacity: 1, scale: 1 };
        
        const timeLeft = this.getTimeLeft();
        const blinkProgress = 1 - (timeLeft / this.warningThreshold);
        
        // Fonction de lissage pour rendre l'animation plus fluide
        const easeInOutQuad = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        
        // Calculer la phase de clignotement (plus rapide vers la fin)
        const blinkFrequency = 3 + (blinkProgress * 5); // Augmente progressivement
        const blinkPhase = Math.sin(Date.now() * 0.004 * blinkFrequency);
        
        // Calculer l'opacité avec lissage
        const baseOpacity = 0.4 + (0.6 * easeInOutQuad(Math.abs(blinkPhase)));
        
        // Ajouter une légère pulsation de taille
        const baseScale = 1 + (0.1 * Math.abs(blinkPhase));
        
        return {
            opacity: baseOpacity,
            scale: baseScale
        };
    }
}

class Malus {
    constructor(type) {
        this.id = `malus_${Date.now()}_${Math.random()}`;
        this.type = type;
        
        const { width: currentWidth, height: currentHeight } = getCurrentMapDimensions();
        
        // Position aléatoire dans les limites de la map actuelle
        const x = Math.random() * currentWidth;
        const y = Math.random() * currentHeight;
        
        this.x = x;
        this.y = y;
        this.createdAt = Date.now();
        this.lifetime = 8000;
        this.warningThreshold = 3000;
        this.lastUpdateTime = Date.now();
    }

    isExpired() {
        return Date.now() - this.createdAt >= this.lifetime;
    }

    getTimeLeft() {
        return Math.max(0, this.lifetime - (Date.now() - this.createdAt));
    }

    shouldBlink() {
        return this.getTimeLeft() <= this.warningThreshold;
    }

    getBlinkState() {
        if (!this.shouldBlink()) return { opacity: 1, scale: 1 };
        
        const timeLeft = this.getTimeLeft();
        const blinkProgress = 1 - (timeLeft / this.warningThreshold);
        
        // Fonction de lissage pour rendre l'animation plus fluide
        const easeInOutQuad = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        
        // Calculer la phase de clignotement (plus rapide vers la fin)
        const blinkFrequency = 3 + (blinkProgress * 5); // Augmente progressivement
        const blinkPhase = Math.sin(Date.now() * 0.004 * blinkFrequency);
        
        // Calculer l'opacité avec lissage
        const baseOpacity = 0.4 + (0.6 * easeInOutQuad(Math.abs(blinkPhase)));
        
        // Ajouter une légère pulsation de taille
        const baseScale = 1 + (0.1 * Math.abs(blinkPhase));
        
        return {
            opacity: baseOpacity,
            scale: baseScale
        };
    }
}

function resetPlayer(player) {
    // Réinitialisation complète de tous les compteurs d'un joueur
    player.captures = 0;
    player.capturedPlayers = {};
    player.capturedBy = {};
    player.botsControlled = 0;
    player.totalBotsCaptures = 0;
    player.capturedByBlackBot = 0;
    player.speedBoostActive = false;
    player.invincibilityActive = false;
    player.revealActive = false;
    player.blackBotsDestroyed = 0; // Réinitialisation explicite du compteur de black bots
    if (player.bonusTimers) {
        player.bonusTimers = {
            speed: 0,
            invincibility: 0,
            reveal: 0
        };
    }
}

function updateMalusItems() {
    const currentTime = Date.now();
    
    // Mettre à jour la liste des malus
    malusItems = malusItems.filter(malus => {
        if (malus.isExpired()) {
            return false; // Supprimer les malus expirés
        }
        return true;
    });

    // Pour chaque malus restant, calculer son état actuel
    malusItems.forEach(malus => {
        malus.lastUpdateTime = currentTime;
    });
}

// Nettoyer les bonus expirés
function cleanExpiredBonuses() {
    bonuses = bonuses.filter(bonus => !bonus.isExpired());
}

function updateBonusItems() {
    const currentTime = Date.now();
    
    // Mettre à jour la liste des bonus
    bonuses = bonuses.filter(bonus => !bonus.isExpired());

    // Pour chaque bonus restant, calculer son état actuel
    bonuses.forEach(bonus => {
        bonus.lastUpdateTime = currentTime;
    });
}

// Fonctions utilitaires
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function getUniqueColor(excludeColors = []) {
    const usedColors = Object.values(players).map(player => player.color);
    const forbiddenColors = usedColors.concat(excludeColors);
    const unusedColors = availableColors.filter(color => !forbiddenColors.includes(color));

    if (unusedColors.length > 0) {
        return unusedColors[Math.floor(Math.random() * unusedColors.length)];
    } else {
        let newColor;
        do {
            newColor = getRandomColor();
        } while (forbiddenColors.includes(newColor));
        return newColor;
    }
}

function calculateTimeLeft() {
    if (isPaused) {
        return Math.max(currentGameSettings.gameDuration - Math.floor((pauseStartTime - gameStartTime - totalPauseDuration) / 1000), 0);
    }
    
    const timeElapsed = Math.floor((Date.now() - gameStartTime - totalPauseDuration) / 1000);
    return Math.max(currentGameSettings.gameDuration - timeElapsed, 0);
}

// Gestion des entités
function createBots(number) {
    for (let i = 0; i < number; i++) {
        addBot();
    }
}

function addBot() {
    const botId = `bot_${Date.now()}_${Math.random()}`;
    bots[botId] = new Bot(botId);
}

function updateBots() {
    if (isPaused || isGameOver) return;

    // Mettre à jour les bots normaux
    Object.values(bots).forEach(bot => {
        bot.update();
        detectCollisions(bot, bot.id);
    });

    // Mettre à jour les bots noirs et supprimer ceux qui sont marqués comme détruits
    Object.values(blackBots).forEach(blackBot => {
        if (!blackBot.destroyed) {
            blackBot.update({...players, ...bots});
        }
    });

    // Vérifier s'il faut faire apparaître des bots noirs
    spawnBlackBots();
}

// Gestion des bonus
function spawnBonus() {
    if (isPaused || isGameOver) return;

    const bonusTypes = [
        { 
            type: 'speed', 
            enabled: currentGameSettings.enableSpeedBoost,
            spawnRate: currentGameSettings.speedBoostSpawnRate 
        },
        { 
            type: 'invincibility', 
            enabled: currentGameSettings.enableInvincibility,
            spawnRate: currentGameSettings.invincibilitySpawnRate 
        },
        { 
            type: 'reveal', 
            enabled: currentGameSettings.enableReveal,
            spawnRate: currentGameSettings.revealSpawnRate 
        }
    ];

    // Pour chaque type de bonus activé, tenter de le faire apparaître selon son taux
    bonusTypes.forEach(bonusType => {
        if (bonusType.enabled && Math.random() * 100 < bonusType.spawnRate) {
            bonuses.push(new Bonus(bonusType.type));
        }
    });

    // Planifier le prochain spawn
    const interval = currentGameSettings.bonusSpawnInterval * 1000;
    const randomVariation = interval * 0.5; // ±50% de variation
    const nextSpawnTime = interval + (Math.random() * randomVariation - randomVariation / 2);
    setTimeout(spawnBonus, nextSpawnTime);
}

function handleBonusCollection(player, bonus) {
    const socket = activeSockets[player.id];
    if (!socket) return;

    const bonusDurations = {
        speed: currentGameSettings.speedBoostDuration,
        invincibility: currentGameSettings.invincibilityDuration,
        reveal: currentGameSettings.revealDuration
    };

    // Initialiser les timers si nécessaire
    if (!player.bonusTimers) {
        player.bonusTimers = {
            speed: 0,
            invincibility: 0,
            reveal: 0
        };
    }

    const duration = bonusDurations[bonus.type];


    switch(bonus.type) {
        case 'speed':
            player.speedBoostActive = true;
            if (!player.bonusTimers) player.bonusTimers = {};
            if (!player.bonusTimers.speed) player.bonusTimers.speed = 0;
            player.bonusTimers.speed += bonusDurations[bonus.type];
            break;
        case 'invincibility':
            player.invincibilityActive = true;
            // Initialiser les timers si nécessaire
            if (!player.bonusTimers) {
                player.bonusTimers = {};
            }
            // Cumuler le temps d'invincibilité au lieu de le remplacer
            if (!player.bonusTimers.invincibility) {
                player.bonusTimers.invincibility = 0;
            }
            player.bonusTimers.invincibility += duration;
            player.bonusStartTime = Date.now();
            break;
        case 'reveal':
            player.revealActive = true;
            if (!player.bonusTimers) player.bonusTimers = {};
            if (!player.bonusTimers.reveal) player.bonusTimers.reveal = 0;
            player.bonusTimers.reveal += bonusDurations[bonus.type];
            break;
    }

    socket.emit('activateBonus', {
        type: bonus.type,
        duration: bonusDurations[bonus.type]
    });
}

// Collisions et captures
function detectCollisions(entity, entityId) {
    // Collisions avec les joueurs
    Object.entries(players).forEach(([playerId, player]) => {
        if (playerId === entityId) return;

        const dx = entity.x - player.x;
        const dy = entity.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 20) {
            if (entity.type === 'player' && player.type === 'player') {
                // Vérifier si le joueur cible a l'invincibilité
                if (entity.color !== player.color && !player.invincibilityActive) {
                    handlePlayerCapture(entity, player);
                }
            } else if (entity.type === 'player' && player.type === 'bot') {
                player.color = entity.color;
            }
        }
    });

    // Collisions avec les bots
    Object.entries(bots).forEach(([botId, bot]) => {
        if (botId === entityId) return;

        const dx = entity.x - bot.x;
        const dy = entity.y - bot.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 20 && entity.color !== bot.color) {
            if (entity.type === 'player') {
                bot.color = entity.color;
            } else if (entity.type === 'bot') {
                bot.color = entity.color;
            }
        }
    });

    // Collisions avec les bots noirs
    if (entity.type === 'player') {
        const player = players[entity.id];
    
        Object.entries(blackBots).forEach(([blackBotId, blackBot]) => {
            const dx = entity.x - blackBot.x;
            const dy = entity.y - blackBot.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
    
            if (distance < 20) {
                const player = players[entity.id];
                if (player && player.invincibilityActive === true) {
                    delete blackBots[blackBotId];
                    player.blackBotsDestroyed++; // Incrémenter le compteur
                    const socket = activeSockets[entity.id];
                    if (socket) {
                        socket.emit('playerCapturedEnemy', {
                            capturedNickname: 'Bot Noir',
                            message: 'Vous avez détruit un Bot Noir !',
                            pointsGained: 15, // Points gagnés pour la capture
                            position: { x: blackBot.x, y: blackBot.y }
                        });
                    }
                }
                // Si le joueur n'est pas invincible, le bot noir gère lui-même la capture
            }
        });

        // Collisions avec les bonus
        bonuses = bonuses.filter(bonus => {
            const dx = entity.x - bonus.x;
            const dy = entity.y - bonus.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 15) {
                handleBonusCollection(entity, bonus);
                return false;
            }
            return true;
        });

        // Collisions avec les malus
        malusItems = malusItems.filter(malus => {
            const dx = entity.x - malus.x;
            const dy = entity.y - malus.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 15) {
                handleMalusCollection(entity, malus);
                return false;
            }
            return true;
        });
    }
}

// Gestion des mises à jour et scores
function calculatePlayerScores() {
    const scores = [];
    
    for (let id in players) {
        const player = players[id];
        // Compter les bots contrôlés actuellement
        const controlledPoints = Object.values(bots)
            .filter(bot => bot.color === player.color)
            .length;
        
        // Ajouter les points des black bots (15 points par black bot détruit)
        const blackBotPoints = player.blackBotsDestroyed * 15;
        
        // Score total = bots contrôlés + points des black bots
        const totalPoints = controlledPoints + blackBotPoints;
        
        scores.push({
            id: player.id,
            nickname: player.nickname,
            currentBots: totalPoints, // Score total incluant les points des black bots
            totalBotsControlled: player.totalBotsCaptures,
            captures: player.captures,
            capturedPlayers: player.capturedPlayers,
            capturedBy: player.capturedBy,
            capturedByBlackBot: player.capturedByBlackBot,
            blackBotsDestroyed: player.blackBotsDestroyed,
            color: player.color
        });
    }

    return scores.sort((a, b) => {
        const pointsDiff = b.currentBots - a.currentBots;
        if (pointsDiff !== 0) return pointsDiff;
        return b.captures - a.captures;
    });
}

function sendUpdates() {
    if (isPaused || isGameOver) return;

    malusItems = malusItems.filter(malus => !malus.isExpired());

    // Appliquer les effets des zones
    for (const zone of specialZones) {
        [...Object.values(players), ...Object.values(bots)].forEach(entity => {
            if (zone.isEntityInside(entity)) {
                zone.applyEffect(entity, {...players, ...bots});
            } else if (entity.type === 'player') {
                // Réinitialiser les effets hors zone
                entity.isInvisible = false;
            }
        });
    }

    // Vérifier le temps restant
    const timeLeft = calculateTimeLeft();
    if (timeLeft <= 0 && !isGameOver) {
        endGame();
        return;
    }

    // Préparer le tableau des entités
    const plainEntities = [
        // Joueurs
        ...Object.values(players).map(player => ({
            id: player.id,
            x: player.x,
            y: player.y,
            color: player.color,
            type: 'player',
            direction: player.direction,
            nickname: player.nickname,
            invincibilityActive: player.invincibilityActive
        })),
        // Bots normaux
        ...Object.values(bots).map(bot => ({
            id: bot.id,
            x: bot.x,
            y: bot.y,
            color: bot.color,
            type: 'bot',
            direction: bot.direction
        })),
        // Bots noirs
        ...Object.values(blackBots).map(bot => ({
            id: bot.id,
            x: bot.x,
            y: bot.y,
            color: bot.color,
            type: 'blackBot',
            direction: bot.direction,
            detectionRadius: currentGameSettings.blackBotDetectionRadius
        }))
    ];

    // Calculer les scores des joueurs
    const playerScores = calculatePlayerScores();

    // Nettoyer les bonus expirés
    cleanExpiredBonuses();

    // Gérer les zones spéciales
    manageSpecialZones();

    // Malus
    updateMalusItems();

    updateBonusItems();

    // Préparer les données complètes du jeu
    const gameData = {
        entities: plainEntities,
        playerScores: playerScores,
        timeLeft: timeLeft,
        // Inclure les bonus actifs
        bonuses: bonuses.map(bonus => ({
            id: bonus.id,
            x: bonus.x,
            y: bonus.y,
            type: bonus.type,
            timeLeft: bonus.getTimeLeft(),
            isBlinking: bonus.shouldBlink(),
            blinkState: bonus.getBlinkState()
        })),
        malus: malusItems.map(malus => ({
            id: malus.id,
            x: malus.x,
            y: malus.y,
            type: malus.type,
            timeLeft: malus.getTimeLeft(),
            isBlinking: malus.shouldBlink(),
            blinkState: malus.getBlinkState()
        })),
        // zones spéciales
        zones: Array.from(specialZones).map(zone => ({
            type: zone.type,
            shape: zone.shape,
            id: zone.id
        }))
    };

    // Envoyer les mises à jour à tous les joueurs connectés
    for (let socketId in activeSockets) {
        activeSockets[socketId].emit('updateEntities', gameData);
    }
}

function checkGameEndConditions() {
    if (waitingRoom.playersInGame.size === 0 && waitingRoom.isGameStarted) {
        waitingRoom.isGameStarted = false;
        io.emit('updateWaitingRoom', {
            players: Array.from(waitingRoom.players.values()),
            gameInProgress: false
        });
    }
}

function endGame() {
    isGameOver = true;
    waitingRoom.isGameStarted = false;
    
    const scores = calculatePlayerScores();

    waitingRoom.players.forEach(player => {
        if (player.status === 'playing') {
            player.status = 'waiting';
        }
    });
    waitingRoom.playersInGame.clear();

    // Nettoyer les malus
    clearMalusEffects();

    // Informer tous les joueurs
    for (let socketId in activeSockets) {
        activeSockets[socketId].emit('gameOver', { scores: scores });
    }

    // Mettre à jour la salle d'attente
    io.emit('updateWaitingRoom', {
        players: Array.from(waitingRoom.players.values()),
        gameInProgress: false
    });
}

function resetGame() {
    // Réinitialiser les états du jeu
    isGameOver = false;
    isPaused = false;
    totalPauseDuration = 0;
    pauseStartTime = null;
    gameStartTime = Date.now();
    
    // Réinitialiser TOUS les joueurs avec la nouvelle fonction
    Object.values(players).forEach(player => {
        resetPlayer(player);
    });

    // Réinitialiser les bots
    blackBots = {};
    bots = {};
    botsInitialized = false;

    // Nettoyer les malus
    clearMalusEffects();

    // Réinitialiser les bonus
    bonuses = [];
    // Redémarrer le spawn des bonus
    setTimeout(spawnBonus, 3000);

    setTimeout(spawnMalus, 4000);
}

function handleGameStart(socket, data) {
    if (isGameOver) {
        resetGame();
    }

    const mapDimensions = MAP_DIMENSIONS[data.settings?.selectedMap || 'map1'];
    currentMapWidth = mapDimensions.width;
    currentMapHeight = mapDimensions.height;
    const nickname = data.nickname || 'Joueur';
    
    // Vérifier si le joueur existe déjà
    if (!players[socket.id]) {
        // Créer un nouveau joueur
        players[socket.id] = new Player(socket.id, nickname);
        activeSockets[socket.id] = socket;
    } else {
        // Si le joueur existe déjà, réinitialiser ses scores
        const player = players[socket.id];
        player.captures = 0;
        player.capturedPlayers = {};
        player.capturedBy = {};
        player.botsControlled = 0;
        player.totalBotsCaptures = 0;
        player.capturedByBlackBot = 0;
        player.blackBotsDestroyed = 0;  // Réinitialisation du compteur de black bots
        player.speedBoostActive = false;
        player.invincibilityActive = false;
        player.revealActive = false;
        player.bonusStartTime = 0;
        // Réinitialiser les timers de bonus si ils existent
        if (player.bonusTimers) {
            player.bonusTimers = {
                speed: 0,
                invincibility: 0,
                reveal: 0
            };
        }
    }

    // Mettre à jour les paramètres du jeu
    currentGameSettings = {
        ...DEFAULT_GAME_SETTINGS,
        ...data.settings,
        enabledZones: {
            ...DEFAULT_GAME_SETTINGS.enabledZones,
            ...(data.settings?.enabledZones || {})
        }
    };

    // Initialiser les bots si nécessaire
    if (!botsInitialized) {
        createBots(currentGameSettings.initialBotCount);
        botsInitialized = true;
    }
}

// Configuration Socket.IO
io.on('connection', (socket) => {

    socket.on('joinWaitingRoom', (nickname) => {
        console.log('Joueur rejoint la salle:', nickname); // Log de debug
    
        const isEmptyRoom = waitingRoom.players.size === 0;
        const hasNoOwner = !Array.from(waitingRoom.players.values()).some(player => player.isOwner);
        const shouldBeOwner = isEmptyRoom || hasNoOwner;
    
        const playerData = {
            id: socket.id,
            nickname: nickname,
            isOwner: shouldBeOwner,
            status: 'waiting'
        };
    
        console.log('Données du joueur:', playerData); // Log de debug
        
        waitingRoom.players.set(socket.id, playerData);
    
        if (shouldBeOwner) {
            socket.emit('gameSettingsUpdated', waitingRoom.settings);
        }
    
        // Vérifier l'état de la partie
        if (waitingRoom.isGameStarted) {
            socket.emit('gameInProgress', {
                canJoin: true,
                playersCount: Object.keys(players).length
            });
        }
    
        // Log avant l'émission
        console.log('Émission updateWaitingRoom:', {
            players: Array.from(waitingRoom.players.values()),
            gameInProgress: waitingRoom.isGameStarted
        });
    
        // Émettre la mise à jour à tous les clients
        io.emit('updateWaitingRoom', {
            players: Array.from(waitingRoom.players.values()),
            gameInProgress: waitingRoom.isGameStarted
        });
    });

    socket.on('joinRunningGame', (data) => {
        console.log(`Joueur ${data.nickname} tente de rejoindre la partie en cours`);
    
        if (!waitingRoom.isGameStarted) {
            socket.emit('error', 'Aucune partie en cours');
            return;
        }
    
        try {
            // Créer le nouveau joueur
            const newPlayer = new Player(socket.id, data.nickname);
            players[socket.id] = newPlayer;
            activeSockets[socket.id] = socket;
    
            // Faire apparaître le joueur à une position sûre
            const spawnPos = positionManager.getValidPosition();
            newPlayer.x = spawnPos.x;
            newPlayer.y = spawnPos.y;
            newPlayer.spawnProtection = Date.now() + TIME_CONFIG.SPAWN_PROTECTION_TIME;
    
            // Mettre à jour le statut dans la salle d'attente
            const playerData = waitingRoom.players.get(socket.id);
            if (playerData) {
                playerData.status = 'playing';
                waitingRoom.playersInGame.add(socket.id);
            }
    
            // IMPORTANT : Envoyer d'abord les paramètres actuels de la partie
            socket.emit('gameSettingsUpdated', {
                ...waitingRoom.settings,
                mapUpdateRequired: true // Forcer la mise à jour de la map
            });
    
            // Puis informer de l'arrivée du joueur et démarrer sa partie
            io.emit('playerJoined', {
                nickname: data.nickname,
                id: socket.id
            });
    
            // Mettre à jour la salle d'attente
            io.emit('updateWaitingRoom', {
                players: Array.from(waitingRoom.players.values()),
                gameInProgress: waitingRoom.isGameStarted
            });
    
            // Démarrer la partie pour le nouveau joueur
            socket.emit('gameStarting');
    
            console.log('Paramètres envoyés au nouveau joueur:', {
                map: waitingRoom.settings.selectedMap,
                mirror: waitingRoom.settings.mirrorMode
            });
    
        } catch (error) {
            console.error('Erreur lors de l\'ajout du joueur à la partie:', error);
            socket.emit('error', 'Impossible de rejoindre la partie');
        }
    });

    socket.on('bonusExpired', (data) => {
        console.log('Réception de l\'expiration du bonus:', data);
        if (data.type === 'invincibility') {
            const player = players[socket.id];
            if (player) {
                player.deactivateInvincibility();
                // Notifier tous les joueurs de la fin de l'invincibilité
                io.emit('playerStatusUpdate', {
                    playerId: socket.id,
                    invincibilityActive: false
                });
            }
        }
    });

    // gérer la demande de rejoindre une partie en cours
    socket.on('joinRunningGame', (data) => {
        if (!waitingRoom.isGameStarted) return;

        const playerData = waitingRoom.players.get(socket.id);
        if (!playerData) return;

        // Ajouter le joueur à la partie
        players[socket.id] = new Player(socket.id, data.nickname);
        activeSockets[socket.id] = socket;
        
        // Faire apparaître le joueur à une position sûre
        players[socket.id].respawn();
        
        // Mettre à jour le statut dans la salle d'attente
        playerData.status = 'playing';
        waitingRoom.playersInGame.add(socket.id);
        
        // Informer tout le monde de la mise à jour
        io.emit('updateWaitingRoom', {
            players: Array.from(waitingRoom.players.values()),
            gameInProgress: waitingRoom.isGameStarted
        });

        // Faire rejoindre la partie au joueur
        socket.emit('gameStarting');
    });

    socket.on('requestGameSettings', () => {
        socket.emit('gameSettingsUpdated', waitingRoom.settings);
    });

    socket.on('rejoinWaitingRoom', (data) => {
        const { nickname, wasInGame } = data;
    
        // Vérifier si ce joueur était propriétaire avant
        const existingPlayer = waitingRoom.players.get(socket.id);
        const wasOwner = existingPlayer?.isOwner;
    
        // Si la salle est vide OU s'il n'y a aucun propriétaire OU si le joueur était propriétaire
        const isEmptyRoom = waitingRoom.players.size === 0;
        const hasNoOwner = !Array.from(waitingRoom.players.values()).some(player => player.isOwner);
        const shouldBeOwner = isEmptyRoom || hasNoOwner || wasOwner;
    
        const playerData = {
            id: socket.id,
            nickname: nickname,
            isOwner: shouldBeOwner
        };
    
        waitingRoom.players.set(socket.id, playerData);
        //console.log('Player added to waiting room:', playerData);
    
        // Si c'est le propriétaire, envoyer les paramètres
        if (shouldBeOwner) {
            socket.emit('gameSettingsUpdated', waitingRoom.settings);
        }
    
        const players = Array.from(waitingRoom.players.values());
        //console.log('Emitting updated players:', players);
        io.emit('updateWaitingRoom', players);
    });

    // Gestion du chat avec vérification
    socket.on('chatMessage', (data) => {
        // Vérifications de sécurité
        if (!data || !data.message || !data.nickname) {
            console.log('Message de chat invalide reçu:', data);
            return;
        }

        // Limiter la taille du message
        const message = data.message.slice(0, 200);
        
        try {
            // Diffuser le message à tous les joueurs dans la salle d'attente
            io.emit('newChatMessage', {
                message: message,
                nickname: data.nickname,
                timestamp: Date.now()
            });
            console.log(`Message de chat envoyé par ${data.nickname}`);
        } catch (error) {
            console.error('Erreur lors de l\'envoi du message:', error);
        }
    });

    socket.on('leaveWaitingRoom', () => {
        const player = waitingRoom.players.get(socket.id);
        if (player) {
            const wasOwner = player.isOwner;
            waitingRoom.players.delete(socket.id);
            waitingRoom.playersInGame.delete(socket.id);
    
            // Transférer la propriété si nécessaire
            if (wasOwner && waitingRoom.players.size > 0) {
                const nextPlayer = waitingRoom.players.values().next().value;
                if (nextPlayer) {
                    nextPlayer.isOwner = true;
                    const newOwnerSocket = io.sockets.sockets.get(nextPlayer.id);
                    if (newOwnerSocket) {
                        newOwnerSocket.emit('gameSettingsUpdated', waitingRoom.settings);
                    }
                }
            }
    
            // Informer tous les clients de la mise à jour
            io.emit('updateWaitingRoom', {
                players: Array.from(waitingRoom.players.values()),
                gameInProgress: waitingRoom.isGameStarted
            });
    
            io.emit('playerLeft', {
                nickname: player.nickname,
                wasOwner: wasOwner
            });
        }
    });

    socket.on('resetAndReturnToWaitingRoom', (data) => {
        // Vérifier que le joueur est propriétaire
        const player = waitingRoom.players.get(socket.id);
        if (!player?.isOwner) return;
        
        // Reset complet du jeu
        isGameOver = false;
        isPaused = false;
        totalPauseDuration = 0;
        pauseStartTime = null;
        gameStartTime = null;

        // Nettoyer l'interface
        activeBonusesContainer.innerHTML = '';
        playerListContainer.innerHTML = '';
        collectedBonusDisplay.classList.add('hidden');
    
        // Réinitialiser tous les joueurs
        for (let id in players) {
            players[id].captures = 0;
            players[id].capturedPlayers = {};
            players[id].capturedBy = {};
            players[id].botsControlled = 0;
            players[id].capturedByBlackBot = 0;
            players[id].speedBoostActive = false;
            players[id].invincibilityActive = false;
        }
    
        // Réinitialiser les bots et bonus
        blackBots = {};
        bots = {};
        bonuses = [];
        botsInitialized = false;
        specialZones.clear();
        activemalus.clear();
        document.body.classList.remove('reverse-controls', 'blur-vision', 'negative-vision');
        if (canvas.style.filter) {
            canvas.style.filter = 'none';
        }
    
        // Réinitialiser l'état de la partie dans la salle d'attente
        waitingRoom.isGameStarted = false;
    
        // Ajouter le joueur à la salle d'attente comme dans rejoinWaitingRoom
        const isEmptyRoom = waitingRoom.players.size === 0;
        const hasNoOwner = !Array.from(waitingRoom.players.values()).some(player => player.isOwner);
        const shouldBeOwner = isEmptyRoom || hasNoOwner;
    
        const playerData = {
            id: socket.id,
            nickname: data.nickname,
            isOwner: shouldBeOwner
        };
    
        waitingRoom.players.set(socket.id, playerData);
    
        // Si c'est le propriétaire, envoyer les paramètres actuels
        if (shouldBeOwner) {
            socket.emit('gameSettingsUpdated', waitingRoom.settings);
        }
    
        // Informer tous les joueurs des changements
        io.emit('updateWaitingRoom', Array.from(waitingRoom.players.values()));
    });

    socket.on('updateGameSettings', async (settings) => {
        const player = waitingRoom.players.get(socket.id);
        if (player?.isOwner) {
            // Filtrer les paramètres audio s'ils sont présents
            const { musicVolume, soundVolume, ...gameSettings } = settings;
                
            try {
                // Mise à jour normale
                waitingRoom.settings = {
                    ...waitingRoom.settings,
                    ...gameSettings,
                    enabledZones: {
                        ...waitingRoom.settings.enabledZones,
                        ...settings.enabledZones
                    },
                };
                
                // Informer tous les joueurs des changements
                io.emit('gameSettingsUpdated', waitingRoom.settings);
            } catch (error) {
                console.error('Erreur lors de la mise à jour des paramètres:', error);
                socket.emit('error', 'Erreur lors de la mise à jour des paramètres');
            }
        }
    });

            // Gestion séparée pour les paramètres de map
            socket.on('updateMapSettings', async (mapSettings) => {
                const player = waitingRoom.players.get(socket.id);
                if (player?.isOwner) {
                    try {
                        console.log('Réception updateMapSettings:', {
                            newMap: mapSettings.selectedMap,
                            newMirrorMode: mapSettings.mirrorMode,
                            currentMap: waitingRoom.settings.selectedMap,
                            currentMirrorMode: waitingRoom.settings.mirrorMode
                        });
            
                        // Vérifier si les paramètres de map changent réellement
                        if (mapSettings.selectedMap !== waitingRoom.settings.selectedMap || 
                            mapSettings.mirrorMode !== waitingRoom.settings.mirrorMode) {
                            
                            console.log('Changement de map détecté, mise à jour des collisions...');
                            
                            // Mettre à jour les collisions en premier
                            const collisionsUpdated = await collisionMap.updateCollisions(
                                mapSettings.selectedMap, 
                                mapSettings.mirrorMode
                            );
            
                            if (!collisionsUpdated) {
                                throw new Error('Échec de la mise à jour des collisions');
                            }
            
                            console.log('Collisions mises à jour avec succès');
                            
                            // Attendre un petit délai pour s'assurer que tout est bien initialisé
                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                            // Mettre à jour les paramètres de map
                            waitingRoom.settings = {
                                ...waitingRoom.settings,
                                selectedMap: mapSettings.selectedMap,
                                mirrorMode: mapSettings.mirrorMode
                            };
            
                            console.log('Paramètres de map mis à jour, notification des clients...');
            
                            // Informer tous les joueurs des changements
                            io.emit('gameSettingsUpdated', {
                                ...waitingRoom.settings,
                                mapUpdateRequired: true // Flag pour forcer la mise à jour de la map
                            });
            
                            console.log('Notification envoyée aux clients');
                        } else {
                            console.log('Aucun changement de map détecté');
                        }
                    } catch (error) {
                        console.error('Erreur lors de la mise à jour de la map:', error);
                        socket.emit('error', 'Erreur lors de la mise à jour de la map');
                    }
                } else {
                    console.log('Tentative de mise à jour de map par un non-propriétaire');
                }
            });

        // Paramètres audio (accessible à tous les joueurs)
    socket.on('updateAudioSettings', (audioSettings) => {
        const player = waitingRoom.players.get(socket.id);
        if (player) {
            // Stocker les paramètres audio pour ce joueur
            player.audioSettings = {
                musicVolume: audioSettings.musicVolume,
                soundVolume: audioSettings.soundVolume
            };
            
            // Confirmer uniquement au joueur qui a fait la modification
            socket.emit('audioSettingsUpdated', player.audioSettings);
        }
    });

    socket.on('resetGameSettings', () => {
        const player = waitingRoom.players.get(socket.id);
        if (player?.isOwner) {
            // Réinitialiser avec les paramètres par défaut
            waitingRoom.settings = { ...DEFAULT_GAME_SETTINGS };
            io.emit('gameSettingsUpdated', waitingRoom.settings);
        }
    });

    socket.on('startGameFromRoom', (data) => {
        const mapDimensions = MAP_DIMENSIONS[data.settings.selectedMap || 'map1'];
        const gameWidth = mapDimensions.width;
        const gameHeight = mapDimensions.height;
        const player = waitingRoom.players.get(socket.id);
        if (player?.isOwner) {
            // Si un countdown est déjà en cours, ne rien faire
            if (startCountdown) return;
    
            socket.removeAllListeners('cancelGameStart');
            let countdown = TIME_CONFIG.GAME_START_COUNTDOWN;
            let canCancel = true;
            
            io.emit('gameStartCountdown', { countdown, canCancel });
            
            startCountdown = setInterval(() => {
                countdown--;
                
                if (countdown <= 2) {
                    canCancel = false;
                }
                
                io.emit('gameStartCountdown', { countdown, canCancel });
                
                if (countdown <= 0) {
                    clearInterval(startCountdown);
                    startCountdown = null;
                    
                    // Reset complet du jeu
                    isGameOver = false;
                    isPaused = false;
                    totalPauseDuration = 0;
                    pauseStartTime = null;
                    gameStartTime = Date.now();
                    
                    // Réinitialiser d'abord les bots et bonus
                    blackBots = {};
                    bots = {};
                    bonuses = [];
                    botsInitialized = false;
                    specialZones.clear();
    
                    // Ensuite réinitialiser tous les joueurs
                    Object.values(players).forEach(player => {
                        resetPlayer(player);
                    });
    
                    // Le reste du code reste identique...
                    waitingRoom.isGameStarted = true;
                    
                    // Initialiser la partie pour tous les joueurs de la salle d'attente
                    waitingRoom.players.forEach((waitingPlayer, socketId) => {
                        // Mettre à jour le statut du joueur en attente
                        waitingPlayer.status = 'playing';  
                        waitingRoom.playersInGame.add(socketId);
    
                        const playerSocket = io.sockets.sockets.get(socketId);
                        if (playerSocket) {
                            // Créer un nouveau joueur s'il n'existe pas déjà
                            if (!players[socketId]) {
                                players[socketId] = new Player(socketId, waitingPlayer.nickname);
                                activeSockets[socketId] = playerSocket;
                            }
                            // Faire respawn tous les joueurs avec une nouvelle couleur
                            players[socketId].respawn();
                        }
                    });
    
                    // Réinitialiser les paramètres avec ceux de la salle d'attente
                    currentGameSettings = { ...waitingRoom.settings };
                    
                    // Initialiser les bots une seule fois pour la partie
                    createBots(currentGameSettings.initialBotCount);
                    botsInitialized = true;
    
                    // Informer tous les joueurs que la partie commence
                    io.emit('gameStarting');
                    
                    // Redémarrer le spawn des bonus
                    setTimeout(spawnBonus, 3000);
                    setTimeout(spawnMalus, 4000);
                }
            }, 1000);
    
            socket.on('cancelGameStart', () => {
                if (canCancel && startCountdown) {
                    clearInterval(startCountdown);
                    startCountdown = null;
                    io.emit('gameStartCancelled');
                }
            });
        }
    });

    socket.on('resetAndStartGame', (data) => {
        const player = waitingRoom.players.get(socket.id);
        if (player?.isOwner) {
            // Reset complet du jeu
            isGameOver = false;
            isPaused = false;
            totalPauseDuration = 0;
            pauseStartTime = null;
            gameStartTime = Date.now();
            
            // Réinitialiser tous les joueurs
            for (let id in players) {
                players[id].captures = 0;
                players[id].capturedPlayers = {};
                players[id].capturedBy = {};
                players[id].botsControlled = 0;
                players[id].capturedByBlackBot = 0;
                players[id].speedBoostActive = false;
                players[id].invincibilityActive = false;
            }
    
            // Réinitialiser les bots et bonus
            blackBots = {};
            bots = {};
            bonuses = [];
            botsInitialized = false;
            specialZones.clear();
            
            // Réinitialiser les paramètres avec ceux de la salle d'attente
            currentGameSettings = { ...waitingRoom.settings };
            waitingRoom.isGameStarted = true;
    
            // Réinitialiser tous les joueurs de la salle d'attente
            waitingRoom.players.forEach((waitingPlayer, socketId) => {
                const playerSocket = io.sockets.sockets.get(socketId);
                if (playerSocket) {
                    if (!players[socketId]) {
                        players[socketId] = new Player(socketId, waitingPlayer.nickname);
                        activeSockets[socketId] = playerSocket;
                    }
                    // Faire respawn tous les joueurs avec une nouvelle couleur
                    players[socketId].respawn();
                }
            });
    
            // Recréer les bots
            createBots(currentGameSettings.initialBotCount);
            botsInitialized = true;
    
            // Informer tous les joueurs du démarrage
            io.emit('gameStarting');
    
            // Redémarrer le spawn des bonus
            setTimeout(spawnBonus, 3000);

            setTimeout(spawnMalus, 4000);
        }
    });

    socket.on('move', (data) => {
        if (isPaused || isGameOver) return;
    
        const player = players[socket.id];
        if (!player || !data.isMoving) return;

        const mapDimensions = MAP_DIMENSIONS[currentGameSettings?.selectedMap || 'map1'];
        const currentWidth = mapDimensions.width;
        const currentHeight = mapDimensions.height;
    
        // Calculer la vitesse normalisée une seule fois au début
        const baseSpeed = SPEED_CONFIG.PLAYER_BASE_SPEED;
        const speedMultiplier = data.speedBoostActive ? SPEED_CONFIG.SPEED_BOOST_MULTIPLIER : 1;
        const mobileFactor = data.isMobile ? SPEED_CONFIG.MOBILE_SPEED_FACTOR : 1;
        const normalizedSpeed = baseSpeed * speedMultiplier * mobileFactor;
    
        // Normaliser le vecteur de mouvement reçu
        const magnitude = Math.sqrt(data.x * data.x + data.y * data.y);
        if (magnitude > 0) {
            data.x = (data.x / magnitude) * normalizedSpeed;
            data.y = (data.y / magnitude) * normalizedSpeed;
        }
    
        const oldX = player.x;
        const oldY = player.y;
        
        let desiredX = player.x + data.x;
        let desiredY = player.y + data.y;
        
        // Test du mouvement complet
        if (collisionMap.canMove(oldX, oldY, desiredX, desiredY)) {
            player.x = desiredX;
            player.y = desiredY;
        } else {
            // Essayer les mouvements séparés
            const canMoveX = collisionMap.canMove(oldX, oldY, desiredX, oldY);
            const canMoveY = collisionMap.canMove(oldX, oldY, oldX, desiredY);
            
            if (canMoveX) player.x = desiredX;
            if (canMoveY) player.y = desiredY;
            
            if (!canMoveX && !canMoveY) {
                const angles = [30, -30, 45, -45, 60, -60];
                let moved = false;
                
                for (const angle of angles) {
                    const rad = (angle * Math.PI) / 180;
                    // Utiliser normalizedSpeed qui est maintenant disponible dans cette portée
                    const testX = oldX + Math.cos(rad) * normalizedSpeed;
                    const testY = oldY + Math.sin(rad) * normalizedSpeed;
                    
                    if (collisionMap.canMove(oldX, oldY, testX, testY)) {
                        player.x = testX;
                        player.y = testY;
                        moved = true;
                        break;
                    }
                }
            }
        }
    
    // S'assurer que le joueur reste dans les limites
    player.x = Math.max(0, Math.min(currentWidth, player.x));
    player.y = Math.max(0, Math.min(currentHeight, player.y));
    
    // Mettre à jour la direction
    if (player.x !== oldX || player.y !== oldY) {
        player.updateDirection(player.x - oldX, player.y - oldY);
    } else {
        player.direction = DIRECTIONS.IDLE;
    }
    
    // Détecter les collisions avec les autres entités
    detectCollisions(player, socket.id);

    const now = Date.now();
    const lastEmit = playerLastSoundEmit.get(socket.id) || 0;

    if (now - lastEmit >= TIME_CONFIG.SOUND_EMIT_INTERVAL) {
    // Émettre le son aux autres joueurs
    Object.values(players).forEach(otherPlayer => {
        if (otherPlayer.id !== socket.id) {
            const dx = player.x - otherPlayer.x;
            const dy = player.y - otherPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Distance maximale d'audition
            const MAX_SOUND_DISTANCE = 300;
            
            if (distance <= MAX_SOUND_DISTANCE) {
                const volume = Math.max(0, 1 - (distance / MAX_SOUND_DISTANCE));
                
                io.to(otherPlayer.id).emit('playerSound', {
                    type: 'footstep',
                    playerId: socket.id,
                    distance: distance,
                    volume: volume,
                    isSpeedBoost: data.speedBoostActive
                });
            }
        }
    });
    playerLastSoundEmit.set(socket.id, now);
    }
    });

    socket.on('togglePause', () => {
        if (!isGameOver) {
            if (!isPaused) {
                isPaused = true;
                pausedBy = socket.id;
                pauseStartTime = Date.now();
                io.emit('pauseGame', { pausedBy: socket.id });
            } else if (pausedBy === socket.id) {
                isPaused = false;
                pausedBy = null;
                totalPauseDuration += Date.now() - pauseStartTime;
                pauseStartTime = null;
                io.emit('resumeGame');
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`Déconnexion du joueur: ${socket.id}`); // Debug log
    
        // Gérer la pause si nécessaire
        if (pausedBy === socket.id) {
            isPaused = false;
            pausedBy = null;
            if (pauseStartTime) {
                totalPauseDuration += Date.now() - pauseStartTime;
            }
            pauseStartTime = null;
            io.emit('resumeGame');
        }
    
        // Nettoyer les ressources du joueur
        delete players[socket.id];
        delete activeSockets[socket.id];

        waitingRoom.playersInGame.delete(socket.id);
        checkGameEndConditions();
    
        // Gérer la déconnexion dans la salle d'attente
        if (waitingRoom.players.has(socket.id)) {
            const disconnectedPlayer = waitingRoom.players.get(socket.id);
            const wasOwner = disconnectedPlayer.isOwner;
            waitingRoom.players.delete(socket.id);
            waitingRoom.playersInGame.delete(socket.id);
    
            // Transférer la propriété si nécessaire
            if (wasOwner && waitingRoom.players.size > 0) {
                const nextPlayer = waitingRoom.players.values().next().value;
                if (nextPlayer) {
                    nextPlayer.isOwner = true;
                    const newOwnerSocket = io.sockets.sockets.get(nextPlayer.id);
                    if (newOwnerSocket) {
                        newOwnerSocket.emit('gameSettingsUpdated', waitingRoom.settings);
                    }
                }
            }
    
            // Informer tous les clients de la mise à jour
            io.emit('updateWaitingRoom', {
                players: Array.from(waitingRoom.players.values()),
                gameInProgress: waitingRoom.isGameStarted
            });
    
            // Si c'était le dernier joueur, réinitialiser la partie
            if (waitingRoom.players.size === 0) {
                resetGame();
                waitingRoom.isGameStarted = false;
            }
    
            // Notifier les autres joueurs
            io.emit('playerLeft', {
                nickname: disconnectedPlayer.nickname,
                wasOwner: wasOwner
            });
        }
                // Informer les autres joueurs de la déconnexion pour le chat
                if (players[socket.id]) {
                    io.emit('newChatMessage', {
                        message: `${players[socket.id].nickname} a quitté la partie`,
                        nickname: 'Système',
                        timestamp: Date.now()
                    });
                }
    });
});

// Démarrer les intervalles de mise à jour
setInterval(() => {
    if (!isPaused && !isGameOver) {
        updateBots();
        updatePlayerBonuses();
        sendUpdates();
    }
}, TIME_CONFIG.UPDATE_INTERVAL);

// Premier spawn de bonus
setTimeout(spawnBonus, 3000);

setTimeout(spawnMalus, 4000);

// Démarrage du serveur
server.listen(PORT, () => {
    console.log(`Serveur en écoute sur le port ${PORT}`);
});