"use client";

import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";

import { formatDate } from "@/lib/format/date";

import { ChoiceField } from "./ChoiceField";

import type { SalesOption } from "@/lib/references/sales-workload";

const L = SALES_OWNER_LABELS.picker;

function leaveNote(option: SalesOption): string | null {
  if (!option.onLeave) return null;
  if (option.coverName) return `${L.onLeave} (${L.coverBy(option.coverName)})`;
  return option.coverUntil ? L.onLeaveUntil(formatDate(option.coverUntil)) : L.onLeave;
}

/**
 * "Nguyễn A · tạm dừng nhận khách · đang nghỉ (B lo thay)" / "· đang nghỉ tới 05/12/2026" — người chọn thấy trạng thái
 * trước khi giao.
 */
export function salesOptionLabel(option: SalesOption, suggested = false): string {
  const notes = [
    suggested ? L.suggested : null,
    option.paused ? L.paused : null,
    leaveNote(option),
  ].filter(Boolean);
  return [option.name, ...notes].join(" · ");
}

/**
 * Ô chọn một Sale (combobox gõ để lọc). Danh sách lấy từ `useAssignableSales` (D42: chỉ SALES_STAFF đang làm). Tạm dừng /
 * đang nghỉ vẫn chọn được — chỉ là thông tin (BR-S04 chỉ cấm tài khoản không còn làm; BE kiểm
 * `SALES_OWNER_NOT_ASSIGNABLE`).
 */
export function SalesPickerField({
  options,
  suggestedId,
  hint,
  placeholder = SALES_OWNER_LABELS.dialog.salesPlaceholder,
  ...field
}: {
  id: string;
  label: string;
  value: string;
  onChange: (userId: string) => void;
  options: readonly SalesOption[];
  error?: string;
  hint?: string;
  required?: boolean;
  suggestedId?: string | null;
  placeholder?: string;
}) {
  return (
    <ChoiceField
      {...field}
      placeholder={placeholder}
      hint={options.length === 0 ? L.empty : hint}
      options={options.map((option) => ({
        value: option.userId,
        label: salesOptionLabel(option, option.userId === suggestedId),
      }))}
    />
  );
}
