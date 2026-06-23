/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * CLIENT SYNC â€” js/client-sync.js
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *
 * Client-side module that manages per-client server registration
 * and real-time settings sync with the admin panel.
 *
 * FLOW:
 * 1. On page load â†’ register with server (POST /api/client/connect)
 * 2. Server assigns a unique clientId â†’ stored in sessionStorage
 * 3. Opens SSE stream (/api/client/stream/:id) for admin pushes
 * 4. When admin updates settings â†’ SSE pushes to this client
 * 5. ClientSync notifies listeners (BetManager, UIController)
 * 6. On page close â†’ sendBeacon to disconnect
 *
 * Each browser tab = unique clientId = isolated session.
 * Multiple users can play simultaneously without credential mixing.
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

const CLIENT_SERVER_URL = '';  // Same origin

class ClientSync {
    /**
     * @param {string} siteName - Site identifier ('interbet', 'castlebet', 'main')
     */
    constructor(siteName = 'main') {
        this.siteName = siteName;
        this.clientId = null;
        this.username = null;
        this.settings = {};
        this._settingsListeners = [];
        this._sseConnection = null;
        this._heartbeatInterval = null;
        this._registered = false;

        console.log(`[ClientSync] Initializing for site: ${siteName}`);
    }

    /**
     * Start the sync process. Must be called after construction.
     * Separated from constructor to allow listeners to be attached first.
     * @param {string} [username] - Optional display name to register with
     */
    async start(username) {
        if (username) this.username = username;

        // Try to restore existing session from this tab
        const savedId = sessionStorage.getItem('aviator_client_id');
        const savedSite = sessionStorage.getItem('aviator_client_site');

        if (savedId && savedSite === this.siteName) {
            this.clientId = savedId;
            const verified = await this._verifySession();
            if (!verified) {
                // Session expired or invalid â€” re-register
                sessionStorage.removeItem('aviator_client_id');
                sessionStorage.removeItem('aviator_client_site');
                await this._register();
            }
        } else {
            await this._register();
        }

        // Start heartbeat every 10s
        this._heartbeatInterval = setInterval(() => this._heartbeat(), 10000);

        // Disconnect on page unload (reliable via sendBeacon)
        window.addEventListener('beforeunload', () => this._disconnect());

        // Reconnect on tab wake-up
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.clientId) {
                this._heartbeat();
                if (!this._sseConnection || this._sseConnection.readyState !== EventSource.OPEN) {
                    this._connectSSE();
                }
            }
        });
    }

    /**
     * Register a listener for settings updates from admin.
     * Callback receives: { balance?, currency?, username? }
     * @param {Function} cb
     */
    onSettingsUpdate(cb) {
        this._settingsListeners.push(cb);
    }

    /**
     * Get current client settings.
     * @returns {object}
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Get the client ID.
     * @returns {string|null}
     */
    getId() {
        return this.clientId;
    }

    /**
     * Sync local balance changes to the server.
     * @param {number} newBalance
     */
    async syncBalanceToServer(newBalance) {
        if (!this.clientId) return;
        this.settings.balance = newBalance;

        // Update the clientRegistry (admin panel visibility)
        try {
            await fetch(CLIENT_SERVER_URL + '/api/client/update-balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: this.clientId, balance: newBalance })
            });
        } catch (e) { /* Silently handle */ }

        // For Interbet: also persist to the server session so refresh keeps the correct balance
        if (this.siteName === 'interbet') {
            try {
                await fetch(CLIENT_SERVER_URL + '/api/interbet/sync-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ balance: newBalance })
                });
            } catch (e) { /* Silently handle */ }
        }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• INTERNAL METHODS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * Register as a new client with the server.
     */
    async _register() {
        try {
            const savedBalance = localStorage.getItem('aviator_balance');
            const savedCurrency = localStorage.getItem('aviator_currency');
            const savedUsername = localStorage.getItem('aviator_username');

            const res = await fetch(CLIENT_SERVER_URL + '/api/client/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    site: this.siteName,
                    username: this.username || savedUsername || undefined,
                    balance: savedBalance !== null ? parseFloat(savedBalance) : undefined,
                    currency: savedCurrency || undefined
                })
            });
            const data = await res.json();

            if (data.success && data.client) {
                this.clientId = data.client.id;
                this.settings = data.client;

                // Always prefer the localStorage balance â€” it is the authoritative
                // source of truth for any local deductions (withdrawals, bets, etc.)
                // that happened before this registration call.
                if (savedBalance !== null) {
                    this.settings.balance = parseFloat(savedBalance);
                }

                this._registered = true;

                // Persist in sessionStorage (tab-scoped, not shared across tabs)
                sessionStorage.setItem('aviator_client_id', this.clientId);
                sessionStorage.setItem('aviator_client_site', this.siteName);

                // Connect to per-client SSE stream
                this._connectSSE();

                // Notify listeners with initial settings so the game UI initialises correctly
                this._notifyListeners(this.settings);

                console.log(`[ClientSync] âœ… Registered: ${this.clientId} | Site: ${this.siteName} | Balance: ${this.settings.balance} ${this.settings.currency}`);
            }
        } catch (e) {
            console.warn('[ClientSync] Registration failed:', e);
            // Retry after 3s
            setTimeout(() => this._register(), 3000);
        }
    }

    /**
     * Verify an existing session is still valid on the server.
     * @returns {boolean}
     */
    async _verifySession() {
        try {
            const res = await fetch(CLIENT_SERVER_URL + `/api/client/${this.clientId}/settings`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.client) {
                    this.settings = data.client;

                    // The server session may have a stale balance from before the last
                    // withdrawal. localStorage is the authoritative source â€” always prefer it.
                    const savedBalance = localStorage.getItem('aviator_balance');
                    if (savedBalance !== null) {
                        const localBal = parseFloat(savedBalance);
                        const settlement = window.__INTERBET_SETTLEMENT__;
                        const shouldForceInterbetSync =
                            this.siteName === 'interbet'
                            && settlement?.enabled
                            && !isNaN(localBal)
                            && localBal !== this.settings.balance;

                        if (shouldForceInterbetSync) {
                            this.settings.balance = localBal;
                            this.syncBalanceToServer(localBal);
                        } else if (localBal < this.settings.balance) {
                            // Local balance is lower â†’ a deduction happened locally that
                            // wasn't yet reflected on the server for this session.
                            this.settings.balance = localBal;
                            // Force a sync so the server catches up
                            this.syncBalanceToServer(localBal);
                        }
                    }

                    this._registered = true;
                    this._connectSSE();
                    this._notifyListeners(this.settings);
                    console.log(`[ClientSync] âœ… Restored session: ${this.clientId} | Balance: ${this.settings.balance}`);
                    return true;
                }
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Connect to the per-client SSE stream for admin â†’ client pushes.
     */
    _connectSSE() {
        if (this._sseConnection) {
            try { this._sseConnection.close(); } catch (e) { /* ignore */ }
        }

        if (!this.clientId) return;

        const streamUrl = CLIENT_SERVER_URL + `/api/client/stream/${this.clientId}`;
        try {
            this._sseConnection = new EventSource(streamUrl);
        } catch (e) {
            console.warn('[ClientSync] SSE creation failed:', e);
            return;
        }

        this._sseConnection.onopen = () => {
            console.log('[ClientSync] âœ… SSE stream connected â€” receiving admin updates');
        };

        this._sseConnection.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'SETTINGS_UPDATE' && payload.data) {
                    // Merge updates into settings
                    Object.assign(this.settings, payload.data);
                    this._notifyListeners(payload.data);
                    console.log('[ClientSync] ðŸ“¥ Settings update from admin:', payload.data);
                }
            } catch (e) {
                // Ignore parse errors (keepalive pings, etc.)
            }
        };

        this._sseConnection.onerror = () => {
            if (this._sseConnection && this._sseConnection.readyState === EventSource.CLOSED) {
                console.log('[ClientSync] SSE closed â€” reconnecting in 3s...');
                setTimeout(() => this._connectSSE(), 3000);
            }
        };
    }

    /**
     * Send heartbeat to server (keeps client marked as online).
     */
    async _heartbeat() {
        if (!this.clientId) return;
        try {
            await fetch(CLIENT_SERVER_URL + '/api/client/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: this.clientId })
            });
        } catch (e) {
            // Silently handle â€” server may be temporarily unreachable
        }
    }

    /**
     * Disconnect from server on page unload.
     * Uses sendBeacon for reliability (works even during page close).
     */
    _disconnect() {
        if (!this.clientId) return;

        const payload = JSON.stringify({ clientId: this.clientId });

        // sendBeacon is the only reliable way to send data during page unload
        if (navigator.sendBeacon) {
            navigator.sendBeacon(
                CLIENT_SERVER_URL + '/api/client/disconnect',
                payload
            );
        } else {
            // Fallback (unreliable during unload, but better than nothing)
            fetch(CLIENT_SERVER_URL + '/api/client/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            }).catch(() => { });
        }
    }

    /**
     * Notify all registered listeners of a settings change.
     * @param {object} data - The changed fields
     */
    _notifyListeners(data) {
        this._settingsListeners.forEach(cb => {
            try { cb(data); } catch (e) {
                console.error('[ClientSync] Listener error:', e);
            }
        });
    }
}