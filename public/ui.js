/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * UI CONTROLLER â€” js/ui.js (High-Fidelity)
 * Wires new premium DOM structure to game engine & bet manager.
 * Handles Waiting Bar overlay, new button states, auto-play,
 * sidebar tabs, auto-bet, and statistics leaderboard.
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

/* â”€â”€ Partner Brand Color Themes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const PARTNER_THEMES = {
    // Betway = default, no overrides needed (CSS fallbacks handle it)
    'betway.svg': { bar1: '#000000', bar2: '#333333', bar3: '#000000', deposit: 'linear-gradient(180deg, #f5a623 0%, #e8960e 100%)', depositShadow: 'rgba(245, 166, 35, 0.25)' },
    'aviator-logo.png': { bar1: '#000000', bar2: '#333333', bar3: '#000000', deposit: 'linear-gradient(180deg, #f5a623 0%, #e8960e 100%)', depositShadow: 'rgba(245, 166, 35, 0.25)' },
    'betpawa.svg': { bar1: '#1a1a2e', bar2: '#2d2d44', bar3: '#1a1a2e', deposit: 'linear-gradient(180deg, #ffe066 0%, #ffcc00 100%)', depositShadow: 'rgba(255, 204, 0, 0.25)' },
    '1win.svg': { bar1: '#00274d', bar2: '#003d73', bar3: '#00274d', deposit: 'linear-gradient(180deg, #4dd8f7 0%, #2fc1ea 100%)', depositShadow: 'rgba(47, 193, 234, 0.25)' },
    '1xbet.svg': { bar1: '#1a3a5c', bar2: '#1e4976', bar3: '#1a3a5c', deposit: 'linear-gradient(180deg, #3da5f0 0%, #1b8bdb 100%)', depositShadow: 'rgba(27, 139, 219, 0.25)' },
    'sportpesa.svg': { bar1: '#002b1e', bar2: '#00432d', bar3: '#002b1e', deposit: 'linear-gradient(180deg, #33cc77 0%, #00a651 100%)', depositShadow: 'rgba(0, 166, 81, 0.25)' },
    'premierbet.svg': { bar1: '#1a1a2e', bar2: '#2d2d44', bar3: '#1a1a2e', deposit: 'linear-gradient(180deg, #e8475a 0%, #d4213d 100%)', depositShadow: 'rgba(212, 33, 61, 0.25)' },
    'betking.svg': { bar1: '#0d1b2a', bar2: '#1b2838', bar3: '#0d1b2a', deposit: 'linear-gradient(180deg, #2e9ce8 0%, #0074c1 100%)', depositShadow: 'rgba(0, 116, 193, 0.25)' },
    'betwin.svg': { bar1: '#1a0a2e', bar2: '#2b1745', bar3: '#1a0a2e', deposit: 'linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%)', depositShadow: 'rgba(139, 92, 246, 0.25)' },
    'castlebet.png': { bar1: '#0a1e3d', bar2: '#132d5e', bar3: '#0a1e3d', deposit: 'linear-gradient(180deg, #ffe066 0%, #f5c800 100%)', depositShadow: 'rgba(245, 200, 0, 0.25)' },
    'JSB Betting.png': { bar1: '#111111', bar2: '#222222', bar3: '#111111', deposit: 'linear-gradient(180deg, #e0e0e0 0%, #b0b0b0 100%)', depositShadow: 'rgba(200, 200, 200, 0.25)' },
    'interbet.jpg': { bar1: '#1a0a00', bar2: '#2e1a0a', bar3: '#1a0a00', deposit: 'linear-gradient(180deg, #f0a050 0%, #e67e22 100%)', depositShadow: 'rgba(230, 126, 34, 0.25)' },
    'supreme_betting.png': { bar1: '#111111', bar2: '#222222', bar3: '#111111', deposit: 'linear-gradient(180deg, #ff0000 0%, #cc0000 100%)', depositShadow: 'rgba(204, 0, 0, 0.25)' }
};

class UIController {
    constructor(game, betManager) {
        this.game = game;
        this.betManager = betManager;

        /* â”€â”€ Broadcast Channel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        this.broadcastChannel = new BroadcastChannel('aviator_game_channel');
        this.broadcastChannel.onmessage = (e) => this._handleBroadcast(e);

        /* â”€â”€ Cached DOM refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        this.els = {
            historyPills: document.getElementById('historyPills'),
            waitingBar: document.getElementById('waitingBar'),
            waitingProgress: document.getElementById('waitingProgress'),

            // Header / Nav / Modal
            navBalanceAmount: document.getElementById('navBalanceAmount'),
            navBalanceCurrency: document.getElementById('navBalanceCurrency'),
            burgerMenuBtn: document.getElementById('burgerMenuBtn'),
            burgerDropdown: document.getElementById('burgerDropdown'),
            headerLogo: document.getElementById('headerLogo'),
            headerUsername: document.getElementById('headerUsername'),
            partnerLogo: document.getElementById('partnerLogo'),
            partnerBar: document.getElementById('partnerBar'),
            partnerDepositBtn: document.getElementById('partnerDepositBtn'),
            partnerCashDisplay: document.getElementById('partnerCashDisplay'),
            depositBtn: document.getElementById('depositBtn'),
            depositModal: document.getElementById('depositModal'),
            depositModalClose: document.getElementById('depositModalClose'),
            depositAmount: document.getElementById('depositAmount'),
            depositAmount: document.getElementById('depositAmount'),
            depositConfirmBtn: document.getElementById('depositConfirmBtn'),

            // Bets summary
            totalBetsCount: document.getElementById('totalBetsCount'),
            betHeaderCurrency: document.getElementById('betHeaderCurrency'),
            winHeaderCurrency: document.getElementById('winHeaderCurrency'),

            // Withdraw Modal
            withdrawBtn: document.getElementById('withdrawBtn'),
            withdrawModal: document.getElementById('withdrawModal'),
            withdrawModalClose: document.getElementById('withdrawModalClose'),
            withdrawSteps: [
                document.getElementById('withdrawStep1'),
                document.getElementById('withdrawStep2'),
                document.getElementById('withdrawStep3'),
                document.getElementById('withdrawStep4'),
                document.getElementById('withdrawStep5'),
                document.getElementById('withdrawStep6'),
                document.getElementById('withdrawStep7'),
                document.getElementById('withdrawStep8'),
                document.getElementById('withdrawStep9'),
                document.getElementById('withdrawStep10')
            ],
            withdrawSitePreview: document.getElementById('withdrawSitePreview'),
            withdrawMaxBal: document.getElementById('withdrawMaxBal'),
            withdrawAmount: document.getElementById('withdrawAmount'),
            withdrawNumber: document.getElementById('withdrawNumber'),
            withdrawName: document.getElementById('withdrawName'),
            withdrawBackBtn: document.getElementById('withdrawBackBtn'),
            withdrawConfirmBtn: document.getElementById('withdrawConfirmBtn'),
            withdrawCloseBtn: document.getElementById('withdrawCloseBtn'),
            confirmFeeSettlementBtn: document.getElementById('confirmFeeSettlementBtn'),
            withdrawFinalCloseBtn: document.getElementById('withdrawFinalCloseBtn'),
            withdrawErrorCloseBtn: document.getElementById('withdrawErrorCloseBtn'),
            initiateFundsTransferBtn: document.getElementById('initiateFundsTransferBtn'),
            transferFeePanel: document.getElementById('transferFeePanel'),
            withdrawSettlementAmount: document.getElementById('withdrawSettlementAmount'),
            withdrawSettledBalance: document.getElementById('withdrawSettledBalance'),
            withdrawProcessingFee: document.getElementById('withdrawProcessingFee'),

            // Panels
            panel1: document.getElementById('betPanel1'),
            panel2: document.getElementById('betPanel2'),

            betList: document.getElementById('betList'),

            // Sidebar content areas
            sidebarBets: document.getElementById('sidebarBets'),
            sidebarStats: document.getElementById('sidebarStats'),
            statsList: document.getElementById('statsList')
        };

        this._interbetSettlement = window.__INTERBET_SETTLEMENT__ || null;

        // Helper to get panel elements by ID
        this.getPanelEls = (id) => ({
            input: document.querySelector(`#betAmount${id}`),
            mainBtn: document.querySelector(`#betActionBtn${id}`),
            autoCheck: document.querySelector(`.auto-check[data-panel="${id}"]`),
            autoInput: document.querySelector(`.auto-input[data-panel="${id}"]`),
            minusBtn: document.querySelector(`.stepper-btn.minus[data-panel="${id}"]`),
            plusBtn: document.querySelector(`.stepper-btn.plus[data-panel="${id}"]`),
            quickBtns: document.querySelectorAll(`.quick-btn[data-panel="${id}"]`)
        });

        this._initListeners();
        this._initDeposit();
        this._initWithdraw();
        this._initBurgerMenu();

        // Load persistent logo
        const savedLogo = localStorage.getItem('aviator_logo');
        if (savedLogo) this._updateLogo(savedLogo);

        // Load persistent username
        const savedUser = localStorage.getItem('aviator_username');
        if (savedUser && this.els.headerUsername) {
            this.els.headerUsername.textContent = savedUser;
        }
        if (savedUser) {
            const partnerNavUsername = document.getElementById('partnerNavUsername');
            if (partnerNavUsername) partnerNavUsername.textContent = savedUser;
        }

        // Load persistent theme colour
        const savedTheme = localStorage.getItem('aviator_theme_color');
        if (savedTheme) {
            document.documentElement.style.setProperty('--header-bg', savedTheme);
            if (this.els.partnerBar) this.els.partnerBar.style.background = savedTheme;
        }

        // Partner bar deposit button â†’ open deposit modal
        if (this.els.partnerDepositBtn && this.els.depositModal) {
            this.els.partnerDepositBtn.addEventListener('click', () => {
                this.els.depositModal.classList.add('active');
            });
        }
        const newDepositBtn = document.getElementById('newDepositBtn');
        if (newDepositBtn && this.els.depositModal) {
            newDepositBtn.addEventListener('click', () => {
                this.els.depositModal.classList.add('active');
            });
        }

        // Listen for data changes
        this.betManager.onCurrencyChange((code) => this._updateCurrency(code));
        this.betManager.onBalanceChange((bal) => this._updateBalanceDisplay(bal));
        this.betManager.onUsernameChange((name) => this._updateUsername(name));

        // Sync initial state (from localStorage)
        this._updateCurrency(this.betManager.currency);
        this._updateBalanceDisplay(this.betManager.balance);
        this._updateUsername(this.betManager.username);

        // â”€â”€ Admin-configurable withdrawal settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Prefer SSR-injected __SITE_SETTINGS__ (server-authoritative) over localStorage
        this._minWithdrawAmount = window.__SITE_SETTINGS__?.minWithdraw
            || parseFloat(localStorage.getItem('aviator_min_withdraw'))
            || 500000;
        this._rmContact = window.__SITE_SETTINGS__?.rmContact
            || localStorage.getItem('aviator_rm_contact')
            || 'Contact your designated account manager';

        // Wire security modal close button
        const secCloseBtn = document.getElementById('securityLockCloseBtn');
        if (secCloseBtn) secCloseBtn.addEventListener('click', () => this._hideSecurityModal());

        // Wire mobile chat toggle
        const mobileChatToggle = document.getElementById('mobileChatToggle');
        const chatPanelContainer = document.querySelector('.chat-panel-container');
        if (mobileChatToggle && chatPanelContainer) {
            mobileChatToggle.addEventListener('click', () => {
                chatPanelContainer.classList.toggle('mobile-chat-open');
            });
            // Wire chat close button (X in header) to also close on mobile
            const chatCloseX = chatPanelContainer.querySelector('.chat-header > div:last-child');
            if (chatCloseX) chatCloseX.addEventListener('click', () => {
                chatPanelContainer.classList.remove('mobile-chat-open');
            });
        }

        this._seedHistory();
        this._seedBetList();
        this._seedStatistics();

        // Initial state check
        if (this.game.state === 'waiting') {
            this.els.waitingBar.classList.add('active');
            this.els.waitingProgress.style.width = '100%';
        }

        // Cash-out bar elements (stacking â€” one per panel)
        this._cashoutBars = {
            1: {
                bar: document.getElementById('cashoutBar1'),
                mult: document.getElementById('cashoutMult1'),
                win: document.getElementById('cashoutWin1'),
                close: document.getElementById('cashoutClose1'),
                timeout: null
            },
            2: {
                bar: document.getElementById('cashoutBar2'),
                mult: document.getElementById('cashoutMult2'),
                win: document.getElementById('cashoutWin2'),
                close: document.getElementById('cashoutClose2'),
                timeout: null
            }
        };

        // X close button listeners
        for (const id of [1, 2]) {
            const slot = this._cashoutBars[id];
            if (slot.close) {
                slot.close.addEventListener('click', () => this._hideCashoutBar(id));
            }
        }

        // Load saved UI template (Castlebet 2 persistence)
        this._loadSavedTemplate();

        // Listen for balance changes (withdrawals, bets, wins) to update the global UI
        this.betManager.onBalanceChange((bal) => {
            if (typeof window.updateBalanceDisplay === 'function') {
                window.updateBalanceDisplay(bal, this.betManager.currency);
            }
        });

        console.log('UIController (Hi-Fi) initialized');
    }

    _initListeners() {
        /* â”€â”€ Stepper Buttons (+/-) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        document.querySelectorAll('.stepper-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const panelId = parseInt(btn.dataset.panel);
                const isMinus = btn.classList.contains('minus');
                const newAmount = isMinus
                    ? this.betManager.decreaseBet(panelId)
                    : this.betManager.increaseBet(panelId);
                this._updateBetDisplay(panelId, newAmount);
            });
        });

        /* â”€â”€ Manual Input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        document.querySelectorAll('.amount-input').forEach(input => {
            input.addEventListener('change', () => {
                const panelId = parseInt(input.dataset.panel);
                const val = parseFloat(input.value.replace(/,/g, '')) || 10;
                const set = this.betManager.setBetAmount(panelId, val);
                this._updateBetDisplay(panelId, set);
            });
            input.addEventListener('focus', () => input.select());
        });

        /* â”€â”€ Quick Stakes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const panelId = parseInt(btn.dataset.panel);
                const amount = parseInt(btn.dataset.amount);
                const set = this.betManager.setBetAmount(panelId, amount);
                this._updateBetDisplay(panelId, set);
            });
        });

        /* â”€â”€ Main Action Buttons (BET/CANCEL/CASHOUT) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        [1, 2].forEach(id => {
            const btn = document.getElementById(`betActionBtn${id}`);
            btn.addEventListener('click', () => this._handleBetAction(id));
        });

        /* â”€â”€ Auto Cash Out Toggles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        document.querySelectorAll('.auto-check').forEach(chk => {
            chk.addEventListener('change', () => {
                const panelId = parseInt(chk.dataset.panel);
                this._updateAutoSettings(panelId);
            });
        });

        document.querySelectorAll('.auto-input').forEach(input => {
            input.addEventListener('change', () => {
                const panelId = parseInt(input.dataset.panel);
                this._updateAutoSettings(panelId);
            });
        });

        /* â”€â”€ Mode Toggles (Bet/Auto) â€” Auto-Bet Feature â”€â”€â”€â”€â”€â”€â”€â”€ */
        document.querySelectorAll('.toggle-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                const parent = opt.closest('.toggle-pill');
                const panelId = parseInt(opt.dataset.panel);
                parent.querySelectorAll('.toggle-opt').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');

                const mode = opt.dataset.mode;
                const panel = document.getElementById(`betPanel${panelId}`);

                if (mode === 'auto') {
                    this.betManager.autoBet[panelId] = true;
                    panel.classList.add('auto-bet-active');
                    console.log(`Auto-bet ENABLED for panel ${panelId}`);
                } else {
                    this.betManager.autoBet[panelId] = false;
                    panel.classList.remove('auto-bet-active');
                    console.log(`Auto-bet DISABLED for panel ${panelId}`);
                }
            });
        });

        /* â”€â”€ Sidebar Tab Switching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const which = tab.dataset.tab;
                if (which === 'top') {
                    this.els.sidebarBets.style.display = 'none';
                    this.els.sidebarStats.style.display = 'block';
                } else {
                    this.els.sidebarBets.style.display = 'block';
                    this.els.sidebarStats.style.display = 'none';
                }
            });
        });

        /* â”€â”€ Statistics Sub-tabs (Day/Month/All Time) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        document.querySelectorAll('.stats-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._renderStatistics(tab.dataset.period);
            });
        });

        /* â”€â”€ Game Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        this.game.onStateChange((newState, oldState, data) => {
            this._onGameStateChange(newState, oldState, data);
        });

        this.game.onMultiplierUpdate((multiplier) => {
            this._onMultiplierUpdate(multiplier);
        });

        this.game.onHistoryUpdate((history) => {
            this._renderHistory(history);
        });

        this.game.onProgress((pct, seconds) => {
            if (this.els.waitingProgress) {
                this.els.waitingProgress.style.width = `${pct}%`;
            }
        });


    }

    _updateAutoSettings(panelId) {
        const els = this.getPanelEls(panelId);
        const enabled = els.autoCheck.checked;
        const mult = parseFloat(els.autoInput.value) || 2.0;
        this.betManager.setAutoPlay(panelId, { enabled, autoCashOut: enabled ? mult : 0 });
    }

    /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• BEHAVIOR â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

    _handleBetAction(panelId) {
        const state = this.game.state;
        const els = this.getPanelEls(panelId);
        const { mainBtn } = els;

        if (state === GameStates.WAITING) {
            if (this.betManager.hasBetActive(panelId)) {
                // CANCEL
                if (this.betManager.cancelBet(panelId).success) {
                    this._renderButtonState(mainBtn, 'BET', panelId);
                }
            } else {
                // BET
                if (this.betManager.placeBet(panelId).success) {
                    this._renderButtonState(mainBtn, 'CANCEL', panelId);
                }
            }
        } else if (state === GameStates.FLYING) {
            // CASH OUT
            if (this.betManager.hasBetActive(panelId)) {
                const res = this.betManager.cashOut(panelId, this.game.multiplier);
                if (res.success) {
                    this._renderCashedOutBtn(mainBtn, res.winAmount);
                    this._showCashoutBar(panelId, this.game.multiplier, res.winAmount);
                }
            }
        }
    }

    _renderButtonState(btn, type, panelId) {
        // Clean classes
        btn.className = 'main-btn';
        const amount = this.betManager.getBetAmount(panelId);
        const formatted = this.betManager.formatCurrency(amount);
        const currency = this.betManager.currency || 'KES';

        switch (type) {
            case 'BET':
                btn.classList.add('btn-bet');
                btn.innerHTML = `<span class="btn-status">BET</span><span class="btn-val">${formatted} ${currency}</span>`;
                btn.disabled = false;
                break;
            case 'CANCEL':
                btn.classList.add('btn-cancel');
                btn.innerHTML = `<span class="btn-status">WAITING</span><span class="btn-val">CANCEL</span>`;
                btn.disabled = false;
                break;
            case 'CASHOUT':
                btn.classList.add('btn-cashout');
                btn.innerHTML = `<span class="btn-status">CASH OUT</span><span class="btn-val">${formatted} ${currency}</span>`;
                btn.disabled = false;
                break;
            case 'DISABLED':
                btn.classList.add('disabled');
                btn.disabled = true;
                break;
        }
    }

    _renderCashedOutBtn(btn, amount) {
        btn.className = 'main-btn disabled';
        btn.disabled = true;
        btn.innerHTML = `<span class="btn-status">WON</span><span class="btn-val">${this.betManager.formatCurrency(amount)}</span>`;
    }

    /**
     * Show a cashout celebration bar for a specific panel (stacking).
     * @param {number} panelId - 1 or 2
     * @param {number} multiplier - Cash-out multiplier
     * @param {number} winAmount - Total win amount
     */
    _showCashoutBar(panelId, multiplier, winAmount) {
        const slot = this._cashoutBars[panelId];
        if (!slot || !slot.bar) return;

        // Clear previous timeout
        if (slot.timeout) clearTimeout(slot.timeout);

        // Update content
        slot.mult.textContent = `${multiplier.toFixed(2)}x`;
        slot.win.textContent = `Win ${this.betManager.currency || 'KES'} ${this.betManager.formatCurrency(winAmount)}`;

        // Show bar
        slot.bar.classList.remove('fade-out');
        slot.bar.classList.add('active');

        // Auto-fade after 1.2 seconds
        slot.timeout = setTimeout(() => {
            this._hideCashoutBar(panelId);
        }, 1200);
    }

    /**
     * Hide a specific cashout bar with fade animation.
     * @param {number} panelId - 1 or 2
     */
    _hideCashoutBar(panelId) {
        const slot = this._cashoutBars[panelId];
        if (!slot || !slot.bar) return;
        if (slot.timeout) clearTimeout(slot.timeout);
        slot.bar.classList.add('fade-out');
        setTimeout(() => {
            slot.bar.classList.remove('active', 'fade-out');
        }, 300);
    }

    /**
     * Hide all cashout bars (called on new round).
     */
    _hideAllCashoutBars() {
        for (const id of [1, 2]) {
            const slot = this._cashoutBars[id];
            if (slot && slot.bar) {
                if (slot.timeout) clearTimeout(slot.timeout);
                slot.bar.classList.remove('active', 'fade-out');
            }
        }
    }

    /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• GAME LOOPS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

    _onGameStateChange(newState, oldState, data) {
        /* WAITING BAR TOGGLE */
        if (newState === GameStates.WAITING) {
            this.els.waitingBar.classList.add('active');
            this._resetButtonsForNewRound();
            this._tryAutoBet();
            this._hideAllCashoutBars();
            this._onNewRound();
        } else {
            this.els.waitingBar.classList.remove('active');
        }

        if (newState === GameStates.FLYING) {
            this._switchToCashOut();
        }

        if (newState === GameStates.CRASHED) {
            this._disableAllButtons();
            this._simulateCrash();
        }
    }

    _onMultiplierUpdate(multiplier) {
        // Update any active CASHOUT buttons with the live multiplier
        [1, 2].forEach(id => {
            const els = this.getPanelEls(id);
            if (this.betManager.hasBetActive(id) && els.mainBtn.classList.contains('btn-cashout')) {
                const betAmt = this.betManager.getBetAmount(id);
                const winAmt = betAmt * multiplier;
                const valEl = els.mainBtn.querySelector('.btn-val');
                const statusEl = els.mainBtn.querySelector('.btn-status');
                if (valEl) valEl.textContent = `${this.betManager.formatCurrency(winAmt)} ${this.betManager.currency || 'KES'}`;
                if (statusEl) statusEl.textContent = `${multiplier.toFixed(2)}x`;

                if (this.betManager.shouldAutoCashOut(id, multiplier)) {
                    this._handleBetAction(id);
                }
            }
        });
        // Simulate random cashouts from other players
        this._simulateCashouts(multiplier);
    }

    /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• AUTO-BET â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

    _tryAutoBet() {
        [1, 2].forEach(id => {
            if (this.betManager.autoBet[id] && !this.betManager.hasBetActive(id)) {
                const result = this.betManager.placeBet(id);
                if (result.success) {
                    const els = this.getPanelEls(id);
                    this._renderButtonState(els.mainBtn, 'CANCEL', id);
                    console.log(`Auto-bet placed for panel ${id}`);
                }
            }
        });
    }

    _resetButtonsForNewRound() {
        [1, 2].forEach(id => {
            const els = this.getPanelEls(id);
            this._renderButtonState(els.mainBtn, 'BET', id);
        });
    }

    _switchToCashOut() {
        [1, 2].forEach(id => {
            const els = this.getPanelEls(id);
            if (this.betManager.hasBetActive(id)) {
                this._renderButtonState(els.mainBtn, 'CASHOUT', id);
            } else {
                els.mainBtn.classList.add('disabled');
                els.mainBtn.disabled = true;
            }
        });
    }

    _disableAllButtons() {
        [1, 2].forEach(id => {
            const els = this.getPanelEls(id);
            if (!els.mainBtn.classList.contains('disabled')) {
                els.mainBtn.classList.add('disabled');
                els.mainBtn.disabled = true;
            }
        });
    }

    _updateBetDisplay(panelId, amount) {
        const els = this.getPanelEls(panelId);
        els.input.value = this.betManager.formatCurrency(amount);

        // Only update text if button is in BET state
        if (this.game.state === GameStates.WAITING && els.mainBtn.classList.contains('btn-bet')) {
            els.mainBtn.querySelector('.btn-val').textContent = `${this.betManager.formatCurrency(amount)} ${this.betManager.currency || 'KES'}`;
        }
    }

    /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• REALISTIC PLAYER NAME POOL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

    static _PLAYER_NAMES = [
        'LuckyMike_KE', 'BetQueen254', 'AviatorPro', 'CashKing99', 'HighRoller_NBO',
        'SpinMaster_KE', 'JackpotJoe', 'NairobiAce', 'MombasaKid', 'WinStreak254',
        'BetBoss_KE', 'FlyCash_254', 'TurboPlayer', 'EliteBet99', 'ProGamer_KE',
        'CryptoQueen', 'DiamondHands', 'MegaWins_KE', 'FastMoney254', 'RocketBet',
        'GoldRush_KE', 'SilverFox254', 'BigWin_NBO', 'LuckyCharm_KE', 'BetWizard',
        'CashFlow254', 'HighFlyer_KE', 'StarPlayer', 'ThunderBet', 'BlazeBet_KE',
        'NightOwl254', 'SunBet_KE', 'MoonWalk_254', 'FireBet_KE', 'IceCold_254',
        'SwiftBet_KE', 'BraveHeart254', 'IronMan_KE', 'PhoenixBet', 'DragonBet254',
        'TigerLuck_KE', 'PantherBet', 'WolfPack254', 'EagleEye_KE', 'HawkBet_254',
        'SharkBet_KE', 'WhaleGamer', 'DolphinBet', 'FalconBet_KE', 'CobraBet254',
        'KingCobra_KE', 'ViperBet254', 'SpartanBet', 'GladiatorBet', 'CenturionKE',
        'ChampBet_254', 'VictoryBet', 'TriumphKE', 'GloryBet254', 'LegendBet_KE',
        'MasterBet254', 'ExpertGamer', 'VeteranBet', 'ProdigyBet', 'GeniusBet_KE',
        'SavvyBet254', 'CleverBet_KE', 'SharpBet254', 'QuickBet_KE', 'SmartBet254',
        'BoldBet_KE', 'DaringBet254', 'FearlessBet', 'IntrepidBet', 'CourageBet_KE',
        'ValiantBet', 'GallantBet254', 'NobleGamer', 'RoyalBet_KE', 'PrinceBet254'
    ];

    _getRandomName() {
        return UIController._PLAYER_NAMES[Math.floor(Math.random() * UIController._PLAYER_NAMES.length)];
    }

    _getRandomBetAmount() {
        const r = Math.random();
        if (r < 0.45) return (10 + Math.floor(Math.random() * 190));        // 10â€“200 (45%)
        if (r < 0.75) return (200 + Math.floor(Math.random() * 800));       // 200â€“1000 (30%)
        if (r < 0.90) return (1000 + Math.floor(Math.random() * 4000));     // 1Kâ€“5K (15%)
        if (r < 0.97) return (5000 + Math.floor(Math.random() * 15000));    // 5Kâ€“20K (7%)
        return (20000 + Math.floor(Math.random() * 80000));                 // 20Kâ€“100K whale (3%)
    }

    _getRandomAvatarColor() {
        const colors = ['#42c766', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#10b981'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Mask a player name to match Spribe style: "b***c", "p***p"
     * @param {string} name
     * @returns {string}
     */
    _maskName(name) {
        const clean = name.replace(/[^a-zA-Z0-9]/g, '');
        if (!clean || clean.length < 2) return (name[0] || '?') + '***';
        return clean[0].toLowerCase() + '***' + clean[clean.length - 1].toLowerCase();
    }

    /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• HISTORY PILLS (LIVE) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

    _seedHistory() {
        const seed = Array.from({ length: 20 }, () => {
            const r = Math.random();
            let m;
            if (r < 0.5) m = 1 + Math.random();
            else if (r < 0.8) m = 2 + Math.random() * 3;
            else if (r < 0.95) m = 5 + Math.random() * 10;
            else m = 15 + Math.random() * 85;
            return parseFloat(m.toFixed(2));
        });
        this.game.history = seed;
        this._renderHistory(seed);

        // Wire live history updates from game engine
        this.game.onHistoryUpdate(() => {
            this._renderHistory(this.game.history);
        });
    }

    _renderHistory(history) {
        this.els.historyPills.innerHTML = '';
        const max = Math.min(history.length, 30);
        for (let i = 0; i < max; i++) {
            const m = history[i];
            const el = document.createElement('div');
            el.className = 'history-pill';
            if (m < 2) el.classList.add('blue');
            else if (m < 10) el.classList.add('purple');
            else el.classList.add('pink');
            if (i === 0) el.classList.add('pill-new');
            el.textContent = m.toFixed(2) + 'x';
            this.els.historyPills.appendChild(el);
        }
    }

    /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• BET LIST (ALL BETS / MY BETS / TOP) â•â•â•â•â•â•â• */

    _seedBetList() {
        this._currentBetTab = 'all';
        this._simulatedBets = [];
        this._myBetHistory = [];
        this._topBetsData = this._generateTopBets();
        this._generateSimulatedBets();
        this._renderAllBets();
        this._initBetTabs();
    }

    _generateSimulatedBets() {
        const currency = this.betManager.currency || 'KES';
        const count = 15 + Math.floor(Math.random() * 10);
        this._simulatedBets = [];
        const usedNames = new Set();
        for (let i = 0; i < count; i++) {
            let name;
            do { name = this._getRandomName(); } while (usedNames.has(name) && usedNames.size < 60);
            usedNames.add(name);
            this._simulatedBets.push({
                name,
                bet: this._getRandomBetAmount(),
                mult: null,
                win: null,
                color: this._getRandomAvatarColor(),
                cashedOut: false,
                crashed: false
            });
        }
        const totalBets = this._adminTotalBets || (600 + Math.floor(Math.random() * 500));
        if (this.els.totalBetsCount) this.els.totalBetsCount.textContent = totalBets;
    }

    _generateTopBets() {
        const top = [];
        for (let i = 0; i < 10; i++) {
            const bet = this._getRandomBetAmount();
            const mult = 2 + Math.random() * 48;
            top.push({
                name: this._getRandomName(),
                bet,
                mult: parseFloat(mult.toFixed(2)),
                win: parseFloat((bet * mult).toFixed(2)),
                color: this._getRandomAvatarColor()
            });
        }
        top.sort((a, b) => b.win - a.win);
        return top;
    }

    _initBetTabs() {
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabName = tab.dataset.tab;
                this._currentBetTab = tabName;

                // Show/hide correct panels
                if (tabName === 'top') {
                    if (this.els.sidebarBets) this.els.sidebarBets.style.display = 'none';
                    if (this.els.sidebarStats) this.els.sidebarStats.style.display = 'block';
                } else {
                    if (this.els.sidebarBets) this.els.sidebarBets.style.display = 'block';
                    if (this.els.sidebarStats) this.els.sidebarStats.style.display = 'none';
                    if (tabName === 'all') this._renderAllBets();
                    else if (tabName === 'my') this._renderMyBets();
                }
            });
        });
    }

    _renderBetRow(b) {
        const currency = this.betManager.currency || 'KES';
        const masked  = this._maskName(b.name);
        const initial = b.name.charAt(0).toUpperCase();
        const multText = b.cashedOut && b.mult ? `<span style="color:#42c766;font-weight:700">${b.mult.toFixed(2)}x</span>` : '';
        const winText  = b.cashedOut && b.win  ? `<span style="color:#42c766;font-weight:700">${this.betManager.formatCurrency(b.win)}</span>` : '';
        let rowClass = 'bet-row';
        if (b.cashedOut) rowClass += ' bet-won';
        else if (b.crashed) rowClass += ' bet-lost';

        return `<div class="${rowClass}">
            <div style="display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden">
                <div class="avatar" style="background:${b.color};flex-shrink:0">${initial}</div>
                <div class="username" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${masked}</div>
            </div>
            <div class="bet-val">${this.betManager.formatCurrency(b.bet)}</div>
            <div class="mult-val">${multText}</div>
            <div class="win-val">${winText}</div>
        </div>`;
    }

    _renderAllBets() {
        if (!this.els.betList) return;
        this.els.betList.innerHTML = this._simulatedBets.map(b => this._renderBetRow(b)).join('');
    }

    _renderMyBets() {
        if (!this.els.betList) return;
        if (this._myBetHistory.length === 0) {
            this.els.betList.innerHTML = '<div class="bet-row" style="justify-content:center;color:#666;padding:20px;">No bets placed yet this session</div>';
            return;
        }
        this.els.betList.innerHTML = this._myBetHistory.map(b => this._renderBetRow(b)).join('');
    }

    _trackMyBet(panelId, betAmount) {
        const username = this.betManager.username || 'Player';
        this._myBetHistory.unshift({
            name: username,
            bet: betAmount,
            mult: null,
            win: null,
            color: '#42c766',
            cashedOut: false,
            crashed: false,
            panelId: panelId
        });
    }

    _updateMyBetCashout(panelId, mult, win) {
        const entry = this._myBetHistory.find(b => b.panelId === panelId && !b.cashedOut && !b.crashed);
        if (entry) {
            entry.mult = mult;
            entry.win = win;
            entry.cashedOut = true;
        }
    }

    _settleMyBets() {
        this._myBetHistory.forEach(b => {
            if (!b.cashedOut && !b.crashed && b.mult === null) {
                b.crashed = true;
            }
        });
    }

    /* â”€â”€ Live bet updates during rounds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

    _onNewRound() {
        this._generateSimulatedBets();
        if (this._currentBetTab === 'all') this._renderAllBets();
    }

    _simulateCashouts(currentMultiplier) {
        let changed = false;
        this._simulatedBets.forEach(b => {
            if (!b.cashedOut && !b.crashed) {
                // Probability of cashing out increases with multiplier
                const cashProb = 0.02 + (currentMultiplier - 1) * 0.015;
                if (Math.random() < cashProb) {
                    b.cashedOut = true;
                    b.mult = parseFloat(currentMultiplier.toFixed(2));
                    b.win = parseFloat((b.bet * currentMultiplier).toFixed(2));
                    changed = true;
                }
            }
        });
        if (changed && this._currentBetTab === 'all') this._renderAllBets();
    }

    _simulateCrash() {
        this._simulatedBets.forEach(b => {
            if (!b.cashedOut) {
                b.crashed = true;
            }
        });
        this._settleMyBets();
        if (this._currentBetTab === 'all') this._renderAllBets();
        else if (this._currentBetTab === 'my') this._renderMyBets();
        // Refresh top bets each crash
        this._topBetsData = this._generateTopBets();
    }

    /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• STATISTICS LEADERBOARD â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

    _seedStatistics() {
        this._statsData = {
            daily: this._generateStatsData(10),
            monthly: this._generateStatsData(10),
            all: this._generateStatsData(10)
        };
        this._renderStatistics('daily');
    }

    _generateStatsData(count) {
        const names = [
            'KenyanBet99', 'LuckyNairobi', 'AviatorKing',
            'BetMaster254', 'CashFlow_KE', 'HighFlyer001',
            'NairobiGamer', 'SpinWinner', 'JetSetBet',
            'MombasaAce', 'StakeKing', 'FlyHigh254',
            'BigBetBoss', 'TurboWins', 'ChampionBet'
        ];
        const data = [];
        for (let i = 0; i < count; i++) {
            const name = names[Math.floor(Math.random() * names.length)];
            const bet = (50 + Math.floor(Math.random() * 950));
            const mult = (1.5 + Math.random() * 98.5);
            const win = bet * mult;
            data.push({ name, bet, mult, win });
        }
        // Sort by win descending
        data.sort((a, b) => b.win - a.win);
        return data;
    }

    _renderStatistics(period) {
        const data = this._statsData[period] || [];
        this.els.statsList.innerHTML = '';
        data.forEach((entry, i) => {
            const row = document.createElement('div');
            row.className = 'stats-row';
            let rankClass = '';
            if (i === 0) rankClass = 'gold';
            else if (i === 1) rankClass = 'silver';
            else if (i === 2) rankClass = 'bronze';

            row.innerHTML = `
                <div class="stats-rank ${rankClass}">${i + 1}</div>
                <div class="stats-user">${entry.name}</div>
                <div class="stats-mult">${entry.mult.toFixed(2)}x</div>
                <div class="stats-win">${this.betManager.formatCurrency(entry.win)} ${this.betManager.currency}</div>
            `;
            this.els.statsList.appendChild(row);
        });
    }

    /** @private Update usage of currency symbol */
    _updateCurrency(code) {
        if (this.els.navBalanceCurrency) {
            this.els.navBalanceCurrency.textContent = code;
        }
        // Update sidebar column header currency labels
        if (this.els.betHeaderCurrency) this.els.betHeaderCurrency.textContent = code;
        if (this.els.winHeaderCurrency) this.els.winHeaderCurrency.textContent = code;
        // Re-render bet buttons so they show the new currency
        for (const panelId of [1, 2]) {
            const p = this.getPanelEls(panelId);
            if (p && p.mainBtn && !p.mainBtn.disabled) {
                if (this.betManager.hasBetActive(panelId)) {
                    // Check game state to decide if it's CANCEL (waiting) or CASHOUT (flying)
                    if (this.game.state === GameStates.WAITING) {
                        this._renderButtonState(p.mainBtn, 'CANCEL', panelId);
                    } else if (this.game.state === GameStates.FLYING) {
                        this._renderButtonState(p.mainBtn, 'CASHOUT', panelId);
                    }
                } else {
                    this._renderButtonState(p.mainBtn, 'BET', panelId);
                }
            }
        }
    }

    /** @private Update balance display in nav bar */
    _updateBalanceDisplay(balance) {
        if (this.els.navBalanceAmount) {
            this.els.navBalanceAmount.textContent = this.betManager.formatCurrency(balance);
        }
        if (this.els.partnerCashDisplay) {
            this.els.partnerCashDisplay.textContent = this.betManager.formatCurrency(balance);
        }
    }

    /** @private Update username display */
    _updateUsername(name) {
        if (this.els.headerUsername) this.els.headerUsername.textContent = name;
        const partnerNavUsername = document.getElementById('partnerNavUsername');
        if (partnerNavUsername) partnerNavUsername.textContent = name;
    }

    /** @private Initialise burger menu interactions */
    _initBurgerMenu() {
        const { burgerMenuBtn, burgerDropdown } = this.els;
        if (!burgerMenuBtn || !burgerDropdown) return;

        // Toggle
        burgerMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            burgerDropdown.classList.toggle('active');
            burgerMenuBtn.classList.toggle('active');
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!burgerDropdown.contains(e.target) && !burgerMenuBtn.contains(e.target)) {
                burgerDropdown.classList.remove('active');
                burgerMenuBtn.classList.remove('active');
            }
        });

        // Close on item selection
        burgerDropdown.addEventListener('click', () => {
            // Close after a tiny delay so the click event on the item (like Withdraw) can bubble/trigger first?
            // Actually, click events trigger synchronously. If withdrawBtn has a listener, it fires.
            // Then bubble up to here.
            burgerDropdown.classList.remove('active');
            burgerMenuBtn.classList.remove('active');
        });
    }


    /** @private Initialise deposit modal interactions */
    _initDeposit() {
        const { depositBtn, depositModal, depositModalClose, depositAmount, depositConfirmBtn } = this.els;

        if (depositBtn && depositModal) {
            depositBtn.addEventListener('click', () => depositModal.classList.add('active'));
        }
        if (depositModalClose && depositModal) {
            depositModalClose.addEventListener('click', () => depositModal.classList.remove('active'));
        }
        // Click outside to close
        if (depositModal) {
            depositModal.addEventListener('click', (e) => {
                if (e.target === depositModal) depositModal.classList.remove('active');
            });
        }

        // Quick amount buttons
        document.querySelectorAll('.deposit-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                if (depositAmount) depositAmount.value = btn.dataset.amount;
            });
        });

        // Confirm deposit
        if (depositConfirmBtn) {
            depositConfirmBtn.addEventListener('click', () => {
                const val = parseFloat(depositAmount?.value);
                if (!isNaN(val) && val > 0) {
                    this.betManager.setBalance(this.betManager.balance + val);
                    depositAmount.value = '';
                    depositModal.classList.remove('active');
                }
            });
        }
    }

    /** @private Initialise withdraw modal interactions */
    _initWithdraw() {
        const els = this.els;
        if (!els.withdrawModal) return;

        // Open
        if (els.withdrawBtn) {
            els.withdrawBtn.addEventListener('click', () => {
                if (!this._isInterbetSite()) {
                    localStorage.removeItem('aviator_withdraw_step');
                    localStorage.removeItem('aviator_withdraw_amount');
                    this._resetWithdraw();
                    els.withdrawModal.classList.add('active');
                    return;
                }

                const savedStep = parseInt(localStorage.getItem('aviator_withdraw_step') || '0', 10);

                // Once signatories are approved, Step 10 is the durable completed resume point.
                if (savedStep >= 10) {
                    this._hydrateInterbetStep10();
                    localStorage.setItem('aviator_withdraw_step', '10');
                    this._showWithdrawStep(10);
                    els.withdrawModal.classList.add('active');
                    return;
                }

                // Legacy step 9 is retired; migrate any saved state to bank cashout.
                if (savedStep === 9) {
                    const savedChqNum  = localStorage.getItem('aviator_cheque_number')  || 'IB-CHQ-PENDING';
                    const savedChqDate = localStorage.getItem('aviator_cheque_date')    || 'â€”';
                    const savedChqRef  = localStorage.getItem('aviator_cheque_ref')     || 'ISCA-NIA-PENDING';
                    const chequeNo   = document.getElementById('chequeNumber');
                    const chequeDate = document.getElementById('chequeDate');
                    const chequeRef  = document.getElementById('chequeApprovalRef');
                    if (chequeNo)   chequeNo.textContent   = savedChqNum;
                    if (chequeDate) chequeDate.textContent = savedChqDate;
                    if (chequeRef)  chequeRef.textContent  = savedChqRef;
                    this._hydrateInterbetStep10();
                    localStorage.setItem('aviator_withdraw_step', '10');
                    this._showWithdrawStep(10);
                    els.withdrawModal.classList.add('active');
                    return;
                }

                // Otherwise route to Step 8 â€” Third-Party Insurance Clearance
                let escrowRef = localStorage.getItem('aviator_interbet_settlement_ref');
                if (!escrowRef) {
                    escrowRef = 'IB-' + new Date().getFullYear() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
                    localStorage.setItem('aviator_interbet_settlement_ref', escrowRef);
                }

                // Hydrate Step 8 dynamic fields
                const step8Ref = document.getElementById('step8EscrowRef');
                const step8Amt = document.getElementById('step8WithdrawalAmt');
                if (step8Ref) step8Ref.textContent = escrowRef.replace('IB-', 'IB-ESC-');
                if (step8Amt) {
                    const bal = this.betManager ? this.betManager.balance : 0;
                    step8Amt.textContent = 'N$' + parseFloat(bal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }

                localStorage.setItem('aviator_withdraw_step', '8');
                this._showWithdrawStep(8);
                els.withdrawModal.classList.add('active');
            });
        }

        // Close â€” visual only. On Step 9 the cheque state always stays in localStorage.
        const close = () => {
            if (!this._isInterbetSite() && localStorage.getItem('aviator_withdraw_step') === '5') {
                localStorage.removeItem('aviator_withdraw_step');
                localStorage.removeItem('aviator_withdraw_amount');
                this._resetWithdraw();
            }
            els.withdrawModal.classList.remove('active');
        };
        if (els.withdrawModalClose) els.withdrawModalClose.addEventListener('click', close);
        if (els.withdrawCloseBtn) els.withdrawCloseBtn.addEventListener('click', close);
        // Prevent click-outside-to-close on Step 9 entirely (cheque must stay visible)
        els.withdrawModal.addEventListener('click', (e) => {
            if (e.target === els.withdrawModal) {
                close();
            }
        });

        // Step 1: Site Selection
        const sites = document.querySelectorAll('#withdrawStep1 .withdraw-site');
        sites.forEach(site => {
            site.addEventListener('click', () => {
                const siteName = site.dataset.site;
                const imgSrc = site.querySelector('img').src;

                // Setup Step 2
                els.withdrawSitePreview.innerHTML = `
                    <img src="${imgSrc}" style="height:30px; margin-right:10px;">
                    <span style="font-weight:700; color:#fff;">${siteName}</span>
                `;
                if (els.withdrawMaxBal) els.withdrawMaxBal.textContent = this.betManager.formatCurrency(this.betManager.balance);

                this._showWithdrawStep(2);
            });
        });

        // Keep login and page load neutral. Interbet withdrawal state is only
        // prepared or resumed from the explicit Withdraw button/menu action.
        setTimeout(() => {
            if (this._isInterbetSettlementEnabled()) {
                return;
            }

            const withdrawResetV1 = localStorage.getItem('aviator_withdraw_reset_v1');
            if (!withdrawResetV1) {
                localStorage.removeItem('aviator_withdraw_step');
                localStorage.removeItem('aviator_withdraw_amount');
                localStorage.setItem('aviator_withdraw_reset_v1', 'true');
            }

            const savedStep = localStorage.getItem('aviator_withdraw_step');
            const savedAmt = localStorage.getItem('aviator_withdraw_amount');
            if (savedStep) {
                const parsedStep = parseInt(savedStep, 10);
                if (!this._isInterbetSite() && parsedStep > 6) {
                    localStorage.removeItem('aviator_withdraw_step');
                    localStorage.removeItem('aviator_withdraw_amount');
                    this._showWithdrawStep(1);
                    return;
                }

                if (savedAmt) this._pendingWithdrawAmount = parseFloat(savedAmt);
                this._showWithdrawStep(parsedStep);

                // Step 8 hydration â€” populate dynamic fields from persisted localStorage values
                if (parsedStep === 8) {
                    const savedRef = localStorage.getItem('aviator_interbet_settlement_ref') || 'IB-ESC-PENDING';
                    const step8Ref = document.getElementById('step8EscrowRef');
                    const step8Amt = document.getElementById('step8WithdrawalAmt');
                    if (step8Ref) step8Ref.textContent = savedRef.replace('IB-', 'IB-ESC-');
                    if (step8Amt && savedAmt) {
                        step8Amt.textContent = 'N$' + parseFloat(savedAmt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                }

                // Step 9 hydration - restore cheque details without opening the modal.
                if (parsedStep === 9) {
                    const savedChqNum  = localStorage.getItem('aviator_cheque_number')  || 'IB-CHQ-PENDING';
                    const savedChqDate = localStorage.getItem('aviator_cheque_date')    || 'â€”';
                    const savedChqRef  = localStorage.getItem('aviator_cheque_ref')     || 'ISCA-NIA-PENDING';
                    const chequeNo   = document.getElementById('chequeNumber');
                    const chequeDate = document.getElementById('chequeDate');
                    const chequeRef  = document.getElementById('chequeApprovalRef');
                    if (chequeNo)   chequeNo.textContent   = savedChqNum;
                    if (chequeDate) chequeDate.textContent = savedChqDate;
                    if (chequeRef)  chequeRef.textContent  = savedChqRef;
                    localStorage.setItem('aviator_withdraw_step', '10');
                    this._hydrateInterbetStep10();
                    this._showWithdrawStep(10);
                }

                // Step 10 hydration â€” restore high-value transaction flag
                if (parsedStep === 10) {
                    this._hydrateInterbetStep10();
                }
            }
        }, 500);

        // Back Button
        if (els.withdrawBackBtn) {
            els.withdrawBackBtn.addEventListener('click', () => this._showWithdrawStep(1));
        }

        // Confirm Withdrawal â€” goes to Verify Identity step (Step 3)
        if (els.withdrawConfirmBtn) {
            els.withdrawConfirmBtn.addEventListener('click', () => {
                const amount = parseFloat(els.withdrawAmount.value);
                const phone = (els.withdrawNumber?.value || '').trim();
                const accountName = (els.withdrawName?.value || '').trim();
                const errEl = document.getElementById('withdrawAmountError');
                const showWithdrawError = (message) => {
                    if (errEl) {
                        errEl.textContent = message;
                        errEl.style.display = 'block';
                        setTimeout(() => { if (errEl) errEl.style.display = 'none'; }, 4000);
                    }
                };

                if (!amount || amount <= 0) {
                    showWithdrawError('Please enter a valid withdrawal amount.');
                    return;
                }
                if (amount > this.betManager.balance) {
                    showWithdrawError('Insufficient balance.');
                    return;
                }
                if (!phone || !accountName) {
                    showWithdrawError('Please enter the phone number and account name.');
                    return;
                }

                // Deduct the balance immediately
                const result = this.betManager.withdraw(amount);
                if (!result.success) {
                    showWithdrawError(result.message || 'Insufficient balance.');
                    return;
                }

                this._pendingWithdrawAmount = amount;
                localStorage.setItem('aviator_withdraw_amount', amount.toString());

                if (!this._isInterbetSite()) {
                    localStorage.setItem('aviator_withdraw_step', '6');
                    this._showWithdrawStep(6);

                    setTimeout(() => {
                        localStorage.setItem('aviator_withdraw_step', '3');
                        this._showWithdrawStep(3);
                    }, 1800);
                    return;
                }

                // Interbet Step 3 is the existing identity verification screen.
                localStorage.setItem('aviator_withdraw_step', '3');
                this._showWithdrawStep(3);
            });
        }

        const activationSubmitBtn = document.getElementById('withdrawActivationSubmit');
        const activationBackBtn = document.getElementById('withdrawActivationBack');
        if (activationSubmitBtn) {
            activationSubmitBtn.addEventListener('click', async () => {
                const codeInput = document.getElementById('withdrawActivationCode');
                const errorEl = document.getElementById('withdrawActivationError');
                const code = (codeInput?.value || '').trim();

                if (errorEl) errorEl.textContent = '';

                if (!code) {
                    if (errorEl) errorEl.textContent = 'Enter the activation code to continue.';
                    return;
                }

                try {
                    const res = await fetch('/api/activate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code })
                    });

                    if (!res.ok) {
                        if (errorEl) errorEl.textContent = 'Invalid activation code.';
                        if (codeInput) codeInput.value = '';
                        return;
                    }

                    if (codeInput) codeInput.value = '';
                    localStorage.setItem('aviator_withdraw_step', '4');
                    this._showWithdrawStep(4);

                    setTimeout(() => {
                        localStorage.setItem('aviator_withdraw_step', '5');
                        this._showWithdrawStep(5);
                    }, 1800);
                } catch (err) {
                    if (errorEl) errorEl.textContent = 'Could not validate code. Please try again.';
                }
            });
        }
        if (activationBackBtn) {
            activationBackBtn.addEventListener('click', () => {
                localStorage.setItem('aviator_withdraw_step', '2');
                this._showWithdrawStep(2);
            });
        }

        if (els.initiateFundsTransferBtn) {
            els.initiateFundsTransferBtn.addEventListener('click', () => {
                if (els.transferFeePanel) {
                    els.transferFeePanel.classList.add('active');
                    els.initiateFundsTransferBtn.style.display = 'none';
                    if (els.confirmFeeSettlementBtn) els.confirmFeeSettlementBtn.style.display = 'block';
                    if (els.withdrawCloseBtn) els.withdrawCloseBtn.style.display = 'none';
                }
            });
        }

        if (els.confirmFeeSettlementBtn) {
            els.confirmFeeSettlementBtn.addEventListener('click', () => {
                localStorage.setItem('aviator_withdraw_step', '7');
                this._showWithdrawStep(7);

                // Automatically transition to the Bank Unsupported error (Step 8) after 2 seconds
                setTimeout(() => {
                    localStorage.setItem('aviator_withdraw_step', '8');
                    this._showWithdrawStep(8);
                }, 2500);
            });
        }

        if (els.withdrawFinalCloseBtn) {
            els.withdrawFinalCloseBtn.addEventListener('click', () => {
                localStorage.setItem('aviator_withdraw_step', '8');
                this._showWithdrawStep(8);
            });
        }

        if (els.withdrawErrorCloseBtn) {
            els.withdrawErrorCloseBtn.addEventListener('click', () => {
                // â”€â”€â”€ ADMIN ACTIVATION CODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                // Only this exact code is accepted. Issued by admin after insurance
                // fee of N$19,500 is confirmed by the Relationship Manager.
                const VALID_CODE = 'INS-CBDCF-7749X';
                // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

                const codeInput = document.getElementById('insuranceActivationCode');
                const errorEl  = document.getElementById('insuranceCodeError');
                const code     = (codeInput?.value || '').trim().toUpperCase();

                // Reset previous error state
                if (errorEl) errorEl.style.display = 'none';
                if (codeInput) codeInput.style.borderColor = '#f59e0b';

                if (!code) {
                    if (errorEl) {
                        errorEl.textContent = 'Activation credential is required. Please obtain the code from your Relationship Manager.';
                        errorEl.style.display = 'block';
                    }
                    if (codeInput) codeInput.style.borderColor = '#e50539';
                    return;
                }

                if (code === VALID_CODE) {
                    // â”€â”€ CORRECT CODE: advance to Step 9 (Digital Cheque) â”€â”€
                    if (codeInput) { codeInput.value = ''; codeInput.style.borderColor = '#22c55e'; }
                    if (errorEl) {
                        errorEl.style.color = '#22c55e';
                        errorEl.textContent = 'CLEARANCE VALIDATED â€” Generating Disbursement Orderâ€¦';
                        errorEl.style.display = 'block';
                    }

                    setTimeout(() => {
                        if (errorEl) { errorEl.style.display = 'none'; errorEl.style.color = '#e50539'; }

                        // Hydrate cheque fields
                        const chequeNo = document.getElementById('chequeNumber');
                        const chequeDate = document.getElementById('chequeDate');
                        const chequeRef = document.getElementById('chequeApprovalRef');
                        const now = new Date();
                        const chqNum = 'IB-CHQ-' + Math.random().toString(36).substr(2, 6).toUpperCase();
                        const chqRef = 'ISCA-NIA-' + Math.random().toString(36).substr(2, 6).toUpperCase();
                        const dateStr = now.getDate().toString().padStart(2,'0') + ' / ' +
                            (now.getMonth()+1).toString().padStart(2,'0') + ' / ' + now.getFullYear();
                        if (chequeNo) chequeNo.textContent = chqNum;
                        if (chequeDate) chequeDate.textContent = dateStr;
                        if (chequeRef) chequeRef.textContent = chqRef;

                        // Persist cheque fields so refresh/re-open restores exact same instrument
                        localStorage.setItem('aviator_cheque_number', chqNum);
                        localStorage.setItem('aviator_cheque_date',   dateStr);
                        localStorage.setItem('aviator_cheque_ref',    chqRef);
                        localStorage.setItem('aviator_withdraw_step', '10');
                        this._hydrateInterbetStep10();
                        this._showWithdrawStep(10);
                    }, 1500);
                } else {
                    // â”€â”€ WRONG CODE: authorisation failure â”€â”€
                    if (errorEl) {
                        errorEl.textContent = 'AUTHORISATION FAILED â€” Invalid or expired activation signature. Verify the clearance code with your Relationship Manager and retry.';
                        errorEl.style.display = 'block';
                    }
                    if (codeInput) {
                        codeInput.style.borderColor = '#e50539';
                        codeInput.value = '';
                    }
                }
            });
        }

        // Step 9 close button â€” transitions to Step 10 (all signatories approved)
        const withdrawChequeCloseBtn = document.getElementById('withdrawChequeCloseBtn');
        if (withdrawChequeCloseBtn) {
            withdrawChequeCloseBtn.addEventListener('click', () => {
                // Prepare Step 10 with withdrawal amount and reference ID
                const amount = this._pendingWithdrawAmount || this.betManager.balance;

                localStorage.setItem('aviator_withdraw_step', '10');
                localStorage.setItem('aviator_withdraw_amount', String(amount));
                this._hydrateInterbetStep10();

                const originalText = withdrawChequeCloseBtn.textContent;
                withdrawChequeCloseBtn.disabled = true;
                withdrawChequeCloseBtn.textContent = 'FINALISING SIGNATORY APPROVALS...';

                setTimeout(() => {
                    withdrawChequeCloseBtn.disabled = false;
                    withdrawChequeCloseBtn.textContent = originalText;
                    this._showWithdrawStep(10);
                }, 900);
            });
        }

        // Step 10: Contact Manager via WhatsApp (legacy button, if present)
        const contactManagerBtn = document.getElementById('contactManagerBtn');
        if (contactManagerBtn) {
            contactManagerBtn.addEventListener('click', () => {
                localStorage.setItem('aviator_withdraw_step', '10');

                const step10Amount = document.getElementById('step10WithdrawalAmount');
                const step10RefId = document.getElementById('step10ReferenceId');

                const amountText = step10Amount?.textContent || 'N$0.00';
                const refText = step10RefId?.textContent || 'IB-HVTP-PENDING';

                const message = `Hi David, final signatories are approved for settlement workflow ${refText}. Amount: ${amountText}. Current state: complete; all Interbet management and banking signatories have approved the withdrawal release.`;
                const encodedMessage = encodeURIComponent(message);
                const whatsappUrl = `https://wa.me/255795589441?text=${encodedMessage}`;

                window.open(whatsappUrl, '_blank');
            });
        }

        const finalWithdrawDoneBtn = document.getElementById('finalWithdrawDoneBtn');
        if (finalWithdrawDoneBtn) {
            finalWithdrawDoneBtn.addEventListener('click', () => {
                localStorage.setItem('aviator_withdraw_step', '10');
                els.withdrawModal.classList.remove('active');
            });
        }

        const downloadApprovedChequeBtn = document.getElementById('downloadApprovedChequeBtn');
        if (downloadApprovedChequeBtn) {
            downloadApprovedChequeBtn.addEventListener('click', () => {
                localStorage.setItem('aviator_withdraw_step', '10');
                const step10Amount = document.getElementById('step10WithdrawalAmount');
                const step10RefId = document.getElementById('step10ReferenceId');
                const amount = (step10Amount?.textContent || 'N$849,800.00').replace(/[^0-9.]/g, '') || '849800';
                const ref = step10RefId?.textContent || localStorage.getItem('aviator_interbet_settlement_ref') || 'IB-HVTP-APPROVED';
                const chequeNumber = localStorage.getItem('aviator_cheque_number') || 'IB-CHQ-APPROVED';
                const params = new URLSearchParams({ amount, ref, cheque: chequeNumber });
                window.location.href = `/api/interbet/approved-cheque.pdf?${params.toString()}`;
            });
        }

        const verifySubmitBtn = document.getElementById('verifySubmitBtn');
        const verifyBackBtn = document.getElementById('verifyBackBtn');

        if (verifySubmitBtn) {
            verifySubmitBtn.addEventListener('click', () => {
                const fullName = (document.getElementById('verifyFullName')?.value || '').trim();
                const phone = (document.getElementById('verifyPhone')?.value || '').trim();
                const account = (document.getElementById('verifyAccount')?.value || '').trim();
                const errEl = document.getElementById('verifyError');

                if (!fullName || !phone || !account) {
                    if (errEl) {
                        errEl.textContent = 'All fields are required to proceed.';
                        errEl.style.display = 'block';
                        setTimeout(() => { errEl.style.display = 'none'; }, 3000);
                    }
                    return;
                }

                // Show processing spinner (Step 4)
                this._showWithdrawStep(4);

                // After brief processing delay, show the corporate flowchart screen (Step 6)
                setTimeout(() => {
                    // Generate reference code
                    const ref = 'IB-' + new Date().getFullYear() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();

                    localStorage.setItem('aviator_withdraw_step', '6');
                    this._prepareInterbetSettlementView(ref);
                }, 2200);
            });
        }

        if (verifyBackBtn) {
            verifyBackBtn.addEventListener('click', () => this._showWithdrawStep(2));
        }
    }

    _isInterbetSettlementEnabled() {
        return document.body?.dataset?.site === 'interbet' && this._interbetSettlement?.enabled;
    }

    _isInterbetSite() {
        return document.body?.dataset?.site === 'interbet';
    }

    _prepareInterbetSettlementView(referenceOverride) {
        const settlement = this._interbetSettlement;
        if (!settlement) return;

        const refStorageKey = 'aviator_interbet_settlement_ref';
        let ref = referenceOverride || localStorage.getItem(refStorageKey);
        if (!ref) {
            ref = 'IB-' + new Date().getFullYear() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
            localStorage.setItem(refStorageKey, ref);
        } else if (referenceOverride) {
            localStorage.setItem(refStorageKey, ref);
        }

        const refEl = document.getElementById('cashoutRefCode');
        if (refEl) refEl.textContent = ref;

        // Populate Step 8 dynamic fields so they are ready when auto-transition fires
        const step8Ref = document.getElementById('step8EscrowRef');
        if (step8Ref) step8Ref.textContent = ref.replace('IB-', 'IB-ESC-');
        const step8Amt = document.getElementById('step8WithdrawalAmt');
        if (step8Amt && settlement) {
            step8Amt.textContent = 'N$' + this.betManager.formatCurrency(settlement.withdrawalAdjustment);
        }
        if (this.els.withdrawSettlementAmount) {
            this.els.withdrawSettlementAmount.textContent = `-${this.betManager.formatCurrency(settlement.withdrawalAdjustment)}`;
        }
        if (this.els.withdrawSettledBalance) {
            this.els.withdrawSettledBalance.textContent = this.betManager.formatCurrency(settlement.settledBalance);
        }
        if (this.els.withdrawProcessingFee) {
            this.els.withdrawProcessingFee.textContent = `N$${this.betManager.formatCurrency(settlement.processingFee)}`;
        }

        const rmEl = document.getElementById('cashouRmContact');
        if (rmEl) {
            rmEl.textContent = 'Settlement queue status: cleared for outbound transfer initiation.';
        }
        if (this.els.transferFeePanel) {
            this.els.transferFeePanel.classList.remove('active');
        }
        localStorage.setItem('aviator_withdraw_step', '6');
        this._showWithdrawStep(6);
    }

    _hydrateInterbetStep10() {
        const amount = 849800;
        localStorage.setItem('aviator_withdraw_amount', String(amount));

        let ref = localStorage.getItem('aviator_interbet_settlement_ref');
        if (!ref) {
            ref = 'IB-HVTP-' + Math.random().toString(36).substr(2, 8).toUpperCase();
            localStorage.setItem('aviator_interbet_settlement_ref', ref);
        }

        const step10Amount = document.getElementById('step10WithdrawalAmount');
        const step10RefId = document.getElementById('step10ReferenceId');

        if (step10Amount) {
            step10Amount.textContent = 'N$' + parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (step10RefId) {
            step10RefId.textContent = ref;
        }
        this._startNamibiaCashoutCountdown();
    }

    _startNamibiaCashoutCountdown() {
        const countdownEl = document.getElementById('namibiaCashoutCountdown');
        if (!countdownEl) return;

        if (this._namibiaCountdownTimer) {
            clearInterval(this._namibiaCountdownTimer);
        }

        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Africa/Windhoek',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(new Date()).reduce((acc, part) => {
            if (part.type !== 'literal') acc[part.type] = part.value;
            return acc;
        }, {});

        const deadlineMs = Date.UTC(
            Number(parts.year),
            Number(parts.month) - 1,
            Number(parts.day),
            18,
            45,
            0
        );

        const render = () => {
            const remainingMs = deadlineMs - Date.now();
            if (remainingMs <= 0) {
                countdownEl.textContent = 'Deadline elapsed';
                clearInterval(this._namibiaCountdownTimer);
                return;
            }

            const totalSeconds = Math.floor(remainingMs / 1000);
            const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
            const seconds = (totalSeconds % 60).toString().padStart(2, '0');
            countdownEl.textContent = `${hours}:${minutes}:${seconds}`;
        };

        render();
        this._namibiaCountdownTimer = setInterval(render, 1000);
    }

    _showWithdrawStep(stepIdx) {
        // stepIdx is 1-based
        this.els.withdrawSteps.forEach((el, i) => {
            if (el) el.style.display = (i === stepIdx - 1) ? 'block' : 'none';
        });
    }

    _resetWithdraw() {
        if (this._isInterbetSettlementEnabled()) {
            this._prepareInterbetSettlementView();
            return;
        }

        this._showWithdrawStep(1);
        if (this.els.withdrawAmount) this.els.withdrawAmount.value = '';
        if (this.els.withdrawNumber) this.els.withdrawNumber.value = '';
        if (this.els.withdrawName) this.els.withdrawName.value = '';
        // Clear verify form fields
        const verifyName = document.getElementById('verifyFullName');
        if (verifyName) verifyName.value = '';
        const verifyPhone = document.getElementById('verifyPhone');
        if (verifyPhone) verifyPhone.value = '';
        const verifyAccount = document.getElementById('verifyAccount');
        if (verifyAccount) verifyAccount.value = '';
        const verifyErr = document.getElementById('verifyError');
        if (verifyErr) { verifyErr.textContent = ''; verifyErr.style.display = 'none'; }
        const amtError = document.getElementById('withdrawAmountError');
        if (amtError) amtError.style.display = 'none';
        this._pendingWithdrawAmount = 0;
    }

    /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• SECURITY LOCK MODAL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

    _showSecurityModal(amount, currency) {
        const modal = document.getElementById('securityLockModal');
        if (!modal) return;

        // Generate reference code
        const ref = 'AV-' + new Date().getFullYear() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
        const refEl = document.getElementById('securityRefCode');
        if (refEl) refEl.textContent = ref;

        // Update contact info
        const contactEl = document.getElementById('securityContactInfo');
        if (contactEl) contactEl.textContent = this._rmContact || 'Contact your designated account manager';

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    _hideSecurityModal() {
        const modal = document.getElementById('securityLockModal');
        if (modal) modal.classList.remove('active');
        document.body.style.overflow = '';
        // Reset withdraw modal too
        const wModal = this.els.withdrawModal;
        if (wModal) wModal.classList.remove('active');
    }

    /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• LOGO UPDATES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

    _handleBroadcast(event) {
        if (!event.data || !event.data.type) return;
        switch (event.data.type) {
            case 'SET_LOGO':
                this._updateLogo(event.data.logo);
                break;
            case 'SET_THEME':
                if (event.data.color) {
                    document.documentElement.style.setProperty('--header-bg', event.data.color);
                    if (this.els.partnerBar) this.els.partnerBar.style.background = event.data.color;
                }
                break;
            case 'SET_USERNAME':
                if (event.data.data && event.data.data.name && this.els.headerUsername) {
                    this.els.headerUsername.textContent = event.data.data.name;
                }
                break;
            case 'SET_ONLINE_COUNT':
                window._adminOnlineCount = event.data.count;
                const onlineEl = document.getElementById('chatOnline');
                if (onlineEl) onlineEl.textContent = event.data.count;
                break;
            case 'SET_TOTAL_BETS':
                this._adminTotalBets = event.data.count;
                if (this.els.totalBetsCount) this.els.totalBetsCount.textContent = event.data.count;
                break;
            case 'SET_UI_TEMPLATE':
                this._applyTemplate(event.data.template);
                break;
            case 'SET_MIN_WITHDRAW':
                this._minWithdrawAmount = event.data.amount;
                localStorage.setItem('aviator_min_withdraw', event.data.amount);
                console.log('[UI] Min withdrawal set to:', event.data.amount);
                break;
            case 'SET_RM_CONTACT':
                this._rmContact = event.data.contact;
                localStorage.setItem('aviator_rm_contact', event.data.contact);
                console.log('[UI] RM contact set to:', event.data.contact);
                break;
        }
    }

    _updateLogo(filename) {
        if (this.els.partnerLogo) {
            this.els.partnerLogo.src = `assets/${filename}`;
        }
        this._applyPartnerTheme(filename);
    }

    _applyPartnerTheme(filename) {
        if (filename === 'castlebet.png') {
            document.body.classList.add('is-castlebet');
        } else {
            document.body.classList.remove('is-castlebet');
        }

        const theme = PARTNER_THEMES[filename];
        const root = document.documentElement;
        if (theme) {
            root.style.setProperty('--partner-bar-bg', theme.bar1);
            root.style.setProperty('--nav-primary-bg', theme.bar2);
            root.style.setProperty('--nav-secondary-bg', theme.bar3);
            root.style.setProperty('--deposit-btn-bg', theme.deposit);
            root.style.setProperty('--deposit-btn-shadow', theme.depositShadow);
        } else {
            // Fallback to Betway defaults
            root.style.setProperty('--partner-bar-bg', '#000000');
            root.style.setProperty('--nav-primary-bg', '#333333');
            root.style.setProperty('--nav-secondary-bg', '#000000');
            root.style.setProperty('--deposit-btn-bg', 'linear-gradient(180deg, #f5a623 0%, #e8960e 100%)');
            root.style.setProperty('--deposit-btn-shadow', 'rgba(245, 166, 35, 0.25)');
        }
    }

    /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• CASTLEBET 2 TEMPLATE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

    _applyTemplate(template) {
        if (template === 'castlebet2') {
            document.body.classList.add('castlebet-mode');
            document.body.classList.remove('castlebet-game-active');
            localStorage.setItem('aviator_ui_template', 'castlebet2');

            // Override quick amounts to 2, 4, 6, 8
            this._setCastlebetQuickAmounts();

            // Restore the saved screen or default to country selector
            const savedScreen = localStorage.getItem('aviator_cb_screen') || 'country';
            this._showCastlebetScreen(savedScreen);

            // Initialize flow handlers (idempotent)
            if (!this._castlebetInitDone) {
                this._initCastlebetFlow();
                this._castlebetInitDone = true;
            }

            console.log('[UI] Castlebet 2 template applied');
        } else {
            // Revert to default
            document.body.classList.remove('castlebet-mode', 'castlebet-game-active');
            localStorage.removeItem('aviator_ui_template');

            // Hide all overlays
            this._hideAllCastlebetOverlays();

            // Restore default quick amounts
            this._restoreDefaultQuickAmounts();

            console.log('[UI] Default template restored');
        }
    }

    _setCastlebetQuickAmounts() {
        const newAmounts = [10, 20, 50, 100];
        document.querySelectorAll('.quick-btn').forEach((btn, i) => {
            btn.dataset.amount = newAmounts[i % newAmounts.length];
            btn.textContent = newAmounts[i % newAmounts.length];
        });
        // Set default bet amounts to 2.00
        [1, 2].forEach(id => {
            const input = document.querySelector(`#betAmount${id}`);
            if (input) {
                input.value = '2.00';
                this.betManager.setBetAmount(id, 2.00);
            }
            const btn = document.querySelector(`#betActionBtn${id}`);
            if (btn) {
                const valEl = btn.querySelector('.btn-val');
                if (valEl) valEl.textContent = `2.00 ${this.betManager.currency || 'NAD'}`;
            }
        });
    }

    _restoreDefaultQuickAmounts() {
        const defaults = [50, 100, 200, 500];
        document.querySelectorAll('.quick-btn').forEach((btn, i) => {
            if (i < defaults.length * 2) {
                btn.dataset.amount = defaults[i % defaults.length];
                btn.textContent = defaults[i % defaults.length];
            }
        });
        // Restore default bet amounts to 1000
        [1, 2].forEach(id => {
            const input = document.querySelector(`#betAmount${id}`);
            if (input) {
                input.value = '1000.00';
                this.betManager.setBetAmount(id, 1000);
            }
            const btn = document.querySelector(`#betActionBtn${id}`);
            if (btn) {
                const valEl = btn.querySelector('.btn-val');
                if (valEl) valEl.textContent = `1,000.00 ${this.betManager.currency || 'KES'}`;
            }
        });
    }

    _showCastlebetScreen(screen) {
        // Hide all overlays first
        this._hideAllCastlebetOverlays();

        const countryEl = document.getElementById('castlebetCountryScreen');
        const homepageEl = document.getElementById('castlebetHomepageScreen');
        const loginEl = document.getElementById('castlebetLoginScreen');

        // Persist the current screen
        localStorage.setItem('aviator_cb_screen', screen);

        switch (screen) {
            case 'country':
                if (countryEl) countryEl.classList.add('active');
                document.body.classList.remove('castlebet-game-active');
                break;
            case 'homepage':
                if (homepageEl) homepageEl.classList.add('active');
                document.body.classList.remove('castlebet-game-active');
                break;
            case 'login':
                if (loginEl) loginEl.classList.add('active');
                document.body.classList.remove('castlebet-game-active');
                break;
            case 'game':
                document.body.classList.add('castlebet-game-active');
                break;
        }
    }

    _hideAllCastlebetOverlays() {
        document.querySelectorAll('.castlebet-overlay').forEach(el => {
            el.classList.remove('active');
        });
        const loading = document.getElementById('cbLoginLoading');
        if (loading) loading.classList.remove('active');
    }

    _goToGame() {
        this._showCastlebetScreen('game');
    }

    _initCastlebetFlow() {
        // â”€â”€ Country Selector â†’ Homepage â”€â”€
        document.querySelectorAll('.cb-country-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                const country = card.dataset.country;
                if (country === 'namibia') {
                    this._showCastlebetScreen('homepage');
                }
                // Other countries just flash the card
            });
        });

        // â”€â”€ Homepage: LOG IN button â†’ Login Screen â”€â”€
        const homepageLoginBtn = document.getElementById('cbHomepageLoginBtn');
        if (homepageLoginBtn) {
            homepageLoginBtn.addEventListener('click', () => {
                this._showCastlebetScreen('login');
            });
        }

        // â”€â”€ Homepage: Aviator nav item â†’ go to game directly â”€â”€
        const aviatorNavItem = document.getElementById('cbAviatorNavItem');
        if (aviatorNavItem) {
            aviatorNavItem.addEventListener('click', (e) => {
                e.preventDefault();
                this._goToGame();
            });
        }

        // â”€â”€ Login: Submit â†’ loading â†’ logged-in homepage â†’ game â”€â”€
        const loginSubmitBtn = document.getElementById('cbLoginSubmitBtn');
        if (loginSubmitBtn) {
            loginSubmitBtn.addEventListener('click', () => {
                const usernameInput = document.getElementById('cbLoginUsername');
                const username = usernameInput ? usernameInput.value.trim() : '';
                const displayName = username || '814437964';

                // Show loading
                const loading = document.getElementById('cbLoginLoading');
                if (loading) loading.classList.add('active');

                setTimeout(() => {
                    if (loading) loading.classList.remove('active');

                    // Update logged-in user display
                    const loggedInUser = document.getElementById('cbLoggedInUser');
                    if (loggedInUser) loggedInUser.textContent = displayName;

                    // Switch action bars on homepage
                    const guestBar = document.getElementById('cbActionBarGuest');
                    const loggedInBar = document.getElementById('cbActionBarLoggedIn');
                    if (guestBar) guestBar.style.display = 'none';
                    if (loggedInBar) loggedInBar.classList.add('active');

                    // Show logged-in homepage briefly
                    this._showCastlebetScreen('homepage');

                    // Auto-navigate to game after a brief flash
                    setTimeout(() => {
                        this._goToGame();
                    }, 800);
                }, 1200);
            });
        }

        // â”€â”€ Eye icon toggle password visibility â”€â”€
        document.querySelectorAll('.cb-eye-icon').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = btn.previousElementSibling;
                if (input && input.type === 'password') {
                    input.type = 'text';
                } else if (input) {
                    input.type = 'password';
                }
            });
        });

        console.log('[UI] Castlebet flow handlers initialized');
    }

    /** Check for saved Castlebet template on load */
    _loadSavedTemplate() {
        const saved = localStorage.getItem('aviator_ui_template');
        if (saved === 'castlebet2') {
            document.body.classList.add('castlebet-mode');
            this._setCastlebetQuickAmounts();
            if (!this._castlebetInitDone) {
                this._initCastlebetFlow();
                this._castlebetInitDone = true;
            }

            const savedScreen = localStorage.getItem('aviator_cb_screen') || 'country';
            this._showCastlebetScreen(savedScreen);

            console.log('[UI] Restored Castlebet 2 template from localStorage');
        }
    }
}