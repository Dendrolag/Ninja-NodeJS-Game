/**
 * @class GameInstance
 * @description Classe singleton qui maintient les instances des différents managers et l'état du jeu
 */
class GameInstance {
    constructor() {
        if (GameInstance.instance) {
            return GameInstance.instance;
        }
        GameInstance.instance = this;

        // Initialisation des managers et de l'état
        this.initialized = false;
        this.managers = {
            event: null,
            socket: null,
            collision: null
        };
        this.gameState = null;
        this.waitingRoom = null;
        this.gameRoom = null;
    }

    /**
     * @method initialize
     * @description Initialise l'instance de jeu avec tous ses composants
     * @param {Object} options - Options d'initialisation
     */
    initialize(options = {}) {
        if (this.initialized) return;

        const { io } = options;
        if (!io) throw new Error('Socket.IO instance required');

        // Import des classes nécessaires
        const GameState = require('./gameState');
        const EventManager = require('./managers/eventManager');
        const SocketManager = require('./managers/socketManager');
        const CollisionManager = require('./managers/collisionManager');
        const WaitingRoom = require('./rooms/waitingRoom');
        
        // Création des instances
        this.gameState = new GameState();
        this.managers.event = new EventManager();
        this.managers.socket = new SocketManager(io, this.gameState, this.managers.event);
        this.managers.collision = new CollisionManager(this.gameState, this.managers.event);
        this.waitingRoom = new WaitingRoom();

        // Initialisation dans le bon ordre
        this.waitingRoom.initialize(this.managers.event);
        this.managers.socket.initialize();

        this.setupEventListeners();
        this.initialized = true;
    }

    /**
     * @private
     * @method setupEventListeners
     * @description Configure les écouteurs d'événements principaux
     */
    setupEventListeners() {
        const GameRoom = require('./rooms/gameRoom');

        this.managers.event.on('startGame', (settings) => {
            // Création d'une nouvelle partie
            this.gameRoom = new GameRoom({
                eventManager: this.managers.event,
                gameState: this.gameState,
                collisionManager: this.managers.collision
            });

            // Transfert des joueurs de la salle d'attente
            const waitingPlayers = this.waitingRoom.getAllPlayers();
            waitingPlayers.forEach(player => {
                this.gameRoom.addPlayer(player);
            });

            // Démarrage de la partie
            this.gameRoom.start(settings);
        });

        this.managers.event.on('endGame', () => {
            if (this.gameRoom) {
                this.gameRoom.end();
                this.gameRoom = null;
            }
            this.gameState.reset();
            this.waitingRoom.reset();
        });
    }

    /**
     * @method getInstance
     * @description Récupère l'instance unique de GameInstance
     * @returns {GameInstance}
     */
    static getInstance() {
        if (!GameInstance.instance) {
            GameInstance.instance = new GameInstance();
        }
        return GameInstance.instance;
    }

    /**
     * @method getEventManager
     * @returns {EventManager}
     */
    getEventManager() {
        return this.managers.event;
    }

    /**
     * @method getSocketManager
     * @returns {SocketManager}
     */
    getSocketManager() {
        return this.managers.socket;
    }

    /**
     * @method getCollisionManager
     * @returns {CollisionManager}
     */
    getCollisionManager() {
        return this.managers.collision;
    }

    /**
     * @method getGameState
     * @returns {GameState}
     */
    getGameState() {
        return this.gameState;
    }

    /**
     * @method getWaitingRoom
     * @returns {WaitingRoom}
     */
    getWaitingRoom() {
        return this.waitingRoom;
    }

    /**
     * @method getCurrentGame
     * @returns {GameRoom|null}
     */
    getCurrentGame() {
        return this.gameRoom;
    }
}

module.exports = GameInstance;