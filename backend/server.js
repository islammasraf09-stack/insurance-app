'use strict';
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const path     = require('path');

const declarationsRouter = require('./routes');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Security & Middleware ───────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'] }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));

// ─── Static Frontend ─────────────────────────────────────────────────────────
const FRONTEND = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(FRONTEND));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/declarations', declarationsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── 404 & Error Handler ──────────────────────────────────────────────────────
app.use('/api/*path', (_req, res) => res.status(404).json({ success: false, message: 'Endpoint not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*path', (_req, res) => {
  res.sendFile(path.join(FRONTEND, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅  Motor Insurance API running on http://localhost:${PORT}`);
  console.log(`   Frontend : http://localhost:${PORT}`);
  console.log(`   API      : http://localhost:${PORT}/api/declarations\n`);
});

module.exports = app;
