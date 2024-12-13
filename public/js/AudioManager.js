// AudioManager.js
export class AudioManager {
    constructor(options = {}) {
        this.sounds = new Map();
        this.music = new Map();
        this.currentMusic = null;
        this.isMuted = false;
        this.volume = options.volume || 0.5;
        this.musicVolume = options.musicVolume || 0.7;
        this.soundVolume = options.soundVolume || 0.9;
        this.isLoaded = false;
        this.loadPromise = this.loadAudio();
        this.activeLoopSounds = new Map(); 
        this.lastFootstepTime = 0;
        this.NORMAL_FOOTSTEP_INTERVAL = 250;  // Intervalle normal
        this.SPEED_FOOTSTEP_INTERVAL = 200;   // Intervalle plus court pour le speed boost
        this.isPlayingFootsteps = false;
        this.currentFootstepInterval = this.NORMAL_FOOTSTEP_INTERVAL;
        this.lastRemoteFootstepTime = 0;
        this.MAX_SOUND_DISTANCE = 300;
        this.REMOTE_SOUND_INTERVAL = {
            normal: 300,
            speedBoost: 200
        };
        this.loadSettings();
    }

    async loadAudio() {
        try {
            // Définition des sons du jeu
            const soundsToLoad = {
                buttonClick: '/assets/audio/button-click.wav',
                bonus: '/assets/audio/collect-bonus.wav',
                malus: '/assets/audio/collect-malus.wav',
                capture: '/assets/audio/capture.wav',
                botConvert: '/assets/audio/bot-convert.mp3',          // Quand on capture un bot (déjà en place)
                playerCaptured: '/assets/audio/player-captured.mp3',  // Quand on est capturé par un joueur
                playerCapture: '/assets/audio/player-capture.mp3',    // Quand on capture un joueur
                blackBotDestroy: '/assets/audio/blackbot-destroy.mp3', // Quand on capture un black bot
                gameStart: '/assets/audio/game-start.wav',
                gameOver: '/assets/audio/game-over.wav',
                countdown: '/assets/audio/countdown.wav',
                footstep1: '/assets/audio/footstep1.mp3',
                footstep2: '/assets/audio/footstep2.mp3',
                footstep3: '/assets/audio/footstep3.mp3',
                footstep4: '/assets/audio/footstep4.mp3',
                countdownTick: '/assets/audio/countdown-tick.wav',  // Pour les "tic" normaux
                finalTick: '/assets/audio/final-tick.wav',         // Pour le dernier "tic"
                urgentTick: '/assets/audio/urgent-tick.mp3',        // Pour le timer de fin
                speedBoostActive: '/assets/audio/speed-active.mp3',
                invincibilityActive: '/assets/audio/invincibility-active.mp3',
                revealActive: '/assets/audio/reveal-active.mp3'
            };

            // Définition des musiques
            const musicToLoad = {
                menu: '/assets/audio/menu-music.mp3',
                game: '/assets/audio/game-music.mp3',
                gameOver: '/assets/audio/game-over-music.wav'
            };

            // Chargement parallèle des sons
            const soundPromises = Object.entries(soundsToLoad).map(async ([key, path]) => {
                const audio = new Audio(path);
                audio.volume = this.soundVolume;
                this.sounds.set(key, audio);
                return new Promise((resolve, reject) => {
                    audio.oncanplaythrough = resolve;
                    audio.onerror = reject;
                });
            });

            // Chargement parallèle des musiques
            const musicPromises = Object.entries(musicToLoad).map(async ([key, path]) => {
                const audio = new Audio(path);
                audio.volume = this.musicVolume;
                audio.loop = true;
                this.music.set(key, audio);
                return new Promise((resolve, reject) => {
                    audio.oncanplaythrough = resolve;
                    audio.onerror = reject;
                });
            });

            await Promise.all([...soundPromises, ...musicPromises]);
            this.isLoaded = true;
            return true;
        } catch (error) {
            console.error('Erreur lors du chargement des audios:', error);
            return false;
        }
    }

    playSpatialisedSound(soundType, volume) {
        if (this.isMuted) return;
        
        const footsteps = Array.from(this.sounds.entries())
            .filter(([key]) => key.startsWith('footstep'))
            .map(([_, sound]) => sound);
        
        if (footsteps.length === 0) {
            console.warn('Aucun son de pas trouvé');
            return;
        }
    
        const sound = footsteps[Math.floor(Math.random() * footsteps.length)];
        const clone = sound.cloneNode(); // Créer un clone pour éviter les problèmes de lecture simultanée
        
        clone.volume = this.soundVolume * volume * 0.3; // Volume réduit pour les sons distants
        clone.playbackRate = 1.0;
        
        clone.play()
           // .then(() => console.log('Son joué avec succès'))
            .catch(err => console.warn('Erreur de lecture audio:', err));
    }

    playSound(soundName) {
        if (this.isMuted || !this.sounds.has(soundName)) {
            return;
        }
        
        // Pour le son de conversion de bot, créer une nouvelle instance à chaque fois
        if (soundName === 'botConvert') {
            const sound = new Audio(this.sounds.get(soundName).src);
            sound.volume = this.soundVolume * this.volume;
            sound.play().catch(err => console.warn('Erreur de lecture audio:', err));
            return;
        }
        
        // Pour les autres sons, comportement normal
        const sound = this.sounds.get(soundName);
        
        // Pour les sons de compte à rebours, s'assurer qu'ils ne se chevauchent pas
        if (soundName.includes('Tick')) {
            sound.currentTime = 0;
        }
        
        sound.play().catch(err => console.warn('Erreur de lecture audio:', err));
    }

    playMusic(musicName) {
        if (!this.music.has(musicName)) return;

        // Arrêter la musique en cours
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
        }

        // Jouer la nouvelle musique
        const music = this.music.get(musicName);
        this.currentMusic = music;
        
        if (!this.isMuted) {
            music.play().catch(err => console.warn('Erreur de lecture musique:', err));
        }
    }
    pauseMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
        }
    }

    resumeMusic() {
        if (this.currentMusic) {
            this.currentMusic.play().catch(error => {
                console.warn('Impossible de reprendre la musique:', error);
            });
        }
    }

    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
            this.currentMusic = null;
        }
    }

    playRandomFootstep(isSpeedBoostActive) {
        if (this.isMuted) return;
        
        const footsteps = Array.from(this.sounds.entries())
            .filter(([key]) => key.startsWith('footstep'))
            .map(([_, sound]) => sound);
        
        if (footsteps.length === 0) return;

        // Son aléatoire
        const sound = footsteps[Math.floor(Math.random() * footsteps.length)];
        sound.currentTime = 0;
        sound.volume = this.soundVolume * 0.3;
        sound.play().catch(err => console.warn('Erreur de lecture audio:', err));

        // Ajuster l'intervalle en fonction du speed boost
        this.currentFootstepInterval = isSpeedBoostActive ? 
            this.SPEED_FOOTSTEP_INTERVAL : 
            this.NORMAL_FOOTSTEP_INTERVAL;

        // Programmer le prochain son si on est toujours en mouvement
        if (this.isPlayingFootsteps) {
            setTimeout(() => {
                if (this.isPlayingFootsteps) {
                    this.playRandomFootstep(isSpeedBoostActive);
                }
            }, this.currentFootstepInterval);
        }
    }

    playFootstepWithInterval(isSpeedBoostActive = false) {
        const now = Date.now();
        
        // Si on ne joue pas déjà des pas, commencer la séquence
        if (!this.isPlayingFootsteps) {
            this.isPlayingFootsteps = true;
            this.playRandomFootstep(isSpeedBoostActive);
        }
    }

    stopFootsteps() {
        this.isPlayingFootsteps = false;
    }

        // Pour jouer un son en boucle
        playLoopingSound(soundName, volume = 0.3) {
            if (this.isMuted || !this.sounds.has(soundName)) return;
    
            // Si le son est déjà en cours, ne pas le redémarrer
            if (this.activeLoopSounds.has(soundName)) return;
    
            const sound = this.sounds.get(soundName);
            const loopingSound = sound.cloneNode();
            loopingSound.loop = true;
            loopingSound.volume = this.soundVolume * volume;
            
            loopingSound.play().catch(err => console.warn('Erreur lecture audio:', err));
            this.activeLoopSounds.set(soundName, loopingSound);
        }

    // Pour arrêter un son en boucle
    stopLoopingSound(soundName) {
        const loopingSound = this.activeLoopSounds.get(soundName);
        if (loopingSound) {
            loopingSound.pause();
            loopingSound.currentTime = 0;
            this.activeLoopSounds.delete(soundName);
            console.log(`Son ${soundName} arrêté`);
        } else {
            console.log(`Son ${soundName} non trouvé dans les sons actifs`);
        }
    }


    fadeOutMusic(duration = 1000) {
        if (!this.currentMusic) return;

        const music = this.currentMusic;
        const originalVolume = music.volume;
        const steps = 50;
        const volumeStep = originalVolume / steps;
        const intervalTime = duration / steps;

        const fadeInterval = setInterval(() => {
            if (music.volume > volumeStep) {
                music.volume -= volumeStep;
            } else {
                music.pause();
                music.volume = originalVolume;
                clearInterval(fadeInterval);
            }
        }, intervalTime);
    }

    setMasterVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.updateVolumes();
    }

    setSoundVolume(volume) {
        this.soundVolume = Math.max(0, Math.min(1, volume));
        this.updateVolumes();
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        this.updateVolumes();
    }

    updateVolumes() {
        // Mettre à jour le volume de tous les sons
        this.sounds.forEach(sound => {
            sound.volume = this.soundVolume * this.volume;
        });

        // Mettre à jour le volume de toutes les musiques
        this.music.forEach(music => {
            music.volume = this.musicVolume * this.volume;
        });
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        
        // Mettre à jour tous les sons et la musique avec le nouvel état
        this.sounds.forEach(sound => {
            if (this.isMuted) {
                sound.volume = 0;
            } else {
                // Restaurer le volume précédent
                sound.volume = this.soundVolume * this.volume;
            }
        });
    
        // Gérer la musique
        if (this.currentMusic) {
            if (this.isMuted) {
                this.currentMusic.volume = 0;
            } else {
                this.currentMusic.volume = this.musicVolume * this.volume;
                // Si la musique était en cours, la reprendre
                if (!this.currentMusic.paused) {
                    this.currentMusic.play().catch(err => console.warn('Erreur de lecture audio:', err));
                }
            }
        }
    
        // Pour les sons en boucle
        this.activeLoopSounds.forEach((sound, key) => {
            if (this.isMuted) {
                sound.volume = 0;
            } else {
                sound.volume = this.soundVolume * this.volume;
                // Si le son était en cours, le reprendre
                if (!sound.paused) {
                    sound.play().catch(err => console.warn('Erreur de lecture audio:', err));
                }
            }
        });
    
        // Sauvegarder les paramètres
        this.saveSettings();
    }
    saveSettings() {
        localStorage.setItem('audioSettings', JSON.stringify({
            musicVolume: this.musicVolume,
            soundVolume: this.soundVolume,
            isMuted: this.isMuted
        }));
    }
    
    loadSettings() {
        const saved = localStorage.getItem('audioSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            this.setMusicVolume(settings.musicVolume);
            this.setSoundVolume(settings.soundVolume);
            // Ne charger l'état muted que s'il existe dans les paramètres sauvegardés
            if (settings.hasOwnProperty('isMuted')) {
                this.isMuted = settings.isMuted;
            }
        }
    }
}

export default AudioManager;