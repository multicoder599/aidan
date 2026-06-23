const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  country: {
    type: String,
    default: 'US',
    trim: true
  },
  countryCode: {
    type: String,
    default: '+1',
    trim: true
  },
  balance: {
    type: Number,
    default: 50.00,  // $50 sign-up bonus
    min: [0, 'Balance cannot be negative']
  },
  bonusBalance: {
    type: Number,
    default: 50.00,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  totalWagered: {
    type: Number,
    default: 0
  },
  totalWon: {
    type: Number,
    default: 0
  },
  gamesPlayed: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginStreak: {
    type: Number,
    default: 1
  },
  lastBonusClaim: {
    type: Date,
    default: null
  },
  avatar: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  ipAddress: {
    type: String,
    default: ''
  },
  deviceInfo: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total balance
UserSchema.virtual('totalBalance').get(function() {
  return this.balance + this.bonusBalance;
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get public profile (no sensitive data)
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

// Check and award daily login bonus
UserSchema.methods.checkLoginBonus = async function() {
  const now = new Date();
  const lastLogin = this.lastLogin || new Date(0);
  const oneDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((now - lastLogin) / oneDay);

  let bonusAwarded = 0;

  if (diffDays >= 1) {
    if (diffDays === 1) {
      // Consecutive day
      this.loginStreak += 1;
    } else if (diffDays > 1) {
      // Streak broken
      this.loginStreak = 1;
    }

    // Award $50 bonus on every sign in
    const bonusAmount = parseFloat(process.env.BONUS_AMOUNT) || 50;
    this.bonusBalance += bonusAmount;
    bonusAwarded = bonusAmount;
    this.lastBonusClaim = now;
  }

  this.lastLogin = now;
  await this.save();

  return {
    bonusAwarded,
    loginStreak: this.loginStreak,
    totalBalance: this.totalBalance
  };
};

module.exports = mongoose.model('User', UserSchema);
