// public/client.js

// Socket.io et variables globales
let socket;

// Éléments DOM principaux
const mainMenu = document.getElementById('mainMenu');
const gameScreen = document.getElementById('gameScreen');
const nicknameInput = document.getElementById('nicknameInput');

// Menu des paramètres et ses éléments
const settingsMenu = document.getElementById('settingsMenu');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const backToMenuButton = document.getElementById('backToMenuButton');
const resetSettingsButton = document.getElementById('resetSettingsButton');

// Éléments de la salle d'attente
const waitingRoomScreen = document.getElementById('waitingRoom');
const playersList = document.getElementById('waitingRoomPlayers');
const startGameButton = document.getElementById('startGameButton');
const settingsButton = document.getElementById('waitingRoomSettings'); // Un seul bouton de paramètres
const leaveRoomButton = document.getElementById('leaveRoomButton');

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
const enableBlackBotCheckbox = document.getElementById('enableBlackBot');
const blackBotCountInput = document.getElementById('blackBotCount');
const bonusSpawnIntervalInput = document.getElementById('bonusSpawnInterval');
const speedBoostSpawnRateInput = document.getElementById('speedBoostSpawnRate');
const invincibilitySpawnRateInput = document.getElementById('invincibilitySpawnRate');
const revealSpawnRateInput = document.getElementById('revealSpawnRate');

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

// constantes pour les effets des bonus
const BONUS_EFFECTS = {
    speed: {
        color: '#00ff00',      // Vert vif pour la vitesse
        glowSize: 20,
        pulseSpeed: 0.006,
        name: 'Boost',
        backgroundColor: 'rgba(0, 255, 0, 0.2)',  // Fond semi-transparent
        borderColor: 'rgba(0, 255, 0, 0.6)'       // Bordure plus visible
    },
    invincibility: {
        color: '#ffd700',      // Or pour l'invincibilité
        glowSize: 25,
        pulseSpeed: 0.004,
        name: 'Invincibilité',
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
        borderColor: 'rgba(255, 215, 0, 0.6)'
    },
    reveal: {
        color: '#ff00ff',      // Magenta pour la révélation
        glowSize: 15,
        pulseSpeed: 0.005,
        name: 'Révélation',
        backgroundColor: 'rgba(255, 0, 255, 0.2)',
        borderColor: 'rgba(255, 0, 255, 0.6)'
    }
};

// Ajouter ces styles CSS pour les boutons
const additionalStyles = `
.game-over-buttons {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-top: 20px;
}

.game-over-buttons button {
    min-width: 180px;
    padding: 12px 20px;
}

.game-over-buttons button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
`;

// Ajouter les styles au document
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
document.addEventListener('DOMContentLoaded', initializeNicknameValidation);

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
let isRoomOwner = false;

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
    speedBoostDuration: 10,
    enableInvincibility: true,
    invincibilityDuration: 10,
    enableReveal: true,
    revealDuration: 10,
    initialBotCount: 30,
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

function initializeNicknameValidation() {
    const nicknameInput = document.getElementById('nicknameInput');
    const startButton = document.getElementById('startButton');

    // Fonction pour vérifier et mettre à jour l'état du bouton
    function updateButtonState() {
        const nickname = nicknameInput.value.trim();
        startButton.disabled = nickname === '';
    }

    // Écouter les changements dans l'input
    nicknameInput.addEventListener('input', updateButtonState);
    nicknameInput.addEventListener('change', updateButtonState);

    // État initial
    updateButtonState();
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
    if (!entities || !playerId) return;

    // Trouver le joueur actuel, en s'assurant qu'il s'agit bien d'une entité de type 'player'
    const myPlayer = entities.find(e => e.id === playerId && e.type === 'player');
    if (!myPlayer) {
        console.log("Player not found:", playerId); // Debug log
        return;
    }

    // Calculer les limites de la caméra
    const viewWidth = canvas.width / camera.scale;
    const viewHeight = canvas.height / camera.scale;

    // Calculer la position cible (centrée sur le joueur avec limites)
    const targetX = Math.max(
        viewWidth / 2,
        Math.min(GAME_VIRTUAL_WIDTH - viewWidth / 2, myPlayer.x)
    );
    const targetY = Math.max(
        viewHeight / 2,
        Math.min(GAME_VIRTUAL_HEIGHT - viewHeight / 2, myPlayer.y)
    );

    // Transition douce
    const smoothness = 0.1;
    camera.x += (targetX - camera.x) * smoothness;
    camera.y += (targetY - camera.y) * smoothness;

    // S'assurer que la caméra reste dans les limites
    camera.x = Math.max(viewWidth / 2, Math.min(GAME_VIRTUAL_WIDTH - viewWidth / 2, camera.x));
    camera.y = Math.max(viewHeight / 2, Math.min(GAME_VIRTUAL_HEIGHT - viewHeight / 2, camera.y));
}

// Ajouter une fonction de debug pour suivre le problème
/*function logCameraDebug() {
    const myPlayer = entities?.find(e => e.type === 'player' && e.id === playerId);
    console.log('Camera Debug:', {
        playerId,
        playerFound: !!myPlayer,
        playerPosition: myPlayer ? { x: myPlayer.x, y: myPlayer.y } : null,
        cameraPosition: { x: camera.x, y: camera.y },
        cameraTarget: { x: camera.targetX, y: camera.targetY }
    });
}

// Appeler le debug toutes les secondes
setInterval(logCameraDebug, 1000);*/

// Fonction de réinitialisation des paramètres
function resetSettings() {
    if (isRoomOwner) {
        // Envoyer une demande de réinitialisation au serveur
        socket.emit('resetGameSettings');
    }
}

resetSettingsButton.addEventListener('click', resetSettings);

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
    if (isRoomOwner) {
        const newSettings = {
            gameDuration: parseInt(gameDurationInput.value),
            speedBoostDuration: parseInt(speedBoostDurationInput.value),
            invincibilityDuration: parseInt(invincibilityDurationInput.value),
            revealDuration: parseInt(revealDurationInput.value),
            initialBotCount: parseInt(initialBotCountInput.value),
            enableSpecialZones: enableSpecialZonesCheckbox.checked,
            enabledZones: {
                CHAOS: enableChaosZoneCheckbox.checked,
                REPEL: enableRepelZoneCheckbox.checked,
                ATTRACT: enableAttractZoneCheckbox.checked,
                STEALTH: enableStealthZoneCheckbox.checked
            },
            enableBlackBot: enableBlackBotCheckbox.checked,
            blackBotCount: parseInt(blackBotCountInput.value),

            bonusSpawnInterval: parseInt(bonusSpawnIntervalInput.value),
            
            enableSpeedBoost: enableSpeedBoostCheckbox.checked,
            speedBoostDuration: parseInt(speedBoostDurationInput.value),
            speedBoostSpawnRate: parseInt(speedBoostSpawnRateInput.value),

            enableInvincibility: enableInvincibilityCheckbox.checked,
            invincibilityDuration: parseInt(invincibilityDurationInput.value),
            invincibilitySpawnRate: parseInt(invincibilitySpawnRateInput.value),

            enableReveal: enableRevealCheckbox.checked,
            revealDuration: parseInt(revealDurationInput.value),
            revealSpawnRate: parseInt(revealSpawnRateInput.value),
        };

        socket.emit('updateGameSettings', newSettings);
    }
    
    settingsMenu.style.display = 'none';
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

    // Initialiser le chat après la connexion socket
    socket.on('connect', () => {
        console.log('Socket connected, initializing chat...');
        initializeChat(socket); // Passer le socket en paramètre
    });

    // écouteur pour les mises à jour des paramètres
    socket.on('gameSettingsUpdated', (settings) => {
        // Mettre à jour l'interface
        updateSettingsUI(settings);
        // Mettre à jour les paramètres locaux
        gameSettings = settings;
    });
    
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

settingsButton.addEventListener('click', () => {
    settingsMenu.style.display = 'block';
});

leaveRoomButton.addEventListener('click', () => {
    if (socket) {
        socket.emit('leaveWaitingRoom');
        socket.disconnect();
    }
    settingsMenu.style.display = 'none'; // Cacher les paramètres si ouverts
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

// Fonction d'initialisation du chat
function initializeChat(socket) {
    const chatHeader = document.querySelector('.chat-header');
    const chatBox = document.querySelector('.floating-chat');
    const chatMessages = document.querySelector('.chat-messages');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const toggleIcon = document.querySelector('.toggle-icon');

    // Gestion du toggle
    chatHeader.addEventListener('click', () => {
        chatBox.classList.toggle('collapsed');
        // Mise à jour de l'icône
        if (chatBox.classList.contains('collapsed')) {
            toggleIcon.textContent = '▶';
        } else {
            toggleIcon.textContent = '◀';
        }
    });

    // Gestion des messages
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        
        if (message) {
            socket.emit('chatMessage', {
                message: message,
                nickname: playerNickname,
                timestamp: Date.now()
            });
            
            chatInput.value = '';
            chatInput.focus();
            
            // Déplier le chat si replié
            if (chatBox.classList.contains('collapsed')) {
                chatBox.classList.remove('collapsed');
                toggleIcon.textContent = '◀';
            }
        }
    });

    // Réception des messages
    socket.on('newChatMessage', (messageData) => {
        const messageElement = createChatMessage(messageData);
        chatMessages.appendChild(messageElement);
        // Scroll vers le bas
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

function createChatMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    if (data.nickname === playerNickname) {
        messageDiv.classList.add('own-message');
    }
    
    const header = document.createElement('div');
    header.className = 'chat-message-header';
    
    const author = document.createElement('span');
    author.className = 'chat-message-author';
    author.textContent = data.nickname;
    
    const time = document.createElement('span');
    time.className = 'chat-message-time';
    time.textContent = new Date(data.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const content = document.createElement('div');
    content.className = 'chat-message-content';
    content.textContent = data.message;
    
    header.appendChild(author);
    header.appendChild(time);
    messageDiv.appendChild(header);
    messageDiv.appendChild(content);
    
    return messageDiv;
}

// Fonction pour ajouter un message au chat
function addChatMessage(messageData) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        console.error('Chat messages container not found!');
        return;
    }
    
    const messageElement = createChatMessage(messageData);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Fonction pour formater l'heure
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Fonction pour mettre à jour la liste des joueurs
function updateWaitingRoomPlayers(players) {
    playersList.innerHTML = '';
    console.log('Updating waiting room players:', JSON.stringify(players, null, 2)); // Log plus détaillé
    console.log('Current socket id:', socket?.id);

    // Vérifier si on est le premier joueur
    if (players.length > 0) {
        const firstPlayer = players[0];
        // Mettre à jour isRoomOwner si on est le premier joueur ou si on a déjà le flag isOwner
        isRoomOwner = players.some(player => 
            player.id === socket?.id && player.isOwner
        );
    }
    
    console.log('isRoomOwner:', isRoomOwner);

    players.forEach(player => {
        const playerElement = document.createElement('li');
        playerElement.className = 'waiting-room-player';
        
        // Créer le contenu du joueur avant d'ajouter le badge
        const playerContent = document.createElement('span');
        playerContent.textContent = player.nickname;
        playerElement.appendChild(playerContent);

        if (player.id === socket?.id) {
            playerElement.classList.add('current-player');
        }
        
        if (player.isOwner) {
            console.log('Adding owner badge to:', player.nickname);
            const ownerBadge = document.createElement('span');
            ownerBadge.className = 'owner-badge';
            ownerBadge.textContent = '👑';
            playerElement.appendChild(ownerBadge);
        }

        playersList.appendChild(playerElement);
    });

    // Mettre à jour les contrôles en fonction du statut de propriétaire
    startGameButton.disabled = !isRoomOwner;
    console.log('Start game button disabled:', !isRoomOwner);

    // Gérer l'état des inputs dans le menu paramètres
    const settingsInputs = settingsMenu.querySelectorAll('input, select, button');
    settingsInputs.forEach(input => {
        if (input.id === 'backToMenuButton') return;
        input.disabled = !isRoomOwner;
    });

    saveSettingsButton.style.display = isRoomOwner ? 'block' : 'none';
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

    const baseSpeed = 3;
    // Appliquer le boost de vitesse si actif
    const currentSpeed = speedBoostActive ? baseSpeed * 1.3 : baseSpeed;
    let move = { x: 0, y: 0 };

    if (keysPressed['ArrowUp'] || keysPressed['z']) move.y = -currentSpeed;
    if (keysPressed['ArrowDown'] || keysPressed['s']) move.y = currentSpeed;
    if (keysPressed['ArrowLeft'] || keysPressed['q']) move.x = -currentSpeed;
    if (keysPressed['ArrowRight'] || keysPressed['d']) move.x = currentSpeed;

    // Normaliser le mouvement diagonal
    if (move.x !== 0 && move.y !== 0) {
        const normalize = 1 / Math.sqrt(2);
        move.x *= normalize;
        move.y *= normalize;
    }

    if (move.x !== 0 || move.y !== 0) {
        socket.emit('move', { 
            x: move.x,
            y: move.y,
            speedBoostActive: speedBoostActive 
        });
    }
}

function handlePauseClick() {
    if (!isPaused && !isGameOver) {
        socket.emit('togglePause');
    }
}

function updateSettingsUI(settings) {
    // Mettre à jour tous les champs avec les nouvelles valeurs
    gameDurationInput.value = settings.gameDuration;
    enableSpeedBoostCheckbox.checked = settings.enableSpeedBoost;
    speedBoostDurationInput.value = settings.speedBoostDuration;
    enableInvincibilityCheckbox.checked = settings.enableInvincibility;
    invincibilityDurationInput.value = settings.invincibilityDuration;
    enableRevealCheckbox.checked = settings.enableReveal;
    revealDurationInput.value = settings.revealDuration;
    initialBotCountInput.value = settings.initialBotCount;
    enableSpecialZonesCheckbox.checked = settings.enableSpecialZones;
    enableChaosZoneCheckbox.checked = settings.enabledZones.CHAOS;
    enableRepelZoneCheckbox.checked = settings.enabledZones.REPEL;
    enableAttractZoneCheckbox.checked = settings.enabledZones.ATTRACT;
    enableStealthZoneCheckbox.checked = settings.enabledZones.STEALTH;
    enableBlackBotCheckbox.checked = settings.enableBlackBot;
    blackBotCountInput.value = settings.blackBotCount;
    bonusSpawnIntervalInput.value = settings.bonusSpawnInterval;
    speedBoostSpawnRateInput.value = settings.speedBoostSpawnRate;
    invincibilitySpawnRateInput.value = settings.invincibilitySpawnRate;
    revealSpawnRateInput.value = settings.revealSpawnRate;
}

// Fonction de démarrage du jeu
function startGame() {
    console.log('Starting game...'); // Debug log
    
    isGameOver = false;
    isPaused = false;
    pauseButton.disabled = false;

    initializeCamera();

    // Réinitialiser les variables de localisation et d'état
    showPlayerLocator = false;
    locatorFadeStartTime = 0;
    keysPressed = {};
    playerColor = null;
    playerId = socket.id; // Important : définir directement l'ID du joueur

    // Afficher l'indicateur de position au démarrage
    showPlayerLocator = true;
    locatorFadeStartTime = Date.now() + 3000; // Afficher pendant 3 secondes
    setTimeout(() => {
        showPlayerLocator = false;
    }, 3500); // 3.5 secondes pour inclure le fade out

    // Réinitialiser les bonus
    speedBoostActive = false;
    invincibilityActive = false;
    revealActive = false;
    playerSpeed = 3;
    speedBoostTimeLeft = 0;
    invincibilityTimeLeft = 0;
    revealTimeLeft = 0;

    // Gérer l'affichage des écrans
    mainMenu.classList.remove('active');
    waitingRoomScreen.classList.remove('active');
    settingsMenu.style.display = 'none';
    gameScreen.classList.add('active');

    // S'assurer que le canvas est correctement dimensionné
    resizeCanvas();

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
            initializeChat();
        });
    }

    if (!socket.hasListeners('updateEntities')) {
        socket.on('updateEntities', (data) => {
            if (isPaused || isGameOver) return;

            // Mise à jour du timer
            updateTimer(data.timeLeft || 0);
            timeRemaining = data.timeLeft;
            
            // Mise à jour des bonus
            bonuses = data.bonuses || [];
            specialZones = data.zones || [];
            
            // Trouver d'abord notre joueur dans les scores
            const currentPlayer = data.playerScores.find(p => p.id === socket.id);
            if (currentPlayer) {
                playerColor = currentPlayer.color;
                playerId = currentPlayer.id;
                const totalScore = currentPlayer.currentBots;
                scoreDisplay.textContent = `${currentPlayer.nickname}: ${totalScore} points`;
            }
            
            // Mettre à jour les entités et la caméra
            entities = data.entities;
            updatePlayerList(data.playerScores);
            updateCamera();
            drawEntities();
            updateActiveBonusesDisplay();
        });
    }

    if (!socket.hasListeners('playerCaptured')) {
        socket.on('playerCaptured', (data) => {
            playerColor = data.newColor;
            showCaptureNotification(`Capturé par ${data.capturedBy} !`);
            showPlayerLocator = true;
            locatorFadeStartTime = Date.now() + 3000;
            setTimeout(() => {
                showPlayerLocator = false;
            }, 3500);
        });
    }

    if (!socket.hasListeners('capturedByBlackBot')) {
        socket.on('capturedByBlackBot', (data) => {
            showCaptureNotification(data.message);
            showPlayerLocator = true;
            locatorFadeStartTime = Date.now() + 3000;
            setTimeout(() => {
                showPlayerLocator = false;
            }, 3500);
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

    pauseButton.removeEventListener('click', handlePauseClick);
    pauseButton.addEventListener('click', handlePauseClick);

    // Réinitialiser la boucle de jeu
    if (gameLoopInterval) {
        clearInterval(gameLoopInterval);
    }

    gameLoopInterval = setInterval(() => {
        if (!isPaused && !isGameOver) {
            movePlayer();
            updateBonusTimers();
            updateCamera();
        }
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

        // Si c'est notre joueur, on ajoute les effets de bonus
        if (entity.id === playerId) {
            // Dessiner d'abord les effets de bonus si actifs
            drawBonusEffects(entity);
        }

        // Dessiner le point normalement
        context.beginPath();
        context.arc(entity.x, entity.y, 11, 0, 2 * Math.PI);
        context.fillStyle = 'black';
        context.fill();

        context.beginPath();
        context.arc(entity.x, entity.y, 10, 0, 2 * Math.PI);
        context.fillStyle = entity.color;
        context.fill();

        // Gestion spéciale pour les bots noirs
        if (entity.type === 'blackBot') {
        // Effet de lueur rouge pour montrer le rayon de détection
        context.beginPath();
        context.arc(entity.x, entity.y, entity.detectionRadius, 0, 2 * Math.PI);
        context.fillStyle = 'rgba(255, 0, 0, 0.1)';
        context.fill();

        // Lueur autour du bot noir
        const glowSize = 15;
        context.beginPath();
        context.arc(entity.x, entity.y, glowSize, 0, 2 * Math.PI);
        context.fillStyle = 'rgba(255, 0, 0, 0.3)';
        context.fill();

        // Corps du bot noir
        context.beginPath();
        context.arc(entity.x, entity.y, 11, 0, 2 * Math.PI);
        context.fillStyle = 'black';
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = '#FF0000';
        context.stroke();

        // Effet de pulsation
        const pulseSize = 13 + Math.sin(Date.now() * 0.01) * 2;
        context.beginPath();
        context.arc(entity.x, entity.y, pulseSize, 0, 2 * Math.PI);
        context.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        context.stroke();
        } 
        else {
            // Dessiner le contour noir standard
            context.shadowColor = 'rgba(0, 0, 0, 0.5)';
            context.shadowBlur = 4;
            context.shadowOffsetX = 2;
            context.shadowOffsetY = 2;

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
        const effect = BONUS_EFFECTS[bonus.type];
        if (image && image.complete && effect) {
            const visualSize = 24;        // Taille visuelle réduite pour l'effet
            const imageSize = 30;         // Taille de l'image conservée pour la hitbox
            const glowSize = visualSize * 1.2;  // Halo réduit autour du bonus
            
            // Dessiner le fond lumineux
            context.beginPath();
            context.arc(bonus.x, bonus.y, glowSize, 0, Math.PI * 2);
            context.fillStyle = effect.backgroundColor;
            context.fill();
            
            // Ajouter un contour lumineux
            context.strokeStyle = effect.borderColor;
            context.lineWidth = 2;
            context.stroke();
            
            // Appliquer une teinte à l'image
            context.globalCompositeOperation = 'source-atop';
            context.fillStyle = `${effect.color}40`;
            
            // Dessiner l'image du bonus
            context.drawImage(image, 
                bonus.x - imageSize/2, 
                bonus.y - imageSize/2, 
                imageSize, 
                imageSize
            );
            
            // Réinitialiser le mode de composition
            context.globalCompositeOperation = 'source-over';
        }
    });

    // Restaurer le contexte
    context.restore();
}

// Nouvelle fonction pour dessiner les effets de bonus
function drawBonusEffects(player) {
    const now = Date.now();
    const activeEffects = [];

    // Collecter les effets actifs
    if (speedBoostActive) activeEffects.push('speed');
    if (invincibilityActive) activeEffects.push('invincibility');
    if (revealActive) activeEffects.push('reveal');

    if (activeEffects.length === 0) return;

    context.save();

    // Calculer la taille totale de l'effet en fonction du nombre de bonus actifs
    activeEffects.forEach((effectType, index) => {
        const effect = BONUS_EFFECTS[effectType];
        const baseGlowSize = effect.glowSize;
        const pulse = Math.sin(now * effect.pulseSpeed) * 5;
        const offsetDistance = index * 8; // Décalage pour les effets multiples

        // Créer un dégradé radial pour l'effet de lueur
        const gradient = context.createRadialGradient(
            player.x, player.y, 10 + offsetDistance,
            player.x, player.y, baseGlowSize + pulse + offsetDistance
        );

        // Calculer l'opacité en fonction du nombre d'effets actifs
        const baseOpacity = 0.7 / Math.max(1, activeEffects.length);
        gradient.addColorStop(0, `${effect.color}${Math.floor(baseOpacity * 255).toString(16).padStart(2, '0')}`);
        gradient.addColorStop(1, 'transparent');

        // Dessiner l'effet de lueur
        context.beginPath();
        context.fillStyle = gradient;
        context.arc(player.x, player.y, baseGlowSize + pulse + offsetDistance, 0, Math.PI * 2);
        context.fill();

        // Ajouter un contour subtil
        context.strokeStyle = `${effect.color}40`; // 25% opacité
        context.lineWidth = 2;
        context.stroke();
    });

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

    const ARROW_DISTANCE = 80;  // Augmenté : Distance des flèches par rapport au point
    const ARROW_SIZE = 40;      // Augmenté : Taille des flèches
    const ARROW_WIDTH = 30;     // Nouveau : Largeur de la base des flèches
    const BOUNCE_AMOUNT = 8;    // Augmenté : Amplitude de l'animation
    const BOUNCE_SPEED = 0.004; // Vitesse de l'animation
    const LINE_WIDTH = 3;       // Augmenté : Épaisseur du contour

    // Calculer l'animation de pulsation
    const bounce = Math.sin(now * BOUNCE_SPEED) * BOUNCE_AMOUNT;
    
    context.save();
    
    // Pour chaque direction (haut, droite, bas, gauche)
    const directions = [
        { angle: 0, dx: 0, dy: -1 },     // Haut
        { angle: Math.PI/2, dx: 1, dy: 0 },      // Droite
        { angle: Math.PI, dx: 0, dy: 1 },    // Bas
        { angle: -Math.PI/2, dx: -1, dy: 0 }     // Gauche
    ];

    directions.forEach(dir => {
        context.save();
        
        // Positionner la flèche
        const arrowX = player.x + (dir.dx * (ARROW_DISTANCE + bounce));
        const arrowY = player.y + (dir.dy * (ARROW_DISTANCE + bounce));
        
        context.translate(arrowX, arrowY);
        context.rotate(dir.angle);

        // Dessiner la flèche
        context.beginPath();
        context.moveTo(0, ARROW_SIZE);          // Pointe de la flèche
        context.lineTo(-ARROW_WIDTH, 0);        // Côté gauche
        context.lineTo(ARROW_WIDTH, 0);         // Côté droit
        context.closePath();

        // Remplir avec un rouge vif
        context.fillStyle = `rgba(255, 30, 30, ${opacity})`;
        context.fill();

        // Contour plus épais de la flèche
        context.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        context.lineWidth = LINE_WIDTH;
        context.stroke();

        // Ajouter un effet de lueur
        context.shadowColor = `rgba(255, 0, 0, ${opacity * 0.5})`;
        context.shadowBlur = 10;
        context.stroke();

        context.restore();
    });

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

function updateTimer(timeLeft) {
    const timerElement = document.getElementById('timer');
    const timeDisplay = document.getElementById('time');
    
    // Convertir les secondes en minutes:secondes
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Mettre à jour l'affichage
    timeDisplay.textContent = formattedTime;
    
    // Gérer l'état d'urgence (10 dernières secondes)
    if (timeLeft <= 10) {
        timerElement.classList.add('urgent');
        
        // Si c'est la première fois qu'on entre dans les 10 dernières secondes
        if (timeLeft === 10) {
            // Tu peux ajouter un son d'urgence ici si tu le souhaites
            // const urgentSound = new Audio('/assets/sounds/urgent.mp3');
            // urgentSound.play();
        }
    } else {
        timerElement.classList.remove('urgent');
    }
}

function updateBonusTimers() {
    const deltaTime = 0.02;  // 20ms en secondes
    let bonusesChanged = false;

    // Fonction pour mettre à jour un timer spécifique
    function updateSingleTimer(active, timeLeft, type) {
        if (active) {
            const newTime = Math.max(0, timeLeft - deltaTime);
            if (newTime <= 0) {
                return { active: false, timeLeft: 0, changed: true };
            }
            // Ne mettre à jour l'affichage que si la seconde a changé
            if (Math.ceil(newTime) !== Math.ceil(timeLeft)) {
                bonusesChanged = true;
            }
            return { active: true, timeLeft: newTime, changed: false };
        }
        return { active: false, timeLeft: 0, changed: false };
    }

    // Mettre à jour les timers
    const speedUpdate = updateSingleTimer(speedBoostActive, speedBoostTimeLeft, 'speed');
    const invincibilityUpdate = updateSingleTimer(invincibilityActive, invincibilityTimeLeft, 'invincibility');
    const revealUpdate = updateSingleTimer(revealActive, revealTimeLeft, 'reveal');

    // Appliquer les mises à jour
    speedBoostActive = speedUpdate.active;
    speedBoostTimeLeft = speedUpdate.timeLeft;
    invincibilityActive = invincibilityUpdate.active;
    invincibilityTimeLeft = invincibilityUpdate.timeLeft;
    revealActive = revealUpdate.active;
    revealTimeLeft = revealUpdate.timeLeft;

    // Ne mettre à jour l'affichage que si nécessaire
    if (bonusesChanged) {
        requestAnimationFrame(() => {
            updateActiveBonusesDisplay();
        });
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
    const effect = BONUS_EFFECTS[type];
    const bonusDiv = document.createElement('div');
    bonusDiv.className = 'activeBonus new-bonus';
    bonusDiv.style.background = effect.backgroundColor;
    bonusDiv.style.borderColor = effect.borderColor;

    const img = document.createElement('img');
    img.src = bonusImages[type].src;
    img.alt = effect.name;
    img.style.filter = `drop-shadow(0 0 3px ${effect.color})`;

    const timerSpan = document.createElement('span');
    timerSpan.className = 'timer';
    // Formatter le temps pour avoir toujours le même format
    timerSpan.textContent = `${Math.ceil(timeLeft).toString().padStart(2, '0')}s`;
    timerSpan.style.color = effect.color;

    bonusDiv.appendChild(img);
    bonusDiv.appendChild(timerSpan);

    // Retirer la classe new-bonus après l'animation
    setTimeout(() => {
        bonusDiv.classList.remove('new-bonus');
    }, 300);

    return bonusDiv;
}

// Ajouter du CSS pour les styles des bonus actifs
const style = document.createElement('style');
style.textContent = `
.activeBonus {
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: rgba(0, 0, 0, 0.8);
    padding: 8px 15px;
    border-radius: 20px;
    border: 2px solid transparent;
    backdrop-filter: blur(5px);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    animation: bonusPulse 2s infinite;
}

.activeBonus img {
    width: 24px;
    height: 24px;
    filter: brightness(1.1);
    animation: bonusIconPulse 2s infinite;
}

.activeBonus .timer {
    font-weight: bold;
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

@keyframes bonusPulse {
    0% { box-shadow: 0 0 10px rgba(0, 0, 0, 0.3); }
    50% { box-shadow: 0 0 15px currentColor; }
    100% { box-shadow: 0 0 10px rgba(0, 0, 0, 0.3); }
}

@keyframes bonusIconPulse {
    0% { filter: brightness(1.1); }
    50% { filter: brightness(1.3); }
    100% { filter: brightness(1.1); }
}
`;
document.head.appendChild(style);

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

    // Créer le container pour le contenu scrollable
    const scrollableContent = document.createElement('div');
    scrollableContent.className = 'game-over-scrollable-content';

    // Podium
    const topThree = scores.slice(0, 3);
    let podiumHTML = '<div class="podium-container">';

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
                    <div class="podium-badge">
                        <div class="podium-symbol">${pos.symbol}</div>
                        <div class="player-name">${player.nickname}</div>
                        <div class="score">${player.currentBots} points</div>
                    </div>
                    <div class="podium-block"></div>
                </div>`;
        }
    });

    podiumHTML += '</div>';

    // Stats détaillées avec slider horizontal
    const statsSection = `
        <div class="detailed-stats">
            <div class="stats-slider-container">
                <div class="stats-slider">
                    ${scores.map((player, index) => {
                        const capturedPlayersHTML = Object.values(player.capturedPlayers)
                            .map(cap => `${cap.nickname} (${cap.count}×)`)
                            .join(', ') || 'Aucun';

                        const capturedByHTML = Object.entries(player.capturedBy)
                            .map(([id, cap]) => `${cap.nickname} (${cap.count}×)`)
                            .join(', ') || 'Aucun';
                        
                        // Calculer les captures par les bots noirs
                        const blackBotCaptures = player.capturedByBlackBot || 0;
                        const blackBotText = blackBotCaptures > 0 ? `Bot noir (${blackBotCaptures}×)` : '';
                        const capturedByFull = [capturedByHTML, blackBotText].filter(Boolean).join(', ');

                        return `
                            <div class="player-stats-card ${player.id === playerId ? 'current-player' : ''}">
                                <div class="player-header">
                                    <span class="rank">#${index + 1}</span>
                                    <span class="player-name">${player.nickname}</span>
                                </div>
                                <div class="stats-details">
                                    <div class="stat-row">🤖 Bots contrôlés: ${player.currentBots}</div>
                                    <div class="stat-row">👥 Joueurs capturés: ${capturedPlayersHTML}</div>
                                    <div class="stat-row">💀 Capturé par: ${capturedByFull}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="slider-controls">
                    <button class="slider-btn prev" disabled>◀</button>
                    <button class="slider-btn next">▶</button>
                </div>
            </div>
        </div>
    `;

    // Ajouter le podium et les stats au contenu scrollable
    scrollableContent.innerHTML = podiumHTML + statsSection;
    content.appendChild(scrollableContent);

    // Boutons de fin dans un container séparé
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'game-over-buttons';

    // Bouton Retour à la salle d'attente
    const waitingRoomButton = document.createElement('button');
    waitingRoomButton.className = 'primary-button';
    waitingRoomButton.textContent = 'Retour à la salle d\'attente';
    waitingRoomButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        returnToWaitingRoom();
    });

    // Bouton Menu Principal
    const mainMenuButton = document.createElement('button');
    mainMenuButton.className = 'secondary-button';
    mainMenuButton.textContent = 'Menu Principal';
    mainMenuButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        returnToMainMenu();
    });

    // Ajout des boutons dans l'ordre
    buttonsDiv.appendChild(waitingRoomButton);
    buttonsDiv.appendChild(mainMenuButton);
    content.appendChild(buttonsDiv);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Initialiser le slider
    const slider = content.querySelector('.stats-slider');
    const prevBtn = content.querySelector('.slider-btn.prev');
    const nextBtn = content.querySelector('.slider-btn.next');
    let currentSlide = 0;
    const slideWidth = slider.querySelector('.player-stats-card').offsetWidth;
    const visibleSlides = Math.floor(slider.parentElement.offsetWidth / slideWidth);
    const maxSlide = scores.length - visibleSlides;

    function updateSliderButtons() {
        prevBtn.disabled = currentSlide <= 0;
        nextBtn.disabled = currentSlide >= maxSlide;
    }

    function slideCards(direction) {
        currentSlide = Math.max(0, Math.min(currentSlide + direction, maxSlide));
        slider.style.transform = `translateX(-${currentSlide * slideWidth}px)`;
        updateSliderButtons();
    }

    prevBtn.addEventListener('click', () => slideCards(-1));
    nextBtn.addEventListener('click', () => slideCards(1));
    updateSliderButtons();
}

function showCaptureNotification(message) {
    collectedBonusDisplayContent.textContent = message;
    collectedBonusDisplay.classList.remove('hidden');

    setTimeout(() => {
        collectedBonusDisplay.classList.add('hidden');
    }, 3000);
}

// Nouvelle fonction pour retourner à la salle d'attente
function returnToWaitingRoom() {
    // Réinitialiser les états du jeu
    isGameOver = false;
    isPaused = false;
    pauseButton.disabled = false;

    // Réinitialiser les bonus
    speedBoostActive = false;
    invincibilityActive = false;
    revealActive = false;
    playerSpeed = 3;
    speedBoostTimeLeft = 0;
    invincibilityTimeLeft = 0;
    revealTimeLeft = 0;

    // Nettoyer l'interface
    activeBonusesContainer.innerHTML = '';
    playerListContainer.innerHTML = '';
    collectedBonusDisplay.classList.add('hidden');

    // Masquer l'écran de jeu
    gameScreen.classList.remove('active');

    // Réinitialiser la connexion socket si nécessaire
    if (!socket || !socket.connected) {
        socket = initializeSocket(io());
    }

    // S'assurer que les écouteurs d'événements sont en place
    if (!socket.hasListeners('updateWaitingRoom')) {
        socket.on('updateWaitingRoom', (players) => {
            updateWaitingRoomPlayers(players);
        });
    }

    if (!socket.hasListeners('gameSettingsUpdated')) {
        socket.on('gameSettingsUpdated', (settings) => {
            updateSettingsUI(settings);
            gameSettings = settings;
        });
    }

    // Rejoindre la salle d'attente avec une indication de retour de partie
    socket.emit('rejoinWaitingRoom', {
        nickname: playerNickname,
        wasInGame: true
    });

    // Afficher la salle d'attente
    waitingRoomScreen.classList.add('active');

    // Nettoyer les écouteurs d'événements du jeu
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    if (gameLoopInterval) {
        clearInterval(gameLoopInterval);
    }
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
    // Réinitialiser les états
    showPlayerLocator = false;
    isGameOver = false;
    isPaused = false;
    pauseButton.disabled = false;

    // Nettoyer l'interface
    hidePauseOverlay();
    activeBonusesContainer.innerHTML = '';
    playerListContainer.innerHTML = '';
    collectedBonusDisplay.classList.add('hidden');

    // Nettoyer la connexion socket
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    // Réinitialiser les bonus et états du jeu
    speedBoostActive = false;
    invincibilityActive = false;
    revealActive = false;
    playerSpeed = 3;
    speedBoostTimeLeft = 0;
    invincibilityTimeLeft = 0;
    revealTimeLeft = 0;
    keysPressed = {};

    // Nettoyer les écouteurs d'événements
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    if (gameLoopInterval) {
        clearInterval(gameLoopInterval);
    }

    // Réinitialiser les panneaux d'aide
    resetHelpPanels();

    // Gérer l'affichage des écrans
    gameScreen.classList.remove('active');
    waitingRoomScreen.classList.remove('active');
    mainMenu.classList.add('active');
}

function handleKeyDown(event) {
    keysPressed[event.key] = true;

    if (event.key.toLowerCase() === 'f' && !showPlayerLocator) {
        showPlayerLocator = true;
        locatorFadeStartTime = Date.now() + 3000;
        setTimeout(() => {
            showPlayerLocator = false;
        }, 3500);
    }
}