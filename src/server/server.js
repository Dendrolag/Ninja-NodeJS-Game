/**
 * @file server.js
 * @description Point d'entrée principal du serveur de jeu
 */

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

// Import des composants principaux
const GameInstance = require('./game/gameInstance');

/**
 * Configuration des routes statiques et des assets
 */
app.use('/assets', express.static(__dirname + '/assets'));
app.use(express.static(__dirname + '/public'));

/**
 * Initialisation du jeu
 */
class GameServer {
    constructor() {
        this.gameInstance = GameInstance.getInstance();
        this.port = process.env.PORT || 3000;
    }

    /**
     * @method init
     * @description Initialise le serveur et tous ses composants
     */
    init() {
        // Initialiser l'instance de jeu avec Socket.IO
        this.gameInstance.initialize({ io });

        // Démarrer le serveur HTTP
        this.startServer();
    }

    /**
     * @private
     * @method startServer
     * @description Démarre le serveur HTTP
     */
    startServer() {
        server.listen(this.port, () => {
            console.log(`Serveur en écoute sur le port ${this.port}`);
            console.log('Mode de jeu : Classic');
            console.log('Statut : En attente de joueurs...');
        });

        // Gérer l'arrêt gracieux
        this.setupGracefulShutdown();
    }

    /**
     * @private
     * @method setupGracefulShutdown
     * @description Configure l'arrêt gracieux du serveur
     */
    setupGracefulShutdown() {
        const signals = ['SIGTERM', 'SIGINT'];
        
        signals.forEach(signal => {
            process.on(signal, () => {
                console.log(`\nSignal ${signal} reçu. Arrêt gracieux du serveur...`);
                
                // Fermer proprement les connexions Socket.IO
                io.close(() => {
                    console.log('Connexions Socket.IO fermées.');
                    
                    // Fermer le serveur HTTP
                    server.close(() => {
                        console.log('Serveur HTTP arrêté.');
                        process.exit(0);
                    });
                });

                // Si le serveur ne s'arrête pas dans les 5 secondes, forcer l'arrêt
                setTimeout(() => {
                    console.error('Délai d\'arrêt gracieux dépassé, arrêt forcé');
                    process.exit(1);
                }, 5000);
            });
        });

        // Gérer les erreurs non capturées
        process.on('uncaughtException', (error) => {
            console.error('Erreur non capturée:', error);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Promesse rejetée non gérée:', reason);
        });
    }
}

// Créer et démarrer le serveur
const gameServer = new GameServer();
gameServer.init();

// Exporter pour les tests
module.exports = {
    app,
    server,
    gameServer
};