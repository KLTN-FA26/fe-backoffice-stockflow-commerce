"use client";

import Link from "next/link";
import { Map as MapIcon } from "lucide-react";

import {
  ADMIN_ROUTES,
  UI_LABELS,
  WAREHOUSE_COLUMNS as C,
  WAREHOUSE_STATUS,
  WAREHOUSE_STATUS_LABELS,
} from "@/constants";
import { formatNumber } from "@/lib/format";

import { CELL, codeCell, ToneDot, textCell } from "@/components/shared/column-helpers";
import { Badge } from "@/components/ui/badge";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Warehouse } from "@/features/warehouse-map/types";

const L = UI_LABELS.warehouseMap;

/** "60 × 40 m" — khung bản đồ theo đơn vị của kho (chỉ mét, BR-13). */
export const formatMapSize = (row: Pick<Warehouse, "mapWidth" | "mapHeight">) =>
  `${formatNumber(row.mapWidth)} × ${formatNumber(row.mapHeight)} m`;

/**
 * Cột danh mục kho; nút "Mở bản đồ" chỉ khi được xem bản đồ (`warehouse-locations:READ`). Kho không được gán có nhãn
 * "Không được gán" (spec 2026-11-22 §5.3) — vẫn mở được bản đồ, vì bản đồ không giới hạn theo kho được gán (06).
 */
export function buildWarehouseColumns({
  canOpenMap,
  isAssigned = () => true,
}: {
  canOpenMap: boolean;
  isAssigned?: (prefix: string) => boolean;
}) {
  const col = L.column;
  const columns: ColumnDef<Warehouse>[] = [
    codeCell<Warehouse>(C.PREFIX, col.prefix, (row) => row.prefix),
    {
      key: C.NAME,
      header: col.name,
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-ink-primary truncate">{row.name}</span>
          {!isAssigned(row.prefix) && (
            <Badge variant="outline" className="shrink-0">
              {L.workspace.notAssignedBadge}
            </Badge>
          )}
        </span>
      ),
    },
    textCell<Warehouse>(C.ADDRESS, col.address, (row) => row.address),
    {
      key: C.MAP_SIZE,
      header: col.mapSize,
      align: "right",
      cell: (row) => <span className={CELL.number}>{formatMapSize(row)}</span>,
    },
    {
      key: C.STATUS,
      header: col.status,
      cell: (row) => (
        <ToneDot
          tone={row.status === WAREHOUSE_STATUS.ACTIVE ? "positive" : "muted"}
          label={WAREHOUSE_STATUS_LABELS[row.status]}
        />
      ),
    },
    {
      key: C.ACTIONS,
      header: "",
      cell: (row) => (
        <div className="flex justify-end">
          <Link
            href={ADMIN_ROUTES.warehouseMap.of(row.prefix)}
            aria-label={`${L.openMap} ${row.prefix}`}
            title={L.openMap}
            onClick={(event) => event.stopPropagation()}
            className={CELL.action}
          >
            <MapIcon className="size-3.5" />
          </Link>
        </div>
      ),
    },
  ];
  return canOpenMap ? columns : columns.filter((column) => column.key !== C.ACTIONS);
}
