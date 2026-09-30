# ShipBrief

Release communication for product teams: draft releases (with AI help), take them through review,
and publish to a public changelog, email and an in-app What's New widget — then close the loop with
feedback, roadmap and analytics.

The repository holds two apps:

| Path | What | Stack |
| --- | --- | --- |
| `/` | Web app (marketing site, dashboard, public changelog, widget) | Next.js 16, React 19 |
| `/backend` | API + background worker | Express 5, PostgreSQL (Drizzle), TypeScript |

## Run locally

```bash
# API (see backend/README.md for details and demo accounts)
cd backend
npm install
cp .env.example .env            # set DATABASE_URL and ENCRYPTION_KEY
npm run db:migrate
npm run db:seed                 # optional demo workspace
npm run dev                     # http://localhost:4000

# Web app, in a second terminal
cd ..
npm install
cp .env.example .env.local
npm run dev                     # http://localhost:3000
```

Sign in with `don@shipbrief.dev` / `shipbrief-dev-password` after seeding, or create an account —
in development, verification emails are written to the API log.

The browser only talks to `/api/*` on the web origin; Next.js proxies those requests to the API
(`API_INTERNAL_URL`), so the session cookie stays first-party.

## Checks

```bash
npm run lint && npx tsc --noEmit && npm run build          # web app
cd backend && npm run typecheck && npm test && npm run build
```

API reference: `http://localhost:4000/api/docs/openapi.json`. Architecture, security model and the
list of configuration-dependent features: [`backend/README.md`](backend/README.md).
