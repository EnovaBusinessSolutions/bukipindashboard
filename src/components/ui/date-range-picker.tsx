import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  value?: DateRange;
  onChange: (range?: DateRange) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = "Selecciona un rango",
  disabled,
}: Props) {
  const label = React.useMemo(() => {
    if (!value?.from) return placeholder;
    if (!value.to) return format(value.from, "dd/MM/yyyy", { locale: es });
    return `${format(value.from, "dd/MM/yyyy", { locale: es })} – ${format(
      value.to,
      "dd/MM/yyyy",
      { locale: es }
    )}`;
  }, [value, placeholder]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {label}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            numberOfMonths={2} // 👈 estilo Airbnb
            selected={value}
            onSelect={onChange}
            locale={es}
            defaultMonth={value?.from ?? new Date()}
          />

          {/* Footer opcional */}
          <div className="flex items-center justify-between gap-2 border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(undefined)}
            >
              Limpiar
            </Button>

            <div className="text-xs text-muted-foreground">
              {value?.from && !value?.to ? "Elige la fecha fin" : " "}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
