"use client";

import { useMemo } from "react";
import {
  CheckCircle,
  ClipboardCheck,
  Clock,
  Hourglass,
  PackageCheck,
  ReceiptText,
  Truck,
  XCircle,
} from "lucide-react";

import { PO_STATUS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import type { PoStatus, PoStatusCount } from "@/features/purchase-order";

export function usePoStats(counts: readonly PoStatusCount[] | undefined) {
  return useMemo(() => {
    const byStatus = new Map((counts ?? []).map((r) => [r.status, r.count] as const));
    const n = (k: PoStatus) => String(byStatus.get(k) ?? 0);
    // Cùng nhãn với StatusBadge — một nguồn duy nhất (status-map).
    const lbl = (k: PoStatus) => STATUS_LABEL_VI[k] ?? k;
    return [
      { label: lbl(PO_STATUS.DRAFT), value: n(PO_STATUS.DRAFT), icon: Clock },
      {
        label: lbl(PO_STATUS.PENDING_APPROVAL),
        value: n(PO_STATUS.PENDING_APPROVAL),
        icon: Hourglass,
      },
      { label: lbl(PO_STATUS.APPROVED), value: n(PO_STATUS.APPROVED), icon: ClipboardCheck },
      { label: lbl(PO_STATUS.CONFIRMED), value: n(PO_STATUS.CONFIRMED), icon: CheckCircle },
      {
        label: lbl(PO_STATUS.PARTIALLY_RECEIVED),
        value: n(PO_STATUS.PARTIALLY_RECEIVED),
        icon: Truck,
      },
      { label: lbl(PO_STATUS.RECEIVED), value: n(PO_STATUS.RECEIVED), icon: ReceiptText },
      { label: lbl(PO_STATUS.CLOSED), value: n(PO_STATUS.CLOSED), icon: PackageCheck },
      { label: lbl(PO_STATUS.CANCELLED), value: n(PO_STATUS.CANCELLED), icon: XCircle },
    ];
  }, [counts]);
}
