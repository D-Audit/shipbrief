import { Bell, Megaphone, X } from "lucide-react";

/**
 * Static illustration for the landing page: the snippet a customer pastes into
 * their layout, and what their signed-in users then see in the product.
 */
export function WidgetDemo() {
  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="font-mono text-[11px] text-muted-foreground">app/layout.tsx · before &lt;/body&gt;</p>
          <span className="text-[11px] text-muted-foreground">Paste once</span>
        </div>
        <pre className="overflow-x-auto px-4 py-4 font-mono text-[11.5px] leading-[1.7] text-foreground/85">
          <code>
            <span className="text-muted-foreground">{"<script>"}</span>
            {"\n  ShipBrief("}
            <span className="text-primary-strong">&quot;init&quot;</span>
            {", {\n    key: "}
            <span className="text-primary-strong">&quot;sb_acme_e2566eb2&quot;</span>
            {",\n    user: { id, email, name, plan },  "}
            <span className="text-muted-foreground">{"// optional"}</span>
            {"\n    userHash,                          "}
            <span className="text-muted-foreground">{"// signed on your server"}</span>
            {"\n  });\n"}
            <span className="text-muted-foreground">{"</script>"}</span>
            {"\n"}
            <span className="text-muted-foreground">{'<script async src="…/widget.js"></script>'}</span>
          </code>
        </pre>
      </div>

      <div className="relative h-[21rem] overflow-hidden rounded-xl border border-border bg-surface-subtle/60" aria-hidden="true">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
          <span className="text-[13px] font-semibold">Acme</span>
          <span className="relative inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
            <Megaphone className="size-3" />Updates
            <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">2</span>
          </span>
        </div>
        <div className="space-y-2 p-4">
          <div className="h-2.5 w-32 rounded-full bg-foreground/10" />
          <div className="h-14 w-[52%] rounded-lg border border-border bg-card" />
          <div className="h-2.5 w-24 rounded-full bg-foreground/10" />
        </div>

        <div className="absolute right-3 bottom-14 w-[62%] min-w-[15rem] overflow-hidden rounded-lg border border-border bg-card sb-overlay-shadow">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div><p className="text-[11px] font-semibold">What&apos;s new</p><p className="text-[10px] text-muted-foreground">Latest from Acme</p></div>
            <X className="size-3 text-muted-foreground" />
          </div>
          <ul className="divide-y divide-border">
            <li className="flex gap-2 px-3 py-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-strong" /><span><span className="block text-[11.5px] font-medium">Reports on a schedule</span><span className="block text-[10px] text-muted-foreground">Sep 30</span></span></li>
            <li className="flex gap-2 px-3 py-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-strong" /><span><span className="block text-[11.5px] font-medium">Dark mode</span><span className="block text-[10px] text-muted-foreground">Sep 29</span></span></li>
          </ul>
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <span><span className="block text-[11px] font-medium">Email me new updates</span><span className="block text-[10px] text-muted-foreground">maya@acme.com</span></span>
            <span className="relative h-3.5 w-6 rounded-full bg-primary"><span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-white" /></span>
          </div>
        </div>

        <span className="absolute right-3 bottom-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[11px] font-medium text-primary-foreground">
          <Bell className="size-3" />What&apos;s new
          <span className="flex size-3.5 items-center justify-center rounded-full bg-background text-[9px] font-semibold text-foreground">2</span>
        </span>
      </div>
    </div>
  );
}
