/*
 * GAME ENGINE — js/game.js (Standalone Fixed)
 * Server-backed with robust standalone fallback.
 */

const SERVER_URL = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL.replace('/api', '') : 'http://213.199.41.83:3041';

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

        this.adminChannel = new BroadcastChannel('aviator_game_channel');
        this.adminChannel.onmessage = (e) => this._handleAdminMessage(e);

        this.roundNumber = 0;
        this.serverCrashPoint = null;
        this.adminCrashPoint = null;
        this.crashPoint = 2.00;

        this._currentRoundId = 0;
        this._crashPointLocked = false;
        this._localFallbackTimer = null;

        this.state = GameStates.WAITING;
        this.multiplier = 1.00;
        this.stateStartTime = 0;
        this.countdown = 5;
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

        console.log('[Game] Engine ready — Standalone Fixed | Sound:', soundManager ? 'enabled' : 'disabled');

        setInterval(() => this._sendHeartbeat(), 10000);
        setInterval(() => this._syncStateFromServer(), 2000);

        this._lastSyncTime = Date.now();
        this._roundStartTime = null;
        this._gameLoopRunning = false;

        this._gameSSE = null;
        this._connectGameSSE();

        this._setupVisibilityHandler();
    }

    _setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('[Game] Tab visible again - forcing sync');
                this._syncStateFromServer();
                if (!this._gameSSE || this._gameSSE.readyState !== EventSource.OPEN) {
                    this._connectGameSSE();
                }
            }
        });
        window.addEventListener('focus', () => {
            console.log('[Game] Window focused - forcing sync');
            this._syncStateFromServer();
            if (!this._gameSSE || this._gameSSE.readyState !== EventSource.OPEN) {
                this._connectGameSSE();
            }
        });
    }

    async _sendHeartbeat() {
        try { await fetch(SERVER_URL + '/api/heartbeat', { method: 'POST' }); }
        catch (e) { /* silent */ }
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

    _generateLocalCrashPoint() {
        const r = Math.random();
        if (r < 0.4) return 1.00 + Math.random() * 1.00;
        if (r < 0.7) return 2.00 + Math.random() * 3.00;
        if (r < 0.9) return 5.00 + Math.random() * 5.00;
        return 10.00 + Math.random() * 90.00;
    }

    async _requestCrashPointFromServer(round, retryCount = 0) {
        try {
            const res = await fetch(SERVER_URL + '/api/next', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ round })
            });
            const data = await res.json();
            if (data.crashPoint) {
                this.serverCrashPoint = data.crashPoint;
                this._crashPointLocked = true;
                console.log(`[Game] Locked crash point from server: ${this.serverCrashPoint}x`);
                this.adminChannel.postMessage({
                    type: 'PREDICTION_UPDATE',
                    data: { crashPoint: data.crashPoint, round: round, source: 'server' }
                });
            } else if (!res.ok && retryCount < 3) {
                const delay = 1000 * (retryCount + 1);
                console.log(`[Game] /api/next failed (attempt ${retryCount + 1}), retrying in ${delay}ms...`);
                setTimeout(() => this._requestCrashPointFromServer(round, retryCount + 1), delay);
            }
        } catch (e) {
            if (retryCount < 3) {
                const delay = 1000 * (retryCount + 1);
                console.log(`[Game] /api/next error (attempt ${retryCount + 1}), retrying in ${delay}ms...`);
                setTimeout(() => this._requestCrashPointFromServer(round, retryCount + 1), delay);
            } else {
                console.error('[Game] Failed to request next round after 3 retries:', e);
            }
        }
    }

    async _syncStateFromServer() {
        try {
            const res = await fetch(SERVER_URL + '/api/prediction');
            const data = await res.json();
            if (!res.ok) return;
            const now = Date.now();
            const timeSinceLastSync = now - this._lastSyncTime;
            const wasInBackground = timeSinceLastSync > 15000;
            this._lastSyncTime = now;
            if (wasInBackground) {
                console.log(`[Game] Recovering from background (${(timeSinceLastSync / 1000).toFixed(1)}s gap)`);
            }
            const isRoundOverLocally = (this.state === GameStates.CRASHED || this.state === GameStates.COOLDOWN);
            const waitingElapsed = (this.state === GameStates.WAITING)
                ? (performance.now() - this.stateStartTime) / 1000
                : 0;
            if (data.gameState === 'waiting') {
                if (this.state === GameStates.FLYING) return;
                if (isRoundOverLocally) return;
                if (data.prediction && this.serverCrashPoint === null) {
                    this.serverCrashPoint = data.prediction;
                    this._crashPointLocked = true;
                    console.log(`[Game] Preloaded crash point from server: ${data.prediction}x`);
                    this.adminChannel.postMessage({
                        type: 'PREDICTION_UPDATE',
                        data: { crashPoint: data.prediction, round: this.roundNumber, source: 'server' }
                    });
                }
                if (this.state !== GameStates.WAITING) {
                    console.log('[Game] Transitioning to WAITING');
                    this._transitionToWaiting();
                }
            } else if (data.gameState === 'flying') {
                if (isRoundOverLocally) return;
                if (this.state === GameStates.FLYING) return;
                if (this.state === GameStates.WAITING && waitingElapsed < 4.5) {
                    if (data.currentCrashPoint && this.serverCrashPoint !== data.currentCrashPoint) {
                        this.serverCrashPoint = data.currentCrashPoint;
                        console.log(`[Game] Pre-loaded crash point from server: ${this.serverCrashPoint}x`);
                    }
                    return;
                }
                if (data.currentCrashPoint && this.serverCrashPoint !== data.currentCrashPoint) {
                    this.serverCrashPoint = data.currentCrashPoint;
                }
                console.log('[Game] Server flying - syncing from waiting');
                this._transitionToFlying(false, data.elapsedMs);
            }
        } catch (e) { /* silent — connection issues expected in standalone */ }
    }

    _connectGameSSE() {
        if (this._gameSSE) { try { this._gameSSE.close(); } catch (e) {} }
        const streamUrl = SERVER_URL + '/api/predictor-stream';
        try { this._gameSSE = new EventSource(streamUrl); }
        catch (e) { console.warn('[Game] SSE creation failed:', e); return; }
        this._gameSSE.onopen = () => { console.log('[Game] SSE connected'); };
        this._gameSSE.onmessage = (event) => {
            try { const data = JSON.parse(event.data); this._handleSSEData(data); }
            catch (e) { console.warn('[Game] SSE parse error:', e); }
        };
        this._gameSSE.onerror = () => {
            if (this._gameSSE && this._gameSSE.readyState === EventSource.CLOSED) {
                console.log('[Game] SSE closed — reconnecting in 3s...');
                setTimeout(() => this._connectGameSSE(), 3000);
            }
        };
    }

    _handleSSEData(data) {
        const isRoundOverLocally = (this.state === GameStates.CRASHED || this.state === GameStates.COOLDOWN);
        const waitingElapsed = (this.state === GameStates.WAITING)
            ? (performance.now() - this.stateStartTime) / 1000
            : 0;
        if (data.gameState === 'waiting') {
            if (this.state === GameStates.FLYING) return;
            if (isRoundOverLocally) return;
            if (data.prediction && this.serverCrashPoint === null) {
                this.serverCrashPoint = data.prediction;
                this._crashPointLocked = true;
                console.log(`[Game][SSE] Preloaded crash point: ${data.prediction}x`);
                this.adminChannel.postMessage({
                    type: 'PREDICTION_UPDATE',
                    data: { crashPoint: data.prediction, round: this.roundNumber, source: 'server' }
                });
            }
            if (this.state !== GameStates.WAITING) {
                console.log('[Game][SSE] Transitioning to WAITING');
                this._transitionToWaiting();
            }
        } else if (data.gameState === 'flying') {
            if (isRoundOverLocally) return;
            if (this.state === GameStates.FLYING) return;
            if (this.state === GameStates.WAITING && waitingElapsed < 4.5) {
                if (data.currentCrashPoint && this.serverCrashPoint !== data.currentCrashPoint) {
                    this.serverCrashPoint = data.currentCrashPoint;
                    console.log(`[Game][SSE] Pre-loaded crash point: ${this.serverCrashPoint}x`);
                }
                return;
            }
            if (data.currentCrashPoint && this.serverCrashPoint !== data.currentCrashPoint) {
                this.serverCrashPoint = data.currentCrashPoint;
            }
            console.log('[Game][SSE] Server flying — syncing');
            this._transitionToFlying(false, data.elapsedMs);
        }
    }

    _transitionToWaiting() {
        this._setState(GameStates.WAITING);
        this.multiplier = 1.00;
        this._roundStartTime = null;
        this._updateWaitingUI();
    }

    _transitionToFlying(wasInBackground, elapsedMs) {
        if (this.serverCrashPoint !== null && this.state !== GameStates.FLYING) {
            this.crashPoint = this.serverCrashPoint;
            this.serverCrashPoint = null;
            this.adminCrashPoint = null;
            console.log(`[Game] Sync transition: Using SERVER value ${this.crashPoint.toFixed(2)}x`);
        } else if (this.adminCrashPoint !== null && this.state !== GameStates.FLYING) {
            this.crashPoint = this.adminCrashPoint;
            this.adminCrashPoint = null;
            console.log(`[Game] Sync transition: Using BroadcastChannel value ${this.crashPoint.toFixed(2)}x`);
        } else if (this.state !== GameStates.FLYING) {
            this.crashPoint = this._generateLocalCrashPoint();
            console.warn(`[Game] Sync transition: No server value, local fallback ${this.crashPoint.toFixed(2)}x`);
        }
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
        this._ensureGameLoopRunning();
    }

    _ensureGameLoopRunning() {
        if (!this.rafId) {
            console.log('[Game] Restarting game loop');
            this._loop();
        }
    }

    _updateWaitingUI() { /* Logic handled in render() */ }

    async _notifyServerFlying(round, crashPoint) {
        try {
            await fetch(SERVER_URL + '/api/flying', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ round, crashPoint })
            });
        } catch (err) { /* non-critical */ }
    }

    async _notifyServerComplete(round, crashPoint) {
        try {
            await fetch(SERVER_URL + '/api/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ round, crashPoint })
            });
        } catch (err) { /* non-critical */ }
    }

    async _notifyServerState(state) {
        try {
            await fetch(SERVER_URL + '/api/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state })
            });
        } catch (err) { /* non-critical */ }
    }

    _handleAdminMessage(event) {
        const { type, data } = event.data;
        switch (type) {
            case 'NEXT_CRASH_POINT':
                if (this.serverCrashPoint === null) {
                    const cp = parseFloat(data.crashPoint);
                    if (!isNaN(cp) && cp >= 1.0) {
                        this.adminCrashPoint = cp;
                        console.log('[Game] BroadcastChannel crash point stored:', this.adminCrashPoint.toFixed(2));
                        this.adminChannel.postMessage({
                            type: 'PREDICTION_UPDATE',
                            data: {
                                crashPoint: cp,
                                round: data.round || (this.roundNumber + 1),
                                source: 'admin'
                            }
                        });
                    }
                }
                break;
            case 'PONG':
                break;
            case 'SET_BALANCE':
                if (data && data.amount !== undefined) { this.betManager.setBalance(data.amount); }
                break;
            case 'SET_CURRENCY':
                if (data && data.code) { this.betManager.setCurrency(data.code); }
                break;
            case 'SET_USERNAME':
                if (data && data.name) { this.betManager.setUsername(data.name); }
                break;
        }
    }

    _setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.stateStartTime = performance.now();
        this._emitStateChange(newState, oldState, {
            multiplier: this.multiplier,
            crashPoint: this.crashPoint
        });
        this.adminChannel.postMessage({
            type: 'GAME_STATE',
            data: { state: newState, round: this.roundNumber, multiplier: this.multiplier }
        });
    }

    _startWaiting() {
        this.roundNumber++;
        this._setState(GameStates.WAITING);
        this.multiplier = 1.00;
        this.countdown = 5;
        this.betManager.clearBets();
        this.renderer.lastPlanePos = null;
        this._crashPointLocked = false;

        this._requestCrashPointFromServer(this.roundNumber);

        this.adminChannel.postMessage({
            type: 'REQUEST_CRASH_POINT',
            data: { round: this.roundNumber }
        });

        // STANDALONE FIX: Generate local fallback immediately so the game never stalls
        // and the predictor gets maximum lead time. Server/admin can override later.
        if (this.serverCrashPoint === null && this.adminCrashPoint === null) {
            const localCrash = this._generateLocalCrashPoint();
            this.adminCrashPoint = localCrash;
            console.log(`[Game] Standalone fallback generated for round ${this.roundNumber}: ${localCrash.toFixed(2)}x`);
            this.adminChannel.postMessage({
                type: 'PREDICTION_UPDATE',
                data: { crashPoint: localCrash, round: this.roundNumber, source: 'local' }
            });
        }

        // Safety net: if somehow nothing is available after 8 seconds, force local
        if (this._localFallbackTimer) clearTimeout(this._localFallbackTimer);
        this._localFallbackTimer = setTimeout(() => {
            if (this.state === GameStates.WAITING && this.serverCrashPoint === null && this.adminCrashPoint === null) {
                const emergency = this._generateLocalCrashPoint();
                this.adminCrashPoint = emergency;
                console.log(`[Game] Emergency fallback triggered: ${emergency.toFixed(2)}x`);
                this.adminChannel.postMessage({
                    type: 'PREDICTION_UPDATE',
                    data: { crashPoint: emergency, round: this.roundNumber, source: 'emergency' }
                });
            }
        }, 8000);

        fetch(SERVER_URL + '/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: 'waiting' })
        }).catch(() => { });

        if (this.soundManager) { this.soundManager.stopBackground(); }
    }

    _startFlying() {
        if (this._localFallbackTimer) {
            clearTimeout(this._localFallbackTimer);
            this._localFallbackTimer = null;
        }
        if (this.serverCrashPoint !== null) {
            this.crashPoint = this.serverCrashPoint;
            this.serverCrashPoint = null;
            this.adminCrashPoint = null;
            console.log(`[Game] Round ${this.roundNumber}: Using SERVER value ${this.crashPoint.toFixed(2)}x`);
        } else if (this.adminCrashPoint !== null) {
            this.crashPoint = this.adminCrashPoint;
            this.adminCrashPoint = null;
            console.log(`[Game] Round ${this.roundNumber}: Using BroadcastChannel value ${this.crashPoint.toFixed(2)}x`);
        } else {
            this.crashPoint = this._generateLocalCrashPoint();
            console.warn(`[Game] Round ${this.roundNumber}: No server/admin value, local fallback ${this.crashPoint.toFixed(2)}x`);
        }

        this._notifyServerFlying(this.roundNumber, this.crashPoint);
        this.adminChannel.postMessage({
            type: 'FLYING_WITH',
            data: { round: this.roundNumber, crashPoint: this.crashPoint }
        });

        this._setState(GameStates.FLYING);
        this.multiplier = 1.00;
        console.log(`[Game] Flying -> crash at ${this.crashPoint.toFixed(2)}x`);

        if (this.soundManager) { this.soundManager.startBackground(); }
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
        this._notifyServerState('crashed');
        if (this.soundManager) {
            this.soundManager.playCrash();
            this.soundManager.stopBackground();
        }

        // PRE-LOAD NEXT ROUND: request crash point early so predictor has 10s lead time
        const nextRound = this.roundNumber + 1;
        setTimeout(() => {
            if (this.serverCrashPoint === null && this.adminCrashPoint === null) {
                const localCrash = this._generateLocalCrashPoint();
                this.adminCrashPoint = localCrash;
                console.log(`[Game] Pre-loaded local fallback for round ${nextRound}: ${localCrash.toFixed(2)}x`);
                this.adminChannel.postMessage({
                    type: 'PREDICTION_UPDATE',
                    data: { crashPoint: localCrash, round: nextRound, source: 'local' }
                });
            }
            this._requestCrashPointFromServer(nextRound);
            this.adminChannel.postMessage({
                type: 'REQUEST_CRASH_POINT',
                data: { round: nextRound }
            });
        }, 0);
    }

    _startCooldown() {
        this._setState(GameStates.COOLDOWN);
        this._notifyServerComplete(this.roundNumber, this.crashPoint);
        this.adminChannel.postMessage({
            type: 'ROUND_COMPLETE',
            data: { round: this.roundNumber, crashPoint: this.crashPoint }
        });
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
                this.serverCrashPoint = data.currentCrashPoint;
                this._crashPointLocked = true;
                this.roundNumber++;
                console.log(`[Game] Joining mid-flight: ${data.currentCrashPoint}x (${data.elapsedMs}ms in)`);
                this._transitionToFlying(false, data.elapsedMs);
            } else if (data.gameState === 'waiting' && data.prediction) {
                this.serverCrashPoint = data.prediction;
                this._crashPointLocked = true;
                this.roundNumber++;
                this._setState(GameStates.WAITING);
                this.multiplier = 1.00;
                this.countdown = 5;
                this.betManager.clearBets();
                this.renderer.lastPlanePos = null;
                const waitElapsed = data.waitElapsedMs || 0;
                this.stateStartTime = performance.now() - waitElapsed;
                console.log(`[Game] Joining countdown: ${data.prediction}x (${(waitElapsed / 1000).toFixed(1)}s in)`);
            } else if (data.gameState === 'crashed' && data.prediction) {
                this.crashPoint = data.prediction;
                this.lastCrashMultiplier = data.prediction;
                this.roundNumber++;
                this._setState(GameStates.CRASHED);
                this.renderer.crashAnimProgress = 1;
                const crashElapsed = data.crashElapsedMs || 0;
                this.stateStartTime = performance.now() - crashElapsed;
                console.log(`[Game] Joining crash display: ${data.prediction}x (${(crashElapsed / 1000).toFixed(1)}s in)`);
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
            if (this.serverCrashPoint !== null || this.adminCrashPoint !== null) {
                this._startFlying();
            } else if (elapsed >= 8) {
                console.log('[Game] No crash point available after 8s — generating emergency fallback');
                this.adminCrashPoint = this._generateLocalCrashPoint();
                this._startFlying();
            } else {
                if (Math.floor(elapsed * 10) % 10 === 0) {
                    console.log('[Game] Waiting for crash point...');
                }
            }
        }
    }

    _updateFlying(elapsed) {
        this.multiplier = 1.00 * Math.exp(0.15 * elapsed);
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