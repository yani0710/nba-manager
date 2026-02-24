# NBA Manager

React + Express + Prisma + PostgreSQL NBA manager project.

## Project Structure

```text
nba-manager/
  apps/
    api/   # Express + Prisma
    web/   # React + Vite
  docker-compose.yml
  package.json  # root helper scripts
```

## Prerequisites

- Node.js 18+ (recommended: latest LTS)
- npm
- Docker Desktop (for PostgreSQL via `docker compose`)

## Fresh Clone Setup (GitHub)

After cloning the repo, run these commands from the project root:

```bash
npm install
npm run setup
```

What `npm run setup` does:

- starts PostgreSQL with Docker
- creates `apps/api/.env` from `apps/api/.env.example` (if missing)
- installs API and web dependencies
- generates Prisma client
- pushes the Prisma schema to Postgres
- seeds the database

## Start the App (Development)

Run both API and web together from the root:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:api
npm run dev:web
```

Typical local URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`

## Daily Workflow (after first setup)

```bash
npm run db:up
npm run dev
```

Stop Postgres when needed:

```bash
npm run db:down
```

## Real NBA Data (Players and Contracts)

The seed always loads real NBA teams (all 30).

To auto-import real players/contracts:

1. Put your key in `apps/api/.env`:

```env
BALLDONTLIE_API_KEY="your_key_here"
```

2. Run:

```bash
npm --prefix apps/api run import:nba
npm --prefix apps/api run seed
```

If you hit API rate limits, import in chunks with cursor windows (PowerShell examples):

```powershell
$env:NBA_IMPORT_START_CURSOR="0"; npm --prefix apps/api run import:nba
$env:NBA_IMPORT_START_CURSOR="400"; npm --prefix apps/api run import:nba
$env:NBA_IMPORT_START_CURSOR="800"; npm --prefix apps/api run import:nba
npm --prefix apps/api run seed
```

Or add files manually:

- `apps/api/prisma/data/players.nba.2025-26.json`
- `apps/api/prisma/data/contracts.nba.2025-26.json`

Use the format from:

- `apps/api/prisma/data/players.nba.2025-26.example.json`
- `apps/api/prisma/data/contracts.nba.2025-26.example.json`

Then run:

```bash
npm --prefix apps/api run seed
```

You can run import + seed in one step:

```bash
npm --prefix apps/api run sync:nba
```

## Team Logos Folder

Save all team logos here:

- `apps/web/public/images/teams`

Use lowercase 3-letter filenames (for example `lal.png`, `bos.png`, `gsw.png`).
The UI loads logos from `/images/teams/<shortname>.png`.
