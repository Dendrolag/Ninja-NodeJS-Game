const { GAME_WIDTH, GAME_HEIGHT } = require('../constants');
const { getRandomColor } = require('../utils/colorUtils');

/**
 * @class Entity
 * @description Classe de base pour toutes les entités du jeu
 */
class Entity {
    /**
     * @constructor
     * @param {string} id - Identifiant unique de l'entité
     * @param {Object} options - Options de configuration
     * @param {string} [options.color] - Couleur de l'entité
     * @param {number} [options.x] - Position X initiale
     * @param {number} [options.y] - Position Y initiale
     */
    constructor(id, options = {}) {
        this.id = id;
        this.x = options.x ?? Math.random() * GAME_WIDTH;
        this.y = options.y ?? Math.random() * GAME_HEIGHT;
        this.color = options.color ?? getRandomColor();
        this.type = 'entity'; // Type de base
    }

    /**
     * @method update
     * @description Mise à jour de l'état de l'entité
     * @param {number} deltaTime - Temps écoulé depuis la dernière mise à jour
     */
    update(deltaTime) {
        // Méthode à surcharger dans les classes filles
    }

    /**
     * @method serialize
     * @description Convertit l'entité en objet simple pour l'envoi au client
     * @returns {Object} Représentation sérialisée de l'entité
     */
    serialize() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            color: this.color,
            type: this.type
        };
    }

    /**
     * @method setPosition
     * @description Définit la position de l'entité
     * @param {number} x - Nouvelle position X 
     * @param {number} y - Nouvelle position Y
     */
    setPosition(x, y) {
        this.x = Math.max(0, Math.min(GAME_WIDTH, x));
        this.y = Math.max(0, Math.min(GAME_HEIGHT, y));
    }

    /**
     * @method distanceTo
     * @description Calcule la distance à une autre entité
     * @param {Entity} entity - Entité cible
     * @returns {number} Distance euclidienne
     */
    distanceTo(entity) {
        const dx = this.x - entity.x;
        const dy = this.y - entity.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * @method isColliding
     * @description Vérifie si l'entité est en collision avec une autre
     * @param {Entity} entity - Entité à vérifier
     * @param {number} [threshold=20] - Distance de collision
     * @returns {boolean} Vrai si collision
     */
    isColliding(entity, threshold = 20) {
        return this.distanceTo(entity) < threshold;
    }
}

module.exports = Entity;