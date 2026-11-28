"use client";

import { RETURN_RECEIVING_LABELS } from "@/constants/labels-return-receiving";
import { Button } from "@/components/ui/button";

import type { CandidateCarton } from "../types";

const S = RETURN_RECEIVING_LABELS.selected;

/**
 * Thùng vừa chọn từ danh sách (WF-05): chọn chưa phải là đã nhận — người dùng xem thùng thật, ghi tình trạng / số đếm ở
 * ô bên dưới rồi mới bấm "Ghi nhận thùng" (cùng đường gửi như quét LPN). Thùng phải mở đếm: nói rõ trần, không điền sẵn
 * số đếm.
 */
export function SelectedCartonBox({
  carton,
  busy,
  onRecord,
  onClear,
}: {
  carton: CandidateCarton;
  busy: boolean;
  onRecord: () => void;
  onClear: () => void;
}) {
  return (
    <section
      aria-label={S.title}
      className="border-border-default bg-bg-subtle space-y-2 rounded-[var(--card-radius)] border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-ink-primary text-[0.8125rem]">
          <span className="font-semibold">{S.title}: </span>
          <span className="font-[family-name:var(--font-mono)]">
            {S.summary(carton.lpn, carton.sku, carton.quantity)}
          </span>
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={onRecord}>
            {S.record}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onClear}>
            {S.clear}
          </Button>
        </div>
      </div>
      <p className="text-ink-secondary text-xs">
        {carton.eligibility === "COUNT_REQUIRED"
          ? S.countRequiredHint(carton.maxReceivableQuantity)
          : S.confirmHint}
      </p>
    </section>
  );
}
