import { codeCell, numberCell, textCell } from "@/components/shared/column-helpers";

import { InventoryHighlights } from "./InventoryHighlights";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { StockLevelRow } from "../types";

export function stockLevelColumns(
  onSelect: (row: StockLevelRow) => void,
): ColumnDef<StockLevelRow>[] {
  return [
    codeCell<StockLevelRow>("sku", "SKU", (row) => row.sku, { onClick: onSelect }),
    textCell("product", "Sản phẩm", (row) => row.productName ?? "—", { color: "primary" }),
    textCell("warehouse", "Kho", (row) => row.warehouse.name ?? row.warehouse.code),
    numberCell("onHand", "Tồn thực tế", (row) => row.onHand),
    numberCell("reserved", "Đã giữ", (row) => row.reserved),
    numberCell("available", "Khả dụng", (row) => row.available),
    numberCell("atp", "ATP", (row) => row.atp),
    {
      key: "highlights",
      header: "Lưu ý",
      cell: (row) => (
        <InventoryHighlights highlights={[row.lowStockHighlight, row.availabilityHighlight]} />
      ),
    },
  ];
}
