/**
 * AUTH SYSTEM — auth.js
 * Handles registration, login, JWT storage, and API calls
 */

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3041/api' 
  : 'https://aviatorguru.site/api';

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('aviator_token') || null;
    this.user = null;
    this.isLoggedIn = false;
    this._listeners = [];

    if (this.token) {
      this.validateToken();
    }
  }

  onAuthChange(callback) {
    this._listeners.push(callback);
  }

  _notifyListeners() {
    this._listeners.forEach(cb => {
      try { cb(this.isLoggedIn, this.user); } catch (e) {}
    });
  }

  async validateToken() {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();

      if (data.success) {
        this.user = data.user;
        this.isLoggedIn = true;
        // CRITICAL FIX: Don't overwrite local balance with stale server balance
        // The server balance may be outdated if bets were placed client-side
        const localBal = parseFloat(localStorage.getItem('aviator_balance')) || 0;
        if (localBal > 0) {
          this.user.totalBalance = localBal;
        } else if (data.user.totalBalance) {
          localStorage.setItem('aviator_balance', data.user.totalBalance.toString());
        }
        this._notifyListeners();
        return true;
      } else {
        this.logout();
        return false;
      }
    } catch (err) {
      console.warn('[Auth] Token validation failed:', err);
      this.logout();
      return false;
    }
  }

  async register(username, email, password, phone = '', country = 'US', countryCode = '+1') {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, phone, country, countryCode })
      });

      const data = await res.json();

      if (data.success) {
        this.token = data.token;
        this.user = data.user;
        this.isLoggedIn = true;
        localStorage.setItem('aviator_token', this.token);
        localStorage.setItem('aviator_username', data.user.username);
        // Store initial balance from server
        const initialBalance = data.user.totalBalance || 50;
        localStorage.setItem('aviator_balance', initialBalance.toString());
        localStorage.setItem('aviator_currency', data.user.currency || 'USD');

        this._notifyListeners();
        return { success: true, data };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.error('[Auth] Register error:', err);
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  async login(email, password) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.success) {
        this.token = data.token;
        this.user = data.user;
        this.isLoggedIn = true;
        localStorage.setItem('aviator_token', this.token);
        localStorage.setItem('aviator_username', data.user.username);
        // CRITICAL FIX: Preserve local balance if it exists and is different
        const localBal = parseFloat(localStorage.getItem('aviator_balance')) || 0;
        const serverBal = data.user.totalBalance || 50;
        if (localBal > serverBal) {
          // Local balance is more recent (user placed bets/won)
          this.user.totalBalance = localBal;
        } else {
          localStorage.setItem('aviator_balance', serverBal.toString());
          this.user.totalBalance = serverBal;
        }
        localStorage.setItem('aviator_currency', data.user.currency || 'USD');

        this._notifyListeners();
        return { success: true, data };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.error('[Auth] Login error:', err);
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    this.isLoggedIn = false;
    localStorage.removeItem('aviator_token');
    localStorage.removeItem('aviator_username');
    // Keep balance/currency for guest mode
    this._notifyListeners();
  }

  async apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) { this.logout(); }
      return await res.json();
    } catch (err) {
      console.error('[Auth] API call error:', err);
      return { success: false, message: 'Network error' };
    }
  }

  getBalance() {
    // ALWAYS prefer localStorage — it is updated in real-time by BetManager
    const localBal = parseFloat(localStorage.getItem('aviator_balance'));
    if (!isNaN(localBal)) {
      return localBal;
    }
    if (this.user) {
      return this.user.totalBalance || 50;
    }
    return 50;
  }

  getCurrency() {
    const localCur = localStorage.getItem('aviator_currency');
    if (localCur) return localCur;
    if (this.user) return this.user.currency || 'USD';
    return 'USD';
  }

  // Call this whenever BetManager updates balance to keep auth in sync
  syncBalance(newBalance) {
    if (this.user) {
      this.user.totalBalance = newBalance;
    }
  }
}

// Global instance
window.API_BASE_URL = API_BASE_URL;
window.authManager = new AuthManager();

// Initialize auth UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
});

function initAuthUI() {
  if (!document.getElementById('authModal')) {
    createAuthModal();
  }

  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (loginBtn) loginBtn.addEventListener('click', () => showAuthModal('login'));
  if (registerBtn) registerBtn.addEventListener('click', () => showAuthModal('register'));
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    window.authManager.logout();
    location.reload();
  });

  window.authManager.onAuthChange((isLoggedIn, user) => {
    updateAuthUI(isLoggedIn, user);
  });

  if (window.authManager.isLoggedIn) {
    updateAuthUI(true, window.authManager.user);
  } else {
    updateAuthUI(false, null);
  }
}

function createAuthModal() {
  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card auth-card" style="max-width:420px;">
      <div class="modal-header">
        <h3 id="authTitle">Welcome</h3>
        <button class="modal-close" id="authModalClose">&times;</button>
      </div>
      <div class="modal-body">
        <div id="authMessage" style="display:none; padding:10px; border-radius:8px; margin-bottom:12px; font-size:0.85rem;"></div>

        <div id="registerFields" style="display:none;">
          <div class="input-group">
            <label>Username</label>
            <input type="text" id="regUsername" placeholder="Choose a username" style="width:100%; padding:12px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; margin-top:6px;">
          </div>
          <div class="input-group" style="margin-top:12px;">
            <label>Country</label>
            <select id="regCountry" style="width:100%; padding:12px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; margin-top:6px;">
              <option value="DZ">Algeria 🇩🇿</option>
              <option value="AO">Angola 🇦🇴</option>
              <option value="BJ">Benin 🇧🇯</option>
              <option value="BW">Botswana 🇧🇼</option>
              <option value="BF">Burkina Faso 🇧🇫</option>
              <option value="BI">Burundi 🇧🇮</option>
              <option value="CM">Cameroon 🇨🇲</option>
              <option value="CV">Cape Verde 🇨🇻</option>
              <option value="CF">Central African Republic 🇨🇫</option>
              <option value="TD">Chad 🇹🇩</option>
              <option value="KM">Comoros 🇰🇲</option>
              <option value="CG">Congo 🇨🇬</option>
              <option value="CD">DR Congo 🇨🇩</option>
              <option value="CI">Côte d'Ivoire 🇨🇮</option>
              <option value="DJ">Djibouti 🇩🇯</option>
              <option value="EG">Egypt 🇪🇬</option>
              <option value="GQ">Equatorial Guinea 🇬🇶</option>
              <option value="ER">Eritrea 🇪🇷</option>
              <option value="SZ">Eswatini 🇸🇿</option>
              <option value="ET">Ethiopia 🇪🇹</option>
              <option value="GA">Gabon 🇬🇦</option>
              <option value="GM">Gambia 🇬🇲</option>
              <option value="GH">Ghana 🇬🇭</option>
              <option value="GN">Guinea 🇬🇳</option>
              <option value="GW">Guinea-Bissau 🇬🇼</option>
              <option value="KE" selected>Kenya 🇰🇪</option>
              <option value="LS">Lesotho 🇱🇸</option>
              <option value="LR">Liberia 🇱🇷</option>
              <option value="LY">Libya 🇱🇾</option>
              <option value="MG">Madagascar 🇲🇬</option>
              <option value="MW">Malawi 🇲🇼</option>
              <option value="ML">Mali 🇲🇱</option>
              <option value="MR">Mauritania 🇲🇷</option>
              <option value="MU">Mauritius 🇲🇺</option>
              <option value="MA">Morocco 🇲🇦</option>
              <option value="MZ">Mozambique 🇲🇿</option>
              <option value="NA">Namibia 🇳🇦</option>
              <option value="NE">Niger 🇳🇪</option>
              <option value="NG">Nigeria 🇳🇬</option>
              <option value="RW">Rwanda 🇷🇼</option>
              <option value="ST">São Tomé and Príncipe 🇸🇹</option>
              <option value="SN">Senegal 🇸🇳</option>
              <option value="SC">Seychelles 🇸🇨</option>
              <option value="SL">Sierra Leone 🇸🇱</option>
              <option value="SO">Somalia 🇸🇴</option>
              <option value="ZA">South Africa 🇿🇦</option>
              <option value="SS">South Sudan 🇸🇸</option>
              <option value="SD">Sudan 🇸🇩</option>
              <option value="TZ">Tanzania 🇹🇿</option>
              <option value="TG">Togo 🇹🇬</option>
              <option value="TN">Tunisia 🇹🇳</option>
              <option value="UG">Uganda 🇺🇬</option>
              <option value="ZM">Zambia 🇿🇲</option>
              <option value="ZW">Zimbabwe 🇿🇼</option>
            </select>
          </div>
          <div class="input-group" style="margin-top:12px;">
            <label>Phone (optional)</label>
            <input type="text" id="regPhone" placeholder="+1 234 567 8900" style="width:100%; padding:12px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; margin-top:6px;">
          </div>
        </div>

        <div class="input-group" style="margin-top:12px;">
          <label>Email</label>
          <input type="email" id="authEmail" placeholder="Enter your email" style="width:100%; padding:12px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; margin-top:6px;">
        </div>

        <div class="input-group" style="margin-top:12px;">
          <label>Password</label>
          <input type="password" id="authPassword" placeholder="Enter password (min 6 chars)" style="width:100%; padding:12px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; margin-top:6px;">
        </div>

        <button id="authSubmitBtn" style="width:100%; padding:14px; background:linear-gradient(180deg, #e50539, #b0042d); border:none; border-radius:10px; color:#fff; font-weight:800; font-size:0.95rem; cursor:pointer; margin-top:16px; text-transform:uppercase; letter-spacing:0.5px;">
          Continue
        </button>

        <div style="text-align:center; margin-top:16px; font-size:0.8rem; color:#9ea0a3;">
          <span id="authToggleText">Don't have an account?</span>
          <button id="authToggleBtn" style="background:none; border:none; color:#e50539; font-weight:700; cursor:pointer; font-size:0.8rem; margin-left:4px;">Register</button>
        </div>

        <div style="text-align:center; margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:0.75rem; color:#5e6266;">🎁 New users get $50 bonus on sign up!</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('authModalClose').addEventListener('click', hideAuthModal);
  document.getElementById('authSubmitBtn').addEventListener('click', handleAuthSubmit);
  document.getElementById('authToggleBtn').addEventListener('click', toggleAuthMode);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideAuthModal();
  });

  document.getElementById('authPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAuthSubmit();
  });
}

let currentAuthMode = 'login';

function showAuthModal(mode = 'login') {
  currentAuthMode = mode;
  const modal = document.getElementById('authModal');
  const title = document.getElementById('authTitle');
  const registerFields = document.getElementById('registerFields');
  const toggleText = document.getElementById('authToggleText');
  const toggleBtn = document.getElementById('authToggleBtn');
  const submitBtn = document.getElementById('authSubmitBtn');
  const message = document.getElementById('authMessage');

  message.style.display = 'none';

  if (mode === 'login') {
    title.textContent = 'Log In';
    registerFields.style.display = 'none';
    toggleText.textContent = "Don't have an account?";
    toggleBtn.textContent = 'Register';
    submitBtn.textContent = 'LOG IN';
  } else {
    title.textContent = 'Create Account';
    registerFields.style.display = 'block';
    toggleText.textContent = 'Already have an account?';
    toggleBtn.textContent = 'Log In';
    submitBtn.textContent = 'REGISTER';
  }

  modal.classList.add('active');
}

function hideAuthModal() {
  document.getElementById('authModal').classList.remove('active');
}

function toggleAuthMode() {
  showAuthModal(currentAuthMode === 'login' ? 'register' : 'login');
}

async function handleAuthSubmit() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const messageEl = document.getElementById('authMessage');
  const submitBtn = document.getElementById('authSubmitBtn');

  if (!email || !password) {
    showAuthMessage('Please fill in all fields', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing...';

  let result;

  if (currentAuthMode === 'register') {
    const username = document.getElementById('regUsername').value.trim();
    const country = document.getElementById('regCountry').value;
    const phone = document.getElementById('regPhone').value.trim();

    if (!username) {
      showAuthMessage('Please enter a username', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'REGISTER';
      return;
    }

    result = await window.authManager.register(username, email, password, phone, country);
  } else {
    result = await window.authManager.login(email, password);
  }

  submitBtn.disabled = false;
  submitBtn.textContent = currentAuthMode === 'login' ? 'LOG IN' : 'REGISTER';

  if (result.success) {
    const bonusMsg = result.data.bonus 
      ? `🎉 ${result.data.bonus.message}` 
      : 'Welcome back!';
    showAuthMessage(bonusMsg, 'success');

    setTimeout(() => {
      hideAuthModal();
      location.reload();
    }, 1500);
  } else {
    showAuthMessage(result.message, 'error');
  }
}

function showAuthMessage(text, type) {
  const el = document.getElementById('authMessage');
  el.textContent = text;
  el.style.display = 'block';

  if (type === 'error') {
    el.style.background = 'rgba(229, 5, 57, 0.15)';
    el.style.color = '#ff6b8a';
    el.style.border = '1px solid rgba(229, 5, 57, 0.3)';
  } else {
    el.style.background = 'rgba(40, 169, 9, 0.15)';
    el.style.color = '#42c766';
    el.style.border = '1px solid rgba(40, 169, 9, 0.3)';
  }
}

function updateAuthUI(isLoggedIn, user) {
  const authContainer = document.getElementById('partnerAuthContainer');
  if (!authContainer) {
    console.warn('[Auth] partnerAuthContainer not found, retrying...');
    setTimeout(() => updateAuthUI(isLoggedIn, user), 500);
    return;
  }

  authContainer.innerHTML = '';

  if (isLoggedIn && user) {
    // Use live balance from BetManager / localStorage, not stale user object
    const liveBalance = parseFloat(localStorage.getItem('aviator_balance')) || user.totalBalance || 0;
    const currency = localStorage.getItem('aviator_currency') || user.currency || 'USD';

    authContainer.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.35);padding:4px 10px;border-radius:100px;border:1px solid rgba(255,255,255,0.08);">
        <div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#28a909,#1e8a07);display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:#fff;">
          ${(user.username || 'U').charAt(0).toUpperCase()}
        </div>
        <div style="display:flex;flex-direction:column;line-height:1.1;">
          <span style="font-size:0.65rem;color:#9ea0a3;font-weight:500;">${user.username}</span>
          <span style="font-size:0.7rem;color:#28a909;font-weight:700;">$${parseFloat(liveBalance).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
        </div>
      </div>
      <button id="logoutBtn" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);color:#fff;padding:5px 10px;border-radius:6px;font-size:0.7rem;font-weight:600;cursor:pointer;">Logout</button>
    `;

    document.getElementById('logoutBtn').addEventListener('click', () => {
      window.authManager.logout();
      location.reload();
    });

    // Update balance displays
    const navBalance = document.getElementById('navBalanceAmount');
    if (navBalance) {
      navBalance.textContent = parseFloat(liveBalance).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
    }
    const currencyEl = document.getElementById('navBalanceCurrency');
    if (currencyEl) currencyEl.textContent = currency;

    const partnerCash = document.getElementById('partnerCashDisplay');
    if (partnerCash) {
      partnerCash.textContent = parseFloat(liveBalance).toLocaleString('en-US', {minimumFractionDigits:2});
    }

    const headerUsername = document.getElementById('headerUsername');
    if (headerUsername) headerUsername.textContent = user.username;

    const partnerNavUsername = document.getElementById('partnerNavUsername');
    if (partnerNavUsername) partnerNavUsername.textContent = user.username;

  } else {
    // Guest mode
    authContainer.innerHTML = `
      <button id="refillBtn" style="background:linear-gradient(180deg,#28a909,#1e8a07);border:none;color:#fff;padding:6px 12px;border-radius:6px;font-size:0.75rem;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(40,169,9,0.4);white-space:nowrap;">♻️ Refill</button>
      <button id="loginBtn" style="background:transparent;border:1px solid rgba(255,255,255,0.3);color:#fff;padding:6px 12px;border-radius:6px;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap;">Log In</button>
      <button id="registerBtn" style="background:linear-gradient(180deg,#e50539,#b0042d);border:none;color:#fff;padding:6px 12px;border-radius:6px;font-size:0.75rem;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(229,5,57,0.4);white-space:nowrap;">Register</button>
    `;

    const depositBtn = document.getElementById('depositBtn');
    const newDepositBtn = document.getElementById('newDepositBtn');
    const partnerDepositBtn = document.getElementById('partnerDepositBtn');
    if (depositBtn) depositBtn.style.display = 'none';
    if (newDepositBtn) newDepositBtn.style.display = 'none';
    if (partnerDepositBtn) partnerDepositBtn.style.display = 'none';

    document.getElementById('refillBtn').addEventListener('click', () => {
      if (window.__aviator && window.__aviator.betManager) {
        window.__aviator.betManager.refill();
      } else {
        localStorage.setItem('aviator_balance', '10000.00');
        location.reload();
      }
    });
    document.getElementById('loginBtn').addEventListener('click', () => showAuthModal('login'));
    document.getElementById('registerBtn').addEventListener('click', () => showAuthModal('register'));
  }
}