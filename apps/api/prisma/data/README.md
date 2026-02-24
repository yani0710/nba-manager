# NBA Real Data Files

To load real 1:1 rosters/contracts, copy these files and remove `.example` from the names:

- `players.nba.2025-26.json`
- `contracts.nba.2025-26.json`

Required format examples:

- `players.nba.2025-26.example.json`
- `contracts.nba.2025-26.example.json`

Then run:

```bash
npm run seed
```

The seed always loads real NBA teams. Players/contracts are loaded only when the JSON files exist.

## Auto Import

You can auto-generate these JSON files from BALLDONTLIE:

```bash
npm run import:nba
```

Requirements:

- set `BALLDONTLIE_API_KEY` in `apps/api/.env`
- optional: set `NBA_DATA_SEASON` (default `2025-26`)
