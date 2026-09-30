"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SchedulePickerProps {
  value?: string;
  onChange: (isoDate: string | undefined) => void;
  disabled?: boolean;
  timezone?: string;
}

export function SchedulePicker({ value, onChange, disabled, timezone }: SchedulePickerProps) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;
  const timeValue = date ? format(date, "HH:mm") : "09:00";

  const updateDateTime = (newDate: Date | undefined, time: string) => {
    if (!newDate) {
      onChange(undefined);
      return;
    }
    const [hours, minutes] = time.split(":").map(Number);
    const combined = new Date(newDate);
    combined.setHours(hours, minutes, 0, 0);
    onChange(combined.toISOString());
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            disabled={disabled}
            render={<Button variant="outline" className={cn("flex-1 justify-start font-normal", !date && "text-muted-foreground")} />}
          >
            <CalendarIcon />
            {date ? format(date, "EEE, MMM d") : "Pick a date"}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(day) => {
                updateDateTime(day, timeValue);
                setOpen(false);
              }}
              disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </PopoverContent>
        </Popover>
        <Input
          type="time"
          aria-label="Time"
          value={timeValue}
          className="w-[6.5rem] bg-surface"
          disabled={!date || disabled}
          onChange={(event) => date && updateDateTime(date, event.target.value)}
        />
        {date && !disabled && (
          <Button variant="ghost" size="icon" onClick={() => onChange(undefined)} aria-label="Clear schedule">
            <X />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {date ? `Goes out ${format(date, "EEEE, MMMM d 'at' h:mm a")}` : "Leave empty to publish manually after approval."}
        {timezone ? ` · ${timezone}` : ""}
      </p>
    </div>
  );
}
