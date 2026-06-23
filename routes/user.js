const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/user/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user: user.getPublicProfile()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/user/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const transactions = await Transaction.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

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

// @route   GET /api/user/leaderboard
// @desc    Get top players leaderboard
// @access  Public
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    let dateFilter = {};

    const now = new Date();
    if (period === 'daily') {
      dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 1)) } };
    } else if (period === 'weekly') {
      dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
    } else if (period === 'monthly') {
      dateFilter = { createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) } };
    }

    const topPlayers = await User.find({ ...dateFilter, totalWon: { $gt: 0 } })
      .select('username totalWon gamesPlayed avatar country')
      .sort({ totalWon: -1 })
      .limit(20);

    res.json({
      success: true,
      leaderboard: topPlayers
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/user/all
// @desc    Get all users (admin only)
// @access  Admin
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
