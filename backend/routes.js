'use strict';
const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const router = express.Router();

// ─── helpers ────────────────────────────────────────────────────────────────
function ok(res, data, meta = {}) {
  return res.json({ success: true, data, ...meta });
}
function fail(res, status, message, errors = []) {
  return res.status(status).json({ success: false, message, errors });
}
function handleValidation(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    fail(res, 422, 'Validation failed', errs.array().map(e => ({ field: e.path, msg: e.msg })));
    return false;
  }
  return true;
}

// ─── GET /api/declarations ───────────────────────────────────────────────────
router.get(
  '/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['active', 'voided']),
  query('search').optional().trim(),
  (req, res) => {
    if (!handleValidation(req, res)) return;
    const page   = req.query.page  || 1;
    const limit  = req.query.limit || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'active';
    const search = req.query.search || '';

    let where = 'WHERE status = ?';
    const params = [status];

    if (search) {
      where += ' AND (make_model LIKE ? OR chassis_vin LIKE ? OR signatory LIKE ? OR engine_no LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const total = db.prepare(`SELECT COUNT(*) AS cnt FROM declarations ${where}`).get(...params).cnt;
    const rows  = db.prepare(`SELECT * FROM declarations ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    ok(res, rows, { meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  }
);

// ─── GET /api/declarations/:id ───────────────────────────────────────────────
router.get(
  '/:id',
  param('id').isUUID(),
  (req, res) => {
    if (!handleValidation(req, res)) return;
    const row = db.prepare('SELECT * FROM declarations WHERE id = ?').get(req.params.id);
    if (!row) return fail(res, 404, 'Declaration not found');
    ok(res, row);
  }
);

// ─── POST /api/declarations ──────────────────────────────────────────────────
router.post(
  '/',
  body('make_model').trim().notEmpty().withMessage('Make & Model is required').isLength({ max: 100 }),
  body('year').isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage('Valid year required'),
  body('chassis_vin').trim().notEmpty().withMessage('Chassis/VIN is required').isLength({ min: 5, max: 50 }),
  body('engine_no').trim().notEmpty().withMessage('Engine number is required').isLength({ max: 50 }),
  body('idv').isFloat({ min: 1 }).withMessage('IDV must be a positive number'),
  body('currency').optional().trim().isLength({ min: 3, max: 3 }).toUpperCase(),
  body('signatory').trim().notEmpty().withMessage('Signatory name is required').isLength({ max: 100 }),
  body('company').optional().trim().isLength({ max: 150 }),
  body('issued_date').isISO8601().withMessage('Valid date required').toDate(),
  (req, res) => {
    if (!handleValidation(req, res)) return;
    const { make_model, year, chassis_vin, engine_no, idv, currency, signatory, company, issued_date } = req.body;

    // Check duplicate VIN
    const dup = db.prepare('SELECT id FROM declarations WHERE chassis_vin = ? AND status = ?').get(chassis_vin.trim().toUpperCase(), 'active');
    if (dup) return fail(res, 409, 'An active declaration with this Chassis/VIN already exists');

    const id = uuidv4();
    const dateStr = new Date(issued_date).toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO declarations (id, make_model, year, chassis_vin, engine_no, idv, currency, signatory, company, issued_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      make_model.trim().toUpperCase(),
      Number(year),
      chassis_vin.trim().toUpperCase(),
      engine_no.trim().toUpperCase(),
      parseFloat(idv),
      (currency || 'AED').trim().toUpperCase(),
      signatory.trim(),
      (company || 'Raja Tahir Motors FZCO').trim(),
      dateStr
    );

    const record = db.prepare('SELECT * FROM declarations WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: record });
  }
);

// ─── PUT /api/declarations/:id ───────────────────────────────────────────────
router.put(
  '/:id',
  param('id').isUUID(),
  body('make_model').optional().trim().notEmpty().isLength({ max: 100 }),
  body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
  body('chassis_vin').optional().trim().notEmpty().isLength({ min: 5, max: 50 }),
  body('engine_no').optional().trim().notEmpty().isLength({ max: 50 }),
  body('idv').optional().isFloat({ min: 1 }),
  body('currency').optional().trim().isLength({ min: 3, max: 3 }),
  body('signatory').optional().trim().notEmpty().isLength({ max: 100 }),
  body('company').optional().trim().isLength({ max: 150 }),
  body('issued_date').optional().isISO8601().toDate(),
  (req, res) => {
    if (!handleValidation(req, res)) return;
    const existing = db.prepare('SELECT * FROM declarations WHERE id = ?').get(req.params.id);
    if (!existing) return fail(res, 404, 'Declaration not found');
    if (existing.status === 'voided') return fail(res, 409, 'Cannot edit a voided declaration');

    const { make_model, year, chassis_vin, engine_no, idv, currency, signatory, company, issued_date } = req.body;

    db.prepare(`
      UPDATE declarations SET
        make_model  = COALESCE(?, make_model),
        year        = COALESCE(?, year),
        chassis_vin = COALESCE(?, chassis_vin),
        engine_no   = COALESCE(?, engine_no),
        idv         = COALESCE(?, idv),
        currency    = COALESCE(?, currency),
        signatory   = COALESCE(?, signatory),
        company     = COALESCE(?, company),
        issued_date = COALESCE(?, issued_date),
        updated_at  = datetime('now')
      WHERE id = ?
    `).run(
      make_model ? make_model.trim().toUpperCase() : null,
      year ? Number(year) : null,
      chassis_vin ? chassis_vin.trim().toUpperCase() : null,
      engine_no ? engine_no.trim().toUpperCase() : null,
      idv ? parseFloat(idv) : null,
      currency ? currency.trim().toUpperCase() : null,
      signatory ? signatory.trim() : null,
      company ? company.trim() : null,
      issued_date ? new Date(issued_date).toISOString().split('T')[0] : null,
      req.params.id
    );

    ok(res, db.prepare('SELECT * FROM declarations WHERE id = ?').get(req.params.id));
  }
);

// ─── DELETE /api/declarations/:id  (soft void) ──────────────────────────────
router.delete(
  '/:id',
  param('id').isUUID(),
  (req, res) => {
    if (!handleValidation(req, res)) return;
    const existing = db.prepare('SELECT id FROM declarations WHERE id = ?').get(req.params.id);
    if (!existing) return fail(res, 404, 'Declaration not found');
    db.prepare("UPDATE declarations SET status = 'voided', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    ok(res, { id: req.params.id, status: 'voided' });
  }
);

// ─── GET /api/declarations/stats/summary ─────────────────────────────────────
router.get('/stats/summary', (_req, res) => {
  const total    = db.prepare("SELECT COUNT(*) AS n FROM declarations WHERE status='active'").get().n;
  const totalIDV = db.prepare("SELECT COALESCE(SUM(idv),0) AS s FROM declarations WHERE status='active'").get().s;
  const avgIDV   = db.prepare("SELECT COALESCE(AVG(idv),0) AS a FROM declarations WHERE status='active'").get().a;
  const recent   = db.prepare("SELECT COUNT(*) AS n FROM declarations WHERE status='active' AND created_at >= datetime('now','-7 days')").get().n;
  ok(res, { total, totalIDV: Math.round(totalIDV * 100) / 100, avgIDV: Math.round(avgIDV * 100) / 100, recentThisWeek: recent });
});

module.exports = router;
