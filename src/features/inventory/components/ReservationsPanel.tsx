"use client";

import { codeCell, numberCell, subCodeCell, textCell } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format/date";

import { INVENTORY_COPY } from "../constants";
import { useInventoryReservations } from "../queries";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { InventoryService } from "../service";
import type { ReservationRow } from "../types";

const columns: ColumnDef<ReservationRow>[] = [
  codeCell("order", "Đơn hàng", (row) => row.orderReference),
  subCodeCell("sku", "SKU", (row) => row.sku),
  numberCell("quantity", "Số lượng", (row) => row.quantity),
  textCell("warehouse", "Kho", (row) => row.warehouse.name ?? row.warehouse.code),
  textCell("location", "Vị trí", (row) => row.location ?? INVENTORY_COPY.noLocation),
  {
    key: "reservedAt",
    header: "Thời điểm giữ",
    cell: (row) => (
      <span className="text-ink-secondary text-[0.8125rem] tabular-nums">
        {row.reservedAt ? formatDateTime(row.reservedAt) : INVENTORY_COPY.noReservedAt}
      </span>
    ),
  },
  {
    key: "expiresAt",
    header: "Hết hạn",
    cell: (row) => (
      <span className="text-ink-secondary text-[0.8125rem] tabular-nums">
        {row.expiresAt ? formatDateTime(row.expiresAt) : INVENTORY_COPY.noReservationExpiry}
      </span>
    ),
  },
  textCell("status", "Trạng thái", (row) => row.status ?? INVENTORY_COPY.unknownReservationStatus),
];

export function ReservationsPanel({ service }: { service: InventoryService }) {
  const query = useInventoryReservations(service);

  return (
    <section
      aria-labelledby="inventory-reservations"
      className="border-border-default bg-bg-surface space-y-3 rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 id="inventory-reservations" className="text-ink-primary font-semibold">
        Reservations
      </h2>
      {query.isPending ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <EmptyState
          title={INVENTORY_COPY.reservationError}
          action={<Button onClick={() => void query.refetch()}>{INVENTORY_COPY.retry}</Button>}
        />
      ) : query.data.length === 0 ? (
        <EmptyState title={INVENTORY_COPY.noReservations} />
      ) : (
        <div className="overflow-x-auto">
          <DataTable data={query.data} columns={columns} rowKey={(row) => row.id} />
        </div>
      )}
    </section>
  );
}
