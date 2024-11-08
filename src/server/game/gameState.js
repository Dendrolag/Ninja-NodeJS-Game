/**
 * @class GameState
 * @description Gère l'état global du jeu et ses paramètres
 */
class GameState {
    constructor(settings = {}) {
        // 1. État général du jeu
        this.isPaused = false;
        this.isGameOver = false;
        this.gameStartTime = null;
        this.totalPauseDuration = 0;
        this.pauseStartTime = null;
        this.pausedBy = null;

        // 2. Collections d'entités
        this.players = new Map();
        this.bots = new Map();
        this.blackBots = new Map();
        this.bonuses = new Set();
        this.malus = new Set();
        this.specialZones = new Set();

        // 3. Paramètres du jeu
        this.settings = { ...DEFAULT_GAME_SETTINGS, ...settings };

        // 4. État d'initialisation
        this.botsInitialized = false;
    }

    /**
     * @method initialize
     * @description Initialise ou réinitialise l'état du jeu
     */
    initialize() {
        this.gameStartTime = Date.now();
        this.isPaused = false;
        this.isGameOver = false;
        this.totalPauseDuration = 0;
        this.pauseStartTime = null;
        this.pausedBy = null;
        this.botsInitialized = false;

        this.players.clear();
        this.bots.clear();
        this.blackBots.clear();
        this.bonuses.clear();
        this.malus.clear();
        this.specialZones.clear();
    }

    /**
     * @method calculateTimeLeft 
     * @returns {number} Temps restant en secondes
     */
    calculateTimeLeft() {
        if (this.isPaused) {
            return Math.max(
                this.settings.gameDuration - 
                Math.floor((this.pauseStartTime - this.gameStartTime - this.totalPauseDuration) / 1000), 
                0
            );
        }
        
        const timeElapsed = Math.floor(
            (Date.now() - this.gameStartTime - this.totalPauseDuration) / 1000
        );
        return Math.max(this.settings.gameDuration - timeElapsed, 0);
    }

    /**
     * @method togglePause
     * @param {string} playerId - ID du joueur qui met en pause
     * @returns {boolean} Nouvel état de pause
     */
    togglePause(playerId) {
        if (this.isGameOver) return this.isPaused;

        if (!this.isPaused) {
            this.isPaused = true;
            this.pausedBy = playerId;
            this.pauseStartTime = Date.now();
        } else if (this.pausedBy === playerId) {
            this.isPaused = false;
            this.pausedBy = null;
            this.totalPauseDuration += Date.now() - this.pauseStartTime;
            this.pauseStartTime = null;
        }

        return this.isPaused;
    }

    /**
     * @method endGame
     * @description Termine la partie en cours
     */
    endGame() {
        this.isGameOver = true;
        this.isPaused = true;
    }

    /**
     * @method getGameState
     * @description Récupère l'état complet du jeu pour les clients
     * @returns {Object} État complet du jeu
     */
    getGameState() {
        return {
            entities: this.getAllEntities(),
            playerScores: this.calculatePlayerScores(),
            timeLeft: this.calculateTimeLeft(),
            bonuses: Array.from(this.bonuses).map(bonus => bonus.serialize()),
            malus: Array.from(this.malus).map(malus => malus.serialize()),
            zones: Array.from(this.specialZones).map(zone => zone.serialize())
        };
    }

    /**
     * @private
     * @method getAllEntities
     * @description Récupère toutes les entités du jeu
     * @returns {Array} Liste de toutes les entités
     */
    getAllEntities() {
        return [
            ...Array.from(this.players.values()).map(player => player.serialize()),
            ...Array.from(this.bots.values()).map(bot => bot.serialize()),
            ...Array.from(this.blackBots.values()).map(blackBot => blackBot.serialize())
        ];
    }

    /**
     * @private
     * @method calculatePlayerScores
     * @description Calcule les scores de tous les joueurs
     * @returns {Array} Liste des scores des joueurs
     */
    calculatePlayerScores() {
        const scores = [];
        
        for (const [id, player] of this.players) {
            const controlledPoints = Array.from(this.bots.values())
                .filter(bot => bot.color === player.color)
                .length;

            scores.push({
                id: player.id,
                nickname: player.nickname,
                currentBots: controlledPoints,
                totalBotsControlled: player.totalBotsCaptures,
                captures: player.captures,
                capturedPlayers: player.capturedPlayers,
                capturedBy: player.capturedBy,
                capturedByBlackBot: player.capturedByBlackBot,
                color: player.color
            });
        }

        return scores.sort((a, b) => {
            const pointsDiff = b.currentBots - a.currentBots;
            if (pointsDiff !== 0) return pointsDiff;
            return b.captures - a.captures;
        });
    }
}

module.exports = GameState;