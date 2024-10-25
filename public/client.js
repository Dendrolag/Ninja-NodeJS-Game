// public/client.js

// Socket.io et variables globales
let socket;

// Éléments DOM
const mainMenu = document.getElementById('mainMenu');
const gameScreen = document.getElementById('gameScreen');
const startButton = document.getElementById('startButton');
const nicknameInput = document.getElementById('nicknameInput');
const settingsButton = document.getElementById('settingsButton');
const settingsMenu = document.getElementById('settingsMenu');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const backToMenuButton = document.getElementById('backToMenuButton');
const waitingRoomScreen = document.getElementById('waitingRoom');
const playersList = document.getElementById('waitingRoomPlayers');
const leaveRoomButton = document.getElementById('leaveRoomButton');
const startGameButton = document.getElementById('startGameButton');
const GAME_VIRTUAL_WIDTH = 2000;  // Taille virtuelle de la zone de jeu
const GAME_VIRTUAL_HEIGHT = 1500;
let camera = {
    x: 0,
    y: 0,
    scale: 1,
    targetX: 0,
    targetY: 0
};

// Éléments des paramètres
const enableSpeedBoostCheckbox = document.getElementById('enableSpeedBoost');
const speedBoostDurationInput = document.getElementById('speedBoostDuration');
const enableInvincibilityCheckbox = document.getElementById('enableInvincibility');
const invincibilityDurationInput = document.getElementById('invincibilityDuration');
const enableRevealCheckbox = document.getElementById('enableReveal');
const revealDurationInput = document.getElementById('revealDuration');
const initialBotCountInput = document.getElementById('initialBotCount');
const gameDurationInput = document.getElementById('gameDuration');
const enableSpecialZonesCheckbox = document.getElementById('enableSpecialZones');
const enableChaosZoneCheckbox = document.getElementById('enableChaosZone');
const enableRepelZoneCheckbox = document.getElementById('enableRepelZone');
const enableAttractZoneCheckbox = document.getElementById('enableAttractZone');
const enableStealthZoneCheckbox = document.getElementById('enableStealthZone');

// Éléments du jeu
const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('time');
const pauseButton = document.getElementById('pauseButton');
const collectedBonusDisplay = document.getElementById('collectedBonusDisplay');
const collectedBonusDisplayContent = document.getElementById('collectedBonusDisplayContent');
const activeBonusesContainer = document.getElementById('activeBonuses');
const playerListContainer = document.getElementById('players');

// Dimensions du jeu
let GAME_WIDTH = window.innerWidth;
let GAME_HEIGHT = window.innerHeight;

// Variables d'état du jeu
let entities = [];
let bonuses = [];
let playerId = null;
let playerNickname = null;
let timeRemaining = 180;
let playerColor = null;
let isPaused = false;
let isGameOver = false;
let keysPressed = {};
let specialZones = [];

// Variables pour les bonus
let speedBoostActive = false;
let invincibilityActive = false;
let revealActive = false;
let speedBoostTimeLeft = 0;
let invincibilityTimeLeft = 0;
let revealTimeLeft = 0;

// Position et vitesse du joueur
let playerX = 0;
let playerY = 0;
let playerSpeed = 8;
let showPlayerLocator = false;
let locatorFadeStartTime = 0;
const LOCATOR_DURATION = 2000; // Durée d'affichage de la flèche en millisecondes
const LOCATOR_FADE_DURATION = 500; // Durée du fade out en millisecondes

// Intervalle de la boucle de jeu
let gameLoopInterval;

// Paramètres du jeu par défaut
let gameSettings = {
    gameDuration: 180,
    enableSpeedBoost: true,
    speedBoostDuration: 5,
    enableInvincibility: true,
    invincibilityDuration: 5,
    enableReveal: true,
    revealDuration: 5,
    initialBotCount: 20,
    enableSpecialZones: true,
    enabledZones: {
        CHAOS: true,
        REPEL: true,
        ATTRACT: true,
        STEALTH: true
    }
};

function hasListeners(eventName) {
    return this.listeners(eventName).length > 0;
}

function initializeSocket(socket) {
    if (!socket.hasListeners) {
        socket.hasListeners = hasListeners;
    }
    return socket;
}

// Chargement des ressources
const modakRegular = new FontFace('Modak-Regular', 'url(/assets/fonts/Modak-Regular.ttf)');
modakRegular.load().then(function(loadedFont) {
    document.fonts.add(loadedFont);
}).catch(function(error) {
    console.error('Erreur de chargement de la police Modak-Regular:', error);
});

// Fonction pour mettre à jour la position de la caméra
function updateCamera() {
    if (!entities) return;
    
    const currentPlayer = entities.find(e => e.id === playerId);
    if (!currentPlayer) return;

    // Calculer les limites de la caméra
    const viewWidth = window.innerWidth / camera.scale;
    const viewHeight = window.innerHeight / camera.scale;
    const edgeMargin = 200; // Augmenter la marge pour une transition plus douce
    
    // Position cible idéale (centrée sur le joueur)
    camera.targetX = currentPlayer.x;
    camera.targetY = currentPlayer.y;

    // Limites de la caméra
    const leftLimit = viewWidth / 2;
    const rightLimit = GAME_VIRTUAL_WIDTH - viewWidth / 2;
    const topLimit = viewHeight / 2;
    const bottomLimit = GAME_VIRTUAL_HEIGHT - viewHeight / 2;

    // Appliquer les limites de manière stricte
    camera.targetX = Math.max(leftLimit, Math.min(rightLimit, camera.targetX));
    camera.targetY = Math.max(topLimit, Math.min(bottomLimit, camera.targetY));

    // Transition douce
    const smoothFactor = 0.06;
    camera.x += (camera.targetX - camera.x) * smoothFactor;
    camera.y += (camera.targetY - camera.y) * smoothFactor;

    // S'assurer que la caméra reste dans les limites
    camera.x = Math.max(leftLimit, Math.min(rightLimit, camera.x));
    camera.y = Math.max(topLimit, Math.min(bottomLimit, camera.y));
}

// Images des bonus
const bonusImages = {
    speed: new Image(),
    invincibility: new Image(),
    reveal: new Image()
};

// Chargement des images
bonusImages.speed.src = '/assets/images/speed.svg';
bonusImages.invincibility.src = '/assets/images/shield.svg';
bonusImages.reveal.src = '/assets/images/eye.svg';

// Image de fond
const backgroundImage = new Image();
backgroundImage.src = '/assets/images/background.jpg';

// Événements de redimensionnement
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    // Ajout des propriétés pour réduire le scintillement
    canvas.style.imageRendering = 'crisp-edges';
    canvas.style.backfaceVisibility = 'hidden';
    canvas.style.transform = 'translateZ(0)';  // Force l'accélération matérielle
    initializeCamera();
}

function initializeCamera() {
    // Réduire le scale pour un zoom plus adapté
    camera.scale = Math.min(
        window.innerWidth / 1500,  // Changer 1000 en 2000
        window.innerHeight / 1000  // Changer 750 en 1500
    );

    if (!camera.x || !camera.y) {
        camera.x = GAME_VIRTUAL_WIDTH / 2;
        camera.y = GAME_VIRTUAL_HEIGHT / 2;
    }
}

window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

// Gestion des panneaux d'aide
document.getElementById('closeInstructions').addEventListener('click', () => {
    const instructions = document.getElementById('instructions');
    instructions.classList.add('hidden');
    localStorage.setItem('instructionsHidden', 'true');
});

document.getElementById('closeControls').addEventListener('click', () => {
    const controls = document.getElementById('controls');
    controls.classList.add('hidden');
    localStorage.setItem('controlsHidden', 'true');
});

// Menu des paramètres
settingsButton.addEventListener('click', () => {
    mainMenu.classList.remove('active');
    settingsMenu.style.display = 'block';
});

saveSettingsButton.addEventListener('click', () => {
    gameSettings = {
        ...gameSettings,
        gameDuration: parseInt(gameDurationInput.value),
        enableSpeedBoost: enableSpeedBoostCheckbox.checked,
        speedBoostDuration: parseInt(speedBoostDurationInput.value),
        enableInvincibility: enableInvincibilityCheckbox.checked,
        invincibilityDuration: parseInt(invincibilityDurationInput.value),
        enableReveal: enableRevealCheckbox.checked,
        revealDuration: parseInt(revealDurationInput.value),
        initialBotCount: parseInt(initialBotCountInput.value),
        enableSpecialZones: enableSpecialZonesCheckbox.checked,
        enabledZones: {
            CHAOS: enableChaosZoneCheckbox.checked,
            REPEL: enableRepelZoneCheckbox.checked,
            ATTRACT: enableAttractZoneCheckbox.checked,
            STEALTH: enableStealthZoneCheckbox.checked
        }
    };

    // Mettre à jour également le timer affiché
    timeRemaining = gameSettings.gameDuration;
    timerDisplay.textContent = timeRemaining;

    settingsMenu.style.display = 'none';
    mainMenu.classList.add('active');
});

// gestion de l'activation/désactivation globale des zones
enableSpecialZonesCheckbox.addEventListener('change', (e) => {
    const zoneCheckboxes = [
        enableChaosZoneCheckbox,
        enableRepelZoneCheckbox,
        enableAttractZoneCheckbox,
        enableStealthZoneCheckbox
    ];
    
    zoneCheckboxes.forEach(checkbox => {
        checkbox.disabled = !e.target.checked;
    });
});

backToMenuButton.addEventListener('click', () => {
    settingsMenu.style.display = 'none';
    mainMenu.classList.add('active');
});

// Démarrage du jeu
startButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    if (nickname === '') {
        alert('Veuillez entrer un pseudo.');
        return;
    }
    playerNickname = nickname;
    
    // Au lieu de démarrer directement le jeu, on rejoint la salle d'attente
    mainMenu.classList.remove('active');
    waitingRoomScreen.classList.add('active');
    socket = initializeSocket(io());
    
    // Écouter les mises à jour de la salle d'attente
    socket.on('updateWaitingRoom', (players) => {
        updateWaitingRoomPlayers(players);
    });
    
    socket.on('gameStarting', () => {
        waitingRoomScreen.classList.remove('active');
        startGame();
    });
    
    // Rejoindre la salle d'attente
    socket.emit('joinWaitingRoom', nickname);
});

leaveRoomButton.addEventListener('click', () => {
    if (socket) {
        socket.emit('leaveWaitingRoom');
        socket.disconnect();
    }
    waitingRoomScreen.classList.remove('active');
    mainMenu.classList.add('active');
});

startGameButton.addEventListener('click', () => {
    socket.emit('startGameFromRoom', {
        nickname: playerNickname,
        settings: gameSettings,
        gameWidth: GAME_WIDTH,
        gameHeight: GAME_HEIGHT
    });
});

// Fonction pour mettre à jour la liste des joueurs
function updateWaitingRoomPlayers(players) {
    playersList.innerHTML = '';
    players.forEach(player => {
        const playerElement = document.createElement('li');
        playerElement.className = 'waiting-room-player';
        if (player.id === socket?.id) {
            playerElement.classList.add('current-player');
        }
        playerElement.textContent = player.nickname;
        playersList.appendChild(playerElement);
    });
    
    // Activer le bouton de démarrage uniquement pour le premier joueur qui a rejoint
    if (players.length > 0 && players[0].id === socket?.id) {
        startGameButton.disabled = false;
    } else {
        startGameButton.disabled = true;
    }
}

// Fonctions d'initialisation
function initializeHelpPanels() {
    const instructions = document.getElementById('instructions');
    const controls = document.getElementById('controls');

    if (localStorage.getItem('instructionsHidden') === 'true') {
        instructions.classList.add('hidden');
    } else {
        instructions.classList.remove('hidden');
    }

    if (localStorage.getItem('controlsHidden') === 'true') {
        controls.classList.add('hidden');
    } else {
        controls.classList.remove('hidden');
    }
}

function resetHelpPanels() {
    const instructions = document.getElementById('instructions');
    const controls = document.getElementById('controls');
    
    instructions.classList.remove('hidden');
    controls.classList.remove('hidden');
    
    localStorage.removeItem('instructionsHidden');
    localStorage.removeItem('controlsHidden');
}

// Gestion des entrées clavier
function handleKeyDown(event) {
    keysPressed[event.key] = true;

    // Touche pour localiser le joueur
    if (event.key.toLowerCase() === 'f' && !showPlayerLocator) {
        showPlayerLocator = true;
        locatorFadeStartTime = Date.now() + LOCATOR_DURATION - LOCATOR_FADE_DURATION;
        setTimeout(() => {
            showPlayerLocator = false;
        }, LOCATOR_DURATION);
    }
}

function handleKeyUp(event) {
    keysPressed[event.key] = false;
}

// Déplacement du joueur
function movePlayer() {
    if (isPaused || isGameOver) return;

    const baseSpeed = 3; // Vitesse de base fixe
    let move = { x: 0, y: 0 };

    if (keysPressed['ArrowUp'] || keysPressed['z']) move.y = -baseSpeed;
    if (keysPressed['ArrowDown'] || keysPressed['s']) move.y = baseSpeed;
    if (keysPressed['ArrowLeft'] || keysPressed['q']) move.x = -baseSpeed;
    if (keysPressed['ArrowRight'] || keysPressed['d']) move.x = baseSpeed;

    // Normaliser le mouvement diagonal
    if (move.x !== 0 && move.y !== 0) {
        const normalize = 1 / Math.sqrt(2);
        move.x *= normalize;
        move.y *= normalize;
    }

    if (move.x !== 0 || move.y !== 0) {
        // Envoyer le mouvement sans tenir compte du scale de la caméra
        socket.emit('move', move);
    }
}

function handlePauseClick() {
    if (!isPaused && !isGameOver) {
        socket.emit('togglePause');
    }
}

// Fonction de démarrage du jeu
function startGame() {
    isGameOver = false;
    isPaused = false;
    pauseButton.disabled = false;

    initializeCamera();

    // Réinitialiser les variables de localisation et d'état
    showPlayerLocator = false;
    locatorFadeStartTime = 0;
    keysPressed = {};
    playerColor = null;
    playerId = null;

    // Réinitialiser les bonus
    speedBoostActive = false;
    invincibilityActive = false;
    revealActive = false;
    playerSpeed = 3;  // Vitesse de base augmentée
    speedBoostTimeLeft = 0;
    invincibilityTimeLeft = 0;
    revealTimeLeft = 0;

    mainMenu.classList.remove('active');
    waitingRoomScreen.classList.remove('active');
    settingsMenu.style.display = 'none';
    gameScreen.classList.add('active');

    // Ne pas créer une nouvelle connexion si elle existe déjà
    if (!socket) {
        socket = initializeSocket(io());

        if (!socket.hasListeners) {
            socket.hasListeners = hasListeners;
        }
    }

    const duration = parseInt(gameDurationInput.value);
    timeRemaining = duration;

    socket.emit('startGame', {
        nickname: playerNickname,
        settings: {
            ...gameSettings,
            gameDuration: duration
        },
        gameWidth: GAME_VIRTUAL_WIDTH,  // Utiliser les dimensions virtuelles
        gameHeight: GAME_VIRTUAL_HEIGHT
    });

    if (!socket.hasListeners('connect')) {
        socket.on('connect', () => {
            playerId = socket.id;
        });
    }

    if (!socket.hasListeners('updateEntities')) {
        socket.on('updateEntities', (data) => {
            if (isPaused || isGameOver) return;
        
            entities = data.entities;
            timeRemaining = data.timeLeft;
            bonuses = data.bonuses || [];
            specialZones = data.zones || [];
        
            timerDisplay.textContent = timeRemaining;
        
            const currentPlayer = data.playerScores.find(p => p.id === socket.id);
            if (currentPlayer) {
                playerColor = currentPlayer.color;
                playerId = currentPlayer.id;
                const totalScore = currentPlayer.currentBots + currentPlayer.captures;
                scoreDisplay.textContent = `${currentPlayer.nickname}: ${totalScore} points`;
            }
        
            updatePlayerList(data.playerScores);
            drawEntities();
            updateActiveBonusesDisplay();
        });
    }

    if (!socket.hasListeners('playerCaptured')) {
        socket.on('playerCaptured', (data) => {
            playerColor = data.newColor;
            showCaptureNotification(`Capturé par ${data.capturedBy} !`);
            showPlayerLocator = true;
            locatorFadeStartTime = Date.now() + LOCATOR_DURATION - LOCATOR_FADE_DURATION;
            setTimeout(() => {
                showPlayerLocator = false;
            }, LOCATOR_DURATION);
        });
    }
    
    if (!socket.hasListeners('playerCapturedEnemy')) {
        socket.on('playerCapturedEnemy', (data) => {
            showCaptureNotification(`Vous avez capturé ${data.capturedNickname} !`);
        });
    }

    if (!socket.hasListeners('gameOver')) {
        socket.on('gameOver', (data) => {
            showGameOverModal(data.scores);
        });
    }

    if (!socket.hasListeners('activateBonus')) {
        socket.on('activateBonus', (data) => {
            const { type, duration } = data;
            switch (type) {
                case 'speed':
                    activateSpeedBoost(duration);
                    break;
                case 'invincibility':
                    activateInvincibility(duration);
                    break;
                case 'reveal':
                    activateReveal(duration);
                    break;
            }
            showBonusNotification(type);
        });
    }

    if (!socket.hasListeners('pauseGame')) {
        socket.on('pauseGame', (data) => {
            isPaused = true;
            pauseButton.disabled = socket.id !== data.pausedBy;
            showPauseOverlay();
        });
    }
    
    if (!socket.hasListeners('resumeGame')) {
        socket.on('resumeGame', () => {
            isPaused = false;
            pauseButton.disabled = false;
            hidePauseOverlay();
        });
    }

    // Nettoyer et réinitialiser les écouteurs d'événements
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Retirer l'ancien écouteur du bouton pause s'il existe
    pauseButton.removeEventListener('click', handlePauseClick);
    // Ajouter le nouvel écouteur
    pauseButton.addEventListener('click', handlePauseClick);

    // Créer un nouvel interval unique
    gameLoopInterval = setInterval(() => {
        movePlayer();
        updateBonusTimers();
        updateCamera();
    }, 20);

    initializeHelpPanels();
}


// Rendu du jeu
function drawEntities() {

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // Sauvegarder le contexte
    context.save();
    
    // Effacer le canvas avec une couleur de fond (évite le scintillement du fond)
    context.fillStyle = '#2c3e50';  // Couleur de fond par défaut
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Arrondir les positions de la caméra pour éviter le rendu sur des demi-pixels
    const cameraX = Math.round(camera.x);
    const cameraY = Math.round(camera.y);
    
    // Appliquer la transformation de la caméra
    context.translate(Math.round(canvas.width / 2), Math.round(canvas.height / 2));
    context.scale(camera.scale, camera.scale);
    context.translate(-cameraX, -cameraY);

    // Dessiner le fond
    if (backgroundImage.complete) {
        const pattern = context.createPattern(backgroundImage, 'repeat');
        if (pattern) {
            context.fillStyle = pattern;
            // Arrondir les positions pour le fond aussi
            const x = Math.round(0);
            const y = Math.round(0);
            const width = Math.round(GAME_VIRTUAL_WIDTH);
            const height = Math.round(GAME_VIRTUAL_HEIGHT);
            context.fillRect(x, y, width, height);
        }
    }

    // Dessiner les limites de la zone de jeu
    context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    context.lineWidth = 4;
    context.strokeRect(0, 0, GAME_VIRTUAL_WIDTH, GAME_VIRTUAL_HEIGHT);

    // Dessiner les zones spéciales
    if (specialZones) {
        specialZones.forEach(zone => {
            context.fillStyle = zone.type.color;
            context.strokeStyle = zone.type.borderColor;
            context.lineWidth = 2;

            if (zone.shape.type === 'circle') {
                context.beginPath();
                context.arc(zone.shape.x, zone.shape.y, zone.shape.radius, 0, Math.PI * 2);
                context.fill();
                context.stroke();
                
                context.fillStyle = 'white';
                context.font = '20px Chewy-Regular';
                context.textAlign = 'center';
                context.fillText(zone.type.name, zone.shape.x, zone.shape.y);
            } else {
                context.fillRect(zone.shape.x, zone.shape.y, zone.shape.width, zone.shape.height);
                context.strokeRect(zone.shape.x, zone.shape.y, zone.shape.width, zone.shape.height);
                
                context.fillStyle = 'white';
                context.font = '20px Chewy-Regular';
                context.textAlign = 'center';
                context.fillText(
                    zone.type.name,
                    zone.shape.x + zone.shape.width/2,
                    zone.shape.y + zone.shape.height/2
                );
            }
        });
    }

    // Flèche de localisation pour le joueur courant
    const currentPlayer = entities.find(e => e.id === playerId);
    if (showPlayerLocator && currentPlayer) {
        drawPlayerLocator(currentPlayer);
    }

    // Dessiner les entités
    entities.forEach(entity => {
        // Vérifier les zones de type STEALTH
        const isInInvisibilityZone = specialZones?.some(zone => {
            if (zone.type.id !== 'STEALTH') return false;

            if (zone.shape.type === 'circle') {
                return Math.hypot(entity.x - zone.shape.x, entity.y - zone.shape.y) <= zone.shape.radius;
            } else {
                return entity.x >= zone.shape.x && 
                       entity.x <= zone.shape.x + zone.shape.width &&
                       entity.y >= zone.shape.y && 
                       entity.y <= zone.shape.y + zone.shape.height;
            }
        });

        // Ne pas dessiner les joueurs invisibles (sauf le joueur local)
        if (isInInvisibilityZone && entity.type === 'player' && entity.id !== playerId) {
            return;
        }

        // Style spécial pour le joueur local en invisibilité
        if (isInInvisibilityZone && entity.id === playerId) {
            context.globalAlpha = 0.3;
        }

        context.shadowColor = 'rgba(0, 0, 0, 0.5)';
        context.shadowBlur = 4;
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 2;

        // Dessiner le contour noir
        context.beginPath();
        context.arc(entity.x, entity.y, 11, 0, 2 * Math.PI);
        context.fillStyle = 'black';
        context.fill();

        // Dessiner le cercle de couleur
        context.beginPath();
        context.arc(entity.x, entity.y, 10, 0, 2 * Math.PI);
        context.fillStyle = entity.color;
        context.fill();

        // Styles spéciaux pour le joueur actuel et les joueurs révélés
        if (entity.id === playerId) {
            context.lineWidth = 2;
            context.strokeStyle = '#FFD700';
            context.stroke();
            
            context.lineWidth = 1;
            context.strokeStyle = '#FFFFFF';
            context.stroke();
        } else if (revealActive && entity.type === 'player') {
            context.lineWidth = 2;
            context.strokeStyle = '#FF0000';
            context.stroke();
        }

        // Réinitialiser les paramètres
        context.shadowColor = 'transparent';
        context.shadowBlur = 0;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.globalAlpha = 1;
    });

    // Dessiner les bonus
    bonuses.forEach(bonus => {
        const image = bonusImages[bonus.type];
        if (image && image.complete) {
            const size = 30;
            context.drawImage(image, 
                bonus.x - size/2, 
                bonus.y - size/2, 
                size, 
                size
            );

            context.beginPath();
            context.arc(bonus.x, bonus.y, size/1.5, 0, Math.PI * 2);
            context.fillStyle = 'rgba(255, 255, 255, 0.2)';
            context.fill();
        }
    });

    // Restaurer le contexte
    context.restore();
}

// dessiner la flèche de localisation
function drawPlayerLocator(player) {
    const now = Date.now();
    let opacity = 1;
    
    // Calculer l'opacité pour le fade out
    if (now > locatorFadeStartTime) {
        opacity = 1 - (now - locatorFadeStartTime) / LOCATOR_FADE_DURATION;
        opacity = Math.max(0, Math.min(1, opacity));
    }

    context.save();
    
    // Dimensions de la flèche
    const arrowSize = 40;
    const bounceHeight = 20;
    const bounceSpeed = 0.004;
    const bounce = Math.sin(now * bounceSpeed) * bounceHeight;

    // Position de la flèche au-dessus du joueur
    const arrowY = player.y - 50 + bounce;

    // Déplacer au point d'origine
    context.translate(player.x, arrowY);
    
    // Rotation de 180 degrés pour pointer vers le bas
    context.rotate(Math.PI);

    // Dessiner la flèche
    context.beginPath();
    context.moveTo(0, -arrowSize/2);  // Pointe de la flèche
    context.lineTo(-arrowSize/3, arrowSize/2);  // Coin gauche
    context.lineTo(arrowSize/3, arrowSize/2);   // Coin droit
    context.closePath();

    // Remplir avec un dégradé
    const gradient = context.createLinearGradient(0, -arrowSize/2, 0, arrowSize/2);
    gradient.addColorStop(0, `rgba(255, 215, 0, ${opacity})`);
    gradient.addColorStop(1, `rgba(255, 140, 0, ${opacity})`);
    context.fillStyle = gradient;
    context.fill();

    // Contour de la flèche
    context.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
    context.lineWidth = 2;
    context.stroke();

    // Effet de brillance
    context.beginPath();
    context.arc(0, 0, 5, 0, Math.PI * 2);
    context.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    context.fill();

    context.restore();
}

// Gestion des bonus
function activateSpeedBoost(duration) {
    speedBoostActive = true;
    speedBoostTimeLeft += duration;
    playerSpeed = 6;
}

function activateInvincibility(duration) {
    invincibilityActive = true;
    invincibilityTimeLeft += duration;
}

function activateReveal(duration) {
    revealActive = true;
    revealTimeLeft += duration;
}

function updateBonusTimers() {
    const deltaTime = 0.02;
    let bonusesChanged = false;

    if (speedBoostActive) {
        speedBoostTimeLeft -= deltaTime;
        if (speedBoostTimeLeft <= 0) {
            speedBoostActive = false;
            playerSpeed = 3;
            speedBoostTimeLeft = 0;
            bonusesChanged = true;
        }
    }

    if (invincibilityActive) {
        invincibilityTimeLeft -= deltaTime;
        if (invincibilityTimeLeft <= 0) {
            invincibilityActive = false;
            invincibilityTimeLeft = 0;
            bonusesChanged = true;
        }
    }

    if (revealActive) {
        revealTimeLeft -= deltaTime;
        if (revealTimeLeft <= 0) {
            revealActive = false;
            revealTimeLeft = 0;
            bonusesChanged = true;
        }
    }

    if (bonusesChanged) {
        updateActiveBonusesDisplay();
    }
}

function updateActiveBonusesDisplay() {
    activeBonusesContainer.innerHTML = '';

    if (speedBoostActive) {
        activeBonusesContainer.appendChild(
            createActiveBonusElement('speed', speedBoostTimeLeft)
        );
    }
    if (invincibilityActive) {
        activeBonusesContainer.appendChild(
            createActiveBonusElement('invincibility', invincibilityTimeLeft)
        );
    }
    if (revealActive) {
        activeBonusesContainer.appendChild(
            createActiveBonusElement('reveal', revealTimeLeft)
        );
    }
}

function createActiveBonusElement(type, timeLeft) {
    const bonusDiv = document.createElement('div');
    bonusDiv.className = 'activeBonus';

    const img = document.createElement('img');
    img.src = bonusImages[type].src;
    img.alt = getBonusName(type);

    const timerSpan = document.createElement('span');
    timerSpan.className = 'timer';
    timerSpan.textContent = `${Math.ceil(timeLeft)}s`;

    bonusDiv.appendChild(img);
    bonusDiv.appendChild(timerSpan);

    return bonusDiv;
}

function getBonusName(bonusType) {
    switch (bonusType) {
        case 'speed': return 'Boost';
        case 'invincibility': return 'Invincibilité';
        case 'reveal': return 'Révélation';
        default: return '';
    }
}

// Mise à jour de la liste des joueurs
function updatePlayerList(playerScores) {
    playerListContainer.innerHTML = '';
    
    playerScores.forEach((player, index) => {
        const li = document.createElement('li');
        if (player.id === playerId) {
            li.className = 'current-player';
        }

        // Calcul du score total (bots actuels + captures)
        const totalScore = player.currentBots + player.captures;

        li.innerHTML = `
            <div class="player-rank">#${index + 1}</div>
            <div class="player-info">
                <div class="player-name">${player.nickname}</div>
                <div class="player-score">${totalScore}</div>
            </div>
        `;

        playerListContainer.appendChild(li);
    });
}

// Gestion des notifications et modales
function showBonusNotification(bonusType) {
    collectedBonusDisplayContent.textContent = getBonusName(bonusType);
    collectedBonusDisplay.classList.remove('hidden');

    setTimeout(() => {
        collectedBonusDisplay.classList.add('hidden');
    }, 3000);
}

function showGameOverModal(scores) {
    isGameOver = true;
    isPaused = true;
    pauseButton.disabled = true;

    const modal = document.createElement('div');
    modal.className = 'modal game-over-modal';

    const content = document.createElement('div');
    content.className = 'modal-content game-over-content';

    // En-tête
    content.innerHTML = '<h2 class="game-over-title">Fin de partie !</h2>';

    // Podium
    const topThree = scores.slice(0, 3);
    let podiumHTML = '<div class="podium-container">';

    // Positions sur le podium (2e, 1er, 3e)
    const positions = [
        { index: 1, className: 'second', symbol: '🥈' },
        { index: 0, className: 'first', symbol: '👑' },
        { index: 2, className: 'third', symbol: '🥉' }
    ];

    positions.forEach(pos => {
        if (topThree[pos.index]) {
            const player = topThree[pos.index];
            podiumHTML += `
                <div class="podium-place ${pos.className}">
                    <div class="podium-symbol">${pos.symbol}</div>
                    <div class="player-name">${player.nickname}</div>
                    <div class="podium-block">
                        <div class="score">${player.currentBots}</div>
                    </div>
                    <div class="player-stats">
                        <div class="total-bots">🤖 ${player.totalBotsControlled} bots capturés</div>
                        <div class="total-players">👥 ${player.captures} joueurs capturés</div>
                    </div>
                </div>`;
        }
    });

    podiumHTML += '</div>';
    content.innerHTML += podiumHTML;

    // Statistiques détaillées
    content.innerHTML += `
        <div class="detailed-stats">
            <h3>Statistiques détaillées</h3>
            <div class="stats-list">
    `;

    scores.forEach((player, index) => {
        const capturedPlayersHTML = Object.values(player.capturedPlayers)
            .map(cap => `${cap.nickname} (${cap.count}x)`)
            .join(', ') || 'Aucun joueur capturé';

        const capturedByHTML = Object.values(player.capturedBy)
            .map(cap => `${cap.nickname} (${cap.count}x)`)
            .join(', ') || 'Jamais capturé';

        content.innerHTML += `
            <div class="player-stats-card ${player.id === playerId ? 'current-player' : ''}">
                <div class="player-header">
                    <span class="rank">#${index + 1}</span>
                    <span class="player-name">${player.nickname}</span>
                </div>
                <div class="stats-details">
                    <div>🤖 Bots contrôlés: ${player.currentBots}</div>
                    <div>💪 Total bots capturés: ${player.totalBotsControlled}</div>
                    <div>👥 Joueurs capturés: ${capturedPlayersHTML}</div>
                    <div>💀 Capturé par: ${capturedByHTML}</div>
                </div>
            </div>
        `;
    });

    content.innerHTML += `
            </div>
        </div>
    `;

    // Boutons
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'game-over-buttons';

    const replayButton = document.createElement('button');
    replayButton.className = 'primary-button';
    replayButton.textContent = 'Rejouer';
    replayButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        restartGame();
    });

    const mainMenuButton = document.createElement('button');
    mainMenuButton.className = 'secondary-button';
    mainMenuButton.textContent = 'Menu Principal';
    mainMenuButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        returnToMainMenu();
    });

    buttonsDiv.appendChild(replayButton);
    buttonsDiv.appendChild(mainMenuButton);
    content.appendChild(buttonsDiv);

    modal.appendChild(content);
    document.body.appendChild(modal);
}

function showCaptureNotification(message) {
    collectedBonusDisplayContent.textContent = message;
    collectedBonusDisplay.classList.remove('hidden');

    setTimeout(() => {
        collectedBonusDisplay.classList.add('hidden');
    }, 3000);
}

function showCaptureModal(capturedNickname) {
    const modal = document.createElement('div');
    modal.className = 'modal';

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.innerHTML = `
        <h2>Vous avez capturé ${capturedNickname} !</h2>
        <button class="modal-button primary-button">OK</button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    const button = content.querySelector('.modal-button');
    button.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

function showPauseOverlay() {
    hidePauseOverlay(); // Nettoyer toute modale existante

    const modal = document.createElement('div');
    modal.className = 'modal pause-modal';
    modal.id = 'pause-modal';

    const content = document.createElement('div');
    content.className = 'modal-content pause-content';
    
    // Afficher des boutons différents selon qui a mis en pause
    const isCurrentPlayerPaused = !pauseButton.disabled;
    
    content.innerHTML = `
        <h2>Jeu en pause</h2>
        <div class="pause-buttons">
            ${isCurrentPlayerPaused ? 
                `<button class="primary-button" id="resumeButton">Reprendre</button>
                 <button class="secondary-button" id="returnMenuButton">Menu Principal</button>` 
                : 
                `<p>En attente de la reprise...</p>`
            }
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // N'ajouter les écouteurs que si c'est le joueur qui a mis en pause
    if (isCurrentPlayerPaused) {
        document.getElementById('resumeButton').addEventListener('click', () => {
            socket.emit('togglePause');
        });

        document.getElementById('returnMenuButton').addEventListener('click', () => {
            hidePauseOverlay();
            returnToMainMenu();
        });
    }
}

function hidePauseOverlay() {
    const modal = document.getElementById('pause-modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

function restartGame() {
    isGameOver = false;
    isPaused = false;
    pauseButton.disabled = false;

    speedBoostActive = false;
    invincibilityActive = false;
    revealActive = false;
    playerSpeed = 3;

    speedBoostTimeLeft = 0;
    invincibilityTimeLeft = 0;
    revealTimeLeft = 0;

    socket.emit('startGame', {
        nickname: playerNickname,
        settings: {
            ...gameSettings,
            gameDuration: parseInt(gameDurationInput.value) // Assurons-nous que la durée est bien envoyée
        },
        gameWidth: GAME_WIDTH,
        gameHeight: GAME_HEIGHT
    });
}

function returnToMainMenu() {
    showPlayerLocator = false;
    // Fermer la modale de pause si elle est ouverte
    hidePauseOverlay();
    
    // Réinitialiser les états du jeu
    isGameOver = false;
    isPaused = false;
    pauseButton.disabled = false;

    // Déconnecter le socket
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    // Réinitialiser les bonus
    speedBoostActive = false;
    invincibilityActive = false;
    revealActive = false;
    playerSpeed = 3;

    speedBoostTimeLeft = 0;
    invincibilityTimeLeft = 0;
    revealTimeLeft = 0;

    // Nettoyer les événements
    keysPressed = {};

    // Arrêter la boucle de jeu
    if (gameLoopInterval) {
        clearInterval(gameLoopInterval);
    }

    // Définir un seul gameLoop
    function gameLoop() {
        if (!isPaused && !isGameOver) {
            movePlayer();
            updateBonusTimers();
            updateCamera();
        }
    }

    // Créer l'interval
    gameLoopInterval = setInterval(gameLoop, 20);

    // Réinitialiser les panneaux d'aide
    resetHelpPanels();

    // Retirer les écouteurs d'événements
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);

    // Nettoyer l'interface
    activeBonusesContainer.innerHTML = '';
    playerListContainer.innerHTML = '';
    collectedBonusDisplay.classList.add('hidden');

    // Masquer l'écran de jeu et afficher le menu
    gameScreen.classList.remove('active');
    mainMenu.classList.add('active');
}

function handleKeyDown(event) {
    keysPressed[event.key] = true;
    console.log('Touche pressée:', event.key, keysPressed);  // Debug

    // Touche pour localiser le joueur
    if (event.key.toLowerCase() === 'f' && !showPlayerLocator) {
        showPlayerLocator = true;
        locatorFadeStartTime = Date.now() + LOCATOR_DURATION - LOCATOR_FADE_DURATION;
        setTimeout(() => {
            showPlayerLocator = false;
        }, LOCATOR_DURATION);
    }
}