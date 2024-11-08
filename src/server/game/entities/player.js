const Entity = require('./entity');
const { SPAWN_PROTECTION_TIME, CAPTURE_COOLDOWN } = require('../constants');
const { getUniqueColor } = require('../utils/colorUtils');

/**
 * @class Player
 * @extends Entity
 * @description Gère les joueurs et leurs interactions
 */
class Player extends Entity {
    /**
     * @constructor
     * @param {string} id - Identifiant unique du joueur
     * @param {string} nickname - Pseudo du joueur
     * @param {Object} [options={}] - Options additionnelles
     */
    constructor(id, nickname, options = {}) {
        // Appel du constructeur parent avec une couleur unique
        super(id, { ...options, color: getUniqueColor() });
        
        // Propriétés de base du joueur
        this.nickname = nickname;
        this.type = 'player';

        // Statistiques
        this.captures = 0;
        this.capturedPlayers = {};
        this.capturedBy = {};
        this.botsControlled = 0;
        this.totalBotsCaptures = 0;
        this.capturedByBlackBot = 0;

        // État et timers
        this.spawnProtection = Date.now() + SPAWN_PROTECTION_TIME;
        this.lastCapture = 0;
        this._invincibilityActive = false;
        this.speedBoostActive = false;
        this.bonusStartTime = 0;
        this.bonusTimers = {
            speed: 0,
            invincibility: 0,
            reveal: 0
        };
    }

    /**
     * @method isInvulnerable
     * @description Vérifie si le joueur est actuellement invulnérable
     * @returns {boolean}
     */
    isInvulnerable() {
        return this.invincibilityActive || Date.now() < this.spawnProtection;
    }

    /**
     * Getters et setters pour la gestion de l'invincibilité
     */
    get invincibilityActive() {
        return this._invincibilityActive;
    }

    set invincibilityActive(value) {
        this._invincibilityActive = Boolean(value);
    }

    /**
     * @method deactivateInvincibility
     * @description Désactive l'invincibilité du joueur
     */
    deactivateInvincibility() {
        this._invincibilityActive = false;
        if (this.bonusTimers) {
            this.bonusTimers.invincibility = 0;
        }
    }

    /**
     * @method addCapturedBots
     * @description Ajoute des bots capturés au compteur
     * @param {number} count - Nombre de bots capturés
     */
    addCapturedBots(count) {
        this.totalBotsCaptures += count;
    }

    /**
     * @method respawn
     * @description Fait réapparaître le joueur
     * @param {Array<string>} excludeColors - Couleurs à exclure
     * @param {boolean} keepColor - Conserver la couleur actuelle
     */
    respawn(excludeColors = [], keepColor = false) {
        // Position de spawn sécurisée à implémenter via SpawnManager
        const spawnPos = this.getSpawnPosition();
        this.setPosition(spawnPos.x, spawnPos.y);
        
        if (!keepColor) {
            this.color = getUniqueColor(new Set(), excludeColors);
        }
        this.spawnProtection = Date.now() + SPAWN_PROTECTION_TIME;
    }

    /**
     * @method canCapture
     * @description Vérifie si le joueur peut capturer
     * @returns {boolean}
     */
    canCapture() {
        return Date.now() - this.lastCapture > CAPTURE_COOLDOWN;
    }

    /**
     * @method update
     * @description Met à jour l'état du joueur
     * @param {number} deltaTime - Temps écoulé depuis la dernière mise à jour
     */
    update(deltaTime) {
        super.update(deltaTime);
        this.updateBonuses(deltaTime);
    }

    /**
     * @private
     * @method updateBonuses
     * @description Met à jour les bonus actifs
     * @param {number} deltaTime - Temps écoulé depuis la dernière mise à jour
     */
    updateBonuses(deltaTime) {
        // Gestion des timers de bonus
        if (this.bonusTimers) {
            for (const [bonusType, timeLeft] of Object.entries(this.bonusTimers)) {
                if (timeLeft > 0) {
                    this.bonusTimers[bonusType] = Math.max(0, timeLeft - deltaTime);
                    if (this.bonusTimers[bonusType] === 0) {
                        this.deactivateBonus(bonusType);
                    }
                }
            }
        }
    }

    /**
     * @method serialize
     * @description Sérialise l'état du joueur pour l'envoi au client
     * @override
     * @returns {Object}
     */
    serialize() {
        return {
            ...super.serialize(),
            nickname: this.nickname,
            invincibilityActive: this.invincibilityActive,
            speedBoostActive: this.speedBoostActive
        };
    }

    /**
     * @private
     * @method getSpawnPosition
     * @description Obtient une position de spawn sécurisée
     * @returns {{x: number, y: number}}
     */
    getSpawnPosition() {
        // À implémenter via SpawnManager
        // Pour l'instant, retourne une position aléatoire
        return {
            x: Math.random() * (GAME_WIDTH - 200) + 100,
            y: Math.random() * (GAME_HEIGHT - 200) + 100
        };
    }

    /**
     * @private
     * @method deactivateBonus
     * @description Désactive un bonus spécifique
     * @param {string} bonusType - Type de bonus à désactiver
     */
    deactivateBonus(bonusType) {
        switch (bonusType) {
            case 'speed':
                this.speedBoostActive = false;
                break;
            case 'invincibility':
                this.deactivateInvincibility();
                break;
            case 'reveal':
                // À implémenter
                break;
        }
    }
}

module.exports = Player;