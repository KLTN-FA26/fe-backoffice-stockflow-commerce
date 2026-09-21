"use client";

import { useMemo } from "react";

import { computePoStats, formatCompactVND } from "@/features/purchase-order";

import type { PurchaseOrder } from "@/features/purchase-order";
import {
  CheckCircle,
  ClipboardCheck,
  Clock,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
  Truck,
} from "lucide-react";

export function usePoStats(filtered: readonly PurchaseOrder[]) {
  return useMemo(() => {
    const s = computePoStats(filtered);
    return [
      { label: "Tổng PO", value: String(s.total), icon: ShoppingCart },
      { label: "Nháp", value: String(s.draft), icon: Clock },
      { label: "Đã duyệt", value: String(s.approved), icon: ClipboardCheck },
      { label: "Đã gửi", value: String(s.sent), icon: CheckCircle },
      { label: "Nhận một phần", value: String(s.partiallyReceived), icon: Truck },
      { label: "Đã đóng", value: String(s.closed + s.closedShort), icon: PackageCheck },
      { label: "Tổng giá trị", value: formatCompactVND(s.totalValueVND), icon: ReceiptText },
    ];
  }, [filtered]);
}
