"use client";

import { useMemo, useState } from "react";
import { Loader2, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/hooks/use-async-data";
import { audienceService } from "@/lib/services";

export function AudienceTargetingPanel() {
  const [plan, setPlan] = useState("all");
  const [beta, setBeta] = useState(false);
  const [accountAge, setAccountAge] = useState("");
  const [segmentName, setSegmentName] = useState("");
  const [saving, setSaving] = useState(false);
  const rules = useMemo(() => ({
    plans: plan === "all" ? undefined : [plan],
    tags: beta ? ["beta"] : undefined,
    accountAgeDays: accountAge ? Number(accountAge) : undefined,
  }), [accountAge, beta, plan]);
  const { state: audienceState, reload } = useAsyncData(() => audienceService.list(), []);
  const { state: previewState } = useAsyncData(() => audienceService.preview(rules), [rules]);

  const saveSegment = async () => {
    if (!segmentName.trim() || saving) return;
    setSaving(true);
    try {
      await audienceService.create({ name: segmentName.trim(), rules });
      await reload();
      setSegmentName("");
      toast.success("Audience segment saved (mock).");
    } catch {
      toast.error("We could not save that audience segment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="sb-panel p-4 sm:p-5" aria-labelledby="audience-targeting-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><Users className="size-4 text-primary" /><h2 id="audience-targeting-heading" className="text-base font-semibold">Audience targeting</h2></div><p className="mt-1 text-sm text-muted-foreground">Preview who will receive a channel-specific communication before it is scheduled.</p></div>{previewState.status === "success" && <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-right"><p className="text-lg font-semibold text-primary">{previewState.data.size.toLocaleString()}</p><p className="text-[11px] text-muted-foreground">estimated recipients</p></div>}</div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="audience-plan">Plan</Label><Select value={plan} onValueChange={(value) => value && setPlan(value)}><SelectTrigger id="audience-plan" className="w-full"><SelectValue>{(value) => value === "all" ? "All users" : String(value).charAt(0).toUpperCase() + String(value).slice(1)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All users</SelectItem><SelectItem value="free">Free</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="audience-age">Account age</Label><Input id="audience-age" type="number" min="0" value={accountAge} onChange={(event) => setAccountAge(event.target.value)} placeholder="Any age" /><p className="text-xs text-muted-foreground">Days or more</p></div>
        <div className="space-y-2"><Label>Customer tags</Label><label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-input bg-surface px-2.5 text-sm"><input type="checkbox" checked={beta} onChange={(event) => setBeta(event.target.checked)} className="size-3.5 accent-primary" />Beta users</label><p className="text-xs text-muted-foreground">Feature usage follows later.</p></div>
      </div>
      <div className="mt-5 border-t border-border pt-4"><div className="flex flex-col gap-2 sm:flex-row"><Input value={segmentName} onChange={(event) => setSegmentName(event.target.value)} placeholder="Name this custom segment..." /><Button type="button" variant="outline" onClick={() => void saveSegment()} disabled={!segmentName.trim() || saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}{saving ? "Saving..." : "Save segment"}</Button></div></div>
      {previewState.status === "loading" && <p className="mt-3 text-xs text-muted-foreground">Refreshing audience preview...</p>}
      {previewState.status === "error" && <p className="mt-3 text-xs text-destructive">The audience preview is unavailable. Adjusting filters will retry.</p>}
      <div className="mt-5 border-t border-border pt-4"><p className="text-xs font-medium text-muted-foreground">Saved segments</p>{audienceState.status === "loading" && <LoadingState rows={1} />}{audienceState.status === "error" && <ErrorState title="Audiences unavailable" message={audienceState.error} onRetry={reload} />}{audienceState.status === "success" && <div className="mt-2 flex flex-wrap gap-2">{audienceState.data.map((audience) => <span key={audience.id} className="rounded-md border border-border bg-surface px-2 py-1 text-xs"><span className="font-medium">{audience.name}</span><span className="ml-1 text-muted-foreground">{audience.size.toLocaleString()}</span></span>)}</div>}</div>
    </section>
  );
}
