"use client";

import { useMemo } from "react";

import { PO_STATUS } from "@/constants";

import type { PoStatusCount } from "@/features/purchase-order/api";

import {
  CheckCircle,
  ClipboardCheck,
  Clock,
  PackageCheck,
  ReceiptText,
  Truck,
  XCircle,
} from "lucide-react";

export function usePoStats(counts: readonly PoStatusCount[] | undefined) {
  return useMemo(() => {
    const byStatus = new Map((counts ?? []).map((r) => [r.status, r.count] as const));
    const n = (k: string) => String(byStatus.get(k) ?? 0);
    return [
      { label: "Nháp", value: n(PO_STATUS.DRAFT), icon: Clock },
      { label: "Đã duyệt", value: n(PO_STATUS.APPROVED), icon: ClipboardCheck },
      { label: "Đã gửi", value: n(PO_STATUS.SENT), icon: CheckCircle },
      { label: "Nhận một phần", value: n(PO_STATUS.PARTIALLY_RECEIVED), icon: Truck },
      { label: "Đã đóng", value: n(PO_STATUS.CLOSED), icon: PackageCheck },
      { label: "Đóng thiếu", value: n(PO_STATUS.CLOSED_SHORT), icon: ReceiptText },
      { label: "Đã huỷ", value: n(PO_STATUS.CANCELLED), icon: XCircle },
    ];
  }, [counts]);
}
