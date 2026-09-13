"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SchedulePickerProps {
  value?: string;
  onChange: (isoDate: string | undefined) => void;
}

export function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;
  const timeValue = date
    ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    : "09:00";

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
      <Label>Schedule</Label>
      <div className="flex flex-wrap gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className={cn("justify-start font-normal", !date && "text-muted-foreground")}
              />
            }
          >
            <CalendarIcon className="size-4" />
            {date ? format(date, "PPP") : "Pick a date"}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                updateDateTime(d, timeValue);
                setOpen(false);
              }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </PopoverContent>
        </Popover>

        <div className="relative">
          <Clock className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="time"
            value={timeValue}
            className="w-[130px] pl-8"
            disabled={!date}
            onChange={(e) => date && updateDateTime(date, e.target.value)}
          />
        </div>

        {date && (
          <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            Clear
          </Button>
        )}
      </div>
      {date && (
        <p className="text-xs text-muted-foreground">
          Scheduled for {format(date, "PPP 'at' p")}
        </p>
      )}
    </div>
  );
}
