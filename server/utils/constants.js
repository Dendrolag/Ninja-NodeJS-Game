// server/utils/constants.js

// Game states
export const GameStates = {
    INITIALIZING: 'INITIALIZING',
    WAITING: 'WAITING',
    COUNTDOWN: 'COUNTDOWN',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    ENDED: 'ENDED'
};

// Game settings
export const DEFAULT_GAME_SETTINGS = {
    gameDuration: 180,
    enableSpeedBoost: true,
    speedBoostDuration: 10,
    speedBoostSpawnRate: 25,
    enableInvincibility: true,
    invincibilityDuration: 10,
    invincibilitySpawnRate: 15,
    enableReveal: true,
    revealDuration: 10,
    revealSpawnRate: 20,
    bonusSpawnInterval: 4,
    initialBotCount: 30,
    enableSpecialZones: true,
    zoneMinDuration: 10,
    zoneMaxDuration: 30,
    zoneSpawnInterval: 15,
    enabledZones: {
        CHAOS: true,
        REPEL: true,
        ATTRACT: true,
        STEALTH: true
    },
    enableBlackBot: true,
    blackBotCount: 2,
    blackBotStartPercent: 50,
    blackBotDetectionRadius: 150,
    blackBotSpeed: 6,
    pointsLossPercent: 50,
    enableMalus: true,
    malusSpawnInterval: 8,
    malusSpawnRate: 20,
    enableReverseControls: true,
    enableBlurVision: true,
    enableNegativeVision: true,
    reverseControlsDuration: 10,
    blurDuration: 12,
    negativeDuration: 14,
};

// Game dimensions
export const GAME_WIDTH = 2000;
export const GAME_HEIGHT = 1500;

// Game mechanics constants
export const SPAWN_PROTECTION_TIME = 3000;
export const CAPTURE_COOLDOWN = 1000;
export const SAFE_SPAWN_DISTANCE = 100;
export const BOT_SPEED = 2;
export const PLAYER_BASE_SPEED = 5;
export const SPEED_BOOST_MULTIPLIER = 1.5;
export const UPDATE_INTERVAL = 1000 / 60; // 60 FPS
export const GAME_START_COUNTDOWN = 5; // 5 secondes de countdown
export const SPAWN_MARGIN = 100;

// Directions enum
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

// Special zones
export const ZONE_TYPES = {
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
        name: "Zone d'Invisibilité",
        color: 'rgba(128, 0, 128, 0.2)',
        borderColor: 'rgba(128, 0, 128, 0.6)'
    }
};