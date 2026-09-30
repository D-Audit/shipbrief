# ShipBrief API

The backend for ShipBrief: authentication, workspaces and roles, the release workflow, channel
publishing (changelog, email, in-app), AI writing, feedback and roadmap, analytics, integrations,
webhooks, API keys and billing.

Node.js + TypeScript + Express 5, PostgreSQL via Drizzle ORM, zod validation, pino logging.
A Postgres-backed job queue runs background work, so Redis isn't required.

## Quick start

Prerequisites: Node.js ≥ 20.11 (22+ recommended) and PostgreSQL 14+.

```bash
# 1. Install
cd backend && npm install

# 2. Configure
cp .env.example .env
# Set DATABASE_URL and ENCRYPTION_KEY (see the comments in .env.example).
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # → ENCRYPTION_KEY

# 3. Create the database (any Postgres works; example uses the local socket)
createdb shipbrief

# 4. Apply migrations
npm run db:migrate

# 5. (Optional) Seed the demo workspace — development only
npm run db:seed

# 6. Run the API (also runs the background worker in development)
npm run dev                      # http://localhost:4000/api/health

# 7. Run the web app (from the repository root, in another terminal)
cd .. && cp .env.example .env.local && npm run dev   # http://localhost:3000
```

### Demo accounts (seed)

`npm run db:seed` creates the **Acme** workspace (`is_dev_seed = true`) with releases, feedback,
roadmap, campaigns, 240 synthetic `@example.com` contacts and 60 days of analytics events.
All seeded users share the password **`shipbrief-dev-password`**:

| Email | Role |
| --- | --- |
| `don@shipbrief.dev` | Owner |
| `alex@shipbrief.dev` | Product Manager |
| `sam@shipbrief.dev` | Developer |
| `viewer@shipbrief.dev` | Viewer |

The seed refuses to run when `NODE_ENV=production`. `npm run db:reset` drops and re-migrates the
database (also refused in production).

### Emails in development

Without `RESEND_API_KEY`, the **log** email provider writes each message (including verification
and password-reset links) to the API log and records it as `logged` — never `sent`. Copy the link
from the log to verify an account locally.

## Email and sign-in setup

Everything below is optional in development: without credentials, emails are written to the API
log and the sign-in buttons for unconfigured providers are hidden. Replace `{APP_URL}` with your
web app URL (e.g. `http://localhost:3000` locally, `https://app.yourdomain.com` in production).

### Email (Resend)

1. Create an account at [resend.com](https://resend.com) and verify your sending domain
   (Domains → Add domain, then add the DNS records it shows).
2. Create an API key (API Keys → Create) and set `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to an address on that domain, e.g. `ShipBrief <no-reply@yourdomain.com>`.

Emails sent: email verification, welcome (after verification or first social sign-in), password
reset, password-changed security alert, team invitations, workspace notifications, and release
emails to your customers. Every send is recorded in `email_deliveries`.

### Sign in with Google

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create credentials
   → OAuth client ID → *Web application* (configure the consent screen first if asked).
2. Authorized redirect URI: `{APP_URL}/api/auth/oauth/google/callback`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### GitHub (sign-in and the GitHub integration)

1. [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
   → New OAuth App.
2. Homepage URL: `{APP_URL}`. Under **Redirect URIs** add both (GitHub matches them exactly;
   leave "Allow wildcard matching" and "Enable Device Flow" unchecked):
   - `{APP_URL}/api/auth/oauth/github/callback` (sign-in)
   - `{APP_URL}/api/integrations/github/callback` (repository integration)
3. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

Sign-in asks only for `read:user user:email`; connecting a repository asks for `repo` separately.

### GitLab, Linear and Jira integrations

| Provider | Where to create the app | Redirect URI | Scopes |
| --- | --- | --- | --- |
| GitLab | [User settings → Applications](https://gitlab.com/-/user_settings/applications) (self-managed: set `GITLAB_BASE_URL`) | `{APP_URL}/api/integrations/gitlab/callback` | `read_api`, `read_user` |
| Linear | [Settings → API → OAuth applications](https://linear.app/settings/api/applications/new) | `{APP_URL}/api/integrations/linear/callback` | `read` |
| Jira | [Atlassian developer console](https://developer.atlassian.com/console/myapps/) → OAuth 2.0 (3LO) | `{APP_URL}/api/integrations/jira/callback` | `read:jira-work`, `read:me`, `offline_access` |

Set the matching `*_CLIENT_ID` / `*_CLIENT_SECRET` pair, restart the API, and the provider's
**Connect** button becomes active on the Integrations page.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API with hot reload (+ embedded worker when `WORKER_MODE=embedded`) |
| `npm run dev:worker` | Standalone worker with hot reload |
| `npm run build` | Compile to `dist/` (includes SQL migrations) |
| `npm start` / `npm run start:worker` | Run the compiled API / worker |
| `npm run typecheck` (`lint`) | TypeScript strict check of `src/` and `tests/` |
| `npm test` | Integration tests against a real Postgres database |
| `npm run db:generate` | Generate a new SQL migration after editing `src/database/schema.ts` |
| `npm run db:migrate` / `db:migrate:prod` | Apply migrations (source / compiled) |
| `npm run db:seed` / `db:reset` | Development seed / reset |
| `npm run openapi` | Write `docs/openapi.json` (also served at `GET /api/docs/openapi.json`) |

Tests use the database in `TEST_DATABASE_URL` (default `postgresql:///shipbrief_test?host=/var/run/postgresql`);
it is reset at the start of each run. `TEST_LOG_LEVEL=error npm test` shows API errors while debugging.

## Architecture

```
src/
  app/            Express app assembly (security headers, parsers, auth, routes, errors)
  server/         HTTP entry point and graceful shutdown
  config/         Validated environment (the only place that reads process.env) and logger
  routes/         URL → middleware → controller wiring, with the permission each route needs
  controllers/    Thin HTTP adapters: parse input with zod, call a service, send the envelope
  validators/     zod schemas for every body, query and path parameter
  services/       Business rules, authorization-sensitive queries, transactions
  channels/       One publisher per delivery channel (changelog, email, in-app)
  ai/             Provider interface, Anthropic provider, dev provider, prompts and output schemas
  integrations/   External systems: email (Resend), storage (local/S3), billing (Stripe),
                  source providers (GitHub, GitLab, Linear, Jira), OAuth state
  jobs/, workers/ Postgres job queue, handlers and the worker loop
  database/       Drizzle schema, client, migrations, seed
  middleware/     Authentication, permissions, rate limiting, CSRF/origin checks, errors
  utils/          Crypto, HTML sanitization, SSRF guard, slugs, HTTP helpers
  docs/           OpenAPI generation
tests/            Integration tests (supertest + vitest, real Postgres)
```

Request flow: `route → requirePermission(...) → controller (zod parse) → service (workspace-scoped
queries in a transaction) → envelope`. Background work — email delivery, webhook delivery,
scheduled publishing, analytics roll-ups, cleanup — is enqueued in the same transaction as the change
that caused it (transactional outbox) and processed by the worker.

The web app talks to the API only through `src/lib/api/client.ts` and the typed services in
`src/lib/services`. Next.js rewrites `/api/*` to this server, so the session cookie is first-party.

## API conventions

Base path `/api`. Full reference: `GET /api/docs/openapi.json` (OpenAPI 3.1, generated from the
validators).

- **Envelope** — success: `{ "success": true, "data": …, "meta"?: { page, pageSize, total, hasMore } }`;
  error: `{ "success": false, "error": { "code", "message", "details"? }, "requestId" }`.
- **Auth** — the `sb_session` httpOnly cookie (web app), or `Authorization: Bearer sb_live_…` for
  `/api/v1/*`. State-changing cookie requests must carry a trusted `Origin`.
- **Pagination** — `?page=&pageSize=` (max 100) on list endpoints.
- **IDs** — UUIDs. A resource in another workspace is indistinguishable from a missing one (404).

### Error codes

| Status | Codes |
| --- | --- |
| 400 | `VALIDATION_ERROR` (with `details[]`), `INVALID_JSON`, `WEAK_PASSWORD`, `INVALID_RESET_TOKEN`, `NO_CHANNELS`, `SCHEDULE_IN_PAST`, `UNSUPPORTED_FILE`, `UNSAFE_FILE`, `FILE_TOO_LARGE`, `INVALID_URL`, … |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `API_KEY_REQUIRED`, `INVALID_API_KEY` |
| 402 | `PLAN_LIMIT_REACHED` |
| 403 | `FORBIDDEN`, `CSRF_REJECTED`, `WORKSPACE_REQUIRED`, `EMAIL_NOT_VERIFIED`, `RELEASE_LOCKED`, `INSUFFICIENT_SCOPE` |
| 404 | `RELEASE_NOT_FOUND`, `FEEDBACK_NOT_FOUND`, `ROADMAP_ITEM_NOT_FOUND`, `WORKSPACE_NOT_FOUND`, `ROUTE_NOT_FOUND`, … |
| 409 | `INVALID_STATUS_TRANSITION`, `EMAIL_TAKEN`, `SLUG_TAKEN`, `FEEDBACK_ALREADY_LINKED`, `CAMPAIGN_LOCKED`, `RELEASE_PUBLISHED`, … |
| 422 | `AI_REFUSED` |
| 429 | `RATE_LIMITED` (with `Retry-After`), `AI_RATE_LIMITED` |
| 5xx | `INTERNAL_ERROR` (never includes internals), `AI_UPSTREAM_ERROR`, `AI_TIMEOUT`, `AI_NOT_CONFIGURED`, `BILLING_NOT_CONFIGURED`, `INTEGRATION_NOT_CONFIGURED` |

## Roles

`owner`, `admin`, `product_manager`, `marketer`, `developer`, `viewer` — the full matrix lives in
`src/services/permissions.ts`. Highlights: viewers are read-only; developers and marketers draft and
submit; product managers, admins and owners approve and publish; marketers can schedule; developers,
admins and owners manage integrations, API keys and webhooks; only owners delete the workspace or
manage billing. Once a release is approved, only approvers can change its content.

## Release workflow

`draft → in_review → approved → (scheduled →) published → archived`, plus `in_review → draft`
(request changes) and `scheduled → approved` (unschedule). Anything else returns
`409 INVALID_STATUS_TRANSITION`. Publishing runs one publisher per selected channel inside a single
transaction and records a `release_publications` row per channel:

- **changelog** — visible on `/c/{workspace}` immediately;
- **in_app** — served to the What's New widget (per-visitor read state);
- **email** — creates or reuses a campaign and queues delivery to the release's audience.

Publishing also marks linked feedback and roadmap items as shipped, and emits `release.published` to webhooks.

## Security notes

- Passwords: scrypt (N=2¹⁵). Sessions, email tokens and API keys: only SHA-256 digests are stored.
  Integration tokens and webhook secrets: AES-256-GCM with `ENCRYPTION_KEY`.
- Cookies: httpOnly, SameSite=Lax, Secure in production; plus Origin checks on writes.
- Every tenant query filters by the actor's workspace; cross-workspace references in payloads are rejected.
- Rich text is sanitized on write (the web app renders it as HTML on public pages).
- Webhook targets must resolve to public addresses (checked again at connect time, against DNS rebinding);
  redirects aren't followed.
- Uploads are identified by content, not extension; SVGs with scripts/external refs are rejected and
  files are served with a sandboxing CSP.
- Rate limits (Postgres-backed, shared across instances) protect login, sign-up, password reset,
  AI, public writes, uploads and the v1 API.
- Logs are structured JSON with credential fields redacted.

## Configuration-dependent features

These are fully implemented but need credentials to operate for real:

| Feature | Needs | Without it |
| --- | --- | --- |
| AI writing | `ANTHROPIC_API_KEY` | Dev: deterministic stand-in labelled `dev-deterministic`. Prod: `503 AI_NOT_CONFIGURED` |
| Email delivery | `RESEND_API_KEY` + verified sending domain | Dev: messages logged, recorded as `logged`. Prod: deliveries recorded as `failed` |
| Billing | Stripe key, webhook secret, price IDs | Plan changes return `503 BILLING_NOT_CONFIGURED`; new workspaces get a 14-day Pro trial |
| Google sign-in | Google OAuth client | The button explains it isn't set up |
| GitHub / GitLab / Linear / Jira | OAuth app per provider | Cards show "Not set up for this installation yet" |
| S3 storage | `STORAGE_PROVIDER=s3` + bucket credentials | Local disk storage |
| Custom changelog domain | DNS + TLS routing at your edge | The domain is saved as `pending`; the changelog is served at `/c/{slug}` |
| Email open tracking | Provider webhooks (not wired) | Analytics counts deliveries, not opens |

## Production deployment

Run at least one API process (`WORKER_MODE=off`) and one worker process (`npm run start:worker`).
Both are stateless and can scale horizontally — job claiming uses `FOR UPDATE SKIP LOCKED` and
recurring jobs are de-duplicated. Put the API behind the web app's `/api` rewrite (or a reverse proxy
on the same site) and set `TRUST_PROXY` to the number of proxies in front of it. Run
`npm run db:migrate:prod` on each deploy before starting new processes.
