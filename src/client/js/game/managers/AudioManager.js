/**
 * @class AudioManager
 * @description Gère tous les sons et la musique du jeu
 */
class AudioManager {
    constructor(clientInstance) {
        this.client = clientInstance;

        // Contexte audio
        this.context = null;
        this.masterGain = null;

        // Collections de sons
        this.sounds = new Map();
        this.music = new Map();
        this.currentMusic = null;

        // État de l'audio
        this.state = {
            initialized: false,
            muted: false,
            soundVolume: 0.7,
            musicVolume: 0.4,
            fadeSpeed: 0.05,
            currentMusicId: null
        };

        // Configuration des sons
        this.config = {
            SOUNDS: {
                bonus: { path: '/assets/sounds/bonus.mp3', volume: 0.6 },
                malus: { path: '/assets/sounds/malus.mp3', volume: 0.6 },
                capture: { path: '/assets/sounds/capture.mp3', volume: 0.7 },
                captureByBlackBot: { path: '/assets/sounds/black-bot.mp3', volume: 0.7 },
                gameStart: { path: '/assets/sounds/start.mp3', volume: 0.8 },
                gameOver: { path: '/assets/sounds/over.mp3', volume: 0.8 },
                countdown: { path: '/assets/sounds/countdown.mp3', volume: 0.6 },
                click: { path: '/assets/sounds/click.mp3', volume: 0.4 }
            },
            MUSIC: {
                menu: { path: '/assets/music/menu.mp3', volume: 0.4, loop: true },
                game: { path: '/assets/music/game.mp3', volume: 0.4, loop: true },
                ending: { path: '/assets/music/ending.mp3', volume: 0.4, loop: false }
            },
            MAX_CONCURRENT_SOUNDS: 8,
            MIN_TIME_BETWEEN_SOUNDS: 50, // ms
            FADE_DURATION: 1000 // ms
        };

        // Cache pour la limitation des sons
        this.soundCache = {
            lastPlayTimes: new Map(),
            currentlyPlaying: new Set()
        };

        // Bindings
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    /**
     * @method initialize
     * @description Initialise le gestionnaire audio
     * @returns {Promise} Promesse résolue quand l'initialisation est terminée
     */
    async initialize() {
        try {
            // Création du contexte audio
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();

            // Configuration du gain principal
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);

            // Charger tous les sons
            await this.loadAllSounds();

            // Configurer les écouteurs d'événements
            this.setupEventListeners();

            // Charger les préférences utilisateur
            this.loadPreferences();

            this.state.initialized = true;
            return true;
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de l\'audio:', error);
            return false;
        }
    }

    /**
     * @private
     * @method setupEventListeners
     * @description Configure les écouteurs d'événements
     */
    setupEventListeners() {
        // Gestion de la visibilité de la page
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Gestion du focus de la fenêtre
        window.addEventListener('blur', () => this.handleFocusChange(false));
        window.addEventListener('focus', () => this.handleFocusChange(true));
    }

    /**
     * @private
     * @method loadAllSounds
     * @description Charge tous les sons et musiques
     * @returns {Promise} Promesse résolue quand tout est chargé
     */
    async loadAllSounds() {
        const soundPromises = [];

        // Charger les sons
        for (const [id, config] of Object.entries(this.config.SOUNDS)) {
            soundPromises.push(this.loadSound(id, config));
        }

        // Charger les musiques
        for (const [id, config] of Object.entries(this.config.MUSIC)) {
            soundPromises.push(this.loadMusic(id, config));
        }

        try {
            await Promise.all(soundPromises);
            return true;
        } catch (error) {
            console.error('Erreur lors du chargement des sons:', error);
            return false;
        }
    }

    /**
     * @private
     * @method handleVisibilityChange
     * @description Gère les changements de visibilité de la page
     */
    handleVisibilityChange() {
        if (document.hidden) {
            this.handleFocusChange(false);
        } else {
            this.handleFocusChange(true);
        }
    }
/**
     * Chargement des sons
     */

    /**
     * @private
     * @method loadSound
     * @description Charge un son individuel
     * @param {string} id - Identifiant du son
     * @param {Object} config - Configuration du son
     * @returns {Promise} Promesse résolue quand le son est chargé
     */
    async loadSound(id, config) {
        try {
            const response = await fetch(config.path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

            this.sounds.set(id, {
                buffer: audioBuffer,
                volume: config.volume,
                instances: []
            });

            return true;
        } catch (error) {
            console.error(`Erreur lors du chargement du son ${id}:`, error);
            return false;
        }
    }

    /**
     * @private
     * @method loadMusic
     * @description Charge une piste musicale
     * @param {string} id - Identifiant de la musique
     * @param {Object} config - Configuration de la musique
     * @returns {Promise} Promesse résolue quand la musique est chargée
     */
    async loadMusic(id, config) {
        try {
            const response = await fetch(config.path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

            this.music.set(id, {
                buffer: audioBuffer,
                volume: config.volume,
                loop: config.loop,
                source: null,
                gain: null
            });

            return true;
        } catch (error) {
            console.error(`Erreur lors du chargement de la musique ${id}:`, error);
            return false;
        }
    }

    /**
     * Lecture des sons
     */

    /**
     * @method playSound
     * @description Joue un son
     * @param {string} id - Identifiant du son
     * @param {Object} options - Options de lecture
     * @returns {boolean} Succès de la lecture
     */
    playSound(id, options = {}) {
        if (!this.state.initialized || this.state.muted) return false;

        const sound = this.sounds.get(id);
        if (!sound) {
            console.warn(`Son non trouvé: ${id}`);
            return false;
        }

        // Vérifier la limitation de sons simultanés
        if (this.soundCache.currentlyPlaying.size >= this.config.MAX_CONCURRENT_SOUNDS) {
            return false;
        }

        // Vérifier le délai minimum entre deux lectures du même son
        const lastPlayTime = this.soundCache.lastPlayTimes.get(id) || 0;
        const now = Date.now();
        if (now - lastPlayTime < this.config.MIN_TIME_BETWEEN_SOUNDS) {
            return false;
        }

        try {
            const source = this.context.createBufferSource();
            const gainNode = this.context.createGain();

            source.buffer = sound.buffer;
            
            // Configuration du volume
            const volume = options.volume !== undefined ? options.volume : sound.volume;
            gainNode.gain.value = volume * this.state.soundVolume;

            // Connexion des nœuds
            source.connect(gainNode);
            gainNode.connect(this.masterGain);

            // Configuration des options de lecture
            if (options.loop) source.loop = true;
            if (options.playbackRate) source.playbackRate.value = options.playbackRate;

            // Démarrer la lecture
            source.start(0);
            this.soundCache.currentlyPlaying.add(source);
            this.soundCache.lastPlayTimes.set(id, now);

            // Nettoyer quand le son est terminé
            source.onended = () => {
                this.soundCache.currentlyPlaying.delete(source);
                source.disconnect();
                gainNode.disconnect();
            };

            return true;
        } catch (error) {
            console.error(`Erreur lors de la lecture du son ${id}:`, error);
            return false;
        }
    }

    /**
     * @method playSoundWithPosition
     * @description Joue un son avec un effet de position spatiale
     * @param {string} id - Identifiant du son
     * @param {Object} position - Position de la source {x, y}
     * @param {Object} options - Options de lecture
     */
    playSoundWithPosition(id, position, options = {}) {
        if (!this.state.initialized || this.state.muted) return;

        const sound = this.sounds.get(id);
        if (!sound) return;

        try {
            const source = this.context.createBufferSource();
            const panNode = this.context.createStereoPanner();
            const gainNode = this.context.createGain();

            source.buffer = sound.buffer;

            // Calculer la position stéréo (-1 à 1) basée sur la position dans le jeu
            const playerPos = this.client.managers.camera.getWorldToScreenPosition(position);
            const screenWidth = window.innerWidth;
            const pan = Math.max(-1, Math.min(1, (playerPos.x / screenWidth * 2) - 1));
            
            // Appliquer la position stéréo
            panNode.pan.value = pan;

            // Calculer le volume basé sur la distance
            const distance = this.calculateDistance(position);
            const distanceVolume = this.calculateVolumeFromDistance(distance);
            gainNode.gain.value = distanceVolume * this.state.soundVolume;

            // Connecter les nœuds
            source.connect(panNode);
            panNode.connect(gainNode);
            gainNode.connect(this.masterGain);

            // Démarrer la lecture
            source.start(0);

            // Nettoyage
            source.onended = () => {
                source.disconnect();
                panNode.disconnect();
                gainNode.disconnect();
            };
        } catch (error) {
            console.error(`Erreur lors de la lecture du son positionnel ${id}:`, error);
        }
    }

    /**
     * @private
     * @method calculateDistance
     * @description Calcule la distance entre la caméra et une position
     * @param {Object} position - Position à vérifier
     * @returns {number} Distance normalisée
     */
    calculateDistance(position) {
        const cameraPos = this.client.managers.camera.position;
        const dx = position.x - cameraPos.x;
        const dy = position.y - cameraPos.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * @private
     * @method calculateVolumeFromDistance
     * @description Calcule le volume basé sur la distance
     * @param {number} distance - Distance de la source
     * @returns {number} Volume calculé
     */
    calculateVolumeFromDistance(distance) {
        const maxDistance = 1000; // Distance à partir de laquelle le son n'est plus audible
        return Math.max(0, Math.min(1, 1 - (distance / maxDistance)));
    }
/**
     * Gestion de la musique
     */

    /**
     * @method playMusic
     * @description Joue une piste musicale avec transition
     * @param {string} id - Identifiant de la musique
     * @param {Object} options - Options de lecture
     */
    async playMusic(id, options = {}) {
        if (!this.state.initialized || this.state.muted) return;

        const music = this.music.get(id);
        if (!music) {
            console.warn(`Musique non trouvée: ${id}`);
            return;
        }

        const defaultOptions = {
            fadeOut: true,
            fadeIn: true,
            fadeTime: this.config.FADE_DURATION,
            volume: music.volume
        };
        const finalOptions = { ...defaultOptions, ...options };

        try {
            // Si une musique est déjà en cours, la faire disparaître en fondu
            if (this.currentMusic && finalOptions.fadeOut) {
                await this.fadeOutCurrentMusic(finalOptions.fadeTime);
            } else if (this.currentMusic) {
                this.stopCurrentMusic();
            }

            // Créer et configurer la nouvelle source
            const source = this.context.createBufferSource();
            const gainNode = this.context.createGain();

            source.buffer = music.buffer;
            source.loop = music.loop;

            // Démarrer avec un volume à 0 si fondu entrant
            gainNode.gain.value = finalOptions.fadeIn ? 0 : 
                finalOptions.volume * this.state.musicVolume;

            // Connecter les nœuds
            source.connect(gainNode);
            gainNode.connect(this.masterGain);

            // Démarrer la lecture
            source.start(0);

            // Sauvegarder la musique courante
            this.currentMusic = {
                id,
                source,
                gainNode
            };

            // Appliquer le fondu entrant si nécessaire
            if (finalOptions.fadeIn) {
                await this.fadeInMusic(gainNode, finalOptions.volume, finalOptions.fadeTime);
            }

            this.state.currentMusicId = id;
        } catch (error) {
            console.error(`Erreur lors de la lecture de la musique ${id}:`, error);
        }
    }

    /**
     * @method stopMusic
     * @description Arrête la musique en cours
     * @param {Object} options - Options d'arrêt
     */
    async stopMusic(options = {}) {
        if (!this.currentMusic) return;

        const defaultOptions = {
            fadeOut: true,
            fadeTime: this.config.FADE_DURATION
        };
        const finalOptions = { ...defaultOptions, ...options };

        try {
            if (finalOptions.fadeOut) {
                await this.fadeOutCurrentMusic(finalOptions.fadeTime);
            } else {
                this.stopCurrentMusic();
            }
        } catch (error) {
            console.error('Erreur lors de l\'arrêt de la musique:', error);
        }
    }

    /**
     * @method transitionMusic
     * @description Effectue une transition entre deux musiques
     * @param {string} newMusicId - ID de la nouvelle musique
     * @param {Object} options - Options de transition
     */
    async transitionMusic(newMusicId, options = {}) {
        const defaultOptions = {
            crossFade: true,
            fadeTime: this.config.FADE_DURATION,
            volume: this.music.get(newMusicId)?.volume || 1
        };
        const finalOptions = { ...defaultOptions, ...options };

        try {
            if (finalOptions.crossFade) {
                // Démarrer la nouvelle musique pendant que l'ancienne joue encore
                await this.playMusic(newMusicId, {
                    fadeIn: true,
                    fadeOut: false,
                    fadeTime: finalOptions.fadeTime,
                    volume: finalOptions.volume
                });

                // Faire disparaître progressivement l'ancienne musique
                if (this.currentMusic && this.currentMusic.id !== newMusicId) {
                    await this.fadeOutCurrentMusic(finalOptions.fadeTime);
                }
            } else {
                // Transition simple
                await this.playMusic(newMusicId, finalOptions);
            }
        } catch (error) {
            console.error('Erreur lors de la transition de musique:', error);
        }
    }

    /**
     * Méthodes de fondu
     */

    /**
     * @private
     * @method fadeOutCurrentMusic
     * @description Fait disparaître progressivement la musique courante
     * @param {number} duration - Durée du fondu en ms
     * @returns {Promise} Promesse résolue à la fin du fondu
     */
    fadeOutCurrentMusic(duration) {
        if (!this.currentMusic) return Promise.resolve();

        return new Promise((resolve) => {
            const { gainNode } = this.currentMusic;
            const startTime = this.context.currentTime;
            const endTime = startTime + (duration / 1000);

            gainNode.gain.setValueAtTime(gainNode.gain.value, startTime);
            gainNode.gain.linearRampToValueAtTime(0, endTime);

            setTimeout(() => {
                this.stopCurrentMusic();
                resolve();
            }, duration);
        });
    }

    /**
     * @private
     * @method fadeInMusic
     * @description Fait apparaître progressivement une musique
     * @param {GainNode} gainNode - Nœud de gain à contrôler
     * @param {number} targetVolume - Volume cible
     * @param {number} duration - Durée du fondu en ms
     * @returns {Promise} Promesse résolue à la fin du fondu
     */
    fadeInMusic(gainNode, targetVolume, duration) {
        return new Promise((resolve) => {
            const startTime = this.context.currentTime;
            const endTime = startTime + (duration / 1000);
            const finalVolume = targetVolume * this.state.musicVolume;

            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(finalVolume, endTime);

            setTimeout(resolve, duration);
        });
    }

    /**
     * @private
     * @method stopCurrentMusic
     * @description Arrête immédiatement la musique courante
     */
    stopCurrentMusic() {
        if (!this.currentMusic) return;

        try {
            const { source, gainNode } = this.currentMusic;
            source.stop();
            source.disconnect();
            gainNode.disconnect();
            this.currentMusic = null;
            this.state.currentMusicId = null;
        } catch (error) {
            console.error('Erreur lors de l\'arrêt de la musique:', error);
        }
    }
/**
     * Gestion des préférences
     */

    /**
     * @method setMasterVolume
     * @description Définit le volume principal
     * @param {number} volume - Nouveau volume (0-1)
     */
    setMasterVolume(volume) {
        if (!this.masterGain) return;
        
        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.masterGain.gain.value = clampedVolume;
        this.savePreferences();
    }

    /**
     * @method setSoundVolume
     * @description Définit le volume des effets sonores
     * @param {number} volume - Nouveau volume (0-1)
     */
    setSoundVolume(volume) {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.state.soundVolume = clampedVolume;
        this.savePreferences();
    }

    /**
     * @method setMusicVolume
     * @description Définit le volume de la musique
     * @param {number} volume - Nouveau volume (0-1)
     */
    setMusicVolume(volume) {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.state.musicVolume = clampedVolume;

        // Mettre à jour le volume de la musique en cours
        if (this.currentMusic && this.currentMusic.gainNode) {
            this.currentMusic.gainNode.gain.value = clampedVolume;
        }

        this.savePreferences();
    }

    /**
     * @method toggleMute
     * @description Active/désactive le son
     * @returns {boolean} Nouvel état du mute
     */
    toggleMute() {
        this.state.muted = !this.state.muted;

        if (this.masterGain) {
            this.masterGain.gain.value = this.state.muted ? 0 : 1;
        }

        this.savePreferences();
        return this.state.muted;
    }

    /**
     * @method setMute
     * @description Définit l'état du mute
     * @param {boolean} muted - État souhaité
     */
    setMute(muted) {
        if (this.state.muted === muted) return;
        this.toggleMute();
    }

    /**
     * Gestion des préférences utilisateur
     */

    /**
     * @private
     * @method savePreferences
     * @description Sauvegarde les préférences audio
     */
    savePreferences() {
        const preferences = {
            muted: this.state.muted,
            soundVolume: this.state.soundVolume,
            musicVolume: this.state.musicVolume
        };

        try {
            localStorage.setItem('audioPreferences', JSON.stringify(preferences));
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des préférences audio:', error);
        }
    }

    /**
     * @private
     * @method loadPreferences
     * @description Charge les préférences audio
     */
    loadPreferences() {
        try {
            const saved = localStorage.getItem('audioPreferences');
            if (!saved) return;

            const preferences = JSON.parse(saved);
            
            this.state.muted = preferences.muted ?? false;
            this.state.soundVolume = preferences.soundVolume ?? 0.7;
            this.state.musicVolume = preferences.musicVolume ?? 0.4;

            // Appliquer les préférences
            if (this.masterGain) {
                this.masterGain.gain.value = this.state.muted ? 0 : 1;
            }
        } catch (error) {
            console.error('Erreur lors du chargement des préférences audio:', error);
        }
    }

    /**
     * Gestion des événements
     */

    /**
     * @private
     * @method handleFocusChange
     * @description Gère les changements de focus de la fenêtre
     * @param {boolean} hasFocus - La fenêtre a le focus
     */
    handleFocusChange(hasFocus) {
        if (!this.state.initialized) return;

        if (!hasFocus) {
            // Baisser le volume progressivement
            if (this.currentMusic && this.currentMusic.gainNode) {
                const currentGain = this.currentMusic.gainNode.gain;
                const now = this.context.currentTime;
                currentGain.setValueAtTime(currentGain.value, now);
                currentGain.linearRampToValueAtTime(0, now + 0.5);
            }
        } else {
            // Restaurer le volume progressivement
            if (this.currentMusic && this.currentMusic.gainNode && !this.state.muted) {
                const currentGain = this.currentMusic.gainNode.gain;
                const now = this.context.currentTime;
                currentGain.setValueAtTime(currentGain.value, now);
                currentGain.linearRampToValueAtTime(
                    this.state.musicVolume,
                    now + 0.5
                );
            }
        }
    }

    /**
     * Méthodes utilitaires
     */

    /**
     * @method isPlaying
     * @description Vérifie si une musique est en cours de lecture
     * @param {string} [musicId] - ID de la musique à vérifier
     * @returns {boolean}
     */
    isPlaying(musicId) {
        if (!musicId) {
            return this.currentMusic !== null;
        }
        return this.currentMusic?.id === musicId;
    }

    /**
     * @method getCurrentMusic
     * @description Obtient l'ID de la musique en cours
     * @returns {string|null}
     */
    getCurrentMusic() {
        return this.state.currentMusicId;
    }

    /**
     * @method resume
     * @description Reprend le contexte audio (nécessaire sur certains navigateurs)
     * @returns {Promise}
     */
    async resume() {
        if (this.context?.state === 'suspended') {
            try {
                await this.context.resume();
            } catch (error) {
                console.error('Erreur lors de la reprise du contexte audio:', error);
            }
        }
    }

    /**
     * @method getState
     * @description Obtient l'état actuel du gestionnaire audio
     * @returns {Object}
     */
    getState() {
        return {
            initialized: this.state.initialized,
            muted: this.state.muted,
            soundVolume: this.state.soundVolume,
            musicVolume: this.state.musicVolume,
            currentMusic: this.state.currentMusicId,
            contextState: this.context?.state
        };
    }
}

module.exports = AudioManager;