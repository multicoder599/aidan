const mongoose = require('mongoose');

const GameHistorySchema = new mongoose.Schema({
  roundId: {
    type: String,
    required: true,
    unique: true
  },
  crashPoint: {
    type: Number,
    required: true
  },
  serverSeed: {
    type: String,
    required: true
  },
  clientSeed: {
    type: String,
    default: ''
  },
  nonce: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['waiting', 'flying', 'crashed', 'completed'],
    default: 'waiting'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  totalBets: {
    type: Number,
    default: 0
  },
  totalWagered: {
    type: Number,
    default: 0
  },
  totalPaidOut: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

GameHistorySchema.index({ roundId: 1 });
GameHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('GameHistory', GameHistorySchema);
