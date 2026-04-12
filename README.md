# ATS Resume Builder AI

> AI-powered, ATS-optimized resume generation SaaS. Built with Next.js, Express, Turso, and OpenAI.

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
├── frontend/                    # Next.js 14 (App Router)
│   ├── app/
│   │   ├── api/auth/[...nextauth]/  # NextAuth handler
│   │   ├── dashboard/           # Dashboard page
│   │   ├── resumes/             # Resume list & editor
│   │   ├── new-resume/          # 5-step wizard
│   │   └── profile/             # Profile management
│   ├── components/
│   │   ├── ats/ATSPanel.tsx     # ATS score + keyword panel
│   │   ├── resume/ResumePreview.tsx  # Live resume preview
│   │   └── wizard/              # Step wizard components
│   └── lib/api.ts               # API client
│
├── backend/                     # Express + TypeScript
│   ├── routes/
│   │   ├── auth.ts              # Login, register, OAuth
│   │   ├── profile.ts           # CRUD user profile
│   │   ├── resumes.ts           # Resume CRUD + PDF
│   │   └── generate.ts          # AI generation endpoint
│   ├── services/
│   │   └── pdfService.ts        # Puppeteer PDF generation
│   ├── prompts/index.ts         # OpenAI prompt templates
│   ├── middleware/
│   │   ├── auth.ts              # JWT verification
│   │   └── errorHandler.ts      # Global error handler
│   └── server.ts                # Express app entry
│
├── database/
│   └── schema.sql               # Turso / SQLite schema
│
└── .env.example                 # All required env vars
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

# Frontend
cd frontend && npm install

# Backend
cd ../backend && npm install
```

### 2. Configure environment variables

```bash
# Frontend
cp frontend/.env.example frontend/.env.local

# Backend
cp backend/.env.example backend/.env
```

Edit both files with your credentials (see `.env.example` for all variables).

### 3. Set up the database

```bash
cd backend
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

### 5. Start dev servers

```bash
# Terminal 1 — Backend
cd backend && npm run dev
# → http://localhost:4000

# Terminal 2 — Frontend
cd frontend && npm run dev
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

### Option A: Docker Compose

```bash
docker-compose up --build
```

### Option B: Vercel

Deploy this repo as two separate Vercel projects:

1. **Frontend project**
2. **Backend project**

Use these Vercel settings:

- Frontend Root Directory: `frontend`
- Backend Root Directory: `backend`
- Frontend Framework Preset: `Next.js`
- Backend Framework Preset: `Express`

This repo includes:

- [frontend/vercel.json](/Users/vishalmahor/Documents/startup/ats-resume-builder/frontend/vercel.json)
- [backend/vercel.json](/Users/vishalmahor/Documents/startup/ats-resume-builder/backend/vercel.json)

Important:

- Set the frontend env `BACKEND_URL` and `NEXT_PUBLIC_API_URL` to your backend Vercel URL
- Set the backend env `FRONTEND_URL` to your frontend Vercel URL
- Add Turso and OpenAI env vars only to the backend project

### Option C: Other PaaS

- **Frontend** → Vercel (zero config for Next.js)
- **Backend** → Railway / Render / Fly.io
- **Database** → Turso

### Environment for production:
- Set `NODE_ENV=production`
- Use strong `JWT_SECRET` (32+ chars)
- Set `FRONTEND_URL` to your actual domain
- Configure CORS accordingly

---

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, Tailwind CSS, React |
| Auth | NextAuth.js (Google, GitHub, Email) |
| Backend | Node.js, Express, TypeScript |
| Database | Turso / libSQL |
| AI | OpenAI Responses API |
| PDF | Puppeteer |
| Validation | Zod |
| State | Zustand + SWR |

---

## 📄 License

MIT
