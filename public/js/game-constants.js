// public/js/game-constants.js
export const SPEED_CONFIG = {
    PLAYER_BASE_SPEED: 3,                // Vitesse de base des joueurs
    BOT_SPEED: 5,                        // Vitesse de base des bots (déjà existant)
    SPEED_BOOST_MULTIPLIER: 1.7,         // Multiplicateur du bonus de vitesse
    MAX_SPEED_MULTIPLIER: 2,             // Limite maximale du multiplicateur de vitesse
    MOBILE_SPEED_FACTOR: 2               // Facteur de sensibilité pour le joystick mobile
};

export const GAME_MODES = {
    CLASSIC: 'classic',
    TACTICAL: 'tactical'
};

export const TACTICAL_MODE_CONFIG = {
    INITIAL_BOTS_COUNT: 45,      // Plus de bots au départ
    CAPTURE_ATTEMPTS_MAX: 5,     // Nombre maximum de tentatives
    CAPTURE_RECHARGE_TIME: 5000, // 5 secondes par recharge
    CAPTURE_CONE_ANGLE: 90,      // Angle du cône de capture en degrés
    CAPTURE_RANGE: 100,           // Portée de la capture
    CAPTURE_ANIMATION_DURATION: 300, // Durée de l'animation en ms
};


export const MAP_DIMENSIONS = {
    map1: { width: 2000, height: 1500 },
    map2: { width: 2000, height: 1500 },
    map3: { width: 3000, height: 2000 }
};

export const DEFAULT_GAME_SETTINGS = {
    gameMode: GAME_MODES.CLASSIC,  // Mode par défaut
    // Paramètres spécifiques au mode tactique
    enableCaptureSystem: true,     // Active le système de capture tactique
    showCaptureIndicator: true,    // Affiche l'indicateur de tentatives
    // Durée de la partie
    gameDuration: 180,         // Durée en secondes

    selectedMap: 'map1', // au lieu de 'tokyo'
    mirrorMode: false,
    
    // Configuration des bots
    initialBotCount: 50,       // Nombre de bots au démarrage
    
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