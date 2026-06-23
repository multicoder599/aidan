/**
 * ═══════════════════════════════════════════════
 * MAIN ENTRY POINT — js/main.js
 * Initializes all modules with backend integration
 * v9 — MongoDB backend, USD currency, global auth
 * ═══════════════════════════════════════════════
 */

(function () {
    'use strict';

    // Set global API base URL before any other scripts run
    window.API_BASE_URL = window.location.hostname === 'localhost' 
      ? 'http://localhost:3041/api' 
      : 'http://213.199.41.83:3041/api';

    // Once you have SSL on aviatorguru.site, change to:
    // window.API_BASE_URL = 'https://aviatorguru.site/api';

    /* ═══════ GLOBAL ERROR HANDLER ═══════ */
    window.addEventListener('error', (e) => {
        console.error('Game Error:', e.error || e.message);
    });

    window.addEventListener('unhandledrejection', (e) => {
        console.error('Unhandled Promise Rejection:', e.reason);
    });

    /* ═══════ SITE DETECTION ═══════ */
    function detectSiteName() {
        const bodyAttr = document.body.getAttribute('data-site');
        if (bodyAttr) return bodyAttr;
        const path = window.location.pathname.toLowerCase();
        if (path.includes('/interbet')) return 'interbet';
        if (path.includes('/castlebet')) return 'castlebet';
        return 'main';
    }

    /* ═══════ BOOT SEQUENCE ═══════ */
    async function init() {
        try {
            console.log('═══ Aviator Game — Initializing v9 Backend ═══');

            const siteName = detectSiteName();
            console.log(`[Boot] Site: ${siteName}`);

            /* 1. Canvas Renderer */
            const canvas = document.getElementById('gameCanvas');
            if (!canvas) throw new Error('gameCanvas element not found');
            const renderer = new CanvasRenderer(canvas);

            /* 2. Bet Manager — USD default, connected to backend */
            const initialBalance = window.authManager && window.authManager.isLoggedIn 
                ? window.authManager.getBalance() 
                : 10000.00; // $50 default for guests

            const betManager = new BetManager(initialBalance);

            // Force USD currency
            betManager.setCurrency('USD');
            localStorage.setItem('aviator_currency', 'USD');

            /* 3. Sound Manager */
            const soundManager = new SoundManager();

            /* 4. Client Sync — connect to backend */
            let clientSync = null;
            if (typeof ClientSync !== 'undefined') {
                clientSync = new ClientSync(siteName);
                clientSync.onSettingsUpdate((data) => {
                    if (data.balance !== undefined) {
                        betManager.setBalance(data.balance);
                    }
                    if (data.currency) {
                        betManager.setCurrency(data.currency);
                    }
                    if (data.username) {
                        betManager.setUsername(data.username);
                    }
                });
                clientSync.start();

                betManager.onBalanceChange((bal) => {
                    clientSync.syncBalanceToServer(bal);
                });
            }

            /* 5. Game Engine */
            const game = new GameEngine(renderer, betManager, soundManager);

            /* 6. UI Controller */
            const ui = new UIController(game, betManager);

            /* 7. Chat System */
            const chatSystem = new ChatSystem(betManager);

            game.onStateChange((newState) => {
                chatSystem.setGameState(newState);
            });

            /* 8. Window resize handler */
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    renderer.handleResize();
                }, 150);
            });

            /* 9. Start game loop */
            game.start();

            /* 10. Sync auth state with game */
            if (window.authManager) {
                window.authManager.onAuthChange((isLoggedIn, user) => {
                    if (isLoggedIn && user) {
                        betManager.setBalance(user.totalBalance || 50);
                        betManager.setCurrency(user.currency || 'USD');
                        betManager.setUsername(user.username || 'Player');

                        // Update UI
                        const navBal = document.getElementById('navBalanceAmount');
                        if (navBal) navBal.textContent = betManager.formatCurrency(user.totalBalance || 50);
                        const navCur = document.getElementById('navBalanceCurrency');
                        if (navCur) navCur.textContent = 'USD';
                    }
                });
            }

            window.__aviator = { game, renderer, betManager, ui, chat: chatSystem, soundManager, clientSync, siteName };

            console.log('═══ Aviator Game — Ready ═══');
        } catch (err) {
            console.error('Failed to initialise Aviator Game:', err);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
