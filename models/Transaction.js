const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'bet', 'win', 'bonus', 'refund', 'fee'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  description: {
    type: String,
    default: ''
  },
  reference: {
    type: String,
    default: ''
  },
  metadata: {
    type: Object,
    default: {}
  },
  beforeBalance: {
    type: Number,
    default: 0
  },
  afterBalance: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

TransactionSchema.index({ user: 1, createdAt: -1 });
TransactionSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
