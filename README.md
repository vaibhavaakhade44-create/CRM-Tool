# BusinessOS

A multi-tenant SaaS CRM/ERP platform for any business type. Manage customers, invoices, inventory, HR, projects, leads, deals, documents and more — all in one place.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, TypeScript, Tailwind v4, Zustand |
| Backend | Node.js 20, Express 5, TypeScript, Prisma v5 |
| Database | PostgreSQL 16 |
| Auth | JWT (access + refresh tokens), bcrypt |
| Email | Resend API (HTTP), with SMTP fallback via Nodemailer |
| File Storage | Local disk (multer) — swap for S3 in production |
| Deployment | Render / Docker + nginx |

---

## Modules

| Module | Description |
|---|---|
| CRM | Contacts, customers, suppliers, communications, tags |
| Inventory | Products, stock levels, categories, reorder alerts |
| Purchase | Purchase orders, vendor management, GRN |
| Store (Inward) | Incoming goods register, material receipts |
| Dispatch (Outward) | Outgoing goods, sales orders, shipment tracking |
| Finance | Invoices, payments, credit notes, P&L |
| HR & Payroll | Employees, attendance, salary processing |
| Warehouse | Multi-location stock, bin management, transfers |
| Projects | Projects, tasks, deadlines, assignments |
| Leads & Marketing | Lead pipeline, kanban, scoring, follow-ups |
| Deals | Opportunity pipeline, deal tracking |
| Quotations | Proposals with line items, PDF generation |
| Email | Compose and manage emails within the CRM |
| Activities | Follow-up tasks and activity log |
| Documents | Org-wide file manager — attach files to any record |
| Reports | Cross-module analytics, KPI charts, CSV exports |
| Customer Support | Helpdesk tickets, SLA tracking |
| Import/Export Suite | LC, custom docs, Incoterms, HS codes (industry add-on) |
| Retail & Fashion | Variants, collections, boutique POS (industry add-on) |

Modules can be enabled/disabled per organization from **Settings → Modules**.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 16 running locally
- npm 9+

### 1. Clone and install

```bash
git clone https://github.com/Hariomtechentrance/CRM-Tool.git
cd CRM-Tool

# Install backend deps
cd backend && npm install && cd ..

# Install frontend deps
cd frontend && npm install && cd ..
```

### 2. Configure backend environment

```bash
cp .env.example backend/.env
```

Edit `backend/.env`:
- Set `DATABASE_URL` to your local PostgreSQL connection string
- Generate JWT secrets (run this twice for two different values):
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- Set SMTP credentials if you want email to work (optional for local dev)

### 3. Set up the database

```bash
cd backend
npx prisma db push       # creates tables from schema
npx prisma generate      # generates Prisma client
cd ..
```

### 4. Start development servers

Open two terminals:

```bash
# Terminal 1 — Backend (runs on :5000)
cd backend && npm run dev

# Terminal 2 — Frontend (runs on :5173, proxies /api to :5000)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Production Deployment (Render)

1. Push this repo to GitHub
2. Create a new **Web Service** on [render.com](https://render.com) connected to the repo
3. Render will auto-detect `render.yaml` and configure the service
4. Set the following environment variables in the Render dashboard:
   - `DATABASE_URL` — your PostgreSQL connection string (use Render Postgres or Neon)
   - `JWT_ACCESS_SECRET` — 64-char random hex string
   - `JWT_REFRESH_SECRET` — different 64-char random hex string
   - `FRONTEND_URL` — your Render app URL (e.g. `https://businessos.onrender.com`)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` — optional

---

## Production Deployment (Docker / VPS)

### 1. Set environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
POSTGRES_PASSWORD=your_strong_db_password
JWT_ACCESS_SECRET=<64-char random hex>
JWT_REFRESH_SECRET=<different 64-char random hex>
FRONTEND_URL=https://yourdomain.com
APP_PORT=80
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_gmail_app_password
EMAIL_FROM=BusinessOS <noreply@yourdomain.com>
```

> **Gmail App Password**: Google Account → Security → 2-Step Verification → App Passwords.

### 2. Build and start

```bash
docker compose up -d --build
```

### 3. Verify

```bash
curl http://localhost/api/health
# {"status":"ok","db":"connected",...}
```

---

## Architecture

```
Browser
  │
  ▼
nginx (port 80)
  ├── /api/*  → proxy → Express backend (:5000)
  └── /*      → React SPA (static files)
                    │
              Prisma ORM
                    │
               PostgreSQL
```

### Multi-tenancy

Every resource has an `organizationId`. The backend middleware (`requireOrgContext`) enforces that all queries are scoped to the active organization. Users can belong to multiple organizations and switch between them.

### Auth Flow

1. Register / Login → receive `accessToken` (15m) + `refreshToken` (7d)
2. Access token sent as `Authorization: Bearer <token>` on every request
3. Token auto-refreshes silently when it expires (handled in `src/lib/api.ts`)
4. Logout revokes the refresh token in the database

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | API port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_ACCESS_SECRET` | Yes | 64+ char random string |
| `JWT_REFRESH_SECRET` | Yes | 64+ char random string (different) |
| `JWT_ACCESS_EXPIRES_IN` | No | Default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | Default: `7d` |
| `FRONTEND_URL` | Yes | Allowed CORS origin, comma-separated for multiple |
| `SMTP_HOST` | No | SMTP server hostname |
| `SMTP_PORT` | No | 587 (STARTTLS) or 465 (SSL) |
| `SMTP_USER` | No | SMTP username / email |
| `SMTP_PASS` | No | SMTP password or app password |
| `EMAIL_FROM` | No | Sender display name + address |

---

## Troubleshooting

**Server won't start — "Missing required environment variables"**
Ensure `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` are set in `backend/.env`.

**"Cannot connect to database"**
Check `DATABASE_URL` format: `postgresql://user:password@host:5432/dbname`

**Emails not sending**
For Gmail, use an **App Password** (not your account password). Generate at myaccount.google.com/apppasswords.

**Reset database (destructive)**
```bash
cd backend && npx prisma db push --force-reset
```
