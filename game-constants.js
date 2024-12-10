// game-constants.js

/**
 * Dimensions et configuration de l'espace de jeu
 */
export const SPEED_CONFIG = {
    PLAYER_BASE_SPEED: 3,                // Vitesse de base des joueurs
    BOT_SPEED: 5,                        // Vitesse de base des bots (déjà existant)
    SPEED_BOOST_MULTIPLIER: 1.7,         // Multiplicateur du bonus de vitesse
    MAX_SPEED_MULTIPLIER: 2,             // Limite maximale du multiplicateur de vitesse
};

export const GAME_CONFIG = {
    // Dimensions de la zone de jeu
    WIDTH: 2000,
    HEIGHT: 1500,
    
    // Configuration des marges et distances
    SPAWN_MARGIN: 100,           // Marge depuis les bords pour le spawn
    SAFE_SPAWN_DISTANCE: 100,    // Distance minimale entre les entités au spawn
    
    // Paramètres de mouvement
    BOT_SPEED: SPEED_CONFIG.BOT_SPEED,
    PLAYER_BASE_SPEED: SPEED_CONFIG.PLAYER_BASE_SPEED,
};

/**
 * Configuration des durées et intervalles de temps
 */
export const TIME_CONFIG = {
    // Compte à rebours et protection
    GAME_START_COUNTDOWN: 5,     // Durée du compte à rebours en secondes
    SPAWN_PROTECTION_TIME: 3000, // Durée de protection au spawn en ms
    CAPTURE_COOLDOWN: 1000,     // Délai entre les captures en ms
    
    // Intervalles de mise à jour
    SOUND_EMIT_INTERVAL: 50,    // Intervalle d'émission des sons en ms
    UPDATE_INTERVAL: 50        // Intervalle de mise à jour du jeu en ms
};

/**
 * Configuration du système de spawn
 */
export const SPAWN_CONFIG = {
    MAX_ATTEMPTS: 100,          // Nombre maximal de tentatives pour trouver une position valide
    GRID_SIZE: 50              // Taille de la grille pour la recherche en spirale
};

/**
 * Directions possibles pour les entités
 */
export const DIRECTIONS = {
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

/**
 * Configuration par défaut d'une partie
 */
export const DEFAULT_GAME_SETTINGS = {
    // Durée de la partie
    gameDuration: 180,         // Durée en secondes

    selectedMap: 'map1', // au lieu de 'tokyo'
    mirrorMode: false,
    
    // Configuration des bots
    initialBotCount: 30,       // Nombre de bots au démarrage
    
    // Configuration des bonus
    bonusSpawnInterval: 4,     // Intervalle entre les bonus en secondes
    
    enableSpeedBoost: true,
    speedBoostDuration: 10,
    speedBoostSpawnRate: 25,   // Pourcentage de chance d'apparition
    
    enableInvincibility: true,
    invincibilityDuration: 10,
    invincibilitySpawnRate: 15,
    
    enableReveal: true,
    revealDuration: 10,
    revealSpawnRate: 20,
    
    // Configuration des zones spéciales
    enableSpecialZones: true,
    zoneMinDuration: 10,       // Durée minimale en secondes
    zoneMaxDuration: 30,       // Durée maximale en secondes
    zoneSpawnInterval: 15,     // Intervalle d'apparition en secondes
    
    enabledZones: {
        CHAOS: true,
        REPEL: true,
        ATTRACT: true,
        STEALTH: true
    },
    
    // Configuration des Black Bots
    enableBlackBot: true,
    blackBotCount: 2,
    blackBotStartPercent: 50,  // Apparition à 50% du temps de partie
    blackBotDetectionRadius: 150,
    blackBotSpeed: 6,
    pointsLossPercent: 50,     // Pourcentage de points perdus lors d'une capture
    
    // Configuration des malus
    enableMalus: true,
    malusSpawnInterval: 8,
    malusSpawnRate: 20,
    enableReverseControls: true,
    enableBlurVision: true,
    enableNegativeVision: true,
    reverseControlsDuration: 10,
    blurDuration: 12,
    negativeDuration: 14
};