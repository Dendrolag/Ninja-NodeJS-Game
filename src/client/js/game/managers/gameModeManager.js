/**
 * @class GameModeManager
 * @description Gère les différents modes de jeu et leurs règles spécifiques
 */
class GameModeManager {
    constructor(gameInstance) {
        this.game = gameInstance;
        
        // Mode de jeu actuel
        this.currentMode = null;
        
        // Définition des modes de jeu disponibles
        this.modes = {
            CLASSIC: {
                id: 'CLASSIC',
                name: 'Mode Classique',
                description: 'Capture les autres joueurs et contrôle les bots pour gagner.',
                minPlayers: 1,
                maxPlayers: 10,
                settings: {
                    teamBased: false,
                    friendlyFire: false,
                    scoreSystem: 'individual',
                    winCondition: 'highestScore'
                }
            },
            TEAM: {
                id: 'TEAM',
                name: 'Mode Équipe',
                description: 'Deux équipes s\'affrontent pour la domination du terrain.',
                minPlayers: 2,
                maxPlayers: 16,
                settings: {
                    teamBased: true,
                    teams: {
                        RED: { name: 'Rouge', color: '#FF0000' },
                        BLUE: { name: 'Bleu', color: '#0000FF' }
                    },
                    friendlyFire: false,
                    scoreSystem: 'team',
                    winCondition: 'teamScore',
                    balanceTeams: true
                }
            },
            SURVIVAL: {
                id: 'SURVIVAL',
                name: 'Mode Survie',
                description: 'Reste en vie le plus longtemps possible avec un seul bot.',
                minPlayers: 1,
                maxPlayers: 8,
                settings: {
                    teamBased: false,
                    friendlyFire: true,
                    scoreSystem: 'survival',
                    winCondition: 'lastAlive',
                    startingBots: 1,
                    respawnEnabled: false
                }
            },
            CAPTURE_ZONE: {
                id: 'CAPTURE_ZONE',
                name: 'Capture de Zones',
                description: 'Capture et contrôle les zones pour marquer des points.',
                minPlayers: 2,
                maxPlayers: 12,
                settings: {
                    teamBased: true,
                    teams: {
                        RED: { name: 'Rouge', color: '#FF0000' },
                        BLUE: { name: 'Bleu', color: '#0000FF' }
                    },
                    friendlyFire: false,
                    scoreSystem: 'zoneControl',
                    winCondition: 'zonePoints',
                    zoneSettings: {
                        captureTime: 10,
                        pointsPerSecond: 1,
                        numberOfZones: 3,
                        neutralZones: true
                    }
                }
            }
        };

        // État du mode actuel
        this.state = {
            teams: new Map(),
            scores: new Map(),
            zoneControl: new Map(),
            specialRules: new Map()
        };

        // Écouteurs d'événements des modes
        this.modeEventListeners = new Map();
    }

    /**
     * @method initialize
     * @description Initialise le gestionnaire de modes
     * @param {string} [defaultMode='CLASSIC'] - Mode par défaut
     */
    initialize(defaultMode = 'CLASSIC') {
        // Vérifier si le mode par défaut existe
        if (!this.modes[defaultMode]) {
            throw new Error(`Mode de jeu non valide: ${defaultMode}`);
        }

        // Initialiser le mode par défaut
        this.setMode(defaultMode);

        // Configuration des écouteurs d'événements généraux
        this.setupGlobalEventListeners();
    }

    /**
     * @method setMode
     * @description Change le mode de jeu actuel
     * @param {string} modeId - Identifiant du mode
     * @param {Object} [customSettings] - Paramètres personnalisés
     * @returns {boolean} Succès du changement de mode
     */
    setMode(modeId, customSettings = {}) {
        const mode = this.modes[modeId];
        if (!mode) {
            console.error(`Mode de jeu non trouvé: ${modeId}`);
            return false;
        }

        try {
            // Nettoyer l'ancien mode s'il existe
            if (this.currentMode) {
                this.cleanupCurrentMode();
            }

            // Configurer le nouveau mode
            this.currentMode = {
                ...mode,
                settings: {
                    ...mode.settings,
                    ...customSettings
                }
            };

            // Initialiser l'état du mode
            this.initializeModeState();

            // Configurer les écouteurs spécifiques au mode
            this.setupModeEventListeners();

            // Notifier le changement de mode
            this.game.eventManager.emit('gameModeChanged', {
                mode: modeId,
                settings: this.currentMode.settings
            });

            return true;
        } catch (error) {
            console.error(`Erreur lors du changement de mode: ${error}`);
            return false;
        }
    }
/**
     * Gestion des équipes
     */

    /**
     * @method createTeams
     * @description Crée les équipes pour le mode en cours
     * @param {Object} players - Joueurs à répartir
     */
    createTeams() {
        if (!this.currentMode.settings.teamBased) return;

        this.state.teams.clear();
        const teams = this.currentMode.settings.teams;

        // Créer les équipes
        for (const [teamId, teamConfig] of Object.entries(teams)) {
            this.state.teams.set(teamId, {
                id: teamId,
                name: teamConfig.name,
                color: teamConfig.color,
                players: new Set(),
                score: 0,
                botsControlled: 0
            });
        }
    }

    /**
     * @method assignPlayerToTeam
     * @description Assigne un joueur à une équipe
     * @param {string} playerId - ID du joueur
     * @param {string} [teamId] - ID de l'équipe (optionnel pour auto-assignation)
     * @returns {Object} Informations sur l'assignation
     */
    assignPlayerToTeam(playerId, teamId = null) {
        if (!this.currentMode.settings.teamBased) return null;

        const player = this.game.gameState.getPlayer(playerId);
        if (!player) return null;

        // Si pas d'équipe spécifiée, choisir la moins nombreuse
        const finalTeamId = teamId || this.findSmallestTeam();
        const team = this.state.teams.get(finalTeamId);
        
        if (!team) return null;

        // Retirer le joueur de son équipe actuelle s'il en a une
        this.removePlayerFromTeam(playerId);

        // Ajouter le joueur à la nouvelle équipe
        team.players.add(playerId);
        player.color = team.color;
        player.teamId = finalTeamId;

        // Notifier le changement d'équipe
        this.game.eventManager.emit('playerTeamChanged', {
            playerId,
            teamId: finalTeamId,
            teamName: team.name,
            teamColor: team.color
        });

        return {
            teamId: finalTeamId,
            teamName: team.name,
            teamColor: team.color
        };
    }

    /**
     * @method removePlayerFromTeam
     * @description Retire un joueur de son équipe
     * @param {string} playerId - ID du joueur
     */
    removePlayerFromTeam(playerId) {
        if (!this.currentMode.settings.teamBased) return;

        // Trouver et retirer le joueur de son équipe actuelle
        for (const team of this.state.teams.values()) {
            if (team.players.has(playerId)) {
                team.players.delete(playerId);
                
                const player = this.game.gameState.getPlayer(playerId);
                if (player) {
                    player.teamId = null;
                }
                break;
            }
        }
    }

    /**
     * @method balanceTeams
     * @description Équilibre les équipes si nécessaire
     * @returns {boolean} True si des changements ont été effectués
     */
    balanceTeams() {
        if (!this.currentMode.settings.balanceTeams) return false;

        let changes = false;
        const teams = Array.from(this.state.teams.values());
        
        while (this.needsBalancing(teams)) {
            const { largest, smallest } = this.findTeamSizeExtremes(teams);
            
            if (largest.players.size > smallest.players.size + 1) {
                // Trouver le joueur à déplacer (celui avec le moins de points)
                const playerToMove = this.findPlayerToMove(largest);
                if (playerToMove) {
                    this.assignPlayerToTeam(playerToMove, smallest.id);
                    changes = true;
                }
            } else {
                break;
            }
        }

        return changes;
    }

    /**
     * Gestion des scores
     */

    /**
     * @method updateScores
     * @description Met à jour les scores selon le mode de jeu
     * @param {Object} eventData - Données de l'événement déclencheur
     */
    updateScores(eventData) {
        switch (this.currentMode.settings.scoreSystem) {
            case 'individual':
                this.updateIndividualScores(eventData);
                break;
            case 'team':
                this.updateTeamScores(eventData);
                break;
            case 'survival':
                this.updateSurvivalScores(eventData);
                break;
            case 'zoneControl':
                this.updateZoneControlScores(eventData);
                break;
        }

        // Vérifier les conditions de victoire
        this.checkWinConditions();
    }

    /**
     * @method updateTeamScores
     * @description Met à jour les scores des équipes
     * @param {Object} eventData - Données de l'événement
     */
    updateTeamScores(eventData) {
        if (!this.currentMode.settings.teamBased) return;

        for (const team of this.state.teams.values()) {
            let teamScore = 0;
            
            // Calculer les points des joueurs
            for (const playerId of team.players) {
                const player = this.game.gameState.getPlayer(playerId);
                if (player) {
                    teamScore += player.captures + player.botsControlled;
                }
            }

            // Mettre à jour le score de l'équipe
            team.score = teamScore;
        }

        // Émettre l'événement de mise à jour des scores
        this.game.eventManager.emit('teamScoresUpdated', {
            scores: Array.from(this.state.teams.entries()).map(([id, team]) => ({
                teamId: id,
                teamName: team.name,
                score: team.score
            }))
        });
    }

    /**
     * @method updateIndividualScores
     * @description Met à jour les scores individuels
     * @param {Object} eventData - Données de l'événement
     */
    updateIndividualScores(eventData) {
        const players = this.game.gameState.getPlayers();
        const scores = new Map();

        for (const player of players) {
            scores.set(player.id, {
                playerId: player.id,
                nickname: player.nickname,
                score: player.captures + player.botsControlled,
                details: {
                    captures: player.captures,
                    botsControlled: player.botsControlled
                }
            });
        }

        this.state.scores = scores;

        // Émettre l'événement de mise à jour des scores
        this.game.eventManager.emit('scoresUpdated', {
            scores: Array.from(scores.values())
        });
    }