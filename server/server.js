// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import GameManager from './game/GameManager.js';       // Notez le 'default'
import RoomManager from './room/RoomManager.js';       // Notez le 'default'
import Logger from './utils/Logger.js';

const app = express();
const server = createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const logger = new Logger('Server');

// 1. Initialisations basiques
const gameManager = new GameManager(io);
const roomManager = new RoomManager(io);

// 2. Configuration Express simplifiée
app.use('/assets', express.static('public/assets'));
app.use(express.static('public'));

// 3. Gestion Socket.IO centralisée
io.on('connection', (socket) => {
    logger.info('New client connected', { socketId: socket.id });

    // Map pour garder une trace des derniers événements
    const lastEventTimes = new Map();
    const DEBOUNCE_DELAY = 100; // 100ms entre les événements, plus raisonnable

    // Wrapper pour gérer le debounce des événements
    const debouncedEvent = (eventName, handler) => {
        socket.on(eventName, (...args) => {
            const now = Date.now();
            const lastTime = lastEventTimes.get(eventName) || 0;

            if (now - lastTime >= DEBOUNCE_DELAY) {
                lastEventTimes.set(eventName, now);
                handler(...args);
            } else {
                logger.warn(`Event ${eventName} debounced`, {
                    socketId: socket.id,
                    timeSinceLastEvent: now - lastTime
                });
            }
        });
    };

    // Événements de room avec debounce
    debouncedEvent('joinWaitingRoom', (nickname) => 
        roomManager.handleJoinWaitingRoom(socket, nickname)
    );
    
    debouncedEvent('leaveWaitingRoom', () => 
        roomManager.handleLeaveWaitingRoom(socket)
    );

    // Start game avec gestion spéciale
    debouncedEvent('startGameFromRoom', async (data) => {
        const room = roomManager.getPlayerRoom(socket.id);
        if (!room) {
            logger.warn('Start game attempt without room', { socketId: socket.id });
            return;
        }

        if (!room.isOwner(socket.id)) {
            logger.warn('Unauthorized start attempt', { socketId: socket.id });
            return;
        }

        const started = await gameManager.handleStartGame(socket, data, roomManager);
        if (!started) {
            logger.warn('Game start failed', { socketId: socket.id });
            socket.emit('error', {
                type: 'START_GAME_ERROR',
                message: 'Failed to start game'
            });
        }
    });

    // Chat avec debounce et rate limiting
    let messageCount = 0;
    const MESSAGE_LIMIT = 5;
    const MESSAGE_RESET_INTERVAL = 5000;

    setInterval(() => {
        messageCount = 0;
    }, MESSAGE_RESET_INTERVAL);

    debouncedEvent('chatMessage', (data) => {
        if (messageCount < MESSAGE_LIMIT) {
            messageCount++;
            roomManager.handleChatMessage(socket, data);
        }
    });

    socket.on('disconnect', () => {
        lastEventTimes.clear(); // Nettoyage
        gameManager.handleDisconnect(socket);
        roomManager.handleDisconnect(socket);
        logger.info('Client disconnected', { socketId: socket.id });
    });
});

// 4. Démarrage du serveur
server.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
});

// 5. Gestion de l'arrêt
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down...');
    await gameManager.cleanup();
    await roomManager.cleanup();
    server.close(() => process.exit(0));
});

export { io, gameManager, roomManager };