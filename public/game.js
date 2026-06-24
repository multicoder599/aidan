/*
 * GAME ENGINE — js/game.js (Server-Authoritative)
 * The server is the ONLY source of truth for crash points.
 * Client never generates local crash points.
 */

const SERVER_URL = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL.replace('/api', '') : 'https://aviatorguru.site';

const GameStates = {
    WAITING: 'waiting',
    FLYING: 'flying',
    CRASHED: 'crashed',
    COOLDOWN: 'cooldown'
};

class GameEngine {
    constructor(renderer, betManager, soundManager = null) {
        this.renderer = renderer;
        this.betManager = betManager;
        this.soundManager = soundManager;

        this.roundNumber = 0;
        this.serverCrashPoint = null;
        this.crashPoint = 2.00;

        this._currentRoundId = 0;
        this._crashPointLocked = false;

        this.state = GameStates.WAITING;
        this.multiplier = 1.00;
        this.stateStartTime = 0;
        this.countdown = 10;
        this.lastCrashMultiplier = null;
        this.rafId = null;

        this.fps = 0;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;

        this.history = [];
        this._stateListeners = [];
        this._multiplierListeners = [];
        this._historyListeners = [];
        this._progressListeners = [];

        console.log('[Game] Engine ready — Server Authoritative | Sound:', soundManager ? 'enabled' : 'disabled');

        setInterval(() => this._syncStateFromServer(), 1000);

        this._lastSyncTime = Date.now();
        this._roundStartTime = null;
        this._gameLoopRunning = false;
    }

    onStateChange(cb) { this._stateListeners.push(cb); }
    onMultiplierUpdate(cb) { this._multiplierListeners.push(cb); }
    onHistoryUpdate(cb) { this._historyListeners.push(cb); }
    onProgress(cb) { this._progressListeners.push(cb); }

    _emitStateChange(newState, oldState, data = {}) {
        this._stateListeners.forEach(cb => cb(newState, oldState, data));
    }
    _emitMultiplier(m) { this._multiplierListeners.forEach(cb => cb(m)); }
    _emitHistory() { this._historyListeners.forEach(cb => cb([...this.history])); }
    _emitProgress(pct, s) { this._progressListeners.forEach(cb => cb(pct, s)); }

    async _syncStateFromServer() {
        try {
            const res = await fetch(SERVER_URL + '/api/prediction');
            const data = await res.json();
            if (!res.ok) return;

            this._lastSyncTime = Date.now();

            // Always update the known next crash point from server
            if (data.prediction && data.prediction >= 1.00) {
                this.serverCrashPoint = data.prediction;
                this._crashPointLocked = true;
                console.log(`[Game] Server next crash point: ${data.prediction}x (state: ${data.gameState})`);
            }

            const isRoundOverLocally = (this.state === GameStates.CRASHED || this.state === GameStates.COOLDOWN);

            if (data.gameState === 'waiting') {
                if (this.state === GameStates.FLYING) return; // Don't interrupt flying
                if (isRoundOverLocally) return; // Still showing crash
                if (this.state !== GameStates.WAITING) {
                    console.log('[Game] Server says WAITING — transitioning');
                    this._transitionToWaiting();
                }
                // Update countdown based on server elapsed
                const waitElapsed = data.waitElapsedMs || 0;
                this.countdown = Math.max(0, 5 - (waitElapsed / 1000));
                this.stateStartTime = performance.now() - waitElapsed;
            } else if (data.gameState === 'flying') {
                if (isRoundOverLocally) return;
                if (this.state === GameStates.FLYING) {
                    // Already flying, just sync crash point if we didn't have it
                    if (data.currentCrashPoint && this.crashPoint !== data.currentCrashPoint) {
                        this.crashPoint = data.currentCrashPoint;
                    }
                    return;
                }
                if (this.state === GameStates.WAITING) {
                    // Server says fly — use the crash point we should have received
                    if (this.serverCrashPoint !== null) {
                        this.crashPoint = this.serverCrashPoint;
                        this.serverCrashPoint = null;
                        console.log(`[Game] Server flying — using crash point ${this.crashPoint}x`);
                    } else {
                        // Edge case: we missed the prediction. Try to get it now.
                        try {
                            const nextRes = await fetch(SERVER_URL + '/api/next', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({round: data.roundNumber}) });
                            const nextData = await nextRes.json();
                            if (nextData.crashPoint) {
                                this.crashPoint = nextData.crashPoint;
                                console.log(`[Game] Fetched crash point late: ${this.crashPoint}x`);
                            }
                        } catch (e) {
                            console.warn('[Game] Could not fetch late crash point');
                        }
                    }
                    this._transitionToFlying(false, data.elapsedMs);
                }
            } else if (data.gameState === 'crashed') {
                if (this.state === GameStates.CRASHED || this.state === GameStates.COOLDOWN) return;
                // Force crash at server's crash point
                if (data.currentCrashPoint) this.crashPoint = data.currentCrashPoint;
                this._startCrashed();
            }
        } catch (e) { /* silent — connection issues expected */ }
    }

    _transitionToWaiting() {
        this._setState(GameStates.WAITING);
        this.multiplier = 1.00;
        this._roundStartTime = null;
        this._updateWaitingUI();
    }

    _transitionToFlying(wasInBackground, elapsedMs) {
        if (this.state !== GameStates.FLYING) {
            this._setState(GameStates.FLYING);
        }
        if (!this._roundStartTime || wasInBackground) {
            if (elapsedMs !== undefined && elapsedMs > 0) {
                this.stateStartTime = performance.now() - elapsedMs;
                console.log(`[Game] Synced time: ${elapsedMs}ms elapsed`);
            } else {
                this.stateStartTime = performance.now();
            }
        }
        if (!this.rafId) this._loop();
    }

    _updateWaitingUI() { /* Logic handled in render() */ }

    _setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.stateStartTime = performance.now();
        this._emitStateChange(newState, oldState, {
            multiplier: this.multiplier,
            crashPoint: this.crashPoint
        });
    }

    _startWaiting() {
        this.roundNumber++;
        this._setState(GameStates.WAITING);
        this.multiplier = 1.00;
        this.countdown = 10;
        this.betManager.clearBets();
        this.renderer.lastPlanePos = null;
        this._crashPointLocked = false;
        // Server already has the crash point ready — we just wait for it via polling
    }

    _startFlying() {
        // Crash point MUST come from server. If we don't have it, we shouldn't fly.
        if (this.serverCrashPoint !== null) {
            this.crashPoint = this.serverCrashPoint;
            this.serverCrashPoint = null;
            console.log(`[Game] Round ${this.roundNumber}: Using SERVER value ${this.crashPoint.toFixed(2)}x`);
        } else {
            console.warn(`[Game] Round ${this.roundNumber}: No server crash point yet! Waiting...`);
            // Don't start flying — the sync loop will catch up when server point arrives
            return;
        }

        this._setState(GameStates.FLYING);
        this.multiplier = 1.00;
        console.log(`[Game] Flying -> crash at ${this.crashPoint.toFixed(2)}x`);
        if (this.soundManager) this.soundManager.startBackground();
    }

    _startCrashed() {
        this.multiplier = this.crashPoint;
        this.betManager.settleBets();
        this.lastCrashMultiplier = this.crashPoint;
        this.history.unshift(parseFloat(this.crashPoint.toFixed(2)));
        if (this.history.length > 50) this.history.pop();
        this._emitHistory();
        this._setState(GameStates.CRASHED);
        this.renderer.crashAnimProgress = 0;
        if (this.soundManager) {
            this.soundManager.playCrash();
            this.soundManager.stopBackground();
        }
    }

    _startCooldown() {
        this._setState(GameStates.COOLDOWN);
    }

    async start() {
        console.log('[Game] Starting — syncing to server state...');
        this._loop();
        try {
            const res = await fetch(SERVER_URL + '/api/prediction');
            const data = await res.json();
            if (!res.ok) {
                console.warn('[Game] Server unreachable — starting fresh');
                this._startWaiting();
                return;
            }
            if (data.gameState === 'flying' && data.currentCrashPoint) {
                this.crashPoint = data.currentCrashPoint;
                this.roundNumber = data.roundNumber || 1;
                console.log(`[Game] Joining mid-flight: ${data.currentCrashPoint}x (${data.elapsedMs}ms in)`);
                this._transitionToFlying(false, data.elapsedMs);
            } else if (data.gameState === 'waiting' && data.prediction) {
                this.serverCrashPoint = data.prediction;
                this._crashPointLocked = true;
                this.roundNumber = data.roundNumber || 1;
                this._setState(GameStates.WAITING);
                this.multiplier = 1.00;
                this.countdown = 10;
                this.betManager.clearBets();
                this.renderer.lastPlanePos = null;
                const waitElapsed = data.waitElapsedMs || 0;
                this.stateStartTime = performance.now() - waitElapsed;
                console.log(`[Game] Joining countdown: ${data.prediction}x (${(waitElapsed/1000).toFixed(1)}s in)`);
            } else if (data.gameState === 'crashed' && data.currentCrashPoint) {
                this.crashPoint = data.currentCrashPoint;
                this.lastCrashMultiplier = data.currentCrashPoint;
                this.roundNumber = data.roundNumber || 1;
                this._setState(GameStates.CRASHED);
                this.renderer.crashAnimProgress = 1;
                const crashElapsed = data.crashElapsedMs || 0;
                this.stateStartTime = performance.now() - crashElapsed;
                console.log(`[Game] Joining crash display: ${data.currentCrashPoint}x (${(crashElapsed/1000).toFixed(1)}s in)`);
            } else {
                this._startWaiting();
            }
            console.log('[Game] Synced to server — loop running');
        } catch (err) {
            console.warn('[Game] Server sync failed, starting fresh:', err);
            this._startWaiting();
        }
    }

    stop() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    _loop() {
        this.rafId = requestAnimationFrame(() => this._loop());
        this._trackFPS();
        const now = performance.now();
        const elapsed = (now - this.stateStartTime) / 1000;
        switch (this.state) {
            case GameStates.WAITING: this._updateWaiting(elapsed); break;
            case GameStates.FLYING: this._updateFlying(elapsed); break;
            case GameStates.CRASHED: this._updateCrashed(elapsed); break;
            case GameStates.COOLDOWN: this._updateCooldown(elapsed); break;
        }
    }

    _updateWaiting(elapsed) {
        this.countdown = Math.max(0, 5 - elapsed);
        this._emitProgress((this.countdown / 5) * 100, this.countdown);
        const fadeProgress = Math.min(elapsed / 2, 1);
        const flewAwayOpacity = Math.max(0, 1 - fadeProgress);
        this.renderer.renderWaiting(
            this.countdown,
            this.lastCrashMultiplier ? flewAwayOpacity : 0,
            this.lastCrashMultiplier
        );
        if (elapsed >= 5) {
            // Only fly if we have a server crash point
            if (this.serverCrashPoint !== null || this.crashPoint > 1) {
                this._startFlying();
            } else {
                console.log('[Game] Waiting for server crash point...');
            }
        }
    }

    _updateFlying(elapsed) {
        this.multiplier = 1.00 * Math.exp(0.10 * elapsed);
        this._emitMultiplier(this.multiplier);
        for (const panelId of [1, 2]) {
            if (this.betManager.hasBetActive(panelId) &&
                this.betManager.shouldAutoCashOut(panelId, this.multiplier)) {
                this.betManager.cashOut(panelId, this.multiplier);
                this._emitStateChange(this.state, this.state, {
                    autoCashOut: true, panelId, multiplier: this.multiplier
                });
            }
        }
        this.renderer.renderFlying(this.multiplier);
        if (this.multiplier >= this.crashPoint) {
            this._startCrashed();
        }
    }

    _updateCrashed(elapsed) {
        const animDuration = 0.8;
        const rawProgress = Math.min(elapsed / animDuration, 1);
        const animProgress = 1 - Math.pow(1 - rawProgress, 3);
        this.renderer.renderCrashed(this.crashPoint, animProgress);
        if (elapsed >= 3) { this._startCooldown(); }
    }

    _updateCooldown(elapsed) {
        const fadeProgress = Math.min(elapsed / 0.5, 1);
        this.renderer.renderCooldown(this.crashPoint, fadeProgress);
        if (elapsed >= 2) { this._startWaiting(); }
    }

    _trackFPS() {
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.fps = delta > 0 ? Math.round(1000 / delta) : 60;
        this.lastFrameTime = now;
        this.frameCount++;
    }
}