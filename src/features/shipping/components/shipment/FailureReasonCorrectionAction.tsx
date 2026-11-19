"use client";

import { useState } from "react";
import { PencilLine } from "lucide-react";

import { SHIPMENT_FAILURE_REASON_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { hasFailureReason } from "@/features/shipping/failure-reason-schemas";
import { Button } from "@/components/ui/button";

import { FailureReasonCorrectionDialog } from "./FailureReasonCorrectionDialog";

import type { ShipmentRow } from "@/features/shipping/types";

const C = UI_LABELS.shipping.afterHandover.reasonCorrection;

/**
 * Nút "Sửa lý do thất bại" của lô đã giao thất bại / đã hoàn (docs 09 edge "hoàn hàng khi còn Handed Over"), chỉ khi có
 * quyền sửa tay kết quả giao. UI-only — Backend phải re-check quyền và trạng thái (409 SHIPMENT_FAILURE_REASON_LOCKED).
 */
export function FailureReasonCorrectionAction({ shipment }: { shipment: ShipmentRow }) {
  const canCorrect = useCan(SHIPMENT_FAILURE_REASON_PERMISSIONS.correct);
  const [open, setOpen] = useState(false);
  if (!canCorrect || !hasFailureReason(shipment)) return null;
  return (
    <div className="flex justify-end">
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <PencilLine className="size-3.5" /> {C.button}
      </Button>
      {open && <FailureReasonCorrectionDialog shipment={shipment} onClose={() => setOpen(false)} />}
    </div>
  );
}
