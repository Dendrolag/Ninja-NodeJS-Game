const EventEmitter = require('events');

/**
 * @class EventManager
 * @extends EventEmitter
 * @description Gère tous les événements du jeu de manière centralisée
 */
class EventManager extends EventEmitter {
    constructor() {
        super();
        this.gameState = null;
        this.socketManager = null;
    }

    /**
     * @method initialize
     * @description Initialise le gestionnaire avec les références nécessaires
     * @param {GameState} gameState - État du jeu
     * @param {SocketManager} socketManager - Gestionnaire de sockets
     */
    initialize(gameState, socketManager) {
        this.gameState = gameState;
        this.socketManager = socketManager;
        this.setupEventHandlers();
    }

    /**
     * @private
     * @method setupEventHandlers
     * @description Configure les écouteurs d'événements principaux
     */
    setupEventHandlers() {
        // Événements de capture
        this.on('playerCapture', this.handlePlayerCapture.bind(this));
        this.on('blackBotCapture', this.handleBlackBotCapture.bind(this));
        
        // Événements de bonus/malus
        this.on('bonusCollected', this.handleBonusCollection.bind(this));
        this.on('malusCollected', this.handleMalusCollection.bind(this));
        this.on('bonusExpired', this.handleBonusExpiration.bind(this));
        
        // Événements de zones spéciales
        this.on('zoneCreated', this.handleZoneCreation.bind(this));
        this.on('zoneExpired', this.handleZoneExpiration.bind(this));
    }

    /**
     * @method handlePlayerCapture
     * @description Gère la capture d'un joueur par un autre
     * @param {Object} data - Données de la capture
     */
    handlePlayerCapture(data) {
        const { attacker, victim } = data;
        if (!attacker || !victim) return;

        // Compter les bots avant le transfert
        const botsToCapture = this.gameState.countBotsForPlayer(victim);
        
        // Mettre à jour les statistiques
        attacker.captures++;
        attacker.addCapturedBots(botsToCapture);

        // Enregistrer la capture dans l'historique
        this.updateCaptureHistory(attacker, victim);

        // Transférer les bots
        this.gameState.transferBots(victim.color, attacker.color);

        // Faire respawn la victime
        victim.respawn([attacker.color], false);

        // Notifications
        this.notifyCapture(attacker, victim);
    }

    /**
     * @method handleBlackBotCapture
     * @description Gère la capture d'un joueur par un bot noir
     * @param {Object} data - Données de la capture
     */
    handleBlackBotCapture(data) {
        const { blackBot, victim, pointsLost } = data;
        
        // Transformer les bots en blancs
        this.gameState.transformBotsToWhite(victim.color, pointsLost);
        
        // Mettre à jour les statistiques
        victim.capturedByBlackBot++;
        
        // Faire respawn le joueur
        victim.respawn([], true);
        
        // Notification
        this.socketManager.notifyBlackBotCapture(victim, pointsLost);
    }

    /**
     * @method handleBonusCollection
     * @description Gère la collecte d'un bonus
     * @param {Object} data - Données du bonus collecté
     */
    handleBonusCollection(data) {
        const { player, bonus } = data;
        const duration = this.gameState.settings.getBonusDuration(bonus.type);

        // Activer le bonus
        player.activateBonus(bonus.type, duration);
        
        // Supprimer le bonus du jeu
        this.gameState.removeBonus(bonus);
        
        // Notification
        this.socketManager.notifyBonusCollection(player, bonus);
    }

    /**
     * @method handleMalusCollection
     * @description Gère la collecte d'un malus
     * @param {Object} data - Données du malus collecté
     */
    handleMalusCollection(data) {
        const { player, malus } = data;
        const duration = this.gameState.settings.getMalusDuration(malus.type);

        // Appliquer le malus aux autres joueurs
        this.gameState.applyMalusToOthers(player, malus.type, duration);
        
        // Supprimer le malus du jeu
        this.gameState.removeMalus(malus);
        
        // Notifications
        this.socketManager.notifyMalusCollection(player, malus, duration);
    }

    /**
     * @method handleBonusExpiration
     * @description Gère l'expiration d'un bonus
     * @param {Object} data - Données du bonus expiré
     */
    handleBonusExpiration(data) {
        const { player, bonusType } = data;
        
        player.deactivateBonus(bonusType);
        this.socketManager.notifyBonusExpiration(player, bonusType);
    }

    /**
     * @private
     * @method updateCaptureHistory
     * @description Met à jour l'historique des captures
     * @param {Player} attacker - Joueur attaquant
     * @param {Player} victim - Joueur victime
     */
    updateCaptureHistory(attacker, victim) {
        if (!attacker.capturedPlayers[victim.id]) {
            attacker.capturedPlayers[victim.id] = {
                nickname: victim.nickname,
                count: 0
            };
        }
        attacker.capturedPlayers[victim.id].count++;

        if (!victim.capturedBy[attacker.id]) {
            victim.capturedBy[attacker.id] = {
                nickname: attacker.nickname,
                count: 0
            };
        }
        victim.capturedBy[attacker.id].count++;
    }

    /**
     * @private
     * @method notifyCapture
     * @description Envoie les notifications de capture aux joueurs
     * @param {Player} attacker - Joueur attaquant
     * @param {Player} victim - Joueur victime
     */
    notifyCapture(attacker, victim) {
        // Notification à la victime
        this.socketManager.notifyPlayerCaptured(victim, {
            newColor: victim.color,
            capturedBy: attacker.nickname,
            totalTimesCaptured: Object.values(victim.capturedBy)
                .reduce((sum, cap) => sum + cap.count, 0)
        });

        // Notification à l'attaquant
        this.socketManager.notifyPlayerCapturedEnemy(attacker, {
            capturedNickname: victim.nickname,
            captures: attacker.captures,
            botsControlled: attacker.botsControlled,
            captureDetails: attacker.capturedPlayers
        });
    }
}

module.exports = EventManager;