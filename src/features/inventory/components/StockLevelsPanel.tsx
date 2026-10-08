"use client";

import { useMemo } from "react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";

import { codeCell, numberCell, textCell } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZE } from "@/constants/table";

import { INVENTORY_COPY } from "../constants";
import { selectStockLevels } from "../stock-levels";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { StockLevelRow } from "../types";

export function StockLevelsPanel({
  rows,
  onSelect,
}: {
  rows: StockLevelRow[];
  onSelect: (row: StockLevelRow) => void;
}) {
  const [query, setQuery] = useQueryState("inventoryQ", parseAsString.withDefault(""));
  const [warehouseCode, setWarehouseCode] = useQueryState(
    "inventoryWarehouse",
    parseAsString.withDefault("all"),
  );
  const [page, setPage] = useQueryState("inventoryPage", parseAsInteger.withDefault(1));
  const [size, setSize] = useQueryState(
    "inventoryPageSize",
    parseAsInteger.withDefault(PAGE_SIZE.sm),
  );

  const warehouses = useMemo(
    () => Array.from(new Map(rows.map((row) => [row.warehouse.code, row.warehouse])).values()),
    [rows],
  );
  const result = useMemo(
    () =>
      selectStockLevels(rows, {
        query,
        warehouseCode,
        page,
        size: [10, 15, 20, 50].includes(size) ? size : PAGE_SIZE.sm,
      }),
    [rows, query, warehouseCode, page, size],
  );
  const columns: ColumnDef<StockLevelRow>[] = [
    codeCell<StockLevelRow>("sku", "SKU", (row) => row.sku, {
      onClick: onSelect,
    }),
    textCell("product", "Sản phẩm", (row) => row.productName ?? "—", { color: "primary" }),
    textCell("warehouse", "Kho", (row) => row.warehouse.name ?? row.warehouse.code),
    numberCell("onHand", "Tồn thực tế", (row) => row.onHand),
    numberCell("reserved", "Đã giữ", (row) => row.reserved),
    numberCell("available", "Khả dụng", (row) => row.available),
    numberCell("atp", "ATP", (row) => row.atp),
  ];
  const clearFilters = () => {
    void setQuery("");
    void setWarehouseCode("all");
    void setPage(1);
  };

  return (
    <section aria-labelledby="inventory-stock-levels" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="inventory-stock-levels" className="text-ink-primary font-semibold">
            Stock Levels
          </h2>
          <p className="text-ink-tertiary text-xs">{INVENTORY_COPY.mockTableNote}</p>
        </div>
        <span className="text-ink-secondary text-xs">{result.totalElements} dòng</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <SearchBar
          value={query}
          onChange={(value) => {
            void setQuery(value);
            void setPage(1);
          }}
          aria-label="Tìm SKU hoặc sản phẩm"
          placeholder="Tìm SKU hoặc sản phẩm…"
          className="max-w-md"
        />
        <Select
          value={warehouseCode}
          onValueChange={(value) => {
            void setWarehouseCode(value);
            void setPage(1);
          }}
        >
          <SelectTrigger aria-label="Lọc theo kho" className="bg-bg-surface h-9 min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả kho</SelectItem>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.code} value={warehouse.code}>
                {warehouse.name ?? warehouse.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={INVENTORY_COPY.empty} />
      ) : result.totalElements === 0 ? (
        <EmptyState
          title={INVENTORY_COPY.noResults}
          action={<Button onClick={clearFilters}>{INVENTORY_COPY.clearFilters}</Button>}
        />
      ) : (
        <div className="overflow-x-auto">
          <DataTable
            data={result.rows}
            columns={columns}
            rowKey={(row) => row.id}
            onRowClick={onSelect}
            serverPagination={{
              page: result.page - 1,
              size: [10, 15, 20, 50].includes(size) ? size : PAGE_SIZE.sm,
              totalElements: result.totalElements,
              totalPages: result.totalPages,
              hasNext: result.page < result.totalPages,
              hasPrevious: result.page > 1,
              onPageChange: (nextPage) => void setPage(nextPage + 1),
              onPageSizeChange: (nextSize) => {
                void setSize(nextSize);
                void setPage(1);
              },
            }}
          />
        </div>
      )}
    </section>
  );
}
