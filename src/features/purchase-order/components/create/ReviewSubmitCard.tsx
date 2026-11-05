"use client";

import { Send, Settings2, ShoppingCart } from "lucide-react";

import { PO_STATUS, UI_LABELS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { Card } from "@/components/shared/Card";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

const DRAFT_LABEL = STATUS_LABEL_VI[PO_STATUS.DRAFT] ?? PO_STATUS.DRAFT;
const L = UI_LABELS.purchaseOrder;

/** Thẻ phải của bước Rà soát: trạng thái sau khi tạo / lưu (luôn Nháp) + nút gửi. */
export function ReviewSubmitCard({
  isEdit,
  submitLabel,
  onSubmit,
}: {
  isEdit: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) {
  return (
    <Card className="h-fit">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-ink-tertiary text-xs font-medium">
            {isEdit ? L.review.statusAfterSave : L.review.statusAfterCreate}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StatusDot domain="po" status={PO_STATUS.DRAFT} withIcon />
          </div>
        </div>
        <Settings2 className="text-accent size-5" />
      </div>
      <div className="border-border-default bg-bg-subtle text-ink-secondary rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]">
        <div className="text-ink-primary mb-1 flex items-center gap-2 font-medium">
          <ShoppingCart className="text-accent size-3.5" />
          {submitLabel} → {DRAFT_LABEL}
        </div>
        {isEdit ? L.draftEdit.afterSave : L.review.createHint(submitLabel, DRAFT_LABEL)}
      </div>
      <Button
        variant="default"
        type="button"
        size="sm"
        onClick={onSubmit}
        className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--r-sm)] px-3 py-2 text-[0.8125rem] font-medium transition-colors"
      >
        <Send className="size-3.5" />
        {submitLabel}
      </Button>
    </Card>
  );
}
