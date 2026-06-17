# VastuVerse — Monorepo

AI-powered house planning web app for the Indian market.
Stack: **MERN** (MongoDB · Express · React · Node) + **Material UI v5**.

## Structure

```
vastuverse/
├── docker-compose.yml          # client · server · mongo · redis · ollama
├── .gitignore
├── client/                     # Vite + React 18 + MUI v5
│   ├── Dockerfile
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js          # dev server on :3000, host:true
│   ├── .env.example
│   ├── public/
│   │   └── locales/            # react-i18next translation files
│   │       ├── en/ hi/ bn/ ta/ te/ mr/ gu/ kn/  (translation.json)
│   └── src/
│       ├── main.jsx            # ThemeProvider > Router > App
│       ├── App.jsx             # route shell (scaffold placeholder at "/")
│       ├── index.css           # Google Fonts + resets
│       ├── assets/
│       ├── components/
│       ├── context/            # ThemeContext.jsx
│       ├── hooks/
│       ├── i18n/
│       ├── pages/              # HomePage.jsx
│       ├── services/
│       ├── theme/              # themeConfig.js
│       └── utils/
└── server/                     # Node + Express (CommonJS)
    ├── Dockerfile
    ├── package.json
    ├── .env.example            # ALL env vars (no real values)
    ├── uploads/                # runtime file storage
    └── src/
        ├── index.js            # entry stub (boots Express + /health)
        ├── config/
        ├── controllers/
        ├── middlewares/
        ├── models/
        ├── routes/
        ├── services/
        ├── queues/
        ├── prompts/
        └── utils/
```

## Setup (local, without Docker)

```bash
# client
cd client
npm install
cp .env.example .env        # optional; defaults work for local dev
npm run dev                 # http://localhost:3000

# server (new terminal)
cd server
npm install
cp .env.example .env        # fill in secrets
npm run dev                 # http://localhost:5000/api/v1/health
```

## Setup (Docker)

```bash
cp server/.env.example server/.env   # required: docker-compose reads server/.env
docker compose up --build
```

Services: client :3000 · server :5000 · mongo :27017 · redis :6379 · ollama :11434

## Notes

- **Particle deps for the homepage:** `src/pages/HomePage.jsx` (from the previous
  build step) uses `react-tsparticles` + `tsparticles-slim`, which are **not** in
  the client install list for this scaffold step. To render the real homepage at
  `/`, install them and swap the placeholder route in `src/App.jsx`:
  ```bash
  cd client && npm install react-tsparticles tsparticles-slim
  ```
- Versions are pinned to **React 18 / MUI v5** to match the declared stack and the
  homepage code (the npm registry currently ships React 19 / MUI v9, which would
  break that code).
- `server/src/index.js` is a boot stub only — no controllers, models, or queues yet.
```
