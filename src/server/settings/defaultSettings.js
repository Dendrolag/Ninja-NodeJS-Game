/**
 * @file defaultSettings.js
 * @description Paramètres par défaut du jeu
 */

const DEFAULT_GAME_SETTINGS = {
    // Paramètres généraux
    gameDuration: 180,
    initialBotCount: 30,

    // Paramètres des bonus
    bonusSpawnInterval: 4,
    enableSpeedBoost: true,
    speedBoostDuration: 10,
    speedBoostSpawnRate: 25,
    enableInvincibility: true,
    invincibilityDuration: 10,
    invincibilitySpawnRate: 15,
    enableReveal: true,
    revealDuration: 10,
    revealSpawnRate: 20,

    // Paramètres des zones spéciales
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

    // Paramètres des bots noirs
    enableBlackBot: true,
    blackBotCount: 2,
    blackBotStartPercent: 50,
    blackBotDetectionRadius: 150,
    blackBotSpeed: 6,
    pointsLossPercent: 50,

    // Paramètres des malus
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

module.exports = {
    DEFAULT_GAME_SETTINGS
};