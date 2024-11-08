const Bot = require('./bot');
const { DEFAULT_GAME_SETTINGS } = require('../settings/defaultSettings');

/**
 * @class BlackBot
 * @extends Bot
 * @description Bot spécial avec capacités de capture et de poursuite
 */
class BlackBot extends Bot {
    /**
     * @constructor
     * @param {string} id - Identifiant unique du bot noir
     * @param {Object} [options={}] - Options additionnelles
     */
    constructor(id, options = {}) {
        super(id, { ...options, color: '#000000' });
        
        this.type = 'blackBot';
        this.lastCaptureTime = 0;
        this.captureCooldown = 2000; // 2 secondes de cooldown
        
        // Paramètres de détection et poursuite
        this.detectionRadius = DEFAULT_GAME_SETTINGS.blackBotDetectionRadius;
        this.targetEntity = null;
        this.baseSpeed = DEFAULT_GAME_SETTINGS.blackBotSpeed;
        this.lastTargetSearch = 0;
    }

    /**
     * @method update
     * @description Met à jour l'état et le comportement du bot noir
     * @param {Object} gameState - État actuel du jeu
     * @param {boolean} isPaused - État de pause du jeu
     * @param {boolean} isGameOver - État de fin de partie
     */
    update(gameState, isPaused = false, isGameOver = false) {
        if (isPaused || isGameOver) return;

        const now = Date.now();
        
        // Recherche périodique de cible
        if (!this.targetEntity || now - this.lastTargetSearch > 500) {
            this.findNewTarget(gameState);
            this.lastTargetSearch = now;
        } else if (this.targetEntity) {
            // Vérification de la présence de joueurs pendant la poursuite d'un bot
            if (this.targetEntity.type === 'bot') {
                const nearbyPlayer = this.findNearbyPlayer(gameState);
                if (nearbyPlayer) {
                    this.targetEntity = nearbyPlayer;
                }
            }

            // Vérifier si la cible est toujours valide et à portée
            const target = gameState.getEntity(this.targetEntity.id);
            if (!target || this.distanceTo(target) > this.detectionRadius) {
                this.targetEntity = null;
            }
        }

        // Comportement basé sur l'état actuel
        if (this.targetEntity) {
            this.pursueTarget();
        } else {
            super.update(isPaused, isGameOver);
        }
    }

    /**
     * @private
     * @method findNewTarget
     * @description Recherche une nouvelle cible (joueur ou bot)
     * @param {Object} gameState - État du jeu
     */
    findNewTarget(gameState) {
        let nearestPlayer = null;
        let nearestPlayerDistance = Infinity;
        let nearestNormalBot = null;
        let nearestBotDistance = Infinity;

        // Parcourir toutes les entités pour trouver la meilleure cible
        gameState.getAllEntities().forEach(entity => {
            if (entity.id === this.id) return;
            const distance = this.distanceTo(entity);

            if (distance < this.detectionRadius) {
                if (entity.type === 'player' && !entity.invincibilityActive && !entity.isInvulnerable()) {
                    if (distance < nearestPlayerDistance) {
                        nearestPlayerDistance = distance;
                        nearestPlayer = entity;
                    }
                } else if (entity.type === 'bot' && entity.color !== '#FFFFFF') {
                    if (distance < nearestBotDistance) {
                        nearestBotDistance = distance;
                        nearestNormalBot = entity;
                    }
                }
            }
        });

        // Prioriser les joueurs sur les bots
        this.targetEntity = nearestPlayer || nearestNormalBot;
    }

    /**
     * @private
     * @method pursueTarget
     * @description Poursuit la cible actuelle
     */
    pursueTarget() {
        if (!this.targetEntity) return;

        const dx = this.targetEntity.x - this.x;
        const dy = this.targetEntity.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Normaliser et appliquer la vitesse
        if (distance > 0) {
            this.vx = (dx / distance) * this.baseSpeed;
            this.vy = (dy / distance) * this.baseSpeed;
        }

        // Mise à jour de la position
        this.x += this.vx;
        this.y += this.vy;

        // Garder dans les limites du jeu
        this.x = Math.max(0, Math.min(GAME_WIDTH, this.x));
        this.y = Math.max(0, Math.min(GAME_HEIGHT, this.y));

        // Vérifier collision avec la cible
        if (distance < 20) {
            this.captureEntity(this.targetEntity);
        }
    }

    /**
     * @method captureEntity
     * @description Tente de capturer une entité
     * @param {Entity} entity - Entité à capturer
     */
    captureEntity(entity) {
        const now = Date.now();
        if (now - this.lastCaptureTime < this.captureCooldown) return;

        if (entity.type === 'player') {
            if (entity.invincibilityActive || entity.isInvulnerable()) return;

            const pointsLost = Math.floor(entity.botsControlled * (DEFAULT_GAME_SETTINGS.pointsLossPercent / 100));
            this.transformBots(entity.color, pointsLost);
            
            // Faire respawn le joueur
            entity.capturedByBlackBot++;
            entity.respawn([], true); // true pour garder la couleur
        } else if (entity.type === 'bot' && entity.color !== '#FFFFFF') {
            entity.color = '#FFFFFF';
        }

        this.lastCaptureTime = now;
        this.targetEntity = null;
    }

    /**
     * @private
     * @method transformBots
     * @description Transforme les bots d'une couleur donnée en bots blancs
     * @param {string} color - Couleur des bots à transformer
     * @param {number} count - Nombre de bots à transformer
     */
    transformBots(color, count) {
        // Cette méthode devrait être implémentée au niveau du GameState
        // car elle nécessite l'accès à tous les bots
        this.emit('transformBots', { color, count });
    }

    /**
     * @method serialize
     * @description Sérialise l'état du bot noir pour l'envoi au client
     * @override
     * @returns {Object}
     */
    serialize() {
        return {
            ...super.serialize(),
            detectionRadius: this.detectionRadius
        };
    }
}

module.exports = BlackBot;