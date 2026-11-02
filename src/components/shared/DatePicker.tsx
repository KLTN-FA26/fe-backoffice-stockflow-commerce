"use client";

import { useState } from "react";
import { cn } from "cn";
import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { vi } from "react-day-picker/locale";

import { DATE_PICKER_YEAR_SPAN, UI_LABELS } from "@/constants";
import { formatDate, toLocalIsoDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { FORM_INPUT_CLASS } from "./form-control-classes";

import type { Ref } from "react";

const L = UI_LABELS.datePicker;
const ISO_DATE = "yyyy-MM-dd";

interface DatePickerProps {
  /** Ngày `YYYY-MM-DD` ("" = chưa chọn) — cùng định dạng `<input type="date">` mà form/URL đang giữ. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /** Ngày nhỏ nhất / lớn nhất chọn được (`YYYY-MM-DD`); ngày ngoài khoảng bị mờ, không bấm được. */
  min?: string;
  max?: string;
  placeholder?: string;
  /** Cho xoá về "" (ô lọc). Ô bắt buộc thì để `false` — bấm lại ngày đang chọn không bỏ chọn. */
  clearable?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** `YYYY-MM-DD` → Date theo giờ máy (không lệch ngày như `new Date(iso)` ở UTC); sai định dạng → undefined. */
function toDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const date = parseISO(iso);
  return isValid(date) ? date : undefined;
}

/**
 * Ô chọn ngày kiểu Date Picker của shadcn: nút giống ô nhập mở Popover chứa `Calendar`
 * (dropdown tháng / năm, ←/→/↑/↓ di chuyển, Enter chọn, Esc đóng). Thay cho `<input type="date">`
 * gốc của trình duyệt. Không chứa nghiệp vụ — ràng buộc ngày do caller truyền qua `min` / `max`.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = L.placeholder,
  clearable = false,
  className,
  ...triggerProps
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const minDate = toDate(min);
  const maxDate = toDate(max);
  const today = toLocalIsoDate(new Date().toISOString());
  const year = Number(today.slice(0, 4));
  const todayOutOfRange = (min !== undefined && today < min) || (max !== undefined && today > max);

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            FORM_INPUT_CLASS,
            "w-full justify-between gap-2 px-2.5 font-normal tabular-nums",
            className,
            // Sau `className`: class ô nhập của caller thường có `text-ink-primary`.
            !selected && "text-ink-tertiary",
          )}
          {...triggerProps}
        >
          <span className="truncate">{selected ? formatDate(value) : placeholder}</span>
          <CalendarIcon className="text-ink-tertiary size-3.5 shrink-0" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <Calendar
          mode="single"
          locale={vi}
          captionLayout="dropdown"
          // Mặc định vi in "Th 2…" (dạng short) — tràn ô 28px, dính nhau; dạng narrow "T2…CN" vừa ô.
          formatters={{ formatWeekdayName: (date) => format(date, "EEEEE", { locale: vi }) }}
          selected={selected}
          defaultMonth={selected ?? minDate}
          startMonth={new Date(year - DATE_PICKER_YEAR_SPAN.back, 0)}
          endMonth={new Date(year + DATE_PICKER_YEAR_SPAN.ahead, 11)}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          autoFocus
          onSelect={(date) => {
            if (date) commit(format(date, ISO_DATE));
            else if (clearable) commit("");
            else setOpen(false);
          }}
        />
        <div className="border-border-default flex items-center justify-between border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={todayOutOfRange}
            onClick={() => commit(today)}
          >
            {L.today}
          </Button>
          {clearable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!selected}
              onClick={() => commit("")}
            >
              {L.clear}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
