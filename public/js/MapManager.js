import { DEFAULT_GAME_SETTINGS } from './game-constants.js';

// MapManager.js
export class MapManager {
    constructor(canvas, options = {}) {
        if (!canvas) {
            throw new Error('Canvas is required for MapManager');
        }
        
        this.canvas = canvas;
        this.debugMode = options.debugMode || false;
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
        // Récupérer la map sélectionnée ou utiliser map1 par défaut
        const selectedMap = options.selectedMap || 'map1';
        const mirrorMode = options.mirrorMode || false;
        
        // Construction du chemin en fonction de la map sélectionnée
        const basePath = `/assets/maps/${selectedMap}/${mirrorMode ? 'mirror' : 'normal'}`;
        
        this.mapImages.background.src = `${basePath}/background.png`;
        this.mapImages.collision.src = `${basePath}/collision.png`;
        this.mapImages.foreground.src = `${basePath}/foreground.png`;
        
        // Récupérer les dimensions depuis les options
        this.mapWidth = options.mapWidth || 2000;
        this.mapHeight = options.mapHeight || 1500;
        
        this.collisionData = null;
        this.isLoaded = false;
        this.loadPromise = this.loadLayers();

        this.debugMode = options.debugMode || false;
        this.debugCollisions = options.debugCollisions || false;
    }

    async loadLayers() {
        try {
            const gameSettings = waitingRoom.settings || DEFAULT_GAME_SETTINGS;
            const mapId = gameSettings.selectedMap || 'map1'; // au lieu de 'tokyo'
            const mirrorMode = gameSettings.mirrorMode || false;
            
            const basePath = `/assets/maps/${mapId}/${mirrorMode ? 'mirror' : 'normal'}`;
            
            console.log('Chargement de la map:', {
                mapId: mapId,
                mirrorMode: mirrorMode,
                basePath: basePath
            });
            
            this.layers.background.src = `${basePath}/background.png`;
            this.layers.collision.src = `${basePath}/collision.png`;
            this.layers.foreground.src = `${basePath}/foreground.png`;

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
            // Utiliser les valeurs par défaut si undefined
            selectedMap = selectedMap || 'map1';
            mirrorMode = mirrorMode ?? false;
    
            console.log('Début de la mise à jour de la map:', {
                selectedMap,
                mirrorMode,
                mapManagerExists: !!this
            });
    
            const basePath = `/assets/maps/${selectedMap}/${mirrorMode ? 'mirror' : 'normal'}`;
    
            // Créer des promesses pour le chargement des images
            const loadPromises = [];
    
            // Fonction helper pour charger une image
            const loadImageWithPromise = (imageSrc) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
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
    
            // Réinitialiser les données de collision
            await this.initializeCollisionData();
    
            console.log('Map mise à jour avec succès');
            return true;
        } catch (error) {
            console.error('Erreur lors de la mise à jour de la map:', error);
            throw error;
        }
    }

    async initializeCollisionData() {
        // Créer un canvas hors-écran pour analyser l'image de collision
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = this.mapWidth;
        offscreenCanvas.height = this.mapHeight;
        
        const ctx = offscreenCanvas.getContext('2d');
        ctx.drawImage(this.layers.collision, 0, 0, this.mapWidth, this.mapHeight);
        
        const imageData = ctx.getImageData(0, 0, this.mapWidth, this.mapHeight);
        
        // Créer le tableau de collision
        this.collisionData = new Array(this.mapHeight);
        for (let y = 0; y < this.mapHeight; y++) {
            this.collisionData[y] = new Array(this.mapWidth);
            for (let x = 0; x < this.mapWidth; x++) {
                const index = (y * this.mapWidth + x) * 4;
                const r = imageData.data[index];
                const g = imageData.data[index + 1];
                const b = imageData.data[index + 2];
                const isBlack = (r + g + b) / 3 < 128;
                this.collisionData[y][x] = isBlack;
            }
        }
    
        // Debug log pour vérifier que les collisions sont bien détectées
        console.log('Collision data initialized:', {
            samplePoint: this.collisionData[0][0],
            hasCollisions: this.collisionData.some(row => row.some(cell => cell))
        });
    }

    // Vérifier la collision à une position donnée
    checkCollision(x, y) {
        if (!this.isLoaded || !this.collisionData) return false;

        // Convertir les coordonnées du monde en indices du tableau
        const pixelX = Math.floor(x);
        const pixelY = Math.floor(y);
    
        // Vérifier les limites de la map
        if (pixelX < 0 || pixelX >= this.mapWidth || 
            pixelY < 0 || pixelY >= this.mapHeight) {
            return true; // Collision avec les bords de la map
        }
    
        // Retourner true s'il y a une collision (pixel noir)
        return this.collisionData[pixelY][pixelX];
    }

    // Vérifier si un mouvement est valide
    canMove(fromX, fromY, toX, toY, radius = 16) {
    // Vérifier le point central d'abord
    if (this.checkCollision(toX, toY)) {
        return false;
    }

    // Vérifier plusieurs points autour de l'entité
    const points = 8;
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const checkX = toX + Math.cos(angle) * radius;
        const checkY = toY + Math.sin(angle) * radius;

        if (this.checkCollision(checkX, checkY)) {
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

        context.save();
    
        // Appliquer la transformation de la caméra
        const translateX = Math.round(this.canvas.width / 2 - camera.x * camera.scale);
        const translateY = Math.round(this.canvas.height / 2 - camera.y * camera.scale);
        
        context.setTransform(
            camera.scale, 0,
            0, camera.scale,
            translateX, translateY
        );
    
        // Dessiner le fond avec des dimensions fixes
        context.drawImage(this.layers.background, 0, 0, this.mapWidth, this.mapHeight);
    
        // Debug : afficher le calque de collision
        if (this.debugMode) {
            // Dessiner le calque de collision en semi-transparent
            context.globalAlpha = 0;
            context.drawImage(this.layers.collision, 0, 0, this.mapWidth, this.mapHeight);
            
            if (this.debugCollisions) {
                // Visualiser les points de collision
                context.fillStyle = 'rgba(255, 0, 0, 0.5)';
                for (let y = 0; y < this.mapHeight; y += 32) {
                    for (let x = 0; x < this.mapWidth; x += 32) {
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

    // Dessiner le calque de premier plan (à appeler après avoir dessiné toutes les entités)
    drawForeground(context, camera) {
        if (!this.isLoaded) return;
        if (!this.canvas) {
            console.error('Canvas not initialized in MapManager');
            return;
        }

        context.save();
    
        const translateX = Math.round(this.canvas.width / 2 - camera.x * camera.scale);
        const translateY = Math.round(this.canvas.height / 2 - camera.y * camera.scale);
        
        context.setTransform(
            camera.scale, 0,
            0, camera.scale,
            translateX, translateY
        );
    
        context.drawImage(this.layers.foreground, 0, 0, this.mapWidth, this.mapHeight);
        
        context.restore();
    }
    findValidPosition(radius = 16) {
        const maxAttempts = 100;
        let attempts = 0;
    
        while (attempts < maxAttempts) {
            const x = Math.floor(Math.random() * this.mapWidth);
            const y = Math.floor(Math.random() * this.mapHeight);
    
            // Vérifier si la position est valide (pas de collision)
            if (this.canMove(x, y, x, y, radius)) {
                return { x, y };
            }
            attempts++;
        }
    
        console.warn('Impossible de trouver une position valide après', maxAttempts, 'tentatives');
        return { x: this.mapWidth / 2, y: this.mapHeight / 2 }; // Position par défaut
    }
}

// Export pour utilisation dans client.js
export default MapManager;