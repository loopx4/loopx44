# LOOPX — Client Onboarding & Project Management Portal

> **Minimal, high-contrast, professional LoopX management application.**  
> Built with **React + Vite**, pure CSS design system, **Supabase** backend & real-time chat, and configured for **Cloudflare Pages** deployment.

---

## 1. Quick Start (Run Locally)

```bash
# 1. Navigate to the project directory
cd /Users/jagan/.gemini/antigravity/scratch/loopx-app

# 2. Start the local Vite development server
npm run dev
```

The application will start on **`http://localhost:3000`**.

To run automated tests:
```bash
npm test
```

To create a production build:
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
├── src/
│   ├── components/
│   │   ├── Navbar.jsx           # Global sticky top navigation with logo & status indicator
│   │   ├── ProfileSelector.jsx  # Employee profile creation & case-insensitive selection
│   │   ├── SubmissionDetailModal.jsx # Full-detail viewer with status updates & audit trail
│   │   └── TeamDiscussion.jsx   # Shared internal team discussion with @mentions & replies
│   ├── config/
│   │   └── auth.config.js       # Centralized, editable credentials configuration
│   ├── context/
│   │   └── AuthContext.jsx      # Session management and role-based access controller
│   ├── pages/
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
│   └── loopx.test.js            # Automated unit and integration tests (Vitest)
├── .env.example                 # Environment template with clearly labeled sections
├── .env                         # Active local configuration (git-ignored)
├── package.json                 # Project dependencies & scripts
├── vite.config.js               # Vite bundler & test configuration
└── README.md                    # Project documentation & operational handbook
```

---

## 3. Where to Edit Credentials in VS Code

You can easily change credentials in either of two locations:

### Option A: Direct Configuration File
Open **`src/config/auth.config.js`** in VS Code:
- **Section 1 (Lines 14–26)**: Edit Owner `username` and `password`.
- **Section 2 (Lines 31–43)**: Edit Employee `username` and `password`.

### Option B: Local Environment File
Open **`.env`** in VS Code:
```env
# 1. OWNER CREDENTIALS
VITE_OWNER_USERNAME=Jagan
VITE_OWNER_PASSWORD=12345678910

# 2. EMPLOYEE CREDENTIALS
VITE_EMPLOYEE_USERNAME=Jagan team
VITE_EMPLOYEE_PASSWORD=123456789
```

---

## 4. Initial Credentials Reference

| Role | Username | Password | Post-Login Landing View |
| :--- | :--- | :--- | :--- |
| **Owner** | `Jagan` | `12345678910` | **Owner Dashboard** (Full metrics, all submissions, employee work counts) |
| **Employee** | `Jagan team` | `123456789` | **Profile Selection** (Select or create employee name to enter workspace) |

*The login page automatically detects whether the authenticated user is the Owner or an Employee and routes accordingly.*

---

## 5. Supabase Setup & Connection Guide

### Step 1: Create a Free Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create an account.
2. Click **New Project** and name it `loopx`.
3. Choose a strong database password and select your closest region.

### Step 2: Apply the Database Schema
1. In your Supabase dashboard, navigate to the **SQL Editor** (icon on left menu).
2. Click **New Query**.
3. Open `supabase/schema.sql` from this repository, copy its entire contents, paste it into the SQL Editor, and click **Run**.
4. This creates:
   - `employee_profiles` table (with case-insensitive uniqueness index)
   - `queue_counter` table and `get_next_queue_number()` atomic sequencer
   - `client_links` table (secure random tokens)
   - `client_submissions` table (with constraints and indexes)
   - `submission_files` and `status_history` tables
   - `team_messages` table (with Supabase Realtime publication)
   - `loopx-documents` private storage bucket
   - Row Level Security (RLS) policies

### Step 3: Connect the Frontend to Supabase
1. In Supabase, go to **Project Settings → API**.
2. Copy your **Project URL** and **anon / public** API key.
3. Open `.env` in `loopx-app` and paste them:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   VITE_SUPABASE_STORAGE_BUCKET=loopx-documents
   ```
4. Restart your Vite dev server (`npm run dev`). The status indicator in the top navbar will update to **`● Supabase Live`**.

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
4. In **Environment Variables**, add:
   - `VITE_OWNER_USERNAME` = `Jagan`
   - `VITE_OWNER_PASSWORD` = `12345678910`
   - `VITE_EMPLOYEE_USERNAME` = `Jagan team`
   - `VITE_EMPLOYEE_PASSWORD` = `123456789`
   - `VITE_SUPABASE_URL` = *(Your Supabase URL)*
   - `VITE_SUPABASE_ANON_KEY` = *(Your Supabase Anon Key)*
5. Click **Save and Deploy**. Cloudflare Pages will build and host your application globally with free SSL and custom domain support!

---

## 7. Verification & Feature Checklist

- [x] **Pure Black, White & Lime Theme**: High-contrast minimal layout using `#000000`, white, and `#8ee326`.
- [x] **Official Logo**: Embedded directly in the navbar from the provided asset.
- [x] **Common Login**: Single login for Owner & Employee with automatic role detection.
- [x] **Zero Initial State**: 0 profiles, 0 submissions, 0 queue records, 0 chat messages.
- [x] **Employee Profiles**: Case-insensitive duplicate prevention; selection attributed to all actions.
- [x] **Private Client Links**: Generated using cryptographically random tokens (no queue number at link creation).
- [x] **Intake Form**: All 10 required fields and multi-file attachment support.
- [x] **Atomic Queue Number**: Generates sequential IDs (`LX-001`, `LX-002`, etc.) upon client submission.
- [x] **Persistent Read-Only Reopening**: Clients can close and reopen the exact same link to check status; editing is strictly locked.
- [x] **Owner Dashboard**: 4 clickable summary cards that open actual filtered submission lists; status distribution chart; employee breakdown.
- [x] **Team Discussion**: Real-time internal messaging, @mentions, and replies.
- [x] **Cloudflare SPA Routing**: Configured with `public/_redirects`.
