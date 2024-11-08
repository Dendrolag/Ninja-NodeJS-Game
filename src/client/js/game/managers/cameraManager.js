/**
 * @class CameraManager
 * @description Gère la caméra du jeu, son zoom et ses déplacements
 */
class CameraManager {
    constructor(clientInstance) {
        this.client = clientInstance;

        // Position et échelle de la caméra
        this.position = { x: 0, y: 0 };
        this.scale = 1;
        this.targetScale = 1;

        // Configurations de la caméra
        this.config = {
            // Limites de zoom
            MIN_SCALE: 0.5,
            MAX_SCALE: 2,
            DEFAULT_SCALE: 1,
            
            // Vitesse de transition
            SMOOTH_FACTOR: 0.1,
            ZOOM_SMOOTH_FACTOR: 0.05,
            
            // Limites de la carte
            BOUNDARY_PADDING: 100,
            
            // Configuration mobile
            MOBILE_SCALE_MULTIPLIER: 1.2,
            MOBILE_MIN_SCALE: 0.8,
            
            // Vitesse de suivi du joueur
            FOLLOW_SPEED: 0.1
        };

        // État de la caméra
        this.state = {
            isTransitioning: false,
            transitionStartTime: 0,
            transitionDuration: 0,
            startPosition: { x: 0, y: 0 },
            targetPosition: { x: 0, y: 0 },
            shake: {
                active: false,
                intensity: 0,
                duration: 0,
                startTime: 0
            }
        };

        // Bindings
        this.handleResize = this.handleResize.bind(this);
        this.updateScale = this.updateScale.bind(this);
    }

    /**
     * @method initialize
     * @description Initialise le gestionnaire de caméra
     */
    initialize() {
        // Initialiser la position et l'échelle
        this.resetCamera();
        
        // Écouter les redimensionnements
        window.addEventListener('resize', this.handleResize);
        
        // Calculer l'échelle initiale
        this.updateScale();
        
        // Définir la position initiale au centre
        this.position = {
            x: this.client.config.GAME_WIDTH / 2,
            y: this.client.config.GAME_HEIGHT / 2
        };
    }

    /**
     * @method resetCamera
     * @description Réinitialise la caméra à ses valeurs par défaut
     */
    resetCamera() {
        this.position = {
            x: this.client.config.GAME_WIDTH / 2,
            y: this.client.config.GAME_HEIGHT / 2
        };
        
        this.scale = this.config.DEFAULT_SCALE;
        this.targetScale = this.config.DEFAULT_SCALE;
        
        this.state.isTransitioning = false;
        this.state.shake.active = false;
    }

    /**
     * @method cleanup
     * @description Nettoie les événements et ressources
     */
    cleanup() {
        window.removeEventListener('resize', this.handleResize);
    }

    /**
     * @method handleResize
     * @description Gère le redimensionnement de la fenêtre
     */
    handleResize() {
        this.updateScale();
    }

    /**
     * @method updateScale
     * @description Met à jour l'échelle de la caméra selon la taille de l'écran
     */
    updateScale() {
        const isMobile = this.client.isMobile();
        
        if (isMobile) {
            // Échelle plus grande pour mobile
            const mobileScale = Math.min(
                window.innerWidth / 500,
                window.innerHeight / 350
            );
            this.targetScale = mobileScale * this.config.MOBILE_SCALE_MULTIPLIER;
            this.targetScale = Math.max(this.config.MOBILE_MIN_SCALE, this.targetScale);
        } else {
            // Échelle normale pour desktop
            this.targetScale = Math.min(
                window.innerWidth / 1500,
                window.innerHeight / 1000
            );
        }

        // Limiter l'échelle
        this.targetScale = Math.max(
            this.config.MIN_SCALE,
            Math.min(this.config.MAX_SCALE, this.targetScale)
        );
    }
/**
     * Méthodes de mise à jour et suivi
     */

    /**
     * @method update
     * @description Met à jour la position et l'échelle de la caméra
     * @param {number} deltaTime - Temps écoulé depuis la dernière mise à jour
     */
    update(deltaTime) {
        // Si en transition, mettre à jour selon l'animation
        if (this.state.isTransitioning) {
            this.updateTransition();
        } else {
            // Sinon, suivre le joueur normalement
            this.followPlayer();
        }

        // Mettre à jour le zoom
        this.updateZoom();

        // Mettre à jour l'effet de tremblement si actif
        if (this.state.shake.active) {
            this.updateShake();
        }

        // S'assurer que la caméra reste dans les limites
        this.clampToWorldBounds();
    }

    /**
     * @method followPlayer
     * @description Fait suivre le joueur par la caméra
     */
    followPlayer() {
        const player = this.findPlayerEntity();
        if (!player) return;

        // Calculer la position cible (centrée sur le joueur)
        const targetX = player.x;
        const targetY = player.y;

        // Transition douce vers la cible
        this.position.x += (targetX - this.position.x) * this.config.FOLLOW_SPEED;
        this.position.y += (targetY - this.position.y) * this.config.FOLLOW_SPEED;
    }

    /**
     * @method updateZoom
     * @description Met à jour le niveau de zoom de la caméra
     */
    updateZoom() {
        // Transition douce du zoom
        if (this.scale !== this.targetScale) {
            this.scale += (this.targetScale - this.scale) * this.config.ZOOM_SMOOTH_FACTOR;

            // Éviter les oscillations infinies
            if (Math.abs(this.targetScale - this.scale) < 0.001) {
                this.scale = this.targetScale;
            }
        }
    }

    /**
     * @method updateTransition
     * @description Met à jour l'animation de transition de la caméra
     */
    updateTransition() {
        if (!this.state.isTransitioning) return;

        const now = Date.now();
        const elapsed = now - this.state.transitionStartTime;
        const progress = Math.min(elapsed / this.state.transitionDuration, 1);

        // Fonction d'accélération pour une transition plus fluide
        const easeProgress = this.easeInOutQuad(progress);

        // Interpoler la position
        this.position = {
            x: this.state.startPosition.x + 
               (this.state.targetPosition.x - this.state.startPosition.x) * easeProgress,
            y: this.state.startPosition.y + 
               (this.state.targetPosition.y - this.state.startPosition.y) * easeProgress
        };

        // Fin de la transition
        if (progress >= 1) {
            this.state.isTransitioning = false;
        }
    }

    /**
     * @method updateShake
     * @description Met à jour l'effet de tremblement de la caméra
     */
    updateShake() {
        const now = Date.now();
        const elapsed = now - this.state.shake.startTime;
        
        if (elapsed >= this.state.shake.duration) {
            this.state.shake.active = false;
            return;
        }

        // Calculer l'intensité restante
        const remainingIntensity = this.state.shake.intensity * 
            (1 - (elapsed / this.state.shake.duration));

        // Appliquer un décalage aléatoire
        this.position.x += (Math.random() - 0.5) * remainingIntensity;
        this.position.y += (Math.random() - 0.5) * remainingIntensity;
    }

    /**
     * @method findPlayerEntity
     * @description Trouve l'entité du joueur actuel
     * @returns {Object|null} Entité du joueur ou null
     */
    findPlayerEntity() {
        return this.client.gameState.entities?.find(
            entity => entity.id === this.client.playerId
        ) || null;
    }

    /**
     * @method clampToWorldBounds
     * @description Maintient la caméra dans les limites du monde
     */
    clampToWorldBounds() {
        const viewWidth = window.innerWidth / this.scale;
        const viewHeight = window.innerHeight / this.scale;
        const halfWidth = viewWidth / 2;
        const halfHeight = viewHeight / 2;
        const worldWidth = this.client.config.GAME_WIDTH;
        const worldHeight = this.client.config.GAME_HEIGHT;

        // Ajouter une marge pour éviter de voir hors des limites
        const margin = this.config.BOUNDARY_PADDING;

        // Limiter horizontalement
        this.position.x = Math.max(
            halfWidth + margin,
            Math.min(worldWidth - halfWidth - margin, this.position.x)
        );

        // Limiter verticalement
        this.position.y = Math.max(
            halfHeight + margin,
            Math.min(worldHeight - halfHeight - margin, this.position.y)
        );
    }
/**
     * Effets et animations de caméra
     */

    /**
     * @method transitionTo
     * @description Démarre une transition fluide vers une position
     * @param {Object} target - Position cible {x, y}
     * @param {number} duration - Durée de la transition en ms
     */
    transitionTo(target, duration = 1000) {
        this.state.isTransitioning = true;
        this.state.transitionStartTime = Date.now();
        this.state.transitionDuration = duration;
        this.state.startPosition = { ...this.position };
        this.state.targetPosition = { ...target };
    }

    /**
     * @method shake
     * @description Déclenche un effet de tremblement de la caméra
     * @param {number} intensity - Intensité du tremblement
     * @param {number} duration - Durée en millisecondes
     */
    shake(intensity = 10, duration = 500) {
        this.state.shake = {
            active: true,
            intensity,
            duration,
            startTime: Date.now()
        };
    }

    /**
     * @method zoomTo
     * @description Change progressivement le niveau de zoom
     * @param {number} targetScale - Échelle cible
     * @param {boolean} immediate - Si vrai, le changement est instantané
     */
    zoomTo(targetScale, immediate = false) {
        // Limiter l'échelle aux bornes définies
        this.targetScale = Math.max(
            this.config.MIN_SCALE,
            Math.min(this.config.MAX_SCALE, targetScale)
        );

        if (immediate) {
            this.scale = this.targetScale;
        }
    }

    /**
     * @method focusOn
     * @description Centre la caméra sur une position ou une entité avec effet de zoom
     * @param {Object} target - Position ou entité cible
     * @param {Object} options - Options de focus
     */
    focusOn(target, options = {}) {
        const defaultOptions = {
            duration: 1000,
            zoom: null,
            immediate: false,
            shake: false,
            shakeIntensity: 5
        };

        const finalOptions = { ...defaultOptions, ...options };
        const targetPos = this.getTargetPosition(target);

        // Appliquer le zoom si spécifié
        if (finalOptions.zoom !== null) {
            this.zoomTo(finalOptions.zoom, finalOptions.immediate);
        }

        // Transition vers la cible
        if (finalOptions.immediate) {
            this.position = { ...targetPos };
        } else {
            this.transitionTo(targetPos, finalOptions.duration);
        }

        // Ajouter un effet de tremblement si demandé
        if (finalOptions.shake) {
            this.shake(finalOptions.shakeIntensity, finalOptions.duration / 2);
        }
    }

    /**
     * @method panBy
     * @description Déplace la caméra d'un certain décalage
     * @param {number} dx - Décalage horizontal
     * @param {number} dy - Décalage vertical
     * @param {boolean} smooth - Si vrai, le mouvement est lissé
     */
    panBy(dx, dy, smooth = true) {
        const newPos = {
            x: this.position.x + dx,
            y: this.position.y + dy
        };

        if (smooth) {
            this.transitionTo(newPos, 500);
        } else {
            this.position = newPos;
            this.clampToWorldBounds();
        }
    }

    /**
     * @method setBounds
     * @description Définit les limites de déplacement de la caméra
     * @param {Object} bounds - Limites {left, top, right, bottom}
     */
    setBounds(bounds) {
        this.bounds = {
            left: bounds.left || 0,
            top: bounds.top || 0,
            right: bounds.right || this.client.config.GAME_WIDTH,
            bottom: bounds.bottom || this.client.config.GAME_HEIGHT
        };
    }

    /**
     * @method getWorldToScreenPosition
     * @description Convertit une position monde en position écran
     * @param {Object} worldPos - Position dans le monde {x, y}
     * @returns {Object} Position à l'écran {x, y}
     */
    getWorldToScreenPosition(worldPos) {
        return {
            x: (worldPos.x - this.position.x) * this.scale + window.innerWidth / 2,
            y: (worldPos.y - this.position.y) * this.scale + window.innerHeight / 2
        };
    }

    /**
     * @method getScreenToWorldPosition
     * @description Convertit une position écran en position monde
     * @param {Object} screenPos - Position à l'écran {x, y}
     * @returns {Object} Position dans le monde {x, y}
     */
    getScreenToWorldPosition(screenPos) {
        return {
            x: (screenPos.x - window.innerWidth / 2) / this.scale + this.position.x,
            y: (screenPos.y - window.innerHeight / 2) / this.scale + this.position.y
        };
    }

    /**
     * @method isInView
     * @description Vérifie si un point est dans le champ de vision
     * @param {Object} worldPos - Position à vérifier
     * @param {number} margin - Marge supplémentaire
     * @returns {boolean}
     */
    isInView(worldPos, margin = 0) {
        const screenPos = this.getWorldToScreenPosition(worldPos);
        const viewBounds = {
            left: -margin,
            top: -margin,
            right: window.innerWidth + margin,
            bottom: window.innerHeight + margin
        };

        return screenPos.x >= viewBounds.left &&
               screenPos.x <= viewBounds.right &&
               screenPos.y >= viewBounds.top &&
               screenPos.y <= viewBounds.bottom;
    }
/**
     * Méthodes utilitaires et fonctions d'interpolation
     */

    /**
     * @private
     * @method getTargetPosition
     * @description Extrait la position d'une cible (entité ou position)
     * @param {Object} target - Cible à analyser
     * @returns {Object} Position {x, y}
     */
    getTargetPosition(target) {
        // Si la cible est déjà une position
        if (target.hasOwnProperty('x') && target.hasOwnProperty('y')) {
            return { x: target.x, y: target.y };
        }
        
        // Si la cible est une entité
        if (target.position) {
            return { x: target.position.x, y: target.position.y };
        }

        // Par défaut, retourner le centre du monde
        return {
            x: this.client.config.GAME_WIDTH / 2,
            y: this.client.config.GAME_HEIGHT / 2
        };
    }

    /**
     * @method getTransform
     * @description Obtient la transformation actuelle de la caméra
     * @returns {Object} Transformation {x, y, scale}
     */
    getTransform() {
        return {
            x: this.position.x,
            y: this.position.y,
            scale: this.scale
        };
    }

    /**
     * @method getViewport
     * @description Obtient les dimensions du viewport actuel
     * @returns {Object} Dimensions {width, height}
     */
    getViewport() {
        return {
            width: window.innerWidth / this.scale,
            height: window.innerHeight / this.scale
        };
    }

    /**
     * @method getVisibleArea
     * @description Obtient la zone visible dans les coordonnées du monde
     * @returns {Object} Zone visible {left, top, right, bottom}
     */
    getVisibleArea() {
        const viewport = this.getViewport();
        const halfWidth = viewport.width / 2;
        const halfHeight = viewport.height / 2;

        return {
            left: this.position.x - halfWidth,
            top: this.position.y - halfHeight,
            right: this.position.x + halfWidth,
            bottom: this.position.y + halfHeight
        };
    }

    /**
     * Fonctions d'interpolation
     */

    /**
     * @private
     * @method easeInOutQuad
     * @description Fonction d'accélération quadratique
     * @param {number} t - Progression (0-1)
     * @returns {number} Valeur interpolée
     */
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    /**
     * @private
     * @method easeOutElastic
     * @description Fonction d'accélération élastique
     * @param {number} t - Progression (0-1)
     * @returns {number} Valeur interpolée
     */
    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1
            : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    /**
     * @private
     * @method lerp
     * @description Interpolation linéaire entre deux valeurs
     * @param {number} start - Valeur de départ
     * @param {number} end - Valeur d'arrivée
     * @param {number} t - Progression (0-1)
     * @returns {number} Valeur interpolée
     */
    lerp(start, end, t) {
        return start * (1 - t) + end * t;
    }

    /**
     * @private
     * @method clamp
     * @description Limite une valeur entre un minimum et un maximum
     * @param {number} value - Valeur à limiter
     * @param {number} min - Minimum
     * @param {number} max - Maximum
     * @returns {number} Valeur limitée
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * @private
     * @method vec2Distance
     * @description Calcule la distance entre deux points
     * @param {Object} a - Premier point {x, y}
     * @param {Object} b - Second point {x, y}
     * @returns {number} Distance
     */
    vec2Distance(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * @method getDebugInfo
     * @description Obtient les informations de debug de la caméra
     * @returns {Object} Informations de debug
     */
    getDebugInfo() {
        return {
            position: { ...this.position },
            scale: this.scale,
            targetScale: this.targetScale,
            isTransitioning: this.state.isTransitioning,
            shakeActive: this.state.shake.active,
            viewport: this.getViewport(),
            visibleArea: this.getVisibleArea()
        };
    }
}

module.exports = CameraManager;