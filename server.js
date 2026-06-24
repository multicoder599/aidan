const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3041;

// Trust proxy for rate-limit behind nginx
app.set('trust proxy', 1);

// ═══════════════════════════════════════════════
// SECURITY & PARSING
// ═══════════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

app.use(cors({
  origin: ['https://aviatorguru.site', 'https://www.aviatorguru.site', 'https://aviatorpros.surge.sh', 'http://localhost:3000', 'http://localhost:3041'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many login attempts. Please try again later.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ═══════════════════════════════════════════════
// MONGODB CONNECTION
// ═══════════════════════════════════════════════
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Connected Successfully');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};
connectDB();

// ═══════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════

// ── User ──
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  phone: { type: String, trim: true, default: '' },
  country: { type: String, default: 'KE', trim: true },
  countryCode: { type: String, default: '+254', trim: true },
  balance: { type: Number, default: 0, min: 0 },
  bonusBalance: { type: Number, default: 50.00, min: 0 },
  currency: { type: String, default: 'USD' },
  totalWagered: { type: Number, default: 0 },
  totalWon: { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  lastLogin: { type: Date, default: Date.now },
  loginStreak: { type: Number, default: 1 },
  lastBonusClaim: { type: Date, default: null },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
  ipAddress: { type: String, default: '' },
  deviceInfo: { type: String, default: '' }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

UserSchema.virtual('totalBalance').get(function() {
  return (this.balance || 0) + (this.bonusBalance || 0);
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    phone: this.phone,
    country: this.country,
    balance: this.balance,
    bonusBalance: this.bonusBalance,
    totalBalance: this.totalBalance,
    currency: this.currency,
    totalWagered: this.totalWagered,
    totalWon: this.totalWon,
    gamesPlayed: this.gamesPlayed,
    avatar: this.avatar,
    role: this.role,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
    loginStreak: this.loginStreak
  };
};

UserSchema.methods.checkLoginBonus = async function() {
  const now = new Date();
  const lastLogin = this.lastLogin || new Date(0);
  const oneDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((now - lastLogin) / oneDay);
  let bonusAwarded = 0;
  if (diffDays >= 1) {
    if (diffDays === 1) this.loginStreak += 1;
    else this.loginStreak = 1;
    const bonusAmount = parseFloat(process.env.BONUS_AMOUNT) || 50;
    this.bonusBalance = this.bonusBalance + bonusAmount;
    bonusAwarded = bonusAmount;
    this.lastBonusClaim = now;
  }
  this.lastLogin = now;
  await this.save();
  return { bonusAwarded, loginStreak: this.loginStreak, totalBalance: this.totalBalance };
};

const User = mongoose.model('User', UserSchema);

// ── Transaction ──
const TransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'bet', 'win', 'bonus', 'refund', 'fee'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'pending' },
  description: { type: String, default: '' },
  reference: { type: String, default: '' },
  metadata: { type: Object, default: {} },
  beforeBalance: { type: Number, default: 0 },
  afterBalance: { type: Number, default: 0 }
}, { timestamps: true });
TransactionSchema.index({ user: 1, createdAt: -1 });
TransactionSchema.index({ type: 1, status: 1 });
const Transaction = mongoose.model('Transaction', TransactionSchema);

// ── GameHistory ──
const GameHistorySchema = new mongoose.Schema({
  roundId: { type: String, required: true, unique: true },
  crashPoint: { type: Number, required: true },
  serverSeed: { type: String, required: true },
  clientSeed: { type: String, default: '' },
  nonce: { type: Number, default: 0 },
  status: { type: String, enum: ['waiting', 'flying', 'crashed', 'completed'], default: 'waiting' },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date, default: null },
  totalBets: { type: Number, default: 0 },
  totalWagered: { type: Number, default: 0 },
  totalPaidOut: { type: Number, default: 0 }
}, { timestamps: true });
GameHistorySchema.index({ roundId: 1 });
GameHistorySchema.index({ createdAt: -1 });
const GameHistory = mongoose.model('GameHistory', GameHistorySchema);

// ═══════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
      if (!req.user) return res.status(401).json({ success: false, message: 'User not found' });
      if (!req.user.isActive) return res.status(401).json({ success: false, message: 'Account deactivated' });
      next();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const adminOnly = async (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
      } catch (err) { req.user = null; }
    }
    next();
  } catch (err) { next(); }
};

// ═══════════════════════════════════════════════
// AUTHORITATIVE GAME ENGINE (Server-Side)
// ═══════════════════════════════════════════════
let currentGameState = {
  roundId: null,
  status: 'waiting',
  crashPoint: null,
  startTime: null,
  elapsedMs: 0,
  multiplier: 1.00,
  nextCrashPoint: null,
  roundNumber: 0
};
let roundCounter = 0;
let adminCrashPoint = null; // Admin override for next round
const activeBets = new Map();

function generateCrashPoint() {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHmac('sha256', serverSeed).update('aviator-round').digest('hex');
  const seed = parseInt(hash.substring(0, 13), 16);
  const e = Math.pow(2, 52);
  const result = (seed % e) / e;
  const crashPoint = Math.max(1.00, Math.floor(0.99 / (1 - result) * 100) / 100);
  return { crashPoint, serverSeed };
}

async function startNewRound() {
  if (currentGameState.status === 'flying') return;
  roundCounter++;

  // Use admin override if set, otherwise generate provably fair
  let crashPoint, serverSeed;
  if (adminCrashPoint !== null && adminCrashPoint >= 1.00) {
    crashPoint = adminCrashPoint;
    serverSeed = 'admin-override-' + crypto.randomBytes(16).toString('hex');
    adminCrashPoint = null; // consume it
  } else {
    const generated = generateCrashPoint();
    crashPoint = generated.crashPoint;
    serverSeed = generated.serverSeed;
  }

  const roundId = `RND-${Date.now()}-${roundCounter}`;

  await GameHistory.create({
    roundId,
    crashPoint,
    serverSeed,
    status: 'waiting',
    startTime: new Date()
  });

  currentGameState = {
    roundId,
    status: 'waiting',
    crashPoint,
    nextCrashPoint: crashPoint, // EXPOSED for predictor/admin
    startTime: Date.now(),
    elapsedMs: 0,
    multiplier: 1.00,
    roundNumber: roundCounter
  };

  // 5-second countdown then fly
  setTimeout(() => {
    if (currentGameState.roundId !== roundId) return; // safety
    currentGameState.status = 'flying';
    currentGameState.startTime = Date.now();
    GameHistory.findOneAndUpdate({ roundId }, { status: 'flying' }).exec();

    // Auto-crash at predetermined point
    const flyDuration = Math.log(currentGameState.crashPoint) / 0.15 * 1000;
    setTimeout(() => crashRound(roundId), flyDuration + 100);
  }, 5000);
}

async function crashRound(roundId) {
  if (currentGameState.status !== 'flying' || currentGameState.roundId !== roundId) return;
  currentGameState.status = 'crashed';
  currentGameState.multiplier = currentGameState.crashPoint;

  await GameHistory.findOneAndUpdate(
    { roundId: currentGameState.roundId },
    { status: 'crashed', endTime: new Date() }
  );

  // Settle all uncashed bets as lost
  for (const [userId, bets] of activeBets) {
    for (const bet of bets) {
      if (!bet.cashedOut) {
        await Transaction.create({
          user: userId,
          type: 'bet',
          amount: -bet.amount,
          currency: 'USD',
          status: 'completed',
          description: `Lost bet on round ${currentGameState.roundId}`
        });
      }
    }
  }
  activeBets.clear();

  // Cooldown then next round
  setTimeout(() => startNewRound(), 2000);
}

// Start first round
startNewRound();

// Game loop ticker
setInterval(() => {
  if (currentGameState.status === 'flying') {
    const elapsed = (Date.now() - currentGameState.startTime) / 1000;
    currentGameState.multiplier = 1.00 * Math.exp(0.15 * elapsed);
    currentGameState.elapsedMs = Date.now() - currentGameState.startTime;
  } else if (currentGameState.status === 'waiting') {
    currentGameState.elapsedMs = Date.now() - currentGameState.startTime;
  } else if (currentGameState.status === 'crashed') {
    currentGameState.elapsedMs = Date.now() - currentGameState.startTime;
  }
}, 50);

// ═══════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════

// ── Admin Crash Point Override ──
app.post('/api/admin/crash-point', (req, res) => {
  const { crashPoint, secret } = req.body;
  const adminSecret = process.env.ADMIN_SECRET || 'aviator-admin-2024';

  if (secret !== adminSecret) {
    return res.status(403).json({ success: false, message: 'Invalid admin secret' });
  }

  const cp = parseFloat(crashPoint);
  if (isNaN(cp) || cp < 1.00) {
    return res.status(400).json({ success: false, message: 'Invalid crash point (minimum 1.00)' });
  }

  // Only allow setting if we're in waiting or crashed/cooldown state
  if (currentGameState.status === 'flying') {
    return res.status(400).json({ success: false, message: 'Cannot set crash point while round is flying' });
  }

  adminCrashPoint = cp;
  currentGameState.nextCrashPoint = cp;
  console.log(`[ADMIN] Next crash point set to ${cp}x`);
  res.json({ success: true, message: `Next round crash point set to ${cp}x`, crashPoint: cp });
});

// ── Auth ──
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, phone, country, countryCode } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide username, email and password' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }]
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase() ? 'Email already registered' : 'Username already taken'
      });
    }

    const bonusAmount = parseFloat(process.env.BONUS_AMOUNT) || 50;
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone || '',
      country: country || 'KE',
      countryCode: countryCode || '+254',
      balance: 0,
      bonusBalance: bonusAmount,
      currency: process.env.CURRENCY || 'USD',
      lastLogin: new Date(),
      loginStreak: 1,
      lastBonusClaim: new Date()
    });

    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      message: 'Registration successful! $50 bonus credited.',
      token,
      user: user.getPublicProfile(),
      bonus: {
        amount: bonusAmount,
        currency: process.env.CURRENCY || 'USD',
        message: 'Welcome bonus of $50 has been added to your bonus balance!'
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: email.toLowerCase() }]
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated' });
    }

    const bonusResult = await user.checkLoginBonus();
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: bonusResult.bonusAwarded > 0 ? `Welcome back! $${bonusResult.bonusAwarded} daily bonus credited!` : 'Login successful',
      token,
      user: user.getPublicProfile(),
      bonus: bonusResult.bonusAwarded > 0 ? {
        amount: bonusResult.bonusAwarded,
        currency: process.env.CURRENCY || 'USD',
        streak: bonusResult.loginStreak,
        message: `Daily login bonus of $${bonusResult.bonusAwarded} credited!`
      } : null
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

app.get('/api/auth/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user: user.getPublicProfile() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/auth/update', protect, async (req, res) => {
  try {
    const { username, phone, country, avatar } = req.body;
    const updateFields = {};
    if (username) updateFields.username = username.trim();
    if (phone) updateFields.phone = phone.trim();
    if (country) updateFields.country = country;
    if (avatar) updateFields.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user.id, updateFields, { new: true, runValidators: true });
    res.json({ success: true, user: user.getPublicProfile() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── User ──
app.get('/api/user/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user: user.getPublicProfile() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/user/stats', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const transactions = await Transaction.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50);
    res.json({
      success: true,
      stats: {
        totalBalance: user.totalBalance,
        realBalance: user.balance,
        bonusBalance: user.bonusBalance,
        totalWagered: user.totalWagered,
        totalWon: user.totalWon,
        gamesPlayed: user.gamesPlayed,
        loginStreak: user.loginStreak
      },
      transactions
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/user/leaderboard', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    let dateFilter = {};
    const now = new Date();
    if (period === 'daily') dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 1)) } };
    else if (period === 'weekly') dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
    else if (period === 'monthly') dateFilter = { createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) } };

    const topPlayers = await User.find({ ...dateFilter, totalWon: { $gt: 0 } })
      .select('username totalWon gamesPlayed avatar country')
      .sort({ totalWon: -1 })
      .limit(20);
    res.json({ success: true, leaderboard: topPlayers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/user/all', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Wallet ──
app.post('/api/wallet/deposit', protect, async (req, res) => {
  try {
    const { amount, method = 'manual', reference = '' } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const user = await User.findById(req.user.id);
    const beforeBalance = user.totalBalance;
    user.balance += amount;
    await user.save();

    await Transaction.create({
      user: req.user.id,
      type: 'deposit',
      amount,
      currency: user.currency,
      status: 'completed',
      description: `Deposit via ${method}`,
      reference,
      beforeBalance,
      afterBalance: user.totalBalance
    });

    res.json({ success: true, message: `Successfully deposited $${amount.toFixed(2)}`, balance: user.getPublicProfile() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/wallet/withdraw', protect, async (req, res) => {
  try {
    const { amount, method, accountDetails } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const user = await User.findById(req.user.id);
    if (user.totalBalance < amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });

    let fromReal = Math.min(amount, user.balance);
    let fromBonus = amount - fromReal;
    user.balance -= fromReal;
    user.bonusBalance -= fromBonus;
    await user.save();

    await Transaction.create({
      user: req.user.id,
      type: 'withdrawal',
      amount: -amount,
      currency: user.currency,
      status: 'pending',
      description: `Withdrawal request via ${method || 'bank'}`,
      metadata: accountDetails || {},
      beforeBalance: user.totalBalance + amount,
      afterBalance: user.totalBalance
    });

    res.json({ success: true, message: 'Withdrawal request submitted', balance: user.getPublicProfile() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/wallet/transactions', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const transactions = await Transaction.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const count = await Transaction.countDocuments({ user: req.user.id });
    res.json({
      success: true,
      transactions,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Game ──
app.get('/api/game/state', (req, res) => {
  res.json({ success: true, gameState: currentGameState });
});

app.post('/api/game/bet', protect, async (req, res) => {
  try {
    const { amount, panelId = 1, autoCashOut = 0 } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid bet amount' });

    const user = await User.findById(req.user.id);
    if (user.totalBalance < amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });

    let fromBonus = Math.min(amount, user.bonusBalance);
    let fromReal = amount - fromBonus;
    user.bonusBalance -= fromBonus;
    user.balance -= fromReal;
    user.totalWagered += amount;
    await user.save();

    await Transaction.create({
      user: req.user.id,
      type: 'bet',
      amount: -amount,
      currency: user.currency,
      status: 'completed',
      description: `Bet placed on round ${currentGameState.roundId || 'pending'}`,
      beforeBalance: user.totalBalance + amount,
      afterBalance: user.totalBalance
    });

    if (!activeBets.has(req.user.id.toString())) activeBets.set(req.user.id.toString(), []);
    activeBets.get(req.user.id.toString()).push({
      amount,
      panelId,
      autoCashOut: parseFloat(autoCashOut) || 0,
      cashedOut: false,
      roundId: currentGameState.roundId
    });

    res.json({
      success: true,
      message: 'Bet placed successfully',
      bet: { amount, panelId, autoCashOut, roundId: currentGameState.roundId },
      balance: user.getPublicProfile()
    });
  } catch (err) {
    console.error('Bet error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/game/cashout', protect, async (req, res) => {
  try {
    const { multiplier, panelId = 1 } = req.body;
    if (!multiplier || multiplier < 1) return res.status(400).json({ success: false, message: 'Invalid multiplier' });

    const user = await User.findById(req.user.id);
    const userBets = activeBets.get(req.user.id.toString()) || [];
    const bet = userBets.find(b => b.panelId === panelId && !b.cashedOut && b.roundId === currentGameState.roundId);

    if (!bet) return res.status(400).json({ success: false, message: 'No active bet found' });
    if (currentGameState.status !== 'flying') return res.status(400).json({ success: false, message: 'Round not in flight' });
    if (multiplier > currentGameState.multiplier) return res.status(400).json({ success: false, message: 'Invalid cashout multiplier' });

    bet.cashedOut = true;
    const winAmount = bet.amount * multiplier;
    user.balance += winAmount;
    user.totalWon += winAmount;
    user.gamesPlayed += 1;
    await user.save();

    await Transaction.create({
      user: req.user.id,
      type: 'win',
      amount: winAmount,
      currency: user.currency,
      status: 'completed',
      description: `Cash out at ${multiplier}x`,
      beforeBalance: user.balance - winAmount,
      afterBalance: user.balance
    });

    res.json({
      success: true,
      message: `Cashed out at ${multiplier}x!`,
      winAmount,
      multiplier,
      balance: user.getPublicProfile()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/game/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const history = await GameHistory.find().sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json({
      success: true,
      count: history.length,
      history: history.map(h => ({ roundId: h.roundId, crashPoint: h.crashPoint, status: h.status, createdAt: h.createdAt }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Game Sync (for frontend polling) ──
app.get('/api/prediction', (req, res) => {
  res.json({
    gameState: currentGameState.status,
    prediction: currentGameState.nextCrashPoint, // Always visible during waiting
    currentCrashPoint: currentGameState.status === 'flying' ? currentGameState.crashPoint : null,
    elapsedMs: currentGameState.elapsedMs,
    waitElapsedMs: currentGameState.status === 'waiting' ? currentGameState.elapsedMs : 0,
    crashElapsedMs: currentGameState.status === 'crashed' ? currentGameState.elapsedMs : 0,
    roundNumber: currentGameState.roundNumber,
    multiplier: currentGameState.status === 'flying' ? currentGameState.multiplier : null
  });
});

app.post('/api/next', (req, res) => {
  res.json({ success: true, crashPoint: currentGameState.nextCrashPoint || 2.00 });
});

app.post('/api/flying', (req, res) => res.json({ success: true }));
app.post('/api/complete', (req, res) => res.json({ success: true }));
app.post('/api/state', (req, res) => res.json({ success: true }));
app.post('/api/heartbeat', (req, res) => res.json({ success: true }));

// ── Client Sync Stubs ──
const clientRegistry = new Map();
app.post('/api/client/connect', (req, res) => {
  const { site, username, balance, currency } = req.body;
  const clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  clientRegistry.set(clientId, { id: clientId, site: site || 'main', username: username || 'Guest', balance: balance || 10000, currency: currency || 'USD', connectedAt: new Date() });
  res.json({ success: true, client: clientRegistry.get(clientId) });
});
app.get('/api/client/:id/settings', (req, res) => {
  const client = clientRegistry.get(req.params.id);
  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
  res.json({ success: true, client });
});
app.post('/api/client/heartbeat', (req, res) => res.json({ success: true }));
app.post('/api/client/disconnect', (req, res) => {
  const { clientId } = req.body;
  if (clientId) clientRegistry.delete(clientId);
  res.json({ success: true });
});
app.post('/api/client/update-balance', (req, res) => {
  const { clientId, balance } = req.body;
  const client = clientRegistry.get(clientId);
  if (client) client.balance = balance;
  res.json({ success: true });
});
app.post('/api/interbet/sync-session', (req, res) => res.json({ success: true }));
app.post('/api/activate', (req, res) => res.json({ success: true, valid: true }));

// ═══════════════════════════════════════════════
// STATIC FILES & SPA FALLBACK
// ═══════════════════════════════════════════════
app.use(express.static(path.join(__dirname, 'public')));

app.get('/predictor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'predictor.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    gameState: currentGameState.status,
    roundNumber: currentGameState.roundNumber,
    nextCrashPoint: currentGameState.nextCrashPoint
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════');
  console.log('  🚀 AVIATOR BACKEND SERVER RUNNING');
  console.log('═══════════════════════════════════════════');
  console.log(`  📡 Port:     ${PORT}`);
  console.log(`  💵 Currency: ${process.env.CURRENCY || 'USD'}`);
  console.log(`  🎁 Bonus:    $${process.env.BONUS_AMOUNT || '50'}`);
  console.log(`  🌍 Mode:     ${process.env.NODE_ENV || 'development'}`);
  console.log('═══════════════════════════════════════════');
});

module.exports = app;