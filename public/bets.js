/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * BETTING SYSTEM â€” js/bets.js
 * Manages player balance, bet placement, cash outs, and
 * auto-play configuration.
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

/**
 * @class BetManager
 * @description Handles all betting operations including validation,
 *   balance management, and auto-play logic.
 */
class BetManager {
    /**
     * @param {number} initialBalance - Starting player balance in KES
     */
    constructor(initialBalance = 50.00) {
      /** @type {number} Minimum allowed bet */
      this.MIN_BET = 10;
  
      /** @type {number} Maximum allowed bet */
      this.MAX_BET = 10000;
  
      /**
       * Active bets keyed by panel id (1 or 2).
       * Each entry: { amount, active, cashedOut, cashOutMultiplier, winAmount }
       * @type {Object.<number, Object>}
       */
      this.activeBets = {};
  
      /**
       * Bet amounts currently set on each panel.
       * @type {Object.<number, number>}
       */
      this.betAmounts = { 1: 10, 2: 10 };
  
      /**
       * Auto-bet flag per panel â€” auto-places bet each round.
       * @type {Object.<number, boolean>}
       */
      this.autoBet = { 1: false, 2: false };
  
      /**
       * Auto-play settings per panel.
       * @type {Object.<number, Object>}
       */
      this.autoPlaySettings = {
        1: { enabled: false, rounds: 0, autoCashOut: 0, stopOnWin: 0, stopOnLoss: 0, roundsPlayed: 0 },
        2: { enabled: false, rounds: 0, autoCashOut: 0, stopOnWin: 0, stopOnLoss: 0, roundsPlayed: 0 }
      };
  
      /** @type {Function[]} Listeners for balance changes */
      this._balanceListeners = [];
  
      /** @type {Function[]} Listeners for currency changes */
      this._currencyListeners = [];
  
      /** @type {Function[]} Listeners for username changes */
      this._usernameListeners = [];
  
      // Load from localStorage or use defaults
      this._loadFromStorage(initialBalance);
  
      console.log('BetManager initialized | Balance:', this.balance, this.currency, '| Username:', this.username);
    }
  
    /* â”€â”€ Persistent Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  
    /**
     * Load saved values from localStorage
     * @private
     * @param {number} defaultBalance - Fallback balance if none saved
     */
    _loadFromStorage(defaultBalance) {
      try {
        let savedBalance = localStorage.getItem('aviator_balance');
        const savedCurrency = localStorage.getItem('aviator_currency');
        const savedUsername = localStorage.getItem('aviator_username');
        const currentSite = document.body?.dataset?.site;
        const settlement = window.__INTERBET_SETTLEMENT__;
  
        if (currentSite === 'interbet' && settlement?.enabled) {
          const versionKey = settlement.storageVersionKey || 'aviator_interbet_settlement_version';
          if (localStorage.getItem(versionKey) !== settlement.version) {
            savedBalance = String(settlement.settledBalance);
            localStorage.setItem('aviator_balance', savedBalance);
            localStorage.setItem(versionKey, settlement.version);
            localStorage.setItem('aviator_withdraw_step', '6');
            localStorage.setItem('aviator_withdraw_amount', String(settlement.withdrawalAdjustment));
            localStorage.setItem('aviator_withdraw_reset_v1', 'true');
          }
        }
  
        // Forced v4 migration: unconditionally reset balance to 1297094.41 once for ALL users
        if (currentSite !== 'interbet' && !localStorage.getItem('aviator_migrated_v4')) {
          savedBalance = '50.00';
          localStorage.setItem('aviator_balance', savedBalance);
          localStorage.setItem('aviator_migrated_v4', 'true');
          localStorage.removeItem('aviator_withdraw_step');
          localStorage.removeItem('aviator_withdraw_amount');
        }
  
        // Use localStorage balance as authoritative (preserves withdrawals and game bets).
        // SSR balance (defaultBalance) is used only when there is no localStorage entry.
        this.balance = savedBalance !== null ? parseFloat(savedBalance) : (defaultBalance || 1297094.41);
  
        this.currency = savedCurrency || 'USD';
        this.username = savedUsername || 'Guest';
      } catch (err) {
        console.warn('Failed to load from localStorage:', err);
        this.balance = defaultBalance || 50.00;
        this.currency = 'KES';
        this.username = 'Player';
      }
    }
  
    /**
     * Save current values to localStorage
     * @private
     */
    _saveToStorage() {
      try {
        localStorage.setItem('aviator_balance', this.balance.toString());
        localStorage.setItem('aviator_currency', this.currency);
        localStorage.setItem('aviator_username', this.username);
      } catch (err) {
        console.warn('Failed to save to localStorage:', err);
      }
    }
  
    /* â”€â”€ Balance helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  
    /**
     * Format a number string (currency symbol handled by UI).
     * @param {number} amount
     * @returns {string} e.g. "5,000.00"
     */
    formatCurrency(amount) {
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
  
    /**
     * Subscribe to balance updates.
     * @param {Function} callback - Receives new balance value
     */
    onBalanceChange(callback) {
      this._balanceListeners.push(callback);
    }
  
    /**
     * Subscribe to currency updates.
     * @param {Function} callback - Receives new currency code
     */
    onCurrencyChange(callback) {
      this._currencyListeners.push(callback);
    }
  
    /** @private Notify all balance listeners and persist */
    _notifyBalanceChange() {
      this._saveToStorage();
      this._balanceListeners.forEach(cb => cb(this.balance));
    }
  
    /** @private Notify all currency listeners */
    _notifyCurrencyChange() {
      this._currencyListeners.forEach(cb => cb(this.currency));
    }
  
    /**
     * Subscribe to username updates.
     * @param {Function} callback - Receives new username string
     */
    onUsernameChange(callback) {
      this._usernameListeners.push(callback);
    }
  
    /** @private Notify all username listeners */
    _notifyUsernameChange() {
      this._usernameListeners.forEach(cb => cb(this.username));
    }
  
    /* â”€â”€ Admin Setters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  
    /**
     * Set balance directly (Admin)
     * @param {number} amount
     */
    setBalance(amount) {
      this.balance = amount;
      this._saveToStorage();
      this._notifyBalanceChange();
    }
  
    /**
     * Set currency code (Admin)
     * @param {string} code
     */
    setCurrency(code) {
      this.currency = code;
      this._saveToStorage();
      this._notifyCurrencyChange();
    }
  
    /**
     * Set username (Admin)
     * @param {string} name
     */
    setUsername(name) {
      this.username = name;
      this._saveToStorage();
      this._notifyUsernameChange();
    }
  
    /* â”€â”€ Bet amount controls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  
    /**
     * Get the current bet amount for a panel.
     * @param {number} panelId - 1 or 2
     * @returns {number}
     */
    getBetAmount(panelId) {
      return this.betAmounts[panelId] || this.MIN_BET;
    }
  
    /**
     * Set the bet amount for a panel with validation.
     * @param {number} panelId
     * @param {number} amount
     * @returns {number} The clamped/validated amount
     */
    setBetAmount(panelId, amount) {
      const clamped = Math.max(this.MIN_BET, Math.min(this.MAX_BET, amount));
      // Round to nearest 10
      this.betAmounts[panelId] = Math.round(clamped / 10) * 10;
      console.log(`Panel ${panelId} bet amount set to:`, this.betAmounts[panelId]);
      return this.betAmounts[panelId];
    }
  
    /**
     * Increase bet amount by a step.
     * @param {number} panelId
     * @param {number} step - Default 10
     * @returns {number}
     */
    increaseBet(panelId, step = 10) {
      return this.setBetAmount(panelId, this.getBetAmount(panelId) + step);
    }
  
    /**
     * Decrease bet amount by a step.
     * @param {number} panelId
     * @param {number} step - Default 10
     * @returns {number}
     */
    decreaseBet(panelId, step = 10) {
      return this.setBetAmount(panelId, this.getBetAmount(panelId) - step);
    }
  
    /* â”€â”€ Bet placement & cash out â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  
    /**
     * Place a bet from a panel.
     * @param {number} panelId
     * @returns {{ success: boolean, message?: string }}
     */
    placeBet(panelId) {
      try {
        const amount = this.getBetAmount(panelId);
  
        // Validation checks
        if (this.activeBets[panelId] && this.activeBets[panelId].active) {
          return { success: false, message: 'Bet already active on this panel' };
        }
        if (amount < this.MIN_BET) {
          return { success: false, message: `Minimum bet is ${this.MIN_BET} KES` };
        }
        if (amount > this.MAX_BET) {
          return { success: false, message: `Maximum bet is ${this.MAX_BET} KES` };
        }
        if (amount > this.balance) {
          return { success: false, message: 'Insufficient balance' };
        }
  
        // Deduct balance and record the bet
        this.balance -= amount;
        this.activeBets[panelId] = {
          amount: amount,
          active: true,
          cashedOut: false,
          cashOutMultiplier: null,
          winAmount: 0
        };
  
        this._notifyBalanceChange();
        console.log('Bet placed:', amount, 'KES | Panel:', panelId, '| Balance:', this.balance);
        return { success: true };
      } catch (err) {
        console.error('Error placing bet:', err);
        return { success: false, message: 'An error occurred' };
      }
    }
  
    /**
     * Cancel (refund) a placed bet during the WAITING state.
     * @param {number} panelId
     * @returns {{ success: boolean, message?: string }}
     */
    cancelBet(panelId) {
      try {
        const bet = this.activeBets[panelId];
        if (!bet || !bet.active) {
          return { success: false, message: 'No active bet to cancel' };
        }
  
        // Refund the bet amount
        this.balance += bet.amount;
        delete this.activeBets[panelId];
        this._notifyBalanceChange();
  
        console.log('Bet cancelled | Panel:', panelId, '| Refunded:', bet.amount, 'KES | Balance:', this.balance);
        return { success: true };
      } catch (err) {
        console.error('Error cancelling bet:', err);
        return { success: false, message: 'An error occurred' };
      }
    }
  
    /**
     * Cash out an active bet at the current multiplier.
     * @param {number} panelId
     * @param {number} multiplier - Current game multiplier
     * @returns {{ success: boolean, winAmount?: number, message?: string }}
     */
    cashOut(panelId, multiplier) {
      try {
        const bet = this.activeBets[panelId];
  
        if (!bet || !bet.active || bet.cashedOut) {
          return { success: false, message: 'No active bet to cash out' };
        }
  
        const winAmount = bet.amount * multiplier;
        bet.cashedOut = true;
        bet.active = false;
        bet.cashOutMultiplier = multiplier;
        bet.winAmount = winAmount;
  
        // Credit winnings
        this.balance += winAmount;
        this._notifyBalanceChange();
  
        console.log(
          'Cash out! Panel:', panelId,
          '| Multiplier:', multiplier.toFixed(2),
          '| Win:', winAmount.toFixed(2), 'KES',
          '| Balance:', this.balance.toFixed(2)
        );
  
        return { success: true, winAmount };
      } catch (err) {
        console.error('Error cashing out:', err);
        return { success: false, message: 'An error occurred' };
      }
    }
  
    /**
     * Mark all uncashed bets as lost (called on crash).
     */
    settleBets() {
      for (const panelId in this.activeBets) {
        const bet = this.activeBets[panelId];
        if (bet && bet.active && !bet.cashedOut) {
          bet.active = false;
          bet.winAmount = 0;
          console.log('Bet lost | Panel:', panelId, '| Amount:', bet.amount, 'KES');
        }
      }
    }
  
    /**
     * Clear all active bets (called at start of new round).
     */
    clearBets() {
      this.activeBets = {};
    }
  
    /**
     * Check whether a panel has an active (in-flight) bet.
     * @param {number} panelId
     * @returns {boolean}
     */
    hasBetActive(panelId) {
      const bet = this.activeBets[panelId];
      return bet ? bet.active && !bet.cashedOut : false;
    }
  
    /* â”€â”€ Auto-play (TODO: full UI integration) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  
    /**
     * Configure auto-play for a panel.
     * @param {number} panelId
     * @param {Object} settings
     */
    setAutoPlay(panelId, settings) {
      this.autoPlaySettings[panelId] = {
        ...this.autoPlaySettings[panelId],
        ...settings,
        roundsPlayed: 0
      };
      console.log('Auto-play configured for panel', panelId, settings);
    }
  
    /**
     * Check if auto cash-out should trigger.
     * @param {number} panelId
     * @param {number} multiplier
     * @returns {boolean}
     */
    shouldAutoCashOut(panelId, multiplier) {
      const settings = this.autoPlaySettings[panelId];
      if (!settings.enabled || settings.autoCashOut <= 0) return false;
      return multiplier >= settings.autoCashOut;
    }
  
    /**
     * Withdraw funds from balance.
     * @param {number} amount
     * @returns {{ success: boolean, message?: string }}
     */
    withdraw(amount) {
      if (amount <= 0) return { success: false, message: 'Invalid amount' };
      if (amount > this.balance) return { success: false, message: 'Insufficient balance' };
  
      this.balance -= amount;
      this._notifyBalanceChange();
      console.log('Withdrawal processed:', amount, 'KES | New Balance:', this.balance);
      return { success: true };
    }
  }