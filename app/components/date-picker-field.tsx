import { useState } from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  formatYmdDisplay,
  localDateToYmd,
  todayYmd,
  tomorrowYmd,
  ymdToLocalDate,
} from "~/lib/temporal-fields";
import { cn } from "~/lib/utils";

type Props = {
  name: string;
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  "aria-invalid"?: boolean;
  className?: string;
  placeholder?: string;
};

/**
 * ShadCN calendar date picker for Conform forms.
 * Stores YYYY-MM-DD in a hidden input; open state is client-only UI.
 */
export function DatePickerField({
  name,
  id,
  value = "",
  onChange,
  error,
  "aria-invalid": ariaInvalid,
  className,
  placeholder = "Pick a date",
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = ymdToLocalDate(value);
  const label = formatYmdDisplay(value);
  const invalid = ariaInvalid || Boolean(error);

  const pickYmd = (next: string) => {
    onChange?.(next);
    setOpen(false);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <input type="hidden" name={name} id={id} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            data-empty={!label}
            aria-invalid={invalid || undefined}
            className={cn(
              "w-full justify-start text-left font-normal",
              "data-[empty=true]:text-muted-foreground",
            )}
          >
            <CalendarIcon data-icon="inline-start" />
            {label ?? <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex gap-2 border-b border-border/70 p-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => pickYmd(todayYmd())}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => pickYmd(tomorrowYmd())}
            >
              Tomorrow
            </Button>
          </div>
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              pickYmd(date ? localDateToYmd(date) : "");
            }}
          />
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
