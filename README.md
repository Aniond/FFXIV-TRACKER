# FFXIV Hunt Tracker — Centurio Ledger

Track Final Fantasy XIV hunt marks, manage your Sacks of Nuts stash, and sync progress across devices with Discord login.

## Stack

- **Frontend** — React 18 + Vite, deployed on Vercel (`ffxivlog.com`)
- **Backend** — Express on Railway (`api.ffxivlog.com`)
- **Database** — PostgreSQL on Railway
- **Auth** — Discord OAuth2 → JWT

## Development

```bash
# Frontend
npm install
npm run dev        # http://localhost:5173
npm run build
npm run preview

# Backend
cd backend
npm install
node index.js      # http://localhost:3001
```

Copy `backend/.env.example` to `backend/.env` and fill in the required values.

## Data

Hunt data lives in the `hunts` PostgreSQL table and is served by `GET /api/hunts`.
To add or update hunts, use the admin endpoints (requires `API_SECRET` bearer token):

- `POST /api/hunts` — add a hunt
- `PATCH /api/hunts/:id` — update a hunt
- `DELETE /api/hunts/:id` — remove a hunt

To reseed the database from scratch: `node backend/scripts/seed-hunts.js`

## Database

Schema is in `backend/schema.sql`. To apply it to a new database:

```bash
railway run node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const fs=require('fs');
p.query(fs.readFileSync('backend/schema.sql','utf8')).then(()=>{console.log('ok');p.end()});
"
```
