import { DEFAULT_GAME_SETTINGS, MAP_DIMENSIONS } from './game-constants.js';

// MapManager.js

// Classe pour gérer l'effet de pluie spécifique à certaines maps
class RainEffect {
    constructor(basePath) {
        this.spriteSheet = new Image();
        // Utiliser le même chemin que les autres assets de la map
        this.spriteSheet.src = `${basePath}/rain.png`;
        
        // Configuration de l'animation
        this.frameWidth = 3000;   // 9000px ÷ 3 frames = 3000px par frame
        this.frameHeight = 2000;  // Hauteur totale du spritesheet
        this.totalFrames = 3;     // Nombre total de frames
        this.currentFrame = 0;    // Frame actuelle
        this.frameInterval = 100; // Intervalle entre les frames en ms
        this.lastFrameTime = 0;
        
        // Calcul du scale pour adapter aux dimensions de la map (2000x1500)
        this.scaleX = 2000 / 3000;  // Pour passer de 3000 à 2000 en largeur
        this.scaleY = 1500 / 2000;  // Pour passer de 2000 à 1500 en hauteur
        
        this.opacity = 0.3;     
    }

    update(currentTime) {
        if (currentTime - this.lastFrameTime > this.frameInterval) {
            this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
            this.lastFrameTime = currentTime;
        }
    }

    draw(context, camera, mapWidth, mapHeight, canvas) {
        if (!this.spriteSheet.complete) return;

        context.save();
        context.globalAlpha = this.opacity;
        
        const translateX = Math.round(canvas.width / 2 - camera.x * camera.scale);
        const translateY = Math.round(canvas.height / 2 - camera.y * camera.scale);
        
        // Appliquer la transformation de la caméra et notre scale pour les dimensions
        context.setTransform(
            camera.scale * this.scaleX, 0,
            0, camera.scale * this.scaleY,
            translateX, translateY
        );
        
        context.drawImage(
            this.spriteSheet,
            this.currentFrame * this.frameWidth, 0,
            this.frameWidth, this.frameHeight,
            0, 0,
            this.frameWidth, this.frameHeight
        );
        
        context.restore();
    }
}

export class MapManager {
    constructor(canvas, options = {}) {
        if (!canvas) {
            throw new Error('Canvas is required for MapManager');
        }
        
        this.canvas = canvas;
        this.debugMode = options.debugMode || false;
        this.selectedMap = options.selectedMap || 'map1';
        this.mirrorMode = options.mirrorMode || false;
        
        // Récupérer les dimensions de la map sélectionnée
        const mapDimensions = MAP_DIMENSIONS[this.selectedMap];
        if (!mapDimensions) {
            throw new Error(`Dimensions non trouvées pour la map: ${this.selectedMap}`);
        }
    
        // Initialiser les dimensions avec celles spécifiques à la map
        this.mapWidth = mapDimensions.width;
        this.mapHeight = mapDimensions.height;
    
        console.log('Initialisation MapManager avec dimensions:', {
            map: this.selectedMap,
            width: this.mapWidth,
            height: this.mapHeight,
            mirrorMode: this.mirrorMode
        });
        
        this.layers = {
            background: new Image(),
            collision: new Image(),
            foreground: new Image()
        };
    
        this.mapImages = {
            background: new Image(),
            collision: new Image(),
            foreground: new Image()
        };
        
        // Construction du chemin en fonction de la map sélectionnée
        const basePath = `/assets/maps/${this.selectedMap}/${this.mirrorMode ? 'mirror' : 'normal'}`;
        
        // Configuration des images avec les bonnes dimensions
        Object.values(this.mapImages).forEach(img => {
            img.width = this.mapWidth;
            img.height = this.mapHeight;
        });
    
        this.mapImages.background.src = `${basePath}/background.png`;
        this.mapImages.collision.src = `${basePath}/collision.png`;
        this.mapImages.foreground.src = `${basePath}/foreground.png`;
    
        this.rainEffect = this.selectedMap === 'map1' ? new RainEffect(basePath) : null;
        
        this.collisionData = null;
        this.isLoaded = false;
        this.loadPromise = this.loadLayers();
    
        this.debugMode = options.debugMode || false;
        this.debugCollisions = options.debugCollisions || false;
    }

    async loadLayers() {
        try {
            const gameSettings = waitingRoom.settings || DEFAULT_GAME_SETTINGS;
            // Utiliser la propriété stockée de la classe
            const mapId = this.selectedMap;
            const mirrorMode = this.mirrorMode;
            
            const basePath = `/assets/maps/${mapId}/${mirrorMode ? 'mirror' : 'normal'}`;
            
            console.log('Chargement de la map:', {
                mapId: mapId,
                mirrorMode: mirrorMode,
                basePath: basePath
            });
            
            this.layers.background.src = `${basePath}/background.png`;
            this.layers.collision.src = `${basePath}/collision.png`;
            this.layers.foreground.src = `${basePath}/foreground.png`;

            // Mettre à jour l'effet de pluie en fonction de la map
            this.rainEffect = mapId === 'map1' ? new RainEffect(basePath) : null;

            // Vérifier que les chemins sont corrects
            console.log('Chemins des images:', {
                background: this.layers.background.src,
                collision: this.layers.collision.src,
                foreground: this.layers.foreground.src
            });

            await Promise.all([
                this.loadImage(this.layers.background),
                this.loadImage(this.layers.collision),
                this.loadImage(this.layers.foreground)
            ]);

            // Vérifier les dimensions après chargement
            console.log('Dimensions des images:', {
                background: `${this.layers.background.width}x${this.layers.background.height}`,
                collision: `${this.layers.collision.width}x${this.layers.collision.height}`,
                foreground: `${this.layers.foreground.width}x${this.layers.foreground.height}`
            });

            // Créer le canvas hors-écran pour la détection de collision
            await this.initializeCollisionData();
            
            this.isLoaded = true;
            return true;
        } catch (error) {
            console.error('Erreur lors du chargement des calques:', error);
            return false;
        }
    }

    loadImage(img) {
        return new Promise((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Erreur de chargement de l'image: ${img.src}`));
        });
    }

    async preloadMapImages() {
        return Promise.all(
            Object.values(this.mapImages).map(img => 
                new Promise((resolve, reject) => {
                    if (img.complete) resolve();
                    img.onload = resolve;
                    img.onerror = reject;
                })
            )
        );
    }

    async updateMap(selectedMap = 'map1', mirrorMode = false) {
        try {
            // Récupérer les dimensions spécifiques à la map
            const dimensions = MAP_DIMENSIONS[selectedMap];
            if (!dimensions) {
                throw new Error(`Dimensions non trouvées pour la map: ${selectedMap}`);
            }
    
            console.log('Mise à jour de la map avec dimensions:', dimensions);
    
            // Mettre à jour les dimensions
            this.mapWidth = dimensions.width;
            this.mapHeight = dimensions.height;
    
            // Mettre à jour les propriétés
            this.selectedMap = selectedMap;
            this.mirrorMode = mirrorMode;
    
            const basePath = `/assets/maps/${this.selectedMap}/${this.mirrorMode ? 'mirror' : 'normal'}`;
            this.rainEffect = this.selectedMap === 'map1' ? new RainEffect(basePath) : null;
    
            // Fonction helper pour charger une image et préserver ses dimensions natives
            const loadImageWithPromise = (imageSrc) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        // Vérifier que l'image chargée a les bonnes dimensions
                        if (img.width !== dimensions.width || img.height !== dimensions.height) {
                            console.warn(`Attention: L'image ${imageSrc} a des dimensions (${img.width}x${img.height}) différentes des dimensions attendues (${dimensions.width}x${dimensions.height})`);
                        }
                        resolve(img);
                    };
                    img.onerror = () => reject(new Error(`Échec du chargement de ${imageSrc}`));
                    img.src = imageSrc;
                });
            };
    
            // Charger toutes les couches en parallèle
            const [background, collision, foreground] = await Promise.all([
                loadImageWithPromise(`${basePath}/background.png`),
                loadImageWithPromise(`${basePath}/collision.png`),
                loadImageWithPromise(`${basePath}/foreground.png`)
            ]);
    
            // Une fois que tout est chargé, mettre à jour les layers
            this.layers.background = background;
            this.layers.collision = collision;
            this.layers.foreground = foreground;
    
            // Réinitialiser les données de collision avec les nouvelles dimensions
            await this.initializeCollisionData();
    
            console.log('Map mise à jour avec succès:', {
                map: selectedMap,
                dimensions: `${this.mapWidth}x${this.mapHeight}`,
                mirrorMode: mirrorMode
            });
    
            return true;
        } catch (error) {
            console.error('Erreur lors de la mise à jour de la map:', error);
            throw error;
        }
    }

    async initializeCollisionData() {
        // S'assurer d'utiliser les bonnes dimensions pour la map actuelle
        const dimensions = MAP_DIMENSIONS[this.selectedMap];
        const mapWidth = dimensions.width;
        const mapHeight = dimensions.height;
    
        // Créer un canvas hors-écran pour analyser l'image de collision
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = mapWidth;
        offscreenCanvas.height = mapHeight;
        
        const ctx = offscreenCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false; // Pour une meilleure détection des collisions
    
        // Dessiner l'image de collision avec ses dimensions natives
        ctx.drawImage(this.layers.collision, 0, 0, mapWidth, mapHeight);
        
        const imageData = ctx.getImageData(0, 0, mapWidth, mapHeight);
        
        // Créer le tableau de collision aux bonnes dimensions
        this.collisionData = new Array(mapHeight);
        for (let y = 0; y < mapHeight; y++) {
            this.collisionData[y] = new Array(mapWidth);
            for (let x = 0; x < mapWidth; x++) {
                const index = (y * mapWidth + x) * 4;
                const r = imageData.data[index];
                const g = imageData.data[index + 1];
                const b = imageData.data[index + 2];
                const isBlack = (r + g + b) / 3 < 128;
                this.collisionData[y][x] = isBlack;
            }
        }
    
        // Log de debug pour vérifier les dimensions
        console.log('Collision data initialized:', {
            map: this.selectedMap,
            width: mapWidth,
            height: mapHeight,
            hasCollisions: this.collisionData.some(row => row.some(cell => cell))
        });
    }

    // Vérifier la collision à une position donnée
    checkCollision(x, y) {
        if (!this.isLoaded || !this.collisionData) return false;
    
        const dimensions = MAP_DIMENSIONS[this.selectedMap];
        const mapWidth = dimensions.width;
        const mapHeight = dimensions.height;
    
        // Convertir les coordonnées du monde en indices du tableau
        const pixelX = Math.floor(x);
        const pixelY = Math.floor(y);
    
        // Vérifier les limites de la map
        if (pixelX < 0 || pixelX >= mapWidth || 
            pixelY < 0 || pixelY >= mapHeight) {
            return true; // Collision avec les bords de la map
        }
    
        // Retourner true s'il y a une collision (pixel noir)
        return this.collisionData[pixelY][pixelX];
    }

    canMove(fromX, fromY, toX, toY, radius = 16) {
        if (!this.collisionData) return false;
    
        const dimensions = MAP_DIMENSIONS[this.selectedMap];
        const mapWidth = dimensions.width;
        const mapHeight = dimensions.height;
    
        // Vérifier les limites de la map
        if (toX < 0 || toX >= mapWidth || 
            toY < 0 || toY >= mapHeight) {
            return false;
        }
    
        // Vérifier plusieurs points autour de l'entité
        const points = 8;
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const checkX = Math.floor(toX + Math.cos(angle) * radius);
            const checkY = Math.floor(toY + Math.sin(angle) * radius);
    
            // Vérifier que le point est dans les limites
            if (checkX < 0 || checkX >= mapWidth || 
                checkY < 0 || checkY >= mapHeight) {
                return false;
            }
    
            // Vérifier la collision
            if (this.collisionData[checkY][checkX]) {
                return false;
            }
        }
    
        return true;
    }

    // Dessiner les calques avec la caméra
    draw(context, camera) {
        if (!this.isLoaded) return;
        if (!this.canvas) {
            console.error('Canvas not initialized in MapManager');
            return;
        }
    
        const dimensions = MAP_DIMENSIONS[this.selectedMap];
        const mapWidth = dimensions.width;
        const mapHeight = dimensions.height;
    
        context.save();
        
        const translateX = Math.round(this.canvas.width / 2 - camera.x * camera.scale);
        const translateY = Math.round(this.canvas.height / 2 - camera.y * camera.scale);
        
        context.setTransform(
            camera.scale, 0,
            0, camera.scale,
            translateX, translateY
        );
    
        // Dessiner le fond
        context.drawImage(this.layers.background, 0, 0, mapWidth, mapHeight);
    
        // Dessiner l'effet de pluie si présent
        if (this.rainEffect) {
            this.rainEffect.update(Date.now());
            this.rainEffect.draw(context, camera, mapWidth, mapHeight, this.canvas);
        }
    
        // Debug : afficher le calque de collision
        if (this.debugMode) {
            context.globalAlpha = 0;
            context.drawImage(this.layers.collision, 0, 0, mapWidth, mapHeight);
            
            if (this.debugCollisions) {
                context.fillStyle = 'rgba(255, 0, 0, 0.5)';
                for (let y = 0; y < mapHeight; y += 32) {
                    for (let x = 0; x < mapWidth; x += 32) {
                        if (this.checkCollision(x, y)) {
                            context.fillRect(x - 2, y - 2, 4, 4);
                        }
                    }
                }
            }
            context.globalAlpha = 1;
        }
    
        context.restore();
    }
    
    drawForeground(context, camera) {
        if (!this.isLoaded) return;
        if (!this.canvas) {
            console.error('Canvas not initialized in MapManager');
            return;
        }
    
        const dimensions = MAP_DIMENSIONS[this.selectedMap];
        const mapWidth = dimensions.width;
        const mapHeight = dimensions.height;
    
        context.save();
    
        const translateX = Math.round(this.canvas.width / 2 - camera.x * camera.scale);
        const translateY = Math.round(this.canvas.height / 2 - camera.y * camera.scale);
        
        context.setTransform(
            camera.scale, 0,
            0, camera.scale,
            translateX, translateY
        );
    
        context.drawImage(this.layers.foreground, 0, 0, mapWidth, mapHeight);
        
        context.restore();
    }
    
    findValidPosition(radius = 16) {
        const dimensions = MAP_DIMENSIONS[this.selectedMap];
        const mapWidth = dimensions.width;
        const mapHeight = dimensions.height;
    
        const maxAttempts = 100;
        let attempts = 0;
    
        while (attempts < maxAttempts) {
            const x = Math.floor(Math.random() * mapWidth);
            const y = Math.floor(Math.random() * mapHeight);
    
            // Vérifier si la position est valide (pas de collision)
            if (this.canMove(x, y, x, y, radius)) {
                return { x, y };
            }
            attempts++;
        }
    
        console.warn('Impossible de trouver une position valide après', maxAttempts, 'tentatives');
        return { x: mapWidth / 2, y: mapHeight / 2 }; // Position par défaut
    }
}

// Export pour utilisation dans client.js
export default MapManager;