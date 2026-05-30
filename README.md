# FFXIV Hunt Tracker

A small React + Vite app for tracking Final Fantasy XIV hunt marks. Hunt data is
loaded at runtime from [`public/data.json`](public/data.json), and each hunt's
status (To do → In progress → Done) is toggleable and persisted to
`localStorage`.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Data

Edit `public/data.json` to change the tracked hunts. The app reads it from
`/data.json` at runtime, so no rebuild is required for data-only changes.

## Stack

- React 18
- Vite 5
- Deployed on Vercel
