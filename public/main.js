/**
 * MAIN ENTRY POINT — js/main.js
 * Initializes all modules with backend integration
 * v10 — Server-authoritative game, localStorage balance persistence
 */

(function () {
    'use strict';

    window.API_BASE_URL = window.location.hostname === 'localhost' 
      ? 'http://localhost:3041/api' 
      : 'https://aviatorguru.site/api';

    window.addEventListener('error', (e) => {
        console.error('Game Error:', e.error || e.message);
    });

    window.addEventListener('unhandledrejection', (e) => {
        console.error('Unhandled Promise Rejection:', e.reason);
    });

    function detectSiteName() {
        const bodyAttr = document.body.getAttribute('data-site');
        if (bodyAttr) return bodyAttr;
        const path = window.location.pathname.toLowerCase();
        if (path.includes('/interbet')) return 'interbet';
        if (path.includes('/castlebet')) return 'castlebet';
        return 'main';
    }

    async function init() {
        try {
            console.log('═══ Aviator Game — Initializing v10 Server-Authoritative ═══');

            const siteName = detectSiteName();
            console.log(`[Boot] Site: ${siteName}`);

            /* 1. Canvas Renderer */
            const canvas = document.getElementById('gameCanvas');
            if (!canvas) throw new Error('gameCanvas element not found');
            const renderer = new CanvasRenderer(canvas);

            /* 2. Bet Manager — Initialize from localStorage FIRST */
            // CRITICAL: Read localStorage directly, not from authManager (which may have stale server data)
            const savedBalance = parseFloat(localStorage.getItem('aviator_balance'));
            const initialBalance = (!isNaN(savedBalance) && savedBalance > 0) 
                ? savedBalance 
                : (window.authManager && window.authManager.getBalance ? window.authManager.getBalance() : 50);

            const betManager = new BetManager(initialBalance);
            betManager.setCurrency('USD');
            localStorage.setItem('aviator_currency', 'USD');

            /* 3. Sound Manager */
            const soundManager = new SoundManager();

            /* 4. Client Sync */
            let clientSync = null;
            if (typeof ClientSync !== 'undefined') {
                clientSync = new ClientSync(siteName);
                clientSync.onSettingsUpdate((data) => {
                    if (data.balance !== undefined) {
                        // Only accept server balance if it's higher than local (deposit)
                        const localBal = betManager.balance;
                        if (data.balance > localBal) {
                            betManager.setBalance(data.balance);
                        }
                    }
                    if (data.currency) betManager.setCurrency(data.currency);
                    if (data.username) betManager.setUsername(data.username);
                });
                clientSync.start();
                betManager.onBalanceChange((bal) => {
                    clientSync.syncBalanceToServer(bal);
                });
            }

            /* 5. Game Engine — Server Authoritative */
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

            /* 10. Sync auth state with game WITHOUT overwriting balance */
            if (window.authManager) {
                window.authManager.onAuthChange((isLoggedIn, user) => {
                    if (isLoggedIn && user) {
                        // Preserve local balance — only sync username/currency from server
                        betManager.setUsername(user.username || 'Player');
                        betManager.setCurrency(user.currency || 'USD');

                        // Only update balance from server if local is 0 (fresh login)
                        const localBal = betManager.balance;
                        if (localBal === 0 || localBal === 50) {
                            const serverBal = user.totalBalance || 50;
                            betManager.setBalance(serverBal);
                        }

                        // Update UI displays
                        const navBal = document.getElementById('navBalanceAmount');
                        if (navBal) navBal.textContent = betManager.formatCurrency(betManager.balance);
                        const navCur = document.getElementById('navBalanceCurrency');
                        if (navCur) navCur.textContent = 'USD';

                        // Force auth UI to use live balance
                        if (window.authManager.syncBalance) {
                            window.authManager.syncBalance(betManager.balance);
                        }
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