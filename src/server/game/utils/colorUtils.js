const { AVAILABLE_COLORS } = require('../constants');

/**
 * @file colorUtils.js
 * @description Utilitaires pour la gestion des couleurs
 */

/**
 * @function getRandomColor
 * @description Génère une couleur hexadécimale aléatoire
 * @returns {string} Code couleur hexadécimal
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

/**
 * @function getUniqueColor
 * @description Obtient une couleur unique non utilisée
 * @param {Set<string>} usedColors - Ensemble des couleurs déjà utilisées
 * @param {Array<string>} excludeColors - Couleurs à exclure
 * @returns {string} Couleur unique
 */
function getUniqueColor(usedColors = new Set(), excludeColors = []) {
    const forbiddenColors = new Set([...usedColors, ...excludeColors]);
    const availableColors = AVAILABLE_COLORS.filter(color => !forbiddenColors.has(color));

    if (availableColors.length > 0) {
        return availableColors[Math.floor(Math.random() * availableColors.length)];
    }

    // Si toutes les couleurs prédéfinies sont utilisées, générer une nouvelle couleur
    let newColor;
    do {
        newColor = getRandomColor();
    } while (forbiddenColors.has(newColor));
    
    return newColor;
}

module.exports = {
    getRandomColor,
    getUniqueColor
};