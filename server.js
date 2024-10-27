// server.js

// Import des dépendances
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const GAME_WIDTH = 2000;
const GAME_HEIGHT = 1500;

// Configuration des fichiers statiques
app.use('/assets', express.static(__dirname + '/assets'));
app.use(express.static(__dirname + '/public'));

// Paramètres par défaut du jeu
const DEFAULT_GAME_SETTINGS = {
    gameDuration: 180,
    enableSpeedBoost: true,
    speedBoostDuration: 10,
    enableInvincibility: true,
    invincibilityDuration: 10,
    enableReveal: true,
    revealDuration: 10,
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
    pointsLossPercent: 50 // Pourcentage de points perdus lors d'une capture
};


const waitingRoom = {
    players: new Map(),
    isGameStarted: false,
    settings: { ...DEFAULT_GAME_SETTINGS } // Ajout des paramètres par défaut
};

const PORT = process.env.PORT || 3000;

// Constantes du jeu
const SPAWN_PROTECTION_TIME = 3000;
const CAPTURE_COOLDOWN = 1000;
const SAFE_SPAWN_DISTANCE = 100;
const BOT_SPEED = 5;
const UPDATE_INTERVAL = 50;

// Variables globales
let players = {};
let bots = {};
let blackBots = {};
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
const activeSockets = {};
let pausedBy = null;

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

    generateRandomShape() {
        // Calculer la taille maximale (1/5 de la zone de jeu)
        const maxArea = (GAME_WIDTH * GAME_HEIGHT) / 5;
        
        // Choisir aléatoirement entre cercle et rectangle
        const isCircle = Math.random() < 0.5;
        
        if (isCircle) {
            const maxRadius = Math.sqrt(maxArea / Math.PI);
            const radius = Math.random() * (maxRadius - 50) + 50;
            const x = radius + Math.random() * (GAME_WIDTH - 2 * radius);
            const y = radius + Math.random() * (GAME_HEIGHT - 2 * radius);
            
            return {
                type: 'circle',
                x,
                y,
                radius
            };
        } else {
            const aspect = 0.5 + Math.random(); // ratio largeur/hauteur entre 0.5 et 1.5
            const maxWidth = Math.sqrt(maxArea * aspect);
            const maxHeight = maxArea / maxWidth;
            
            const width = Math.random() * (maxWidth - 100) + 100;
            const height = Math.random() * (maxHeight - 100) + 100;
            const x = Math.random() * (GAME_WIDTH - width);
            const y = Math.random() * (GAME_HEIGHT - height);
            
            return {
                type: 'rectangle',
                x,
                y,
                width,
                height
            };
        }
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
        this.capturedByBlackBot = 0;  // Nouveau compteur
        this.spawnProtection = Date.now() + SPAWN_PROTECTION_TIME;
        this.lastCapture = 0;
        this.type = 'player';
        this.speedBoostActive = false;
        this.invincibilityActive = false;
    }

    isInvulnerable() {
        // Retourner true si le joueur a soit la protection au spawn, soit le bonus d'invincibilité
        return this.invincibilityActive || Date.now() < this.spawnProtection;
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

            if (this.isMoving) {
                this.changeDirection();
            }
        }

        if (this.isMoving) {
            this.move();
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
    
    // Parcourir toutes les entités pour trouver les plus proches
    Object.values(entities).forEach(entity => {
        if (entity.id === this.id) return;
        const distance = this.getDistanceTo(entity);
    
        // Ne considérer que les entités dans le rayon de détection
        if (distance < this.detectionRadius) {
            // Prioriser les joueurs non invincibles
            if (entity.type === 'player' && !entity.invincibilityActive) {
                if (distance < nearestPlayerDistance) {
                    nearestPlayerDistance = distance;
                    nearestPlayer = entity;
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
    
    // Prioriser un joueur si présent dans le rayon, sinon prendre un bot
    if (nearestPlayer) {
        //console.log('Setting target to player'); // Debug log
        this.targetEntity = nearestPlayer;
    } else if (nearestNormalBot) {
        //console.log('Setting target to bot'); // Debug log
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
    
        // Double vérification de l'invincibilité
        if (entity.type === 'player') {
            // Vérifier explicitement à la fois invincibilityActive et la protection au spawn
            if (entity.invincibilityActive || entity.isInvulnerable()) {
                // Si le joueur est invincible, il peut capturer le bot noir
                this.destroyed = true;
                delete blackBots[this.id];
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
        this.lifetime = 8000; // 8 secondes en millisecondes
    }

    isExpired() {
        return Date.now() - this.createdAt >= this.lifetime;
    }
}

// Nettoyer les bonus expirés
function cleanExpiredBonuses() {
    bonuses = bonuses.filter(bonus => !bonus.isExpired());
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

    const availableBonuses = [
        ...(currentGameSettings.enableSpeedBoost ? ['speed'] : []),
        ...(currentGameSettings.enableInvincibility ? ['invincibility'] : []),
        ...(currentGameSettings.enableReveal ? ['reveal'] : [])
    ];

    if (availableBonuses.length > 0) {
        const randomType = availableBonuses[Math.floor(Math.random() * availableBonuses.length)];
        bonuses.push(new Bonus(randomType));
    }

    setTimeout(spawnBonus, Math.random() * 5000 + 3000);
}

function handleBonusCollection(player, bonus) {
    const socket = activeSockets[player.id];
    if (!socket) return;

    const bonusDurations = {
        speed: currentGameSettings.speedBoostDuration,
        invincibility: currentGameSettings.invincibilityDuration,
        reveal: currentGameSettings.revealDuration
    };

    switch(bonus.type) {
        case 'speed':
            player.speedBoostActive = true;
            setTimeout(() => {
                player.speedBoostActive = false;
            }, bonusDurations[bonus.type] * 1000);
            break;
        case 'invincibility':
            player.invincibilityActive = true;
            setTimeout(() => {
                player.invincibilityActive = false;
            }, bonusDurations[bonus.type] * 1000);
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

    // Ajouter : Collisions avec les bots noirs
    if (entity.type === 'player') {
        Object.entries(blackBots).forEach(([blackBotId, blackBot]) => {
            const dx = entity.x - blackBot.x;
            const dy = entity.y - blackBot.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 20) {
                // Si le joueur est invincible, il peut capturer le bot noir
                if (entity.invincibilityActive) {
                    delete blackBots[blackBotId];
                    const socket = activeSockets[entity.id];
                    if (socket) {
                        socket.emit('playerCapturedEnemy', {
                            capturedNickname: 'Bot Noir',
                            message: 'Vous avez détruit un Bot Noir !'
                        });
                    }
                }
            }
        });
    }

    // Collisions avec les bonus
    if (entity.type === 'player') {
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

    // Nettoyer les bonus expirés
    cleanExpiredBonuses();

    // Gérer les zones spéciales
    manageSpecialZones();

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
        // Ajouter d'abord les joueurs
        ...Object.values(players).map(player => ({
            id: player.id,
            x: player.x,
            y: player.y,
            color: player.color,
            type: 'player',
            nickname: player.nickname,
            invincibilityActive: player.invincibilityActive
        })),
        // Puis les bots normaux
        ...Object.values(bots).map(bot => ({
            id: bot.id,
            x: bot.x,
            y: bot.y,
            color: bot.color,
            type: 'bot'
        })),
        // Enfin les bots noirs
        ...Object.values(blackBots).map(bot => ({
            id: bot.id,
            x: bot.x,
            y: bot.y,
            color: bot.color,
            type: 'blackBot',
            detectionRadius: currentGameSettings.blackBotDetectionRadius
        }))
    ];

    // Calculer les scores des joueurs
    const playerScores = calculatePlayerScores();

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
            type: bonus.type
        })),
        // Inclure les zones spéciales
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
    
    // Réinitialiser les joueurs
    for (let id in players) {
        players[id].respawn();
        players[id].captures = 0;
    }

    // Réinitialiser les bots
    blackBots = {};
    bots = {};
    botsInitialized = false;

    // Réinitialiser les bonus
    bonuses = [];

    // Redémarrer le spawn des bonus
    setTimeout(spawnBonus, 3000);
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
    console.log(`Nouvelle connexion : ${socket.id}`);

    socket.on('joinWaitingRoom', (nickname) => {
        console.log('Player joining waiting room:', {
            socketId: socket.id,
            nickname,
            currentPlayers: Array.from(waitingRoom.players.values())
        });
    
        // Même logique : premier joueur ou pas de propriétaire devient propriétaire
        const isEmptyRoom = waitingRoom.players.size === 0;
        const hasNoOwner = !Array.from(waitingRoom.players.values()).some(player => player.isOwner);
        const shouldBeOwner = isEmptyRoom || hasNoOwner;
    
        console.log('Owner check:', {
            isEmptyRoom,
            hasNoOwner,
            shouldBeOwner
        });
    
        const playerData = {
            id: socket.id,
            nickname: nickname,
            isOwner: shouldBeOwner
        };
    
        waitingRoom.players.set(socket.id, playerData);
        console.log('Player added to waiting room:', playerData);
    
        // Si c'est le propriétaire, envoyer les paramètres actuels
        if (shouldBeOwner) {
            socket.emit('gameSettingsUpdated', waitingRoom.settings);
        }
    
        // Envoyer la liste mise à jour à tous les joueurs
        const players = Array.from(waitingRoom.players.values());
        console.log('Emitting updated players:', players);
        io.emit('updateWaitingRoom', players);
    });

    socket.on('rejoinWaitingRoom', (data) => {
        const { nickname, wasInGame } = data;
        console.log('Player rejoining waiting room:', {
            socketId: socket.id,
            nickname,
            wasInGame,
            currentPlayers: Array.from(waitingRoom.players.values())
        });
    
        // Vérifier si ce joueur était propriétaire avant
        const existingPlayer = waitingRoom.players.get(socket.id);
        const wasOwner = existingPlayer?.isOwner;
    
        // Si la salle est vide OU s'il n'y a aucun propriétaire OU si le joueur était propriétaire
        const isEmptyRoom = waitingRoom.players.size === 0;
        const hasNoOwner = !Array.from(waitingRoom.players.values()).some(player => player.isOwner);
        const shouldBeOwner = isEmptyRoom || hasNoOwner || wasOwner;
    
        console.log('Owner check:', {
            isEmptyRoom,
            hasNoOwner,
            wasOwner,
            shouldBeOwner
        });
    
        const playerData = {
            id: socket.id,
            nickname: nickname,
            isOwner: shouldBeOwner
        };
    
        waitingRoom.players.set(socket.id, playerData);
        console.log('Player added to waiting room:', playerData);
    
        // Si c'est le propriétaire, envoyer les paramètres
        if (shouldBeOwner) {
            socket.emit('gameSettingsUpdated', waitingRoom.settings);
        }
    
        const players = Array.from(waitingRoom.players.values());
        console.log('Emitting updated players:', players);
        io.emit('updateWaitingRoom', players);
    });

    socket.on('leaveWaitingRoom', () => {
        const isOwner = waitingRoom.players.get(socket.id)?.isOwner;
        waitingRoom.players.delete(socket.id);
        
        // Si le propriétaire part et qu'il reste des joueurs
        if (isOwner && waitingRoom.players.size > 0) {
            const [firstPlayerId] = waitingRoom.players.keys();
            const firstPlayer = waitingRoom.players.get(firstPlayerId);
            if (firstPlayer) {
                firstPlayer.isOwner = true;
            }
        }
        
        io.emit('updateWaitingRoom', Array.from(waitingRoom.players.values()));
    });

    socket.on('resetAndReturnToWaitingRoom', (data) => {
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

    socket.on('startGameFromRoom', (data) => {
        const player = waitingRoom.players.get(socket.id);
        console.log('Start game request from:', socket.id, 'isOwner:', player?.isOwner); // Debug log
        
        if (player?.isOwner) {
            console.log('Starting game with settings:', waitingRoom.settings); // Debug log
            
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
        }
    });

    socket.on('move', (data) => {
        if (isPaused || isGameOver) return;
    
        const player = players[socket.id];
        if (player) {
            const moveSpeed = data.speedBoostActive ? 1.3 : 1;
            player.x += data.x * moveSpeed;
            player.y += data.y * moveSpeed;
            
            player.x = Math.max(0, Math.min(GAME_WIDTH, player.x));
            player.y = Math.max(0, Math.min(GAME_HEIGHT, player.y));
    
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
        console.log(`Déconnexion : ${socket.id}`);
        delete players[socket.id];
        delete activeSockets[socket.id];
    
        if (Object.keys(players).length === 0) {
            resetGame();
        }
    
        // Gérer le transfert de propriété
        if (waitingRoom.players.has(socket.id)) {
            const disconnectedPlayer = waitingRoom.players.get(socket.id);
            const wasOwner = disconnectedPlayer.isOwner;
            waitingRoom.players.delete(socket.id);
    
            // Si le propriétaire se déconnecte et qu'il reste des joueurs
            if (wasOwner && waitingRoom.players.size > 0) {
                const [firstPlayerId] = waitingRoom.players.keys();
                const firstPlayer = waitingRoom.players.get(firstPlayerId);
                if (firstPlayer) {
                    console.log('Transferring ownership to:', firstPlayer.nickname);
                    firstPlayer.isOwner = true;
    
                    // Informer le nouveau propriétaire
                    const newOwnerSocket = io.sockets.sockets.get(firstPlayerId);
                    if (newOwnerSocket) {
                        newOwnerSocket.emit('gameSettingsUpdated', waitingRoom.settings);
                    }
    
                    // Mettre à jour immédiatement la liste pour tous
                    io.emit('updateWaitingRoom', Array.from(waitingRoom.players.values()));
                }
            }
        }
    });
});

// Démarrer les intervalles de mise à jour
setInterval(() => {
    if (!isPaused && !isGameOver) {
        updateBots();
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

// Démarrage du serveur
server.listen(PORT, () => {
    console.log(`Serveur en écoute sur le port ${PORT}`);
});