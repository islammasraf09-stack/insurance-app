'use strict';
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const { initDB } = require('./db');
const declarationsRouter = require('./routes');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

const FRONTEND = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(FRONTEND));
app.use('/api/declarations', declarationsRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('*path', (_req, res) => res.sendFile(path.join(FRONTEND, 'index.html')));

initDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Running on port ${PORT}`));
}).catch(err => { console.error('DB failed:', err); process.exit(1); });
