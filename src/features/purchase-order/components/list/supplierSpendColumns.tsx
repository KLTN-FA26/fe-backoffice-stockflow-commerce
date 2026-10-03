import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { SupplierSpendRow } from "@/features/purchase-order";

/** `fallbackCurrency` = tiền tệ đang lọc, dùng khi BE chưa có field `currency` (trước #40). */
export const spendColumns = (fallbackCurrency: string): ColumnDef<SupplierSpendRow>[] => [
  {
    key: "supplierCode",
    header: UI_LABELS.purchaseOrder.supplierCode,
    cell: (r) => <span className="font-mono text-[0.8125rem] tabular-nums">{r.supplierCode}</span>,
  },
  { key: "supplierName", header: UI_LABELS.purchaseOrder.supplier, cell: (r) => r.supplierName },
  {
    key: "totalSpend",
    header: "Tổng chi",
    align: "right",
    // BE #40: mỗi dòng là một cặp NCC + tiền tệ — hiện đúng tiền tệ của dòng.
    cell: (r) => (
      <span className="font-[family-name:var(--font-mono)] tabular-nums">
        {formatMoney(r.totalSpend, r.currency ?? fallbackCurrency)}
      </span>
    ),
  },
  {
    key: "purchaseOrderCount",
    header: "Số PO",
    align: "right",
    cell: (r) => <span className="tabular-nums">{r.purchaseOrderCount}</span>,
  },
];
