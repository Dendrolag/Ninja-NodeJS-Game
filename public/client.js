// public/client.js

// Socket.io et variables globales
let socket;

import { MapManager } from './js/MapManager.js';
import { AudioManager } from './js/AudioManager.js';

// Éléments DOM principaux
const mainMenu = document.getElementById('mainMenu');
const gameScreen = document.getElementById('gameScreen');
const nicknameInput = document.getElementById('nicknameInput');

const GAME_VERSION = "v0.7.2";  // À mettre à jour à chaque déploiement

// Menu des paramètres et ses éléments
const settingsMenu = document.getElementById('settingsMenu');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const backToMenuButton = document.getElementById('backToMenuButton');
const resetSettingsButton = document.getElementById('resetSettingsButton');
const WARNING_THRESHOLD = 3000; // 3 secondes avant disparition

// Éléments de la salle d'attente
const waitingRoomScreen = document.getElementById('waitingRoom');
const playersList = document.getElementById('waitingRoomPlayers');
const startGameButton = document.getElementById('startGameButton');
const settingsButton = document.getElementById('waitingRoomSettings'); // Un seul bouton de paramètres
const leaveRoomButton = document.getElementById('leaveRoomButton');

const GAME_VIRTUAL_WIDTH = 2000;  // Taille virtuelle de la zone de jeu
const GAME_VIRTUAL_HEIGHT = 1500;
let camera = {
    x: 0,
    y: 0,
    scale: 1,
    targetX: 0,
    targetY: 0
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

// Éléments des paramètres
const enableSpeedBoostCheckbox = document.getElementById('enableSpeedBoost');
const speedBoostDurationInput = document.getElementById('speedBoostDuration');
const enableInvincibilityCheckbox = document.getElementById('enableInvincibility');
const invincibilityDurationInput = document.getElementById('invincibilityDuration');
const enableRevealCheckbox = document.getElementById('enableReveal');
const revealDurationInput = document.getElementById('revealDuration');
const initialBotCountInput = document.getElementById('initialBotCount');
const gameDurationInput = document.getElementById('gameDuration');
const enableSpecialZonesCheckbox = document.getElementById('enableSpecialZones');
const enableChaosZoneCheckbox = document.getElementById('enableChaosZone');
const enableRepelZoneCheckbox = document.getElementById('enableRepelZone');
const enableAttractZoneCheckbox = document.getElementById('enableAttractZone');
const enableStealthZoneCheckbox = document.getElementById('enableStealthZone');
const enableBlackBotCheckbox = document.getElementById('enableBlackBot');
const blackBotCountInput = document.getElementById('blackBotCount');
const bonusSpawnIntervalInput = document.getElementById('bonusSpawnInterval');
const speedBoostSpawnRateInput = document.getElementById('speedBoostSpawnRate');
const invincibilitySpawnRateInput = document.getElementById('invincibilitySpawnRate');
const revealSpawnRateInput = document.getElementById('revealSpawnRate');
const enableMalusCheckbox = document.getElementById('enableMalus');
const malusSpawnIntervalInput = document.getElementById('malusSpawnInterval');
const malusSpawnRateInput = document.getElementById('malusSpawnRate');
const reverseControlsDurationInput = document.getElementById('reverseControlsDuration');
const blurDurationInput = document.getElementById('blurDuration');
const negativeDurationInput = document.getElementById('negativeDuration');
const enableReverseControlsCheckbox = document.getElementById('enableReverseControls');
const enableBlurVisionCheckbox = document.getElementById('enableBlurVision');
const enableNegativeVisionCheckbox = document.getElementById('enableNegativeVision');

// Éléments du jeu
let canvas, context, mapManager;
const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('time');
const pauseButton = document.getElementById('pauseButton');
const collectedBonusDisplay = document.getElementById('collectedBonusDisplay');
const collectedBonusDisplayContent = document.getElementById('collectedBonusDisplayContent');
const activeBonusesContainer = document.getElementById('activeBonuses');
const playerListContainer = document.getElementById('players');
const lastEntityStates = new Map();

const SPEED_MULTIPLIER = 2; 
const BASE_SPEED = 3.5; 
const SPEED_BOOST_MULTIPLIER = 1.3;

// Ajoutez cette nouvelle constante pour les contrôles mobiles
const MOBILE_SPEED_FACTOR = 2;

const JOYSTICK_SPEED_MULTIPLIER = 6;
const JOYSTICK_UPDATE_INTERVAL = 50;
const TOUCH_START_OPTIONS = { passive: false };
const TOUCH_MOVE_OPTIONS = { passive: false };

const GAME_START_COUNTDOWN = 5; // 5 secondes de compte à rebours

const musicVolumeInput = document.getElementById('musicVolume');
const soundVolumeInput = document.getElementById('soundVolume');

musicVolumeInput.addEventListener('input', (e) => {
    const volume = e.target.value / 100;
    audioManager.setMusicVolume(volume);
});

soundVolumeInput.addEventListener('input', (e) => {
    const volume = e.target.value / 100;
    audioManager.setSoundVolume(volume);
});


const MALUS_MESSAGES = {
    blur: {
        trigger: "Vous volez les lunettes de vos adversaires",
        receive: "{player} vous a volé vos lunettes"
    },
    reverse: {
        trigger: "Vous avez inversé les contrôles de vos adversaires",
        receive: "{player} a trafiqué vos contrôles"
    },
    negative: {
        trigger: "Vous avez privé vos adversaires de couleurs",
        receive: "{player} vous prive de couleurs"
    }
};

// constantes pour les effets des bonus
const BONUS_EFFECTS = {
    speed: {
        color: '#00ff00',      // Vert vif pour la vitesse
        glowSize: 20,
        pulseSpeed: 0.006,
        name: 'Boost',
        backgroundColor: 'rgba(0, 255, 0, 0.2)',  // Fond semi-transparent
        borderColor: 'rgba(0, 255, 0, 0.6)'       // Bordure plus visible
    },
    invincibility: {
        color: '#ffd700',      // Or pour l'invincibilité
        glowSize: 25,
        pulseSpeed: 0.004,
        name: 'Invincibilité',
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
        borderColor: 'rgba(255, 215, 0, 0.6)'
    },
    reveal: {
        color: '#ff00ff',      // Magenta pour la révélation
        glowSize: 15,
        pulseSpeed: 0.005,
        name: 'Révélation',
        backgroundColor: 'rgba(255, 0, 255, 0.2)',
        borderColor: 'rgba(255, 0, 255, 0.6)'
    }
};

const MALUS_EFFECTS = {
    reverse: {
        color: '#ff4444',
        glowSize: 20,
        pulseSpeed: 0.006,
        name: 'Contrôles inversés',
        backgroundColor: 'rgba(255, 68, 68, 0.2)',
        borderColor: 'rgba(255, 68, 68, 0.6)'
    },
    blur: {
        color: '#44aaff',
        glowSize: 20,
        pulseSpeed: 0.006,
        name: 'Vision floue',
        backgroundColor: 'rgba(68, 170, 255, 0.2)',
        borderColor: 'rgba(68, 170, 255, 0.6)'
    },
    negative: {
        color: '#aa44ff',
        glowSize: 20,
        pulseSpeed: 0.006,
        name: 'Vision négative',
        backgroundColor: 'rgba(170, 68, 255, 0.2)',
        borderColor: 'rgba(170, 68, 255, 0.6)'
    }
};

// Ajouter ces styles CSS pour les boutons
const additionalStyles = `
.game-over-buttons {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-top: 20px;
}

.game-over-buttons button {
    min-width: 180px;
    padding: 12px 20px;
}

.game-over-buttons button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
`;

document.addEventListener('DOMContentLoaded', async () => {
    audioManager = new AudioManager({
        volume: 0.5,
        musicVolume: 0.3,
        soundVolume: 0.5
    });
        // Attendre que l'audio soit chargé
        try {
            await audioManager.loadPromise;
            console.log('Audio chargé avec succès');
            
            // Vérifier si nous sommes sur l'écran principal (menu)
            if (mainMenu.classList.contains('active')) {
                console.log('Démarrage de la musique du menu');
                audioManager.playMusic('menu');
            }
        } catch (error) {
            console.error('Erreur lors du chargement de l\'audio:', error);
        }
    // Initialiser le canvas
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    
    context = canvas.getContext('2d');
    if (!context) {
        console.error('Could not get 2D context');
        return;
    }

    // Charger les assets
    await loadGameAssets();
    
    // Initialiser le MapManager
    mapManager = new MapManager(canvas, {
        debugMode: true,
        debugCollisions: true,
        mapWidth: GAME_VIRTUAL_WIDTH,
        mapHeight: GAME_VIRTUAL_HEIGHT
    });
    
    await audioManager.loadPromise;
    initializeButtonSounds(); // Initialiser les sons des boutons
    // Démarrer la musique du menu dès que la page est chargée
    audioManager.playMusic('menu');

    initializeNicknameValidation();
    addVersionDisplay();
});

// Dimensions du jeu
let GAME_WIDTH = window.innerWidth;
let GAME_HEIGHT = window.innerHeight;

// Variables d'état du jeu
let entities = [];
let bonuses = [];
let maluses = [];
let malusItems = [];
let playerId = null;
let playerNickname = null;
let timeRemaining = 180;
let playerColor = null;
let isPaused = false;
let isGameOver = false;
let keysPressed = {};
let specialZones = [];
let isRoomOwner = false;
let lastEntityPositions = new Map(); // Pour tracker les mouvements
let entityMovementStates = new Map(); // Pour tracker l'état de mouvement
let audioManager;
let lastUrgentTickTime = 0;

// Nouvelles variables pour les contrôles mobiles
let isMoving = false;
let currentMove = { x: 0, y: 0 };
let moveInterval;

// Variables pour les bonus
let speedBoostActive = false;
let invincibilityActive = false;
let revealActive = false;
let speedBoostTimeLeft = 0;
let invincibilityTimeLeft = 0;
let revealTimeLeft = 0;
let bonusAnimations = {};
let malusAnimations = {};

let activemalus = new Map();

// Position et vitesse du joueur
let playerX = 0;
let playerY = 0;
let playerSpeed = 8;
let showPlayerLocator = false;
let locatorFadeStartTime = 0;
const LOCATOR_DURATION = 2000; // Durée d'affichage de la flèche en millisecondes
const LOCATOR_FADE_DURATION = 500; // Durée du fade out en millisecondes

// Intervalle de la boucle de jeu
let gameLoopInterval;

// Paramètres du jeu par défaut
let gameSettings = {
    gameDuration: 180,
    enableSpeedBoost: true,
    speedBoostDuration: 10,
    enableInvincibility: true,
    invincibilityDuration: 10,
    enableReveal: true,
    revealDuration: 10,
    initialBotCount: 30,
    enableSpecialZones: true,
    enabledZones: {
        CHAOS: true,
        REPEL: true,
        ATTRACT: true,
        STEALTH: true
    }
};

class AssetCache {
    constructor() {
        this.images = new Map();
        this.promises = new Map();
    }

    async loadImage(src) {
        // Si l'image est déjà chargée, la retourner
        if (this.images.has(src)) {
            return this.images.get(src);
        }

        // Si l'image est en cours de chargement, retourner la promesse existante
        if (this.promises.has(src)) {
            return this.promises.get(src);
        }

        // Créer une nouvelle promesse de chargement
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                this.images.set(src, img);
                this.promises.delete(src);
                resolve(img);
            };
            
            img.onerror = (error) => {
                this.promises.delete(src);
                reject(error);
            };

            img.src = src;
        });

        this.promises.set(src, promise);
        return promise;
    }

    clear() {
        this.images.clear();
        this.promises.clear();
    }
}

// Créer une instance globale
const assetCache = new AssetCache();

class SpriteManager {
    constructor() {
        this.TARGET_COLOR = {r: 255, g: 0, b: 0}; // Rouge à remplacer
        this.COLOR_TOLERANCE = 140;
        this.ANIMATION_FRAME_DURATION = 150; // Durée de chaque frame en ms
        this.currentFrame = 0;
        this.lastFrameTime = Date.now();

        // Définition des sprites avec les deux frames pour chaque direction
        this.sprites = {
            idle: {
        frame1: '/assets/images/ninja/idle.png',
        frame2: '/assets/images/ninja/idle.png' // Même image car pas d'animation à l'arrêt
            },
            north: {
                frame1: '/assets/images/ninja/north_1.png',
                frame2: '/assets/images/ninja/north_2.png'
            },
            north_east: {
                frame1: '/assets/images/ninja/north_east_1.png',
                frame2: '/assets/images/ninja/north_east_2.png'
            },
            east: {
                frame1: '/assets/images/ninja/east_1.png',
                frame2: '/assets/images/ninja/east_2.png'
            },
            south_east: {
                frame1: '/assets/images/ninja/south_east_1.png',
                frame2: '/assets/images/ninja/south_east_2.png'
            },
            south: {
                frame1: '/assets/images/ninja/south_1.png',
                frame2: '/assets/images/ninja/south_2.png'
            },
            south_west: {
                frame1: '/assets/images/ninja/south_west_1.png',
                frame2: '/assets/images/ninja/south_west_2.png'
            },
            west: {
                frame1: '/assets/images/ninja/west_1.png',
                frame2: '/assets/images/ninja/west_2.png'
            },
            north_west: {
                frame1: '/assets/images/ninja/north_west_1.png',
                frame2: '/assets/images/ninja/north_west_2.png'
                
            }
        };

        this.colorCache = new Map();
        this.loadedSprites = {};
        
        // Précharger tous les sprites (les deux frames)
        Object.entries(this.sprites).forEach(([direction, frames]) => {
            this.loadedSprites[direction] = {};
            
            // Charger frame1
            const img1 = new Image();
            img1.src = frames.frame1;
            img1.onload = () => {
                //console.log(`Sprite ${direction} frame1 chargé`);
            };
            this.loadedSprites[direction].frame1 = img1;
            
            // Charger frame2
            const img2 = new Image();
            img2.src = frames.frame2;
            img2.onload = () => {
                //console.log(`Sprite ${direction} frame2 chargé`);
            };
            this.loadedSprites[direction].frame2 = img2;
        });
                // Précharger tous les sprites
                this.preloadSprites();
    }
    async preloadSprites() {
        try {
            for (const [direction, frames] of Object.entries(this.sprites)) {
                this.loadedSprites[direction] = {};
                
                // Charger frame1
                this.loadedSprites[direction].frame1 = await assetCache.loadImage(frames.frame1);
                
                // Charger frame2
                this.loadedSprites[direction].frame2 = await assetCache.loadImage(frames.frame2);
            }
        } catch (error) {
            console.error('Erreur lors du préchargement des sprites:', error);
        }
    }


    updateAnimation() {
        const now = Date.now();
        if (now - this.lastFrameTime > this.ANIMATION_FRAME_DURATION) {
            this.currentFrame = (this.currentFrame + 1) % 2;
            this.lastFrameTime = now;
        }
    }

    getFrameKey(direction, isMoving) {
        // Si l'entité ne bouge pas, utiliser toujours la frame1 pour idle
        if (!isMoving || direction === DIRECTIONS.IDLE) {
            return 'frame1';
        }
        // Sinon, alterner entre frame1 et frame2 selon l'animation
        return this.currentFrame === 0 ? 'frame1' : 'frame2';
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    isColorSimilar(color1, color2, tolerance) {
        return Math.abs(color1.r - color2.r) <= tolerance &&
               Math.abs(color1.g - color2.g) <= tolerance &&
               Math.abs(color1.b - color2.b) <= tolerance;
    }

    getCacheKey(direction, color, frameKey) {
        return `${direction}-${color}-${frameKey}`;
    }

    getColoredSprite(direction, color, isMoving) {
        const frameKey = this.getFrameKey(direction, isMoving);
        const cacheKey = this.getCacheKey(direction, color, frameKey);
        
        if (this.colorCache.has(cacheKey)) {
            return this.colorCache.get(cacheKey);
        }

        const sprite = this.loadedSprites[direction]?.[frameKey];
        if (!sprite || !sprite.complete) return null;

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCanvas.width = sprite.width;
        tempCanvas.height = sprite.height;

        tempCtx.drawImage(sprite, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        const targetRgb = this.hexToRgb(color);

        for (let i = 0; i < pixels.length; i += 4) {
            const currentColor = {
                r: pixels[i],
                g: pixels[i + 1],
                b: pixels[i + 2]
            };

            if (this.isColorSimilar(currentColor, this.TARGET_COLOR, this.COLOR_TOLERANCE)) {
                pixels[i] = targetRgb.r;
                pixels[i + 1] = targetRgb.g;
                pixels[i + 2] = targetRgb.b;
            }
        }

        tempCtx.putImageData(imageData, 0, 0);
        this.colorCache.set(cacheKey, tempCanvas);
        return tempCanvas;
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

    clearCache() {
        this.colorCache.clear();
    }
}

// Créer l'instance globale du SpriteManager
const spriteManager = new SpriteManager();

function addVersionDisplay() {
    const versionDisplay = document.createElement('div');
    versionDisplay.id = 'versionDisplay';
    versionDisplay.className = 'version-display';
    versionDisplay.textContent = GAME_VERSION;
    document.body.appendChild(versionDisplay);
}

function worldToScreen(worldX, worldY) {
    const screenX = (worldX - camera.x) * camera.scale + canvas.width / 2;
    const screenY = (worldY - camera.y) * camera.scale + canvas.height / 2;
    return { x: screenX, y: screenY };
}

// Fonction utilitaire pour détecter si on est sur mobile
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 768;
}

function showMobileControls() {
    const mobileControls = document.getElementById('mobileControls');
if (mobileControls) {
    // Réinitialiser l'état des contrôles mobiles
    isMoving = false;
    currentMove = { x: 0, y: 0 };
    if (moveInterval) {
        clearInterval(moveInterval);
        moveInterval = null;
    }
    
    // Force le ré-affichage des contrôles
    if (isMobile()) {
        mobileControls.style.display = 'block';
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
    } else {
        mobileControls.style.display = 'none';
        document.body.style.overflow = '';
        document.body.style.position = '';
    }
}
}

function switchTab(tabName) {
    const content = document.querySelector('.waiting-room-content');
    
    // Ajouter la classe pour l'animation
    content.classList.add('changing');
    
    // Attendre la fin de l'animation de fade out
    setTimeout(() => {
        // Changer le contenu
        // Votre code de changement d'onglet ici
        
        // Retirer la classe après le changement
        content.classList.remove('changing');
    }, 300); // Même durée que la transition CSS
}

function createCaptureParticles(bot) {
    const PARTICLE_COUNT = 8;
    const screenPos = worldToScreen(bot.x, bot.y);
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = document.createElement('div');
        particle.className = 'capture-particle';
        
        // Position initiale en coordonnées monde
        particle.style.position = 'absolute';
        particle.style.left = `${screenPos.x}px`;
        particle.style.top = `${screenPos.y}px`;
        particle.style.background = bot.color;
        
        // Direction aléatoire
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
        const distance = 30;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        // Ajouter une classe pour le suivi de la caméra
        particle.classList.add('world-fixed');
        
        document.getElementById('gameContainer').appendChild(particle);
        
        setTimeout(() => {
            particle.remove();
        }, 500);
    }
}

function createShockwave(x, y, color) {
    const shockwave = document.createElement('div');
    shockwave.className = 'capture-shockwave';
    
    // Position en coordonnées monde
    shockwave.style.position = 'absolute';
    shockwave.style.left = `${x}px`;
    shockwave.style.top = `${y}px`;
    shockwave.style.borderColor = color;
    
    // Ajouter une classe pour le suivi de la caméra
    shockwave.classList.add('world-fixed');
    
    document.getElementById('gameContainer').appendChild(shockwave);
    
    setTimeout(() => {
        shockwave.remove();
    }, 600);
}

// Helper function pour ajouter un effet de lueur temporaire
function addTemporaryEffect(element, className, duration) {
    element.classList.add(className);
    setTimeout(() => {
        element.classList.remove(className);
    }, duration);
}

// Fonction d'initialisation des contrôles mobiles
function initializeMobileControls() {
    if (!isMobile()) return;

    const joystick = document.querySelector('.joystick-stick');
    const joystickBase = document.querySelector('.joystick-base');
    const locateButton = document.getElementById('mobileLocateButton');
    
    let baseRect;
    let centerX, centerY;
    let touchId = null; // Stocke l'ID du touch en cours
    
    function handleStart(e) {
        // Si on a déjà un touch actif, ignorer les autres
        if (touchId !== null) return;
        
        e.preventDefault();
        const touch = e.type === 'touchstart' ? e.touches[0] : e;
        touchId = touch.identifier;
        
        isMoving = true;
        baseRect = joystickBase.getBoundingClientRect();
        centerX = baseRect.left + baseRect.width / 2;
        centerY = baseRect.top + baseRect.height / 2;
        handleMove(e);
        
        if (moveInterval) clearInterval(moveInterval);
        moveInterval = setInterval(sendMovement, 50);
    }
    
    function handleMove(e) {
        if (!isMoving) return;
        e.preventDefault();
        
        let touch = e.touches ? 
            Array.from(e.touches).find(t => t.identifier === touchId) : 
            e;
            
        if (!touch) return;
        
        const x = touch.clientX - centerX;
        const y = touch.clientY - centerY;
        const maxRadius = baseRect.width / 2;
        const distance = Math.sqrt(x * x + y * y);
        
        if (distance === 0) return;      
        
        // Normalisation et application de la vitesse
        let moveX = (x / distance) * BASE_SPEED * MOBILE_SPEED_FACTOR;
        let moveY = (y / distance) * BASE_SPEED * MOBILE_SPEED_FACTOR;
        
        if (activemalus.has('reverse')) {
            moveX *= -1;
            moveY *= -1;
        }
        if (isMoving) {
            // Jouer le son des pas
            if (audioManager) {
                audioManager.playFootstepWithInterval();
            }
        }
        
        // Animation du joystick
        const stickX = x * 0.8;
        const stickY = y * 0.8;
        
        requestAnimationFrame(() => {
            joystick.style.transform = `translate(${stickX}px, ${stickY}px)`;
        });
        
        currentMove = {
            x: moveX,
            y: moveY
        };
    }
    
    function handleEnd(e) {
        // Vérifier si c'est le bon touch qui se termine
        if (e.type === 'touchend' || e.type === 'touchcancel') {
            let touchFound = false;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    touchFound = true;
                    break;
                }
            }
            if (!touchFound) return;
        }
        
        touchId = null;
        isMoving = false;
        
        requestAnimationFrame(() => {
            joystick.style.transform = 'translate(-50%, -50%)';
        });
        
        currentMove = { x: 0, y: 0 };
        if (moveInterval) {
            clearInterval(moveInterval);
            moveInterval = null;
        }
    }
    
    function sendMovement() {
        if (isMoving && socket && !isPaused && !isGameOver) {
            const speedMultiplier = speedBoostActive ? SPEED_BOOST_MULTIPLIER : 1;
            
            const finalMove = {
                x: currentMove.x * speedMultiplier,
                y: currentMove.y * speedMultiplier,
                speedBoostActive
            };
            
            socket.emit('move', finalMove);
        }
    }

    // Amélioration de la gestion des événements tactiles
    const options = { passive: false };
    joystickBase.addEventListener('touchstart', handleStart, options);
    document.addEventListener('touchmove', handleMove, options);
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    
    // Bouton de localisation avec retour visuel
    locateButton.addEventListener('click', () => {
        showPlayerLocator = true;
        locatorFadeStartTime = Date.now() + LOCATOR_DURATION - LOCATOR_FADE_DURATION;
        
        // Ajouter un retour visuel
        locateButton.classList.add('active');
        setTimeout(() => {
            locateButton.classList.remove('active');
            showPlayerLocator = false;
        }, LOCATOR_DURATION);
    });

    // Désactiver le zoom sur double tap
    document.addEventListener('dblclick', (e) => {
        e.preventDefault();
    }, { passive: false });

    // Empêcher le scroll de la page
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
}

function hasListeners(eventName) {
    return this.listeners(eventName).length > 0;
}

function initializeSocket(socket) {
    if (!socket.hasListeners) {
        socket.hasListeners = hasListeners;
    }
    return socket;
}

function initializeNicknameValidation() {
    const nicknameInput = document.getElementById('nicknameInput');
    const startButton = document.getElementById('startButton');

    // Fonction pour vérifier et mettre à jour l'état du bouton
    function updateButtonState() {
        const nickname = nicknameInput.value.trim();
        startButton.disabled = nickname.length === 0;
    }

    // Écouter les événements d'entrée
    nicknameInput.addEventListener('input', updateButtonState);
    nicknameInput.addEventListener('keyup', updateButtonState);
    nicknameInput.addEventListener('change', updateButtonState);

    // État initial
    updateButtonState();
}

// Chargement des ressources
const modakRegular = new FontFace('Modak-Regular', 'url(/assets/fonts/Modak-Regular.ttf)');
modakRegular.load().then(function(loadedFont) {
    document.fonts.add(loadedFont);
}).catch(function(error) {
    console.error('Erreur de chargement de la police Modak-Regular:', error);
});

// Fonction pour mettre à jour la position de la caméra
function updateCamera() {
    if (!entities || !playerId) return;

    // Trouver le joueur actuel, en s'assurant qu'il s'agit bien d'une entité de type 'player'
    const myPlayer = entities.find(e => e.id === playerId && e.type === 'player');
    if (!myPlayer) {
        //console.log("Player not found:", playerId); // Debug log
        return;
    }

    // Calculer les limites de la caméra
    const viewWidth = canvas.width / camera.scale;
    const viewHeight = canvas.height / camera.scale;

    // Calculer la position cible (centrée sur le joueur avec limites)
    const targetX = Math.max(
        viewWidth / 2,
        Math.min(GAME_VIRTUAL_WIDTH - viewWidth / 2, myPlayer.x)
    );
    const targetY = Math.max(
        viewHeight / 2,
        Math.min(GAME_VIRTUAL_HEIGHT - viewHeight / 2, myPlayer.y)
    );

    const lerpFactor = 0.08; // Réduire cette valeur pour un mouvement plus lisse (0.05 - 0.15)
    
    // Utilisation de requestAnimationFrame pour la synchro avec le taux de rafraîchissement
    requestAnimationFrame(() => {
        camera.x += (targetX - camera.x) * lerpFactor;
        camera.y += (targetY - camera.y) * lerpFactor;
    });

    // S'assurer que la caméra reste dans les limites
    camera.x = Math.max(viewWidth / 2, Math.min(GAME_VIRTUAL_WIDTH - viewWidth / 2, camera.x));
    camera.y = Math.max(viewHeight / 2, Math.min(GAME_VIRTUAL_HEIGHT - viewHeight / 2, camera.y));
}

// Fonction de réinitialisation des paramètres
function resetSettings() {
    if (isRoomOwner) {
        // Envoyer une demande de réinitialisation au serveur
        socket.emit('resetGameSettings');
    }
}

resetSettingsButton.addEventListener('click', resetSettings);

// Images des bonus
const bonusImages = {};
const malusImages = {};

async function loadGameAssets() {
    try {
        // Charger les images des bonus
        bonusImages.speed = await assetCache.loadImage('/assets/images/speed.gif');
        bonusImages.invincibility = await assetCache.loadImage('/assets/images/shield.gif');
        bonusImages.reveal = await assetCache.loadImage('/assets/images/eye.gif');

        // Charger les images des malus
        malusImages.reverse = await assetCache.loadImage('/assets/images/reverse.gif');
        malusImages.blur = await assetCache.loadImage('/assets/images/blur.gif');
        malusImages.negative = await assetCache.loadImage('/assets/images/negative.gif');
    } catch (error) {
        console.error('Erreur lors du chargement des assets:', error);
    }
}

function createFloatingPoints(x, y, points, color) {
    const element = document.createElement('div');
    element.className = 'floating-points';
    element.textContent = points > 0 ? `+${points}` : points;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.color = color || '#fff';
    
    document.getElementById('gameContainer').appendChild(element);
    
    // Supprimer l'élément après l'animation
    setTimeout(() => {
        element.remove();
    }, 1000);
}

// Événements de redimensionnement
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    // Ajout des propriétés pour réduire le scintillement
    canvas.style.imageRendering = 'crisp-edges';
    canvas.style.backfaceVisibility = 'hidden';
    canvas.style.transform = 'translateZ(0)';  // Force l'accélération matérielle
    initializeCamera();
}

function initializeCamera() {
    const aspectRatio = GAME_VIRTUAL_WIDTH / GAME_VIRTUAL_HEIGHT;
    const screenAspectRatio = window.innerWidth / window.innerHeight;
    
    if (isMobile()) {
        // Réduire légèrement le zoom mobile
        const mobileScale = Math.min(
            window.innerWidth / 600,  // Augmenté de 500 à 800
            window.innerHeight / 451  // Augmenté de 350 à 600
        );
        camera.scale = mobileScale;
    } else {
        // Pour desktop, calculer un zoom fixe basé sur une hauteur de vue cible
        const targetViewHeight = 900; // Hauteur de vue souhaitée en pixels
        
        if (screenAspectRatio > aspectRatio) {
            // Écran plus large que le ratio du jeu
            camera.scale = window.innerHeight / targetViewHeight;
        } else {
            // Écran plus haut que le ratio du jeu
            camera.scale = window.innerWidth / (targetViewHeight * aspectRatio);
        }
    }

    if (!camera.x || !camera.y) {
        camera.x = GAME_VIRTUAL_WIDTH / 2;
        camera.y = GAME_VIRTUAL_HEIGHT / 2;
    }
}

function addButtonClickSound(button) {
    button.addEventListener('click', () => {
        if (audioManager) {
            audioManager.playSound('buttonClick');
        }
    });
}

function createExplosionEffect(worldX, worldY) {
    const screenPos = worldToScreen(worldX, worldY);
    const explosion = document.createElement('div');
    explosion.className = 'explosion-effect';
    explosion.style.left = `${screenPos.x}px`;
    explosion.style.top = `${screenPos.y}px`;
    document.getElementById('gameContainer').appendChild(explosion);
    
    setTimeout(() => {
        explosion.remove();
    }, 1000);
}

// Fonction pour ajouter le son à plusieurs boutons
function initializeButtonSounds() {
    // Liste des boutons des menus
    const menuButtons = [
        startButton,
        settingsButton,
        saveSettingsButton,
        backToMenuButton,
        resetSettingsButton,
        startGameButton,
        waitingRoomSettings,
        leaveRoomButton,
        pauseButton
        // Ajoutez ici d'autres boutons si nécessaire
    ];

    menuButtons.forEach(button => {
        if (button) { // Vérifier que le bouton existe
            addButtonClickSound(button);
        }
    });
}

function createCaptureEffect(bot) {
    const screenPos = worldToScreen(bot.x, bot.y);

    // Effet de particules avec la vieille couleur qui se transforme en nouvelle couleur
    createCaptureParticles(screenPos.x, screenPos.y, bot.oldColor, bot.color);
    
    // Onde de choc
    createShockwave(screenPos.x, screenPos.y, bot.color);

    // Effet de flash
    const flash = document.createElement('div');
    flash.className = 'capture-flash';
    flash.style.left = `${screenPos.x}px`;
    flash.style.top = `${screenPos.y}px`;
    flash.style.backgroundColor = bot.color;
    document.getElementById('gameContainer').appendChild(flash);
    
    setTimeout(() => flash.remove(), 400);
}

window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', showMobileControls);
window.addEventListener('resize', showMobileControls);

// Menu des paramètres
settingsButton.addEventListener('click', () => {
    mainMenu.classList.remove('active');
    settingsMenu.style.display = 'block';
});

saveSettingsButton.addEventListener('click', () => {
        // Sauvegarder les paramètres audio pour tous les joueurs
        if (audioManager) {
            const musicVolume = parseInt(document.getElementById('musicVolume').value);
            const soundVolume = parseInt(document.getElementById('soundVolume').value);
            audioManager.setMusicVolume(musicVolume / 100);
            audioManager.setSoundVolume(soundVolume / 100);
        }
    if (isRoomOwner) {
        const newSettings = {
            gameDuration: parseInt(gameDurationInput.value),
            initialBotCount: parseInt(initialBotCountInput.value),
            enableSpecialZones: enableSpecialZonesCheckbox.checked,
            enabledZones: {
                CHAOS: enableChaosZoneCheckbox.checked,
                REPEL: enableRepelZoneCheckbox.checked,
                ATTRACT: enableAttractZoneCheckbox.checked,
                STEALTH: enableStealthZoneCheckbox.checked
            },
            enableBlackBot: enableBlackBotCheckbox.checked,
            blackBotCount: parseInt(blackBotCountInput.value),

            bonusSpawnInterval: parseInt(bonusSpawnIntervalInput.value),
            
            enableSpeedBoost: enableSpeedBoostCheckbox.checked,
            speedBoostDuration: parseInt(speedBoostDurationInput.value),
            speedBoostSpawnRate: parseInt(speedBoostSpawnRateInput.value),

            enableInvincibility: enableInvincibilityCheckbox.checked,
            invincibilityDuration: parseInt(invincibilityDurationInput.value),
            invincibilitySpawnRate: parseInt(invincibilitySpawnRateInput.value),

            enableReveal: enableRevealCheckbox.checked,
            revealDuration: parseInt(revealDurationInput.value),
            revealSpawnRate: parseInt(revealSpawnRateInput.value),

            enableMalus: enableMalusCheckbox.checked,
            malusSpawnInterval: parseInt(malusSpawnIntervalInput.value),
            malusSpawnRate: parseInt(malusSpawnRateInput.value),
            reverseControlsDuration: parseInt(reverseControlsDurationInput.value),
            blurDuration: parseInt(blurDurationInput.value),
            negativeDuration: parseInt(negativeDurationInput.value),
            enableReverseControls: enableReverseControlsCheckbox.checked,
            enableBlurVision: enableBlurVisionCheckbox.checked,
            enableNegativeVision: enableNegativeVisionCheckbox.checked,
        };

        socket.emit('updateGameSettings', newSettings);
    }
    
    settingsMenu.style.display = 'none';
});

// gestion de l'activation/désactivation globale des zones
enableSpecialZonesCheckbox.addEventListener('change', (e) => {
    const zoneCheckboxes = [
        enableChaosZoneCheckbox,
        enableRepelZoneCheckbox,
        enableAttractZoneCheckbox,
        enableStealthZoneCheckbox
    ];
    
    zoneCheckboxes.forEach(checkbox => {
        checkbox.disabled = !e.target.checked;
    });
});

backToMenuButton.addEventListener('click', () => {
    settingsMenu.style.display = 'none';
});

enableMalusCheckbox.addEventListener('change', (e) => {
    const malusCheckboxes = [
        enableReverseControlsCheckbox,
        enableBlurVisionCheckbox,
        enableNegativeVisionCheckbox
    ];
    
    const malusInputs = [
        malusSpawnIntervalInput,
        malusSpawnRateInput,
        reverseControlsDurationInput,
        blurDurationInput,
        negativeDurationInput
    ];

    // Désactiver/activer toutes les checkboxes des malus
    malusCheckboxes.forEach(checkbox => {
        checkbox.disabled = !e.target.checked;
    });

    // Désactiver/activer tous les inputs liés aux malus
    malusInputs.forEach(input => {
        input.disabled = !e.target.checked;
    });
});

function initializeMalusSettings() {
    const malusEnabled = enableMalusCheckbox.checked;
    const malusCheckboxes = [
        enableReverseControlsCheckbox,
        enableBlurVisionCheckbox,
        enableNegativeVisionCheckbox
    ];
    
    const malusInputs = [
        malusSpawnIntervalInput,
        malusSpawnRateInput,
        reverseControlsDurationInput,
        blurDurationInput,
        negativeDurationInput
    ];

    malusCheckboxes.forEach(checkbox => {
        checkbox.disabled = !malusEnabled;
    });

    malusInputs.forEach(input => {
        input.disabled = !malusEnabled;
    });
}

function checkGameEndConditions() {
    // Si tous les joueurs ont quitté
    if (waitingRoom.playersInGame.size === 0 && waitingRoom.isGameStarted) {
        waitingRoom.isGameStarted = false;
        io.emit('updateWaitingRoom', {
            players: Array.from(waitingRoom.players.values()),
            gameInProgress: false
        });
    }
}

function createStartButtonContent(text, isMobile = false) {
    if (isMobile) {
        return `<span class="button-text">${text}</span>
                <svg class="button-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                </svg>`;
    }
    return text;
}

// Démarrage du jeu
startButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    if (nickname === '') {
        alert('Veuillez entrer un pseudo.');
        return;
    }
    playerNickname = nickname;
    
    // Au lieu de démarrer directement le jeu, on rejoint la salle d'attente
    mainMenu.classList.remove('active');
    waitingRoomScreen.classList.add('active');
    socket = initializeSocket(io());

        // Démarrer la musique du menu ici
        if (audioManager) {
            audioManager.playMusic('menu');
        }

    // Initialiser le chat après la connexion socket
    socket.on('connect', () => {
        //console.log('Socket connected, initializing chat...');
        initializeWaitingRoomTabs();
        initializeChat(socket); // Passer le socket en paramètre
    });

    socket.on('playerLeft', (data) => {
        showNotification(`${data.nickname} a quitté la salle${data.wasOwner ? ' (était propriétaire)' : ''}`, 'info');
        
        // Si nous devenons le nouveau propriétaire
        if (data.wasOwner && data.newOwner === socket.id) {
            showNotification('Vous êtes maintenant propriétaire de la salle', 'success');
        }
    });  

    socket.on('botCaptured', (data) => {
        const { botId, oldColor, newColor, position } = data;
        
        // Créer l'effet visuel à la position du bot pour tous les joueurs
        const screenPos = worldToScreen(position.x, position.y);
        
        // Créer les effets visuels
        createCaptureEffect({
            id: botId,
            x: position.x,
            y: position.y,
            color: newColor,
            oldColor: oldColor
        });
    
        if (audioManager) {
            // Ajuster le volume en fonction de la distance avec le joueur
            const player = entities.find(e => e.id === socket.id);
            if (player) {
                const dx = player.x - position.x;
                const dy = player.y - position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const maxDistance = 500; // Distance maximale d'audibilité
                const volume = Math.max(0, 1 - (distance / maxDistance));
                
                audioManager.playSound('botConvert', volume);
            }
        }
    });

    socket.on('bonusExpired', (data) => {
        if (audioManager) {
            switch(data.type) {
                case 'speed':
                    audioManager.stopLoopingSound('speedBoostActive');
                    speedBoostActive = false;
                    speedBoostTimeLeft = 0;
                    break;
                case 'invincibility':
                    audioManager.stopLoopingSound('invincibilityActive');
                    invincibilityActive = false;
                    invincibilityTimeLeft = 0;
                    break;
                case 'reveal':
                    audioManager.stopLoopingSound('revealActive');
                    revealActive = false;
                    revealTimeLeft = 0;
                    break;
            }
        }
        updateActiveBonusesDisplay();
    });

    // écouteur pour les mises à jour des paramètres
    socket.on('gameSettingsUpdated', (settings) => {
        // Mettre à jour l'interface
        updateSettingsUI(settings);
        // Mettre à jour les paramètres locaux
        gameSettings = settings;
    });
    
    // Écouter les mises à jour de la salle d'attente
    socket.on('updateWaitingRoom', (players) => {
        updateWaitingRoomPlayers(players);
    });

    socket.on('playerJoined', (data) => {
        if (data.id !== socket.id) { // Ne pas afficher pour soi-même
            showNotification(`${data.nickname} a rejoint la partie !`, 'success');
        }
    });
    
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `game-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
    
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    socket.on('gameStartCountdown', (data) => {
        const startGameButton = document.getElementById('startGameButton');
        if (startGameButton) {
            if (isRoomOwner) {
                startGameButton.disabled = false;
                startGameButton.classList.add('countdown');
                startGameButton.textContent = `Annuler (${data.countdown}s)`;
                startGameButton.onclick = () => {
                    startGameButton.classList.remove('countdown');
                    socket.emit('cancelGameStart');
                };
            } else {
                startGameButton.disabled = true;
                startGameButton.textContent = `La partie commence dans ${data.countdown}s...`;
            }
    
            if (data.countdown <= 2) {
                startGameButton.disabled = true;
                audioManager.fadeOutMusic(2000);
            }

        // Jouer les sons de compte à rebours
        if (audioManager) {
            if (data.countdown <= 3 && data.countdown > 0) {
                audioManager.playSound('countdownTick');
            } else if (data.countdown === 0) {
                audioManager.playSound('finalTick');
            }
        }
    
            // Préchargement
            if (data.countdown === GAME_START_COUNTDOWN) {
                preloadGameResources();
            }
        }
    });
    
    socket.on('gameStartCancelled', () => {
        const startGameButton = document.getElementById('startGameButton');
        if (startGameButton) {
            startGameButton.classList.remove('countdown');
            startGameButton.disabled = !isRoomOwner;
            startGameButton.innerHTML = createStartButtonContent('Lancer la partie', isMobile());
            startGameButton.onclick = () => {
                socket.emit('startGameFromRoom', {
                    nickname: playerNickname,
                    settings: gameSettings
                });
            };
        }
    });
    
    socket.on('gameStartCancelled', () => {
        const startGameButton = document.getElementById('startGameButton');
        if (startGameButton) {
            startGameButton.disabled = !isRoomOwner;
            startGameButton.innerHTML = createStartButtonContent('Lancer la partie', isMobile());
            startGameButton.onclick = () => {
                socket.emit('startGameFromRoom', {
                    nickname: playerNickname,
                    settings: gameSettings
                });
            };
        }
    });
    
    socket.on('gameStarting', () => {
        const gameOverModal = document.getElementById('game-over-modal');
        if (gameOverModal) {
            // Si on est sur l'écran de fin de partie, fermer la modale et son timer
            const countdownInterval = gameOverModal.getAttribute('data-interval');
            if (countdownInterval) {
                clearInterval(Number(countdownInterval));
            }
            document.body.removeChild(gameOverModal);
        }
        
        waitingRoomScreen.classList.remove('active');
        startGame().catch(error => {
            console.error('Erreur lors du démarrage du jeu:', error);
        });
    });

    socket.on('applyMalus', (data) => {
        if (!MALUS_MESSAGES) {
            console.error('MALUS_MESSAGES non défini!');
            return;
        }
        handleMalusEffect(data.type, data.duration);
        const message = MALUS_MESSAGES[data.type].receive.replace('{player}', data.collectedBy);
        showMalusNotification(message, false);
    });

    socket.on('malusEvent', (data) => {
        if (data.collectorId === socket.id) {
            showMalusNotification(MALUS_MESSAGES[data.type].trigger);
        } else {
            handleMalusEffect(data.type, data.duration);
            const message = MALUS_MESSAGES[data.type].receive.replace('{player}', data.collectorNickname);
            showMalusNotification(message);
        }
    });
    
    socket.on('malusCollected', (data) => {
        console.log('Malus collecté', data.type);
    
        if (audioManager) {
            audioManager.playSound('malusCollect');
            console.log('Son de collecte de malus joué');
        }
        
        if (!MALUS_MESSAGES) {
            console.error('MALUS_MESSAGES non défini!');
            return;
        }
        if (!MALUS_MESSAGES[data.type]) {
            console.error('Type de malus non trouvé:', data.type);
            return;
        }
        showMalusNotification(MALUS_MESSAGES[data.type].trigger, true);
    });
    
    // Rejoindre la salle d'attente
    socket.emit('joinWaitingRoom', nickname);
    });

settingsButton.addEventListener('click', () => {
    settingsMenu.style.display = 'block';
});

leaveRoomButton.addEventListener('click', () => {
    if (audioManager) {
        audioManager.stopFootsteps();
        audioManager.stopLoopingSound('speedBoostActive');
        audioManager.stopLoopingSound('invincibilityActive');
        audioManager.stopLoopingSound('revealActive');
    }
    if (socket) {
        socket.emit('leaveWaitingRoom');
        socket.disconnect();
    }
    settingsMenu.style.display = 'none'; // Cacher les paramètres si ouverts
    waitingRoomScreen.classList.remove('active');
    mainMenu.classList.add('active');
});

startGameButton.addEventListener('click', () => {
    socket.emit('startGameFromRoom', {
        nickname: playerNickname,
        settings: gameSettings,
        gameWidth: GAME_WIDTH,
        gameHeight: GAME_HEIGHT
    });
});

// Fonction d'initialisation du chat
function initializeChat(socket) {
    const chatHeader = document.querySelector('.chat-header');
    const chatBox = document.querySelector('.floating-chat');
    const chatMessages = document.querySelector('.chat-messages');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const toggleIcon = document.querySelector('.toggle-icon');

    // Supprimer les anciens écouteurs s'ils existent
    const handleToggle = () => {
        chatBox.classList.toggle('collapsed');
        if (chatBox.classList.contains('collapsed')) {
            toggleIcon.textContent = '▶';
        } else {
            toggleIcon.textContent = '◀';
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        
        if (message) {
            socket.emit('chatMessage', {
                message: message,
                nickname: playerNickname,
                timestamp: Date.now()
            });
            
            chatInput.value = '';
            chatInput.focus();
            
            // Déplier le chat si replié
            if (chatBox.classList.contains('collapsed')) {
                chatBox.classList.remove('collapsed');
                toggleIcon.textContent = '◀';
            }
        }
    };

    // Nettoyer les anciens écouteurs avant d'en ajouter de nouveaux
    chatHeader.removeEventListener('click', handleToggle);
    chatForm.removeEventListener('submit', handleSubmit);

    // Ajouter les nouveaux écouteurs
    chatHeader.addEventListener('click', handleToggle);
    chatForm.addEventListener('submit', handleSubmit);

    // Nettoyer les anciens écouteurs de messages
    socket.removeAllListeners('newChatMessage');

    // Réception des messages
    socket.on('newChatMessage', (messageData) => {
        const messageElement = createChatMessage(messageData);
        chatMessages.appendChild(messageElement);
        // Scroll vers le bas
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

function createChatMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    if (data.nickname === playerNickname) {
        messageDiv.classList.add('own-message');
    }
    
    const header = document.createElement('div');
    header.className = 'chat-message-header';
    
    const author = document.createElement('span');
    author.className = 'chat-message-author';
    author.textContent = data.nickname;
    
    const time = document.createElement('span');
    time.className = 'chat-message-time';
    time.textContent = new Date(data.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const content = document.createElement('div');
    content.className = 'chat-message-content';
    content.textContent = data.message;
    
    header.appendChild(author);
    header.appendChild(time);
    messageDiv.appendChild(header);
    messageDiv.appendChild(content);
    
    return messageDiv;
}

function initializeWaitingRoomTabs() {
    const waitingRoom = document.getElementById('waitingRoom');
    if (!waitingRoom) return;

    const tabButtons = waitingRoom.querySelectorAll('.tab-button');
    const container = waitingRoom.querySelector('.waiting-room-container');
    
    if (!tabButtons.length || !container) return;

    tabButtons.forEach(button => {
        addButtonClickSound(button);
        button.addEventListener('click', () => {
            if (!button.dataset.tab) return;

            // Désactiver tous les onglets
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                const content = waitingRoom.querySelector(`#${btn.dataset.tab}-tab`);
                if (content) {
                    content.classList.remove('active');
                }
            });
            
            // Activer l'onglet sélectionné
            button.classList.add('active');
            const selectedContent = waitingRoom.querySelector(`#${button.dataset.tab}-tab`);
            
            if (selectedContent) {
                // Définir la hauteur exacte avant la transition
                container.style.height = `${container.scrollHeight}px`;
                
                // Activer le nouveau contenu
                selectedContent.classList.add('active');
                
                // Faire la transition vers la nouvelle hauteur
                requestAnimationFrame(() => {
                    container.style.height = `${selectedContent.scrollHeight}px`;
                });
            }
        });
    });

    // Définir la hauteur initiale
    const activeTab = waitingRoom.querySelector('.tab-content.active');
    if (activeTab && container) {
        container.style.height = `${activeTab.scrollHeight}px`;
    }
}

// Fonction pour ajouter un message au chat
function addChatMessage(messageData) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        console.error('Chat messages container not found!');
        return;
    }
    
    const messageElement = createChatMessage(messageData);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Fonction pour formater l'heure
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Fonction pour mettre à jour la liste des joueurs
function updateWaitingRoomPlayers(data) {
    //console.log('Réception mise à jour room:', data); // Log de debug

    // Gérer les différents formats de données possibles
    let players;
    let gameInProgress;
    
    if (Array.isArray(data)) {
        players = data;
        gameInProgress = false; // Par défaut si format tableau
    } else if (data && typeof data === 'object') {
        players = data.players || [];
        gameInProgress = data.gameInProgress;
    } else {
        console.error('Format de données invalide reçu:', data);
        return;
    }

    // S'assurer que players est un tableau
    if (!Array.isArray(players)) {
        console.error('Format de données des joueurs invalide:', players);
        return;
    }

    playersList.innerHTML = '';

    // Mettre à jour isRoomOwner
    isRoomOwner = players.some(player => 
        player.id === socket?.id && player.isOwner
    );

    // Supprimer l'ancien message de statut s'il existe
    const existingStatus = document.querySelector('.game-status');
    if (existingStatus) {
        existingStatus.remove();
    }

    // Ajouter le message de statut SI une partie est en cours
    if (gameInProgress) {
        const playersInGame = players.filter(p => p.status === 'playing').length;
        const statusMessage = document.createElement('div');
        statusMessage.className = 'game-status';
        statusMessage.innerHTML = `
            <div class="game-status-content">
                <span class="game-status-icon">🎮</span>
                <span>Partie en cours avec ${playersInGame} joueur${playersInGame > 1 ? 's' : ''}</span>
            </div>
        `;
        const container = playersList.parentElement;
        if (container) {
            container.insertBefore(statusMessage, playersList);
        }
    }

    // Créer les éléments de la liste des joueurs
    players.forEach(player => {
        const playerElement = document.createElement('li');
        playerElement.className = 'waiting-room-player';
        
        // Conteneur pour le nom et les badges
        const playerContent = document.createElement('div');
        playerContent.className = 'player-content';
        
        // Nom du joueur
        const playerName = document.createElement('span');
        playerName.className = 'player-name';
        playerName.textContent = player.nickname;
        playerContent.appendChild(playerName);

        // Badges
        const badgesContainer = document.createElement('div');
        badgesContainer.className = 'player-badges';

        // Badge propriétaire
        if (player.isOwner) {
            const ownerBadge = document.createElement('span');
            ownerBadge.className = 'owner-badge';
            ownerBadge.title = 'Propriétaire de la salle';
            ownerBadge.textContent = '👑';
            badgesContainer.appendChild(ownerBadge);
        }

        // Badge statut
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge ${player.status || 'waiting'}`;
        statusBadge.textContent = (player.status === 'playing') ? '🎮' : '⌛';
        statusBadge.title = (player.status === 'playing') ? 'En jeu' : 'En attente';
        badgesContainer.appendChild(statusBadge);

        playerContent.appendChild(badgesContainer);
        playerElement.appendChild(playerContent);

        if (player.id === socket?.id) {
            playerElement.classList.add('current-player');
        }

        playersList.appendChild(playerElement);
    });

    // Gérer l'affichage du bouton de démarrage/rejoindre
    if (gameInProgress) {
        const isPlayerInGame = players.some(p => p.id === socket?.id && p.status === 'playing');
        if (!isPlayerInGame) {
            startGameButton.textContent = 'Rejoindre la partie en cours';
            startGameButton.disabled = false;
            startGameButton.className = 'primary-button join-game';
            startGameButton.onclick = () => {
                socket.emit('joinRunningGame', { 
                    nickname: playerNickname 
                });
            };
        } else {
            startGameButton.style.display = 'none';
        }
    } else {
        startGameButton.innerHTML = createStartButtonContent('Lancer la partie', isMobile());
        startGameButton.className = 'primary-button';
        startGameButton.disabled = !isRoomOwner;
        startGameButton.style.display = 'block';
        startGameButton.onclick = () => {
            socket.emit('startGameFromRoom', {
                nickname: playerNickname,
                settings: gameSettings
            });
        };
    }

    // Gérer l'état des inputs dans le menu paramètres
    // Gérer l'état des inputs dans le menu paramètres
    const settingsInputs = settingsMenu.querySelectorAll('input, select, button');
    settingsInputs.forEach(input => {
        // Exclure le bouton retour et les contrôles audio de la désactivation
        if (input.id === 'backToMenuButton' || 
            input.id === 'musicVolume' || 
            input.id === 'soundVolume') return;
        
        input.disabled = !isRoomOwner;
    });

    saveSettingsButton.style.display = isRoomOwner ? 'block' : 'none';
}

// Gestion des entrées clavier
function handleKeyDown(event) {
    keysPressed[event.key] = true;

    // Touche pour localiser le joueur
    if (event.key.toLowerCase() === 'f' && !showPlayerLocator) {
        showPlayerLocator = true;
        locatorFadeStartTime = Date.now() + LOCATOR_DURATION - LOCATOR_FADE_DURATION;
        setTimeout(() => {
            showPlayerLocator = false;
        }, LOCATOR_DURATION);
    }
}

function handleKeyUp(event) {
    keysPressed[event.key] = false;
}

// Déplacement du joueur
function movePlayer() {
    if (isPaused || isGameOver) return;

    if (isMobile() && isMoving) return;

    const currentSpeed = BASE_SPEED * (speedBoostActive ? SPEED_BOOST_MULTIPLIER : 1);
    let move = { x: 0, y: 0 };
    const isReversed = activemalus.has('reverse');
    let playerIsMoving = false;

    // Calculer le mouvement souhaité
    if (keysPressed['ArrowUp'] || keysPressed['z']) {
        move.y = isReversed ? currentSpeed : -currentSpeed;
        playerIsMoving = true;
    }
    if (keysPressed['ArrowDown'] || keysPressed['s']) {
        move.y = isReversed ? -currentSpeed : currentSpeed;
        playerIsMoving = true;
    }
    if (keysPressed['ArrowLeft'] || keysPressed['q']) {
        move.x = isReversed ? currentSpeed : -currentSpeed;
        playerIsMoving = true;
    }
    if (keysPressed['ArrowRight'] || keysPressed['d']) {
        move.x = isReversed ? -currentSpeed : currentSpeed;
        playerIsMoving = true;
    }

    // Normaliser le vecteur de mouvement si le joueur se déplace
    if (playerIsMoving) {
        const magnitude = Math.sqrt(move.x * move.x + move.y * move.y);
        if (magnitude !== 0) {
            move.x = (move.x / magnitude) * currentSpeed;
            move.y = (move.y / magnitude) * currentSpeed;
        }
    }

    if (move.x !== 0 || move.y !== 0) {
        const player = entities.find(e => e.id === playerId);
        if (player) {
            const newX = player.x + move.x;
            const newY = player.y + move.y;
            
            const canMoveToNewPosition = mapManager.canMove(player.x, player.y, newX, newY, 16);
            
            if (canMoveToNewPosition) {
                if (audioManager) {
                    audioManager.playFootstepWithInterval(speedBoostActive);
                }
                
                socket.emit('move', { 
                    x: move.x,
                    y: move.y,
                    speedBoostActive,
                    isMoving: true
                });
            } else {
                // Arrêter les sons de pas si on est bloqué
                if (audioManager) {
                    audioManager.stopFootsteps();
                }
            }
        }
    } else {
        if (audioManager) {
            audioManager.stopFootsteps();
        }
    }
}

function handlePauseClick() {
    if (!isPaused && !isGameOver) {
        socket.emit('togglePause');
    }
}

function updateSettingsUI(settings) {
    // Mettre à jour tous les champs avec les nouvelles valeurs
    gameDurationInput.value = settings.gameDuration;
    enableSpeedBoostCheckbox.checked = settings.enableSpeedBoost;
    speedBoostDurationInput.value = settings.speedBoostDuration;
    enableInvincibilityCheckbox.checked = settings.enableInvincibility;
    invincibilityDurationInput.value = settings.invincibilityDuration;
    enableRevealCheckbox.checked = settings.enableReveal;
    revealDurationInput.value = settings.revealDuration;
    initialBotCountInput.value = settings.initialBotCount;
    enableSpecialZonesCheckbox.checked = settings.enableSpecialZones;
    enableChaosZoneCheckbox.checked = settings.enabledZones.CHAOS;
    enableRepelZoneCheckbox.checked = settings.enabledZones.REPEL;
    enableAttractZoneCheckbox.checked = settings.enabledZones.ATTRACT;
    enableStealthZoneCheckbox.checked = settings.enabledZones.STEALTH;
    enableBlackBotCheckbox.checked = settings.enableBlackBot;
    blackBotCountInput.value = settings.blackBotCount;
    bonusSpawnIntervalInput.value = settings.bonusSpawnInterval;
    speedBoostSpawnRateInput.value = settings.speedBoostSpawnRate;
    invincibilitySpawnRateInput.value = settings.invincibilitySpawnRate;
    revealSpawnRateInput.value = settings.revealSpawnRate;
    enableMalusCheckbox.checked = settings.enableMalus;
    malusSpawnIntervalInput.value = settings.malusSpawnInterval;
    malusSpawnRateInput.value = settings.malusSpawnRate;
    reverseControlsDurationInput.value = settings.reverseControlsDuration;
    blurDurationInput.value = settings.blurDuration;
    negativeDurationInput.value = settings.negativeDuration;
    enableReverseControlsCheckbox.checked = settings.enableReverseControls;
    enableBlurVisionCheckbox.checked = settings.enableBlurVision;
    enableNegativeVisionCheckbox.checked = settings.enableNegativeVision;
    initializeMalusSettings();
}

    // Fonction de préchargement
    async function preloadGameResources() {
        try {
            // Précharger les images
            await Promise.all([
                mapManager.preloadMapImages(),
                ...Object.values(bonusImages).map(img => {
                    return new Promise((resolve, reject) => {
                        if (img.complete) resolve();
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                }),
                ...Object.values(malusImages).map(img => {
                    return new Promise((resolve, reject) => {
                        if (img.complete) resolve();
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                })
            ]);
            
            // Précharger les sprites
            await Promise.all(
                Object.values(spriteManager.sprites).flatMap(direction => 
                    [direction.frame1, direction.frame2].map(src => 
                        new Promise((resolve, reject) => {
                            const img = new Image();
                            img.src = src;
                            img.onload = resolve;
                            img.onerror = reject;
                        })
                    )
                )
            );
        } catch (error) {
            console.error('Erreur lors du préchargement:', error);
        }
    }

// Fonction de démarrage du jeu
async function startGame() {
    console.log('Starting game...'); // Debug log
    
    isGameOver = false;
    isPaused = false;
    pauseButton.disabled = false;

    try {
        // Précharger les assets
        await Promise.all([
            // Précharger les sprites
            spriteManager.preloadSprites(),
            // Précharger la map
            mapManager.loadPromise
        ]);

    initializeCamera();
    // Attendre que la map soit chargée
    await mapManager.loadPromise;

    showMobileControls();
    // Initialiser les animations avant tout
    initializeAnimations();

    // Initialiser les contrôles mobiles
    initializeMobileControls();

    // Réinitialiser les variables de localisation et d'état
    showPlayerLocator = false;
    locatorFadeStartTime = 0;
    keysPressed = {};
    playerColor = null;
    playerId = socket.id; // Important : définir directement l'ID du joueur

    // Afficher l'indicateur de position au démarrage
    showPlayerLocator = true;
    locatorFadeStartTime = Date.now() + 3000; // Afficher pendant 3 secondes
    setTimeout(() => {
        showPlayerLocator = false;
    }, 3500); // 3.5 secondes pour inclure le fade out

    // Réinitialiser les bonus
    speedBoostActive = false;
    invincibilityActive = false;
    revealActive = false;
    playerSpeed = 3;
    speedBoostTimeLeft = 0;
    invincibilityTimeLeft = 0;
    revealTimeLeft = 0;

    entities = [];
    bonuses = [];
    maluses = [];
    malusItems = [];
    activemalus = new Map();

    // Gérer l'affichage des écrans
    mainMenu.classList.remove('active');
    waitingRoomScreen.classList.remove('active');
    settingsMenu.style.display = 'none';
    gameScreen.classList.add('active');

    // Arrêter la musique du menu avec un fade out et démarrer la musique du jeu
    audioManager.fadeOutMusic(1000); // Fade out sur 1 seconde
    setTimeout(() => {
        audioManager.playMusic('game');
    }, 1000); // Attendre la fin du fade out

    // S'assurer que le canvas est correctement dimensionné
    resizeCanvas();

    // Ne pas créer une nouvelle connexion si elle existe déjà
    if (!socket) {
        socket = initializeSocket(io());
        if (!socket.hasListeners) {
            socket.hasListeners = hasListeners;
        }
    }

    const duration = parseInt(gameDurationInput.value);
    timeRemaining = duration;

    socket.emit('startGame', {
        nickname: playerNickname,
        settings: {
            ...gameSettings,
            gameDuration: duration
        },
        gameWidth: GAME_VIRTUAL_WIDTH,  // Utiliser les dimensions virtuelles
        gameHeight: GAME_VIRTUAL_HEIGHT
    });

    if (!socket.hasListeners('connect')) {
        socket.on('connect', () => {
            playerId = socket.id;
            initializeChat();
        });
    }

    if (!socket.hasListeners('updateEntities')) {
        socket.on('updateEntities', (data) => {
            if (isPaused || isGameOver) return;

            // Mise à jour du timer
            updateTimer(data.timeLeft || 0);
            timeRemaining = data.timeLeft;

        // Vérifier si un bonus ou malus a été collecté
        if (data.bonusCollected && data.collectorId === socket.id) {
            if (audioManager) {
                audioManager.playSound('collectBonus');
            }
        }
    
         if (data.malusCollected && data.collectorId === socket.id) {
        if (audioManager) {
            audioManager.playSound('collectMalus');
           }
        }
            
            // Mise à jour des bonus
            bonuses = data.bonuses || [];
            socket.malus = data.malus || [];
            specialZones = data.zones || [];

                // Comparer les anciens et nouveaux bonus/malus pour détecter les collectes
            if (audioManager) {
            // Pour les bonus
            if (data.bonusCollected) {
            console.log('Bonus collecté !');
                audioManager.playSound('bonusCollect');
            }
            // Pour les malus
            if (data.malusCollected) {
                console.log('Malus collecté !');
                    audioManager.playSound('malusCollect');
            }
        }
            
            // Trouver d'abord notre joueur dans les scores
            const currentPlayer = data.playerScores.find(p => p.id === socket.id);
            if (currentPlayer) {
                playerColor = currentPlayer.color;
                playerId = currentPlayer.id;
                const totalScore = currentPlayer.currentBots;
                scoreDisplay.textContent = `${currentPlayer.nickname}: ${totalScore} points`;
            }

            data.entities.forEach(newEntity => {
                if (newEntity.type === 'bot') {
                    const oldEntity = entities.find(e => e.id === newEntity.id);
                    if (oldEntity && oldEntity.color !== newEntity.color) {
                        console.log('Bot capturé:', {
                            oldColor: oldEntity.color,
                            newColor: newEntity.color,
                            position: { x: newEntity.x, y: newEntity.y }
                        });
                        
                        const screenPos = worldToScreen(newEntity.x, newEntity.y);
                        
                        // Créer les effets visuels de capture
                        createCaptureParticles({
                            x: newEntity.x,
                            y: newEntity.y,
                            color: newEntity.color
                        });
                        createShockwave(screenPos.x, screenPos.y, newEntity.color);
                        
                        if (newEntity.color === playerColor) {
                            createFloatingPoints(screenPos.x, screenPos.y, 1, '#fff');
                        }
                    }
                }
            });
            
            // Mettre à jour les entités et la caméra
            entities = data.entities;
            updatePlayerList(data.playerScores);
            updateCamera();
            drawEntities();
            updateActiveBonusesDisplay();
        });
    }

    if (!socket.hasListeners('playerCaptured')) {
        socket.on('playerCaptured', (data) => {
            playerColor = data.newColor;
            showCaptureNotification(`Capturé par ${data.capturedBy} !`);
            showPlayerLocator = true;
            locatorFadeStartTime = Date.now() + 3000;
            setTimeout(() => {
                showPlayerLocator = false;
            }, 3500);
        });
    }

    socket.on('playerSound', (data) => {
        console.log('Son reçu:', data); // Debug
        if (audioManager && data.playerId !== playerId) { // Notez le changement de socket.id à playerId
            if (data.type === 'footstep') {
                const now = Date.now();
                const interval = data.isSpeedBoost ? 200 : 300;
                
                // Ajouter un log de debug
                console.log('Son de pas d\'un autre joueur - Volume:', data.volume, 'Distance:', data.distance);
                
                if (!audioManager.lastRemoteFootstepTimes) {
                    audioManager.lastRemoteFootstepTimes = new Map();
                }
    
                const lastTime = audioManager.lastRemoteFootstepTimes.get(data.playerId) || 0;
                if (now - lastTime >= interval) {
                    audioManager.playSpatialisedSound('footstep', data.volume);
                    audioManager.lastRemoteFootstepTimes.set(data.playerId, now);
                }
            }
        }
    });

    if (!socket.hasListeners('capturedByBlackBot')) {
        socket.on('capturedByBlackBot', (data) => {
            showCaptureNotification(data.message);
            showPlayerLocator = true;
            locatorFadeStartTime = Date.now() + 3000;
            setTimeout(() => {
                showPlayerLocator = false;
            }, 3500);
        });
    }
    
    socket.on('playerCapturedEnemy', (data) => {
        if (data.capturedNickname === 'Bot Noir') {
            // Effet visuel pour la capture d'un black bot
            if (data.position) {
                const screenPos = worldToScreen(data.position.x, data.position.y);
                createFloatingPoints(screenPos.x, screenPos.y, 15, '#ffd700'); // Couleur dorée
                
                // Effet visuel supplémentaire d'explosion
                if (audioManager) {
                    audioManager.playSound('blackBotDestroy');
                }
                
                createExplosionEffect(data.position.x, data.position.y);
            }
        } else {
            // Code existant pour la capture des joueurs normaux
            const player = entities.find(e => e.id === data.capturedId);
            if (player) {
                const screenPos = worldToScreen(player.x, player.y);
                createFloatingPoints(screenPos.x, screenPos.y, data.botsGained, '#cc99ff');
            }
        }
        showCaptureNotification(data.message || `Vous avez capturé ${data.capturedNickname} !`);
    });

    if (!socket.hasListeners('gameOver')) {
        socket.on('gameOver', (data) => {
            showGameOverModal(data.scores);
        });
    }

    if (!socket.hasListeners('activateBonus')) {
        socket.on('activateBonus', (data) => {
            const { type, duration } = data;
            console.log('Bonus activé:', type); // Debug
        
            // Jouer le son de collecte
            if (audioManager) {
                // Jouer immédiatement le son de collecte
                audioManager.playSound('bonusCollect');
                console.log('Son de collecte de bonus joué');
        
                // Le son continu
                const soundMap = {
                    'speed': 'speedBoostActive',
                    'invincibility': 'invincibilityActive',
                    'reveal': 'revealActive'
                };
                
                const soundName = soundMap[type];
                if (soundName) {
                    audioManager.playLoopingSound(soundName, 0.2);
                }
            } else {
                console.log('AudioManager non disponible'); // Debug
            }
        
            switch(type) {
                case 'speed':
                    speedBoostActive = true;
                    speedBoostTimeLeft = speedBoostTimeLeft > 0 ? 
                        speedBoostTimeLeft + duration : 
                        duration;
                    break;
                case 'invincibility':
                    invincibilityActive = true;  // S'assurer que l'état reste actif
                    invincibilityTimeLeft = invincibilityTimeLeft > 0 ? 
                        invincibilityTimeLeft + duration : 
                        duration;
                    // Réinitialiser l'effet visuel si nécessaire
                    const player = entities.find(e => e.id === playerId);
                    if (player) {
                        player.invincibilityActive = true;
                    }
                    break;
                case 'reveal':
                    revealActive = true;
                    revealTimeLeft = revealTimeLeft > 0 ? 
                        revealTimeLeft + duration : 
                        duration;
                    break;
            }
            
            showBonusNotification(type);
            updateActiveBonusesDisplay();
        });
    }

    if (!socket.hasListeners('pauseGame')) {
        socket.on('pauseGame', (data) => {
            isPaused = true;
            if (audioManager) {
                audioManager.stopFootsteps();
                audioManager.stopLoopingSound('speedBoostActive');
                audioManager.stopLoopingSound('invincibilityActive');
                audioManager.stopLoopingSound('revealActive');
            }
            pauseButton.disabled = socket.id !== data.pausedBy;
            showPauseOverlay();
        });
    }
    
    if (!socket.hasListeners('resumeGame')) {
        socket.on('resumeGame', () => {
            isPaused = false;
            pauseButton.disabled = false;
            hidePauseOverlay();
        });
    }

    // Nettoyer et réinitialiser les écouteurs d'événements
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    pauseButton.removeEventListener('click', handlePauseClick);
    pauseButton.addEventListener('click', handlePauseClick);

    // Réinitialiser la boucle de jeu
    if (gameLoopInterval) {
        clearInterval(gameLoopInterval);
    }

    gameLoopInterval = setInterval(() => {
        if (!isPaused && !isGameOver) {
            movePlayer();
            updateBonusTimers();
            updateCamera();
            updateMalusEffects();
            updateEffectsPositions();
        }
    }, 20);

} catch (error) {
    console.error('Erreur lors du démarrage du jeu:', error);
}
    
}

function showMalusNotification(message) {
    collectedBonusDisplayContent.textContent = message;
    collectedBonusDisplay.classList.remove('hidden');

    setTimeout(() => {
        collectedBonusDisplay.classList.add('hidden');
    }, 3000);
}

function drawBonus(bonus, context) {
    const animation = bonusAnimations[bonus.type];
    const effect = BONUS_EFFECTS[bonus.type];
    
    if (!animation || !effect) return;

    context.save();
    
    // Calculer l'opacité pour le clignotement
    let opacity = 1;
    if (bonus.isBlinking) {
        opacity = 0.3 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.7;
    }
    
    // Dessiner l'effet de lueur
    context.beginPath();
    context.arc(bonus.x, bonus.y, 22, 0, Math.PI * 2);
    context.fillStyle = effect.backgroundColor;
    context.globalAlpha = opacity * 0.6;
    context.fill();

    // Ajouter un second cercle pour plus d'effet
    context.beginPath();
    context.arc(bonus.x, bonus.y, 20, 0, Math.PI * 2);
    context.fillStyle = effect.borderColor;
    context.globalAlpha = opacity * 0.3;
    context.fill();

    // Dessiner le contour
    context.strokeStyle = effect.borderColor;
    context.lineWidth = 2 + (opacity * 1);
    context.globalAlpha = opacity * 0.8;
    context.stroke();

    // Mettre à jour et dessiner l'animation
    animation.update(Date.now());
    animation.draw(context, bonus.x, bonus.y, 30, 30);

    context.restore();
}

function drawMalus(malus, context) {
    const animation = malusAnimations[malus.type];
    const effect = MALUS_EFFECTS[malus.type];
    
    if (!animation || !effect) return;

    context.save();
    
    // Calculer l'opacité pour le clignotement
    let opacity = 1;
    if (malus.isBlinking) {
        opacity = 0.3 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.7;
    }
    
    // Dessiner l'effet de lueur
    context.beginPath();
    context.arc(malus.x, malus.y, 22, 0, Math.PI * 2);
    context.fillStyle = effect.backgroundColor;
    context.globalAlpha = opacity * 0.6;
    context.fill();

    // Ajouter un second cercle pour plus d'effet
    context.beginPath();
    context.arc(malus.x, malus.y, 20, 0, Math.PI * 2);
    context.fillStyle = effect.borderColor;
    context.globalAlpha = opacity * 0.3;
    context.fill();

    // Dessiner le contour
    context.strokeStyle = effect.borderColor;
    context.lineWidth = 2 + (opacity * 1);
    context.globalAlpha = opacity * 0.8;
    context.stroke();

    // Mettre à jour et dessiner l'animation
    animation.update(Date.now());
    animation.draw(context, malus.x, malus.y, 30, 30);

    context.restore();
}

// Ajoutez cette fonction pour mettre à jour l'état de mouvement
function updateEntityMovement(entity) {
    const lastPos = lastEntityPositions.get(entity.id) || { x: entity.x, y: entity.y };
    const dx = entity.x - lastPos.x;
    const dy = entity.y - lastPos.y;
    
    // Considérer l'entité en mouvement si elle s'est déplacée de plus de 0.1 pixel
    const isMoving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
    
    // Mettre à jour l'état de mouvement
    entityMovementStates.set(entity.id, isMoving);
    
    // Sauvegarder la position actuelle pour la prochaine frame
    lastEntityPositions.set(entity.id, { x: entity.x, y: entity.y });
    
    return isMoving;
}

// Définition du sprite sheet pour le bonus de vitesse
const BONUS_SPRITES = {
    speed: {
        src: '/assets/images/speed.png',
        frames: 2,
        fps: 8,
        frameWidth: 50,
        frameHeight: 50
    },
    invincibility: {
        src: '/assets/images/shield.png',
        frames: 2,
        fps: 8,
        frameWidth: 50,
        frameHeight: 50
    },
    reveal: {
        src: '/assets/images/eye.png',
        frames: 2,
        fps: 8,
        frameWidth: 50,
        frameHeight: 50
    }
};

const MALUS_SPRITES = {
    reverse: {
        src: '/assets/images/reverse.png',
        frames: 2,
        fps: 8,
        frameWidth: 50,
        frameHeight: 50
    },
    blur: {
        src: '/assets/images/blur.png',
        frames: 2,
        fps: 8,
        frameWidth: 50,
        frameHeight: 50
    },
    negative: {
        src: '/assets/images/negative.png',
        frames: 2,
        fps: 8,
        frameWidth: 50,
        frameHeight: 50
    }
};

class SpriteAnimation {
    constructor(spriteInfo) {
        this.image = new Image();
        this.image.src = spriteInfo.src;
        this.frames = spriteInfo.frames;
        this.fps = spriteInfo.fps;
        this.frameWidth = spriteInfo.frameWidth;
        this.frameHeight = spriteInfo.frameHeight;
        this.currentFrame = 0;
        this.lastFrameTime = 0;
        this.frameDuration = 1000 / this.fps;
    }

    update(currentTime) {
        if (this.lastFrameTime === 0) {
            this.lastFrameTime = currentTime;
            return;
        }

        const deltaTime = currentTime - this.lastFrameTime;

        if (deltaTime >= this.frameDuration) {
            this.currentFrame = (this.currentFrame + 1) % this.frames;
            this.lastFrameTime = currentTime;
        }
    }

    draw(context, x, y, width, height) {
        if (!this.image.complete) return;

        const sourceX = this.currentFrame * this.frameWidth;
        const sourceY = 0;

        context.drawImage(
            this.image,
            sourceX, sourceY,
            this.frameWidth, this.frameHeight,
            x - width/2, y - height/2,
            width, height
        );
    }
}

function initializeAnimations() {
    // Initialiser les animations des bonus
    bonusAnimations = {};
    for (const [type, spriteInfo] of Object.entries(BONUS_SPRITES)) {
        bonusAnimations[type] = new SpriteAnimation(spriteInfo);
    }
    
    // Initialiser les animations des malus
    malusAnimations = {};
    for (const [type, spriteInfo] of Object.entries(MALUS_SPRITES)) {
        malusAnimations[type] = new SpriteAnimation(spriteInfo);
    }
}

// Rendu du jeu
function drawEntities() {
    spriteManager.updateAnimation();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // Sauvegarder le contexte
    context.save();
    
    // Effacer le canvas avec une couleur de fond (évite le scintillement du fond)
    context.fillStyle = '#2c3e50';  // Couleur de fond par défaut
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Arrondir les positions de la caméra pour éviter le rendu sur des demi-pixels
    const cameraX = Math.round(camera.x);
    const cameraY = Math.round(camera.y);

    // Dessiner la map et ses collisions
    mapManager.draw(context, camera);
    
    // Appliquer la transformation de la caméra
    context.translate(Math.round(canvas.width / 2), Math.round(canvas.height / 2));
    context.scale(camera.scale, camera.scale);
    context.translate(-cameraX, -cameraY);

    // Dessiner les limites de la zone de jeu
    context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    context.lineWidth = 4;
    context.strokeRect(0, 0, GAME_VIRTUAL_WIDTH, GAME_VIRTUAL_HEIGHT);

    // Dessiner les zones spéciales
    if (specialZones) {
        specialZones.forEach(zone => {
            context.fillStyle = zone.type.color;
            context.strokeStyle = zone.type.borderColor;
            context.lineWidth = 2;

            if (zone.shape.type === 'circle') {
                context.beginPath();
                context.arc(zone.shape.x, zone.shape.y, zone.shape.radius, 0, Math.PI * 2);
                context.fill();
                context.stroke();
                
                context.fillStyle = 'white';
                context.font = '20px PermanentMarker-Regular';
                context.textAlign = 'center';
                context.fillText(zone.type.name, zone.shape.x, zone.shape.y);
            } else {
                context.fillRect(zone.shape.x, zone.shape.y, zone.shape.width, zone.shape.height);
                context.strokeRect(zone.shape.x, zone.shape.y, zone.shape.width, zone.shape.height);
                
                context.fillStyle = 'white';
                context.font = '20px PermanentMarker-Regular';
                context.textAlign = 'center';
                context.fillText(
                    zone.type.name,
                    zone.shape.x + zone.shape.width/2,
                    zone.shape.y + zone.shape.height/2
                );
            }
        });
    }

    // Flèche de localisation pour le joueur courant
    const currentPlayer = entities.find(e => e.id === playerId);
    if (showPlayerLocator && currentPlayer) {
        drawPlayerLocator(currentPlayer);
    }

    // Dessiner les entités
    entities.forEach(entity => {
        const isMoving = updateEntityMovement(entity);

        // Vérifier la visibilité dans les zones de type STEALTH
        const isInInvisibilityZone = specialZones?.some(zone => {
            if (zone.type.id !== 'STEALTH') return false;
            if (zone.shape.type === 'circle') {
                return Math.hypot(entity.x - zone.shape.x, entity.y - zone.shape.y) <= zone.shape.radius;
            }
            return false;
        });

        // Ne pas dessiner les joueurs invisibles (sauf le joueur local)
        if (isInInvisibilityZone && entity.type === 'player' && entity.id !== playerId) {
            return;
        }

        // Gérer l'opacité pour les zones d'invisibilité
        if (isInInvisibilityZone && entity.id === playerId) {
            context.globalAlpha = 0.3;
        }

        // Pour les bots, on ajoute la gestion de la transition
        if (entity.type === 'bot') {
            const previousState = lastEntityStates.get(entity.id);
            if (previousState && previousState.color !== entity.color) {
                // Le bot vient de changer de couleur
                createCaptureEffect(entity);
            }
        }

        // Dessiner l'entité avec son sprite animé
        const coloredSprite = spriteManager.getColoredSprite(
            entity.direction || DIRECTIONS.IDLE,
            entity.color,
            isMoving
        );

        if (entity.type === 'player' && entity.id !== playerId && revealActive && currentPlayer) {
            // Effet de révélation : lueur violette autour des vrais joueurs
            context.beginPath();
            const now = Date.now();
            const glowSize = 25 + Math.sin(now * 0.005) * 3;
            context.arc(entity.x, entity.y, glowSize, 0, Math.PI * 2);
            context.fillStyle = 'rgba(255, 0, 255, 0.2)';
            context.fill();
    
            // Ajouter un contour plus visible
            context.strokeStyle = 'rgba(255, 0, 255, 0.4)';
            context.lineWidth = 2;
            context.stroke();
            
            // Optionnel : ajouter un effet de particules ou d'étoiles
            const particleCount = 4;
            const radius = 20;
            for (let i = 0; i < particleCount; i++) {
                const angle = (now * 0.001 + (i / particleCount) * Math.PI * 2);
                const x = entity.x + Math.cos(angle) * radius;
                const y = entity.y + Math.sin(angle) * radius;
                
                context.beginPath();
                context.arc(x, y, 2, 0, Math.PI * 2);
                context.fillStyle = 'rgba(255, 0, 255, 0.6)';
                context.fill();
            }
        }

        // Pour les bots noirs
        if (entity.type === 'blackBot') {
        // Effet de lueur rouge pour le rayon de détection
        context.beginPath();
        context.arc(entity.x, entity.y, entity.detectionRadius, 0, Math.PI * 2);
        context.fillStyle = 'rgba(255, 0, 0, 0.1)';
        context.fill();
            
        // Effet de pulsation
        const pulseSize = 13 + Math.sin(Date.now() * 0.01) * 2;
        context.beginPath();
        context.arc(entity.x, entity.y, pulseSize, 0, Math.PI * 2);
        context.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        context.stroke();
        }
        
        // Si c'est le joueur courant, dessiner les effets de bonus en premier
        if (entity.id === playerId) {
            // Effet de boost de vitesse
            if (speedBoostActive) {
                const now = Date.now();
                const glowSize = 25 + Math.sin(now * 0.006) * 5;
                context.beginPath();
                context.arc(entity.x, entity.y, glowSize, 0, Math.PI * 2);
                context.fillStyle = 'rgba(0, 255, 0, 0.2)';
                context.fill();
            }

            // Effet d'invincibilité
            if (invincibilityActive && invincibilityTimeLeft > 0) {
                const now = Date.now();
                const pulseSize = 20 + Math.sin(now * 0.004) * 5;
                context.beginPath();
                context.arc(entity.x, entity.y, pulseSize, 0, Math.PI * 2);
                context.fillStyle = 'rgba(255, 215, 0, 0.3)';
                context.fill();
            }

            // Effet de révélation
            if (revealActive) {
                const now = Date.now();
                const revealSize = 15 + Math.sin(now * 0.005) * 3;
                context.beginPath();
                context.arc(entity.x, entity.y, revealSize, 0, Math.PI * 2);
                context.fillStyle = 'rgba(255, 0, 255, 0.2)';
                context.fill();
            }
        }

        if (coloredSprite) {
            // Ajouter l'ombre portée pour le joueur courant
            if (entity.id === playerId) {
                context.save();
                context.beginPath();
                // Augmenter le décalage vertical de l'ombre (de 2 à 6 pixels)
                context.arc(entity.x, entity.y + 10, 12, 0, Math.PI * 2);
                context.fillStyle = 'rgba(0, 0, 0, 0.2)';
                context.fill();
                context.restore();
            }

            // Dessiner le sprite
            context.drawImage(
                coloredSprite,
                entity.x - 16,
                entity.y - 16,
                32,
                32
            );

            // Effets spéciaux
            if (entity.invincibilityActive) {
                context.globalAlpha = 0.3;
                context.beginPath();
                context.arc(entity.x, entity.y, 20, 0, Math.PI * 2);
                context.fillStyle = '#FFD700';
                context.fill();
                context.globalAlpha = 1;
            }
        }

        // Réinitialiser l'alpha
        context.globalAlpha = 1;
    });

    // Dessiner les bonus
    if (bonuses) {
        bonuses.forEach(bonus => drawBonus(bonus, context));
    }

    // Dessiner les malus
    if (socket.malus) {
        socket.malus.forEach(malus => drawMalus(malus, context));
    }

    // Nettoyer le tracking des entités qui ne sont plus présentes
    cleanupEntityTracking();

    // Dessiner le calque de premier plan après toutes les entités
    mapManager.drawForeground(context, camera);

    // Mettre à jour lastEntityStates pour la prochaine frame
    entities.forEach(entity => {
        lastEntityStates.set(entity.id, { ...entity });
    });

    context.restore();
}

// Nettoyer les entités qui ne sont plus présentes
function cleanupEntityTracking() {
    const currentIds = new Set(entities.map(e => e.id));
    
    for (const id of lastEntityPositions.keys()) {
        if (!currentIds.has(id)) {
            lastEntityPositions.delete(id);
            entityMovementStates.delete(id);
        }
    }
}

// Fonction de gestion des effets de malus
function handleMalusEffect(type, duration) {
    const currentTime = Date.now();
    activemalus.set(type, {
        endTime: currentTime + (duration * 1000),
        startTime: currentTime
    });

    // Appliquer l'effet spécifique
    switch (type) {
        case 'reverse':
            // Géré dans la fonction de mouvement
            break;
        case 'blur':
            applyBlurEffect();
            break;
        case 'negative':
            applyNegativeEffect();
            break;
    }
}

// Fonctions pour les effets visuels
function applyBlurEffect() {
    const gameCanvas = document.getElementById('gameCanvas');
    // N'appliquer le flou qu'au canvas de jeu
    gameCanvas.style.filter = 'blur(8px)';
    // S'assurer que l'interface reste nette
    document.getElementById('gameInterface').style.filter = 'none';
    document.getElementById('activeBonuses').style.filter = 'none';
    document.getElementById('playerList').style.filter = 'none';
}

function applyNegativeEffect() {
    const gameCanvas = document.getElementById('gameCanvas');
    gameCanvas.style.filter = 'grayscale(100%)';
}

function removeVisualEffects() {
    const gameCanvas = document.getElementById('gameCanvas');
    gameCanvas.style.filter = 'none';
}

// Nouvelle fonction pour dessiner les effets de bonus
function drawBonusEffects(player) {
    const now = Date.now();
    const activeEffects = [];

    // Collecter les effets actifs
    if (speedBoostActive) activeEffects.push('speed');
    if (invincibilityActive) activeEffects.push('invincibility');
    if (revealActive) activeEffects.push('reveal');

    if (activeEffects.length === 0) return;

    context.save();

    // Calculer la taille totale de l'effet en fonction du nombre de bonus actifs
    activeEffects.forEach((effectType, index) => {
        const effect = BONUS_EFFECTS[effectType];
        const baseGlowSize = effect.glowSize;
        const pulse = Math.sin(now * effect.pulseSpeed) * 5;
        const offsetDistance = index * 8; // Décalage pour les effets multiples

        // Créer un dégradé radial pour l'effet de lueur
        const gradient = context.createRadialGradient(
            player.x, player.y, 10 + offsetDistance,
            player.x, player.y, baseGlowSize + pulse + offsetDistance
        );

        // Calculer l'opacité en fonction du nombre d'effets actifs
        const baseOpacity = 0.7 / Math.max(1, activeEffects.length);
        gradient.addColorStop(0, `${effect.color}${Math.floor(baseOpacity * 255).toString(16).padStart(2, '0')}`);
        gradient.addColorStop(1, 'transparent');

        // Dessiner l'effet de lueur
        context.beginPath();
        context.fillStyle = gradient;
        context.arc(player.x, player.y, baseGlowSize + pulse + offsetDistance, 0, Math.PI * 2);
        context.fill();

        // Ajouter un contour subtil
        context.strokeStyle = `${effect.color}40`; // 25% opacité
        context.lineWidth = 2;
        context.stroke();
    });

    context.restore();
}

// dessiner la flèche de localisation
function drawPlayerLocator(player) {
    const now = Date.now();
    let opacity = 1;
    
    // Calculer l'opacité pour le fade out
    if (now > locatorFadeStartTime) {
        opacity = 1 - (now - locatorFadeStartTime) / LOCATOR_FADE_DURATION;
        opacity = Math.max(0, Math.min(1, opacity));
    }

    const ARROW_DISTANCE = 80;  // Augmenté : Distance des flèches par rapport au point
    const ARROW_SIZE = 40;      // Augmenté : Taille des flèches
    const ARROW_WIDTH = 30;     // Nouveau : Largeur de la base des flèches
    const BOUNCE_AMOUNT = 8;    // Augmenté : Amplitude de l'animation
    const BOUNCE_SPEED = 0.004; // Vitesse de l'animation
    const LINE_WIDTH = 3;       // Augmenté : Épaisseur du contour

    // Calculer l'animation de pulsation
    const bounce = Math.sin(now * BOUNCE_SPEED) * BOUNCE_AMOUNT;
    
    context.save();
    
    // Pour chaque direction (haut, droite, bas, gauche)
    const directions = [
        { angle: 0, dx: 0, dy: -1 },     // Haut
        { angle: Math.PI/2, dx: 1, dy: 0 },      // Droite
        { angle: Math.PI, dx: 0, dy: 1 },    // Bas
        { angle: -Math.PI/2, dx: -1, dy: 0 }     // Gauche
    ];

    directions.forEach(dir => {
        context.save();
        
        // Positionner la flèche
        const arrowX = player.x + (dir.dx * (ARROW_DISTANCE + bounce));
        const arrowY = player.y + (dir.dy * (ARROW_DISTANCE + bounce));
        
        context.translate(arrowX, arrowY);
        context.rotate(dir.angle);

        // Dessiner la flèche
        context.beginPath();
        context.moveTo(0, ARROW_SIZE);          // Pointe de la flèche
        context.lineTo(-ARROW_WIDTH, 0);        // Côté gauche
        context.lineTo(ARROW_WIDTH, 0);         // Côté droit
        context.closePath();

        // Remplir avec un rouge vif
        context.fillStyle = `rgba(255, 30, 30, ${opacity})`;
        context.fill();

        // Contour plus épais de la flèche
        context.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        context.lineWidth = LINE_WIDTH;
        context.stroke();

        // Ajouter un effet de lueur
        context.shadowColor = `rgba(255, 0, 0, ${opacity * 0.5})`;
        context.shadowBlur = 10;
        context.stroke();

        context.restore();
    });

    context.restore();
}

// Gestion des bonus
function activateSpeedBoost(duration) {
    console.log('Speed boost activé pour', duration, 'secondes'); // Debug
    speedBoostActive = true;
    speedBoostTimeLeft += duration;
    playerSpeed = 6;
}

function activateInvincibility(duration) {
    invincibilityActive = true;
    invincibilityTimeLeft += duration;
}

function activateReveal(duration) {
    revealActive = true;
    revealTimeLeft += duration;
}

function handleBonusCollection(player, bonus) {
    const socket = activeSockets[player.id];
    if (!socket) return;

    if (audioManager) {
        // Son de collecte du bonus
        audioManager.playSound('bonusCollect');
        
        // Démarrer le son en continu approprié
        switch(bonus.type) {
            case 'speed':
                audioManager.playLoopingSound('speedBoostActive', 0.2);
                break;
            case 'invincibility':
                audioManager.playLoopingSound('invincibilityActive', 0.2);
                break;
            case 'reveal':
                audioManager.playLoopingSound('revealActive', 0.2);
                break;
        }
    }

    switch(bonus.type) {
        case 'speed':
            activateSpeedBoost(currentGameSettings.speedBoostDuration);
            break;
        case 'invincibility':
            activateInvincibility(currentGameSettings.invincibilityDuration);
            break;
        case 'reveal':
            activateReveal(currentGameSettings.revealDuration);
            break;
    }
}

function updateTimer(timeLeft) {
    const timerElement = document.getElementById('timer');
    const timeDisplay = document.getElementById('time');
    
    // Convertir les secondes en minutes:secondes
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Mettre à jour l'affichage
    timeDisplay.textContent = formattedTime;
    
    // Gérer l'état d'urgence (10 dernières secondes)
    if (timeLeft <= 10) {
        timerElement.classList.add('urgent');

        // Jouer le son d'urgence seulement une fois par seconde
        const currentTime = Date.now();
        if (audioManager && timeLeft > 0 && currentTime - lastUrgentTickTime >= 1000) {
            audioManager.playSound('urgentTick');
            lastUrgentTickTime = currentTime;
        }
        
        // Son final à 0
        if (timeLeft === 0 && audioManager) {
            audioManager.playSound('finalTick');
        }
    } else {
        timerElement.classList.remove('urgent');
    }
}

function updateBonusTimers() {
    const deltaTime = 0.02;  // 20ms en secondes
    let bonusesChanged = false;

    // Fonction pour mettre à jour un timer spécifique
    function updateSingleTimer(active, timeLeft, type) {
        if (active) {
            const newTime = Math.max(0, timeLeft - deltaTime);
            if (newTime <= 0) {
                // Arrêter le son du bonus quand il expire
                if (audioManager) {
                    switch(type) {
                        case 'speed':
                            audioManager.stopLoopingSound('speedBoostActive');
                            break;
                        case 'invincibility':
                            audioManager.stopLoopingSound('invincibilityActive');
                            break;
                        case 'reveal':
                            audioManager.stopLoopingSound('revealActive');
                            break;
                    }
                }
                
                // Notifier le serveur quand un bonus se termine
                socket.emit('bonusExpired', { type });
                return { active: false, timeLeft: 0, changed: true };
            }
            if (Math.ceil(newTime) !== Math.ceil(timeLeft)) {
                bonusesChanged = true;
            }
            return { active: true, timeLeft: newTime, changed: false };
        }
        return { active: false, timeLeft: 0, changed: false };
    }

    // Mettre à jour les timers
    const speedUpdate = updateSingleTimer(speedBoostActive, speedBoostTimeLeft, 'speed');
    const invincibilityUpdate = updateSingleTimer(invincibilityActive, invincibilityTimeLeft, 'invincibility');
    const revealUpdate = updateSingleTimer(revealActive, revealTimeLeft, 'reveal');

    // Appliquer les mises à jour
    speedBoostActive = speedUpdate.active;
    speedBoostTimeLeft = speedUpdate.timeLeft;
    invincibilityActive = invincibilityUpdate.active;
    invincibilityTimeLeft = invincibilityUpdate.timeLeft;
    revealActive = revealUpdate.active;
    revealTimeLeft = revealUpdate.timeLeft;

    // Ne mettre à jour l'affichage que si nécessaire
    if (bonusesChanged) {
        requestAnimationFrame(() => {
            updateActiveBonusesDisplay();
        });
    }
}

function updateMalusEffects() {
    const currentTime = Date.now();
    let needsUpdate = false;

    activemalus.forEach((value, type) => {
        if (currentTime >= value.endTime) {
            activemalus.delete(type);
            needsUpdate = true;
        }
    });

    if (needsUpdate) {
        removeVisualEffects();
        // Réappliquer les effets actifs restants
        activemalus.forEach((value, type) => {
            switch (type) {
                case 'blur':
                    applyBlurEffect();
                    break;
                case 'negative':
                    applyNegativeEffect();
                    break;
            }
        });
    }
}

function updateActiveBonusesDisplay() {
    activeBonusesContainer.innerHTML = '';

    if (speedBoostActive) {
        activeBonusesContainer.appendChild(
            createActiveBonusElement('speed', speedBoostTimeLeft)
        );
    }
    if (invincibilityActive) {
        activeBonusesContainer.appendChild(
            createActiveBonusElement('invincibility', invincibilityTimeLeft)
        );
    }
    if (revealActive) {
        activeBonusesContainer.appendChild(
            createActiveBonusElement('reveal', revealTimeLeft)
        );
    }
}

function createActiveBonusElement(type, timeLeft) {
    const effect = BONUS_EFFECTS[type];
    const bonusDiv = document.createElement('div');
    bonusDiv.className = 'activeBonus new-bonus';
    bonusDiv.style.background = effect.backgroundColor;
    bonusDiv.style.borderColor = effect.borderColor;

    const img = document.createElement('img');
    img.src = bonusImages[type].src;
    img.alt = effect.name;
    img.style.filter = `drop-shadow(0 0 3px ${effect.color})`;

    const timerSpan = document.createElement('span');
    timerSpan.className = 'timer';
    // Formatter le temps pour avoir toujours le même format
    timerSpan.textContent = `${Math.ceil(timeLeft).toString().padStart(2, '0')}s`;
    timerSpan.style.color = effect.color;

    bonusDiv.appendChild(img);
    bonusDiv.appendChild(timerSpan);

    // Retirer la classe new-bonus après l'animation
    setTimeout(() => {
        bonusDiv.classList.remove('new-bonus');
    }, 300);

    return bonusDiv;
}

// Ajouter du CSS pour les styles des bonus actifs
const style = document.createElement('style');
style.textContent = `
.activeBonus {
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: rgba(0, 0, 0, 0.8);
    padding: 8px 15px;
    border-radius: 20px;
    border: 2px solid transparent;
    backdrop-filter: blur(5px);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    animation: bonusPulse 2s infinite;
}

.activeBonus img {
    width: 24px;
    height: 24px;
    filter: brightness(1.1);
    animation: bonusIconPulse 2s infinite;
}

.activeBonus .timer {
    font-weight: bold;
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

@keyframes bonusPulse {
    0% { box-shadow: 0 0 10px rgba(0, 0, 0, 0.3); }
    50% { box-shadow: 0 0 15px currentColor; }
    100% { box-shadow: 0 0 10px rgba(0, 0, 0, 0.3); }
}

@keyframes bonusIconPulse {
    0% { filter: brightness(1.1); }
    50% { filter: brightness(1.3); }
    100% { filter: brightness(1.1); }
}
`;
document.head.appendChild(style);

function getBonusName(bonusType) {
    switch (bonusType) {
        case 'speed': return 'Boost';
        case 'invincibility': return 'Invincibilité';
        case 'reveal': return 'Révélation';
        default: return '';
    }
}

// Mise à jour de la liste des joueurs
function updatePlayerList(playerScores) {
    playerListContainer.innerHTML = '';
    
    playerScores.forEach((player, index) => {
        const li = document.createElement('li');
        if (player.id === playerId) {
            li.className = 'current-player';
        }

        // Calcul du score total (bots actuels + captures)
        const totalScore = player.currentBots + player.captures;

        li.innerHTML = `
            <div class="player-rank">#${index + 1}</div>
            <div class="player-info">
                <div class="player-name">${player.nickname}</div>
                <div class="player-score">${totalScore}</div>
            </div>
        `;

        playerListContainer.appendChild(li);
    });
}

// Gestion des notifications et modales
function showBonusNotification(bonusType) {
    collectedBonusDisplayContent.textContent = getBonusName(bonusType);
    collectedBonusDisplay.classList.remove('hidden');

    setTimeout(() => {
        collectedBonusDisplay.classList.add('hidden');
    }, 3000);
}

function showGameOverModal(scores) {
    // Supprimer toute modale existante d'abord
    const existingModal = document.getElementById('game-over-modal');
    if (existingModal) {
        const oldInterval = existingModal.getAttribute('data-interval');
        if (oldInterval) {
            clearInterval(Number(oldInterval));
        }
        existingModal.remove();
    }
    if (audioManager) {
        audioManager.stopFootsteps();
        audioManager.stopLoopingSound('speedBoostActive');
        audioManager.stopLoopingSound('invincibilityActive');
        audioManager.stopLoopingSound('revealActive');
    }

    isGameOver = true;
    isPaused = true;
    pauseButton.disabled = true;

    const modal = document.createElement('div');
    modal.className = 'modal game-over-modal';
    modal.id = 'game-over-modal';

    const content = document.createElement('div');
    content.className = 'modal-content game-over-content';

    // En-tête
    content.innerHTML = '<h2 class="game-over-title">Fin de partie !</h2>';

    // Créer le container pour le contenu scrollable
    const scrollableContent = document.createElement('div');
    scrollableContent.className = 'game-over-scrollable-content';

    // Podium
    const topThree = scores.slice(0, 3);
    let podiumHTML = '<div class="podium-container">';

    const positions = [
        { index: 1, className: 'second', symbol: '🥈' },
        { index: 0, className: 'first', symbol: '👑' },
        { index: 2, className: 'third', symbol: '🥉' }
    ];

    positions.forEach(pos => {
        if (topThree[pos.index]) {
            const player = topThree[pos.index];
            podiumHTML += `
                <div class="podium-place ${pos.className}">
                    <div class="podium-badge">
                        <div class="podium-symbol">${pos.symbol}</div>
                        <div class="player-name">${player.nickname}</div>
                        <div class="score">${player.currentBots} points</div>
                    </div>
                    <div class="podium-block"></div>
                </div>`;
        }
    });

    podiumHTML += '</div>';

    // Stats détaillées avec slider horizontal
    const statsSection = `
        <div class="detailed-stats">
            <div class="stats-slider-container">
                <div class="stats-slider">
                    ${scores.map((player, index) => {
                        const capturedPlayersHTML = Object.values(player.capturedPlayers)
                            .map(cap => `${cap.nickname} (${cap.count}×)`)
                            .join(', ') || 'Aucun';

                        const capturedByHTML = Object.entries(player.capturedBy)
                            .map(([id, cap]) => `${cap.nickname} (${cap.count}×)`)
                            .join(', ') || 'Aucun';
                        
                        // Calculer les captures par les bots noirs
                        const blackBotCaptures = player.capturedByBlackBot || 0;
                        const blackBotText = blackBotCaptures > 0 ? `Black Ninja (${blackBotCaptures}×)` : '';
                        const capturedByFull = [capturedByHTML, blackBotText].filter(Boolean).join(', ');

                        return `
                            <div class="player-stats-card ${player.id === playerId ? 'current-player' : ''}">
                                <div class="player-header">
                                    <span class="rank">#${index + 1}</span>
                                    <span class="player-name">${player.nickname}</span>
                                </div>
                                <div class="stats-details">
                                    <div class="stat-row">🥷 Ninjas contrôlés: ${player.currentBots}</div>
                                    <div class="stat-row">👥 Joueurs capturés: ${capturedPlayersHTML}</div>
                                    <div class="stat-row">💀 Capturé par: ${capturedByFull}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="slider-controls">
                    <button class="slider-btn prev" disabled>◀</button>
                    <button class="slider-btn next">▶</button>
                </div>
            </div>
        </div>
    `;

    // Ajouter le podium et les stats au contenu scrollable
    scrollableContent.innerHTML = podiumHTML + statsSection;
    content.appendChild(scrollableContent);

    // Boutons de fin dans un container séparé
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'game-over-buttons';

    // Bouton Retour à la salle d'attente
    const waitingRoomButton = document.createElement('button');
    waitingRoomButton.className = 'primary-button';
    waitingRoomButton.textContent = 'Retour à la salle d\'attente';
    addButtonClickSound(waitingRoomButton); // Ajouter le son
    waitingRoomButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        returnToWaitingRoom();
    });

    // Bouton Menu Principal
    const mainMenuButton = document.createElement('button');
    mainMenuButton.className = 'secondary-button';
    mainMenuButton.textContent = 'Menu Principal';
    addButtonClickSound(mainMenuButton); // Ajouter le son
    mainMenuButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        returnToMainMenu();
    });

    // Ajout des boutons dans l'ordre
    buttonsDiv.appendChild(waitingRoomButton);
    buttonsDiv.appendChild(mainMenuButton);
    content.appendChild(buttonsDiv);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Initialiser le slider
    const slider = content.querySelector('.stats-slider');
    const prevBtn = content.querySelector('.slider-btn.prev');
    const nextBtn = content.querySelector('.slider-btn.next');
    let currentSlide = 0;
    const slideWidth = slider.querySelector('.player-stats-card').offsetWidth;
    const visibleSlides = Math.floor(slider.parentElement.offsetWidth / slideWidth);
    const maxSlide = scores.length - visibleSlides;

    function updateSliderButtons() {
        prevBtn.disabled = currentSlide <= 0;
        nextBtn.disabled = currentSlide >= maxSlide;
    }

    function slideCards(direction) {
        currentSlide = Math.max(0, Math.min(currentSlide + direction, maxSlide));
        slider.style.transform = `translateX(-${currentSlide * slideWidth}px)`;
        updateSliderButtons();
    }

    prevBtn.addEventListener('click', () => slideCards(-1));
    nextBtn.addEventListener('click', () => slideCards(1));
    updateSliderButtons();

        // Ajouter un timer de redirection
        const redirectTimer = document.createElement('div');
        redirectTimer.className = 'redirect-timer';
        redirectTimer.textContent = 'Retour à la salle d\'attente dans 30s';
        content.appendChild(redirectTimer);
    
        // Timer de 30 secondes
        let timeLeft = 30;
        const countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                const modalElement = document.getElementById('game-over-modal');
                if (modalElement) {
                    const timerElement = modalElement.querySelector('.redirect-timer');
                    if (timerElement) {
                        timerElement.textContent = `Retour à la salle d'attente dans ${timeLeft}s`;
                    }
                } else {
                    // La modale n'existe plus, nettoyer l'intervalle
                    clearInterval(countdownInterval);
                }
            } else {
                clearInterval(countdownInterval);
                const modalElement = document.getElementById('game-over-modal');
                if (modalElement && modalElement.parentNode) {
                    modalElement.parentNode.removeChild(modalElement);
                    returnToWaitingRoom();
                }
            }
        }, 1000);
    
        modal.setAttribute('data-interval', countdownInterval);

        // Modifier les event listeners des boutons
        waitingRoomButton.addEventListener('click', () => {
            clearInterval(countdownInterval);
            const modalElement = document.getElementById('game-over-modal');
            if (modalElement && modalElement.parentNode) {
                modalElement.parentNode.removeChild(modalElement);
            }
            returnToWaitingRoom();
        });
    
        mainMenuButton.addEventListener('click', () => {
            clearInterval(countdownInterval);
            const modalElement = document.getElementById('game-over-modal');
            if (modalElement && modalElement.parentNode) {
                modalElement.parentNode.removeChild(modalElement);
            }
            returnToMainMenu();
        });
    
        document.body.appendChild(modal);
    }

function showCaptureNotification(message) {
    collectedBonusDisplayContent.textContent = message;
    collectedBonusDisplay.classList.remove('hidden');

    setTimeout(() => {
        collectedBonusDisplay.classList.add('hidden');
    }, 3000);
}

// Nouvelle fonction pour retourner à la salle d'attente
function returnToWaitingRoom() {
    // Réinitialiser les états du jeu
    isGameOver = false;
    isPaused = false;
    pauseButton.disabled = false;

    // Réinitialiser les bonus
    speedBoostActive = false;
    invincibilityActive = false;
    revealActive = false;
    playerSpeed = 3;
    speedBoostTimeLeft = 0;
    invincibilityTimeLeft = 0;
    revealTimeLeft = 0;

    // Nettoyer l'interface
    activeBonusesContainer.innerHTML = '';
    playerListContainer.innerHTML = '';
    collectedBonusDisplay.classList.add('hidden');

    // Masquer l'écran de jeu
    gameScreen.classList.remove('active');

    // Réinitialiser la connexion socket si nécessaire
    if (!socket || !socket.connected) {
        socket = initializeSocket(io());
    }

    // S'assurer que les écouteurs d'événements sont en place
    if (!socket.hasListeners('updateWaitingRoom')) {
        socket.on('updateWaitingRoom', (players) => {
            updateWaitingRoomPlayers(players);
        });
    }

    if (!socket.hasListeners('gameSettingsUpdated')) {
        socket.on('gameSettingsUpdated', (settings) => {
            updateSettingsUI(settings);
            gameSettings = settings;
        });
    }

    // Arrêter la musique du jeu et remettre la musique du menu
    audioManager.fadeOutMusic(1000);
    setTimeout(() => {
        audioManager.playMusic('menu');
    }, 1000);

    // Rejoindre la salle d'attente avec une indication de retour de partie
    socket.emit('rejoinWaitingRoom', {
        nickname: playerNickname,
        wasInGame: true
    });

    // Afficher la salle d'attente
    initializeWaitingRoomTabs(); // Réinitialiser les onglets
    waitingRoomScreen.classList.add('active');


        // Attendre que le DOM soit prêt
        setTimeout(() => {
            initializeWaitingRoomTabs();
        }, 100);

    // Nettoyer les écouteurs d'événements du jeu
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    if (gameLoopInterval) {
        clearInterval(gameLoopInterval);
    }
}

function showCaptureModal(capturedNickname) {
    const modal = document.createElement('div');
    modal.className = 'modal';

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.innerHTML = `
        <h2>Vous avez capturé ${capturedNickname} !</h2>
        <button class="modal-button primary-button">OK</button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    const button = content.querySelector('.modal-button');
    button.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

function showPauseOverlay() {
    hidePauseOverlay(); // Nettoyer toute modale existante

    const modal = document.createElement('div');
    modal.className = 'modal pause-modal';
    modal.id = 'pause-modal';

    const content = document.createElement('div');
    content.className = 'modal-content pause-content';
    
    // Afficher des boutons différents selon qui a mis en pause
    const isCurrentPlayerPaused = !pauseButton.disabled;
    
    content.innerHTML = `
        <h2>Jeu en pause</h2>
        <div class="pause-buttons">
            ${isCurrentPlayerPaused ? 
                `<button class="primary-button" id="resumeButton">Reprendre</button>
                 <button class="secondary-button" id="returnMenuButton">Menu Principal</button>` 
                : 
                `<p>En attente de la reprise...</p>`
            }
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // N'ajouter les écouteurs que si c'est le joueur qui a mis en pause
    if (isCurrentPlayerPaused) {
        document.getElementById('resumeButton').addEventListener('click', () => {
            socket.emit('togglePause');
        });

        document.getElementById('returnMenuButton').addEventListener('click', () => {
            hidePauseOverlay();
            returnToMainMenu();
        });
    }
}

function hidePauseOverlay() {
    const modal = document.getElementById('pause-modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

function restartGame() {
    isGameOver = false;
    isPaused = false;
    pauseButton.disabled = false;

    speedBoostActive = false;
    invincibilityActive = false;
    revealActive = false;
    playerSpeed = 3;

    speedBoostTimeLeft = 0;
    invincibilityTimeLeft = 0;
    revealTimeLeft = 0;

    socket.emit('startGame', {
        nickname: playerNickname,
        settings: {
            ...gameSettings,
            gameDuration: parseInt(gameDurationInput.value) // Assurons-nous que la durée est bien envoyée
        },
        gameWidth: GAME_WIDTH,
        gameHeight: GAME_HEIGHT
    });
}

// Dans client.js, dans la fonction returnToMainMenu
function returnToMainMenu() {
    // Réinitialiser les états
    showPlayerLocator = false;
    isGameOver = false;
    isPaused = false;
    pauseButton.disabled = false;

    // Nettoyer l'interface
    hidePauseOverlay();
    activeBonusesContainer.innerHTML = '';
    playerListContainer.innerHTML = '';
    collectedBonusDisplay.classList.add('hidden');

    // Nettoyer la connexion socket
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    // Arrêter la musique du jeu et remettre la musique du menu
    audioManager.fadeOutMusic(1000);
    setTimeout(() => {
        audioManager.playMusic('menu');
    }, 1000);

    // Réinitialiser les bonus et états du jeu
    speedBoostActive = false;
    invincibilityActive = false;
    revealActive = false;
    playerSpeed = 3;
    speedBoostTimeLeft = 0;
    invincibilityTimeLeft = 0;
    revealTimeLeft = 0;
    keysPressed = {};

    // Arrêter la boucle de jeu
    if (gameLoopInterval) {
        clearInterval(gameLoopInterval);
        gameLoopInterval = null;
    }

    // Nettoyer le canvas
    if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Réinitialiser les écouteurs d'événements
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);

    // Gérer l'affichage des écrans
    gameScreen.classList.remove('active');
    waitingRoomScreen.classList.remove('active');
    mainMenu.classList.add('active');

    // Réinitialiser le champ de pseudo
    nicknameInput.value = '';
}

// Fonction pour mettre à jour la position des effets
function updateEffectsPositions() {
    const worldFixedElements = document.querySelectorAll('.world-fixed');
    worldFixedElements.forEach(element => {
        const worldX = parseFloat(element.dataset.worldX);
        const worldY = parseFloat(element.dataset.worldY);
        const screenPos = worldToScreen(worldX, worldY);
        
        element.style.left = `${screenPos.x}px`;
        element.style.top = `${screenPos.y}px`;
    });
}