/**
 * @class RenderManager
 * @description Gère le rendu du jeu
 */
class RenderManager {
    constructor(clientInstance) {
        this.client = clientInstance;
        this.canvas = null;
        this.context = null;
        this.lastRenderTime = 0;
        
        // Images
        this.backgroundImage = new Image();
        this.backgroundImage.src = '/assets/images/background.jpg';

        // Images des bonus
        this.bonusImages = {
            speed: new Image(),
            invincibility: new Image(),
            reveal: new Image()
        };

        // Images des malus
        this.malusImages = {
            reverse: new Image(),
            blur: new Image(),
            negative: new Image()
        };

        // Constantes de rendu
        this.RENDER_CONSTANTS = {
            ARROW_DISTANCE: 80,
            ARROW_SIZE: 40,
            ARROW_WIDTH: 30,
            BOUNCE_AMOUNT: 8,
            BOUNCE_SPEED: 0.004,
            LINE_WIDTH: 3,
            ENTITY_RADIUS: 10,
            ENTITY_BORDER: 11
        };
    }

    /**
     * @method initialize
     * @description Initialise le gestionnaire de rendu
     */
    async initialize() {
        // Initialisation du canvas
        this.canvas = document.getElementById('gameCanvas');
        this.context = this.canvas.getContext('2d');

        // Chargement des images des bonus
        this.bonusImages.speed.src = '/assets/images/speed.svg';
        this.bonusImages.invincibility.src = '/assets/images/shield.svg';
        this.bonusImages.reveal.src = '/assets/images/eye.svg';

        // Chargement des images des malus
        this.malusImages.reverse.src = '/assets/images/reverse.svg';
        this.malusImages.blur.src = '/assets/images/blur.svg';
        this.malusImages.negative.src = '/assets/images/negative.svg';

        // Configuration du canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Démarrer la boucle de rendu
        this.startRenderLoop();

        // Attendre le chargement de toutes les images
        await Promise.all([
            ...Object.values(this.bonusImages).map(img => new Promise(resolve => {
                if (img.complete) resolve();
                else img.onload = resolve;
            })),
            ...Object.values(this.malusImages).map(img => new Promise(resolve => {
                if (img.complete) resolve();
                else img.onload = resolve;
            })),
            new Promise(resolve => {
                if (this.backgroundImage.complete) resolve();
                else this.backgroundImage.onload = resolve;
            })
        ]);
    }

    /**
     * @private
     * @method resizeCanvas
     * @description Redimensionne le canvas selon la taille de la fenêtre
     */
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        
        // Optimisations de rendu
        this.canvas.style.imageRendering = 'crisp-edges';
        this.canvas.style.backfaceVisibility = 'hidden';
        this.canvas.style.transform = 'translateZ(0)';

        // Recalculer l'échelle de la caméra
        this.client.managers.camera?.updateScale();
    }

    /**
     * @private
     * @method startRenderLoop
     * @description Démarre la boucle de rendu principale
     */
    startRenderLoop() {
        const renderFrame = (timestamp) => {
            // Calculer le delta time
            const deltaTime = timestamp - this.lastRenderTime;
            this.lastRenderTime = timestamp;

            // Ne rendre que si le jeu n'est pas en pause
            if (!this.client.gameState.isPaused) {
                this.render(deltaTime);
            }

            requestAnimationFrame(renderFrame);
        };

        requestAnimationFrame(renderFrame);
    }

/**
     * @method render
     * @description Effectue le rendu d'une frame
     * @param {number} deltaTime - Temps écoulé depuis la dernière frame
     */
render(deltaTime) {
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';

    // Sauvegarder le contexte
    this.context.save();
    
    // Effacer le canvas
    this.context.fillStyle = '#2c3e50';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Appliquer la transformation de la caméra
    const camera = this.client.managers.camera;
    if (camera) {
        this.context.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.context.scale(camera.scale, camera.scale);
        this.context.translate(-camera.x, -camera.y);
    }

    // Dessiner dans l'ordre
    this.drawBackground();
    this.drawSpecialZones();
    this.drawLocator();
    this.drawEntities();
    this.drawBonuses();
    this.drawMalus();

    // Restaurer le contexte
    this.context.restore();
}

/**
 * @method drawBackground
 * @description Dessine le fond du jeu
 */
drawBackground() {
    const { GAME_WIDTH, GAME_HEIGHT } = this.client.config;

    // Dessiner le fond
    if (this.backgroundImage.complete) {
        const pattern = this.context.createPattern(this.backgroundImage, 'repeat');
        if (pattern) {
            this.context.fillStyle = pattern;
            this.context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }
    }

    // Dessiner les limites de la zone de jeu
    this.context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.context.lineWidth = 4;
    this.context.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

/**
 * @method drawSpecialZones
 * @description Dessine les zones spéciales
 */
drawSpecialZones() {
    const { specialZones } = this.client.gameState;
    if (!specialZones) return;

    specialZones.forEach(zone => {
        this.context.fillStyle = zone.type.color;
        this.context.strokeStyle = zone.type.borderColor;
        this.context.lineWidth = 2;

        if (zone.shape.type === 'circle') {
            // Zone circulaire
            this.context.beginPath();
            this.context.arc(
                zone.shape.x,
                zone.shape.y,
                zone.shape.radius,
                0,
                Math.PI * 2
            );
            this.context.fill();
            this.context.stroke();

            // Texte de la zone
            this.context.fillStyle = 'white';
            this.context.font = '20px Chewy-Regular';
            this.context.textAlign = 'center';
            this.context.fillText(zone.type.name, zone.shape.x, zone.shape.y);
        } else {
            // Zone rectangulaire
            this.context.fillRect(
                zone.shape.x,
                zone.shape.y,
                zone.shape.width,
                zone.shape.height
            );
            this.context.strokeRect(
                zone.shape.x,
                zone.shape.y,
                zone.shape.width,
                zone.shape.height
            );

            this.context.fillStyle = 'white';
            this.context.font = '20px Chewy-Regular';
            this.context.textAlign = 'center';
            this.context.fillText(
                zone.type.name,
                zone.shape.x + zone.shape.width/2,
                zone.shape.y + zone.shape.height/2
            );
        }
    });
}

/**
 * @method drawBonuses
 * @description Dessine tous les bonus actifs sur le terrain
 */
drawBonuses() {
    const { bonuses } = this.client.gameState;
    if (!bonuses) return;

    bonuses.forEach(bonus => {
        const image = this.bonusImages[bonus.type];
        const effect = this.getBonusEffect(bonus.type);
        
        if (!image || !image.complete || !effect) return;

        // Calculer l'opacité pour le clignotement
        let opacity = 1;
        if (bonus.isBlinking) {
            opacity = 0.3 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.7;
        }

        this.drawBonusOrMalus(bonus, image, effect, opacity);
    });
}

/**
 * @method drawMalus
 * @description Dessine tous les malus actifs sur le terrain
 */
drawMalus() {
    const malus = this.client.gameState.malus;
    if (!malus) return;

    malus.forEach(malusItem => {
        const image = this.malusImages[malusItem.type];
        const effect = this.getMalusEffect(malusItem.type);
        
        if (!image || !image.complete || !effect) return;

        // Calculer l'opacité pour le clignotement
        let opacity = 1;
        if (malusItem.isBlinking) {
            opacity = 0.3 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.7;
        }

        this.drawBonusOrMalus(malusItem, image, effect, opacity);
    });
}

/**
     * @method drawEntities
     * @description Dessine toutes les entités du jeu
     */
drawEntities() {
    const { entities } = this.client.gameState;
    if (!entities) return;

    entities.forEach(entity => {
        // Vérifier si l'entité est dans une zone d'invisibilité
        const isInInvisibilityZone = this.isEntityInStealthZone(entity);
        
        // Ne pas dessiner les joueurs invisibles (sauf le joueur local)
        if (isInInvisibilityZone && 
            entity.type === 'player' && 
            !this.client.isCurrentPlayer(entity.id)) {
            return;
        }

        // Style spécial pour le joueur local en invisibilité
        if (isInInvisibilityZone && this.client.isCurrentPlayer(entity.id)) {
            this.context.globalAlpha = 0.3;
        }

        // Dessiner l'entité selon son type
        switch(entity.type) {
            case 'player':
                this.drawPlayer(entity);
                break;
            case 'bot':
                this.drawBot(entity);
                break;
            case 'blackBot':
                this.drawBlackBot(entity);
                break;
        }

        // Réinitialiser l'opacité
        this.context.globalAlpha = 1;
    });
}

/**
 * @private
 * @method drawPlayer
 * @description Dessine un joueur
 * @param {Object} player - Données du joueur à dessiner
 */
drawPlayer(player) {
    const isCurrentPlayer = this.client.isCurrentPlayer(player.id);

    // Dessiner d'abord les effets de bonus si c'est notre joueur
    if (isCurrentPlayer) {
        this.drawBonusEffects(player);
    }

    this.drawEntityBase(player);

    // Ajouter les effets spéciaux pour le joueur actuel
    if (isCurrentPlayer) {
        // Contour doré
        this.context.lineWidth = 2;
        this.context.strokeStyle = '#FFD700';
        this.context.stroke();
        
        // Contour blanc intérieur
        this.context.lineWidth = 1;
        this.context.strokeStyle = '#FFFFFF';
        this.context.stroke();
    }
    // Effet pour les joueurs révélés
    else if (this.client.activeEffects.reveal && player.type === 'player') {
        this.context.lineWidth = 3;
        this.context.strokeStyle = '#FF0000';
        this.context.stroke();
    }
}

/**
 * @private
 * @method drawBot
 * @description Dessine un bot standard
 * @param {Object} bot - Données du bot à dessiner
 */
drawBot(bot) {
    this.drawEntityBase(bot);
}

/**
 * @private
 * @method drawBlackBot
 * @description Dessine un bot noir avec ses effets spéciaux
 * @param {Object} blackBot - Données du bot noir à dessiner
 */
drawBlackBot(blackBot) {
    // Effet de lueur rouge pour le rayon de détection
    this.context.beginPath();
    this.context.arc(blackBot.x, blackBot.y, blackBot.detectionRadius, 0, Math.PI * 2);
    this.context.fillStyle = 'rgba(255, 0, 0, 0.1)';
    this.context.fill();

    // Lueur autour du bot noir
    this.context.beginPath();
    this.context.arc(blackBot.x, blackBot.y, 15, 0, Math.PI * 2);
    this.context.fillStyle = 'rgba(255, 0, 0, 0.3)';
    this.context.fill();

    // Corps du bot noir
    this.context.beginPath();
    this.context.arc(blackBot.x, blackBot.y, 11, 0, Math.PI * 2);
    this.context.fillStyle = 'black';
    this.context.fill();
    this.context.lineWidth = 2;
    this.context.strokeStyle = '#FF0000';
    this.context.stroke();

    // Effet de pulsation
    const pulseSize = 13 + Math.sin(Date.now() * 0.01) * 2;
    this.context.beginPath();
    this.context.arc(blackBot.x, blackBot.y, pulseSize, 0, Math.PI * 2);
    this.context.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    this.context.stroke();
}

/**
 * @private
 * @method drawEntityBase
 * @description Dessine la forme de base d'une entité
 * @param {Object} entity - Entité à dessiner
 */
drawEntityBase(entity) {
    const { ENTITY_RADIUS, ENTITY_BORDER } = this.RENDER_CONSTANTS;

    this.context.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.context.shadowBlur = 4;
    this.context.shadowOffsetX = 2;
    this.context.shadowOffsetY = 2;

    // Contour noir
    this.context.beginPath();
    this.context.arc(entity.x, entity.y, ENTITY_BORDER, 0, Math.PI * 2);
    this.context.fillStyle = 'black';
    this.context.fill();

    // Cercle de couleur
    this.context.beginPath();
    this.context.arc(entity.x, entity.y, ENTITY_RADIUS, 0, Math.PI * 2);
    this.context.fillStyle = entity.color;
    this.context.fill();

    // Réinitialiser les ombres
    this.context.shadowColor = 'transparent';
    this.context.shadowBlur = 0;
    this.context.shadowOffsetX = 0;
    this.context.shadowOffsetY = 0;
}

/**
     * @method drawBonusEffects
     * @description Dessine les effets visuels des bonus actifs sur un joueur
     * @param {Object} player - Joueur sur lequel dessiner les effets
     */
drawBonusEffects(player) {
    const activeEffects = [];
    const { speedBoost, invincibility, reveal } = this.client.activeEffects;

    if (speedBoost) activeEffects.push('speed');
    if (invincibility) activeEffects.push('invincibility');
    if (reveal) activeEffects.push('reveal');

    if (activeEffects.length === 0) return;

    this.context.save();

    activeEffects.forEach((effectType, index) => {
        const effect = this.getBonusEffect(effectType);
        const baseGlowSize = effect.glowSize;
        const pulse = Math.sin(Date.now() * effect.pulseSpeed) * 5;
        const offsetDistance = index * 8;

        // Créer un dégradé radial pour l'effet de lueur
        const gradient = this.context.createRadialGradient(
            player.x, player.y, 10 + offsetDistance,
            player.x, player.y, baseGlowSize + pulse + offsetDistance
        );

        const baseOpacity = 0.7 / Math.max(1, activeEffects.length);
        gradient.addColorStop(0, this.adjustColorOpacity(effect.color, baseOpacity));
        gradient.addColorStop(1, 'transparent');

        // Dessiner l'effet de lueur
        this.context.beginPath();
        this.context.fillStyle = gradient;
        this.context.arc(
            player.x,
            player.y,
            baseGlowSize + pulse + offsetDistance,
            0,
            Math.PI * 2
        );
        this.context.fill();

        // Contour subtil
        this.context.strokeStyle = this.adjustColorOpacity(effect.color, 0.25);
        this.context.lineWidth = 2;
        this.context.stroke();
    });

    this.context.restore();
}

/**
 * @method drawLocator
 * @description Dessine l'indicateur de localisation du joueur
 */
drawLocator() {
    const currentPlayer = this.client.gameState.entities.find(
        e => this.client.isCurrentPlayer(e.id)
    );
    
    if (!this.client.showPlayerLocator || !currentPlayer) return;

    const now = Date.now();
    let opacity = 1;
    
    if (now > this.client.locatorFadeStartTime) {
        opacity = 1 - (now - this.client.locatorFadeStartTime) / 
                 this.client.locatorFadeDuration;
        opacity = Math.max(0, Math.min(1, opacity));
    }

    const { ARROW_DISTANCE, ARROW_SIZE, ARROW_WIDTH, BOUNCE_AMOUNT, 
            BOUNCE_SPEED, LINE_WIDTH } = this.RENDER_CONSTANTS;

    const bounce = Math.sin(now * BOUNCE_SPEED) * BOUNCE_AMOUNT;
    
    this.context.save();
    
    // Dessiner les flèches dans les 4 directions
    const directions = [
        { angle: 0, dx: 0, dy: -1 },     // Haut
        { angle: Math.PI/2, dx: 1, dy: 0 },      // Droite
        { angle: Math.PI, dx: 0, dy: 1 },    // Bas
        { angle: -Math.PI/2, dx: -1, dy: 0 }     // Gauche
    ];

    directions.forEach(dir => {
        this.context.save();
        
        const arrowX = currentPlayer.x + (dir.dx * (ARROW_DISTANCE + bounce));
        const arrowY = currentPlayer.y + (dir.dy * (ARROW_DISTANCE + bounce));
        
        this.context.translate(arrowX, arrowY);
        this.context.rotate(dir.angle);

        // Dessiner la flèche
        this.context.beginPath();
        this.context.moveTo(0, ARROW_SIZE);
        this.context.lineTo(-ARROW_WIDTH, 0);
        this.context.lineTo(ARROW_WIDTH, 0);
        this.context.closePath();

        this.context.fillStyle = `rgba(255, 30, 30, ${opacity})`;
        this.context.fill();

        this.context.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        this.context.lineWidth = LINE_WIDTH;
        this.context.stroke();

        this.context.shadowColor = `rgba(255, 0, 0, ${opacity * 0.5})`;
        this.context.shadowBlur = 10;
        this.context.stroke();

        this.context.restore();
    });

    this.context.restore();
}

/**
 * @private
 * @method drawBonusOrMalus
 * @description Méthode commune pour dessiner un bonus ou un malus
 * @param {Object} item - Item à dessiner
 * @param {Image} image - Image à utiliser
 * @param {Object} effect - Effet à appliquer
 * @param {number} opacity - Opacité
 */
drawBonusOrMalus(item, image, effect, opacity) {
    this.context.save();
    
    // Effet de lueur
    this.context.beginPath();
    this.context.arc(item.x, item.y, 22, 0, Math.PI * 2);
    this.context.fillStyle = effect.backgroundColor;
    this.context.globalAlpha = opacity * 0.6;
    this.context.fill();

    // Cercle secondaire
    this.context.beginPath();
    this.context.arc(item.x, item.y, 20, 0, Math.PI * 2);
    this.context.fillStyle = effect.borderColor;
    this.context.globalAlpha = opacity * 0.3;
    this.context.fill();

    // Contour
    this.context.strokeStyle = effect.borderColor;
    this.context.lineWidth = 2 + (opacity * 1);
    this.context.globalAlpha = opacity * 0.8;
    this.context.stroke();

    // Image
    this.context.globalAlpha = opacity;
    this.context.drawImage(image, item.x - 15, item.y - 15, 30, 30);

    this.context.restore();
}

/**
 * @private
 * @method isEntityInStealthZone
 * @description Vérifie si une entité est dans une zone de furtivité
 */
isEntityInStealthZone(entity) {
    return this.client.gameState.specialZones?.some(zone => {
        if (zone.type.id !== 'STEALTH') return false;

        if (zone.shape.type === 'circle') {
            return Math.hypot(entity.x - zone.shape.x, entity.y - zone.shape.y) <= zone.shape.radius;
        }
        return false; // Pour l'instant seules les zones circulaires sont implémentées
    }) || false;
}

/**
 * @private
 * @method getBonusEffect
 * @description Récupère les paramètres d'effet pour un bonus
 */
getBonusEffect(type) {
    return {
        speed: {
            color: '#00ff00',
            glowSize: 20,
            pulseSpeed: 0.006,
            backgroundColor: 'rgba(0, 255, 0, 0.2)',
            borderColor: 'rgba(0, 255, 0, 0.6)'
        },
        invincibility: {
            color: '#ffd700',
            glowSize: 25,
            pulseSpeed: 0.004,
            backgroundColor: 'rgba(255, 215, 0, 0.2)',
            borderColor: 'rgba(255, 215, 0, 0.6)'
        },
        reveal: {
            color: '#ff00ff',
            glowSize: 15,
            pulseSpeed: 0.005,
            backgroundColor: 'rgba(255, 0, 255, 0.2)',
            borderColor: 'rgba(255, 0, 255, 0.6)'
        }
    }[type] || null;
}

/**
 * @private
 * @method getMalusEffect
 * @description Récupère les paramètres d'effet pour un malus
 */
getMalusEffect(type) {
    return {
        reverse: {
            color: '#ff4444',
            glowSize: 20,
            pulseSpeed: 0.006,
            backgroundColor: 'rgba(255, 68, 68, 0.2)',
            borderColor: 'rgba(255, 68, 68, 0.6)'
        },
        blur: {
            color: '#44aaff',
            glowSize: 20,
            pulseSpeed: 0.006,
            backgroundColor: 'rgba(68, 170, 255, 0.2)',
            borderColor: 'rgba(68, 170, 255, 0.6)'
        },
        negative: {
            color: '#aa44ff',
            glowSize: 20,
            pulseSpeed: 0.006,
            backgroundColor: 'rgba(170, 68, 255, 0.2)',
            borderColor: 'rgba(170, 68, 255, 0.6)'
        }
    }[type] || null;
}

/**
 * @private
 * @method adjustColorOpacity
 * @description Ajuste l'opacité d'une couleur
 */
adjustColorOpacity(color, opacity) {
    if (color.startsWith('#')) {
        // Convertir la couleur hex en RGB
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
}

module.exports = RenderManager;