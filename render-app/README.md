# MirrorTech POS — Render Deployment

A lightweight, single-process deployment of MirrorTech POS for [Render.com](https://render.com) Free Tier (512MB RAM).

## What's Different?

- **Single process**: Express serves both the API and static React frontend
- **No pino logger**: Simple console logging, no worker threads
- **No workspace dependencies**: Self-contained with inline schema
- **Small footprint**: ~50MB total, ~150MB RAM usage

## Deploy to Render

1. Create a new **Web Service** on Render
2. Connect your GitHub repo containing this `render-app/` folder
3. Set these environment variables:
   - `DATABASE_URL` — your PostgreSQL connection string
   - `JWT_SECRET` — a random secret string (e.g., `openssl rand -base64 32`)
   - `PORT` — `10000` (Render sets this automatically)
4. Set build & start commands:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. Click **Create Web Service**

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_REFRESH_SECRET` | No | Refresh token secret (defaults to dev value) |
| `PORT` | No | Server port (defaults to 10000) |
| `NODE_ENV` | No | Set to `production` for production mode |

## Database Setup

After deploying, hit the seed endpoint to create demo data:

```bash
curl -X POST https://your-app.onrender.com/api/seed
```

Demo credentials:
- `admin` / `admin123` (PIN: 1234)
- `cashier1` / `cash123` (PIN: 1234)
- `manager1` / `mgr123` (PIN: 5678)

## Demo Data

- 2 locations (Accra Central, Kumasi Branch)
- 10 products across 4 categories
- Demo users with role-based access

## File Structure

```
render-app/
  src/
    server.ts     — Express server (API + static files)
    schema.ts     — Drizzle ORM schema definitions
    db.ts         — Database connection (PostgreSQL pool)
    auth.ts       — JWT middleware & role authorization
  public/
    index.html    — React SPA entry
    assets/       — Built JS/CSS bundles
  dist/
    server.mjs    — Compiled server bundle
  package.json
```

## RAM & Disk Usage

| Component | Size |
|-----------|------|
| `node_modules` (production) | ~45MB |
| Server bundle | ~48KB |
| Frontend assets | ~1.2MB |
| Source code | ~20KB |
| **Total** | **~50MB** |
| **Runtime RAM** | **~100-150MB** |

## API Endpoints

- `GET /api/healthz` — Health check
- `POST /api/auth/login` — Login with password
- `POST /api/auth/pin-login` — Login with PIN
- `POST /api/auth/refresh` — Refresh token
- `GET /api/auth/me` — Current user
- `GET /api/inventory` — List products
- `POST /api/transactions` — Create sale
- `GET /api/analytics/summary` — Dashboard KPIs
- `GET /api/leads` — CRM leads
- `GET /api/tasks` — Sales tasks
- `GET /api/discount-requests` — Discount queue
- `GET /api/permissions` — RBAC permissions
- `POST /api/seed` — Create demo data
- `GET *` — Serves React SPA

## Features

- POS Terminal with cash/MoMo/card checkout
- Inventory management with low-stock alerts
- GRA E-VAT receipt generation
- Role-based access (Admin/Manager/Cashier)
- Lead/pipeline management for sales team
- Task management for salespeople
- Discount approval workflow
- Shift scheduling
- Stock transfers between branches
- Analytics dashboard
- Offline-first cart (sync on reconnect)
- Auto-cleanup: old transactions deleted after 90 days, audit logs after 30 days
- Database size monitoring via admin endpoint
