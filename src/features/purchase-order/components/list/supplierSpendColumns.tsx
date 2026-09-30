import { formatMoney } from "@/lib/format/money";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { SupplierSpendRow } from "@/features/purchase-order";

export const SPEND_COLUMNS: ColumnDef<SupplierSpendRow>[] = [
  {
    key: "supplierCode",
    header: "Mã NCC",
    cell: (r) => <span className="font-mono text-[0.8125rem] tabular-nums">{r.supplierCode}</span>,
  },
  { key: "supplierName", header: "Nhà cung cấp", cell: (r) => r.supplierName },
  {
    key: "totalSpend",
    header: "Tổng chi",
    align: "right",
    // BE sums totalAmount across POs without converting currency — shown as VND.
    cell: (r) => <span className="tabular-nums">{formatMoney(r.totalSpend, "VND")}</span>,
  },
  {
    key: "purchaseOrderCount",
    header: "Số PO",
    align: "right",
    cell: (r) => <span className="tabular-nums">{r.purchaseOrderCount}</span>,
  },
];
