"use client";

import { Label } from "@/components/ui/label";

import { FieldError } from "../primitives";
import { CodeCombobox } from "./CodeCombobox";

import type { ComponentProps } from "react";

/** Một ô chọn mã của form kho: nhãn + `CodeCombobox` + lỗi inline (ô trỏ `aria-describedby` tới lỗi). */
export function CodeField({
  id,
  label,
  error,
  ...combobox
}: Omit<ComponentProps<typeof CodeCombobox>, "hasError" | "describedBy"> & { error?: string }) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-ink-primary text-[0.8125rem] font-medium">
        {label}
      </Label>
      <CodeCombobox
        id={id}
        label={label}
        hasError={!!error}
        describedBy={error ? errorId : undefined}
        {...combobox}
      />
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
