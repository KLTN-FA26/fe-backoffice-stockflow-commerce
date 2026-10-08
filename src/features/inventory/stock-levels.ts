import type { StockLevelRow } from "./types";

/** Local mock-table projection. This is not a backend pagination or search contract. */
export function selectStockLevels(
  rows: StockLevelRow[],
  {
    query,
    warehouseCode,
    page,
    size,
  }: { query: string; warehouseCode: string; page: number; size: number },
) {
  const search = query.trim().toLocaleLowerCase("vi-VN");
  const filtered = rows.filter(
    (row) =>
      (warehouseCode === "all" || row.warehouse.code === warehouseCode) &&
      (!search ||
        row.sku.toLocaleLowerCase("vi-VN").includes(search) ||
        row.productName?.toLocaleLowerCase("vi-VN").includes(search)),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    rows: filtered.slice((safePage - 1) * size, safePage * size),
    totalElements: filtered.length,
    totalPages,
    page: safePage,
  };
}
