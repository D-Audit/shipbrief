# ShipBrief backend — implementation plan

Derived from an audit of the existing frontend (`src/lib/services/*`, `src/types/index.ts`,
every page under `src/app`). The backend is shaped around what the UI already does.

## Audit summary

| Frontend surface | Service calls (mock today) | Backend module |
| --- | --- | --- |
| Login / signup / check-email / reset / onboarding | `authService.*` | `auth`, `workspaces` |
| Overview | `overviewService.get` | `overview` (aggregate) |
| Releases list / editor / lifecycle / versions | `releaseService.*` | `releases`, `channels` |
| AI Studio, editor AI actions | `aiStudioService.*`, `aiService.*` | `ai` |
| Campaigns, audience targeting | `campaignService.*`, `audienceService.*` | `email`, `audiences`, `contacts` |
| Changelog manager + public changelog `/c/[workspace]` | `changelogService.*`, `publicEngagementService.*` | `changelog`, `public` |
| In-app widget / embed | `releaseService.list`, `widgetSettingsService.*` | `in-app`, `public widget` |
| Feedback list/detail/merge/clusters, public feedback dialog | `feedbackService.*` | `feedback` |
| Roadmap | `roadmapService.*` | `roadmap` |
| Analytics | `analyticsService.*` | `analytics` |
| Activity + notifications | `activityService.*` | `activity` |
| Integrations + migration import | `integrationService.*`, `migrationService.*` | `integrations`, `migrations` |
| Team | `teamService.*` | `team` (memberships, invitations) |
| API & webhooks | `apiService.*` | `api-keys`, `webhooks` |
| Branding (logo/favicon upload), settings | `brandingService.*`, `settingsService.*` | `workspaces`, `uploads` |
| Billing | `billingService.*` | `billing` |

Notes from the audit:

- The tenant is the **workspace** (the UI has no "project" concept; the widget "project ID" is the
  workspace's public key). No dead `projects` table is created.
- Roles come from the UI: `owner, admin, product_manager, marketer, developer, viewer`.
- Release workflow comes from the UI: `draft → in_review → approved → (scheduled →) published → archived`,
  `in_review → draft` (request changes), `scheduled → approved` (unschedule).
- Public pages call services from server components (`generateMetadata`) — the API client must
  work server-side (absolute internal URL) and client-side (same-origin `/api`).
- Three components import mock data directly; the topbar user and `/c/acme` link are hard-coded.

## Architecture

- `backend/` — standalone Node service: Express 5, TypeScript, Drizzle ORM on PostgreSQL, zod, pino.
- Next.js rewrites `/api/*` → backend, so the session cookie is first-party and CORS is not needed
  for the app. Public API (`/api/v1`, API-key auth) and widget endpoints allow cross-origin.
- Layers: `routes` (wiring) → `controllers` (HTTP in/out) → `services` (business rules, authz) →
  `database` (Drizzle). External providers live in `integrations/`, `ai/`, `email`, `storage`, `billing`.
- Background work: Postgres-backed job queue (`jobs` table, `FOR UPDATE SKIP LOCKED`) processed by
  `worker` (separate process in production, embedded in dev). Used for scheduled publishing, email,
  webhook delivery + retries, analytics roll-ups, notification email.
- Rate limiting: Postgres-backed fixed windows (shared across instances, no Redis dependency).

## Provider policy (never fake)

- AI: `anthropic` when `ANTHROPIC_API_KEY` is set; `dev` deterministic provider only when explicitly
  selected outside production; otherwise `503 AI_NOT_CONFIGURED`.
- Email: `resend` when configured; `log` provider in development records deliveries as `logged`, never `sent`.
- Storage: `local` disk (dev) or `s3`.
- Billing: Stripe via REST when configured; otherwise plan changes return `BILLING_NOT_CONFIGURED`.
- Integrations: OAuth per provider when client credentials are configured; otherwise `INTEGRATION_NOT_CONFIGURED`.
