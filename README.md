# LOOPX — Client Onboarding & Project Management Portal

> **Minimal, high-contrast, professional LoopX management application.**  
> Built with **React + Vite**, pure CSS design system, **Secure Backend Authentication & Sessions**, **Supabase** database & real-time chat, and configured for **Cloudflare Pages** deployment.
> Brand Motto: *"Strategy. Creative Growth."*

---

## 1. Quick Start (Run Locally)

```bash
# 1. Navigate to the project directory
cd /Users/jagan/.gemini/antigravity/scratch/loopx-app

# 2. Copy the environment template to .env (if not already present)
cp .env.example .env

# 3. Start the local dev environment (Express Auth API + Vite Frontend together)
npm run dev
```

The application will start on **`http://localhost:3000`** with the Express auth backend on **`http://localhost:3001`** (proxied automatically via `/api`).

To run the automated test suite (45 tests):
```bash
npm test
```

To create a production build and audit the bundle:
```bash
npm run build
```

---

## 2. Project Architecture & Folder Organisation

```
loopx-app/
├── public/
│   ├── assets/
│   │   └── loopx-logo.png             # Official LoopX logo (used in navigation & branding)
│   └── _redirects                     # Cloudflare Pages SPA client-side routing fallback
├── server/
│   ├── credentials.config.cjs         # Server-side credential settings (environment-loaded)
│   ├── authService.cjs                # Core authentication & JWT session service
│   └── index.cjs                      # Express authentication dev backend (/api/auth/*)
├── functions/
│   └── api/
│       └── auth/
│           ├── login.js               # Cloudflare Pages Function (POST /api/auth/login)
│           ├── session.js             # Cloudflare Pages Function (GET /api/auth/session)
│           └── logout.js              # Cloudflare Pages Function (POST /api/auth/logout)
├── src/
│   ├── components/
│   │   ├── Navbar.jsx                 # Global sticky top navigation with LoopX branding
│   │   ├── ProfileSelector.jsx        # Employee profile creation & selection
│   │   ├── FormBuilder.jsx            # Shared Google-Forms-style questionnaire builder
│   │   ├── ConfirmationModal.jsx      # Confirmation dialog for safe deletion across all features
│   │   ├── SubmissionDetailModal.jsx  # Client details management, editing & file removal
│   │   └── TeamDiscussion.jsx         # Shared team chat with @mentions, editing & deleting
│   ├── config/
│   │   └── auth.config.js             # Frontend auth client (zero credentials, calls /api/auth/*)
│   ├── context/
│   │   └── AuthContext.jsx            # Server-validated session controller (httpOnly cookies)
│   ├── pages/
│   │   ├── PublicHomePage.jsx         # Public landing page with portal login access
│   │   ├── LoginPage.jsx              # Single unified login portal (auto-identifies role)
│   │   ├── EmployeeWorkspace.jsx      # Employee dashboard, link generator, queue & submissions
│   │   ├── OwnerDashboard.jsx         # Executive overview, storage meters, cards & management
│   │   └── ClientSubmissionPage.jsx   # Public intake form & persistent read-only viewer
│   ├── services/
│   │   ├── dataService.js             # Unified data access layer (Supabase + local standby)
│   │   └── supabaseClient.js          # Supabase SDK client & connection status probe
│   ├── styles/
│   │   └── global.css                 # Pure black (#000000), white, and LoopX lime (#8ee326) CSS
│   ├── App.jsx                        # Route switcher (Login, Employee, Owner, /submit/:token)
│   └── main.jsx                       # Application root entry point
├── supabase/
│   ├── migrations/
│   │   └── 20261123_init_schema.sql   # Canonical migration file (matching schema.sql)
│   └── schema.sql                     # Complete, hardened SQL script for Supabase SQL Editor
├── tests/
│   ├── loopx.test.js                  # 36 unit, integration, storage, and security tests (Vitest)
│   └── cloudflare-functions.test.js   # 9 Cloudflare Pages edge functions tests (Vitest)
├── .env.example                       # Environment template with placeholder values
├── .env                               # Active local configuration (protected by .gitignore)
├── .gitignore                         # Git protection rules (.env, node_modules, dist, etc.)
├── package.json                       # Project dependencies & scripts
├── vite.config.js                     # Vite bundler, /api proxy & test configuration
└── README.md                          # Project documentation & operational handbook
```

---

## 3. Security Architecture & Credential Management

### Complete Separation of Credentials from Frontend
1. **Zero Credential Exposure**: No passwords, password hashes, or service-role keys are ever imported or bundled into frontend JavaScript (`dist/assets/*.js`).
2. **Server-Side Bcrypt Hashing**: Passwords are verified on the backend using **bcrypt** (cost factor 12 with automatic salting).
3. **Server-Issued Sessions**: After successful login, the backend issues an **`httpOnly`**, **`Strict` SameSite** session cookie signed with a secure JWT. Client JavaScript cannot read, tamper with, or forge this session.
4. **No Trust in LocalStorage**: Roles and permissions are retrieved and validated by the backend (`GET /api/auth/session`), preventing any localStorage-based authorization tampering.

### How to Configure Server Credentials

Credentials are kept strictly in server-side environment variables:

#### Local Development (`.env`):
```env
OWNER_USERNAME=Jagan
OWNER_BCRYPT_HASH=<paste_owner_bcrypt_hash_here>

EMPLOYEE_USERNAME=Jagan team
EMPLOYEE_BCRYPT_HASH=<paste_employee_bcrypt_hash_here>

JWT_SECRET=<paste_random_48_byte_hex_secret_here>
SESSION_MAX_AGE_SECONDS=28800
```

To generate a new bcrypt hash for a password:
```bash
node -e "const b = require('bcryptjs'); b.hash('YOUR_NEW_PASSWORD', 12).then(console.log);"
```

To generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 4. Role & Access Matrix

| Role | Default Username | Target Landing View | Permissions |
| :--- | :--- | :--- | :--- |
| **Owner** | Configured in `OWNER_USERNAME` | **Owner Dashboard** | Full access to all submissions, status updates, employee profile management, storage management, file/submission deletion |
| **Employee** | Configured in `EMPLOYEE_USERNAME` | **Profile Selection** | Personal workspace, private link generation, client submissions attributed to selected profile, own status updates, team chat |
| **Client** | Anonymous via unique token | **Intake Portal** (`/submit/:token`) | View form questions, submit details, upload files (max 5 MB each, 30 MB combined), receive queue number (`LX-001`), read-only reopening |

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
4. This script creates:
   - `employee_profiles` table (with case-insensitive uniqueness constraint)
   - `queue_counter` table and atomic sequencer
   - `form_schemas` & `form_questions` tables for shared questionnaire builder
   - `client_links` table (cryptographically random tokens)
   - `client_submissions` table (with constraints and indexes)
   - `submission_files` and `status_history` tables
   - `team_messages` table (with Supabase Realtime publication)
   - `loopx-documents` private storage bucket (5 MB individual limit)
   - 28 granular Row Level Security (RLS) policies for Owner, Employee, and Public clients
   - `submit_client_intake` RPC function with server-side 5 MB individual & 30 MB combined file size validation

### Step 3: Connect the Frontend to Supabase
1. In Supabase, go to **Project Settings → API**.
2. Copy your **Project URL** and **anon / public** API key.
3. Open `.env` in `loopx-app` and paste them:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   VITE_SUPABASE_STORAGE_BUCKET=loopx-documents
   ```
4. Restart your application (`npm run dev`). The status indicator in the top navbar will update to **`● Supabase Live`**.

---

## 6. GitHub Setup & Cloudflare Pages Deployment

### Step 1: Push to GitHub
```bash
cd /Users/jagan/.gemini/antigravity/scratch/loopx-app

# Add remote and push to your private GitHub repository
git remote add origin https://github.com/<your-username>/loopx-app.git
git branch -M main
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
   - `OWNER_BCRYPT_HASH` = *(Your generated bcrypt hash)*
   - `EMPLOYEE_USERNAME` = `Jagan team`
   - `EMPLOYEE_BCRYPT_HASH` = *(Your generated bcrypt hash)*
   - `JWT_SECRET` = *(Your generated 48+ byte hex secret)*
   - `SESSION_MAX_AGE_SECONDS` = `28800`
   - `VITE_SUPABASE_URL` = *(Your Supabase URL)*
   - `VITE_SUPABASE_ANON_KEY` = *(Your Supabase Anon Key)*
   - `VITE_SUPABASE_STORAGE_BUCKET` = `loopx-documents`
5. Click **Save and Deploy**. Cloudflare Pages automatically compiles the frontend and deploys the Cloudflare Pages Functions in `functions/api/auth/*` as serverless edge workers.

---

## 7. Verification & Feature Checklist

- [x] **Zero Frontend Credential Exposure**: Production JS bundles audited — 0 passwords, 0 password hashes, 0 private keys.
- [x] **Server-Side Bcrypt Hashing**: Passwords stored and compared strictly on server via bcrypt cost factor 12.
- [x] **Server-Issued Sessions**: httpOnly, Strict SameSite, signed JWT sessions.
- [x] **Security Audit Suite**: 45 automated tests verifying auth, session tampering, permission boundaries, file limits, and CRUD operations.
- [x] **Pure Black, White & Lime Theme**: High-contrast minimal layout using `#000000`, white, and `#8ee326`.
- [x] **Official Logo**: Embedded directly in the navbar without distortion.
- [x] **Common Login**: Single login for Owner & Employee with automatic backend role detection.
- [x] **Zero Initial State**: 0 profiles, 0 submissions, 0 queue records, 0 chat messages.
- [x] **Employee Profiles**: Case-insensitive duplicate prevention; scalable to >10 employees without member limits.
- [x] **Management Controls**: Mandatory Edit and Delete actions with explicit confirmation dialogs (`ConfirmationModal.jsx`).
- [x] **Owner Storage Management**: Dedicated dashboard tab with real-time capacity meters, client file list, and single/bulk deletion.
- [x] **Updated Storage Limits**: 5 MB individual limit, 30 MB combined limit, verified on both frontend and backend.
- [x] **Shared Form Builder**: Google-Forms-style questionnaire builder supporting 9 question types with shared team persistence.
- [x] **Private Client Links**: Generated using cryptographically random tokens (no queue number at link creation).
- [x] **Atomic Queue Number**: Generates sequential IDs (`LX-001`, `LX-002`, etc.) upon client submission.
- [x] **Persistent Read-Only Reopening**: Clients can close and reopen the exact same link to check status; editing is strictly locked.
- [x] **Team Discussion**: Real-time internal messaging, @mentions, inline editing, and deletion.
- [x] **Cloudflare SPA Routing**: Configured with `public/_redirects` and Pages Functions in `functions/`.
