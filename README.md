# BEDROOM POP (Nocturne)

BEDROOM POP (Nocturne) is a full-stack, music-centered social listening application with a warm, intimate bedroom-pop aesthetic (fairy lights, polaroids, and 2am demos). It integrates curated music mixes, podcasts, a song diary, mood check-ins, music-based discovery, community feeds, and unified external media search.

---

## 🏗️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, React Router, Vanilla CSS modules / modern styling.
- **Backend:** Node.js, Express 5, Node ESM (`"type": "module"`).
- **Database:** PostgreSQL hosted on Supabase (connecting via the Supabase Shared Pooler).
- **Authentication:** Supabase Auth + HTTP-only session cookies backed by signed JWTs and PostgreSQL session records.
- **Testing & Quality:** Node.js native test runner (`node --test`), Vitest, ESLint, TypeScript (`tsc`).
- **Containerization & Deployment:** Docker, Docker Compose, Render (`render.yaml`).

---

## 📋 Prerequisites

- **Node.js:** v20+ or v22+ (recommended)
- **npm:** v10+
- **PostgreSQL Database:** Supabase project or local PostgreSQL instance.

---

## ⚙️ Setup Steps

1. **Clone the repository & install dependencies:**
   ```sh
   git clone <repository-url>
   cd React
   npm ci
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```sh
   cp .env.example .env
   ```
   Fill in your PostgreSQL connection string and secret values in `.env`.

3. **Set up PostgreSQL & Run Migrations:**
   Create your PostgreSQL database (e.g. in Supabase or local Postgres) and execute `migrations.sql`:
   ```sh
   psql "$DATABASE_URL" -f migrations.sql
   ```

4. **Start Development Server:**
   ```sh
   npm run dev
   ```
   The backend API will run on `http://localhost:3001` (or configured port) and Vite frontend on `http://localhost:5173`.

---

## 🔑 Environment Variables (.env)

| Variable | Description | Required | Default / Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Supabase Shared Pooler recommended with `?pgbouncer=true`) | **Yes** | `postgresql://postgres.xxx:pass@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `JWT_SECRET` | Secret key for signing session tokens (minimum 32 characters) | **Yes** | `a-very-long-and-secure-secret-key-at-least-32-chars` |
| `PORT` / `API_PORT` | Port for the Express backend server | No | `3001` |
| `NODE_ENV` | Environment mode (`development` or `production`) | No | `development` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | No | `http://localhost:5173,http://localhost:4173` |
| `SUPABASE_URL` | Supabase project URL | No | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous public API key | No | `eyJhbGci...` |
| `VITE_SUPABASE_URL` | Frontend Supabase URL | No | `https://xyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Frontend Supabase anonymous key | No | `eyJhbGci...` |
| `TMDB_API_KEY` | The Movie Database (TMDB) API key for movie discovery & search | No | `your-tmdb-api-key` |
| `YOUTUBE_API_KEY` | YouTube Data API key for video search | No | `your-youtube-api-key` |
| `RESEND_API_KEY` | Resend API key for sending email verifications and notifications | No | `re_123456` |
| `EMAIL_FROM` | Sender address for transactional emails | No | `Nocturne <onboarding@resend.dev>` |

---

## 📜 Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start backend API server in development mode |
| `npm run build` | Run TypeScript typecheck and build frontend production bundle (`dist/`) |
| `npm run typecheck` | Run TypeScript compiler check (`tsc --noEmit`) |
| `npm run lint` | Run ESLint across the repository |
| `npm test` | Run backend Node test runner and frontend Vitest suite |
| `npm start` | Start the production server (`node backend/server.js`) |

---

## 🗂️ Project Structure

```text
React/
├── backend/               # Express API server, routes, database config, and services
│   ├── routes/            # API route handlers (auth, movies, music, playlists, social, discover, etc.)
│   ├── services/          # External API wrappers (Audius, Deezer, Librivox, TMDB, YouTube)
│   ├── db.js              # PostgreSQL pool setup and connection management
│   ├── server.js          # Express app initialization and endpoint routing
│   └── config.js          # Environment validation & startup configuration
├── migrations/            # Incremental SQL migration files (008 - 018)
├── migrations.sql         # Consolidated database schema migration script
├── src/                   # React frontend source code
│   ├── auth/              # Authentication context and route guards
│   ├── components/        # Reusable UI components, modals, player dock, error boundary
│   ├── lib/               # Frontend API clients and custom hooks
│   ├── routes/            # Page components (Home, Landing, MediaHub, Movies, Music, Playlists, etc.)
│   ├── styles/            # CSS stylesheets and theme tokens
│   └── App.tsx            # Main router and lazy-loaded route definitions
├── tests/                 # Backend node tests and Vitest frontend tests
├── Dockerfile             # Multi-stage Docker build configuration
├── docker-compose.yml     # Local Docker Compose setup
├── render.yaml            # Render deployment blueprint
└── package.json           # Dependencies and project scripts
```

---

## 🚀 Deployment

### Render (Recommended)
1. Fork or push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com/), click **New +** → **Blueprint** and select your repository.
3. Render will read `render.yaml` and configure the web service.
4. Set your production environment variables (`DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, etc.) in the Render dashboard.

### Docker & Docker Compose
To run via Docker locally:
```sh
docker-compose up --build
```

---

## 🛟 Troubleshooting

### 1. `ECONNREFUSED` or Database Connection Errors
- **Cause:** PostgreSQL is not running or `DATABASE_URL` is incorrectly configured.
- **Solution:** Verify that PostgreSQL is running and your `DATABASE_URL` in `.env` is correct. If using Supabase, make sure you use the **Shared Pooler** connection string (port `6543`) with `?pgbouncer=true`.

### 2. Missing Environment Variables (`[config] FATAL`)
- **Cause:** Required variables (`DATABASE_URL`, `JWT_SECRET`) are missing from `.env`.
- **Solution:** Copy `.env.example` to `.env` and fill in valid values. Ensure `JWT_SECRET` is at least 32 characters long.

### 3. Port in Use (`EADDRINUSE`)
- **Cause:** Port 3001 or 5173 is already occupied by another process.
- **Solution:** Stop other running instances or change the `PORT` variable in your `.env` file.
