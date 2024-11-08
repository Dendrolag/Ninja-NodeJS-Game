const { DEFAULT_GAME_SETTINGS } = require('../settings/defaultSettings');

/**
 * @class WaitingRoom
 * @description Gère la salle d'attente et ses joueurs
 */
class WaitingRoom {
    /**
     * @constructor
     */
    constructor() {
        this.players = new Map();
        this.isGameStarted = false;
        this.settings = { ...DEFAULT_GAME_SETTINGS };
        this.playersInGame = new Set();
        this.eventManager = null;
    }

    /**
     * @method initialize
     * @description Initialise la salle d'attente avec un gestionnaire d'événements
     * @param {EventManager} eventManager - Gestionnaire d'événements du jeu
     */
    initialize(eventManager) {
        this.eventManager = eventManager;
    }

    /**
     * @method addPlayer
     * @description Ajoute un joueur à la salle d'attente
     * @param {Object} playerData - Données du joueur
     */
    addPlayer(playerData) {
        //console.log(`Ajout du joueur ${playerData.nickname} à la salle d'attente`);
        const isEmptyRoom = this.isEmpty();
        const hasNoOwner = !this.hasOwner();
        
        const player = {
            ...playerData,
            isOwner: isEmptyRoom || hasNoOwner,
            status: 'waiting'
        };

        this.players.set(player.id, player);
        
        if (this.eventManager) {
            this.eventManager.emit('playerJoinedWaitingRoom', player);
        }
    }

    /**
     * @method removePlayer
     * @description Retire un joueur de la salle d'attente
     * @param {string} playerId - ID du joueur à retirer
     */
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;

        const wasOwner = player.isOwner;
        this.players.delete(playerId);
        this.playersInGame.delete(playerId);

        // Si c'était le propriétaire, en assigner un nouveau
        if (wasOwner && !this.isEmpty()) {
            this.assignNewOwner();
        }

        if (this.eventManager) {
            this.eventManager.emit('playerLeftWaitingRoom', {
                playerId,
                nickname: player.nickname,
                wasOwner
            });
        }

        // Si la salle est vide, réinitialiser la partie
        if (this.isEmpty()) {
            this.reset();
        }
    }

    /**
     * @method assignNewOwner
     * @description Assigne un nouveau propriétaire de la salle
     * @returns {Object|null} Nouveau propriétaire
     */
    assignNewOwner() {
        if (this.isEmpty()) return null;

        // Prendre le premier joueur disponible
        const [firstPlayerId, firstPlayer] = this.players.entries().next().value;
        firstPlayer.isOwner = true;

        if (this.eventManager) {
            this.eventManager.emit('newOwnerAssigned', firstPlayer);
        }

        return firstPlayer;
    }

    /**
     * @method updateSettings
     * @description Met à jour les paramètres de la salle
     * @param {Object} newSettings - Nouveaux paramètres
     * @param {string} updaterId - ID du joueur effectuant la mise à jour
     * @returns {boolean} Succès de la mise à jour
     */
    updateSettings(newSettings, updaterId) {
        const updater = this.players.get(updaterId);
        if (!updater?.isOwner) return false;

        this.settings = {
            ...this.settings,
            ...newSettings,
            enabledZones: {
                ...this.settings.enabledZones,
                ...(newSettings.enabledZones || {})
            }
        };

        if (this.eventManager) {
            this.eventManager.emit('settingsUpdated', this.settings);
        }

        return true;
    }

    /**
     * @method startGame
     * @description Démarre la partie
     */
    startGame() {
        this.isGameStarted = true;
        this.players.forEach(player => {
            player.status = 'playing';
            this.playersInGame.add(player.id);
        });

        if (this.eventManager) {
            this.eventManager.emit('gameStarted', {
                players: Array.from(this.players.values()),
                settings: this.settings
            });
        }
    }

    /**
     * @method reset
     * @description Réinitialise la salle d'attente
     */
    reset() {
        this.isGameStarted = false;
        this.settings = { ...DEFAULT_GAME_SETTINGS };
        this.playersInGame.clear();

        if (this.eventManager) {
            this.eventManager.emit('waitingRoomReset');
        }
    }

    /**
     * @method isEmpty
     * @description Vérifie si la salle est vide
     * @returns {boolean}
     */
    isEmpty() {
        return this.players.size === 0;
    }

    /**
     * @method hasOwner
     * @description Vérifie si la salle a un propriétaire
     * @returns {boolean}
     */
    hasOwner() {
        return Array.from(this.players.values()).some(player => player.isOwner);
    }

    /**
     * @method getPlayer
     * @description Récupère un joueur par son ID
     * @param {string} playerId - ID du joueur
     * @returns {Object|undefined}
     */
    getPlayer(playerId) {
        return this.players.get(playerId);
    }

    /**
     * @method getAllPlayers
     * @description Récupère tous les joueurs
     * @returns {Array}
     */
    getAllPlayers() {
        return Array.from(this.players.values());
    }

    /**
     * @method getPlayersInGame
     * @description Récupère les joueurs en partie
     * @returns {Array}
     */
    getPlayersInGame() {
        return Array.from(this.playersInGame);
    }

    /**
     * @method isPlayerInGame
     * @description Vérifie si un joueur est en partie
     * @param {string} playerId - ID du joueur
     * @returns {boolean}
     */
    isPlayerInGame(playerId) {
        return this.playersInGame.has(playerId);
    }

    /**
     * @method getSerializedPlayers
     * @description Récupère les données des joueurs pour envoi au client
     * @returns {Array}
     */
    getSerializedPlayers() {
        return Array.from(this.players.values()).map(player => ({
            id: player.id,
            nickname: player.nickname,
            isOwner: player.isOwner,
            status: player.status
        }));
    }

    /**
     * @method handleChatMessage
     * @description Gère l'envoi d'un message dans le chat
     * @param {Object} messageData - Données du message
     */
    handleChatMessage(messageData) {
        if (this.eventManager) {
            const { message, nickname } = messageData;
            // Limiter la taille du message
            const truncatedMessage = message.slice(0, 200);

            this.eventManager.emit('chatMessage', {
                message: truncatedMessage,
                nickname: nickname,
                timestamp: Date.now()
            });
        }
    }

    /**
     * @method canJoinGame
     * @description Vérifie si un joueur peut rejoindre la partie
     * @param {string} playerId - ID du joueur
     * @returns {boolean}
     */
    canJoinGame(playerId) {
        const player = this.players.get(playerId);
        return player && this.isGameStarted && player.status === 'waiting';
    }

    /**
     * @method setPlayerStatus
     * @description Change le statut d'un joueur
     * @param {string} playerId - ID du joueur
     * @param {string} status - Nouveau statut
     * @returns {boolean}
     */
    setPlayerStatus(playerId, status) {
        const player = this.players.get(playerId);
        if (!player) return false;

        player.status = status;
        if (status === 'playing') {
            this.playersInGame.add(playerId);
        } else {
            this.playersInGame.delete(playerId);
        }

        return true;
    }
}

module.exports = WaitingRoom;