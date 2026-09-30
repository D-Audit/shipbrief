import sanitizeHtml from "sanitize-html";

/**
 * Release bodies are rich text authored in the editor (TipTap) or produced by
 * AI, and the web app renders them as HTML on public pages. Everything is
 * sanitised on write against the editor's own vocabulary, so stored XSS is
 * impossible regardless of which client wrote the content.
 */
const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote",
    "ul", "ol", "li", "h1", "h2", "h3", "h4", "hr", "a", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    ol: ["start"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer nofollow", ...(attribs.target ? { target: "_blank" } : {}) },
    }),
  },
};

export function sanitizeRichText(html: string) {
  return sanitizeHtml(html, RICH_TEXT_OPTIONS).trim();
}

export function htmlToPlainText(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
