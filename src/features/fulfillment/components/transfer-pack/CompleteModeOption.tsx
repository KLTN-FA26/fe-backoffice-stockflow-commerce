"use client";

export type CompleteMode = "full" | "partial";

export function CompleteModeOption({
  value,
  current,
  label,
  hint,
  disabled,
  onChange,
}: {
  value: CompleteMode;
  current: CompleteMode;
  label: string;
  hint: string;
  disabled: boolean;
  onChange: (mode: CompleteMode) => void;
}) {
  return (
    <label
      className={`border-border-default flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] border p-2.5 ${disabled ? "opacity-60" : ""}`}
    >
      <input
        type="radio"
        name="transfer-complete-mode"
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
