/**
 * ═══════════════════════════════════════════════
 * AUTH SYSTEM — auth.js
 * Handles registration, login, JWT storage, and API calls
 * ═══════════════════════════════════════════════
 */

// Frontend: https://aviatorpros.surge.sh (or aviatorguru.site)
// Backend: VPS on port 3041
// CHANGE THIS to your domain once SSL is ready: 'https://aviatorguru.site/api'
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3041/api' 
  : 'http://213.199.41.83:3041/api';

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('aviator_token') || null;
    this.user = null;
    this.isLoggedIn = false;
    this._listeners = [];

    // Try to restore session
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
        localStorage.setItem('aviator_balance', data.user.totalBalance.toString());
        localStorage.setItem('aviator_currency', data.user.currency);

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
        localStorage.setItem('aviator_balance', data.user.totalBalance.toString());
        localStorage.setItem('aviator_currency', data.user.currency);

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
      const res = await fetch(url, {
        ...options,
        headers
      });

      if (res.status === 401) {
        this.logout();
      }

      return await res.json();
    } catch (err) {
      console.error('[Auth] API call error:', err);
      return { success: false, message: 'Network error' };
    }
  }

  getBalance() {
    if (this.user) {
      return this.user.totalBalance || 0;
    }
    return parseFloat(localStorage.getItem('aviator_balance')) || 50;
  }

  getCurrency() {
    if (this.user) {
      return this.user.currency || 'USD';
    }
    return localStorage.getItem('aviator_currency') || 'USD';
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
  // Create auth modal if not exists
  if (!document.getElementById('authModal')) {
    createAuthModal();
  }

  // Wire auth buttons
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => showAuthModal('login'));
  }
  if (registerBtn) {
    registerBtn.addEventListener('click', () => showAuthModal('register'));
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.authManager.logout();
      location.reload();
    });
  }

  // Update UI based on auth state
  window.authManager.onAuthChange((isLoggedIn, user) => {
    updateAuthUI(isLoggedIn, user);
  });

  // Initial check - render buttons for BOTH logged in AND guest users
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

        <!-- Register Fields -->
        <div id="registerFields" style="display:none;">
          <div class="input-group">
            <label>Username</label>
            <input type="text" id="regUsername" placeholder="Choose a username" style="width:100%; padding:12px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; margin-top:6px;">
          </div>
          <div class="input-group" style="margin-top:12px;">
            <label>Country</label>
            <select id="regCountry" style="width:100%; padding:12px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; margin-top:6px;">
              <option value="US">United States</option>
              <option value="KE">Kenya</option>
              <option value="NG">Nigeria</option>
              <option value="ZA">South Africa</option>
              <option value="GH">Ghana</option>
              <option value="TZ">Tanzania</option>
              <option value="UG">Uganda</option>
              <option value="RW">Rwanda</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="IN">India</option>
              <option value="BR">Brazil</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="JP">Japan</option>
              <option value="CN">China</option>
              <option value="OTHER">Other</option>
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

  // Wire events
  document.getElementById('authModalClose').addEventListener('click', hideAuthModal);
  document.getElementById('authSubmitBtn').addEventListener('click', handleAuthSubmit);
  document.getElementById('authToggleBtn').addEventListener('click', toggleAuthMode);

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideAuthModal();
  });

  // Enter key submit
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
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) {
    console.warn('[Auth] .header-right not found, retrying...');
    setTimeout(() => updateAuthUI(isLoggedIn, user), 500);
    return;
  }

  // Find or create auth buttons container
  let authContainer = document.getElementById('authButtonsContainer');
  if (!authContainer) {
    authContainer = document.createElement('div');
    authContainer.id = 'authButtonsContainer';
    authContainer.style.cssText = 'display:flex !important; align-items:center; gap:8px; margin-left:auto; flex-shrink:0; z-index:100;';
    headerRight.appendChild(authContainer);
  }

  authContainer.innerHTML = '';

  if (isLoggedIn && user) {
    // Show user info and logout
    authContainer.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.35); padding:4px 12px; border-radius:100px; border:1px solid rgba(255,255,255,0.08);">
        <div style="width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg, #28a909, #1e8a07); display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700; color:#fff;">
          ${(user.username || 'U').charAt(0).toUpperCase()}
        </div>
        <div style="display:flex; flex-direction:column; line-height:1.2;">
          <span style="font-size:0.7rem; color:#9ea0a3; font-weight:500;">${user.username}</span>
          <span style="font-size:0.75rem; color:#28a909; font-weight:700;">$${parseFloat(user.totalBalance || 0).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
        </div>
      </div>
      <button id="logoutBtn" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:6px 14px; border-radius:6px; font-size:0.75rem; font-weight:600; cursor:pointer;">Logout</button>
    `;

    document.getElementById('logoutBtn').addEventListener('click', () => {
      window.authManager.logout();
      location.reload();
    });

    // Update balance displays
    const navBalance = document.getElementById('navBalanceAmount');
    if (navBalance) {
      navBalance.textContent = parseFloat(user.totalBalance || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
    }
    const currencyEl = document.getElementById('navBalanceCurrency');
    if (currencyEl) currencyEl.textContent = 'USD';

    const partnerCash = document.getElementById('partnerCashDisplay');
    if (partnerCash) {
      partnerCash.textContent = parseFloat(user.totalBalance || 0).toLocaleString('en-US', {minimumFractionDigits:2});
    }

    const headerUsername = document.getElementById('headerUsername');
    if (headerUsername) headerUsername.textContent = user.username;

    const partnerNavUsername = document.getElementById('partnerNavUsername');
    if (partnerNavUsername) partnerNavUsername.textContent = user.username;

  } else {
    // GUEST: Show login/register + refill, hide deposit
    authContainer.innerHTML = `
      <button id="refillBtn" style="background:linear-gradient(180deg, #28a909, #1e8a07); border:none; color:#fff; padding:8px 18px; border-radius:8px; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 2px 12px rgba(40,169,9,0.4); white-space:nowrap; display:inline-block; margin-right:4px;">♻️ Refill $10K</button>
      <button id="loginBtn" style="background:transparent; border:1px solid rgba(255,255,255,0.3); color:#fff; padding:8px 18px; border-radius:8px; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s; white-space:nowrap; display:inline-block;">Log In</button>
      <button id="registerBtn" style="background:linear-gradient(180deg, #e50539, #b0042d); border:none; color:#fff; padding:8px 18px; border-radius:8px; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 2px 12px rgba(229,5,57,0.4); white-space:nowrap; display:inline-block;">Register</button>
    `;

    // Hide deposit buttons for guests
    const depositBtn = document.getElementById('depositBtn');
    const newDepositBtn = document.getElementById('newDepositBtn');
    const partnerDepositBtn = document.getElementById('partnerDepositBtn');
    if (depositBtn) depositBtn.style.display = 'none';
    if (newDepositBtn) newDepositBtn.style.display = 'none';
    if (partnerDepositBtn) partnerDepositBtn.style.display = 'none';

    // Wire refill button
    setTimeout(() => {
      const refillBtn = document.getElementById('refillBtn');
      if (refillBtn) {
        refillBtn.addEventListener('click', () => {
          if (window.__aviator && window.__aviator.betManager) {
            window.__aviator.betManager.refill();
          } else {
            localStorage.setItem('aviator_balance', '10000.00');
            location.reload();
          }
        });
      }
    }, 100);

    document.getElementById('loginBtn').addEventListener('click', () => showAuthModal('login'));
    document.getElementById('registerBtn').addEventListener('click', () => showAuthModal('register'));
  }
}
