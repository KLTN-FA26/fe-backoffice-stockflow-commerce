import { ClipboardCheck, FileText, Layers, Package } from "lucide-react";

import type { Currency } from "@/features/purchase-order";

export type StepKey = "info" | "lines" | "totals" | "review";

export type FormState = {
  supplierId: string;
  orderDate: string;
  expectedDate: string;
  currency: Currency;
  paymentTerms: string;
  notes: string;
  lines: PoLineDraft[];
};

export type PoLineDraft = {
  id: string;
  skuId: string;
  orderedQty: string;
  unitPrice: string;
  taxRate: string;
  discountRate: string;
  uom: string;
  description: string;
};

export type ValidationIssue = {
  step: StepKey;
  message: string;
};

export type Totals = {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
};

export const STEPS: { key: StepKey; label: string; icon: typeof FileText }[] = [
  { key: "info", label: "Thông tin PO", icon: FileText },
  { key: "lines", label: "Dòng hàng", icon: Layers },
  { key: "totals", label: "Tổng cộng", icon: Package },
  { key: "review", label: "Tạo PO", icon: ClipboardCheck },
];

export const INITIAL_FORM: FormState = {
  supplierId: "",
  orderDate: "2026-06-10",
  expectedDate: "",
  currency: "VND",
  paymentTerms: "",
  notes: "",
  lines: [],
};
