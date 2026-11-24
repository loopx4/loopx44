# LOOPX — Client Onboarding & Project Management Portal

> **Minimal, high-contrast, professional LoopX management application.**  
> Built with **React + Vite**, pure CSS design system, **Secure Backend Authentication & Sessions**, **Supabase** database & real-time chat, and configured for **Cloudflare Pages** deployment.

---

## 1. Quick Start (Run Locally)

```bash
# 1. Navigate to the project directory
cd /Users/jagan/.gemini/antigravity/scratch/loopx-app

# 2. Start the local dev environment (Express Auth API + Vite Frontend together)
npm run dev
```

The application will start on **`http://localhost:3000`** with the Express auth backend on **`http://localhost:3001`** (proxied automatically via `/api`).

To run automated tests:
```bash
npm test
```

To create a production build and audit bundle:
```bash
npm run build
```

---

## 2. Project Architecture & Folder Organisation

```
loopx-app/
├── public/
│   ├── assets/
│   │   └── loopx-logo.png       # Official LoopX logo (used in navigation & branding)
│   └── _redirects               # Cloudflare Pages SPA client-side routing fallback
├── server/
│   ├── credentials.config.cjs   # Server-side credential settings (bcrypt hashes, editable)
│   ├── authService.cjs          # Core authentication & JWT session service
│   └── index.cjs                # Express authentication dev backend (/api/auth/*)
├── functions/
│   └── api/
│       └── auth/
│           ├── login.js         # Cloudflare Pages Function (POST /api/auth/login)
│           ├── session.js       # Cloudflare Pages Function (GET /api/auth/session)
│           └── logout.js        # Cloudflare Pages Function (POST /api/auth/logout)
├── src/
│   ├── components/
│   │   ├── Navbar.jsx           # Global sticky top navigation with logo
│   │   ├── ProfileSelector.jsx  # Employee profile creation & case-insensitive selection
│   │   ├── SubmissionDetailModal.jsx # Full-detail viewer with status updates & audit trail
│   │   └── TeamDiscussion.jsx   # Shared internal team discussion with @mentions & replies
│   ├── config/
│   │   └── auth.config.js       # Frontend auth client (zero credentials, calls /api/auth/*)
│   ├── context/
│   │   └── AuthContext.jsx      # Server-validated session controller (httpOnly cookies)
│   ├── pages/
│   │   ├── PublicHomePage.jsx   # Public landing page with portal login access
│   │   ├── LoginPage.jsx        # Single unified login portal (auto-identifies role)
│   │   ├── EmployeeWorkspace.jsx# Employee dashboard, link generator, queue & submissions
│   │   ├── OwnerDashboard.jsx   # Executive overview, 4 clickable cards, distribution chart
│   │   └── ClientSubmissionPage.jsx # Public intake form & persistent read-only viewer
│   ├── services/
│   │   ├── dataService.js       # Unified data access layer (Supabase + local standby)
│   │   └── supabaseClient.js    # Supabase SDK client & connection status probe
│   ├── styles/
│   │   └── global.css           # Pure black (#000000), white, and LoopX lime (#8ee326) CSS
│   ├── App.jsx                  # Route switcher (Login, Employee, Owner, /submit/:token)
│   └── main.jsx                 # Application root entry point
├── supabase/
│   ├── migrations/
│   │   └── 20261123_init_schema.sql # Standard Supabase CLI migration file
│   └── schema.sql               # Ready-to-execute SQL script for Supabase SQL Editor
├── tests/
│   └── loopx.test.js            # Automated unit, integration & security tests (Vitest)
├── .env.example                 # Environment template with clearly labeled sections
├── .env                         # Active local configuration (git-ignored)
├── package.json                 # Project dependencies & scripts
├── vite.config.js               # Vite bundler, /api proxy & test configuration
└── README.md                    # Project documentation & operational handbook
```

---

## 3. Security Architecture & Credential Management

### Complete Separation of Credentials from Frontend
1. **Zero Credential Exposure**: No passwords, password hashes, or service-role keys are ever imported or bundled into frontend JavaScript (`dist/assets/*.js`).
2. **Server-Side Bcrypt Hashing**: Passwords are verified on the backend using **bcrypt** (cost factor 12 with automatic salting).
3. **Server-Issued Sessions**: After successful login, the backend issues an **`httpOnly`**, **`Strict` SameSite** session cookie signed with a secure JWT. Client JavaScript cannot read, tamper with, or forge this session.
4. **No Trust in LocalStorage**: Roles and permissions are retrieved and validated by the backend (`GET /api/auth/session`), preventing any localStorage-based authorization tampering.

### How to Edit Credentials in VS Code

Credentials are kept in separate, clearly labeled server-side configuration sections:

#### Local Development:
Open **`server/credentials.config.cjs`** in VS Code:
- **[SECTION 1]**: Owner username and bcrypt hash (`OWNER_USERNAME`, `OWNER_BCRYPT_HASH`)
- **[SECTION 2]**: Employee username and bcrypt hash (`EMPLOYEE_USERNAME`, `EMPLOYEE_BCRYPT_HASH`)
- **[SECTION 3]**: Session secret and session duration (`JWT_SECRET`, `SESSION_MAX_AGE_SECONDS`)

To generate a new bcrypt hash for a new password:
```bash
node -e "const b = require('bcryptjs'); b.hash('YOUR_NEW_PASSWORD', 12).then(console.log);"
```
Paste the generated hash into `server/credentials.config.cjs` and restart the backend.

---

## 4. Initial Credentials Reference

| Role | Username | Initial Password | Post-Login Landing View |
| :--- | :--- | :--- | :--- |
| **Owner** | `Jagan` | `12345678910` | **Owner Dashboard** (Executive analytics, all submissions, employee breakdown) |
| **Employee** | `Jagan team` | `123456789` | **Profile Selection** (Select or create employee name to enter workspace) |

*The login page automatically detects whether the authenticated user is the Owner or an Employee via the backend and routes accordingly.*

---

## 5. Supabase Setup & Connection Guide

### Step 1: Create a Free Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create an account.
2. Click **New Project** and name it `loopx`.
3. Choose a strong database password and select your closest region.

### Step 2: Apply the Database Schema & RLS Policies
1. In your Supabase dashboard, navigate to the **SQL Editor** (left menu).
2. Click **New Query**.
3. Open `supabase/schema.sql` from this repository, copy its entire contents, paste it into the SQL Editor, and click **Run**.
4. This creates:
   - `employee_profiles` table (with case-insensitive uniqueness constraint)
   - `queue_counter` table and `get_next_queue_number()` atomic sequencer
   - `client_links` table (cryptographically random tokens)
   - `client_submissions` table (with constraints and indexes)
   - `submission_files` and `status_history` tables
   - `team_messages` table (with Supabase Realtime publication)
   - `loopx-documents` private storage bucket
   - Role-based Row Level Security (RLS) policies for Owner, Employee, and Public clients

### Step 3: Connect the Frontend to Supabase
1. In Supabase, go to **Project Settings → API**.
2. Copy your **Project URL** and **anon / public** API key.
3. Open `.env` in `loopx-app` and paste them:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   VITE_SUPABASE_STORAGE_BUCKET=loopx-documents
   ```
4. Restart your application (`npm run dev`).

---

## 6. GitHub Setup & Cloudflare Pages Deployment

### Step 1: Push to GitHub
```bash
cd /Users/jagan/.gemini/antigravity/scratch/loopx-app

# Create a new repository on github.com (e.g. your-username/loopx-app)
git remote add origin https://github.com/<your-username>/loopx-app.git
git push -u origin main
```

### Step 2: Deploy on Cloudflare Pages
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com) and go to **Workers & Pages → Create Application → Pages → Connect to Git**.
2. Select your `loopx-app` GitHub repository.
3. In **Build Settings**:
   - **Framework Preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. In **Environment Variables** (under Settings → Environment variables):
   - `OWNER_USERNAME` = `Jagan`
   - `OWNER_BCRYPT_HASH` = `$2b$12$irbZaFRVJhto9fgNJw/pwuezijqyYsy395ruXdftgoK2XD7FFNoCi`
   - `EMPLOYEE_USERNAME` = `Jagan team`
   - `EMPLOYEE_BCRYPT_HASH` = `$2b$12$58BUD0.w/H.oAWKSCUQcfuDfL43Jn86shb7P.f9YctuGDgvBVmPKu`
   - `JWT_SECRET` = *(Generate a 64+ char random hex string)*
   - `VITE_SUPABASE_URL` = *(Your Supabase URL)*
   - `VITE_SUPABASE_ANON_KEY` = *(Your Supabase Anon Key)*
5. Click **Save and Deploy**. Cloudflare Pages automatically compiles the frontend and deploys the Cloudflare Pages Functions in `functions/api/auth/*` as serverless edge workers.

---

## 7. Verification & Feature Checklist

- [x] **Zero Frontend Credential Exposure**: Production JS bundles audited — 0 passwords, 0 password hashes.
- [x] **Server-Side Bcrypt Hashing**: Passwords stored and compared strictly on server via bcrypt cost factor 12.
- [x] **Server-Issued Sessions**: httpOnly, Strict SameSite, signed JWT sessions.
- [x] **Security Audit Suite**: 17 automated tests verifying auth, session tampering rejection, expired token rejection, permission boundaries.
- [x] **Pure Black, White & Lime Theme**: High-contrast minimal layout using `#000000`, white, and `#8ee326`.
- [x] **Official Logo**: Embedded directly in the navbar from the provided asset.
- [x] **Common Login**: Single login for Owner & Employee with automatic backend role detection.
- [x] **Zero Initial State**: 0 profiles, 0 submissions, 0 queue records, 0 chat messages.
- [x] **Employee Profiles**: Case-insensitive duplicate prevention; selection attributed to all actions.
- [x] **Private Client Links**: Generated using cryptographically random tokens (no queue number at link creation).
- [x] **Intake Form**: All 10 required fields and multi-file attachment support.
- [x] **Atomic Queue Number**: Generates sequential IDs (`LX-001`, `LX-002`, etc.) upon client submission.
- [x] **Persistent Read-Only Reopening**: Clients can close and reopen the exact same link to check status; editing is strictly locked.
- [x] **Owner Dashboard**: 4 clickable summary cards that open actual filtered submission lists; status distribution chart; employee breakdown.
- [x] **Team Discussion**: Real-time internal messaging, @mentions, and replies.
- [x] **Cloudflare SPA Routing**: Configured with `public/_redirects` and Pages Functions in `functions/`.
