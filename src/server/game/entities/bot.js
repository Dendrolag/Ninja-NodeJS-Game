const Entity = require('./entity');
const { BOT_SPEED } = require('../constants');

/**
 * @class Bot
 * @extends Entity
 * @description Gère les bots standards et leur comportement
 */
class Bot extends Entity {
    /**
     * @constructor
     * @param {string} id - Identifiant unique du bot
     * @param {Object} [options={}] - Options additionnelles
     */
    constructor(id, options = {}) {
        super(id, options);
        
        this.type = 'bot';
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        
        // Paramètres de comportement
        this.changeDirectionInterval = Math.random() * 2000 + 1000;
        this.lastDirectionChange = Date.now();
        this.isMoving = true;
        this.stateDuration = Math.random() * 2000 + 1000;
        this.lastStateChange = Date.now();
    }

    /**
     * @method update
     * @description Met à jour l'état et la position du bot
     * @param {boolean} isPaused - État de pause du jeu
     * @param {boolean} isGameOver - État de fin de partie
     */
    update(isPaused = false, isGameOver = false) {
        if (isPaused || isGameOver) return;

        const now = Date.now();

        // Mise à jour de l'état (mobile/immobile)
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

    /**
     * @private
     * @method move
     * @description Gère le déplacement du bot
     */
    move() {
        const now = Date.now();

        // Changement de direction périodique
        if (now - this.lastDirectionChange > this.changeDirectionInterval) {
            this.changeDirection();
            this.lastDirectionChange = now;
            this.changeDirectionInterval = Math.random() * 2000 + 1000;
        }

        // Calcul de la nouvelle position
        const newX = this.x + (this.vx * BOT_SPEED);
        const newY = this.y + (this.vy * BOT_SPEED);

        // Gestion des collisions avec les bords
        if (newX <= 0 || newX >= GAME_WIDTH) {
            this.vx *= -1;
            this.x = Math.max(0, Math.min(GAME_WIDTH, newX));
        } else {
            this.x = newX;
        }

        if (newY <= 0 || newY >= GAME_HEIGHT) {
            this.vy *= -1;
            this.y = Math.max(0, Math.min(GAME_HEIGHT, newY));
        } else {
            this.y = newY;
        }
    }

    /**
     * @private
     * @method changeDirection
     * @description Change la direction du bot de manière aléatoire
     */
    changeDirection() {
        const angleChange = (Math.random() - 0.5) * Math.PI;
        const currentAngle = Math.atan2(this.vy, this.vx);
        const newAngle = currentAngle + angleChange;
        
        const speed = 1;
        this.vx = Math.cos(newAngle) * speed;
        this.vy = Math.sin(newAngle) * speed;
    }

    /**
     * @method serialize
     * @description Sérialise l'état du bot pour l'envoi au client
     * @override
     * @returns {Object}
     */
    serialize() {
        return {
            ...super.serialize(),
            isMoving: this.isMoving
        };
    }
}

module.exports = Bot;