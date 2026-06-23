const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phone, country, countryCode } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email and password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase() 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Create user with $50 bonus
    const bonusAmount = parseFloat(process.env.BONUS_AMOUNT) || 50;

    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone || '',
      country: country || 'US',
      countryCode: countryCode || '+1',
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
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user with password
    const user = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { username: email.toLowerCase() }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated. Contact support.'
      });
    }

    // Check login bonus
    const bonusResult = await user.checkLoginBonus();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: bonusResult.bonusAwarded > 0 
        ? `Welcome back! $${bonusResult.bonusAwarded} daily bonus credited!` 
        : 'Login successful',
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
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      user: user.getPublicProfile()
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/auth/update
// @desc    Update user profile
// @access  Private
router.put('/update', protect, async (req, res) => {
  try {
    const { username, phone, country, avatar } = req.body;
    const updateFields = {};

    if (username) updateFields.username = username.trim();
    if (phone) updateFields.phone = phone.trim();
    if (country) updateFields.country = country;
    if (avatar) updateFields.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      user: user.getPublicProfile()
    });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change password
// @access  Private
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current password and new password (min 6 chars)'
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
