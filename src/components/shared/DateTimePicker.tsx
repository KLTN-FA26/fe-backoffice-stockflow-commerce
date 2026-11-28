"use client";

import { useId, useState } from "react";
import { cn } from "cn";
import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { vi } from "react-day-picker/locale";

import { DATE_INPUT, DATE_PICKER_YEAR_SPAN, UI_LABELS } from "@/constants";
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
import { useTypedField } from "./use-typed-field";

import type { Ref } from "react";

const L = UI_LABELS.dateTimePicker;
const ISO_DATE = "yyyy-MM-dd";
/** Một ngày giờ đã gõ đủ: dd/MM/yyyy HH:mm. */
const FULL_LENGTH = 16;
const LOCAL_VALUE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

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
  /**
   * Hiện lý do bằng chữ dưới ô khi ngày giờ gõ không nhận được / nằm ngoài `min`–`max` (mặc định có). Tắt khi form tự
   * hiện lỗi của ô (vd lỗi zod dưới ô) để khỏi hiện hai câu.
   */
  showReason?: boolean;
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
 *
 * Chữ gõ KHÔNG nhận được (dở, ngày 31/11, giờ 25:00) được báo về `onChange` NGUYÊN CHỮ — không phải một giá trị cũ hay
 * "" (rỗng thường nghĩa là "không chọn / càng sớm càng tốt") — để form giữ lỗi và chặn gửi; caller phải kiểm
 * `yyyy-MM-ddTHH:mm` (zod regex). Xoá hết chữ báo "". Chữ không nhận được vẫn nằm trong ô sau khi rời ô.
 */
export function DateTimePicker({
  value,
  onChange,
  id,
  min,
  max,
  placeholder = L.placeholder,
  showReason = true,
  quick,
  disabled,
  onBlur,
  ref,
  className,
  ...ariaProps
}: DateTimePickerProps) {
  const reasonId = useId();
  const timeId = useId();
  const { attachInput, keepCaret, label: fieldLabel } = useTypedField(ref);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [timeDraft, setTimeDraft] = useState<string | null>(null);
  const [blurred, setBlurred] = useState(false);
  // Giá trị đổi từ bên ngoài (đặt lại, nút chọn nhanh…) → bỏ chữ đang gõ; giá trị do chính ô báo thì không
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(null);
  }
  const selected = toDate(dayOfLocal(value));
  const minDay = dayOfLocal(min);
  const maxDay = dayOfLocal(max);
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const years = { min: year - DATE_PICKER_YEAR_SPAN.back, max: year + DATE_PICKER_YEAR_SPAN.ahead };

  const outOfRange = (local: string) => (!!min && local < min) || (!!max && local > max);
  const text = draft ?? localToDateTimeText(value);
  const typedFull = draft !== null && draft.length === FULL_LENGTH;
  const typedParsed = typedFull ? parseDateTimeInput(draft, years) : null;
  const valueOutOfRange = LOCAL_VALUE.test(value) && outOfRange(value);
  const reason = (() => {
    if (!showReason) return null;
    if (draft !== null && draft !== "") {
      if (typedFull && typedParsed === null) return L.invalid;
      if (!typedFull && blurred) return L.incomplete;
    }
    return valueOutOfRange ? L.outOfRange : null;
  })();
  // Viền đỏ cả khi caller tự hiện lỗi (showReason = false)
  const invalid =
    (draft !== null && draft !== "" && (typedFull ? typedParsed === null : blurred)) ||
    valueOutOfRange;

  const report = (next: string) => {
    setSynced(next);
    onChange(next);
  };

  const handleType = (input: HTMLInputElement) => {
    const masked = maskDateTimeInput(input.value);
    keepCaret(input, masked);
    setDraft(masked);
    setBlurred(false);
    if (masked === "") {
      report("");
      return;
    }
    // Đủ và đúng → `yyyy-MM-ddTHH:mm`; còn lại → chính chữ gõ (không nhận được, form báo lỗi)
    report(parseDateTimeInput(masked, years) ?? masked);
  };

  const pickDay = (day: string) => {
    report(`${day}T${timeOfLocal(value) || DATE_INPUT.fallbackTime}`);
    setDraft(null);
  };

  const handleTime = (raw: string) => {
    const masked = maskTimeInput(raw);
    setTimeDraft(masked);
    const time = parseTimeInput(masked);
    if (time) {
      report(`${dayOfLocal(value) || today}T${time}`);
      setDraft(null);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          FORM_INPUT_CLASS,
          "focus-within:border-brand focus-within:ring-brand/20 flex w-full items-center gap-1 pr-1 tabular-nums focus-within:ring-3",
          "has-[input[aria-invalid=true]]:border-danger has-[input[aria-invalid=true]]:focus-within:border-danger has-[input[aria-invalid=true]]:focus-within:ring-danger/20",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
      >
        <input
          id={id}
          ref={attachInput}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onChange={(event) => handleType(event.target)}
          onBlur={() => {
            setBlurred(true);
            // Chữ không nhận được ở lại trong ô cùng lý do; chữ hợp lệ thì hiện lại dạng chuẩn
            if (draft !== null && parseDateTimeInput(draft, years) !== null) setDraft(null);
            onBlur?.();
          }}
          aria-label={ariaProps["aria-label"]}
          aria-describedby={
            [ariaProps["aria-describedby"], reason ? reasonId : null].filter(Boolean).join(" ") ||
            undefined
          }
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
              aria-label={fieldLabel ? L.openCalendarFor(fieldLabel) : L.openCalendar}
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
              startMonth={new Date(years.min, 0)}
              endMonth={new Date(years.max, 11)}
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
              <label htmlFor={timeId} className="text-ink-secondary text-xs">
                {L.time}
              </label>
              <input
                id={timeId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={fieldLabel ? L.timeFor(fieldLabel) : L.time}
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
      {reason && (
        <p id={reasonId} className="text-danger text-xs">
          {reason}
        </p>
      )}
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
                report(q.value());
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
