"use client";

import { PUT_BACK_LABELS } from "@/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError, MONO } from "../primitives";

const P = PUT_BACK_LABELS;

/** Ô quét LPN của thùng cần cất lại — chỉ đúng LPN của dòng mới xác nhận được (docs 07 §4.5 bước 14). */
export function PutBackLpnField({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor="put-back-lpn" className="text-ink-primary text-[0.8125rem] font-medium">
        {P.lpn}
      </Label>
      <Input
        id="put-back-lpn"
        value={value}
        autoComplete="off"
        spellCheck={false}
        placeholder={P.lpnPlaceholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "put-back-lpn-error" : "put-back-lpn-hint"}
        className={`bg-bg-surface h-9 rounded-[var(--r-sm)] ${MONO}`}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <FieldError id="put-back-lpn-error">{error}</FieldError>
      ) : (
        <p id="put-back-lpn-hint" className="text-ink-tertiary text-xs">
          {P.lpnHint}
        </p>
      )}
    </div>
  );
}
