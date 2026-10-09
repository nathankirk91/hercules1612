import { ClockIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  formatHm,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  parseHm,
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
};

/**
 * ShadCN hour/minute selects for Conform forms.
 * Stores HH:mm in a hidden input (24-hour).
 */
export function TimePickerField({
  name,
  id,
  value = "",
  onChange,
  error,
  "aria-invalid": ariaInvalid,
  className,
}: Props) {
  const parts = parseHm(value);
  const hour = parts?.hour;
  const minute = parts?.minute;
  const invalid = ariaInvalid || Boolean(error);

  const commit = (nextHour: string | undefined, nextMinute: string | undefined) => {
    if (!nextHour || !nextMinute) {
      onChange?.("");
      return;
    }
    onChange?.(formatHm(nextHour, nextMinute));
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <input type="hidden" name={name} id={id} value={value} />
      <div className="flex items-center gap-2">
        <ClockIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <Select
          value={hour}
          onValueChange={(nextHour) => {
            commit(nextHour, minute ?? "00");
          }}
        >
          <SelectTrigger
            aria-invalid={invalid || undefined}
            className="w-full min-w-0 flex-1"
            aria-label="Hour"
          >
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            {HOUR_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm font-medium text-muted-foreground" aria-hidden>
          :
        </span>
        <Select
          value={minute}
          onValueChange={(nextMinute) => {
            commit(hour ?? "00", nextMinute);
          }}
        >
          <SelectTrigger
            aria-invalid={invalid || undefined}
            className="w-full min-w-0 flex-1"
            aria-label="Minute"
          >
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            {MINUTE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
