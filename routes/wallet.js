const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

// @route   POST /api/wallet/deposit
// @desc    Add deposit to user balance
// @access  Private
router.post('/deposit', protect, async (req, res) => {
  try {
    const { amount, method = 'manual', reference = '' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid amount'
      });
    }

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

    res.json({
      success: true,
      message: `Successfully deposited $${amount.toFixed(2)}`,
      balance: user.getPublicProfile()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/wallet/withdraw
// @desc    Request withdrawal
// @access  Private
router.post('/withdraw', protect, async (req, res) => {
  try {
    const { amount, method, accountDetails } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid amount'
      });
    }

    const user = await User.findById(req.user.id);

    if (user.totalBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Deduct from real balance first
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

    res.json({
      success: true,
      message: 'Withdrawal request submitted for processing',
      balance: user.getPublicProfile()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/wallet/transactions
// @desc    Get user transaction history
// @access  Private
router.get('/transactions', protect, async (req, res) => {
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

module.exports = router;
