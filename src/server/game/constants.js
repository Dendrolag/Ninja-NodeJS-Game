/**
 * @file constants.js
 * @description Constantes globales du jeu
 */

module.exports = {
    // Dimensions du jeu
    GAME_WIDTH: 2000,
    GAME_HEIGHT: 1500,

    // Paramètres de gameplay
    SPAWN_PROTECTION_TIME: 3000,
    CAPTURE_COOLDOWN: 1000,
    SAFE_SPAWN_DISTANCE: 100,
    BOT_SPEED: 5,
    SPAWN_MARGIN: 100,
    UPDATE_INTERVAL: 50,

    // Paramètres des bonus/malus
    WARNING_THRESHOLD: 3000,
    BONUS_LIFETIME: 8000,

    // Zones spéciales
    ZONE_TYPES: {
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
    },

    // Couleurs disponibles
    AVAILABLE_COLORS: [
        '#FF0000', '#00FF00', '#0000FF', 
        '#FFFF00', '#FF00FF', '#00FFFF'
    ]
};