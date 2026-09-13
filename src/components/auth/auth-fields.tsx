"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AuthNotice({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;
  const styles = {
    error: "border-destructive/20 bg-danger-muted/45 text-destructive",
    success: "border-success/20 bg-success-muted/65 text-success",
    info: "border-primary/15 bg-primary/5 text-primary",
  };

  return (
    <div role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"} className={cn("flex items-start gap-2.5 border px-3 py-2.5 text-xs leading-relaxed", styles[tone])}>
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function AuthField({
  id,
  label,
  error,
  hint,
  className,
  ...props
}: ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <Input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="h-10 bg-background px-3" {...props} />
      {error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function PasswordField({
  id,
  label = "Password",
  labelAction,
  error,
  hint,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  label?: string;
  labelAction?: ReactNode;
  error?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="relative">
        <Input id={id} type={visible ? "text" : "password"} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="h-10 bg-background px-3 pr-10" {...props} />
        <button type="button" onClick={() => setVisible((current) => !current)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={visible ? "Hide password" : "Show password"}>
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function GoogleMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-4 items-center justify-center rounded-full bg-[conic-gradient(from_210deg,#34a853_0deg_90deg,#4285f4_90deg_180deg,#ea4335_180deg_270deg,#fbbc05_270deg_360deg)] text-[10px] font-bold text-white shadow-sm"
    >
      G
    </span>
  );
}
