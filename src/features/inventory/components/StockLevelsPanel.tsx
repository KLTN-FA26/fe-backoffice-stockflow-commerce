"use client";

import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";

import { STORAGE_KEYS } from "@/constants/storage-keys";

import { usePageConfig } from "@/hooks/use-page-config";

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

import { INVENTORY_COPY } from "../constants";
import { DEFAULT_INVENTORY_PAGE_CONFIG, mergeInventoryPageConfig } from "../page-config";
import { selectStockLevels } from "../stock-levels";
import { stockLevelColumns } from "./stock-level-columns";

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
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminInventoryConfig,
    DEFAULT_INVENTORY_PAGE_CONFIG,
    mergeInventoryPageConfig,
  );
  const size = config.pageSize;

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
        size,
      }),
    [rows, query, warehouseCode, page, size],
  );
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
            columns={stockLevelColumns(onSelect)}
            rowKey={(row) => row.id}
            onRowClick={onSelect}
            serverPagination={{
              page: result.page - 1,
              size,
              totalElements: result.totalElements,
              totalPages: result.totalPages,
              hasNext: result.page < result.totalPages,
              hasPrevious: result.page > 1,
              onPageChange: (nextPage) => void setPage(nextPage + 1),
              onPageSizeChange: (nextSize) => {
                updateConfig((current) => ({ ...current, pageSize: nextSize }));
                void setPage(1);
              },
            }}
          />
        </div>
      )}
    </section>
  );
}
