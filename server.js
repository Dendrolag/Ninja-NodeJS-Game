// server.js

// Import des dépendances
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const GAME_WIDTH = 2000;
const GAME_HEIGHT = 1500;

// Paramètres par défaut du jeu
const DEFAULT_GAME_SETTINGS = {
    gameDuration: 180,
    enableSpeedBoost: true,
    speedBoostDuration: 10,
    speedBoostSpawnRate: 25, // pourcentage de chance d'apparition
    enableInvincibility: true,
    invincibilityDuration: 10,
    invincibilitySpawnRate: 15,
    enableReveal: true,
    revealDuration: 10,
    revealSpawnRate: 20,
    bonusSpawnInterval: 4, // intervalle en secondes entre chaque tentative d'apparition de bonus
    initialBotCount: 30,
    enableSpecialZones: true,
    zoneMinDuration: 10,  // durée minimale en secondes
    zoneMaxDuration: 30,  // durée maximale en secondes
    zoneSpawnInterval: 15, // intervalle d'apparition en secondes
    enabledZones: {  // Ajout de cette configuration
        CHAOS: true,
        REPEL: true,
        ATTRACT: true,
        STEALTH: true
    
    },
    enableBlackBot: true,  // Activé par défaut maintenant
    blackBotCount: 2,
    blackBotStartPercent: 50, // Apparaît à 50% du temps de la partie
    blackBotDetectionRadius: 150, // Rayon de détection en pixels
    blackBotSpeed: 6, // Vitesse légèrement supérieure aux bots normaux
    pointsLossPercent: 50, // Pourcentage de points perdus lors d'une capture

    // Paramètres des malus
    enableMalus: true,
    malusSpawnInterval: 8, // Intervalle d'apparition en secondes
    malusSpawnRate: 20,    // Taux d'apparition en pourcentage

    enableReverseControls: true,
    enableBlurVision: true,
    enableNegativeVision: true,
    
    // Durées des différents malus (en secondes)
    reverseControlsDuration: 10,
    blurDuration: 12,
    negativeDuration: 14,
};

const DIRECTIONS = {
    IDLE: 'idle',
    NORTH: 'north',
    NORTH_EAST: 'north_east',
    EAST: 'east',
    SOUTH_EAST: 'south_east',
    SOUTH: 'south',
    SOUTH_WEST: 'south_west',
    WEST: 'west',
    NORTH_WEST: 'north_west'
};

// Configuration des fichiers statiques
app.use('/assets', express.static(__dirname + '/assets'));
app.use(express.static(__dirname + '/public'));

// Variables globales
let players = {};
let bots = {};
let blackBots = {};
const activeSockets = {};
let bonuses = [];
let gameStartTime = Date.now();
let currentGameSettings = { ...DEFAULT_GAME_SETTINGS };
let isPaused = false;
let isGameOver = false;
let pauseStartTime = null;
let totalPauseDuration = 0;
let botsInitialized = false;
let specialZones = new Set();
let zoneSpawnTimeout = null;
let pausedBy = null;
let activemalus = new Map();
let malusItems = [];

const waitingRoom = {
    players: new Map(),
    isGameStarted: false,
    settings: { ...DEFAULT_GAME_SETTINGS }, // Ajout des paramètres par défaut
    playersInGame: new Set() // ensemble des IDs des joueurs en partie
};

const PORT = process.env.PORT || 3000;

// Constantes du jeu
const SPAWN_PROTECTION_TIME = 3000;
const CAPTURE_COOLDOWN = 1000;
const SAFE_SPAWN_DISTANCE = 100;
const BOT_SPEED = 5;
const UPDATE_INTERVAL = 50;

const availableColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

// Constantes pour les zones
const ZONE_TYPES = {
    CHAOS: {
        id: 'CHAOS',
        name: 'Zone de Chaos',
        color: 'rgba(255, 64, 64, 0.2)',
        borderColor: 'rgba(255, 64, 64, 0.6)'
    },
    REPEL: {
        id: 'REPEL',
        name: 'Zone Répulsive',
        color: 'rgba(64, 64, 255, 0.2)',
        borderColor: 'rgba(64, 64, 255, 0.6)'
    },
    ATTRACT: {
        id: 'ATTRACT',
        name: 'Zone Attractive',
        color: 'rgba(64, 255, 64, 0.2)',
        borderColor: 'rgba(64, 255, 64, 0.6)'
    },
    STEALTH: {
        id: 'STEALTH',
        name: 'Zone d\'Invisibilité',
        color: 'rgba(128, 0, 128, 0.2)',
        borderColor: 'rgba(128, 0, 128, 0.6)'
    }
};

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

// Zones rondes :
generateRandomShape() {
    // Calculer la taille maximale (1/5 de la zone de jeu)
    const maxArea = (GAME_WIDTH * GAME_HEIGHT) / 5;
    
    // Calculer le rayon maximal à partir de l'aire
    const maxRadius = Math.sqrt(maxArea / Math.PI);
    
    // Générer un rayon aléatoire entre 150 et maxRadius
    const minRadius = 150;
    const radius = Math.random() * (maxRadius - minRadius) + minRadius;
    
    // Positionner le cercle en s'assurant qu'il reste dans les limites du jeu
    const x = radius + Math.random() * (GAME_WIDTH - 2 * radius);
    const y = radius + Math.random() * (GAME_HEIGHT - 2 * radius);
    
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

    // Notifier immédiatement tous les joueurs
    io.emit('malusEvent', {
        type: malus.type,
        duration: malusDurations[malus.type],
        collectorId: player.id,
        collectorNickname: player.nickname
    });

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

    // Notifications
    if (victimSocket) {
        victimSocket.emit('playerCaptured', {
            newColor: victim.color,
            capturedBy: attacker.nickname,
            totalTimesCaptured: Object.values(victim.capturedBy)
                .reduce((sum, cap) => sum + cap.count, 0)
        });
    }

    if (attackerSocket) {
        attackerSocket.emit('playerCapturedEnemy', {
            capturedNickname: victim.nickname,
            captures: attacker.captures,
            botsControlled: attacker.botsControlled,
            captureDetails: attacker.capturedPlayers
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
        this.x = Math.random() * GAME_WIDTH;
        this.y = Math.random() * GAME_HEIGHT;
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
}

class Player extends Entity {
    constructor(id, nickname) {
        super(id, getUniqueColor());
        this.nickname = nickname;
        this.captures = 0;
        this.capturedPlayers = {};
        this.capturedBy = {};
        this.botsControlled = 0;
        this.totalBotsCaptures = 0;
        this.capturedByBlackBot = 0;
        this.spawnProtection = Date.now() + SPAWN_PROTECTION_TIME;
        this.lastCapture = 0;
        this.type = 'player';
        this._invincibilityActive = false; // Nouvelle propriété privée
        this.speedBoostActive = false;
        this.bonusStartTime = 0;
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
        const spawnPos = getSpawnPosition();
        this.x = spawnPos.x;
        this.y = spawnPos.y;
        
        // Ne changer la couleur que si keepColor est false
        if (!keepColor) {
            this.color = getUniqueColor(excludeColors);
        }
        this.spawnProtection = Date.now() + SPAWN_PROTECTION_TIME;
    }

    canCapture() {
        return Date.now() - this.lastCapture > CAPTURE_COOLDOWN;
    }
}

class Bot extends Entity {
    constructor(id) {
        super(id);
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.changeDirectionInterval = Math.random() * 2000 + 1000;
        this.lastDirectionChange = Date.now();
        this.isMoving = true;
        this.stateDuration = Math.random() * 2000 + 1000;
        this.lastStateChange = Date.now();
        this.type = 'bot';
    }

    update() {
        if (isPaused || isGameOver) return;

        const now = Date.now();

        if (now - this.lastStateChange > this.stateDuration) {
            this.isMoving = !this.isMoving;
            this.lastStateChange = now;
            this.stateDuration = Math.random() * 2000 + 1000;

            if (!this.isMoving) {
                this.direction = DIRECTIONS.IDLE;
            }
        }

        if (this.isMoving) {
            const oldX = this.x;
            const oldY = this.y;
            this.move();
            this.updateDirection(this.x - oldX, this.y - oldY);
        }
    }

    move() {
        const now = Date.now();

        if (now - this.lastDirectionChange > this.changeDirectionInterval) {
            this.changeDirection();
            this.lastDirectionChange = now;
            this.changeDirectionInterval = Math.random() * 2000 + 1000;
        }

        this.x += this.vx * BOT_SPEED;
        this.y += this.vy * BOT_SPEED;

        if (this.x <= 0 || this.x >= GAME_WIDTH) {
            this.vx *= -1;
            this.x = Math.max(0, Math.min(GAME_WIDTH, this.x));
        }
        if (this.y <= 0 || this.y >= GAME_HEIGHT) {
            this.vy *= -1;
            this.y = Math.max(0, Math.min(GAME_HEIGHT, this.y));
        }

        // Mise à jour de la direction en fonction du mouvement
        this.updateDirection(this.vx * BOT_SPEED, this.vy * BOT_SPEED);
    }

    changeDirection() {
        const angleChange = (Math.random() - 0.5) * Math.PI;
        const currentAngle = Math.atan2(this.vy, this.vx);
        const newAngle = currentAngle + angleChange;
        
        const speed = 1;
        this.vx = Math.cos(newAngle) * speed;
        this.vy = Math.sin(newAngle) * speed;
    }
}

class BlackBot extends Bot {
    constructor(id) {
        super(id);
        this.color = '#000000';  // Couleur noire
        this.type = 'blackBot';
        this.lastCaptureTime = 0;
        this.captureCooldown = 2000; // 2 secondes entre chaque capture
        this.detectionRadius = DEFAULT_GAME_SETTINGS.blackBotDetectionRadius;
        this.targetEntity = null;
        this.baseSpeed = BOT_SPEED; // Utiliser la même vitesse que les autres bots
        this.lastTargetSearch = 0;

        // Repositionner le bot noir à une position sûre lors de sa création
        const spawnPos = getSpawnPosition();
        this.x = spawnPos.x;
        this.y = spawnPos.y;
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
        const dx = this.targetEntity.x - this.x;
        const dy = this.targetEntity.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

    // Normaliser et appliquer la vitesse
    if (distance > 0) {
        this.vx = (dx / distance) * this.baseSpeed;
        this.vy = (dy / distance) * this.baseSpeed;
    }

        // Déplacement
        this.x += this.vx;
        this.y += this.vy;

        // Garder dans les limites
        this.x = Math.max(0, Math.min(GAME_WIDTH, this.x));
        this.y = Math.max(0, Math.min(GAME_HEIGHT, this.y));

        // Vérifier collision avec la cible
        if (distance < 20) {  // Même distance de capture que les autres entités
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
                message: `Capturé par un Bot Noir ! Vous avez perdu ${pointsLost} points.`
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
        this.x = Math.random() * GAME_WIDTH;
        this.y = Math.random() * GAME_HEIGHT;
        this.createdAt = Date.now();
        this.lifetime = 8000; // 8 secondes
        this.warningThreshold = 3000; // 3 secondes avant disparition
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
        this.x = Math.random() * GAME_WIDTH;
        this.y = Math.random() * GAME_HEIGHT;
        this.createdAt = Date.now();
        this.lifetime = 8000; // 8 secondes
        this.warningThreshold = 3000; // 3 secondes avant disparition
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

// Dans server.js, ajoutons une constante pour la marge
const SPAWN_MARGIN = 100; // 100 pixels de marge depuis les bords

function getSpawnPosition() {
    const MAX_ATTEMPTS = 10;
    let attempts = 0;
    
    while (attempts < MAX_ATTEMPTS) {
        // Générer une position aléatoire en tenant compte des marges
        const x = SPAWN_MARGIN + Math.random() * (GAME_WIDTH - 2 * SPAWN_MARGIN);
        const y = SPAWN_MARGIN + Math.random() * (GAME_HEIGHT - 2 * SPAWN_MARGIN);
        
        let isSafe = true;

        // Vérifier la distance avec les autres entités
        const checkEntity = (entity) => {
            const dx = x - entity.x;
            const dy = y - entity.y;
            return Math.sqrt(dx * dx + dy * dy) >= SAFE_SPAWN_DISTANCE;
        };

        if (Object.values(players).every(checkEntity) && Object.values(bots).every(checkEntity)) {
            return { x, y };
        }

        attempts++;
    }

    // Même en cas d'échec des tentatives, on respecte les marges
    return {
        x: SPAWN_MARGIN + Math.random() * (GAME_WIDTH - 2 * SPAWN_MARGIN),
        y: SPAWN_MARGIN + Math.random() * (GAME_HEIGHT - 2 * SPAWN_MARGIN)
    };
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
            player.bonusTimers.invincibility = duration;
            player.bonusStartTime = Date.now();
            //console.log(`Invincibilité activée pour ${player.nickname} pour ${duration} secondes`);
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
        /*console.log('État du joueur:', {
            id: entity.id,
            invincibilityActive: player.invincibilityActive,
            isInvulnerable: player.isInvulnerable(),
            bonusTimers: player.bonusTimers
        });*/
    
        Object.entries(blackBots).forEach(([blackBotId, blackBot]) => {
            const dx = entity.x - blackBot.x;
            const dy = entity.y - blackBot.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 20) {
                // IMPORTANT : Vérification stricte de l'invincibilité
                const player = players[entity.id];
                // Le joueur ne peut interagir avec le bot noir QUE s'il est actuellement invincible
                if (player && player.invincibilityActive === true) {
                    delete blackBots[blackBotId];
                    const socket = activeSockets[entity.id];
                    if (socket) {
                        socket.emit('playerCapturedEnemy', {
                            capturedNickname: 'Bot Noir',
                            message: 'Vous avez détruit un Bot Noir !'
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
        // Compter seulement les bots non blancs contrôlés par le joueur
        const controlledPoints = Object.values(bots)
            .filter(bot => bot.color === player.color)
            .length;
        
        scores.push({
            id: player.id,
            nickname: player.nickname,
            currentBots: controlledPoints, // Ce nombre devrait être correct
            totalBotsControlled: player.totalBotsCaptures,
            captures: player.captures,
            capturedPlayers: player.capturedPlayers,
            capturedBy: player.capturedBy,
            capturedByBlackBot: player.capturedByBlackBot,
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

function endGame() {
    isGameOver = true;
    const scores = calculatePlayerScores();

    // Informer tous les joueurs de la fin de la partie
    for (let socketId in activeSockets) {
        activeSockets[socketId].emit('gameOver', { scores: scores });
    }
}

function resetGame() {
    // Réinitialiser les états du jeu
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
        players[id].revealActive = false;
        if (players[id].bonusTimers) {
            players[id].bonusTimers = {
                speed: 0,
                invincibility: 0,
                reveal: 0
            };
        }
    }

    // Réinitialiser les bots
    blackBots = {};
    bots = {};
    botsInitialized = false;

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

    const nickname = data.nickname || 'Joueur';
    
    // Vérifier si le joueur existe déjà
    if (!players[socket.id]) {
        players[socket.id] = new Player(socket.id, nickname);
        activeSockets[socket.id] = socket;
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
            const spawnPos = getSpawnPosition();
            newPlayer.x = spawnPos.x;
            newPlayer.y = spawnPos.y;
            newPlayer.spawnProtection = Date.now() + SPAWN_PROTECTION_TIME;
    
            // Mettre à jour le statut dans la salle d'attente
            const playerData = waitingRoom.players.get(socket.id);
            if (playerData) {
                playerData.status = 'playing';
                waitingRoom.playersInGame.add(socket.id);
            }
    
            // Informer tous les joueurs de l'arrivée du nouveau joueur
            io.emit('playerJoined', {
                nickname: data.nickname,
                id: socket.id
            });
    
            // Mettre à jour la salle d'attente
            io.emit('updateWaitingRoom', {
                players: Array.from(waitingRoom.players.values()),
                gameInProgress: waitingRoom.isGameStarted
            });
    
            // Faire rejoindre le jeu au nouveau joueur
            socket.emit('gameStarting');
    
            console.log(`Joueur ${data.nickname} a rejoint la partie avec succès`);
    
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

    socket.on('chatMessage', (data) => {
        // Limiter la taille du message
        const message = data.message.slice(0, 200);
        
        // Diffuser le message à tous les joueurs dans la salle d'attente
        io.emit('newChatMessage', {
            message: message,
            nickname: data.nickname,
            timestamp: data.timestamp
        });
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

    socket.on('updateGameSettings', (settings) => {
        const player = waitingRoom.players.get(socket.id);
        if (player?.isOwner) {
            waitingRoom.settings = {
                ...waitingRoom.settings,
                ...settings,
                enabledZones: {
                    ...waitingRoom.settings.enabledZones,
                    ...settings.enabledZones
                }
            };
            
            // Informer tous les joueurs des changements
            io.emit('gameSettingsUpdated', waitingRoom.settings);
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
    
            waitingRoom.isGameStarted = true;
                
            // Initialiser la partie pour tous les joueurs de la salle d'attente
            waitingRoom.players.forEach((waitingPlayer, socketId) => {
                // Mettre à jour le statut du joueur en attente
                waitingPlayer.status = 'playing';  // Utiliser waitingPlayer au lieu de player
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
        if (player) {
            const moveSpeed = data.speedBoostActive ? 1.3 : 1;
            const oldX = player.x;
            const oldY = player.y;
                
            player.x += data.x * moveSpeed;
            player.y += data.y * moveSpeed;
                
            // Garder le joueur dans les limites
            player.x = Math.max(0, Math.min(GAME_WIDTH, player.x));
            player.y = Math.max(0, Math.min(GAME_HEIGHT, player.y));
                
            // Mettre à jour la direction
            if (Math.abs(data.x) < 0.1 && Math.abs(data.y) < 0.1) {
                player.direction = DIRECTIONS.IDLE;
            } else {
                player.updateDirection(data.x, data.y);
            }
                
            detectCollisions(player, socket.id);
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
    });
});

// Démarrer les intervalles de mise à jour
setInterval(() => {
    if (!isPaused && !isGameOver) {
        updateBots();
        updatePlayerBonuses(); // Ajouter cette ligne
        sendUpdates();
    }
}, UPDATE_INTERVAL);

// Intervalle pour l'ajout de nouveaux bots
setInterval(() => {
    if (!isPaused && !isGameOver && Object.keys(bots).length < currentGameSettings.initialBotCount * 2) {
        addBot();
    }
}, 3000);

// Premier spawn de bonus
setTimeout(spawnBonus, 3000);

setTimeout(spawnMalus, 4000);

// Démarrage du serveur
server.listen(PORT, () => {
    console.log(`Serveur en écoute sur le port ${PORT}`);
});