"use client";

import { useState } from "react";

import { FormField, TextInput } from "../../shared/form-parts";

/** Đọc số người dùng gõ (nhận dấu phẩy thập phân); trống → `null`, sai → `undefined`. */
function parse(raw: string, integer: boolean): number | null | undefined {
  const text = raw.trim().replace(",", ".");
  if (text === "") return null;
  if (!/^\d+(\.\d+)?$/.test(text)) return undefined;
  const value = Number(text);
  return integer && !Number.isInteger(value) ? undefined : value;
}

/**
 * Ô số commit khi rời ô hoặc Enter — gõ dở ("1,") không đẩy vào bản nháp; kéo trên canvas cập nhật lại
 * ô ngay. `optional`: để trống = không giới hạn (`null`). Số đo căn phải, tabular-nums.
 */
export function NumberField({
  id,
  label,
  value,
  onCommit,
  integer = false,
  optional = false,
  disabled,
}: {
  id: string;
  label: string;
  value: number | null;
  onCommit: (value: number | null) => void;
  integer?: boolean;
  optional?: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const next = parse(text, integer);
    setText(null);
    if (next === undefined || (next === null && !optional) || next === value) return;
    onCommit(next);
  };
  return (
    <FormField id={id} label={label}>
      <TextInput
        id={id}
        inputMode={integer ? "numeric" : "decimal"}
        autoComplete="off"
        disabled={disabled}
        value={text ?? (value === null ? "" : String(value))}
        onFocus={() => setText(value === null ? "" : String(value))}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="text-right tabular-nums"
      />
    </FormField>
  );
}
