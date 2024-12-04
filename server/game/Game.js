import Logger from '../utils/Logger.js';

class Game {
    constructor(id, io, settings = {}) {
        this.id = id;
        this.io = io;
        this.settings = settings;
        this.players = new Map();
        this.bots = new Map();
        this.initialized = false;
        this.started = false;
        this.logger = new Logger(`Game[${id}]`);
        this.updateInterval = null;
        this.lastUpdateTime = 0;
        this.TARGET_FPS = 20; // Réduire à 20 FPS
        this.UPDATE_INTERVAL = 1000 / this.TARGET_FPS;
    }

    async addPlayer(playerId, nickname) {
        try {
            const player = {
                id: playerId,
                nickname,
                x: Math.random() * 1900 + 50,  // Position aléatoire
                y: Math.random() * 1400 + 50,
                color: this.getRandomColor()
            };

            this.players.set(playerId, player);
            this.logger.info('Player added', {
                socketId: playerId,
                nickname,
                position: { x: player.x, y: player.y }
            });

            return true;
        } catch (error) {
            this.logger.error('Error adding player', error);
            return false;
        }
    }

    async initialize() {
        try {
            this.logger.info('Initializing game...', { gameId: this.id });
            // Pour l'instant, juste marquer comme initialisé
            this.initialized = true;
            return true;
        } catch (error) {
            this.logger.error('Error initializing game', error);
            return false;
        }
    }

    start() {
        if (this.started) return false;
        try {
            this.started = true;
            const initialState = {
                players: Array.from(this.players.values()),
                settings: this.settings
            };
    
            this.io.to(this.id).emit('gameStarting', initialState);
    
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
    
            // Utiliser un intervalle fixe
            this.updateInterval = setInterval(() => {
                this.sendGameState();
            }, this.UPDATE_INTERVAL);
    
            this.logger.info('Game started', { gameId: this.id });
            return true;
        } catch (error) {
            this.logger.error('Error starting game', error);
            this.started = false;
            return false;
        }
    }
    
    getRandomColor() {
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getAllEntities() {
        const entities = [];
        
        // Ajouter les joueurs avec plus de détails
        this.players.forEach((player, id) => {
            entities.push({
                id,
                x: player.x,
                y: player.y,
                type: 'player',
                color: player.color,
                nickname: player.nickname,
                direction: 'idle'  // à implémenter: direction réelle
            });
        });
        
        return entities;
    }
    
    sendGameState() {
        const state = {
            entities: this.getAllEntities(),
            timeLeft: this.settings.gameDuration
        };
    
        this.logger.info('Envoi état:', {
            entitiesCount: state.entities.length,
            timeLeft: state.timeLeft,
            entities: state.entities.map(e => ({
                id: e.id,
                type: e.type,
                position: { x: e.x, y: e.y }
            }))
        });
    
        this.io.to(this.id).emit('updateGameState', state);
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
    }

    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.players.clear();
        this.bots.clear();
        this.started = false;
    }
}

export default Game;