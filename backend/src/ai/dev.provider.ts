import { escapeHtml, htmlToPlainText } from "../utils/html.js";
import { AIError, type AIProvider, type AIResult, type AITask } from "./types.js";

/**
 * Deterministic stand-in for local development and tests when no AI key is
 * configured. It performs simple, predictable text transformations so the
 * product flows can be exercised end to end — it is not a language model, it
 * reports its model as "dev-deterministic", and env validation refuses it in
 * production.
 */
export class DevProvider implements AIProvider {
  readonly name = "dev";
  readonly model = "dev-deterministic";

  async generate<T>(task: AITask<T>): Promise<AIResult<T>> {
    const input = task.input;
    if (String(input.text ?? input.material ?? "").includes("[[ai-error]]")) {
      throw new AIError("AI_UPSTREAM_ERROR", "The AI request failed. Please try again.", 502);
    }
    const output = this.run(task.operation, input);
    return { output: task.schema.parse(output), model: this.model, usage: { inputTokens: null, outputTokens: null } };
  }

  private run(operation: AITask<unknown>["operation"], input: Record<string, unknown>): unknown {
    switch (operation) {
      case "generate_release":
      case "summarize_changes": {
        const material = htmlToPlainText(String(input.material ?? ""));
        const firstSentence = material.split(/(?<=[.!?])\s/)[0] ?? "Product update";
        return {
          title: firstSentence.replace(/[.!?]$/, "").slice(0, 70) || "Product update",
          summary: firstSentence.slice(0, 200),
          bodyHtml: `<p>${escapeHtml(material || "Describe the customer benefit of this update.")}</p>`,
          category: "Improvement",
        };
      }
      case "rewrite": {
        const text = htmlToPlainText(String(input.text ?? ""));
        const instruction = String(input.instruction ?? "").toLowerCase();
        const attempt = Number(input.attempt ?? 0);
        if (instruction.includes("short")) {
          const ratio = attempt % 2 === 0 ? 0.62 : 0.46;
          const cut = text.slice(0, Math.max(90, Math.round(text.length * ratio))).replace(/\s+\S*$/, "");
          return { contentHtml: `<p>${escapeHtml(cut + (cut.length < text.length ? "…" : ""))}</p>`, summary: attempt ? "A tighter alternative" : "Shortened version" };
        }
        if (instruction.includes("friendl")) {
          return { contentHtml: `<p>${escapeHtml(text.replace(/you can/gi, "you'll be able to").replace(/configure/gi, "set up"))}</p>`, summary: "Friendlier version" };
        }
        if (instruction.includes("simpl") || instruction.includes("clear")) {
          return { contentHtml: `<p>${escapeHtml(text.replace(/\butili[sz]e\b/gi, "use").replace(/\bin order to\b/gi, "to").replace(/\bleverage\b/gi, "use"))}</p>`, summary: "Simpler wording" };
        }
        if (instruction.includes("benefit")) {
          return { contentHtml: `<p>${escapeHtml(text)}</p><ul><li>Get to the outcome faster.</li><li>Spend less time on setup.</li></ul>`, summary: "Customer benefits surfaced" };
        }
        return { contentHtml: `<p>${escapeHtml(text)}</p>`, summary: "Applied (development provider)" };
      }
      case "channel_variant": {
        const channel = String(input.channel);
        const title = String(input.title ?? "");
        const summary = String(input.summary ?? "");
        const body = String(input.body ?? "");
        if (channel === "email") {
          return { title, summary, bodyHtml: `<p>Hi there,</p><p>${escapeHtml(summary)}</p>${body}<p>Thanks,<br />The team</p>`, subject: `${title} is here`.slice(0, 60), previewText: summary.slice(0, 110) };
        }
        if (channel === "in_app") return { title, summary, bodyHtml: `<p>${escapeHtml(summary)}</p>`, subject: null, previewText: null };
        return { title, summary, bodyHtml: body, subject: null, previewText: null };
      }
      case "quality_check": {
        const text = htmlToPlainText(`${input.title} ${input.summary} ${input.body}`);
        const issues: { id: string; severity: "info" | "warning"; title: string; detail: string; suggestion: string }[] = [];
        if (/implement|configuration|infrastructure|endpoint/i.test(text)) issues.push({ id: "jargon", severity: "warning", title: "Technical language detected", detail: "Some wording describes implementation rather than the customer outcome.", suggestion: "Lead with what customers can now do." });
        if (!String(input.summary ?? "").trim()) issues.push({ id: "benefit", severity: "warning", title: "Customer benefit is missing", detail: "A concise summary helps customers understand why this matters.", suggestion: "Add one sentence that starts with the outcome." });
        if (!input.ctaLabel) issues.push({ id: "cta", severity: "info", title: "No next step yet", detail: "A call to action helps customers discover the update.", suggestion: "Add a next step when there is somewhere relevant to go." });
        if (text.length > 850) issues.push({ id: "length", severity: "info", title: "Long for an in-app message", detail: "This may work better as a changelog post or email.", suggestion: "Create a shorter in-app variant." });
        const score = Math.max(58, 100 - issues.reduce((total, issue) => total + (issue.severity === "warning" ? 14 : 6), 0));
        return { score, issues, strengths: ["The update has a clear title."] };
      }
      case "cluster_feedback": {
        const items = (input.items as { id: string; title: string; tags: string[]; votes: number }[]) ?? [];
        const groups = new Map<string, typeof items>();
        for (const item of items) {
          const key = item.tags[0] ?? "general";
          groups.set(key, [...(groups.get(key) ?? []), item]);
        }
        const maxVotes = Math.max(1, ...[...groups.values()].map((group) => group.reduce((total, item) => total + item.votes, 0)));
        return {
          clusters: [...groups.entries()].map(([tag, group]) => {
            const votes = group.reduce((total, item) => total + item.votes, 0);
            return {
              title: tag.charAt(0).toUpperCase() + tag.slice(1),
              topNeed: group[0]!.title,
              demand: votes > maxVotes * 0.66 ? "high" : votes > maxVotes * 0.33 ? "medium" : "low",
              representativeQuotes: group.slice(0, 3).map((item) => item.title),
              feedbackIds: group.map((item) => item.id),
            };
          }),
        };
      }
    }
  }
}
