import { config } from "../../config/env.js";
import { escapeHtml, htmlToPlainText } from "../../utils/html.js";

/**
 * Transactional email templates, in the ShipBrief look: smoke-grey page, a
 * white card, ink type and one #C7F238 accent. Email clients ignore
 * stylesheets and many strip <style>, so everything is inline and table-based.
 *
 * ShipBrief's own emails (verification, reset, welcome, security, invitations,
 * notifications) carry the ShipBrief header. Release emails belong to the
 * customer's workspace, so they use its name and accent colour instead.
 */

type Rendered = { subject: string; html: string; text: string };

const INK = "#171717";
const MUTED = "#636466";
const LINE = "#DEDFE2";
const PAGE = "#ECEDEF";
const ACCENT = "#C7F238";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Ink or white, whichever reads better on the given background colour. */
function textOn(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(clean.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.18 ? INK : "#ffffff";
}

function shipBriefHeader() {
  const logo = `${config.APP_URL}/brand/email-mark.png`;
  return `<tr><td style="padding:28px 32px 0">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:10px"><img src="${escapeHtml(logo)}" width="44" height="16" alt="" style="display:block;border:0"></td>
<td style="vertical-align:middle;font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:-0.3px;color:${INK}">ShipBrief</td>
</tr></table></td></tr>`;
}

function layout(input: { preheader?: string; bodyHtml: string; header?: string; accent?: string; footerHtml?: string }) {
  const accent = input.accent ?? ACCENT;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title></title></head>
<body style="margin:0;padding:0;background:${PAGE};font-family:${FONT};color:${INK};-webkit-font-smoothing:antialiased">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}&#8199;&#65279;&#847;</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:14px;border-collapse:separate">
<tr><td style="height:4px;line-height:4px;font-size:0;background:${accent};border-radius:14px 14px 0 0">&nbsp;</td></tr>
${input.header ?? shipBriefHeader()}
<tr><td style="padding:24px 32px 32px;font-size:15px;line-height:1.6;color:${INK}">${input.bodyHtml}</td></tr>
</table>
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%"><tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:${MUTED}">${input.footerHtml ?? "ShipBrief · Release communication your customers actually read."}</td></tr></table>
</td></tr></table></body></html>`;
}

function heading(text: string) {
  return `<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-0.4px;color:${INK}">${escapeHtml(text)}</h1>`;
}

function paragraph(html: string, muted = false) {
  return `<p style="margin:0 0 14px;color:${muted ? MUTED : INK};font-size:${muted ? "13px" : "15px"}">${html}</p>`;
}

function button(label: string, url: string, background = ACCENT) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:999px;background:${background}">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:${background};color:${textOn(background)};font-family:${FONT};font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** Plain URL under the button, for clients that block buttons or break links. */
function fallbackLink(url: string) {
  return `<p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:${MUTED}">Or paste this link into your browser:<br><a href="${escapeHtml(url)}" style="color:${MUTED};word-break:break-all">${escapeHtml(url)}</a></p>`;
}

function divider() {
  return `<div style="height:1px;background:${LINE};margin:20px 0"></div>`;
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export function verifyEmailTemplate(input: { name: string; url: string }): Rendered {
  return {
    subject: "Confirm your email for ShipBrief",
    html: layout({
      preheader: "One click to finish setting up your ShipBrief account.",
      bodyHtml:
        heading("Confirm your email") +
        paragraph(`Hi ${escapeHtml(input.name)}, confirm this address to finish setting up your ShipBrief account.`) +
        button("Confirm email", input.url) +
        fallbackLink(input.url) +
        divider() +
        paragraph("This link expires in 24 hours. If you didn't create a ShipBrief account, you can ignore this email.", true),
    }),
    text: `Hi ${input.name},\n\nConfirm your email to finish setting up ShipBrief:\n${input.url}\n\nThis link expires in 24 hours. If you didn't create a ShipBrief account, ignore this email.`,
  };
}

export function welcomeTemplate(input: { name: string; url: string }): Rendered {
  const steps = [
    ["Connect a source", "GitHub, GitLab, Linear or Jira — ShipBrief only reads merged and completed work."],
    ["Review your first draft", "Related changes are grouped into one release, written for customers."],
    ["Publish where it's read", "Send it to your changelog, email and in-app — after a person approves it."],
  ];
  const list = steps
    .map(
      ([title, detail], index) =>
        `<tr><td style="vertical-align:top;padding:0 12px 14px 0;width:22px"><div style="width:22px;height:22px;line-height:22px;border-radius:999px;background:${ACCENT};color:${INK};font-size:12px;font-weight:700;text-align:center">${index + 1}</div></td><td style="vertical-align:top;padding:0 0 14px"><div style="font-size:14px;font-weight:600;color:${INK}">${escapeHtml(title!)}</div><div style="font-size:13px;color:${MUTED}">${escapeHtml(detail!)}</div></td></tr>`,
    )
    .join("");
  return {
    subject: "Welcome to ShipBrief",
    html: layout({
      preheader: "Your first release draft is three steps away.",
      bodyHtml:
        heading(`Welcome, ${input.name}`) +
        paragraph("Your account is ready. Here's how teams get their first release out:") +
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px">${list}</table>` +
        button("Set up your workspace", input.url) +
        paragraph("Questions? Just reply to this email.", true),
    }),
    text: `Welcome to ShipBrief, ${input.name}.\n\n1. Connect a source (GitHub, GitLab, Linear or Jira)\n2. Review your first draft\n3. Publish to your changelog, email and in-app\n\nSet up your workspace: ${input.url}`,
  };
}

export function resetPasswordTemplate(input: { name: string; url: string }): Rendered {
  return {
    subject: "Reset your ShipBrief password",
    html: layout({
      preheader: "Use this link to choose a new password.",
      bodyHtml:
        heading("Reset your password") +
        paragraph(`Hi ${escapeHtml(input.name)}, we received a request to reset the password for your ShipBrief account.`) +
        button("Choose a new password", input.url) +
        fallbackLink(input.url) +
        divider() +
        paragraph("This link expires in 1 hour and works once. If you didn't ask for this, you can ignore this email — your password hasn't changed.", true),
    }),
    text: `Hi ${input.name},\n\nReset your ShipBrief password:\n${input.url}\n\nThis link expires in 1 hour and works once. If you didn't ask for this, your password hasn't changed.`,
  };
}

export function passwordChangedTemplate(input: { name: string; when: Date; ipAddress: string | null; resetUrl: string }): Rendered {
  const when = `${input.when.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  const details = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:4px 0 6px;background:#F4F5F7;border-radius:10px"><tr><td style="padding:12px 14px;font-size:13px;line-height:1.7;color:${MUTED}"><strong style="color:${INK}">When:</strong> ${escapeHtml(when)}${input.ipAddress ? `<br><strong style="color:${INK}">IP address:</strong> ${escapeHtml(input.ipAddress)}` : ""}</td></tr></table>`;
  return {
    subject: "Your ShipBrief password was changed",
    html: layout({
      preheader: "If this wasn't you, reset your password now.",
      bodyHtml:
        heading("Your password was changed") +
        paragraph(`Hi ${escapeHtml(input.name)}, the password for your ShipBrief account was just changed. Other signed-in devices have been signed out.`) +
        details +
        paragraph("<strong>Wasn't you?</strong> Reset your password right away to secure your account.") +
        button("Reset password", input.resetUrl, INK),
    }),
    text: `Hi ${input.name},\n\nThe password for your ShipBrief account was changed (${when}${input.ipAddress ? `, IP ${input.ipAddress}` : ""}). Other devices were signed out.\n\nWasn't you? Reset your password: ${input.resetUrl}`,
  };
}

export function invitationTemplate(input: { inviterName: string; workspaceName: string; role: string; url: string }): Rendered {
  return {
    subject: `${input.inviterName} invited you to ${input.workspaceName} on ShipBrief`,
    html: layout({
      preheader: `Join ${input.workspaceName} on ShipBrief.`,
      bodyHtml:
        heading(`Join ${input.workspaceName}`) +
        paragraph(`${escapeHtml(input.inviterName)} invited you to join <strong>${escapeHtml(input.workspaceName)}</strong> on ShipBrief as ${escapeHtml(input.role)}.`) +
        button("Accept invitation", input.url) +
        fallbackLink(input.url) +
        divider() +
        paragraph("Sign in or create an account with this email address and confirm it — you'll be added automatically. The invitation expires in 14 days.", true),
    }),
    text: `${input.inviterName} invited you to join ${input.workspaceName} on ShipBrief as ${input.role}.\n\nSign in or create an account with this email address: ${input.url}\n\nThe invitation expires in 14 days.`,
  };
}

export function notificationTemplate(input: { workspaceName: string; message: string; url: string }): Rendered {
  return {
    subject: `${input.workspaceName}: ${input.message}`.slice(0, 150),
    html: layout({
      preheader: input.message,
      bodyHtml: paragraph(`<span style="color:${MUTED};font-size:13px">${escapeHtml(input.workspaceName)}</span>`) + heading(input.message) + button("Open in ShipBrief", input.url),
      footerHtml: `You're receiving this because notifications are on for ${escapeHtml(input.workspaceName)}. Change this in workspace settings.`,
    }),
    text: `${input.workspaceName}: ${input.message}\n\n${input.url}`,
  };
}

// ---------------------------------------------------------------------------
// Customer-facing release email (workspace-branded)
// ---------------------------------------------------------------------------

/** Double opt-in for the public changelog's "Subscribe to updates" form. Sent in the customer's name and colours. */
export function subscribeConfirmTemplate(input: { workspaceName: string; url: string; accent: string }): Rendered {
  const header = `<tr><td style="padding:28px 32px 0;font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:-0.2px;color:${INK}">${escapeHtml(input.workspaceName)}</td></tr>`;
  return {
    subject: `Confirm your subscription to ${input.workspaceName} updates`,
    html: layout({
      preheader: `One click to get product updates from ${input.workspaceName}.`,
      accent: input.accent,
      header,
      bodyHtml:
        heading("Confirm your subscription") +
        paragraph(`Someone, hopefully you, asked to get product updates from ${escapeHtml(input.workspaceName)} at this address.`) +
        button("Yes, subscribe me", input.url, input.accent) +
        fallbackLink(input.url) +
        divider() +
        paragraph("If you didn't ask for this, ignore this email and you won't be subscribed. The link expires in 7 days.", true),
      footerHtml: `Sent on behalf of ${escapeHtml(input.workspaceName)} by ShipBrief.`,
    }),
    text: `Confirm your subscription to product updates from ${input.workspaceName}:\n${input.url}\n\nIf you didn't ask for this, ignore this email and you won't be subscribed. The link expires in 7 days.`,
  };
}

export function releaseEmailTemplate(input: {
  workspaceName: string;
  subject: string;
  previewText: string;
  bodyHtml: string;
  cta?: { label: string; url: string } | null;
  accent: string;
  unsubscribeUrl: string;
  changelogUrl: string;
  /** This update's own changelog page, when it was published there. */
  releaseUrl?: string | null;
}): Rendered {
  const cta = input.cta?.label && input.cta.url ? button(input.cta.label, input.cta.url, input.accent) : "";
  const readMore = input.releaseUrl
    ? `<p style="margin:24px 0 0;font-size:14px"><a href="${escapeHtml(input.releaseUrl)}" style="color:${INK};font-weight:600">Read this update on the changelog &rarr;</a></p>`
    : "";
  const header = `<tr><td style="padding:28px 32px 0;font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:-0.2px;color:${INK}">${escapeHtml(input.workspaceName)}</td></tr>`;
  return {
    subject: input.subject,
    html: layout({
      preheader: input.previewText,
      accent: input.accent,
      header,
      bodyHtml: `${input.bodyHtml}${cta}${readMore}<p style="margin:${readMore ? 8 : 24}px 0 0;font-size:13px"><a href="${escapeHtml(input.changelogUrl)}" style="color:${MUTED}">See all updates from ${escapeHtml(input.workspaceName)}</a></p>`,
      footerHtml: `You're receiving product updates from ${escapeHtml(input.workspaceName)}. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${MUTED}">Unsubscribe</a>.`,
    }),
    text: `${htmlToPlainText(input.bodyHtml)}\n\n${input.cta?.label && input.cta.url ? `${input.cta.label}: ${input.cta.url}\n\n` : ""}${input.releaseUrl ? `Read this update: ${input.releaseUrl}\n` : ""}All updates: ${input.changelogUrl}\nUnsubscribe: ${input.unsubscribeUrl}`,
  };
}
