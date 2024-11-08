const { DEFAULT_GAME_SETTINGS } = require('../settings/defaultSettings');
const { UPDATE_INTERVAL } = require('../constants');

/**
 * @class GameRoom
 * @description Gère une partie en cours et son état
 */
class GameRoom {
    /**
     * @constructor
     * @param {Object} options - Options de configuration
     * @param {EventManager} options.eventManager - Gestionnaire d'événements
     * @param {GameState} options.gameState - État du jeu
     * @param {CollisionManager} options.collisionManager - Gestionnaire de collisions
     */
    constructor({ eventManager, gameState, collisionManager }) {
        this.eventManager = eventManager;
        this.gameState = gameState;
        this.collisionManager = collisionManager;
        
        // État de la partie
        this.isActive = false;
        this.updateInterval = null;
        this.settings = { ...DEFAULT_GAME_SETTINGS };
        this.startTime = null;
        this.pauseStartTime = null;
        this.totalPauseDuration = 0;
    }

    /**
     * @method start
     * @description Démarre une nouvelle partie
     * @param {Object} settings - Paramètres de la partie
     */
    start(settings = {}) {
        this.settings = { ...DEFAULT_GAME_SETTINGS, ...settings };
        this.isActive = true;
        this.startTime = Date.now();
        this.totalPauseDuration = 0;
        
        // Initialiser l'état du jeu
        this.gameState.initialize(this.settings);
        
        // Démarrer les mises à jour périodiques
        this.startUpdateLoop();

        if (this.eventManager) {
            this.eventManager.emit('gameStarted', {
                settings: this.settings,
                startTime: this.startTime
            });
        }
    }

    /**
     * @method end
     * @description Termine la partie en cours
     */
    end() {
        this.isActive = false;
        this.stopUpdateLoop();

        // Calculer les scores finaux
        const finalScores = this.gameState.calculatePlayerScores();

        if (this.eventManager) {
            this.eventManager.emit('gameEnded', {
                scores: finalScores,
                duration: this.getGameDuration()
            });
        }
    }

    /**
     * @method pause
     * @description Met la partie en pause
     * @param {string} pausedById - ID du joueur qui met en pause
     */
    pause(pausedById) {
        if (!this.isActive || this.isPaused()) return;

        this.pauseStartTime = Date.now();
        this.gameState.setPaused(true, pausedById);

        if (this.eventManager) {
            this.eventManager.emit('gamePaused', { pausedById });
        }
    }

    /**
     * @method resume
     * @description Reprend la partie
     * @param {string} resumedById - ID du joueur qui reprend la partie
     */
    resume(resumedById) {
        if (!this.isActive || !this.isPaused()) return;

        this.totalPauseDuration += Date.now() - this.pauseStartTime;
        this.pauseStartTime = null;
        this.gameState.setPaused(false);

        if (this.eventManager) {
            this.eventManager.emit('gameResumed', { resumedById });
        }
    }

    /**
     * @method addPlayer
     * @description Ajoute un joueur à la partie
     * @param {Object} playerData - Données du joueur
     */
    addPlayer(playerData) {
        if (!this.isActive) return null;

        const player = this.gameState.createPlayer(playerData);
        
        if (this.eventManager) {
            this.eventManager.emit('playerJoinedGame', {
                player,
                totalPlayers: this.gameState.getPlayerCount()
            });
        }

        return player;
    }

    /**
     * @method removePlayer
     * @description Retire un joueur de la partie
     * @param {string} playerId - ID du joueur à retirer
     */
    removePlayer(playerId) {
        if (!this.isActive) return;

        const player = this.gameState.removePlayer(playerId);
        if (player && this.eventManager) {
            this.eventManager.emit('playerLeftGame', {
                playerId,
                remainingPlayers: this.gameState.getPlayerCount()
            });
        }

        // Terminer la partie s'il n'y a plus de joueurs
        if (this.gameState.getPlayerCount() === 0) {
            this.end();
        }
    }

    /**
     * @private
     * @method startUpdateLoop
     * @description Démarre la boucle de mise à jour
     */
    startUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            if (!this.isPaused()) {
                this.update();
            }
        }, UPDATE_INTERVAL);
    }

    /**
     * @private
     * @method stopUpdateLoop
     * @description Arrête la boucle de mise à jour
     */
    stopUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * @private
     * @method update
     * @description Met à jour l'état du jeu
     */
    update() {
        // Vérifier si la partie doit se terminer
        if (this.shouldEndGame()) {
            this.end();
            return;
        }

        // Mettre à jour les entités
        this.gameState.updateEntities();

        // Vérifier les collisions
        this.collisionManager.update();

        // Gérer les bonus et malus
        this.updateBonuses();
        this.updateMalus();

        // Gérer les zones spéciales
        this.updateSpecialZones();

        // Spawner les bots noirs au bon moment
        this.updateBlackBots();

        if (this.eventManager) {
            this.eventManager.emit('gameStateUpdated', this.getGameState());
        }
    }

    /**
     * @private
     * @method updateBonuses
     * @description Met à jour les bonus
     */
    updateBonuses() {
        this.gameState.updateBonuses();
        
        // Spawn de nouveaux bonus selon les paramètres
        if (Math.random() < this.settings.bonusSpawnRate / 100) {
            this.gameState.spawnBonus();
        }
    }

    /**
     * @private
     * @method updateMalus
     * @description Met à jour les malus
     */
    updateMalus() {
        this.gameState.updateMalus();
        
        // Spawn de nouveaux malus selon les paramètres
        if (this.settings.enableMalus && Math.random() < this.settings.malusSpawnRate / 100) {
            this.gameState.spawnMalus();
        }
    }

    /**
     * @private
     * @method updateSpecialZones
     * @description Met à jour les zones spéciales
     */
    updateSpecialZones() {
        if (!this.settings.enableSpecialZones) return;

        this.gameState.updateSpecialZones();
    }

    /**
     * @private
     * @method updateBlackBots
     * @description Gère le spawn des bots noirs
     */
    updateBlackBots() {
        if (!this.settings.enableBlackBot) return;

        const gameProgress = this.getGameProgress();
        if (gameProgress >= this.settings.blackBotStartPercent && 
            this.gameState.getBlackBotCount() < this.settings.blackBotCount) {
            this.gameState.spawnBlackBot();
        }
    }

    /**
     * @method getGameState
     * @description Récupère l'état actuel du jeu
     * @returns {Object}
     */
    getGameState() {
        return {
            timeLeft: this.getTimeLeft(),
            players: this.gameState.getSerializedPlayers(),
            scores: this.gameState.calculatePlayerScores(),
            bonuses: this.gameState.getSerializedBonuses(),
            malus: this.gameState.getSerializedMalus(),
            zones: this.gameState.getSerializedZones()
        };
    }

    /**
     * @method getTimeLeft
     * @description Calcule le temps restant
     * @returns {number}
     */
    getTimeLeft() {
        const elapsed = this.getGameDuration();
        return Math.max(0, this.settings.gameDuration - Math.floor(elapsed / 1000));
    }

    /**
     * @method getGameDuration
     * @description Calcule la durée écoulée de la partie
     * @returns {number}
     */
    getGameDuration() {
        if (!this.startTime) return 0;
        
        const now = Date.now();
        const pauseDuration = this.pauseStartTime ? 
            (now - this.pauseStartTime) : 0;
            
        return now - this.startTime - this.totalPauseDuration - pauseDuration;
    }

    /**
     * @method getGameProgress
     * @description Calcule la progression de la partie en pourcentage
     * @returns {number}
     */
    getGameProgress() {
        return (this.getGameDuration() / (this.settings.gameDuration * 1000)) * 100;
    }

    /**
     * @method isPaused
     * @description Vérifie si la partie est en pause
     * @returns {boolean}
     */
    isPaused() {
        return this.pauseStartTime !== null;
    }

    /**
     * @private
     * @method shouldEndGame
     * @description Vérifie si la partie doit se terminer
     * @returns {boolean}
     */
    shouldEndGame() {
        return this.getTimeLeft() <= 0;
    }
}

module.exports = GameRoom;