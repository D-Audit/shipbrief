import { eq, sql } from "drizzle-orm";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { rollupAnalytics } from "../services/analytics.service.js";
import { createWorkspace } from "../services/workspace.service.js";
import type { Channel, ChannelVariantMap, ReleaseStatus, SourceRef } from "../types/domain.js";
import { hashPassword } from "../utils/crypto.js";
import { db, pool } from "./client.js";
import {
  activityEvents,
  analyticsEvents,
  audiences,
  campaigns,
  contacts,
  feedback,
  feedbackClusters,
  feedbackComments,
  invitations,
  memberships,
  publicComments,
  releasePublications,
  releases,
  releaseVersions,
  roadmapItems,
  users,
  webhooks,
  workspaces,
} from "./schema.js";
import { encryptSecret, randomToken } from "../utils/crypto.js";

/**
 * Development seed: the "Acme" demo workspace the UI was designed around.
 * Every row belongs to a workspace flagged `is_dev_seed`, users use
 * @shipbrief.dev addresses, and the script refuses to run in production.
 */
export const SEED_PASSWORD = "shipbrief-dev-password";
export const SEED_USERS = [
  { key: "don", name: "Don Jesus", email: "don@shipbrief.dev", role: "owner" },
  { key: "alex", name: "Alex Chen", email: "alex@shipbrief.dev", role: "product_manager" },
  { key: "sam", name: "Sam Rivera", email: "sam@shipbrief.dev", role: "developer" },
  { key: "vera", name: "Vera Lopez", email: "viewer@shipbrief.dev", role: "viewer" },
] as const;

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 60 * 60 * 1000);
const ahead = (days: number, hours = 0) => new Date(Date.now() + days * DAY + hours * 60 * 60 * 1000);

type SeedRelease = {
  key: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  status: ReleaseStatus;
  channels: Channel[];
  category: string;
  tags: string[];
  audience?: "all" | "pro" | "beta";
  publishedDaysAgo?: number;
  scheduledInDays?: number;
  createdDaysAgo: number;
  views?: number;
  reactions?: number;
  featured?: boolean;
  cta?: { label: string; url: string };
  sourceRefs?: SourceRef[];
  channelVariants?: ChannelVariantMap;
  media?: { id: string; type: "image" | "video"; url: string; alt?: string; caption?: string; posterUrl?: string }[];
};

const RELEASES: SeedRelease[] = [
  {
    key: "dark",
    title: "Dark Mode",
    slug: "dark-mode",
    summary: "A more comfortable way to use Acme at night and in low-light environments.",
    body: "<p>You can now switch between light and dark themes, follow your system preference, or set a default for your workspace.</p><ul><li>Switch themes from settings</li><li>Follow system theme automatically</li><li>Per-user preference saved</li></ul>",
    status: "published",
    channels: ["changelog", "email", "in_app"],
    category: "Feature",
    tags: ["ui", "accessibility"],
    audience: "all",
    publishedDaysAgo: 1,
    createdDaysAgo: 3,
    views: 842,
    reactions: 184,
    featured: true,
    cta: { label: "Try Dark Mode", url: "/settings/appearance" },
    sourceRefs: [{ id: "src_1", type: "github", label: "acme/app#482", url: "https://github.com" }],
    media: [
      { id: "media_dark_mode_workspace", type: "image", url: "/mock-dark-mode-workspace.svg", alt: "Acme workspace dashboard shown in dark mode", caption: "A calmer workspace that stays comfortable after hours." },
    ],
    channelVariants: {
      email: { channel: "email", title: "Dark mode is ready for your workspace", summary: "A calmer, lower-light way to work in Acme is ready whenever you are.", body: "<p>Hi there,</p><p>Dark mode is now available across your Acme workspace. Switch whenever you need a more comfortable view, or let Acme follow your system preference.</p><p>Thanks,<br />The Acme team</p>", subject: "Dark mode is ready for your workspace", previewText: "A calmer way to work in Acme, ready whenever you are." },
      in_app: { channel: "in_app", format: "feed", title: "Dark mode, ready when you are", summary: "A calmer way to use Acme in lower-light environments.", body: "<p>Choose dark mode in appearance settings, or let Acme follow your system preference.</p>" },
    },
  },
  {
    key: "reporting",
    title: "Advanced Reporting",
    slug: "advanced-reporting",
    summary: "Your reports just got a lot more powerful with custom filters and exports.",
    body: "<p>Build richer reports with multi-dimensional filters, saved views, and one-click CSV export.</p>",
    status: "published",
    channels: ["changelog", "in_app"],
    category: "Feature",
    tags: ["analytics", "reports"],
    publishedDaysAgo: 11,
    createdDaysAgo: 19,
    views: 621,
    reactions: 96,
    cta: { label: "Explore reporting", url: "/app/analytics" },
    sourceRefs: [{ id: "src_2", type: "linear", label: "ACM-142", url: "https://linear.app" }],
    channelVariants: {
      in_app: { channel: "in_app", format: "banner", title: "Build sharper reports with less setup", summary: "Advanced Reporting gives your team saved views, deeper filters, and exports when you need them.", body: "<p>Use the new reporting controls to focus on the metrics that matter, then save or export the view for your team.</p>" },
    },
  },
  { key: "permissions", title: "Team Permissions", slug: "team-permissions", summary: "Granular roles so the right people can review and publish updates.", body: "<p>Assign Owner, Admin, Product Manager, Marketer, Developer, or Viewer roles with approval workflows.</p>", status: "scheduled", channels: ["changelog", "email"], category: "Improvement", tags: ["team", "security"], audience: "pro", scheduledInDays: 1, createdDaysAgo: 7, sourceRefs: [{ id: "src_3", type: "manual", label: "Product brief" }] },
  { key: "csv", title: "CSV Export", slug: "csv-export", summary: "Export any table to CSV in one click.", body: "<p>Download filtered data from reports, feedback, and analytics views.</p>", status: "published", channels: ["changelog"], category: "Improvement", tags: ["export"], publishedDaysAgo: 24, createdDaysAgo: 29, views: 412, reactions: 52 },
  { key: "perf", title: "Performance Improvements", slug: "performance-improvements", summary: "Faster page loads and smoother interactions across the dashboard.", body: "<p>We reduced initial load time by 40% and optimized list rendering for large datasets.</p>", status: "draft", channels: ["changelog"], category: "Improvement", tags: ["performance"], createdDaysAgo: 1, sourceRefs: [{ id: "src_4", type: "github", label: "acme/app#501" }] },
  { key: "filters", title: "Saved Filters", slug: "saved-filters", summary: "Save and reuse filter combinations across feedback and analytics.", body: "<p>Build custom views once and return to them anytime. Share filters with your team.</p>", status: "in_review", channels: ["changelog", "in_app"], category: "Feature", tags: ["filters", "productivity"], createdDaysAgo: 2, sourceRefs: [{ id: "src_5", type: "linear", label: "ACM-198" }] },
  { key: "search", title: "Faster Search", slug: "faster-search", summary: "Search now returns results as you type, across reports, feedback and people.", body: "<p>Search is now instant. Results appear as you type and include reports, feedback requests and teammates in one list.</p><ul><li>Results in under 100ms for most workspaces</li><li>Jump to any result with the keyboard</li></ul>", status: "approved", channels: ["changelog", "in_app"], category: "Improvement", tags: ["search", "performance"], createdDaysAgo: 4, cta: { label: "Try the new search", url: "/search" }, sourceRefs: [{ id: "src_7", type: "github", label: "acme/app#512" }, { id: "src_8", type: "github", label: "acme/app#515" }] },
  { key: "slack", title: "Slack Notifications", slug: "slack-notifications", summary: "Get release and feedback updates in the Slack channels your team already uses.", body: "<p>Connect Slack to receive a message when a report finishes, a customer comments, or a teammate mentions you.</p>", status: "published", channels: ["changelog", "email"], category: "Integration", tags: ["slack", "notifications"], publishedDaysAgo: 35, createdDaysAgo: 40, views: 538, reactions: 71, cta: { label: "Connect Slack", url: "/settings/integrations" }, sourceRefs: [{ id: "src_9", type: "linear", label: "ACM-117" }] },
  { key: "shortcuts", title: "Keyboard Shortcuts", slug: "keyboard-shortcuts", summary: "Move through Acme without leaving the keyboard.", body: "<p>Press <strong>?</strong> anywhere to see every shortcut. Navigate lists, open records and create new items from the keyboard.</p>", status: "published", channels: ["changelog", "in_app"], category: "Improvement", tags: ["productivity", "accessibility"], publishedDaysAgo: 48, createdDaysAgo: 52, views: 377, reactions: 64, sourceRefs: [{ id: "src_10", type: "github", label: "acme/app#431" }] },
  { key: "audit", title: "Audit Log", slug: "audit-log", summary: "", body: "<p>Merged: add audit_events table, write events on role change and export, expose paginated endpoint /v2/audit.</p>", status: "draft", channels: ["changelog"], category: "Security", tags: ["security", "enterprise"], createdDaysAgo: 0, sourceRefs: [{ id: "src_11", type: "github", label: "acme/app#522" }, { id: "src_12", type: "linear", label: "ACM-230" }] },
];

async function seed() {
  if (config.isProduction) throw new Error("The development seed never runs in production.");

  const existing = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, "acme")).limit(1);
  if (existing[0]) {
    logger.info("Seed data already present (workspace 'acme'). Run `npm run db:reset` first to reseed.");
    return;
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const userIds: Record<string, string> = {};
  for (const user of SEED_USERS) {
    const [row] = await db.insert(users).values({ name: user.name, email: user.email, passwordHash, emailVerifiedAt: new Date() }).returning({ id: users.id });
    userIds[user.key] = row!.id;
  }

  await db.transaction(async (tx) => {
    const workspace = await createWorkspace(tx, { name: "Acme", slug: "acme", ownerId: userIds.don!, onboarding: { role: "founder", goal: "all_of_the_above", channels: ["changelog", "email", "in_app"] }, isDevSeed: true });
    const ws = workspace.id;
    await tx
      .update(workspaces)
      .set({ brandVoice: "Friendly, clear, and customer-focused. Avoid jargon. Lead with benefits.", timezone: "America/New_York", customDomain: "updates.acme.example", domainStatus: "pending" })
      .where(eq(workspaces.id, ws));
    for (const user of SEED_USERS.filter((u) => u.role !== "owner")) {
      await tx.insert(memberships).values({ workspaceId: ws, userId: userIds[user.key]!, role: user.role });
    }
    await tx.insert(invitations).values({ workspaceId: ws, email: "maya@shipbrief.dev", name: "Maya Patel", role: "marketer", invitedBy: userIds.don!, expiresAt: ahead(14) });

    // Audiences + a population of synthetic end users (example.com addresses only).
    const [allUsers] = await tx.select({ id: audiences.id }).from(audiences).where(eq(audiences.workspaceId, ws));
    const [pro] = await tx.insert(audiences).values({ workspaceId: ws, name: "Pro customers", rules: { plans: ["pro"] } }).returning({ id: audiences.id });
    const [beta] = await tx.insert(audiences).values({ workspaceId: ws, name: "Beta users", rules: { tags: ["beta"] } }).returning({ id: audiences.id });
    const audienceIds = { all: allUsers!.id, pro: pro!.id, beta: beta!.id };
    const plans = ["free", "free", "pro", "pro", "enterprise"];
    await tx.insert(contacts).values(
      Array.from({ length: 240 }, (_, i) => ({
        workspaceId: ws,
        externalId: `dev-user-${i + 1}`,
        email: `customer${i + 1}@example.com`,
        name: `Demo Customer ${i + 1}`,
        plan: plans[i % plans.length]!,
        tags: i % 9 === 0 ? ["beta"] : [],
        signedUpAt: ago(10 + (i % 400)),
      })),
    );

    const releaseIds: Record<string, string> = {};
    for (const r of RELEASES) {
      const createdAt = ago(r.createdDaysAgo, 2);
      const publishedAt = r.publishedDaysAgo !== undefined ? ago(r.publishedDaysAgo) : null;
      const [row] = await tx
        .insert(releases)
        .values({
          workspaceId: ws,
          title: r.title,
          slug: r.slug,
          summary: r.summary,
          body: r.body,
          status: r.status,
          channels: r.channels,
          category: r.category,
          tags: r.tags,
          audienceId: r.audience ? audienceIds[r.audience] : null,
          sourceRefs: r.sourceRefs ?? [],
          cta: r.cta ?? null,
          media: r.media ?? [],
          channelVariants: r.channelVariants ?? {},
          featured: r.featured ?? false,
          scheduledAt: r.scheduledInDays !== undefined ? ahead(r.scheduledInDays) : null,
          scheduledBy: r.status === "scheduled" ? userIds.alex! : null,
          publishedAt,
          createdBy: userIds.don!,
          reviewedBy: ["approved", "scheduled", "published"].includes(r.status) ? userIds.alex! : null,
          publishedBy: publishedAt ? userIds.alex! : null,
          views: r.views ?? 0,
          reactions: r.reactions ?? 0,
          createdAt,
          updatedAt: publishedAt ?? createdAt,
        })
        .returning({ id: releases.id });
      releaseIds[r.key] = row!.id;
      await tx.insert(releaseVersions).values({
        releaseId: row!.id,
        workspaceId: ws,
        version: 1,
        snapshot: { title: r.title, summary: r.summary, body: r.body, channels: r.channels, audienceId: r.audience ? audienceIds[r.audience] : null, cta: r.cta ?? null, channelVariants: r.channelVariants ?? {} },
        changeNote: "Release created",
        changedBy: userIds.don!,
        createdAt,
      });
      if (publishedAt) {
        await tx.insert(releasePublications).values(r.channels.map((channel) => ({ releaseId: row!.id, workspaceId: ws, channel, status: "published" as const, publishedAt })));
      }
    }

    await tx.insert(campaigns).values([
      { workspaceId: ws, releaseId: releaseIds.dark!, subject: "Dark Mode is here", previewText: "A more comfortable way to use Acme.", fromName: "Acme Product Team", audienceId: audienceIds.all, status: "sent", sentAt: ago(1), recipientCount: 240, deliveredCount: 240 },
      { workspaceId: ws, releaseId: releaseIds.permissions!, subject: "Team Permissions launching tomorrow", previewText: "Granular roles for your team.", fromName: "Acme Product Team", audienceId: audienceIds.pro, status: "draft" },
    ]);

    const comments = [
      { author: "Mina Shah", body: "The system setting is especially helpful for our team members who switch between home and office.", hours: 20 },
      { author: "Jordan Patel", body: "Thank you for making the contrast feel so considered. Dark mode looks great.", hours: 18 },
      { author: "Avery Kim", body: "The new appearance controls were easy to find and set up.", hours: 1 },
    ];
    await tx.insert(publicComments).values(comments.map((c) => ({ releaseId: releaseIds.dark!, workspaceId: ws, authorName: c.author, body: c.body, createdAt: ago(0, c.hours) })));
    await tx.update(releases).set({ comments: comments.length }).where(eq(releases.id, releaseIds.dark!));

    // Roadmap, clusters, feedback --------------------------------------------------
    const roadmap = async (title: string, description: string, status: "now" | "next" | "later" | "shipped", position: number, linkedRelease?: string, targetInDays?: number) =>
      (await tx.insert(roadmapItems).values({ workspaceId: ws, title, description, status, position, linkedReleaseId: linkedRelease ? releaseIds[linkedRelease]! : null, targetDate: targetInDays !== undefined ? ahead(targetInDays).toISOString().slice(0, 10) : null, createdBy: userIds.alex! }).returning({ id: roadmapItems.id }))[0]!.id;
    const rm = {
      dark: await roadmap("Dark Mode", "Comfortable usage at night.", "shipped", 0, "dark", -1),
      reporting: await roadmap("Advanced Reporting", "Deeper filters, saved views and exports.", "now", 0, "reporting", 7),
      filters: await roadmap("Saved Filters", "Reuse filter combinations across views.", "next", 0, undefined, 23),
      scheduled: await roadmap("Scheduled Reports", "Automated report delivery by email.", "later", 0),
      csv: await roadmap("CSV Export", "One-click export for every table.", "shipped", 1, "csv"),
    };
    const cluster = async (title: string, topNeed: string, demand: "low" | "medium" | "high", quotes: string[]) =>
      (await tx.insert(feedbackClusters).values({ workspaceId: ws, title, topNeed, demand, representativeQuotes: quotes }).returning({ id: feedbackClusters.id }))[0]!.id;
    const cl = {
      dark: await cluster("Dark Mode", "Comfortable usage at night", "high", ["Please add dark mode.", "I need a night theme.", "Can you support dark UI?"]),
      filters: await cluster("Saved Filters", "Reuse filter combinations across views", "medium", ["Let me save a filter for later."]),
      reports: await cluster("Scheduled Reports", "Automated report delivery", "medium", ["Can reports be emailed automatically?"]),
      sso: await cluster("Enterprise SSO", "Sign in through the company identity provider", "high", ["Our security team requires SAML SSO through Okta.", "Need SAML-based single sign-on for our 400-person team."]),
    };
    const fb = [
      { title: "Saved filters for reports", description: "Let us save a set of report filters and reuse them.", votes: 128, comments: 2, status: "planned", tags: ["filters", "productivity"], cluster: cl.filters, roadmap: rm.filters, priority: "high", days: 38, notes: "Strong signal from Pro teams building repeatable reporting workflows." },
      { title: "Scheduled Reports", description: "Email a report to my team every Monday.", votes: 74, comments: 1, status: "reviewing", tags: ["reports", "email"], cluster: cl.reports, roadmap: rm.scheduled, priority: "medium", days: 55, notes: "Validate whether weekly scheduling is enough before scoping recurring delivery." },
      { title: "Dark mode please", description: "The white UI is hard on the eyes at night.", votes: 247, comments: 1, status: "shipped", tags: ["ui", "accessibility"], cluster: cl.dark, roadmap: rm.dark, release: "dark", priority: "high", days: 100 },
      { title: "Night theme support", description: "A darker theme for evening work.", votes: 89, comments: 0, status: "shipped", tags: ["ui"], cluster: cl.dark, roadmap: rm.dark, priority: "medium", days: 95 },
      { title: "Bulk CSV export", description: "Export everything in one go.", votes: 82, comments: 0, status: "shipped", tags: ["export"], roadmap: rm.csv, release: "csv", priority: "low", days: 70 },
      { title: "SSO with Okta", description: "We need Okta SSO to roll Acme out company-wide.", votes: 63, comments: 0, status: "reviewing", tags: ["security", "enterprise"], cluster: cl.sso, priority: "high", days: 27 },
      { title: "SAML login for enterprise", description: "SAML single sign-on for our 400-person team.", votes: 41, comments: 0, status: "new", tags: ["security"], cluster: cl.sso, priority: "medium", days: 6 },
      { title: "Dark theme on mobile", description: "Please bring dark mode to the mobile app too.", votes: 19, comments: 0, status: "new", tags: ["ui", "mobile"], cluster: cl.dark, priority: "low", days: 0 },
      { title: "Report templates", description: "Start new reports from templates.", votes: 36, comments: 0, status: "new", tags: ["reports"], cluster: cl.filters, priority: "medium", days: 3, source: "internal" },
    ] as const;
    const feedbackIds: string[] = [];
    for (const item of fb) {
      const [row] = await tx
        .insert(feedback)
        .values({
          workspaceId: ws,
          title: item.title,
          description: item.description,
          votes: item.votes,
          comments: item.comments,
          status: item.status,
          tags: [...item.tags],
          clusterId: "cluster" in item ? item.cluster : null,
          roadmapItemId: "roadmap" in item ? item.roadmap : null,
          linkedReleaseId: "release" in item ? releaseIds[item.release]! : null,
          priority: item.priority,
          source: "source" in item ? item.source : "customer",
          internalNotes: "notes" in item ? item.notes : null,
          createdAt: ago(item.days),
          updatedAt: ago(Math.max(0, item.days - 2)),
        })
        .returning({ id: feedback.id });
      feedbackIds.push(row!.id);
    }
    await tx.insert(feedbackComments).values([
      { feedbackId: feedbackIds[0]!, workspaceId: ws, authorName: "Avery Kim", body: "We rebuild the same filters every Monday. Saving them would save us real time.", createdAt: ago(36) },
      { feedbackId: feedbackIds[0]!, workspaceId: ws, authorUserId: userIds.alex!, authorName: "Alex Chen", body: "Scoping this for next cycle alongside report templates.", isInternal: true, createdAt: ago(31) },
      { feedbackId: feedbackIds[1]!, workspaceId: ws, authorName: "Morgan Lee", body: "Weekly would cover most of our needs.", createdAt: ago(52) },
      { feedbackId: feedbackIds[2]!, workspaceId: ws, authorName: "Jordan Patel", body: "Just saw it shipped. Thank you!", createdAt: ago(0, 22) },
    ]);

    await tx.insert(activityEvents).values([
      { workspaceId: ws, type: "integration", message: "GitHub detected 2 merged pull requests for “Audit Log”", link: `/app/releases/${releaseIds.audit}`, actorName: "GitHub", createdAt: ago(0, 3) },
      { workspaceId: ws, type: "approved", message: "Alex approved “Faster Search”", link: `/app/releases/${releaseIds.search}`, actorUserId: userIds.alex!, actorName: "Alex Chen", createdAt: ago(0, 2) },
      { workspaceId: ws, type: "comment", message: "Sam submitted “Saved Filters” for review", link: `/app/releases/${releaseIds.filters}`, actorUserId: userIds.sam!, actorName: "Sam Rivera", createdAt: ago(1) },
      { workspaceId: ws, type: "published", message: "“Dark Mode” published to Changelog, Email and In-app", link: `/app/releases/${releaseIds.dark}`, actorUserId: userIds.alex!, actorName: "Alex Chen", createdAt: ago(1, 1) },
      { workspaceId: ws, type: "scheduled", message: "“Team Permissions” scheduled for Pro customers", link: `/app/releases/${releaseIds.permissions}`, actorUserId: userIds.alex!, actorName: "Alex Chen", createdAt: ago(2) },
      { workspaceId: ws, type: "feedback", message: "New cluster found: Enterprise SSO (2 requests)", link: "/app/feedback", actorName: "ShipBrief", createdAt: ago(2, 5) },
    ]);

    // An inactive example webhook; its secret is random and unused.
    await tx.insert(webhooks).values({ workspaceId: ws, url: "https://example.com/shipbrief-hook", events: ["release.published", "feedback.created"], active: false, secretEnc: encryptSecret(`whsec_${randomToken(24)}`), createdBy: userIds.don! });

    // Analytics events consistent with the release counters, spread over their live period.
    const events: (typeof analyticsEvents.$inferInsert)[] = [];
    for (const r of RELEASES.filter((release) => release.publishedDaysAgo !== undefined)) {
      const liveDays = Math.max(1, r.publishedDaysAgo!);
      const inApp = r.channels.includes("in_app");
      for (let i = 0; i < (r.views ?? 0); i += 1) {
        const channel = inApp && i % 3 === 0 ? "widget" : "changelog";
        events.push({ workspaceId: ws, releaseId: releaseIds[r.key]!, type: channel === "widget" ? "in_app.viewed" : "release.viewed", channel, visitorId: `dev-visitor-${i % 400}`, occurredAt: ago(Math.random() * liveDays) });
      }
      for (let i = 0; i < (r.reactions ?? 0); i += 1) events.push({ workspaceId: ws, releaseId: releaseIds[r.key]!, type: "reaction.added", channel: "changelog", visitorId: `dev-visitor-${i}`, occurredAt: ago(Math.random() * liveDays) });
      if (r.cta) for (let i = 0; i < Math.round((r.views ?? 0) * 0.15); i += 1) events.push({ workspaceId: ws, releaseId: releaseIds[r.key]!, type: "cta.clicked", channel: "changelog", visitorId: `dev-visitor-${i}`, occurredAt: ago(Math.random() * liveDays) });
    }
    for (let i = 0; i < events.length; i += 1000) await tx.insert(analyticsEvents).values(events.slice(i, i + 1000));
  });

  await rollupAnalytics();
  const [{ count } = { count: 0 }] = await db.execute<{ count: number }>(sql`select count(*)::int as count from releases`).then((r) => r.rows);
  logger.info({ workspace: "acme", releases: count, login: SEED_USERS.map((u) => `${u.email} (${u.role})`), password: SEED_PASSWORD }, "Development seed complete");
}

seed()
  .catch((error: unknown) => {
    logger.error({ err: error }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
