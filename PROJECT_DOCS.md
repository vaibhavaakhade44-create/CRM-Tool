# BusinessOS — Project Documentation

> Multi-tenant SaaS CRM/ERP platform built for import-export businesses.
> Manage parties, inventory, purchases, sales, finance, HR, leads, projects, and more — all in one place.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Prerequisites](#4-prerequisites)
5. [Environment Setup](#5-environment-setup)
6. [How to Start the Project](#6-how-to-start-the-project)
7. [Seed Demo Data](#7-seed-demo-data)
8. [How to Use the App](#8-how-to-use-the-app)
9. [User Roles](#9-user-roles)
10. [Modules Reference](#10-modules-reference)
11. [API Overview](#11-api-overview)
12. [Deployment](#12-deployment)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Project Overview

**BusinessOS** is a full-stack, multi-organisation CRM/ERP platform. Each company (organisation) gets its own isolated workspace with role-based access control. The platform owner (Super Admin) can manage all organisations from a separate admin panel.

**Key capabilities:**
- Multi-tenant: unlimited organisations, each with their own data
- Role-based access: Super Admin → Org Owner → Admin → Member
- Module-based permissions: enable/disable any module per organisation
- Import-Export industry focus: trade documents, goods entry, shipment tracking
- Email, Leads, Deals, Quotations, Activities built-in

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| State management | Zustand |
| Routing | React Router v7 |
| Forms | React Hook Form + Zod |
| Backend | Node.js, Express v5, TypeScript |
| ORM | Prisma v5 |
| Database | PostgreSQL (Neon cloud-hosted) |
| Auth | JWT (access token 15m + refresh token 7d) |
| Email | Nodemailer (Gmail SMTP) |
| File uploads | Multer |
| Security | Helmet, CORS, express-rate-limit |

---

## 3. Folder Structure

```
BusinessOS/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        # Database schema
│   ├── src/
│   │   ├── controllers/         # Business logic
│   │   ├── routes/              # API route definitions
│   │   ├── middleware/          # Auth, org context, error handler
│   │   ├── validators/          # Zod/express validators
│   │   ├── lib/                 # Prisma client, JWT helpers
│   │   ├── utils/               # Email, response helpers, slugs
│   │   ├── prisma/seed.ts       # Demo data seeder
│   │   └── server.ts            # App entry point
│   ├── .env                     # Backend environment variables
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── layout/          # Sidebar, Header, AppLayout
│   │   │   └── ui/              # Button, Modal, Input, Card…
│   │   ├── pages/               # One folder per module/route
│   │   │   ├── auth/            # Login, Register, ForgotPassword…
│   │   │   ├── dashboard/
│   │   │   ├── crm/
│   │   │   ├── inventory/
│   │   │   ├── purchase/
│   │   │   ├── sales/
│   │   │   ├── finance/
│   │   │   ├── hr/
│   │   │   ├── leads/
│   │   │   ├── deals/
│   │   │   ├── quotations/
│   │   │   ├── email/
│   │   │   ├── activities/
│   │   │   ├── projects/
│   │   │   ├── support/
│   │   │   ├── warehouse/
│   │   │   ├── trade/
│   │   │   ├── reports/
│   │   │   ├── documents/
│   │   │   ├── settings/
│   │   │   ├── admin/           # Org Admin panel
│   │   │   └── superAdmin/      # Super Admin panel
│   │   ├── stores/              # Zustand stores (auth, etc.)
│   │   ├── lib/                 # Axios API client, module config
│   │   ├── types/               # Shared TypeScript types
│   │   └── App.tsx              # Routes
│   ├── .env                     # Frontend environment variables
│   └── package.json
│
├── render.yaml                  # Render.com deployment config
├── docker-compose.yml           # Docker (reference — not used in dev)
└── PROJECT_DOCS.md              # This file
```

---

## 4. Prerequisites

Install these before running the project:

| Tool | Version | Download |
|---|---|---|
| Node.js | v18 or higher | https://nodejs.org |
| npm | v9 or higher | included with Node |
| Git | any | https://git-scm.com |

The database is **already hosted on Neon** (cloud PostgreSQL) — no local database install needed.

---

## 5. Environment Setup

### Backend — `backend/.env`

```env
# Database (Neon PostgreSQL — already configured)
DATABASE_URL="postgresql://..."

# Server
PORT=5000
NODE_ENV=development

# JWT Secrets (change in production)
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Email / SMTP (optional — for invite & password reset emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_gmail_app_password   # Generate at: Google Account → Security → App Passwords
SMTP_FROM_NAME=BusinessOS
```

### Frontend — `frontend/.env`

```env
VITE_API_URL=http://localhost:5000
```

> The frontend `.env` may not exist by default. Copy from `frontend/.env.example` if present.

---

## 6. How to Start the Project

### Step 1 — Install dependencies

Open two terminals (or PowerShell windows):

**Terminal 1 — Backend:**
```bash
cd BusinessOS/backend
npm install
```

**Terminal 2 — Frontend:**
```bash
cd BusinessOS/frontend
npm install
```

### Step 2 — Start both servers

**Terminal 1 — Backend (runs on port 5000):**
```bash
cd BusinessOS/backend
npm run dev
```

**Terminal 2 — Frontend (runs on port 5173):**
```bash
cd BusinessOS/frontend
npm run dev
```

### Step 3 — Open the app

```
http://localhost:5173
```

The backend health check is available at:
```
http://localhost:5000/api/health
```

### Available Scripts

| Command | Location | Description |
|---|---|---|
| `npm run dev` | backend/ | Start backend with hot-reload |
| `npm run build` | backend/ | Compile TypeScript to dist/ |
| `npm run start` | backend/ | Run compiled production build |
| `npm run db:migrate` | backend/ | Apply database migrations |
| `npm run db:generate` | backend/ | Regenerate Prisma client |
| `npm run db:studio` | backend/ | Open Prisma Studio (visual DB editor) |
| `npm run db:seed` | backend/ | Load 35 days of demo data |
| `npm run dev` | frontend/ | Start Vite dev server |
| `npm run build` | frontend/ | Build for production |

---

## 7. Seed Demo Data

To populate the database with realistic demo data (35 days of operations):

```bash
cd BusinessOS/backend
npm run db:seed
```

**What gets created:**
- 8 customers + 5 suppliers (parties)
- 15 products across 4 categories (textiles, electronics, packaging, hardware)
- 2 warehouses with stock movements
- 8 employees with attendance, payroll & leave records
- 8 purchase orders with bills and payments
- 15 sales orders with invoices, shipments, and payments
- 10 leads in various pipeline stages
- 3 projects with 11 tasks
- 4 support tickets
- 6 CRM communication logs
- All modules enabled for the organisation

> **Important:** Register and create an organisation first (step 8 below), then run the seed.

---

## 8. How to Use the App

### First-time Setup

#### 8.1 — Register a new account

1. Go to `http://localhost:5173`
2. Click **Register** or navigate to `/register`
3. Fill in your name, email, and password
4. Verify your email if SMTP is configured (skip if not)

#### 8.2 — Create your Organisation

After registering, you will be prompted to create an organisation:

1. Enter your company name (e.g., "OM Import Export Ltd")
2. Submit — you are now the **Owner** of this organisation

#### 8.3 — Dashboard

After login, you land on the **Dashboard** which shows:
- Revenue, purchase, and inventory summary cards
- Recent activity and quick stats

---

### Navigation

The left sidebar contains all modules. Modules you don't have access to show a lock icon. The org admin can enable/disable modules.

---

### Inviting Team Members

1. Go to **Admin Panel** (`/admin/team`) — only Owners and Admins can access this
2. Click **Invite Member**
3. Enter their email — they receive an invite link
4. They click the link, set a password, and join your organisation

---

### Core Workflows

#### Create a Customer or Supplier (CRM)
1. Navigate to **CRM** from the sidebar
2. Click **Add Party**
3. Select type: Customer or Supplier
4. Fill in name, email, phone, GSTIN, city, state, credit limit
5. Save — the party now appears in your CRM list
6. Click any party to view their full detail page (orders, invoices, communications, documents)

#### Raise a Purchase Order
1. Navigate to **Purchase**
2. Click **New Purchase Order**
3. Select a supplier from the party list
4. Add line items (products, quantity, rate, tax)
5. Save as Draft, or Send to supplier
6. Mark as Received when goods arrive

#### Create a Sales Order
1. Navigate to **Dispatch** (Sales)
2. Click **New Sales Order**
3. Select a customer, add products, apply discounts if any
4. Confirm → Dispatch → mark as Delivered
5. Generate invoice from the sales order

#### Manage Inventory
1. Navigate to **Inventory**
2. View current stock levels, reorder alerts
3. Stock updates automatically when purchase orders are received and sales orders are dispatched

#### Record Leads (Marketing)
1. Navigate to **Marketing**
2. Add leads with source (Website, Referral, Exhibition, etc.)
3. Move leads through the Kanban board: New → Contacted → Qualified → Proposal → Negotiation → Won / Lost

#### Track Deals & Quotations
1. Navigate to **Deals** to manage your sales pipeline
2. Navigate to **Quotations** to create and send quotes to customers
3. Convert a quotation to a sales order once accepted

#### HR Management
1. Navigate to **HR**
2. Add employees, mark attendance, process payroll
3. Manage leave requests

#### Finance / Accounts
1. Navigate to **Accounts**
2. View all sales invoices and purchase bills
3. Record payments, track outstanding dues
4. View profit/loss summary

#### Import/Export Suite (Trade)
1. Navigate to **Import-Export** from the sidebar
2. Manage shipping bills, goods entries, customs documents
3. Track international shipments

---

## 9. User Roles

| Role | Where | Permissions |
|---|---|---|
| **Super Admin** | `/super-admin` | View all organisations and users on the platform; manage subscriptions |
| **Owner** | Organisation | Full access to everything; access to Admin Panel |
| **Admin** | Organisation | Access to Admin Panel (team, modules, settings, logs); all modules |
| **Member** | Organisation | Access only to modules assigned by Admin |

### Super Admin Login

The Super Admin panel is completely separate from regular user accounts.

URL: `http://localhost:5173/super-admin/login`

> Super Admin credentials are set in the database directly or via a seed script. Contact the platform owner for credentials.

### Org Admin Panel

URL: `http://localhost:5173/admin`

Only Owners and Admins can access this. From here you can:
- **Team** — invite members, change roles, remove members
- **Modules** — enable or disable specific modules for your organisation
- **Settings** — update organisation name and details
- **Logs** — view activity audit logs

---

## 10. Modules Reference

| Sidebar Label | Route | Module Key | Description |
|---|---|---|---|
| Dashboard | `/dashboard` | (always visible) | Summary stats and recent activity |
| CRM | `/crm` | CRM | Customers, suppliers, communication logs |
| Inventory | `/inventory` | INVENTORY | Products, stock levels, stock movements |
| Purchase | `/purchase` | PURCHASE | Purchase orders, supplier bills |
| Store | `/store` | STORE | Internal store / goods receipt |
| Dispatch | `/dispatch` | DISPATCH | Sales orders, customer deliveries |
| Accounts | `/accounts` | ACCOUNTS | Invoices, payments, finance overview |
| HR | `/hr` | HR | Employees, attendance, payroll, leaves |
| Projects | `/projects` | PROJECTS | Projects and tasks management |
| Marketing | `/marketing` | MARKETING | Leads pipeline (Kanban view) |
| Support | `/support` | SUPPORT | Customer support tickets |
| Import-Export | `/import-export` | IMPORT_EXPORT_SUITE | Trade documents, customs, shipments |
| Retail/POS | `/pos` | POS | Point-of-sale for retail operations |
| Warehouse | `/warehouse` | WAREHOUSE | Warehouse management, transfers |
| Reports | `/reports` | REPORTS | Business analytics and charts |
| Deals | `/deals` | (always on) | Sales deals pipeline |
| Quotations | `/quotations` | (always on) | Customer quotations |
| Email | `/email` | (always on) | Internal email client |
| Activities | `/activities` | (always on) | Timeline of all activities |
| Documents | `/documents` | (always on) | File attachments per record |
| Settings | `/settings` | (always on) | User profile and preferences |

---

## 11. API Overview

Base URL (development): `http://localhost:5000/api`

All authenticated routes require the header:
```
Authorization: Bearer <access_token>
```

Most routes also require:
```
x-organization-id: <org_id>
```

### Key Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server and DB health check |
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password` | Reset password with token |
| GET | `/organizations` | List user's organisations |
| POST | `/organizations` | Create new organisation |
| GET | `/parties` | List customers/suppliers |
| POST | `/parties` | Create party |
| GET | `/inventory` | List products with stock |
| GET | `/purchase-orders` | List purchase orders |
| GET | `/sales-orders` | List sales orders |
| GET | `/finance` | Finance summary |
| GET | `/leads` | List leads |
| GET | `/hr/employees` | List employees |
| GET | `/projects` | List projects |
| GET | `/search?q=term` | Global search across records |

---

## 12. Deployment

The project is configured for **Render.com** deployment via `render.yaml`.

### Production Build

**Backend:**
```bash
cd backend
npm run build          # Compiles TypeScript → dist/
npm run start          # Runs dist/server.js
```

**Frontend:**
```bash
cd frontend
npm run build          # Outputs to frontend/dist/
```

In production, the backend serves the frontend's `dist/` folder as static files — a single Node.js service handles everything.

### Environment Variables for Production

Set these in your hosting provider's dashboard:

```
DATABASE_URL=<your neon connection string>
JWT_ACCESS_SECRET=<strong random secret>
JWT_REFRESH_SECRET=<strong random secret>
PORT=10000
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
```

---

## 13. Troubleshooting

### Port already in use (EADDRINUSE)

Kill processes on the conflicting ports:

**Windows:**
```powershell
# Find and kill process on port 5000
netstat -ano | findstr :5000
Stop-Process -Id <PID> -Force

# Or kill both ports at once
netstat -ano | findstr ":5000 :5173" | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
```

**Mac/Linux:**
```bash
kill -9 $(lsof -ti:5000)
kill -9 $(lsof -ti:5173)
```

### Database connection error

1. Check `backend/.env` has the correct `DATABASE_URL`
2. Neon free-tier databases pause after inactivity — first request may take 3–5 seconds to wake
3. Test connectivity: `http://localhost:5000/api/health` — should return `{"status":"ok","db":"connected"}`

### Prisma client out of date

```bash
cd backend
npm run db:generate
```

### Seed fails — "No organisation found"

Register a user account and create an organisation via the UI first, then run:
```bash
npm run db:seed
```

### CORS error in browser

Ensure `FRONTEND_URL` in `backend/.env` matches exactly where your frontend is running (default: `http://localhost:5173`).

### Email invite / password reset not working

Configure SMTP in `backend/.env`. For Gmail:
1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account → Security → App Passwords
3. Generate an app password and paste it into `SMTP_PASS`

---

*Last updated: May 2026 — BusinessOS v2*
