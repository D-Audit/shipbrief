"use client";

import { WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AIAction } from "@/types";

export function AIActionButton({
  action,
  onSelect,
  disabled,
}: {
  action: AIAction;
  onSelect: (action: AIAction) => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => onSelect(action)}
      disabled={disabled}
    >
      <WandSparkles className="text-primary" />
      {action.label}
    </Button>
  );
}
