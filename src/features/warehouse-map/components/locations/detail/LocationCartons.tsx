"use client";

import { Package } from "lucide-react";

import {
  PAGE_SIZE,
  STOCK_PACKAGE_API_STATUSES,
  STOCK_PACKAGE_PERMISSIONS,
  STOCK_PACKAGE_STATUS_BY_API,
  WAREHOUSE_LOCATION_LABELS as L,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { formatNumber } from "@/lib/format";

import { useLocationCartons } from "@/features/warehouse-map/queries";

import { CELL, EmptyCell } from "@/components/shared/column-helpers";
import { CopyButton } from "@/components/shared/CopyButton";
import { DataTable } from "@/components/shared/DataTable";
import { DetailSection } from "@/components/shared/DetailSection";
import { StatusDot } from "@/components/shared/StatusDot";

import { SectionState } from "./SectionState";

import type { LocationCarton } from "@/features/warehouse-map/api-cartons";
import type { ColumnDef } from "@/components/shared/DataTable";

const D = L.detail;

/** Trạng thái thùng BE → chuỗi của `StatusDot` (Title Case, nhãn ở status-map); giá trị lạ giữ nguyên. */
const packageStatus = (status: string) => {
  const known = STOCK_PACKAGE_API_STATUSES.find((value) => value === status);
  return known ? STOCK_PACKAGE_STATUS_BY_API[known] : status;
};

const COLUMNS: ColumnDef<LocationCarton>[] = [
  {
    key: "lpn",
    header: D.lpn,
    cell: (carton) => (
      <span className="flex items-center gap-1">
        <span className={CELL.ref}>{carton.lpn}</span>
        <CopyButton value={carton.lpn} />
      </span>
    ),
  },
  {
    key: "sku",
    header: L.column.skus,
    cell: (carton) => (carton.sku ? <span className={CELL.ref}>{carton.sku}</span> : <EmptyCell />),
  },
  {
    key: "lot",
    header: D.lot,
    cell: (carton) =>
      carton.lotNumber ? <span className={CELL.ref}>{carton.lotNumber}</span> : <EmptyCell />,
  },
  {
    key: "remaining",
    header: `${D.remaining} / ${D.nominal}`,
    align: "right",
    cell: (carton) => (
      <span className={CELL.number}>
        {formatNumber(carton.onHand ?? 0)} / {formatNumber(carton.nominalQty ?? 0)}
      </span>
    ),
  },
  {
    key: "reserved",
    header: L.column.reserved,
    align: "right",
    cell: (carton) => <span className={CELL.number}>{formatNumber(carton.reserved ?? 0)}</span>,
  },
  {
    key: "status",
    header: L.column.status,
    cell: (carton) =>
      carton.status ? (
        <StatusDot domain="stock" status={packageStatus(carton.status)} />
      ) : (
        <EmptyCell />
      ),
  },
];

/**
 * Thùng (LPN) đang nằm ở vị trí — trang đầu, sắp theo LPN, mỗi mã có nút sao chép để dán vào ô quét thay vì phải in
 * tem. Vị trí nhiều thùng hơn một trang → báo đang hiện bao nhiêu / tổng.
 */
export function LocationCartons({
  locationCode,
  enabled,
}: {
  locationCode: string;
  enabled: boolean;
}) {
  const canRead = useCan(STOCK_PACKAGE_PERMISSIONS.read) && enabled;
  const query = useLocationCartons(locationCode, canRead);
  const page = query.data;
  return (
    <DetailSection title={page ? `${D.cartons} · ${page.total}` : D.cartons} icon={Package}>
      <SectionState
        canRead={canRead}
        noPermission={D.cartonsNoPermission}
        isPending={query.isPending}
        error={query.error}
      >
        {page && page.items.length === 0 ? (
          <p className="text-ink-tertiary text-xs">{D.noCartons}</p>
        ) : (
          <>
            {page && page.total > page.items.length && (
              <p className="text-ink-tertiary mb-2 text-xs">
                {D.cartonsTruncated(page.items.length, page.total)}
              </p>
            )}
            <DataTable
              columns={COLUMNS}
              data={page?.items ?? []}
              rowKey={(carton) => carton.lpn}
              caption={D.cartons}
              pageSize={PAGE_SIZE.sm}
            />
          </>
        )}
      </SectionState>
    </DetailSection>
  );
}
