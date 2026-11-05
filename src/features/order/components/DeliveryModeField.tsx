"use client";

import {
  ORDER_DELIVERY_MODE_LABELS,
  ORDER_DELIVERY_MODE_UI,
  ORDER_DELIVERY_MODES,
} from "@/constants";

import type { OrderDeliveryMode } from "../types";

interface DeliveryModeFieldProps {
  /** Hình thức đang chọn (hoặc hiện tại, khi chỉ đọc). */
  value: OrderDeliveryMode;
  onChange: (mode: OrderDeliveryMode) => void;
  /**
   * Thiếu mã quyền `sales-order-delivery-modes:UPDATE` (hoặc đơn đã khoá): chỉ hiện giá trị, không có ô chọn.
   * UI-only — Backend phải re-check (403 khi release với hình thức khác của đơn).
   */
  readOnly?: boolean;
  name: string;
}

/**
 * Chọn hình thức giao (LP-1): giao lẻ / nguyên xe. Hai lựa chọn ngang hàng nên dùng radio gốc (phím mũi tên,
 * đọc được bằng trình đọc màn hình) thay cho Select. Chỉ đọc → một dòng giá trị kèm lý do không đổi được.
 */
export function DeliveryModeField({
  value,
  onChange,
  readOnly = false,
  name,
}: DeliveryModeFieldProps) {
  const L = ORDER_DELIVERY_MODE_UI;
  if (readOnly) {
    return (
      <div>
        <p className="text-ink-secondary text-[0.8125rem]">{L.fieldLabel}</p>
        <p className="text-ink-primary mt-1 text-[0.8125rem] font-medium">
          {ORDER_DELIVERY_MODE_LABELS[value]}
        </p>
        <p className="text-ink-tertiary mt-1 text-xs">{L.readOnlyNote}</p>
      </div>
    );
  }
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="text-[0.8125rem]">{L.fieldLabel}</legend>
      <div className="mt-1 space-y-1.5">
        {ORDER_DELIVERY_MODES.map((mode) => (
          <label
            key={mode}
            className="border-border-default hover:bg-bg-muted has-[:checked]:border-ink-primary flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] border px-3 py-2"
          >
            <input
              type="radio"
              name={name}
              value={mode}
              checked={value === mode}
              onChange={() => onChange(mode)}
              className="accent-ink-primary mt-0.5"
            />
            <span>
              <span className="text-ink-primary block text-[0.8125rem] font-medium">
                {ORDER_DELIVERY_MODE_LABELS[mode]}
              </span>
              <span className="text-ink-tertiary block text-xs">{L.hint[mode]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
