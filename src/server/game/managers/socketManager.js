/**
 * @class SocketManager
 * @description Gère toutes les communications socket entre le serveur et les clients
 */
class SocketManager {
    /**
     * @constructor
     * @param {Object} io - Instance Socket.IO
     * @param {GameState} gameState - État du jeu
     * @param {EventManager} eventManager - Gestionnaire d'événements
     */
    constructor(io, gameState, eventManager) {
        this.io = io;
        this.gameState = gameState;
        this.eventManager = eventManager;
        this.activeSockets = new Map();
    }

    /**
     * @method initialize
     * @description Initialise les écouteurs de socket
     */
    initialize() {
        this.io.on('connection', (socket) => {
            this.handleNewConnection(socket);
        });
    }

    /**
     * @private
     * @method handleNewConnection
     * @description Gère une nouvelle connexion socket
     * @param {Object} socket - Socket du nouveau client
     */
    handleNewConnection(socket) {
        //console.log(`Nouvelle connexion: ${socket.id}`);

        // Événements de la salle d'attente
        socket.on('joinWaitingRoom', (data) => this.handleJoinWaitingRoom(socket, data));
        socket.on('leaveWaitingRoom', () => this.handleLeaveWaitingRoom(socket));
        socket.on('startGameFromRoom', (data) => this.handleStartGameFromRoom(socket, data));
        socket.on('updateGameSettings', (data) => this.handleUpdateGameSettings(socket, data));
        
        // Événements de jeu
        socket.on('joinRunningGame', (data) => this.handleJoinRunningGame(socket, data));
        socket.on('move', (data) => this.handlePlayerMove(socket, data));
        socket.on('togglePause', () => this.handleTogglePause(socket));
        
        // Événements de bonus/malus
        socket.on('bonusExpired', (data) => this.handleBonusExpired(socket, data));
        socket.on('malusCollected', (data) => this.handleMalusCollected(socket, data));
        
        // Chat
        socket.on('chatMessage', (data) => this.handleChatMessage(socket, data));
        
        // Déconnexion
        socket.on('disconnect', () => this.handleDisconnect(socket));
    }

    /**
     * @method handleJoinWaitingRoom
     * @description Gère l'entrée d'un joueur dans la salle d'attente
     * @param {Object} socket - Socket du client
     * @param {Object} data - Données du joueur
     */
    handleJoinWaitingRoom(socket, data) {
        const { nickname } = data;
        //console.log(`${nickname} rejoint la salle d'attente`);

        const isEmptyRoom = this.gameState.waitingRoom.isEmpty();
        const shouldBeOwner = isEmptyRoom || !this.gameState.waitingRoom.hasOwner();

        const playerData = {
            id: socket.id,
            nickname,
            isOwner: shouldBeOwner,
            status: 'waiting'
        };

        this.gameState.waitingRoom.addPlayer(playerData);
        this.activeSockets.set(socket.id, socket);

        if (shouldBeOwner) {
            socket.emit('gameSettingsUpdated', this.gameState.settings);
        }

        // Notifier tout le monde
        this.broadcastWaitingRoomUpdate();
    }

    /**
     * @method handleLeaveWaitingRoom
     * @description Gère le départ d'un joueur de la salle d'attente
     * @param {Object} socket - Socket du client
     */
    handleLeaveWaitingRoom(socket) {
        const player = this.gameState.waitingRoom.getPlayer(socket.id);
        if (!player) return;

        const wasOwner = player.isOwner;
        this.gameState.waitingRoom.removePlayer(socket.id);
        this.activeSockets.delete(socket.id);

        // Transférer la propriété si nécessaire
        if (wasOwner) {
            const newOwner = this.gameState.waitingRoom.assignNewOwner();
            if (newOwner) {
                const newOwnerSocket = this.activeSockets.get(newOwner.id);
                if (newOwnerSocket) {
                    newOwnerSocket.emit('gameSettingsUpdated', this.gameState.settings);
                }
            }
        }

        this.broadcastWaitingRoomUpdate();
        this.io.emit('playerLeft', {
            nickname: player.nickname,
            wasOwner
        });
    }

    /**
     * @method handleStartGameFromRoom
     * @description Démarre une partie depuis la salle d'attente
     * @param {Object} socket - Socket du client
     * @param {Object} data - Paramètres de la partie
     */
    handleStartGameFromRoom(socket, data) {
        const player = this.gameState.waitingRoom.getPlayer(socket.id);
        if (!player?.isOwner) return;

        this.gameState.initializeGame(data.settings);
        this.gameState.waitingRoom.startGame();

        // Initialiser tous les joueurs
        this.gameState.waitingRoom.getAllPlayers().forEach(waitingPlayer => {
            const playerSocket = this.activeSockets.get(waitingPlayer.id);
            if (playerSocket) {
                this.gameState.addPlayer(waitingPlayer);
            }
        });

        this.io.emit('gameStarting');
        this.startGameLoop();
    }

    /**
     * @method handlePlayerMove
     * @description Gère le déplacement d'un joueur
     * @param {Object} socket - Socket du client
     * @param {Object} data - Données du mouvement
     */
    handlePlayerMove(socket, moveData) {
        if (this.gameState.isPaused || this.gameState.isGameOver) return;

        const player = this.gameState.getPlayer(socket.id);
        if (!player) return;

        const speed = moveData.speedBoostActive ? player.baseSpeed * 1.3 : player.baseSpeed;
        const newX = player.x + moveData.x * speed;
        const newY = player.y + moveData.y * speed;

        player.setPosition(newX, newY);
        this.eventManager.emit('playerMoved', { player, moveData });
    }

    /**
     * @method broadcastGameState
     * @description Envoie l'état du jeu à tous les clients
     */
    broadcastGameState() {
        const gameState = this.gameState.getGameState();
        this.io.emit('updateEntities', gameState);
    }

    /**
     * Méthodes de notification
     */

    /**
     * @method notifyPlayerCaptured
     * @description Notifie un joueur qu'il a été capturé
     */
    notifyPlayerCaptured(victim, data) {
        const socket = this.activeSockets.get(victim.id);
        if (socket) {
            socket.emit('playerCaptured', data);
        }
    }

    /**
     * @method notifyPlayerCapturedEnemy
     * @description Notifie un joueur qu'il a capturé quelqu'un
     */
    notifyPlayerCapturedEnemy(attacker, data) {
        const socket = this.activeSockets.get(attacker.id);
        if (socket) {
            socket.emit('playerCapturedEnemy', data);
        }
    }

    /**
     * @method notifyBonusCollection
     * @description Notifie la collecte d'un bonus
     */
    notifyBonusCollection(player, bonus) {
        const socket = this.activeSockets.get(player.id);
        if (socket) {
            socket.emit('activateBonus', {
                type: bonus.type,
                duration: this.gameState.settings.getBonusDuration(bonus.type)
            });
        }
    }

    /**
     * @method notifyMalusCollection
     * @description Notifie la collecte d'un malus
     */
    notifyMalusCollection(player, malus, duration) {
        // Notifier le collecteur
        const collectorSocket = this.activeSockets.get(player.id);
        if (collectorSocket) {
            collectorSocket.emit('malusCollected', {
                type: malus.type,
                duration
            });
        }

        // Notifier les autres joueurs
        this.io.emit('malusEvent', {
            type: malus.type,
            duration,
            collectorId: player.id,
            collectorNickname: player.nickname
        });
    }

    /**
     * @private
     * @method broadcastWaitingRoomUpdate
     * @description Envoie une mise à jour de la salle d'attente à tous
     */
    broadcastWaitingRoomUpdate() {
        this.io.emit('updateWaitingRoom', {
            players: this.gameState.waitingRoom.getSerializedPlayers(),
            gameInProgress: this.gameState.isGameInProgress()
        });
    }

    /**
     * @method getSocket
     * @description Récupère le socket d'un joueur
     * @param {string} playerId - ID du joueur
     * @returns {Object|null} Socket du joueur
     */
    getSocket(playerId) {
        return this.activeSockets.get(playerId);
    }
}

module.exports = SocketManager;