/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * SOUND MANAGER â€” js/sounds.js (v2 â€” Fixed Unlock)
 * Handles game sound effects and background music
 *
 * Fixes:
 *  - Unlock no longer plays crash sound audibly on first click
 *  - Uses silent AudioContext.resume() for reliable unlock
 *  - Background music starts on first interaction (correct)
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

class SoundManager {
    constructor() {
        /** @type {HTMLAudioElement} Background loop during flight */
        this.bgSound = new Audio('assets/aviator_main_sound.mp3');
        this.bgSound.loop = true;
        this.bgSound.volume = 0.3;

        /** @type {HTMLAudioElement} Crash sound effect */
        this.crashSound = new Audio('assets/crash_sound.mp3');
        this.crashSound.volume = 0.5;

        /** @type {boolean} Whether sounds are enabled */
        this.enabled = true;

        /** @type {boolean} Whether background sound is currently playing */
        this.isPlaying = false;

        /** @type {boolean} Whether audio has been unlocked */
        this._unlocked = false;

        // Load mute preference from localStorage
        try {
            const savedMute = localStorage.getItem('aviator_sound_muted');
            if (savedMute === 'true') {
                this.enabled = false;
            }
        } catch (err) {
            console.warn('Failed to load sound preference:', err);
        }

        // Setup Autoplay Unlock
        this._setupUnlockListeners();

        console.log('[Sound] Manager initialized | Enabled:', this.enabled);
    }

    /**
     * Listen for user interaction to unlock audio context/autoplay.
     * FIXED: No longer plays crash sound on first click.
     * Uses AudioContext.resume() for silent unlock, then preloads sounds.
     * @private
     */
    _setupUnlockListeners() {
        const unlock = () => {
            if (this._unlocked) return;
            this._unlocked = true;

            // 1. Silently unlock the audio context (no audible sound)
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    const ctx = new AudioCtx();
                    // Create a silent buffer and play it to unlock
                    const buffer = ctx.createBuffer(1, 1, 22050);
                    const source = ctx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(ctx.destination);
                    source.start(0);
                    // Resume the context if suspended
                    if (ctx.state === 'suspended') {
                        ctx.resume();
                    }
                }
            } catch (e) {
                console.warn('[Sound] AudioContext unlock failed:', e);
            }

            // 2. Preload crash sound without playing it
            //    Just load the data so it's ready for instant playback
            if (this.crashSound) {
                this.crashSound.load();
            }

            // 3. Start background music on first interaction
            if (this.enabled && !this.isPlaying) {
                this.bgSound.play().then(() => {
                    this.isPlaying = true;
                    console.log('[Sound] Background music started (continuous)');
                }).catch(e => {
                    console.warn('[Sound] Background autoplay failed:', e);
                });
            }

            // Remove listeners after first unlock
            ['click', 'touchstart', 'keydown'].forEach(event => {
                document.removeEventListener(event, unlock);
            });

            console.log('[Sound] Audio unlocked');
        };

        ['click', 'touchstart', 'keydown'].forEach(event => {
            document.addEventListener(event, unlock);
        });
    }

    /**
     * Start background sound (continuous - does not reset position)
     * Music keeps playing across rounds without interruption
     */
    startBackground() {
        if (!this.enabled || this.isPlaying) return;

        try {
            // Do NOT reset currentTime â€” let the music continue from where it is
            this.bgSound.play().catch(err => {
                console.warn('[Sound] Autoplay prevented. Waiting for interaction...', err);
            });
            this.isPlaying = true;
            console.log('[Sound] Background started (continuous)');
        } catch (err) {
            console.warn('[Sound] Error starting background:', err);
        }
    }

    /**
     * Stop background sound â€” NOW A NO-OP
     * Background music plays continuously and never stops between rounds
     */
    stopBackground() {
        // Intentionally empty â€” background music plays continuously
        // Only toggle() can stop the music
    }

    /**
     * Play crash sound effect
     */
    playCrash() {
        if (!this.enabled) return;

        try {
            if (this.crashSound) {
                this.crashSound.currentTime = 0;
                this.crashSound.play().catch(err => {
                    console.warn('[Sound] Failed to play crash file:', err);
                });
                console.log('[Sound] Crash sound played');
            }
        } catch (err) {
            console.warn('[Sound] Error playing crash:', err);
        }
    }

    /**
     * Toggle sound on/off
     * @returns {boolean} New enabled state
     */
    toggle() {
        this.enabled = !this.enabled;

        // Save preference
        try {
            localStorage.setItem('aviator_sound_muted', (!this.enabled).toString());
        } catch (err) {
            console.warn('[Sound] Failed to save preference:', err);
        }

        // Stop/start background based on toggle
        if (!this.enabled && this.isPlaying) {
            this.bgSound.pause();
            this.isPlaying = false;
        } else if (this.enabled && !this.isPlaying) {
            this.bgSound.play().catch(() => { });
            this.isPlaying = true;
        }

        console.log('[Sound] Toggled:', this.enabled ? 'ON' : 'OFF');
        return this.enabled;
    }

    /**
     * Set volume (0.0 to 1.0)
     * @param {number} volume
     */
    setVolume(volume) {
        const clamped = Math.max(0, Math.min(1, volume));
        this.bgSound.volume = clamped;
        console.log('[Sound] Volume set to:', clamped);
    }
}