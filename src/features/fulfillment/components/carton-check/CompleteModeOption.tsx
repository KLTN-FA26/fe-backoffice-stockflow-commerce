"use client";

type Mode = "full" | "partial";

/** Lựa chọn cách hoàn tất: đủ thùng cả đơn / giao một phần. */
export function CompleteModeOption({
  value,
  current,
  label,
  hint,
  disabled,
  onChange,
}: {
  value: Mode;
  current: Mode;
  label: string;
  hint: string;
  disabled: boolean;
  onChange: (mode: Mode) => void;
}) {
  return (
    <label
      className={`border-border-default flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] border p-2.5 ${disabled ? "opacity-60" : ""}`}
    >
      <input
        type="radio"
        name="complete-mode"
        value={value}
        checked={current === value}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="accent-brand mt-1"
      />
      <span>
        <span className="text-ink-primary block text-[0.8125rem] font-medium">{label}</span>
        <span className="text-ink-secondary block text-xs">{hint}</span>
      </span>
    </label>
  );
}
