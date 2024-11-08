/**
 * @class InputManager
 * @description Gère toutes les entrées utilisateur (clavier, tactile, souris)
 */
class InputManager {
    constructor(clientInstance) {
        this.client = clientInstance;
        this.enabled = false;

        // État des touches
        this.keysPressed = new Set();
        
        // État des contrôles mobiles
        this.mobileControls = {
            isMoving: false,
            currentMove: { x: 0, y: 0 },
            moveInterval: null,
            touchId: null
        };

        // Constantes
        this.CONTROLS = {
            UP: ['ArrowUp', 'z', 'w'],
            DOWN: ['ArrowDown', 's'],
            LEFT: ['ArrowLeft', 'q', 'a'],
            RIGHT: ['ArrowRight', 'd'],
            LOCATE: ['f', 'l'],
            PAUSE: ['Escape', 'p']
        };

        // Configuration des contrôles mobiles
        this.MOBILE_CONFIG = {
            BASE_SPEED: 3,
            SPEED_BOOST_MULTIPLIER: 1.3,
            JOYSTICK_UPDATE_INTERVAL: 50,
            DIRECTION_THRESHOLD: 0.5
        };

        // Bindings des méthodes
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
    }

    /**
     * @method initialize
     * @description Initialise le gestionnaire d'entrées
     */
    initialize() {
        // Initialisation des écouteurs clavier
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);

        // Initialisation des contrôles mobiles si nécessaire
        if (this.isMobileDevice()) {
            this.initializeMobileControls();
        }

        this.enabled = true;
    }

    /**
     * @method enable
     * @description Active les contrôles
     */
    enable() {
        this.enabled = true;
    }

    /**
     * @method disable
     * @description Désactive les contrôles
     */
    disable() {
        this.enabled = false;
        this.keysPressed.clear();
        this.stopMobileMovement();
    }

    /**
     * @method cleanup
     * @description Nettoie les écouteurs d'événements
     */
    cleanup() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        
        if (this.isMobileDevice()) {
            this.cleanupMobileControls();
        }

        this.disable();
    }
/**
     * Gestionnaires d'événements clavier
     */

    /**
     * @private
     * @method handleKeyDown
     * @description Gère l'appui sur une touche
     * @param {KeyboardEvent} event - Événement clavier
     */
    handleKeyDown(event) {
        if (!this.enabled) return;

        this.keysPressed.add(event.key);

        // Touches spéciales
        if (this.CONTROLS.LOCATE.includes(event.key.toLowerCase())) {
            this.handleLocateKeyPress();
        } else if (this.CONTROLS.PAUSE.includes(event.key.toLowerCase())) {
            this.handlePauseKeyPress();
        }
    }

    /**
     * @private
     * @method handleKeyUp
     * @description Gère le relâchement d'une touche
     * @param {KeyboardEvent} event - Événement clavier
     */
    handleKeyUp(event) {
        this.keysPressed.delete(event.key);
    }

    /**
     * @private
     * @method handleLocateKeyPress
     * @description Gère l'appui sur la touche de localisation
     */
    handleLocateKeyPress() {
        if (this.client.showPlayerLocator) return;

        this.client.showPlayerLocator = true;
        this.client.locatorFadeStartTime = Date.now() + 3000;
        
        setTimeout(() => {
            this.client.showPlayerLocator = false;
        }, 3500);
    }

    /**
     * @private
     * @method handlePauseKeyPress
     * @description Gère l'appui sur la touche pause
     */
    handlePauseKeyPress() {
        if (!this.client.gameState.isGameOver) {
            this.client.socket.emit('togglePause');
        }
    }

    /**
     * @method update
     * @description Met à jour l'état des entrées et envoie les mouvements
     */
    update() {
        if (!this.enabled || this.client.gameState.isPaused) return;

        // Si on est sur mobile et qu'on bouge avec le joystick, ne pas traiter le clavier
        if (this.isMobileDevice() && this.mobileControls.isMoving) return;

        const move = this.calculateMovement();
        if (move.x !== 0 || move.y !== 0) {
            this.sendMovement(move);
        }
    }

    /**
     * @private
     * @method calculateMovement
     * @description Calcule le mouvement en fonction des touches pressées
     * @returns {Object} Vecteur de mouvement
     */
    calculateMovement() {
        let move = { x: 0, y: 0 };
        const isReversed = this.client.activemalus?.has('reverse');

        // Déterminer les directions
        if (this.isAnyKeyPressed(this.CONTROLS.UP)) move.y = isReversed ? 1 : -1;
        if (this.isAnyKeyPressed(this.CONTROLS.DOWN)) move.y = isReversed ? -1 : 1;
        if (this.isAnyKeyPressed(this.CONTROLS.LEFT)) move.x = isReversed ? 1 : -1;
        if (this.isAnyKeyPressed(this.CONTROLS.RIGHT)) move.x = isReversed ? -1 : 1;

        // Normaliser le mouvement diagonal
        if (move.x !== 0 && move.y !== 0) {
            const normalize = 1 / Math.sqrt(2);
            move.x *= normalize;
            move.y *= normalize;
        }

        return move;
    }

    /**
     * @private
     * @method isAnyKeyPressed
     * @description Vérifie si l'une des touches d'une action est pressée
     * @param {Array<string>} keys - Liste des touches à vérifier
     * @returns {boolean}
     */
    isAnyKeyPressed(keys) {
        return keys.some(key => this.keysPressed.has(key));
    }
/**
     * Gestion des contrôles mobiles
     */

    /**
     * @private
     * @method initializeMobileControls
     * @description Initialise les contrôles tactiles
     */
    initializeMobileControls() {
        const joystickBase = document.querySelector('.joystick-base');
        if (!joystickBase) return;

        // Configuration des options tactiles
        const touchOptions = { passive: false };

        // Ajout des écouteurs d'événements tactiles
        joystickBase.addEventListener('touchstart', this.handleTouchStart, touchOptions);
        document.addEventListener('touchmove', this.handleTouchMove, touchOptions);
        document.addEventListener('touchend', this.handleTouchEnd);
        document.addEventListener('touchcancel', this.handleTouchEnd);

        // Configuration du bouton de localisation mobile
        this.setupMobileLocateButton();

        // Désactiver le zoom sur double tap
        document.addEventListener('dblclick', (e) => {
            e.preventDefault();
        }, { passive: false });

        // Empêcher le scroll de la page
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
    }

    /**
     * @private
     * @method cleanupMobileControls
     * @description Nettoie les contrôles mobiles
     */
    cleanupMobileControls() {
        const joystickBase = document.querySelector('.joystick-base');
        if (joystickBase) {
            joystickBase.removeEventListener('touchstart', this.handleTouchStart);
        }
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
        document.removeEventListener('touchcancel', this.handleTouchEnd);

        this.stopMobileMovement();
    }

    /**
     * @private
     * @method handleTouchStart
     * @description Gère le début d'un toucher
     * @param {TouchEvent} e - Événement tactile
     */
    handleTouchStart(e) {
        // Si on a déjà un touch actif, ignorer les autres
        if (this.mobileControls.touchId !== null) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        this.mobileControls.touchId = touch.identifier;
        
        this.mobileControls.isMoving = true;
        const joystickBase = e.currentTarget;
        this.mobileControls.baseRect = joystickBase.getBoundingClientRect();
        
        const { centerX, centerY } = this.getJoystickCenter();
        this.mobileControls.centerX = centerX;
        this.mobileControls.centerY = centerY;
        
        this.handleTouchMove(e);
        this.startMobileMovement();
    }

    /**
     * @private
     * @method handleTouchMove
     * @description Gère le déplacement d'un toucher
     * @param {TouchEvent} e - Événement tactile
     */
    handleTouchMove(e) {
        if (!this.mobileControls.isMoving) return;
        e.preventDefault();
        
        const touch = Array.from(e.touches)
            .find(t => t.identifier === this.mobileControls.touchId);
            
        if (!touch) return;
        
        const x = touch.clientX - this.mobileControls.centerX;
        const y = touch.clientY - this.mobileControls.centerY;
        const maxRadius = this.mobileControls.baseRect.width / 2;
        
        if (Math.hypot(x, y) === 0) return;      
        
        // Normaliser en vecteurs binaires (-1, 0, ou 1)
        const isReversed = this.client.activemalus?.has('reverse');
        const normalizedX = Math.abs(x / maxRadius) > this.MOBILE_CONFIG.DIRECTION_THRESHOLD 
            ? Math.sign(x) * (isReversed ? -1 : 1) : 0;
        const normalizedY = Math.abs(y / maxRadius) > this.MOBILE_CONFIG.DIRECTION_THRESHOLD 
            ? Math.sign(y) * (isReversed ? -1 : 1) : 0;
        
        // Déplacer le joystick visuellement
        const joystick = document.querySelector('.joystick-stick');
        if (joystick) {
            const stickX = x * 0.8; // Limite le déplacement visuel à 80% du rayon
            const stickY = y * 0.8;
            requestAnimationFrame(() => {
                joystick.style.transform = `translate(${stickX}px, ${stickY}px)`;
            });
        }
        
        // Mettre à jour le mouvement
        this.mobileControls.currentMove = {
            x: normalizedX * this.MOBILE_CONFIG.BASE_SPEED,
            y: normalizedY * this.MOBILE_CONFIG.BASE_SPEED
        };
    }

    /**
     * @private
     * @method handleTouchEnd
     * @description Gère la fin d'un toucher
     * @param {TouchEvent} e - Événement tactile
     */
    handleTouchEnd(e) {
        // Vérifier si c'est le bon touch qui se termine
        if (e.type === 'touchend' || e.type === 'touchcancel') {
            let touchFound = false;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.mobileControls.touchId) {
                    touchFound = true;
                    break;
                }
            }
            if (!touchFound) return;
        }
        
        this.mobileControls.touchId = null;
        this.mobileControls.isMoving = false;
        
        // Réinitialiser la position du joystick
        const joystick = document.querySelector('.joystick-stick');
        if (joystick) {
            requestAnimationFrame(() => {
                joystick.style.transform = 'translate(-50%, -50%)';
            });
        }
        
        this.stopMobileMovement();
    }

    /**
     * @private
     * @method setupMobileLocateButton
     * @description Configure le bouton de localisation mobile
     */
    setupMobileLocateButton() {
        const locateButton = document.getElementById('mobileLocateButton');
        if (!locateButton) return;

        locateButton.addEventListener('click', () => {
            this.client.showPlayerLocator = true;
            this.client.locatorFadeStartTime = Date.now() + 3000;
            
            locateButton.classList.add('active');
            setTimeout(() => {
                locateButton.classList.remove('active');
                this.client.showPlayerLocator = false;
            }, 3500);
        });
    }
/**
     * Méthodes de gestion du mouvement
     */

    /**
     * @private
     * @method startMobileMovement
     * @description Démarre l'intervalle d'envoi des mouvements pour mobile
     */
    startMobileMovement() {
        if (this.mobileControls.moveInterval) {
            clearInterval(this.mobileControls.moveInterval);
        }

        this.mobileControls.moveInterval = setInterval(() => {
            if (this.mobileControls.isMoving) {
                this.sendMobileMovement();
            }
        }, this.MOBILE_CONFIG.JOYSTICK_UPDATE_INTERVAL);
    }

    /**
     * @private
     * @method stopMobileMovement
     * @description Arrête l'envoi des mouvements mobiles
     */
    stopMobileMovement() {
        this.mobileControls.currentMove = { x: 0, y: 0 };
        if (this.mobileControls.moveInterval) {
            clearInterval(this.mobileControls.moveInterval);
            this.mobileControls.moveInterval = null;
        }
    }

    /**
     * @private
     * @method sendMobileMovement
     * @description Envoie le mouvement mobile au serveur
     */
    sendMobileMovement() {
        if (!this.enabled || !this.client.socket || 
            this.client.gameState.isPaused || 
            this.client.gameState.isGameOver) return;

        const speedMultiplier = this.client.activeEffects.speedBoost ? 
            this.MOBILE_CONFIG.SPEED_BOOST_MULTIPLIER : 1;
        
        const move = {
            x: this.mobileControls.currentMove.x * speedMultiplier,
            y: this.mobileControls.currentMove.y * speedMultiplier,
            speedBoostActive: this.client.activeEffects.speedBoost
        };

        this.client.socket.emit('move', move);
    }

    /**
     * @private
     * @method sendMovement
     * @description Envoie un mouvement au serveur
     * @param {Object} move - Vecteur de mouvement
     */
    sendMovement(move) {
        if (!this.client.socket) return;

        const speedMultiplier = this.client.activeEffects.speedBoost ? 
            this.MOBILE_CONFIG.SPEED_BOOST_MULTIPLIER : 1;

        this.client.socket.emit('move', {
            x: move.x * this.MOBILE_CONFIG.BASE_SPEED * speedMultiplier,
            y: move.y * this.MOBILE_CONFIG.BASE_SPEED * speedMultiplier,
            speedBoostActive: this.client.activeEffects.speedBoost
        });
    }

    /**
     * Méthodes utilitaires
     */

    /**
     * @private
     * @method isMobileDevice
     * @description Vérifie si l'appareil est mobile
     * @returns {boolean}
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
            .test(navigator.userAgent) || window.innerWidth <= 768;
    }

    /**
     * @private
     * @method getJoystickCenter
     * @description Obtient le centre du joystick
     * @returns {Object} Coordonnées du centre
     */
    getJoystickCenter() {
        const rect = this.mobileControls.baseRect;
        return {
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2
        };
    }
}

module.exports = InputManager;