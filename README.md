# FFXIV Tracker

FFXIV Tracker is a web companion for Final Fantasy XIV hunts, gathering, fishing, crafting, and AI-assisted item lookup. The project combines fast public database search with a login-gated AI experience for users who want richer guidance, craft planning, and account-synced tools.

Production:

- Frontend: https://ffxivlog.com
- API: https://api.ffxivlog.com
- Repository: https://github.com/Aniond/FFXIV-TRACKER

## Current Features

### Universal Search

- Instant client-side search across hunts, gathering nodes, fish, recipes, and ingredients.
- Typo-tolerant matching for common misspellings and compact shorthand.
- Deep links from search results to the most useful page for the item, mark, recipe, or source.
- Guest-friendly search path for users who do not need the AI assistant.

### Centurio AI

- Natural-language assistant for hunt, gathering, fishing, and crafting questions.
- Login-gated access model designed to control usage and reduce abuse.
- Admin preview and public rollout controlled by backend feature flags.
- AI result summaries with linked item names so users can jump directly to source pages.
- Structured result cards for hunts, mining, botany, fishing, ingredients, and recipes.
- Search history with clear-history support and per-item removal.

### Craft Planning

- AI-assisted craft plan MVP for recipe queries.
- Ingredient source grouping for gather, fish, buy, market fallback, and subcraft steps.
- Progress tracking for craft plan ingredients.
- Add-to-list flow for recipes and craft plans.
- Copyable craft checklist.
- Shopping list drawer with synced checked state.

### Item Pages and Crosslinks

- Canonical item pages for gathered, fished, crafted, purchased, and recipe-used items.
- Recipe ingredients link to item pages instead of dead-end text.
- Item pages show known sources, purchase details, recipe usage, and relevant gathering links.
- Gathering and fishing entries support highlight links from search, AI, and item pages.

### Hunts

- Hunt board for S-rank, A-rank, and B-rank marks.
- Filters for rank, type, completion status, and search text.
- Card and table views.
- Discord login for account-synced progress.
- Local storage fallback for unauthenticated users.
- Public profile route and demo profile support.

### Gathering and Fishing

- Mining, botany, and fishing logs.
- Collapsed database-entry layout for cleaner scanning.
- Mobile-conscious formatting for dense data pages.
- Timed node and fish-window handling with Eorzea time utilities.
- Favorite node support for dashboard workflows.

### Account and Sync

- Discord OAuth login.
- JWT-backed authenticated API requests.
- Account-synced hunt progress, preferences, saved state, shopping list, and checked items.
- Local storage fallback where account sync is not available.

### Admin and Operations

- Admin dashboard and protected admin routes.
- Hunt management endpoints.
- Feature flag endpoint for controlled AI rollout.
- Scheduled backend jobs.
- Health endpoint at `/health`.

## Technology Stack

- Frontend: React 18, Vite, plain CSS
- Backend: Express, Node.js
- Database: PostgreSQL
- Authentication: Discord OAuth2, JWT
- Deployment: Vercel frontend, Railway backend and database
- AI provider configuration: `GEMINI_API_KEY`

## Project Structure

```text
src/
  AISearch.jsx              AI search page, craft plan UI, shopping-list integration
  UniversalSearch.jsx       Public instant search component
  universalIndex.js         Client-side search index and ranking
  ItemPage.jsx              Canonical item page
  itemCatalog.js            Cross-source item catalog
  Mining.jsx                Mining log
  Botany.jsx                Botany log
  Fishing.jsx               Fishing log
  App.jsx                   Hunt board and dashboard shell

backend/
  index.js                  Express app wiring
  ai/search.js              AI search endpoint
  routes/                   Auth, users, hunts, recipes, prices, admin
  scripts/                  Data build, scrape, migration, audit, and seed tools
  schema.sql                Database schema
```

## Development

Install and run the frontend:

```bash
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

Install and run the backend:

```bash
cd backend
npm install
node index.js
```

Default backend URL:

```text
http://localhost:3001
```

Copy `backend/.env.example` to `backend/.env` and set the required values:

```text
DATABASE_URL
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_CALLBACK_URL
JWT_SECRET
FRONTEND_URL
PORT
ADMIN_DISCORD_ID
GEMINI_API_KEY
```

## Verification

Run the standard frontend checks:

```bash
npm test
npm run lint
npm run build
```

The test suite covers:

- Eorzea time and weather helpers
- Fishing windows
- Data catalog integrity
- Canonical item catalog behavior
- Recipe source coverage
- State sync codecs
- Universal search ranking, typo handling, and duplicate collapse

## Data and Admin Workflows

Hunt data is stored in PostgreSQL and served by:

```text
GET /api/hunts
```

Admin hunt endpoints require the configured admin authorization flow:

```text
POST /api/hunts
PATCH /api/hunts/:id
DELETE /api/hunts/:id
```

To reseed hunts:

```bash
node backend/scripts/seed-hunts.js
```

Schema lives in:

```text
backend/schema.sql
```

## Product Direction

The long-term direction is an AI-driven FFXIV assistant backed by structured game databases. The public site should stay useful for fast lookup and discovery, while the logged-in AI experience becomes the primary intelligent layer for planning, sourcing, craft preparation, and personalized progress.

The guiding split is:

- Public experience: fast searchable database pages with low friction.
- Authenticated experience: AI-driven guidance, saved plans, synced progress, and controlled usage.
