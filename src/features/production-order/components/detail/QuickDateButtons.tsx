"use client";

import { PRODUCTION_LABELS } from "@/constants";
import { addDays, todayIso } from "@/lib/date-range";

import { Button } from "@/components/ui/button";

const D = PRODUCTION_LABELS.dialogs;

/** Nút ngày nhanh: ngày đơn vị sản xuất báo thường gần ngày cần hàng hoặc 1–2 tuần nữa; không tự điền, người dùng bấm chọn. */
const QUICK_OFFSETS = [7, 14] as const;

/**
 * Nút ngày nhanh của hộp ghi ngày hoàn thành dự kiến: bằng ngày cần hàng, sau 7 / 14 ngày. Chỉ điền khi người dùng bấm
 * (ngày do đơn vị sản xuất báo, không tự điền); nút có ngày đã qua thì khoá.
 */
export function QuickDateButtons({
  needByDate,
  value,
  required,
  onPick,
}: {
  needByDate: string;
  value: string;
  /** Ngày bắt buộc: chưa có thì nói vì sao nút Xác nhận đang khoá (R7). */
  required: boolean;
  onPick: (day: string) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={D.quickLabel}>
        {[
          { key: "needBy", label: D.quickNeedBy, value: needByDate },
          ...QUICK_OFFSETS.map((days) => ({
            key: `+${days}`,
            label: D.quickDays(days),
            value: addDays(todayIso(), days),
          })),
        ].map((quick) => (
          <Button
            key={quick.key}
            type="button"
            size="sm"
            variant="outline"
            disabled={quick.value < todayIso()}
            aria-pressed={value === quick.value}
            onClick={() => onPick(quick.value)}
            className="h-8 rounded-[var(--r-sm)] text-[0.8125rem]"
          >
            {quick.label}
          </Button>
        ))}
      </div>
      {required && !value && (
        <p role="status" className="text-ink-secondary text-xs">
          {D.expectedMissing}
        </p>
      )}
    </>
  );
}
