/**
 * @class CollisionManager
 * @description Gère toutes les collisions du jeu
 */
class CollisionManager {
    /**
     * @constructor
     * @param {GameState} gameState - État du jeu
     * @param {EventManager} eventManager - Gestionnaire d'événements
     */
    constructor(gameState, eventManager) {
        this.gameState = gameState;
        this.eventManager = eventManager;
        this.collisionThreshold = 20; // Distance de collision par défaut
    }

    /**
     * @method update
     * @description Met à jour et vérifie toutes les collisions
     */
    update() {
        if (this.gameState.isPaused || this.gameState.isGameOver) return;

        this.checkPlayerCollisions();
        this.checkBotCollisions();
        this.checkBlackBotCollisions();
        this.checkBonusCollisions();
        this.checkMalusCollisions();
    }

    /**
     * @private
     * @method checkPlayerCollisions
     * @description Vérifie les collisions entre joueurs
     */
    checkPlayerCollisions() {
        const players = Array.from(this.gameState.players.values());
        
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const player1 = players[i];
                const player2 = players[j];

                if (this.isColliding(player1, player2)) {
                    if (player1.color !== player2.color) {
                        if (!player2.invincibilityActive && player1.canCapture()) {
                            this.eventManager.emit('playerCapture', {
                                attacker: player1,
                                victim: player2
                            });
                        } else if (!player1.invincibilityActive && player2.canCapture()) {
                            this.eventManager.emit('playerCapture', {
                                attacker: player2,
                                victim: player1
                            });
                        }
                    }
                }
            }
        }
    }

    /**
     * @private
     * @method checkBotCollisions
     * @description Vérifie les collisions avec les bots normaux
     */
    checkBotCollisions() {
        const players = Array.from(this.gameState.players.values());
        const bots = Array.from(this.gameState.bots.values());

        // Collisions joueur-bot
        players.forEach(player => {
            bots.forEach(bot => {
                if (this.isColliding(player, bot) && player.color !== bot.color) {
                    bot.color = player.color;
                }
            });
        });

        // Collisions bot-bot
        for (let i = 0; i < bots.length; i++) {
            for (let j = i + 1; j < bots.length; j++) {
                const bot1 = bots[i];
                const bot2 = bots[j];

                if (this.isColliding(bot1, bot2) && bot1.color !== bot2.color) {
                    bot2.color = bot1.color;
                }
            }
        }
    }

    /**
     * @private
     * @method checkBlackBotCollisions
     * @description Vérifie les collisions avec les bots noirs
     */
    checkBlackBotCollisions() {
        const blackBots = Array.from(this.gameState.blackBots.values());
        const players = Array.from(this.gameState.players.values());

        blackBots.forEach(blackBot => {
            players.forEach(player => {
                if (this.isColliding(blackBot, player)) {
                    if (player.invincibilityActive) {
                        // Le joueur détruit le bot noir
                        this.gameState.removeBlackBot(blackBot.id);
                        this.eventManager.emit('blackBotDestroyed', {
                            player: player,
                            blackBot: blackBot
                        });
                    } else if (!player.isInvulnerable()) {
                        // Le bot noir capture le joueur
                        this.eventManager.emit('blackBotCapture', {
                            blackBot: blackBot,
                            victim: player,
                            pointsLost: Math.floor(player.botsControlled * 
                                (this.gameState.settings.pointsLossPercent / 100))
                        });
                    }
                }
            });
        });
    }

    /**
     * @private
     * @method checkBonusCollisions
     * @description Vérifie les collisions avec les bonus
     */
    checkBonusCollisions() {
        const players = Array.from(this.gameState.players.values());
        const bonuses = Array.from(this.gameState.bonuses);

        players.forEach(player => {
            bonuses.forEach(bonus => {
                if (this.isColliding(player, bonus)) {
                    this.eventManager.emit('bonusCollected', {
                        player: player,
                        bonus: bonus
                    });
                }
            });
        });
    }

    /**
     * @private
     * @method checkMalusCollisions
     * @description Vérifie les collisions avec les malus
     */
    checkMalusCollisions() {
        const players = Array.from(this.gameState.players.values());
        const malus = Array.from(this.gameState.malus);

        players.forEach(player => {
            malus.forEach(malusItem => {
                if (this.isColliding(player, malusItem)) {
                    this.eventManager.emit('malusCollected', {
                        player: player,
                        malus: malusItem
                    });
                }
            });
        });
    }

    /**
     * @private
     * @method isColliding
     * @description Vérifie si deux entités sont en collision
     * @param {Entity} entity1 - Première entité
     * @param {Entity} entity2 - Deuxième entité
     * @param {number} [threshold] - Seuil de collision personnalisé
     * @returns {boolean}
     */
    isColliding(entity1, entity2, threshold = this.collisionThreshold) {
        const dx = entity1.x - entity2.x;
        const dy = entity1.y - entity2.y;
        const distanceSquared = dx * dx + dy * dy;
        return distanceSquared < threshold * threshold;
    }
}

module.exports = CollisionManager;