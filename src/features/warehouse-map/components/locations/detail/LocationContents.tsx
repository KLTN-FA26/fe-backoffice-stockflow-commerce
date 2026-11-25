"use client";

import { Boxes } from "lucide-react";

import { PAGE_SIZE, STOCK_PACKAGE_PERMISSIONS, WAREHOUSE_LOCATION_LABELS as L } from "@/constants";
import { stockStatusDisplay } from "@/constants/inventory";
import { useCan } from "@/lib/auth";
import { formatNumber } from "@/lib/format";

import { useLocationSummary } from "@/features/warehouse-map/queries";

import { CELL, EmptyCell } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { DetailSection } from "@/components/shared/DetailSection";
import { StatusDot } from "@/components/shared/StatusDot";

import { SectionState } from "./SectionState";

import type { LocationSummaryLine } from "@/features/warehouse-map/api-cartons";
import type { ColumnDef } from "@/components/shared/DataTable";

const D = L.detail;
/** Bảng phụ trong panel: đủ cho mọi SKU × lô × trạng thái của một vị trí, không phân trang. */
const SUMMARY_PAGE_SIZE = PAGE_SIZE.xl;

const qty = (key: string, header: string, pick: (line: LocationSummaryLine) => number) => ({
  key,
  header,
  align: "right" as const,
  cell: (line: LocationSummaryLine) => (
    <span className={CELL.number}>{formatNumber(pick(line))}</span>
  ),
});

const COLUMNS: ColumnDef<LocationSummaryLine>[] = [
  {
    key: "sku",
    header: L.column.skus,
    cell: (line) => <span className={CELL.ref}>{line.sku}</span>,
  },
  {
    key: "lot",
    header: D.lot,
    cell: (line) =>
      line.lotNumber ? <span className={CELL.ref}>{line.lotNumber}</span> : <EmptyCell />,
  },
  {
    key: "status",
    header: D.stockStatus,
    cell: (line) => <StatusDot domain="stock" status={stockStatusDisplay(line.status)} />,
  },
  qty("cartons", D.wholeCartons, (line) => line.wholeCartons),
  qty("cartonUnits", D.cartonUnits, (line) => line.wholeCartonUnits),
  qty("loose", D.looseUnits, (line) => line.looseUnits),
  qty("total", D.totalUnits, (line) => line.totalUnits),
];

/**
 * Hàng trong vị trí theo SKU, lô, trạng thái tồn (docs 20 §4.1; BE `location-summary`): số thùng, số cái trong thùng
 * và số cái lẻ (hàng trả lại, báo hỏng chưa đóng thùng). Nguồn sự thật tồn là tồn theo vị trí (BR-05).
 */
export function LocationContents({
  locationCode,
  enabled,
}: {
  locationCode: string;
  enabled: boolean;
}) {
  const canRead = useCan(STOCK_PACKAGE_PERMISSIONS.read) && enabled;
  const query = useLocationSummary(locationCode, canRead);
  return (
    <DetailSection title={D.contents} icon={Boxes}>
      <SectionState
        canRead={canRead}
        noPermission={D.contentsNoPermission}
        isPending={query.isPending}
        error={query.error}
      >
        {query.data && query.data.length === 0 ? (
          <p className="text-ink-tertiary text-xs">{D.noContents}</p>
        ) : (
          <DataTable
            columns={COLUMNS}
            data={query.data ?? []}
            rowKey={(line) => `${line.sku}|${line.lotNumber ?? ""}|${line.status}`}
            caption={D.contents}
            pageSize={SUMMARY_PAGE_SIZE}
          />
        )}
      </SectionState>
    </DetailSection>
  );
}
