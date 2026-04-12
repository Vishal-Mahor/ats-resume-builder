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
| POST | `/api/generate-resume` | ✓ | AI resume generation |
| GET | `/api/resumes` | ✓ | List all resumes |
| GET | `/api/resumes/stats` | ✓ | Dashboard stats |
| GET | `/api/resumes/:id` | ✓ | Get resume |
| PUT | `/api/resumes/:id` | ✓ | Edit resume |
| DELETE | `/api/resumes/:id` | ✓ | Delete resume |
| GET | `/api/resumes/:id/pdf` | ✓ | Download resume PDF |
| GET | `/api/resumes/:id/cover-pdf` | ✓ | Download cover letter PDF |

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
