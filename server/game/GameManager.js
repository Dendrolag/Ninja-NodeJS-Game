// server/game/GameManager.js
import Game from './Game.js';
import Logger from '../utils/Logger.js';
import { v4 as uuidv4 } from 'uuid';

class GameManager {
    constructor(io) {
        this.io = io;
        this.games = new Map();
        this.roomGames = new Map();
        this.logger = new Logger('GameManager');
        this.pendingStarts = new Map();
    }

    async handleStartGame(socket, data, roomManager) {
        // 1. Récupérer la room et faire les vérifications préliminaires
        const room = roomManager.getPlayerRoom(socket.id);
        if (!room) {
            this.logger.warn('No room found for player', { socketId: socket.id });
            return false;
        }

        const roomId = room.id;
        const player = room.players.get(socket.id);

        // 2. Vérifications de sécurité
        if (!player?.isOwner) {
            this.logger.warn('Unauthorized start attempt', { 
                socketId: socket.id,
                roomId 
            });
            return false;
        }

        // 3. Vérifier si une partie est déjà en cours
        const existingGame = this.roomGames.get(roomId);
        if (existingGame) {
            this.logger.warn('Game already exists', {
                roomId,
                existingGameId: existingGame
            });
            return false;
        }

        // 4. Vérifier si un lancement est déjà en cours
        const pendingStart = this.pendingStarts.get(roomId);
        if (pendingStart) {
            const now = Date.now();
            // Si le lancement est en cours depuis plus de 10s, on le considère comme échoué
            if (now - pendingStart < 10000) {
                this.logger.warn('Game start already in progress', { roomId });
                return false;
            }
            // Sinon on nettoie et on continue
            this.pendingStarts.delete(roomId);
        }

        // 5. Démarrer le processus de lancement
        try {
            this.pendingStarts.set(roomId, Date.now());
            this.logger.info('Starting new game', { roomId });

            const gameId = uuidv4();
            const game = new Game(gameId, this.io, data.settings);

            const initialized = await game.initialize();
            if (!initialized) {
                throw new Error('Game initialization failed');
            }

            // 6. Ajouter les joueurs de manière séquentielle
            for (const [playerId, playerData] of room.players) {
                const added = await game.addPlayer(playerId, playerData.nickname);
                if (!added) {
                    throw new Error(`Failed to add player ${playerData.nickname}`);
                }
                const playerSocket = this.io.sockets.sockets.get(playerId);
                if (playerSocket) {
                    playerSocket.join(gameId);
                }
            }

            // 7. Enregistrer la partie une fois tout initialisé
            this.games.set(gameId, game);
            this.roomGames.set(roomId, gameId);

            // 8. Démarrer la partie
            const started = await game.start();
            if (!started) {
                throw new Error('Game start failed');
            }

            this.logger.info('Game started successfully', {
                gameId,
                roomId,
                playerCount: room.players.size
            });

            return true;

        } catch (error) {
            this.logger.error('Failed to start game', error);
            this.cleanupFailedStart(roomId);
            socket.emit('error', {
                type: 'START_GAME_ERROR',
                message: 'Failed to start game'
            });
            return false;

        } finally {
            this.pendingStarts.delete(roomId);
        }
    }

    cleanupFailedStart(roomId) {
        const gameId = this.roomGames.get(roomId);
        if (gameId) {
            const game = this.games.get(gameId);
            if (game) {
                game.cleanup();
                this.games.delete(gameId);
            }
            this.roomGames.delete(roomId);
        }
        this.pendingStarts.delete(roomId);
    }

    // Mise à jour de la méthode cleanup
    cleanup(roomId) {
        const gameId = this.roomGames.get(roomId);
        if (gameId) {
            const game = this.games.get(gameId);
            if (game) {
                game.cleanup();
                this.games.delete(gameId);
            }
            this.roomGames.delete(roomId);
        }
        this.pendingStarts.delete(roomId); // Nettoyer aussi les lancements en cours
    }


    async handlePlayerMove(socket, data) {
        const game = this.getPlayerGame(socket.id);
        if (game) {
            try {
                await game.handlePlayerMove(socket.id, data);
            } catch (error) {
                this.logger.error('Error handling player move', error);
            }
        }
    }

    async handleTogglePause(socket) {
        const game = this.getPlayerGame(socket.id);
        if (game) {
            try {
                await game.togglePause(socket.id);
            } catch (error) {
                this.logger.error('Error handling pause', error);
            }
        }
    }

    getPlayerGame(playerId) {
        for (const [gameId, game] of this.games) {
            if (game.players.has(playerId)) {
                return game;
            }
        }
        return null;
    }

    handleDisconnect(socket) {
        const game = this.getPlayerGame(socket.id);
        if (game) {
            game.removePlayer(socket.id);
        }
    }

    cleanup() {
        for (const game of this.games.values()) {
            game.cleanup();
        }
        this.games.clear();
        this.roomGames.clear();
    }
}

export default GameManager;