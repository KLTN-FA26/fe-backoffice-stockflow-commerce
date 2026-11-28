"use client";

import { Tag } from "lucide-react";

import { cartonCheckHoldReasonLabel, UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import type { CartonCheckAccess } from "@/features/fulfillment/carton-check-lifecycle";

const L = UI_LABELS.cartonCheck;

/**
 * "Dán nhãn tất cả (n)". Đơn treo (WF4-K2): nút hiện nhưng tắt, lý do nằm ở chữ nhỏ cạnh nút — không giấu thao tác.
 * BE bỏ `holdReason` ở phiên thay thùng chuyến đã huỷ (RTM-RTDCANCEL) nên ở đó nút luôn mở.
 */
export function LabelAllButton({
  count,
  pending,
  access,
  holdReason,
  onLabel,
}: {
  count: number;
  pending: boolean;
  access: CartonCheckAccess;
  holdReason: string | null | undefined;
  onLabel: () => void;
}) {
  if (count === 0) return null;
  const blocked = holdReason ? L.hold.blocked(cartonCheckHoldReasonLabel(holdReason)) : undefined;
  return (
    <>
      <Button
        type="button"
        size="xs"
        disabled={pending || access.held}
        title={blocked}
        onClick={onLabel}
      >
        <Tag className="size-3" /> {L.action.labelAll} ({count})
      </Button>
      {blocked && <p className="text-ink-tertiary basis-full text-xs">{blocked}</p>}
    </>
  );
}
