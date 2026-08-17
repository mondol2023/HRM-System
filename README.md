# HRM System — AI-Powered HR Management

A human resources management system with AI-assisted resume parsing,
performance-note sentiment analysis, and employee attrition-risk
prediction (OpenAI GPT-4o-mini).

> **Status:** active development. See [PROJECT_PLAN.md](./PROJECT_PLAN.md)
> for what's done, what's broken, and the roadmap — it's the source of
> truth for project status, not this file.

## Tech stack

| | |
|---|---|
| Backend | Node.js, Express, TypeScript, MongoDB (Mongoose), Redis, Bull (job queue), JWT auth, OpenAI API |
| Frontend | React 19, TypeScript, Vite, axios, react-router-dom, recharts |
| Infra (planned) | Docker Compose, GitHub Actions — see [PROJECT_PLAN.md](./PROJECT_PLAN.md#phase-4--devops--ci-cd) |

## Prerequisites

- Node.js 20+
- MongoDB (local install or a connection string to a hosted instance)
- Redis (local install or a hosted instance)
- An OpenAI API key (for the AI features — resume parsing, sentiment,
  attrition prediction)

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env    # then fill in MONGO_URI, JWT_SECRET, OPENAI_API_KEY, etc.
npm run dev              # http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env    # defaults to http://localhost:5000/api/v1, adjust if needed
npm run dev              # http://localhost:5173
```

Both apps need their own `.env` — see `backend/.env.example` and
`frontend/.env.example` for the full list of variables.

> **Note:** as of this writing, the frontend's routing/auth wiring is a
> known in-progress gap — see [PROJECT_PLAN.md §4](./PROJECT_PLAN.md#4-frontend--module-status)
> before expecting `npm run dev` to show anything past the Vite starter
> screen.

## Scripts

**Backend** (`backend/package.json`):

| Script | Purpose |
|---|---|
| `npm run dev` | Start with hot-reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build (`dist/server.js`) |
| `npm run lint` | Lint (config not set up yet — see plan) |
| `npm run seed` | Seed sample data (script not written yet — see plan) |

**Frontend** (`frontend/package.json`):

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview the production build locally |

## Project structure

```
HRM-System/
├── backend/
│   └── src/
│       ├── config/          # db, redis, logger
│       ├── middleware/      # auth, validation, rate limiting, error handling
│       ├── modules/
│       │   ├── auth/        # register / login / me / change-password
│       │   ├── employee/    # employee CRUD, stats, performance notes
│       │   └── ai/          # resume parsing, sentiment, attrition (OpenAI + Bull queue)
│       ├── types/           # shared TS interfaces
│       ├── app.ts           # Express app assembly
│       └── server.ts        # bootstrap + graceful shutdown
└── frontend/
    └── src/
        ├── api/              # axios instance
        ├── context/          # AuthContext
        ├── components/       # Layout, EmployeeCard, ResumeParser
        └── pages/            # Login, Dashboard, Employees, AIInsights
```

## API overview

All routes are prefixed `/api/v1`. Auth is a JWT in an httpOnly cookie
(`accessToken`), with a `Bearer` header accepted as a fallback.

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Create an account (always as `employee`) |
| POST | `/auth/login` | Public | Log in |
| POST | `/auth/logout` | Authenticated | Log out |
| GET | `/auth/me` | Authenticated | Current user |
| PATCH | `/auth/change-password` | Authenticated | Change password |
| GET | `/employees` | admin, hr, manager | Paginated employee list |
| GET | `/employees/stats` | admin, hr | Dashboard aggregates |
| GET | `/employees/:id` | self / admin / hr / manager-of-report | Single employee |
| POST | `/employees` | admin, hr | Create employee |
| PATCH | `/employees/:id` | admin, hr | Update employee |
| DELETE | `/employees/:id` | admin | Soft-terminate (sets status, doesn't delete the record) |
| POST | `/employees/:id/notes` | admin, hr, manager | Add a performance note (queues async sentiment + attrition analysis) |
| POST | `/ai/parse-resume` | admin, hr | Upload a PDF/TXT resume, get structured data back |
| POST | `/ai/sentiment` | admin, hr, manager | Analyze sentiment of arbitrary text |

A full OpenAPI spec is on the roadmap — see
[PROJECT_PLAN.md, Phase 5](./PROJECT_PLAN.md#phase-5--observability--production-readiness).

## Contributing / code style

- Feature-module structure (`controller` → `service` → `model`/`schema`) —
  keep new features (e.g. a future `payroll` module) in the same shape.
- Validate all external input with Joi at the route boundary
  (`middleware/validate.middleware.ts`); don't re-validate deeper in.
- Throw `AppError(message, statusCode)` for expected failures; let the
  global error handler format the response.
- Keep comments short — say *why*, not *what the code already says*.

## License

Not yet decided — add one before any external release.
