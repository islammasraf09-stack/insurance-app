'use strict';
const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('./db');

const router = express.Router();

function ok(res, data, meta = {}) {
  return res.json({ success: true, data, ...meta });
}
function fail(res, status, message, errors = []) {
  return res.status(status).json({ success: false, message, errors });
}
function validate(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    fail(res, 422, 'Validation failed', errs.array().map(e => ({ field: e.path, msg: e.msg })));
    return false;
  }
  return true;
}

// ── GET all ───────────────────────────────────────────────────
router.get('/',
  query('page').optional().isInt({ min:1 }).toInt(),
  query('limit').optional().isInt({ min:1, max:100 }).toInt(),
  query('status').optional().isIn(['active','voided']),
  query('search').optional().trim(),
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const page   = req.query.page  || 1;
      const limit  = req.query.limit || 10;
      const offset = (page - 1) * limit;
      const status = req.query.status || 'active';
      const search = req.query.search || '';

      let where = 'WHERE status = $1';
      const args = [status];

      if (search) {
        const s = `%${search}%`;
        where += ` AND (make_model ILIKE $2 OR chassis_vin ILIKE $2 OR signatory ILIKE $2 OR engine_no ILIKE $2)`;
        args.push(s);
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM declarations ${where}`, args);
      const total = parseInt(countResult.rows[0].count);

      const dataResult = await pool.query(
        `SELECT * FROM declarations ${where} ORDER BY created_at DESC LIMIT $${args.length+1} OFFSET $${args.length+2}`,
        [...args, limit, offset]
      );

      ok(res, dataResult.rows, {
        meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 }
      });
    } catch(e) { fail(res, 500, e.message); }
  }
);

// ── Stats ─────────────────────────────────────────────────────
router.get('/stats/summary', async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='active') AS total,
        COALESCE(SUM(idv) FILTER (WHERE status='active'), 0) AS total_idv,
        COALESCE(AVG(idv) FILTER (WHERE status='active'), 0) AS avg_idv,
        COUNT(*) FILTER (WHERE status='active' AND created_at >= NOW() - INTERVAL '7 days') AS recent
      FROM declarations
    `);
    const row = r.rows[0];
    ok(res, {
      total:          parseInt(row.total),
      totalIDV:       Math.round(parseFloat(row.total_idv) * 100) / 100,
      avgIDV:         Math.round(parseFloat(row.avg_idv) * 100) / 100,
      recentThisWeek: parseInt(row.recent)
    });
  } catch(e) { fail(res, 500, e.message); }
});

// ── GET one ───────────────────────────────────────────────────
router.get('/:id', param('id').isUUID(), async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const r = await pool.query('SELECT * FROM declarations WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return fail(res, 404, 'Declaration not found');
    ok(res, r.rows[0]);
  } catch(e) { fail(res, 500, e.message); }
});

// ── CREATE ────────────────────────────────────────────────────
router.post('/',
  body('make_model').trim().notEmpty().withMessage('Make & Model is required'),
  body('year').isInt({ min:1900, max:new Date().getFullYear()+1 }).withMessage('Valid year required'),
  body('chassis_vin').trim().notEmpty().withMessage('Chassis/VIN is required'),
  body('engine_no').trim().notEmpty().withMessage('Engine number is required'),
  body('idv').isFloat({ min:1 }).withMessage('IDV must be a positive number'),
  body('signatory').trim().notEmpty().withMessage('Signatory name is required'),
  body('issued_date').isISO8601().withMessage('Valid date required'),
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { make_model, year, chassis_vin, engine_no, idv, currency, signatory, company, issued_date } = req.body;

      const dup = await pool.query(
        "SELECT id FROM declarations WHERE chassis_vin=$1 AND status='active'",
        [chassis_vin.trim().toUpperCase()]
      );
      if (dup.rows.length) return fail(res, 409, 'An active declaration with this Chassis/VIN already exists');

      const id = uuidv4();
      const r = await pool.query(
        `INSERT INTO declarations (id,make_model,year,chassis_vin,engine_no,idv,currency,signatory,company,issued_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          id,
          make_model.trim().toUpperCase(),
          Number(year),
          chassis_vin.trim().toUpperCase(),
          engine_no.trim().toUpperCase(),
          parseFloat(idv),
          (currency||'AED').trim().toUpperCase(),
          signatory.trim(),
          (company||'Raja Tahir Motors FZCO').trim(),
          issued_date.split('T')[0]
        ]
      );
      res.status(201).json({ success:true, data: r.rows[0] });
    } catch(e) { fail(res, 500, e.message); }
  }
);

// ── UPDATE ────────────────────────────────────────────────────
router.put('/:id', param('id').isUUID(), async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const ex = await pool.query('SELECT status FROM declarations WHERE id=$1', [req.params.id]);
    if (!ex.rows.length) return fail(res, 404, 'Declaration not found');
    if (ex.rows[0].status === 'voided') return fail(res, 409, 'Cannot edit a voided declaration');

    const b = req.body;
    const r = await pool.query(
      `UPDATE declarations SET
        make_model  = COALESCE($1, make_model),
        year        = COALESCE($2, year),
        chassis_vin = COALESCE($3, chassis_vin),
        engine_no   = COALESCE($4, engine_no),
        idv         = COALESCE($5, idv),
        currency    = COALESCE($6, currency),
        signatory   = COALESCE($7, signatory),
        company     = COALESCE($8, company),
        issued_date = COALESCE($9, issued_date),
        updated_at  = NOW()
       WHERE id=$10 RETURNING *`,
      [
        b.make_model  ? b.make_model.trim().toUpperCase()  : null,
        b.year        ? Number(b.year)                     : null,
        b.chassis_vin ? b.chassis_vin.trim().toUpperCase() : null,
        b.engine_no   ? b.engine_no.trim().toUpperCase()   : null,
        b.idv         ? parseFloat(b.idv)                  : null,
        b.currency    ? b.currency.trim().toUpperCase()    : null,
        b.signatory   ? b.signatory.trim()                 : null,
        b.company     ? b.company.trim()                   : null,
        b.issued_date ? b.issued_date.split('T')[0]        : null,
        req.params.id
      ]
    );
    ok(res, r.rows[0]);
  } catch(e) { fail(res, 500, e.message); }
});

// ── VOID ──────────────────────────────────────────────────────
router.delete('/:id', param('id').isUUID(), async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const ex = await pool.query('SELECT id FROM declarations WHERE id=$1', [req.params.id]);
    if (!ex.rows.length) return fail(res, 404, 'Declaration not found');
    await pool.query("UPDATE declarations SET status='voided', updated_at=NOW() WHERE id=$1", [req.params.id]);
    ok(res, { id: req.params.id, status: 'voided' });
  } catch(e) { fail(res, 500, e.message); }
});

module.exports = router;
