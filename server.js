const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3041;

// FIX: Trust proxy for express-rate-limit behind nginx
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

// CORS - allow all origins including surge.sh
app.use(cors({
  origin: ['https://aviatorguru.site', 'https://www.aviatorguru.site', 'https://aviatorpros.surge.sh', 'http://localhost:3000', 'http://localhost:3041'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Connected Successfully');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

connectDB();

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error('🔴 Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🟡 Mongoose disconnected');
});

// ═══════════════════════════════════════════════
// STUB ROUTES — Frontend Compatibility Layer
// Prevents 404s and SSE MIME type errors
// ═══════════════════════════════════════════════

const clientRegistry = new Map();
let currentPrediction = null;
let currentGameState = 'waiting';

// Game engine sync stubs
app.post('/api/next', (req, res) => {
  const { round } = req.body;
  const crashPoint = 1.5 + Math.random() * 5;
  currentPrediction = crashPoint;
  res.json({ success: true, crashPoint: parseFloat(crashPoint.toFixed(2)) });
});

app.post('/api/flying', (req, res) => {
  const { round, crashPoint } = req.body;
  currentGameState = 'flying';
  res.json({ success: true });
});

app.post('/api/complete', (req, res) => {
  const { round, crashPoint } = req.body;
  currentGameState = 'waiting';
  currentPrediction = null;
  res.json({ success: true });
});

app.post('/api/state', (req, res) => {
  const { state } = req.body;
  currentGameState = state;
  res.json({ success: true });
});

app.get('/api/prediction', (req, res) => {
  res.json({
    gameState: currentGameState,
    prediction: currentPrediction,
    currentCrashPoint: currentGameState === 'flying' ? currentPrediction : null,
    elapsedMs: 0,
    waitElapsedMs: 0,
    crashElapsedMs: 0
  });
});

app.get('/api/predictor-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const timer = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);
  req.on('close', () => clearInterval(timer));
});

app.post('/api/heartbeat', (req, res) => {
  res.json({ success: true });
});

// Client sync stubs
app.post('/api/client/connect', (req, res) => {
  const { site, username, balance, currency } = req.body;
  const clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const clientData = {
    id: clientId,
    site: site || 'main',
    username: username || 'Guest',
    balance: balance || 10000,
    currency: currency || 'USD',
    connectedAt: new Date()
  };
  clientRegistry.set(clientId, clientData);
  res.json({ success: true, client: clientData });
});

app.get('/api/client/:id/settings', (req, res) => {
  const client = clientRegistry.get(req.params.id);
  if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
  res.json({ success: true, client });
});

app.get('/api/client/stream/:id', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const timer = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);
  req.on('close', () => clearInterval(timer));
});

app.post('/api/client/heartbeat', (req, res) => {
  res.json({ success: true });
});

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

app.post('/api/interbet/sync-session', (req, res) => {
  res.json({ success: true });
});

// Withdrawal activation stub
app.post('/api/activate', (req, res) => {
  res.json({ success: true, valid: true });
});

// ═══════════════════════════════════════════════
// MAIN APP ROUTES
// ═══════════════════════════════════════════════

app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/game', require('./routes/game'));
app.use('/api/wallet', require('./routes/wallet'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start server
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