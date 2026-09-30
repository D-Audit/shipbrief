"use client";

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
      className="shrink-0 rounded-full"
      onClick={() => onSelect(action)}
      disabled={disabled}
    >
      {action.label}
    </Button>
  );
}
