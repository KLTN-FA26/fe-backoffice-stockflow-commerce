"use client";

import { useState } from "react";
import { cn } from "cn";
import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { vi } from "react-day-picker/locale";

import { DATE_PICKER_YEAR_SPAN, UI_LABELS } from "@/constants";
import {
  dayOfLocal,
  localToDateTimeText,
  maskDateTimeInput,
  maskTimeInput,
  parseDateTimeInput,
  parseTimeInput,
  timeOfLocal,
  todayIso,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { FORM_INPUT_CLASS } from "./form-control-classes";

import type { Ref } from "react";

const L = UI_LABELS.dateTimePicker;
const ISO_DATE = "yyyy-MM-dd";
/** Một ngày giờ đã gõ đủ: dd/MM/yyyy HH:mm. */
const FULL_LENGTH = 16;
const FULL_TIME_LENGTH = 5;
/** Giờ điền sẵn khi chọn một ngày mà ô còn trống. */
const FALLBACK_TIME = "08:00";

/** Nút chọn nhanh dưới ô. `value` tính lúc bấm (`yyyy-MM-ddTHH:mm` giờ Việt Nam); "" = bỏ trống ô. */
export interface QuickDateTime {
  label: string;
  value: () => string;
}

interface DateTimePickerProps {
  /** `yyyy-MM-ddTHH:mm` giờ Việt Nam ("" = chưa nhập) — đúng giá trị `<input type="datetime-local">` từng giữ. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /**
   * Sớm nhất / muộn nhất (`yyyy-MM-ddTHH:mm`): lịch khoá ngày ngoài khoảng và ô đổi viền báo lỗi khi giờ gõ nằm ngoài.
   * Giờ gõ ngoài khoảng VẪN báo về `onChange` — caller kiểm và nói rõ lý do (như ô gốc).
   */
  min?: string;
  max?: string;
  placeholder?: string;
  /** Cho xoá hết chữ về "" (ô không bắt buộc). */
  clearable?: boolean;
  /** Nút chọn nhanh dưới ô (vd "Sớm nhất" = "", "Hôm nay 08:30"). */
  quick?: QuickDateTime[];
  disabled?: boolean;
  onBlur?: () => void;
  ref?: Ref<HTMLInputElement>;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

function toDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const date = parseISO(iso);
  return isValid(date) ? date : undefined;
}

/**
 * Ô ngày giờ dd/MM/yyyy HH:mm, 24 giờ: GÕ được (gõ liền 12 chữ số, "/" ":" và dấu cách tự thêm) + nút lịch (chọn ngày,
 * gõ giờ) + nút chọn nhanh. Thay cho `<input type="datetime-local">` gốc của trình duyệt (kiểu Mỹ `mm/dd/yyyy`, AM/PM).
 * Giá trị vẫn là `yyyy-MM-ddTHH:mm` giờ Việt Nam nên chỗ đổi ra Instant gửi BE giữ nguyên.
 */
export function DateTimePicker({
  value,
  onChange,
  id,
  min,
  max,
  placeholder = L.placeholder,
  clearable = false,
  quick,
  disabled,
  onBlur,
  ref,
  className,
  ...ariaProps
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [timeDraft, setTimeDraft] = useState<string | null>(null);
  const selected = toDate(dayOfLocal(value));
  const minDay = dayOfLocal(min);
  const maxDay = dayOfLocal(max);
  const today = todayIso();
  const year = Number(today.slice(0, 4));

  const text = draft ?? localToDateTimeText(value);
  const outOfRange = (local: string) => (!!min && local < min) || (!!max && local > max);
  const invalid =
    (draft !== null && draft.length === FULL_LENGTH && parseDateTimeInput(draft) === null) ||
    (value !== "" && outOfRange(value));

  const handleType = (raw: string) => {
    const masked = maskDateTimeInput(raw);
    setDraft(masked);
    if (masked === "") {
      if (clearable) onChange("");
      return;
    }
    const local = parseDateTimeInput(masked);
    if (local) onChange(local);
  };

  const pickDay = (day: string) => {
    onChange(`${day}T${timeOfLocal(value) || FALLBACK_TIME}`);
    setDraft(null);
  };

  const handleTime = (raw: string) => {
    const masked = maskTimeInput(raw);
    setTimeDraft(masked);
    const time = parseTimeInput(masked);
    if (time) {
      onChange(`${dayOfLocal(value) || today}T${time}`);
      setDraft(null);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
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
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          maxLength={FULL_LENGTH}
          onChange={(event) => handleType(event.target.value)}
          onBlur={() => {
            setDraft(null);
            onBlur?.();
          }}
          aria-label={ariaProps["aria-label"]}
          aria-describedby={ariaProps["aria-describedby"]}
          aria-invalid={ariaProps["aria-invalid"] || invalid || undefined}
          className="placeholder:text-ink-tertiary min-w-0 flex-1 bg-transparent px-2.5 outline-none"
        />
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            setTimeDraft(null);
          }}
        >
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
              formatters={{ formatWeekdayName: (date) => format(date, "EEEEE", { locale: vi }) }}
              selected={selected}
              today={toDate(today)}
              defaultMonth={selected ?? toDate(minDay)}
              startMonth={new Date(year - DATE_PICKER_YEAR_SPAN.back, 0)}
              endMonth={new Date(year + DATE_PICKER_YEAR_SPAN.ahead, 11)}
              disabled={[
                ...(toDate(minDay) ? [{ before: toDate(minDay) as Date }] : []),
                ...(toDate(maxDay) ? [{ after: toDate(maxDay) as Date }] : []),
              ]}
              autoFocus
              onSelect={(date) => {
                if (date) pickDay(format(date, ISO_DATE));
              }}
            />
            <div className="border-border-default flex items-center gap-2 border-t p-2">
              <label htmlFor={id ? `${id}-time` : undefined} className="text-ink-secondary text-xs">
                {L.time}
              </label>
              <input
                id={id ? `${id}-time` : undefined}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={FULL_TIME_LENGTH}
                value={timeDraft ?? timeOfLocal(value)}
                placeholder={L.timePlaceholder}
                onChange={(event) => handleTime(event.target.value)}
                onBlur={() => setTimeDraft(null)}
                className={cn(FORM_INPUT_CLASS, "h-8 w-20 px-2 text-center tabular-nums")}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
                className="ml-auto"
              >
                {L.done}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {quick && quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <Button
              key={q.label}
              type="button"
              variant="outline"
              size="xs"
              disabled={disabled}
              onClick={() => {
                setDraft(null);
                onChange(q.value());
              }}
            >
              {q.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
