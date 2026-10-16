import { ClipboardCheck, FileText, Layers, Package } from "lucide-react";

import { UI_LABELS } from "@/constants";

import type { PoCreateFormValues } from "@/features/purchase-order";

export type StepKey = "info" | "lines" | "totals" | "review";

/** Trạng thái một bước trên stepper — cùng nghĩa với wizard NCC. */
export type StepStatus = "active" | "done" | "error" | "idle";

/** BE PR #71: tạm tính (Σ SL × đơn giá), thuế (Σ thuế từng dòng), tổng = hai cái cộng lại. */
export type Totals = {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
};

export const STEPS: { key: StepKey; label: string; icon: typeof FileText }[] = [
  { key: "info", label: "Thông tin PO", icon: FileText },
  { key: "lines", label: UI_LABELS.purchaseOrder.lines, icon: Layers },
  { key: "totals", label: UI_LABELS.purchaseOrder.totals, icon: Package },
  { key: "review", label: UI_LABELS.purchaseOrder.createAction, icon: ClipboardCheck },
];

/**
 * Form rỗng — CHỈ các trường BE `CreatePurchaseOrderRequest` lưu (supplierId, warehouseId,
 * currency, expectedAt, lines). Không điền sẵn id NCC/SKU nào (không bịa dữ liệu).
 */
export const PO_CREATE_DEFAULTS: PoCreateFormValues = {
  supplierId: "",
  warehouseId: "",
  currency: "VND",
  expectedDate: "",
  note: "",
  lines: [{ skuId: "", description: "", orderedQty: "1", unitPrice: "", taxRate: "" }],
};
