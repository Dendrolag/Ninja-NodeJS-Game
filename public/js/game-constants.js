// public/js/game-constants.js
export const SPEED_CONFIG = {
    PLAYER_BASE_SPEED: 3,                // Vitesse de base des joueurs
    BOT_SPEED: 5,                        // Vitesse de base des bots (déjà existant)
    SPEED_BOOST_MULTIPLIER: 1.7,         // Multiplicateur du bonus de vitesse
    MAX_SPEED_MULTIPLIER: 2,             // Limite maximale du multiplicateur de vitesse
    MOBILE_SPEED_FACTOR: 2               // Facteur de sensibilité pour le joystick mobile
};

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