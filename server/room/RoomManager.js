// server/room/RoomManager.js
import Room from './Room.js';
import Logger from '../utils/Logger.js';
import { v4 as uuidv4 } from 'uuid';

class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map();
        this.playerRooms = new Map();
        this.logger = new Logger('RoomManager');
    }

    async handleJoinWaitingRoom(socket, nickname) {
        try {
            this.logger.info('Processing room join request', { 
                socketId: socket.id,
                nickname 
            });

            // Créer une nouvelle room
            const roomId = uuidv4();
            this.logger.info('Creating new room', { roomId });

            const room = new Room(roomId);
            this.rooms.set(roomId, room);

            // Ajouter le joueur
            const isFirstPlayer = room.players.size === 0;
            
            const playerData = {
                id: socket.id,
                nickname,
                isOwner: isFirstPlayer,
                status: 'waiting'
            };

            room.players.set(socket.id, playerData);
            this.playerRooms.set(socket.id, roomId);

            // Faire rejoindre la socket room
            socket.join(roomId);

            // Envoyer les infos
            this.io.to(roomId).emit('updateWaitingRoom', {
                players: Array.from(room.players.values()),
                gameInProgress: room.isGameStarted
            });

            // Notifier les autres du nouvel arrivant
            socket.to(roomId).emit('playerJoined', {
                nickname,
                id: socket.id,
                isOwner: isFirstPlayer
            });

        } catch (error) {
            this.logger.error('Error in handleJoinWaitingRoom', error);
            socket.emit('error', {
                type: 'JOIN_ERROR',
                message: 'Failed to join waiting room'
            });
        }
    }

    handleLeaveWaitingRoom(socket) {
        try {
            const roomId = this.playerRooms.get(socket.id);
            const room = this.rooms.get(roomId);
            
            if (room) {
                const player = room.players.get(socket.id);
                const wasOwner = player?.isOwner;

                socket.leave(roomId);
                room.players.delete(socket.id);
                this.playerRooms.delete(socket.id);

                if (room.players.size === 0) {
                    this.rooms.delete(roomId);
                } else if (wasOwner) {
                    // Transférer la propriété au prochain joueur
                    const nextPlayer = room.players.values().next().value;
                    if (nextPlayer) {
                        nextPlayer.isOwner = true;
                    }
                }

                // Notifier les autres joueurs
                socket.to(roomId).emit('playerLeft', {
                    nickname: player?.nickname,
                    wasOwner
                });

                // Mettre à jour la room
                if (room.players.size > 0) {
                    this.io.to(roomId).emit('updateWaitingRoom', {
                        players: Array.from(room.players.values()),
                        gameInProgress: room.isGameStarted
                    });
                }
            }
        } catch (error) {
            this.logger.error('Error in handleLeaveWaitingRoom', error);
        }
    }

    getPlayerRoom(playerId) {
        const roomId = this.playerRooms.get(playerId);
        return this.rooms.get(roomId);
    }

    cleanup() {
        // Nettoyer les rooms vides
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.players.size === 0) {
                this.rooms.delete(roomId);
            }
        }
    }
}

export default RoomManager;