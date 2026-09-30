# BEDROOM POP deployment

## Database decision

This app uses SQLite, so the database file must live on storage that survives a
container restart and redeploy. The practical first deployment is **one Node
server with a persistent volume**:

- It keeps the current database and query code; no database migration or extra
  service is needed.
- A small persistent volume is usually the least expensive production option
  for this single-user-scale demo. Check the provider's current instance and
  disk pricing before creating it.
- SQLite is intentionally a **single-instance** setup. Do not scale the web
  service to multiple replicas or share its database file over a network file
  system. For multiple app instances, high write concurrency, or managed
  backups/availability, migrate to PostgreSQL (for example Neon or Supabase)
  before scaling.

Free container/serverless plans commonly use ephemeral filesystems. Do not run
this SQLite deployment on one of those plans without a persistent volume.
Vercel's serverless filesystem is not suitable for the SQLite file; use a
persistent-volume provider for this version, or migrate to hosted PostgreSQL
before deploying the API to Vercel.

## Required environment variables

| Variable | Required | Example / purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes | `production` enables secure cookies and serves `dist/`. |
| `JWT_SECRET` | Yes | A unique, random secret with at least 32 characters. Generate with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Never commit it. |
| `DATABASE_PATH` | Yes | Absolute path on the persistent volume, such as `/var/data/bedroom-pop.sqlite` (Render) or `/data/bedroom-pop.sqlite` (Docker/Railway). Production startup fails if it is missing. |
| `PORT` | Provider supplied | The HTTP port. The server also accepts `API_PORT` for local development. |
| `CORS_ORIGIN` | Optional | Comma-separated trusted browser origins. Same-origin requests are allowed automatically; add any separate frontend origin explicitly. |
| `TRUST_PROXY` | Optional | Set to `1` only when running behind one trusted HTTPS reverse proxy, as on Render. |

No external API keys are required by this deployment.

## Run in Docker Compose

1. Copy `.env.example` to `.env` and replace the placeholder `JWT_SECRET` with
   a generated secret. Keep `.env` private; it is ignored by Git.
2. Start the app with `docker compose up --build -d`.
3. Open `http://localhost:3001`. The database is stored in the named
   `nocturne-data` volume and survives container replacement.
4. Check `http://localhost:3001/api/health` for the server health response.
5. Stop the app with `docker compose down`. Do **not** add `-v` if you want to
   keep the database volume.

To make a database backup, stop writes and copy the SQLite database and its
WAL state using SQLite's online backup API or a SQLite-aware backup tool. Do
not copy only the main `.sqlite` file while WAL writes are active.

## Deploy to Render using a persistent disk

1. Push this repository to GitHub and create a Render **Web Service** from it.
2. Choose the **Docker** runtime so Render builds the included `Dockerfile`.
3. Select a paid service type that supports persistent disks, then add a
   persistent disk mounted at `/var/data`. Free web services do not provide a
   persistent disk for this database.
4. Add these environment variables in the Render service settings:
   - `NODE_ENV=production`
   - `DATABASE_PATH=/var/data/bedroom-pop.sqlite`
   - `JWT_SECRET=<a newly generated random secret>`
   - `TRUST_PROXY=1`
   - `CORS_ORIGIN=<the Render https://... service origin>`
5. Configure the health check path as `/api/health`. Render supplies `PORT`;
   the Express server listens on it.
6. Deploy and verify the health endpoint, register an account, then confirm the
   account still exists after a redeploy. Keep a separate backup of the volume.
7. Keep exactly one running instance while using SQLite. The disk is mounted to
   that instance and is not a shared multi-instance database.

When the public URL changes, update `CORS_ORIGIN` to the new origin and redeploy.
Same-origin requests are supported without this setting; it is still useful to
set it explicitly for the production domain.

## Deploy on Railway

1. Create a Railway service from the GitHub repository and deploy it using the
   Dockerfile.
2. Add a Railway volume mounted at `/data`.
3. Set `NODE_ENV=production`, `DATABASE_PATH=/data/bedroom-pop.sqlite`, a
   generated `JWT_SECRET`, and `CORS_ORIGIN` to the public app origin.
4. Ensure the service exposes its assigned `PORT`, then check `/api/health`.
5. Keep a single service replica for SQLite and use Railway's volume backup
   options where available.

Check current Railway volume and service pricing before deploying; a nominally
free application tier does not make ephemeral database storage durable.

## CI

GitHub Actions runs `npm ci`, the production frontend build, and the production
server integration tests for pushes and pull requests targeting `main`. These
tests create their own temporary SQLite database and secret; production secrets
are not needed in GitHub Actions.
