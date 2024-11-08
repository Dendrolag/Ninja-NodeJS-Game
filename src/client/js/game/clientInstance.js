/**
 * @class ClientInstance
 * @description Classe singleton qui gère l'état du jeu côté client
 */
class ClientInstance {
    constructor() {
        if (ClientInstance.instance) {
            return ClientInstance.instance;
        }
        ClientInstance.instance = this;

        // État du client
        this.socket = null;
        this.playerId = null;
        this.playerNickname = null;
        this.gameState = {
            entities: [],
            bonuses: [],
            malus: [],
            specialZones: [],
            timeRemaining: 180,
            isPaused: false,
            isGameOver: false
        };

        // Gestionnaires
        this.managers = {
            render: null,    // Gère le rendu du jeu
            input: null,     // Gère les entrées utilisateur
            ui: null,        // Gère l'interface utilisateur
            camera: null     // Gère la caméra
        };

        // État des bonus actifs
        this.activeEffects = {
            speedBoost: false,
            invincibility: false,
            reveal: false,
            speedBoostTimeLeft: 0,
            invincibilityTimeLeft: 0,
            revealTimeLeft: 0
        };

        // État du mode mobile
        this.mobileControls = {
            isMoving: false,
            currentMove: { x: 0, y: 0 },
            moveInterval: null
        };

        // Configuration
        this.config = {
            GAME_WIDTH: 2000,
            GAME_HEIGHT: 1500,
            BASE_SPEED: 3,
            SPEED_BOOST_MULTIPLIER: 1.3,
            VERSION: "v0.4.1"
        };

        this.initialized = false;
    }

    /**
     * @method initialize
     * @description Initialise l'instance client avec les gestionnaires nécessaires
     * @param {Object} options - Options d'initialisation
     */
    async initialize(options = {}) {
        if (this.initialized) return;

        // Importer et initialiser les gestionnaires
        const RenderManager = require('./managers/renderManager');
        const InputManager = require('./managers/inputManager');
        const UIManager = require('./managers/uiManager');
        const CameraManager = require('./managers/cameraManager');

        this.managers.render = new RenderManager(this);
        this.managers.input = new InputManager(this);
        this.managers.ui = new UIManager(this);
        this.managers.camera = new CameraManager(this);

        // Initialiser la connexion socket
        await this.initializeSocket();

        // Initialiser les gestionnaires
        await Promise.all([
            this.managers.render.initialize(),
            this.managers.input.initialize(),
            this.managers.ui.initialize(),
            this.managers.camera.initialize()
        ]);

        // Configurer les écouteurs d'événements
        this.setupEventListeners();

        this.initialized = true;
    }

    /**
     * @method initializeSocket
     * @description Initialise la connexion socket avec le serveur
     */
    async initializeSocket() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = io();

                this.socket.on('connect', () => {
                    console.log('Connecté au serveur');
                    this.playerId = this.socket.id;
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    console.error('Erreur de connexion:', error);
                    reject(error);
                });
            } catch (error) {
                console.error('Erreur lors de l\'initialisation du socket:', error);
                reject(error);
            }
        });
    }

    /**
     * @method setupEventListeners
     * @description Configure les écouteurs d'événements principaux
     */
    setupEventListeners() {
        if (!this.socket) return;

        // Événements de mise à jour du jeu
        this.socket.on('updateEntities', this.handleGameUpdate.bind(this));
        this.socket.on('gameStarting', this.handleGameStart.bind(this));
        this.socket.on('gameOver', this.handleGameOver.bind(this));

        // Événements de pause
        this.socket.on('pauseGame', this.handlePause.bind(this));
        this.socket.on('resumeGame', this.handleResume.bind(this));

        // Événements de bonus/malus
        this.socket.on('activateBonus', this.handleBonusActivation.bind(this));
        this.socket.on('malusCollected', this.handleMalusCollection.bind(this));
    }

    /**
     * Gestionnaires d'événements
     */

    handleGameUpdate(data) {
        this.gameState.entities = data.entities;
        this.gameState.timeRemaining = data.timeLeft;
        this.gameState.bonuses = data.bonuses;
        this.gameState.malus = data.malus;
        this.gameState.specialZones = data.zones;

        // Mettre à jour la caméra et le rendu
        this.managers.camera.update();
        this.managers.render.update();
        this.managers.ui.updateScoreboard(data.playerScores);
    }

    handleGameStart() {
        this.gameState.isGameOver = false;
        this.gameState.isPaused = false;
        this.managers.ui.showGameScreen();
        this.managers.input.enable();
    }

    handleGameOver(data) {
        this.gameState.isGameOver = true;
        this.managers.ui.showGameOver(data.scores);
        this.managers.input.disable();
    }

    handlePause(data) {
        this.gameState.isPaused = true;
        this.managers.ui.showPauseScreen(data);
    }

    handleResume() {
        this.gameState.isPaused = false;
        this.managers.ui.hidePauseScreen();
    }

    handleBonusActivation(data) {
        const { type, duration } = data;
        this.activeEffects[type] = true;
        this.activeEffects[`${type}TimeLeft`] = duration;
        this.managers.ui.showBonusNotification(type);
    }

    handleMalusCollection(data) {
        this.managers.ui.showMalusNotification(data);
    }

    /**
     * Méthodes utilitaires
     */

    static getInstance() {
        if (!ClientInstance.instance) {
            ClientInstance.instance = new ClientInstance();
        }
        return ClientInstance.instance;
    }

    isCurrentPlayer(entityId) {
        return entityId === this.playerId;
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || window.innerWidth <= 768;
    }
}

module.exports = ClientInstance;