"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

type Language = "node" | "python" | "php" | "curl";

const LANGUAGES: { id: Language; label: string }[] = [
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
  { id: "php", label: "PHP" },
  { id: "curl", label: "cURL" },
];

function snippets(base: string): Record<Language, string> {
  return {
    node: `// Call this right after a user signs up, and again when their plan changes.
async function syncToShipBrief(user) {
  const res = await fetch("${base}/api/v1/contacts", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.SHIPBRIEF_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      externalId: String(user.id), // your own id for this user
      email: user.email,
      name: user.name,
      plan: user.plan,             // e.g. "free", "pro"
      tags: ["customer"],
    }),
  });
  if (!res.ok) console.error("ShipBrief sync failed", await res.text());
}`,
    python: `# Call this right after a user signs up, and again when their plan changes.
import os, requests

def sync_to_shipbrief(user):
    res = requests.post(
        "${base}/api/v1/contacts",
        headers={"Authorization": f"Bearer {os.environ['SHIPBRIEF_API_KEY']}"},
        json={
            "externalId": str(user.id),  # your own id for this user
            "email": user.email,
            "name": user.name,
            "plan": user.plan,           # e.g. "free", "pro"
            "tags": ["customer"],
        },
        timeout=10,
    )
    if not res.ok:
        print("ShipBrief sync failed", res.text)`,
    php: `<?php
// Call this right after a user signs up, and again when their plan changes.
function syncToShipBrief($user) {
    $ch = curl_init("${base}/api/v1/contacts");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer " . getenv("SHIPBRIEF_API_KEY"),
            "Content-Type: application/json",
        ],
        CURLOPT_POSTFIELDS => json_encode([
            "externalId" => (string) $user->id, // your own id for this user
            "email" => $user->email,
            "name" => $user->name,
            "plan" => $user->plan,              // e.g. "free", "pro"
            "tags" => ["customer"],
        ]),
    ]);
    curl_exec($ch);
    curl_close($ch);
}`,
    curl: `curl -X POST ${base}/api/v1/contacts \\
  -H "Authorization: Bearer $SHIPBRIEF_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalId": "user_123",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "plan": "pro",
    "tags": ["customer"]
  }'`,
  };
}

const FIELDS: { name: string; type: string; note: string }[] = [
  { name: "email", type: "string", note: "Where release emails go. Required unless you send externalId." },
  { name: "externalId", type: "string", note: "Your own id for the user. Recommended: it keeps the contact matched even if their email changes." },
  { name: "name", type: "string", note: "Used to greet them in emails (\"Hi Jane\")." },
  { name: "plan", type: "string", note: "Their plan, such as free or pro. Lets you email only certain plans." },
  { name: "tags", type: "string[]", note: "Any labels you like, such as beta or enterprise. Audiences can target them." },
  { name: "signedUpAt", type: "ISO date", note: "When they joined your app, e.g. 2026-10-06T09:00:00Z." },
];

const RESPONSE = `{
  "success": true,
  "data": {
    "id": "c9f1…",
    "externalId": "user_123",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "plan": "pro",
    "tags": ["customer"],
    "unsubscribed": false
  }
}`;

const ERRORS: [string, string][] = [
  ["401", "The API key is missing, wrong, or revoked. Check the Authorization header is \"Bearer \" followed by your full key."],
  ["403", "The key doesn't have permission to add contacts. Create a new key."],
  ["400", "Something in the body is invalid, such as a malformed email. The response says which field."],
  ["409", "Another contact already uses that email with a different externalId."],
];

export function ApiGuidePage() {
  const [language, setLanguage] = useState<Language>("node");
  const base = typeof window === "undefined" ? "" : window.location.origin;
  const code = snippets(base);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="API & Webhooks"
        title="Connect your app"
        description="Send your users to ShipBrief automatically, so everyone who signs up to your product gets your release emails. No CSV uploads needed."
        actions={<ButtonLink href="/app/api" variant="outline">Back to API keys</ButtonLink>}
      />

      <section aria-labelledby="how-heading" className="sb-panel p-5">
        <h2 id="how-heading" className="sb-title-section">How it works</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { icon: UserPlus, title: "Someone signs up to your app", body: "Your own app creates their account, as it does today." },
            { icon: KeyRound, title: "Your server tells ShipBrief", body: "One request to ShipBrief with their email, name and plan." },
            { icon: Users, title: "They get your updates", body: "They appear in Contacts and receive your next release email." },
          ].map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="sb-numeric flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-xs font-semibold">{index + 1}</span>
              <div>
                <p className="flex items-center gap-1.5 font-medium"><step.icon className="size-4 text-muted-foreground" aria-hidden="true" />{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Step number={1} title="Create an API key">
        <p>
          Go to <strong>API & Webhooks</strong>, click <strong>Create key</strong>, and name it after where it will live, for example &ldquo;Production app&rdquo;. Copy the key straight
          away; it&rsquo;s shown only once.
        </p>
        <p>
          Store it as a secret on your server, in an environment variable called <Code>SHIPBRIEF_API_KEY</Code>. Never put it in browser or mobile app code, where anyone could read it.
        </p>
        <ButtonLink href="/app/api" size="sm" className="mt-1">Create a key</ButtonLink>
      </Step>

      <Step number={2} title="Add the code to your server">
        <p>Copy the example for your language into your backend. It sends one user to ShipBrief.</p>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex gap-1 border-b border-border bg-surface-subtle p-1" role="tablist" aria-label="Language">
            {LANGUAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={language === item.id}
                onClick={() => setLanguage(item.id)}
                className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", language === item.id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {item.label}
              </button>
            ))}
          </div>
          <CodeBlock code={code[language]} label={`${LANGUAGES.find((item) => item.id === language)?.label} example`} />
        </div>
      </Step>

      <Step number={3} title="Call it in the right places">
        <p>Call the function from these moments in your app:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>When a user signs up</strong>: right after you save the new account. This is the main one.</li>
          <li><strong>When their details change</strong>: a new email, name, or plan. Sending the same user again updates them; it never creates a duplicate.</li>
          <li><strong>For users you already have</strong>: either loop over them once with the same function, or export them and use <strong>Import CSV</strong> on the Contacts page.</li>
        </ul>
        <CodeBlock
          label="Sign-up example"
          code={`// Example: your existing sign-up route
app.post("/signup", async (req, res) => {
  const user = await createUser(req.body);   // your code
  syncToShipBrief(user).catch(console.error); // add this line
  res.json(user);
});`}
        />
        <p className="text-[13px]">Don&rsquo;t wait on ShipBrief before answering your user. If the request fails, sign-up still works; you can retry or sync later.</p>
      </Step>

      <Step number={4} title="Check it worked">
        <p>
          Sign up a test user in your app, then open <strong>Contacts</strong> in ShipBrief. The new person should be there. The API replies with the saved contact:
        </p>
        <CodeBlock label="Response" code={RESPONSE} />
      </Step>

      <section aria-labelledby="fields-heading" className="sb-panel min-w-0 p-5">
        <h2 id="fields-heading" className="sb-title-section">Fields you can send</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <Code>POST /api/v1/contacts</Code> · send <Code>email</Code> or <Code>externalId</Code>, everything else is optional.
        </p>
        <div className="mt-4 divide-y divide-border border-y border-border">
          {FIELDS.map((field) => (
            <div key={field.name} className="grid gap-1 py-3 sm:grid-cols-[9rem_6rem_minmax(0,1fr)] sm:gap-4">
              <span className="font-mono text-[13px] font-medium">{field.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{field.type}</span>
              <span className="text-sm text-muted-foreground">{field.note}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="errors-heading" className="sb-panel p-5">
          <h2 id="errors-heading" className="sb-title-section">If something goes wrong</h2>
          <dl className="mt-4 space-y-3">
            {ERRORS.map(([status, meaning]) => (
              <div key={status} className="flex gap-3">
                <dt className="sb-numeric w-10 shrink-0 font-mono text-[13px] font-semibold">{status}</dt>
                <dd className="text-sm text-muted-foreground">{meaning}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="good-heading" className="sb-panel p-5">
          <h2 id="good-heading" className="sb-title-section">Good to know</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Only add people who agreed to hear from you, such as through your sign-up terms.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />If someone unsubscribed, syncing them again keeps them unsubscribed. They&rsquo;re never emailed again.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />If a key leaks, revoke it on the API page and create a new one. Revoking stops it immediately.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`step-${number}`} className="grid gap-3 md:grid-cols-[2.5rem_minmax(0,1fr)]">
      <span className="sb-numeric flex size-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-ink-foreground">{number}</span>
      <div className="min-w-0 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        <h2 id={`step-${number}`} className="sb-title-section text-foreground">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy isn't available in this browser.");
    }
  };
  return (
    <div className="relative bg-[#171718] p-4 sm:p-5">
      <Button type="button" variant="outline" size="sm" aria-label={`Copy ${label}`} className="absolute top-3 right-3 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => void copy()}>
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <pre className="overflow-x-auto pr-20 font-mono text-[12px] leading-5 text-[#e7e7e8]"><code>{code}</code></pre>
    </div>
  );
}
