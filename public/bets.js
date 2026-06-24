/**
 * BETTING SYSTEM — js/bets.js
 * Manages player balance, bet placement, cash outs, and auto-play.
 */

class BetManager {
  constructor(initialBalance = 10000.00) {
    this.MIN_BET = 10;
    this.MAX_BET = 10000;
    this.activeBets = {};
    this.betAmounts = { 1: 10, 2: 10 };
    this.autoBet = { 1: false, 2: false };
    this.autoPlaySettings = {
      1: { enabled: false, rounds: 0, autoCashOut: 0, stopOnWin: 0, stopOnLoss: 0, roundsPlayed: 0 },
      2: { enabled: false, rounds: 0, autoCashOut: 0, stopOnWin: 0, stopOnLoss: 0, roundsPlayed: 0 }
    };
    this._balanceListeners = [];
    this._currencyListeners = [];
    this._usernameListeners = [];
    this._loadFromStorage(initialBalance);
    console.log('BetManager initialized | Balance:', this.balance, this.currency, '| Username:', this.username);
  }

  _loadFromStorage(defaultBalance) {
    try {
      // ALWAYS prefer localStorage balance — it's updated in real-time
      let savedBalance = localStorage.getItem('aviator_balance');

      if (savedBalance !== null && !isNaN(parseFloat(savedBalance))) {
        this.balance = parseFloat(savedBalance);
      } else {
        this.balance = defaultBalance || 10000.00;
        localStorage.setItem('aviator_balance', this.balance.toString());
      }

      this.currency = localStorage.getItem('aviator_currency') || 'USD';
      this.username = localStorage.getItem('aviator_username') || 'Guest';
    } catch (err) {
      console.warn('Failed to load from localStorage:', err);
      this.balance = defaultBalance || 10000.00;
      this.currency = 'USD';
      this.username = 'Player';
    }
  }

  _saveToStorage() {
    try {
      localStorage.setItem('aviator_balance', this.balance.toString());
      localStorage.setItem('aviator_currency', this.currency);
      localStorage.setItem('aviator_username', this.username);
    } catch (err) {
      console.warn('Failed to save to localStorage:', err);
    }
  }

  syncWithServer(user) {
    if (user && user.totalBalance !== undefined) {
      // Only update if server balance is higher, or if local is 0
      const localBal = this.balance;
      const serverBal = parseFloat(user.totalBalance) || 0;
      if (serverBal > localBal || localBal === 0) {
        this.balance = serverBal;
      }
      this.currency = user.currency || 'USD';
      this.username = user.username || 'Guest';
      this._saveToStorage();
      this._notifyBalanceChange();
    }
  }

  formatCurrency(amount) {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  onBalanceChange(callback) {
    this._balanceListeners.push(callback);
  }

  onCurrencyChange(callback) {
    this._currencyListeners.push(callback);
  }

  _notifyBalanceChange() {
    this._saveToStorage();
    this._balanceListeners.forEach(cb => cb(this.balance));
    // Also sync with auth manager if available
    if (window.authManager && window.authManager.syncBalance) {
      window.authManager.syncBalance(this.balance);
    }
  }

  _notifyCurrencyChange() {
    this._currencyListeners.forEach(cb => cb(this.currency));
  }

  onUsernameChange(callback) {
    this._usernameListeners.push(callback);
  }

  _notifyUsernameChange() {
    this._usernameListeners.forEach(cb => cb(this.username));
  }

  setBalance(amount) {
    this.balance = parseFloat(amount) || 0;
    this._saveToStorage();
    this._notifyBalanceChange();
  }

  setCurrency(code) {
    this.currency = code;
    this._saveToStorage();
    this._notifyCurrencyChange();
  }

  setUsername(name) {
    this.username = name;
    this._saveToStorage();
    this._notifyUsernameChange();
  }

  getBetAmount(panelId) {
    return this.betAmounts[panelId] || this.MIN_BET;
  }

  setBetAmount(panelId, amount) {
    const clamped = Math.max(this.MIN_BET, Math.min(this.MAX_BET, amount));
    this.betAmounts[panelId] = Math.round(clamped / 10) * 10;
    console.log(`Panel ${panelId} bet amount set to:`, this.betAmounts[panelId]);
    return this.betAmounts[panelId];
  }

  increaseBet(panelId, step = 10) {
    return this.setBetAmount(panelId, this.getBetAmount(panelId) + step);
  }

  decreaseBet(panelId, step = 10) {
    return this.setBetAmount(panelId, this.getBetAmount(panelId) - step);
  }

  placeBet(panelId) {
    try {
      const amount = this.getBetAmount(panelId);
      if (this.activeBets[panelId] && this.activeBets[panelId].active) {
        return { success: false, message: 'Bet already active on this panel' };
      }
      if (amount < this.MIN_BET) {
        return { success: false, message: `Minimum bet is ${this.MIN_BET}` };
      }
      if (amount > this.MAX_BET) {
        return { success: false, message: `Maximum bet is ${this.MAX_BET}` };
      }
      if (amount > this.balance) {
        return { success: false, message: 'Insufficient balance' };
      }

      this.balance -= amount;
      this.activeBets[panelId] = {
        amount: amount,
        active: true,
        cashedOut: false,
        cashOutMultiplier: null,
        winAmount: 0
      };

      this._notifyBalanceChange();
      console.log('Bet placed:', amount, '| Panel:', panelId, '| Balance:', this.balance);
      return { success: true };
    } catch (err) {
      console.error('Error placing bet:', err);
      return { success: false, message: 'An error occurred' };
    }
  }

  cancelBet(panelId) {
    try {
      const bet = this.activeBets[panelId];
      if (!bet || !bet.active) {
        return { success: false, message: 'No active bet to cancel' };
      }
      this.balance += bet.amount;
      delete this.activeBets[panelId];
      this._notifyBalanceChange();
      console.log('Bet cancelled | Panel:', panelId, '| Refunded:', bet.amount, '| Balance:', this.balance);
      return { success: true };
    } catch (err) {
      console.error('Error cancelling bet:', err);
      return { success: false, message: 'An error occurred' };
    }
  }

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
      this.balance += winAmount;
      this._notifyBalanceChange();
      console.log('Cash out! Panel:', panelId, '| Multiplier:', multiplier.toFixed(2), '| Win:', winAmount.toFixed(2), '| Balance:', this.balance.toFixed(2));
      return { success: true, winAmount };
    } catch (err) {
      console.error('Error cashing out:', err);
      return { success: false, message: 'An error occurred' };
    }
  }

  settleBets() {
    for (const panelId in this.activeBets) {
      const bet = this.activeBets[panelId];
      if (bet && bet.active && !bet.cashedOut) {
        bet.active = false;
        bet.winAmount = 0;
        console.log('Bet lost | Panel:', panelId, '| Amount:', bet.amount);
      }
    }
  }

  clearBets() {
    this.activeBets = {};
  }

  hasBetActive(panelId) {
    const bet = this.activeBets[panelId];
    return bet ? bet.active && !bet.cashedOut : false;
  }

  setAutoPlay(panelId, settings) {
    this.autoPlaySettings[panelId] = {
      ...this.autoPlaySettings[panelId],
      ...settings,
      roundsPlayed: 0
    };
    console.log('Auto-play configured for panel', panelId, settings);
  }

  shouldAutoCashOut(panelId, multiplier) {
    const settings = this.autoPlaySettings[panelId];
    if (!settings.enabled || settings.autoCashOut <= 0) return false;
    return multiplier >= settings.autoCashOut;
  }

  withdraw(amount) {
    if (amount <= 0) return { success: false, message: 'Invalid amount' };
    if (amount > this.balance) return { success: false, message: 'Insufficient balance' };
    this.balance -= amount;
    this._notifyBalanceChange();
    console.log('Withdrawal processed:', amount, '| New Balance:', this.balance);
    return { success: true };
  }

  refill() {
    this.balance = 10000.00;
    this._saveToStorage();
    this._notifyBalanceChange();
    console.log('Balance refilled to 10,000.00');
  }
}