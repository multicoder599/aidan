const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const GameHistory = require('../models/GameHistory');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect, optionalAuth } = require('../middleware/auth');

// In-memory game state (for real-time sync)
let currentGameState = {
  roundId: null,
  status: 'waiting', // waiting, flying, crashed
  crashPoint: null,
  startTime: null,
  elapsedMs: 0,
  multiplier: 1.00
};

let roundCounter = 0;

// Generate provably fair crash point
function generateCrashPoint() {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHmac('sha256', serverSeed).update('aviator-round').digest('hex');
  const seed = parseInt(hash.substring(0, 13), 16);
  const e = Math.pow(2, 52);
  const result = (seed % e) / e;

  // 1% house edge
  const crashPoint = Math.max(1.00, Math.floor(0.99 / (1 - result) * 100) / 100);

  return { crashPoint, serverSeed };
}

// @route   GET /api/game/state
// @desc    Get current game state
// @access  Public
router.get('/state', (req, res) => {
  res.json({
    success: true,
    gameState: currentGameState
  });
});

// @route   POST /api/game/start-round
// @desc    Start a new round (admin/internal)
// @access  Private
router.post('/start-round', protect, async (req, res) => {
  try {
    if (currentGameState.status === 'flying') {
      return res.status(400).json({
        success: false,
        message: 'Round already in progress'
      });
    }

    roundCounter++;
    const { crashPoint, serverSeed } = generateCrashPoint();
    const roundId = `RND-${Date.now()}-${roundCounter}`;

    const gameHistory = await GameHistory.create({
      roundId,
      crashPoint,
      serverSeed,
      status: 'flying',
      startTime: new Date()
    });

    currentGameState = {
      roundId,
      status: 'flying',
      crashPoint,
      startTime: Date.now(),
      elapsedMs: 0,
      multiplier: 1.00
    };

    res.json({
      success: true,
      roundId,
      crashPoint,
      serverSeed: serverSeed.substring(0, 16) + '...'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/game/crash
// @desc    End current round
// @access  Private
router.post('/crash', protect, async (req, res) => {
  try {
    if (!currentGameState.roundId) {
      return res.status(400).json({
        success: false,
        message: 'No active round'
      });
    }

    await GameHistory.findOneAndUpdate(
      { roundId: currentGameState.roundId },
      { 
        status: 'crashed',
        endTime: new Date()
      }
    );

    currentGameState.status = 'crashed';
    currentGameState.multiplier = currentGameState.crashPoint;

    res.json({
      success: true,
      roundId: currentGameState.roundId,
      crashPoint: currentGameState.crashPoint
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/game/bet
// @desc    Place a bet
// @access  Private
router.post('/bet', protect, async (req, res) => {
  try {
    const { amount, panelId = 1, autoCashOut = 0 } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bet amount'
      });
    }

    const user = await User.findById(req.user.id);

    if (user.totalBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Deduct from real balance first, then bonus
    let fromReal = Math.min(amount, user.balance);
    let fromBonus = amount - fromReal;

    user.balance -= fromReal;
    user.bonusBalance -= fromBonus;
    user.totalWagered += amount;
    await user.save();

    // Create transaction record
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

    res.json({
      success: true,
      message: 'Bet placed successfully',
      bet: {
        amount,
        panelId,
        autoCashOut,
        roundId: currentGameState.roundId
      },
      balance: user.getPublicProfile()
    });
  } catch (err) {
    console.error('Bet error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/game/cashout
// @desc    Cash out current bet
// @access  Private
router.post('/cashout', protect, async (req, res) => {
  try {
    const { multiplier, panelId = 1 } = req.body;

    if (!multiplier || multiplier < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid multiplier'
      });
    }

    // This is a simplified cashout - in production you'd track active bets per user
    const user = await User.findById(req.user.id);

    // For demo, we calculate a simulated win based on the bet amount from request
    // In production, this would look up the active bet
    const winAmount = 100 * multiplier; // Placeholder - actual implementation needs bet tracking

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

// @route   GET /api/game/history
// @desc    Get game history
// @access  Public
router.get('/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const history = await GameHistory.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: history.length,
      history: history.map(h => ({
        roundId: h.roundId,
        crashPoint: h.crashPoint,
        status: h.status,
        createdAt: h.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
