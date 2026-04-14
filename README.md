# ATS Resume Builder AI

> AI-powered, ATS-optimized resume generation SaaS. Built with Next.js, Turso, and OpenAI.

## ✨ Features

- **AI Resume Generation** — OpenAI analyzes JDs, matches your profile, generates tailored bullets with strong action verbs and metrics
- **ATS Score** (0–100) with matched/missing keyword analysis
- **Split-screen editor** — edit left, live preview right
- **Cover letter generator** — formal, modern, or aggressive tone
- **PDF download** — clean, ATS-friendly single-column format
- **Resume history** — track companies, roles, scores, dates
- **Multi-auth** — Google, GitHub, or email/password
- **Persistent profiles** — your experience saved, not re-entered each time

---

## 🏗 Project Structure

```
ats-resume-builder/
├── app/
│   ├── api/                     # Route handlers for auth, profile, resumes, PDF, AI
│   ├── auth/                    # Sign-in and auth error pages
│   ├── dashboard/               # Dashboard page
│   ├── resumes/                 # Resume list & editor
│   ├── new-resume/              # 5-step wizard
│   └── profile/                 # Profile management
├── components/
│   ├── ats/ATSPanel.tsx         # ATS score + keyword panel
│   ├── resume/ResumePreview.tsx # Live resume preview
│   └── wizard/                  # Step wizard components
├── lib/
│   ├── api.ts                   # Browser API client
│   └── server/                  # DB, auth, AI prompts, PDF generation
├── scripts/
│   └── migrate.mjs              # Database migration runner
├── database/
│   └── schema.sql               # Turso / SQLite schema
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js 20+
- A Turso database URL + auth token, or a local `file:` libSQL database for quick development
- An OpenAI API key ([platform.openai.com](https://platform.openai.com))

### 1. Clone & install

```bash
git clone https://github.com/you/ats-resume-builder.git
cd ats-resume-builder

npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials (see `.env.example` for all variables).

### 3. Set up the database

```bash
npm run db:migrate
```

If you already have an existing database, run the profile extension SQL in:

`database/profile-schema-update.sql`

This adds:

- `users.email_verified_at`
- `profiles.phone_verified_at`
- `profiles.location_verified_at`
- `profiles.achievements`
- `profiles.languages`
- `profiles.hobbies`
- `verification_codes`
- `resume_templates`
- `resumes.template_id`
- `user_settings`

### 4. Set up OAuth (optional but recommended)

**Google:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add `http://localhost:3000/api/auth/callback/google` as redirect URI

**GitHub:**
1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Create OAuth App
3. Set callback URL: `http://localhost:3000/api/auth/callback/github`

### 5. Start the app

```bash
npm run dev
# → http://localhost:3000
```

---

## 🔌 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Email registration |
| POST | `/api/auth/login` | — | Email login |
| POST | `/api/auth/oauth` | — | OAuth exchange |
| GET | `/api/auth/me` | ✓ | Current user |
| GET | `/api/profile` | ✓ | Full profile + experience |
| PUT | `/api/profile` | ✓ | Update profile |
| GET | `/api/settings` | ✓ | Get the signed-in user's saved settings |
| PUT | `/api/settings` | ✓ | Save the signed-in user's settings |
| GET | `/api/templates` | ✓ | List active resume templates from DB |
| POST | `/api/generate-resume` | ✓ | AI resume generation |
| GET | `/api/resumes` | ✓ | List all resumes |
| GET | `/api/resumes/stats` | ✓ | Dashboard stats |
| GET | `/api/resumes/:id` | ✓ | Get resume |
| PUT | `/api/resumes/:id` | ✓ | Edit resume |
| DELETE | `/api/resumes/:id` | ✓ | Delete resume |
| GET | `/api/resumes/:id/pdf` | ✓ | Download resume PDF |
| GET | `/api/resumes/:id/cover-pdf` | ✓ | Download cover letter PDF |

## 👤 Profile Model

The profile page now supports:

- Name
- Email
- Phone
- Location
- LinkedIn
- GitHub
- Website / portfolio
- Professional summary
- Technical skills
- Soft skills
- Education
- Projects
- Work experience
- Languages
- Hobbies
- Achievements

Verification metadata currently stored in the schema:

- `users.email_verified_at`
- `profiles.phone_verified_at`
- `profiles.location_verified_at`

Current behavior:

- Email and phone verification use OTPs from the profile page inbox.
- Email changes reset `email_verified_at` until a new OTP is confirmed.
- Phone changes reset `phone_verified_at` until a new OTP is confirmed.
- Location verification timestamp is still reset on change, but no separate OTP flow is wired for location yet.

Environment variables for verification:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `TWILIO_ACCOUNT_SID` (`AC...` from your Twilio project)
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID` (`VA...` if you are using Twilio Verify)
- `TWILIO_FROM_PHONE` (required only when using the older direct SMS send flow instead of Twilio Verify)
- `TWILIO_DEFAULT_COUNTRY_CODE` (optional, for local numbers entered without `+countrycode`)

## 🧩 Template Source Of Truth

Resume templates are now stored in the database and should be read from there across the product.

- Table: `resume_templates`
- Resume linkage: `resumes.template_id`
- API source: `GET /api/templates`
- Current app behavior:
  - the default templates are auto-seeded into `resume_templates`
  - the templates page reads from the DB-backed API
  - the new resume page reads template options from the DB-backed API
  - generated resumes now store the chosen `template_id`
  - dashboard and settings template counts now come from DB-backed template data

## ⚙️ User Settings

Settings are now stored per user, not globally.

- Table: `user_settings`
- Keying model: one settings row per `user_id`
- API source: `GET /api/settings`
- API update: `PUT /api/settings`
- Saved groups:
  - general workspace defaults
  - notification preferences
  - export preferences
  - privacy preferences
- Current usage:
  - the settings page loads and saves each signed-in user's own settings
  - the new resume page uses the saved default source platform and default template

---

## 🧠 AI Pipeline

```
User submits JD
    │
    ▼
1. JD_ANALYSIS_PROMPT     → Extract keywords, skills, seniority, domain
    │
    ▼
2. MATCH_PROFILE_PROMPT   → ATS score, matched/missing keywords, suggestions
    │
    ▼
3. RESUME_GENERATION_PROMPT → Full ATS-optimized resume JSON
    │
    ▼
4. COVER_LETTER_PROMPT    → Personalized cover letter (tone: formal/modern/aggressive)
    │
    ▼
5. Store in DB (JD NOT stored)
    │
    ▼
6. Return to client for editing
```

---

## 🚢 Production Deployment

### Option A: Vercel

Deploy this repo as a single Vercel project.

Use these Vercel settings:

- Root Directory: `.`
- Framework Preset: `Next.js`

This repo includes:

- [vercel.json](/Users/vishalmahor/Documents/startup/repo%20insights/ats-resume-builder/vercel.json)

Important:

- Add the env vars from `.env.example` to the Vercel project
- Set `NEXTAUTH_URL` to your deployed app URL
- Add Turso and OpenAI env vars to the same project

### Option B: Other PaaS

- **App** → Vercel (recommended) / Railway / Render / Fly.io
- **Database** → Turso

### Environment for production:
- Set `NODE_ENV=production`
- Use strong `JWT_SECRET` (32+ chars)
- Set `NEXTAUTH_URL` to your actual domain

---

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| App | Next.js, Tailwind CSS, React |
| Auth | NextAuth.js (Google, GitHub, Email) |
| Server Runtime | Next.js Route Handlers + Node.js |
| Database | Turso / libSQL |
| AI | OpenAI Responses API |
| PDF | Puppeteer |
| Validation | Zod |
| State | Zustand + SWR |

---

## 📄 License

MIT
