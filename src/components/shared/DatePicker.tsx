"use client";

import { useState } from "react";
import { cn } from "cn";
import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { vi } from "react-day-picker/locale";

import { DATE_PICKER_YEAR_SPAN, UI_LABELS } from "@/constants";
import { addDaysIso, isoToDateText, maskDateInput, parseDateInput, todayIso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { FORM_INPUT_CLASS } from "./form-control-classes";

import type { Ref } from "react";

const L = UI_LABELS.datePicker;
const ISO_DATE = "yyyy-MM-dd";
/** Một ngày đã gõ đủ: dd/MM/yyyy. */
const FULL_DATE_LENGTH = 10;

/** Nút chọn nhanh trong lịch — `value` là `YYYY-MM-DD`. */
export interface QuickDate {
  label: string;
  value: string;
}

interface DatePickerProps {
  /** Ngày `YYYY-MM-DD` ("" = chưa chọn) — cùng định dạng `<input type="date">` mà form/URL đang giữ. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /** Ngày nhỏ nhất / lớn nhất chọn được (`YYYY-MM-DD`); ngày ngoài khoảng bị mờ, không bấm được, gõ vào cũng không nhận. */
  min?: string;
  max?: string;
  placeholder?: string;
  /** Cho xoá về "" (ô lọc). Ô bắt buộc thì để `false` — bấm lại ngày đang chọn / xoá chữ không bỏ chọn. */
  clearable?: boolean;
  /**
   * Nút chọn nhanh trong lịch (vd "Hết hạn báo giá"). Bỏ trống → Hôm qua / Hôm nay / Ngày mai / +7 ngày; nút nào
   * nằm ngoài `min`–`max` thì không hiện.
   */
  quickDates?: QuickDate[];
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  ref?: Ref<HTMLInputElement>;
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

function defaultQuickDates(today: string): QuickDate[] {
  return [
    { label: L.yesterday, value: addDaysIso(today, -1) },
    { label: L.today, value: today },
    { label: L.tomorrow, value: addDaysIso(today, 1) },
    { label: L.nextWeek, value: addDaysIso(today, 7) },
  ];
}

/**
 * Ô ngày dd/MM/yyyy: GÕ được (gõ liền 8 chữ số, dấu "/" tự thêm) + nút lịch (shadcn Calendar trong Popover: dropdown
 * tháng / năm, ←/→/↑/↓ di chuyển, Enter chọn, Esc đóng) + nút ngày nhanh. Tab đi tiếp sang ô sau, KHÔNG bật lịch —
 * chỉ nút lịch mới mở. Thay cho `<input type="date">` gốc (kiểu Mỹ tháng/ngày). Giá trị vẫn là `YYYY-MM-DD`.
 * Không chứa nghiệp vụ — ràng buộc ngày do caller truyền qua `min` / `max`.
 *
 * Gõ dở thì chưa báo về `onChange` (chỉ ngày thật, đủ, trong `min`–`max`; ô lọc `clearable` xoá hết chữ thì báo ""),
 * rời ô khi còn dở thì ô về lại ngày đang giữ.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = L.placeholder,
  clearable = false,
  quickDates,
  className,
  disabled,
  autoFocus,
  onBlur,
  ref,
  id,
  ...ariaProps
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  /** Chữ đang gõ dở; null = không gõ, ô hiện đúng `value`. */
  const [draft, setDraft] = useState<string | null>(null);
  const selected = toDate(value);
  const minDate = toDate(min);
  const maxDate = toDate(max);
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const inRange = (day: string) =>
    (min === undefined || min === "" || day >= min) &&
    (max === undefined || max === "" || day <= max);
  const quick = (quickDates ?? defaultQuickDates(today)).filter((q) => inRange(q.value));

  const text = draft ?? isoToDateText(value);
  const typedFull = draft !== null && draft.length === FULL_DATE_LENGTH;
  const typedDay = typedFull ? parseDateInput(draft) : null;
  const typedInvalid = typedFull && (typedDay === null || !inRange(typedDay));

  const commit = (next: string) => {
    setDraft(null);
    onChange(next);
    setOpen(false);
  };

  const handleType = (raw: string) => {
    const masked = maskDateInput(raw);
    setDraft(masked);
    if (masked === "") {
      if (clearable) onChange("");
      return;
    }
    const day = parseDateInput(masked);
    if (day && inRange(day)) onChange(day);
  };

  return (
    <div
      className={cn(
        FORM_INPUT_CLASS,
        "focus-within:border-brand focus-within:ring-brand/20 flex w-full items-center gap-1 pr-1 tabular-nums focus-within:ring-3",
        "has-[input[aria-invalid=true]]:border-danger",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <input
        id={id}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        maxLength={FULL_DATE_LENGTH}
        onChange={(event) => handleType(event.target.value)}
        onBlur={() => {
          setDraft(null);
          onBlur?.();
        }}
        aria-label={ariaProps["aria-label"]}
        aria-describedby={ariaProps["aria-describedby"]}
        aria-invalid={ariaProps["aria-invalid"] || typedInvalid || undefined}
        className="placeholder:text-ink-tertiary min-w-0 flex-1 bg-transparent px-2.5 outline-none"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={disabled}
            aria-label={L.openCalendar}
            className="text-ink-tertiary hover:text-ink-primary shrink-0"
          >
            <CalendarIcon className="size-3.5" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto gap-0 p-0">
          <Calendar
            mode="single"
            locale={vi}
            captionLayout="dropdown"
            // Mặc định vi in "Th 2…" (dạng short) — tràn ô 28px, dính nhau; dạng narrow "T2…CN" vừa ô.
            formatters={{ formatWeekdayName: (date) => format(date, "EEEEE", { locale: vi }) }}
            selected={selected}
            // "Hôm nay" của lịch mặc định là ngày theo giờ máy; min / max và nút Hôm nay theo giờ Việt Nam.
            // Máy ngoài UTC+7 sẽ lệch một ngày trong một phần ngày và ô hôm nay bị khoá.
            today={toDate(today)}
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
          <div className="border-border-default flex flex-wrap items-center gap-1 border-t p-2">
            {quick.map((q) => (
              <Button
                key={q.label}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => commit(q.value)}
              >
                {q.label}
              </Button>
            ))}
            {clearable && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!selected}
                onClick={() => commit("")}
                className="ml-auto"
              >
                {L.clear}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
