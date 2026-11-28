"use client";

import { ScanLine } from "lucide-react";

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
      {/* Cùng dáng với ô quét `ScanInput` (R10): cao 48px, biểu tượng quét, chữ mono cỡ thường */}
      <div className="relative">
        <ScanLine className="text-accent pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" />
        <Input
          id="put-back-lpn"
          value={value}
          autoComplete="off"
          spellCheck={false}
          placeholder={P.lpnPlaceholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "put-back-lpn-error" : "put-back-lpn-hint"}
          className={`border-border-default bg-bg-surface dark:bg-bg-surface focus-visible:border-brand focus-visible:ring-brand/20 h-12 rounded-[var(--r-sm)] pl-11 text-base tracking-wide md:text-base ${MONO}`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
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
