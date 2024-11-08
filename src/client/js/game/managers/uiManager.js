/**
 * @class UIManager
 * @description Gère toute l'interface utilisateur du jeu
 */
class UIManager {
    constructor(clientInstance) {
        this.client = clientInstance;
        
        // Références des éléments UI
        this.elements = {
            // Écrans principaux
            mainMenu: document.getElementById('mainMenu'),
            waitingRoom: document.getElementById('waitingRoom'),
            gameScreen: document.getElementById('gameScreen'),
            settingsMenu: document.getElementById('settingsMenu'),

            // Éléments de jeu
            scoreDisplay: document.getElementById('score'),
            timerDisplay: document.getElementById('timer'),
            timeValue: document.getElementById('time'),
            pauseButton: document.getElementById('pauseButton'),
            playerList: document.getElementById('players'),
            activeBonuses: document.getElementById('activeBonuses'),
            bonusNotification: document.getElementById('collectedBonusDisplay'),
            bonusNotificationContent: document.getElementById('collectedBonusDisplayContent'),

            // Éléments de la salle d'attente
            waitingRoomPlayers: document.getElementById('waitingRoomPlayers'),
            startGameButton: document.getElementById('startGameButton'),
            settingsButton: document.getElementById('waitingRoomSettings'),
            leaveRoomButton: document.getElementById('leaveRoomButton'),

            // Chat
            chatBox: document.querySelector('.floating-chat'),
            chatMessages: document.querySelector('.chat-messages'),
            chatForm: document.getElementById('chatForm'),
            chatInput: document.getElementById('chatInput'),
            chatToggle: document.querySelector('.chat-header'),

            // Contrôles mobiles
            mobileControls: document.getElementById('mobileControls')
        };

        // États de l'interface
        this.uiState = {
            isChatCollapsed: false,
            currentScreen: null,
            lastNotificationTime: 0,
            notifications: [],
            isPaused: false
        };

        // Constantes
        this.UI_CONSTANTS = {
            NOTIFICATION_DURATION: 3000,
            NOTIFICATION_FADE_DURATION: 500,
            MAX_CHAT_MESSAGES: 50,
            MAX_NOTIFICATIONS: 3
        };

        // Bindings des méthodes
        this.bindMethods();
    }

    /**
     * @private
     * @method bindMethods
     * @description Lie les méthodes à l'instance
     */
    bindMethods() {
        this.handleChatSubmit = this.handleChatSubmit.bind(this);
        this.handleChatToggle = this.handleChatToggle.bind(this);
        this.handlePauseClick = this.handlePauseClick.bind(this);
        this.handleLeaveRoom = this.handleLeaveRoom.bind(this);
        this.handleStartGame = this.handleStartGame.bind(this);
        this.handleSettingsClick = this.handleSettingsClick.bind(this);
    }

    /**
     * @method initialize
     * @description Initialise le gestionnaire d'interface
     */
    async initialize() {
        // Initialiser les écouteurs d'événements
        this.setupEventListeners();

        // Initialiser le chat
        this.initializeChat();

        // Initialiser les contrôles mobiles si nécessaire
        if (this.client.isMobile()) {
            this.initializeMobileUI();
        }

        // Afficher la version du jeu
        this.displayVersion();

        // Initialiser les panneaux d'aide
        this.initializeHelpPanels();
    }

    /**
     * @private
     * @method setupEventListeners
     * @description Configure les écouteurs d'événements de l'interface
     */
    setupEventListeners() {
        // Chat
        this.elements.chatForm?.addEventListener('submit', this.handleChatSubmit);
        this.elements.chatToggle?.addEventListener('click', this.handleChatToggle);

        // Boutons de contrôle
        this.elements.pauseButton?.addEventListener('click', this.handlePauseClick);
        this.elements.leaveRoomButton?.addEventListener('click', this.handleLeaveRoom);
        this.elements.startGameButton?.addEventListener('click', this.handleStartGame);
        this.elements.settingsButton?.addEventListener('click', this.handleSettingsClick);

        // Écouter les changements de taille de fenêtre
        window.addEventListener('resize', () => this.handleResize());
    }
/**
     * Gestion des écrans et transitions
     */

    /**
     * @method showScreen
     * @description Affiche un écran spécifique et masque les autres
     * @param {string} screenName - Nom de l'écran à afficher
     */
    showScreen(screenName) {
        // Masquer tous les écrans
        ['mainMenu', 'waitingRoom', 'gameScreen', 'settingsMenu'].forEach(screen => {
            this.elements[screen]?.classList.remove('active');
        });

        // Afficher l'écran demandé
        this.elements[screenName]?.classList.add('active');
        this.uiState.currentScreen = screenName;

        // Traitements spécifiques selon l'écran
        switch(screenName) {
            case 'gameScreen':
                this.onGameScreenShow();
                break;
            case 'waitingRoom':
                this.onWaitingRoomShow();
                break;
            case 'mainMenu':
                this.onMainMenuShow();
                break;
        }
    }

    /**
     * @private
     * @method onGameScreenShow
     * @description Actions à effectuer lors de l'affichage de l'écran de jeu
     */
    onGameScreenShow() {
        // Réinitialiser l'état du jeu
        this.uiState.isPaused = false;
        if (this.elements.pauseButton) {
            this.elements.pauseButton.disabled = false;
        }

        // Afficher le chat en jeu
        if (this.elements.chatBox) {
            this.elements.chatBox.style.display = 'flex';
        }

        // Afficher/masquer les contrôles mobiles
        this.updateMobileControlsVisibility();

        // Réinitialiser les notifications
        this.uiState.notifications = [];
        this.uiState.lastNotificationTime = 0;
    }

    /**
     * @private
     * @method onWaitingRoomShow
     * @description Actions à effectuer lors de l'affichage de la salle d'attente
     */
    onWaitingRoomShow() {
        // Réinitialiser la liste des joueurs
        if (this.elements.waitingRoomPlayers) {
            this.elements.waitingRoomPlayers.innerHTML = '';
        }

        // Afficher le chat
        if (this.elements.chatBox) {
            this.elements.chatBox.style.display = 'flex';
            this.uiState.isChatCollapsed = false;
            this.elements.chatBox.classList.remove('collapsed');
        }

        // Mettre à jour l'état des boutons
        this.updateWaitingRoomButtons();
    }

    /**
     * @private
     * @method onMainMenuShow
     * @description Actions à effectuer lors de l'affichage du menu principal
     */
    onMainMenuShow() {
        // Masquer le chat
        if (this.elements.chatBox) {
            this.elements.chatBox.style.display = 'none';
        }

        // Réinitialiser les panneaux d'aide
        this.resetHelpPanels();

        // Nettoyer les autres éléments UI
        this.clearGameUI();
    }

    /**
     * @method showGameOver
     * @description Affiche l'écran de fin de partie
     * @param {Object} data - Données de fin de partie
     */
    showGameOver(data) {
        const modal = this.createGameOverModal(data);
        document.body.appendChild(modal);

        // Animer l'apparition
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
        });

        // Configurer les boutons
        this.setupGameOverButtons(modal, data);
    }

    /**
     * @private
     * @method createGameOverModal
     * @description Crée la modale de fin de partie
     * @param {Object} data - Données de fin de partie
     * @returns {HTMLElement}
     */
    createGameOverModal(data) {
        const modal = document.createElement('div');
        modal.className = 'modal game-over-modal';
        modal.style.opacity = '0';
        modal.innerHTML = this.generateGameOverContent(data);
        return modal;
    }

    /**
     * @private
     * @method setupGameOverButtons
     * @description Configure les boutons de l'écran de fin de partie
     * @param {HTMLElement} modal - Élément modal
     * @param {Object} data - Données de fin de partie
     */
    setupGameOverButtons(modal, data) {
        const waitingRoomButton = modal.querySelector('.return-waiting-room');
        const mainMenuButton = modal.querySelector('.return-main-menu');

        if (waitingRoomButton) {
            waitingRoomButton.addEventListener('click', () => {
                this.handleGameOverAction('waitingRoom', modal);
            });
        }

        if (mainMenuButton) {
            mainMenuButton.addEventListener('click', () => {
                this.handleGameOverAction('mainMenu', modal);
            });
        }
    }

    /**
     * @private
     * @method handleGameOverAction
     * @description Gère les actions de l'écran de fin de partie
     * @param {string} action - Action à effectuer
     * @param {HTMLElement} modal - Élément modal à fermer
     */
    handleGameOverAction(action, modal) {
        // Fermer la modale avec animation
        modal.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(modal);
            
            // Exécuter l'action appropriée
            if (action === 'waitingRoom') {
                this.client.socket.emit('resetAndReturnToWaitingRoom', {
                    nickname: this.client.playerNickname
                });
            } else {
                this.returnToMainMenu();
            }
        }, 300);
    }
/**
     * Gestion du chat
     */

    /**
     * @private
     * @method initializeChat
     * @description Initialise la fonctionnalité de chat
     */
    initializeChat() {
        if (!this.elements.chatBox) return;

        // Configuration initiale
        this.elements.chatMessages.innerHTML = '';
        this.uiState.isChatCollapsed = false;
        this.elements.chatBox.classList.remove('collapsed');

        // Configuration du toggle icon
        const toggleIcon = this.elements.chatToggle?.querySelector('.toggle-icon');
        if (toggleIcon) {
            toggleIcon.textContent = '◀';
        }

        // Configurer les écouteurs d'événements du socket pour le chat
        this.setupChatSocketListeners();
    }

    /**
     * @private
     * @method setupChatSocketListeners
     * @description Configure les écouteurs d'événements socket pour le chat
     */
    setupChatSocketListeners() {
        this.client.socket.on('newChatMessage', (messageData) => {
            this.addChatMessage(messageData);
        });
    }

    /**
     * @private
     * @method handleChatSubmit
     * @description Gère l'envoi d'un message dans le chat
     * @param {Event} e - Événement de soumission
     */
    handleChatSubmit(e) {
        e.preventDefault();
        const message = this.elements.chatInput.value.trim();
        
        if (message && this.client.socket) {
            this.client.socket.emit('chatMessage', {
                message: message,
                nickname: this.client.playerNickname,
                timestamp: Date.now()
            });
            
            this.elements.chatInput.value = '';
            this.elements.chatInput.focus();
            
            // Déplier le chat si replié
            if (this.uiState.isChatCollapsed) {
                this.toggleChat(false);
            }
        }
    }

    /**
     * @private
     * @method handleChatToggle
     * @description Gère le pliage/dépliage du chat
     */
    handleChatToggle() {
        this.toggleChat(!this.uiState.isChatCollapsed);
    }

    /**
     * @private
     * @method toggleChat
     * @description Change l'état du chat (plié/déplié)
     * @param {boolean} collapsed - État plié souhaité
     */
    toggleChat(collapsed) {
        this.uiState.isChatCollapsed = collapsed;
        this.elements.chatBox.classList.toggle('collapsed', collapsed);
        
        const toggleIcon = this.elements.chatToggle?.querySelector('.toggle-icon');
        if (toggleIcon) {
            toggleIcon.textContent = collapsed ? '▶' : '◀';
        }
    }

    /**
     * @private
     * @method addChatMessage
     * @description Ajoute un message au chat
     * @param {Object} messageData - Données du message
     */
    addChatMessage(messageData) {
        const messageElement = this.createChatMessage(messageData);
        this.elements.chatMessages.appendChild(messageElement);
        
        // Limiter le nombre de messages
        while (this.elements.chatMessages.children.length > this.UI_CONSTANTS.MAX_CHAT_MESSAGES) {
            this.elements.chatMessages.removeChild(this.elements.chatMessages.firstChild);
        }
        
        // Scroll vers le bas
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    /**
     * @private
     * @method createChatMessage
     * @description Crée un élément de message pour le chat
     * @param {Object} messageData - Données du message
     * @returns {HTMLElement}
     */
    createChatMessage(messageData) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        if (messageData.nickname === this.client.playerNickname) {
            messageDiv.classList.add('own-message');
        }

        const header = document.createElement('div');
        header.className = 'chat-message-header';
        
        const author = document.createElement('span');
        author.className = 'chat-message-author';
        author.textContent = messageData.nickname;
        
        const time = document.createElement('span');
        time.className = 'chat-message-time';
        time.textContent = new Date(messageData.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const content = document.createElement('div');
        content.className = 'chat-message-content';
        content.textContent = messageData.message;
        
        header.appendChild(author);
        header.appendChild(time);
        messageDiv.appendChild(header);
        messageDiv.appendChild(content);
        
        return messageDiv;
    }

    /**
     * Gestion des notifications
     */

    /**
     * @method showNotification
     * @description Affiche une notification
     * @param {string} message - Message à afficher
     * @param {string} [type='info'] - Type de notification
     */
    showNotification(message, type = 'info') {
        const notification = this.createNotification(message, type);
        document.body.appendChild(notification);

        // Gérer la file d'attente des notifications
        this.manageNotificationQueue(notification);
    }

    /**
     * @private
     * @method createNotification
     * @description Crée un élément de notification
     * @param {string} message - Message de la notification
     * @param {string} type - Type de notification
     * @returns {HTMLElement}
     */
    createNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `game-notification ${type}`;
        notification.textContent = message;
        return notification;
    }

    /**
     * @private
     * @method manageNotificationQueue
     * @description Gère la file d'attente des notifications
     * @param {HTMLElement} notification - Élément de notification
     */
    manageNotificationQueue(notification) {
        // Ajouter à la file d'attente
        this.uiState.notifications.push(notification);

        // Limiter le nombre de notifications simultanées
        while (this.uiState.notifications.length > this.UI_CONSTANTS.MAX_NOTIFICATIONS) {
            const oldNotification = this.uiState.notifications.shift();
            if (oldNotification.parentNode) {
                oldNotification.remove();
            }
        }

        // Positionner la notification
        this.positionNotification(notification);

        // Planifier la suppression
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                const index = this.uiState.notifications.indexOf(notification);
                if (index > -1) {
                    this.uiState.notifications.splice(index, 1);
                }
                notification.remove();
            }, this.UI_CONSTANTS.NOTIFICATION_FADE_DURATION);
        }, this.UI_CONSTANTS.NOTIFICATION_DURATION);
    }

    /**
     * @private
     * @method positionNotification
     * @description Positionne une notification à l'écran
     * @param {HTMLElement} notification - Élément de notification
     */
    positionNotification(notification) {
        const baseTop = 20;
        const spacing = 10;
        const index = this.uiState.notifications.indexOf(notification);
        
        if (index > -1) {
            let totalHeight = 0;
            for (let i = 0; i < index; i++) {
                totalHeight += this.uiState.notifications[i].offsetHeight + spacing;
            }
            notification.style.top = `${baseTop + totalHeight}px`;
        }
    }
/**
     * Mises à jour de l'interface de jeu
     */

    /**
     * @method updateGameUI
     * @description Met à jour l'interface pendant le jeu
     * @param {Object} gameState - État actuel du jeu
     */
    updateGameUI(gameState) {
        this.updateTimer(gameState.timeLeft);
        this.updateScoreboard(gameState.playerScores);
        this.updateActiveBonuses();
        this.updateMobileUI();
    }

    /**
     * @method updateTimer
     * @description Met à jour l'affichage du temps
     * @param {number} timeLeft - Temps restant en secondes
     */
    updateTimer(timeLeft) {
        if (!this.elements.timeValue) return;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        this.elements.timeValue.textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Gestion de l'urgence (10 dernières secondes)
        if (timeLeft <= 10) {
            this.elements.timerDisplay.classList.add('urgent');
            
            // Son d'urgence à 10 secondes exactement
            if (timeLeft === 10) {
                this.playUrgentSound();
            }
        } else {
            this.elements.timerDisplay.classList.remove('urgent');
        }
    }

    /**
     * @method updateScoreboard
     * @description Met à jour le tableau des scores
     * @param {Array} playerScores - Scores des joueurs
     */
    updateScoreboard(playerScores) {
        if (!this.elements.playerList) return;

        this.elements.playerList.innerHTML = '';
        
        playerScores.forEach((player, index) => {
            const li = document.createElement('li');
            if (player.id === this.client.playerId) {
                li.className = 'current-player';
            }

            const totalScore = player.currentBots + player.captures;

            li.innerHTML = `
                <div class="player-rank">#${index + 1}</div>
                <div class="player-info">
                    <div class="player-name">${player.nickname}</div>
                    <div class="player-score">${totalScore}</div>
                </div>
            `;

            this.elements.playerList.appendChild(li);
        });
    }

    /**
     * @method updateActiveBonuses
     * @description Met à jour l'affichage des bonus actifs
     */
    updateActiveBonuses() {
        if (!this.elements.activeBonuses) return;

        this.elements.activeBonuses.innerHTML = '';

        const { speedBoost, invincibility, reveal } = this.client.activeEffects;
        const bonusTimers = this.client.bonusTimers;

        if (speedBoost && bonusTimers.speed > 0) {
            this.elements.activeBonuses.appendChild(
                this.createActiveBonusElement('speed', bonusTimers.speed)
            );
        }

        if (invincibility && bonusTimers.invincibility > 0) {
            this.elements.activeBonuses.appendChild(
                this.createActiveBonusElement('invincibility', bonusTimers.invincibility)
            );
        }

        if (reveal && bonusTimers.reveal > 0) {
            this.elements.activeBonuses.appendChild(
                this.createActiveBonusElement('reveal', bonusTimers.reveal)
            );
        }
    }

    /**
     * @private
     * @method createActiveBonusElement
     * @description Crée un élément pour un bonus actif
     * @param {string} type - Type de bonus
     * @param {number} timeLeft - Temps restant
     * @returns {HTMLElement}
     */
    createActiveBonusElement(type, timeLeft) {
        const bonusTypes = {
            speed: { name: 'Boost', color: '#00ff00' },
            invincibility: { name: 'Invincibilité', color: '#ffd700' },
            reveal: { name: 'Révélation', color: '#ff00ff' }
        };

        const bonusDiv = document.createElement('div');
        bonusDiv.className = 'activeBonus new-bonus';
        bonusDiv.style.backgroundColor = this.adjustColorOpacity(bonusTypes[type].color, 0.2);
        bonusDiv.style.borderColor = this.adjustColorOpacity(bonusTypes[type].color, 0.6);

        const img = document.createElement('img');
        img.src = `/assets/images/${this.getBonusImageName(type)}.svg`;
        img.alt = bonusTypes[type].name;
        img.style.filter = `drop-shadow(0 0 3px ${bonusTypes[type].color})`;

        const timerSpan = document.createElement('span');
        timerSpan.className = 'timer';
        timerSpan.textContent = `${Math.ceil(timeLeft).toString().padStart(2, '0')}s`;
        timerSpan.style.color = bonusTypes[type].color;

        bonusDiv.appendChild(img);
        bonusDiv.appendChild(timerSpan);

        requestAnimationFrame(() => {
            bonusDiv.classList.remove('new-bonus');
        });

        return bonusDiv;
    }

    /**
     * @method showBonusNotification
     * @description Affiche une notification de bonus collecté
     * @param {string} bonusType - Type de bonus
     */
    showBonusNotification(bonusType) {
        const bonusNames = {
            speed: 'Boost',
            invincibility: 'Invincibilité',
            reveal: 'Révélation'
        };

        this.elements.bonusNotificationContent.textContent = bonusNames[bonusType];
        this.elements.bonusNotification.classList.remove('hidden');

        setTimeout(() => {
            this.elements.bonusNotification.classList.add('hidden');
        }, 3000);
    }

    /**
     * @method showMalusNotification
     * @description Affiche une notification de malus
     * @param {Object} data - Données du malus
     */
    showMalusNotification(data) {
        const malusNames = {
            reverse: 'Contrôles inversés',
            blur: 'Vision floue',
            negative: 'Vision négative'
        };

        this.elements.bonusNotificationContent.textContent = 
            `${data.collectedBy} a activé ${malusNames[data.type]}!`;
        this.elements.bonusNotification.classList.remove('hidden');

        setTimeout(() => {
            this.elements.bonusNotification.classList.add('hidden');
        }, 3000);
    }

    /**
     * @method showCaptureNotification
     * @description Affiche une notification de capture
     * @param {string} message - Message de capture
     */
    showCaptureNotification(message) {
        this.elements.bonusNotificationContent.textContent = message;
        this.elements.bonusNotification.classList.remove('hidden');

        setTimeout(() => {
            this.elements.bonusNotification.classList.add('hidden');
        }, 3000);
    }
/**
     * Gestion de l'interface mobile
     */

    /**
     * @private
     * @method initializeMobileUI
     * @description Initialise l'interface pour les appareils mobiles
     */
    initializeMobileUI() {
        document.body.classList.add('is-mobile');
        
        // Ajuster les éléments UI pour le mobile
        this.adjustUIForMobile();
        
        // Désactiver le zoom sur double tap
        document.addEventListener('dblclick', (e) => e.preventDefault());
        
        // Empêcher le scroll de la page
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
    }

    /**
     * @private
     * @method adjustUIForMobile
     * @description Ajuste l'interface pour les écrans mobiles
     */
    adjustUIForMobile() {
        // Ajuster la taille des éléments
        if (this.elements.playerList) {
            this.elements.playerList.style.maxWidth = '150px';
            this.elements.playerList.style.fontSize = '12px';
        }

        // Positionner les bonus actifs
        if (this.elements.activeBonuses) {
            this.elements.activeBonuses.style.bottom = '180px';
        }

        // Ajuster la position du chat
        if (this.elements.chatBox) {
            this.elements.chatBox.style.height = '40vh';
            this.elements.chatBox.style.bottom = '200px';
        }
    }

    /**
     * @private
     * @method updateMobileUI
     * @description Met à jour l'interface mobile
     */
    updateMobileUI() {
        if (!this.client.isMobile()) return;

        this.updateMobileControlsVisibility();
        this.adjustMobileLayout();
    }

    /**
     * @private
     * @method updateMobileControlsVisibility
     * @description Met à jour la visibilité des contrôles mobiles
     */
    updateMobileControlsVisibility() {
        if (this.elements.mobileControls) {
            const shouldShow = this.client.isMobile() && 
                             this.uiState.currentScreen === 'gameScreen';
            this.elements.mobileControls.style.display = shouldShow ? 'block' : 'none';
        }
    }

    /**
     * Méthodes utilitaires
     */

    /**
     * @private
     * @method adjustColorOpacity
     * @description Ajuste l'opacité d'une couleur
     * @param {string} color - Couleur à ajuster
     * @param {number} opacity - Opacité souhaitée
     * @returns {string}
     */
    adjustColorOpacity(color, opacity) {
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
        return color.replace(/rgba?\(/, '').replace(')', '').split(',')
            .map((v, i) => i === 3 ? opacity : v)
            .reduce((acc, v) => acc + v + ',', 'rgba(')
            .slice(0, -1) + ')';
    }

    /**
     * @private
     * @method getBonusImageName
     * @description Récupère le nom de l'image pour un type de bonus
     * @param {string} type - Type de bonus
     * @returns {string}
     */
    getBonusImageName(type) {
        const imageNames = {
            speed: 'speed',
            invincibility: 'shield',
            reveal: 'eye'
        };
        return imageNames[type] || type;
    }

    /**
     * @private
     * @method clearGameUI
     * @description Nettoie l'interface de jeu
     */
    clearGameUI() {
        if (this.elements.playerList) {
            this.elements.playerList.innerHTML = '';
        }
        if (this.elements.activeBonuses) {
            this.elements.activeBonuses.innerHTML = '';
        }
        if (this.elements.bonusNotification) {
            this.elements.bonusNotification.classList.add('hidden');
        }
    }

    /**
     * @private
     * @method handleResize
     * @description Gère le redimensionnement de la fenêtre
     */
    handleResize() {
        // Mettre à jour l'état mobile
        const wasMobile = document.body.classList.contains('is-mobile');
        const isMobileNow = this.client.isMobile();

        if (wasMobile !== isMobileNow) {
            document.body.classList.toggle('is-mobile', isMobileNow);
            if (isMobileNow) {
                this.initializeMobileUI();
            } else {
                this.resetMobileUI();
            }
        }

        // Ajuster l'interface selon la taille
        this.adjustUIForCurrentSize();
    }

    /**
     * @private
     * @method playUrgentSound
     * @description Joue le son d'urgence pour le timer
     */
    playUrgentSound() {
        // À implémenter si besoin de sons
        // const urgentSound = new Audio('/assets/sounds/urgent.mp3');
        // urgentSound.play().catch(e => console.log('Son non joué:', e));
    }

    /**
     * @private
     * @method resetMobileUI
     * @description Réinitialise l'interface mobile
     */
    resetMobileUI() {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';

        if (this.elements.mobileControls) {
            this.elements.mobileControls.style.display = 'none';
        }

        this.resetUIPositions();
    }

    /**
     * @private
     * @method resetUIPositions
     * @description Réinitialise les positions des éléments UI
     */
    resetUIPositions() {
        // Réinitialiser les styles spécifiques au mobile
        if (this.elements.playerList) {
            this.elements.playerList.style.maxWidth = '';
            this.elements.playerList.style.fontSize = '';
        }

        if (this.elements.activeBonuses) {
            this.elements.activeBonuses.style.bottom = '';
        }

        if (this.elements.chatBox) {
            this.elements.chatBox.style.height = '';
            this.elements.chatBox.style.bottom = '';
        }
    }

    /**
     * @private
     * @method adjustUIForCurrentSize
     * @description Ajuste l'interface pour la taille d'écran actuelle
     */
    adjustUIForCurrentSize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Ajuster selon l'orientation et la taille
        if (width < height) {
            // Mode portrait
            this.adjustUIForPortrait();
        } else {
            // Mode paysage
            this.adjustUIForLandscape();
        }
    }

    /**
     * @private
     * @method adjustUIForPortrait
     * @description Ajuste l'interface pour le mode portrait
     */
    adjustUIForPortrait() {
        if (this.elements.playerList) {
            this.elements.playerList.style.maxHeight = '200px';
        }
        if (this.elements.activeBonuses) {
            this.elements.activeBonuses.style.bottom = '200px';
        }
    }

    /**
     * @private
     * @method adjustUIForLandscape
     * @description Ajuste l'interface pour le mode paysage
     */
    adjustUIForLandscape() {
        if (this.elements.playerList) {
            this.elements.playerList.style.maxHeight = '150px';
        }
        if (this.elements.activeBonuses) {
            this.elements.activeBonuses.style.bottom = '100px';
        }
    }
}

module.exports = UIManager;