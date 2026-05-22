# Motor Insurance — Underwriting Declaration System

A production-ready full-stack app for managing motor insurance underwriting declarations.

## Stack
| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | HTML5 + Tailwind CSS CDN + Vanilla JS |
| Backend  | Node.js (v22+) + Express 5          |
| Database | SQLite via Node.js built-in `node:sqlite` |

---

## Prerequisites

- **Node.js v22.5.0+** (required for built-in SQLite)
- No other system dependencies needed

---

## Quick Start

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Start the server (from project root)
cd ..
npm start

# Server runs at http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

---

## Project Structure

```
insurance-app/
├── backend/
│   ├── server.js        ← Express app entry point
│   ├── routes.js        ← REST API route handlers
│   ├── db.js            ← SQLite init & schema
│   ├── data/
│   │   └── insurance.db ← SQLite file (auto-created)
│   └── package.json
├── frontend/
│   └── public/
│       └── index.html   ← Tailwind CSS SPA frontend
└── package.json
```

---

## REST API Reference

### Base URL: `http://localhost:3000/api`

#### Health
```
GET  /health
```

#### Declarations
| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | `/declarations`                   | List with pagination     |
| GET    | `/declarations/:id`               | Get single declaration   |
| POST   | `/declarations`                   | Create new declaration   |
| PUT    | `/declarations/:id`               | Update declaration       |
| DELETE | `/declarations/:id`               | Soft-void declaration    |
| GET    | `/declarations/stats/summary`     | Dashboard stats          |

#### Query Params (GET /declarations)
| Param    | Type   | Default  | Description           |
|----------|--------|----------|-----------------------|
| `page`   | int    | 1        | Page number           |
| `limit`  | int    | 10       | Records per page      |
| `status` | string | `active` | `active` or `voided`  |
| `search` | string | —        | Search VIN/model/name |

#### POST /PUT Body
```json
{
  "make_model":  "TOYOTA RUSH",
  "year":        2019,
  "chassis_vin": "MHKEF8BKK003049",
  "engine_no":   "2NRF752340",
  "idv":         37500,
  "currency":    "AED",
  "signatory":   "Ahmed Al-Rashid",
  "company":     "Raja Tahir Motors FZCO",
  "issued_date": "2026-05-22"
}
```

---

## Environment Variables

| Variable  | Default                    | Description           |
|-----------|----------------------------|-----------------------|
| `PORT`    | `3000`                     | HTTP server port      |
| `DB_PATH` | `backend/data/insurance.db` | SQLite database path |

```bash
PORT=8080 DB_PATH=/var/data/insurance.db npm start
```

---

## Features

- **CRUD** — Create, edit, soft-void declarations
- **Search** — Real-time search by model, VIN, signatory, engine no.
- **Pagination** — Server-side with page controls
- **Stats dashboard** — Total records, total IDV, avg IDV, weekly count
- **Validation** — Server-side (express-validator) + client-side feedback
- **Duplicate prevention** — Blocks duplicate active VIN entries
- **Multi-currency** — AED, USD, EUR, GBP, SAR
- **Responsive** — Works on mobile, tablet, and desktop
