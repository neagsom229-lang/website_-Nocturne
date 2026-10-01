# Nocturne — BEDROOM POP

Nocturne is a music-centered social listening app with a bedroom-pop aesthetic.
It brings together curated mixes, podcasts, a song diary, mood check-ins,
music-based discovery, and an external media search and library.

**Live demo:** [https://<your-render-service>.onrender.com](https://<your-render-service>.onrender.com)

![Nocturne application screenshot](docs/images/nocturne-screenshot.png)

_Screenshot placeholder: add an application screenshot at
`docs/images/nocturne-screenshot.png`._

## Architecture

- **Frontend:** React, TypeScript, Vite, and React Router.
- **Backend:** Node.js and Express, serving the API and production frontend.
- **Database:** PostgreSQL hosted on Supabase. The server connects through the
  Supabase Shared Pooler using `DATABASE_URL`; migrations are in `migrations.sql`.
- **Media:** The app stores media metadata and provider URLs, not downloaded
  audio or video. YouTube Data API and iTunes Search API provide search results;
  embedded/provider players handle playback.
- **Deployment:** Docker web service on Render's free plan with PostgreSQL on
  Supabase. No Render persistent disk is required.
- **Authentication:** HTTP-only session cookie backed by signed JWTs and
  PostgreSQL session records.

## Features

- Curated music mixes and persistent player controls.
- Podcast shows, episodes, and a listen-later collection.
- Personal song diary, listening statistics, and mood tracking.
- Music-based profile discovery, matches, and chat.
- Search for videos, podcasts, and audio previews; save provider metadata to a
  personal media library.
- Responsive dashboard shell with grouped navigation and lazy-loaded routes.

## Local development

1. Copy `.env.example` to `.env`.
2. Create a PostgreSQL database and apply `migrations.sql`. For Supabase, use
   the Shared Pooler connection URI and include `pgbouncer=true`.
3. Set `DATABASE_URL` and a private `JWT_SECRET` of at least 32 characters in
   `.env`. Set `YOUTUBE_API_KEY` to enable YouTube video search.
4. Install dependencies and start the app:

   ```sh
   npm ci
   npm run dev
   ```

The web app is served by Vite during development, and the API listens on port
3001 by default. See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete Supabase +
Render setup and deployment verification checklist.

## Build and tests

```sh
npm run build
npm test
```

The production API integration test uses `TEST_DATABASE_URL`, or falls back to
`DATABASE_URL`, and expects the PostgreSQL schema to be migrated. GitHub Actions
runs the integration suite against a temporary PostgreSQL service.
