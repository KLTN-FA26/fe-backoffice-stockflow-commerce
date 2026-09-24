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
  uom: string;
  description: string;
};

export type ValidationIssue = {
  step: StepKey;
  message: string;
};

export type Totals = {
  subtotal: number;
  grandTotal: number;
};

export const STEPS: { key: StepKey; label: string; icon: typeof FileText }[] = [
  { key: "info", label: "Thông tin PO", icon: FileText },
  { key: "lines", label: "Dòng hàng", icon: Layers },
  { key: "totals", label: "Tổng cộng", icon: Package },
  { key: "review", label: "Tạo PO", icon: ClipboardCheck },
];

/** Seed khớp migration BE (supplier d0000001-… + SKU SOFA/TABLE) để test BE ngay — đổi sang rỗng khi không cần nữa. */
function demoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export const INITIAL_FORM: FormState = {
  supplierId: "d0000001-0000-4000-8000-000000000001", // Acme Supplies (SUP-001)
  orderDate: demoDate(0),
  expectedDate: demoDate(7),
  currency: "VND",
  paymentTerms: "NET30",
  notes: "PO demo — seed BE (Acme + SOFA-3S-GREY / TABLE-OAK-160)",
  lines: [
    {
      id: "seed-line-1",
      skuId: "d0000005-0000-4000-8000-000000000001", // SOFA-3S-GREY
      orderedQty: "10",
      unitPrice: "5000000",
      uom: "EACH",
      description: "3 Seater Sofa - Grey Fabric",
    },
    {
      id: "seed-line-2",
      skuId: "d0000005-0000-4000-8000-000000000002", // TABLE-OAK-160
      orderedQty: "5",
      unitPrice: "8000000",
      uom: "EACH",
      description: "Oak Dining Table 160cm - Natural Oak",
    },
  ],
};
