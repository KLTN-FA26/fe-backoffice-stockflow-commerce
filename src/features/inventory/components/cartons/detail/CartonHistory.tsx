"use client";

import { History } from "lucide-react";

import { CARTON_LIST_LABELS as L, INVENTORY_PERMISSIONS, PAGE_SIZE } from "@/constants";
import { useCan } from "@/lib/auth";
import { formatDateTime, formatNumber } from "@/lib/format";

import { useMovements } from "@/features/inventory/queries";
import { movementTypeLabel } from "@/features/inventory/selectors";

import { Alert } from "@/components/shared/Alert";
import { CELL, EmptyCell, StackText } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { DetailSection } from "@/components/shared/DetailSection";
import { Skeleton } from "@/components/shared/Skeleton";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { StockMovement } from "@/features/inventory/types";

const D = L.detail;
const NONE = "—";

const COLUMNS: ColumnDef<StockMovement>[] = [
  {
    key: "at",
    header: D.occurredAt,
    cell: (m) => <span className={CELL.date}>{formatDateTime(m.occurredAt)}</span>,
  },
  {
    key: "type",
    header: D.movementType,
    cell: (m) => <span className={CELL.text}>{movementTypeLabel(m.type)}</span>,
  },
  {
    key: "fromTo",
    header: D.fromTo,
    cell: (m) => (
      <StackText
        mono
        main={`${m.fromLocation ?? NONE} → ${m.toLocation ?? NONE}`}
        sub={m.fromLpn !== m.toLpn ? `${m.fromLpn ?? NONE} → ${m.toLpn ?? NONE}` : undefined}
      />
    ),
  },
  {
    key: "qty",
    header: D.quantity,
    align: "right",
    cell: (m) => <span className={CELL.number}>{formatNumber(m.quantity)}</span>,
  },
  {
    key: "actor",
    header: D.actor,
    cell: (m) => (m.actorName ? <span className={CELL.text}>{m.actorName}</span> : <EmptyCell />),
  },
];

/**
 * Lịch sử di chuyển của một thùng: dòng sổ tồn có thùng ở phía đi HOẶC phía đến (BE `GET /inventory/movements?lpn=`,
 * #460 / issue #455), mới nhất trước. Cần `inventory-stock-movements:READ` — UI-only, BE re-check.
 */
export function CartonHistory({ lpn }: { lpn: string }) {
  const canRead = useCan(INVENTORY_PERMISSIONS.movementRead);
  const query = useMovements({ page: 0, size: PAGE_SIZE.xl, lpn }, canRead);
  const rows = query.data?.items ?? [];
  return (
    <DetailSection title={D.history} icon={History}>
      {!canRead ? (
        <p className="text-ink-tertiary text-xs">{D.historyNoPermission}</p>
      ) : query.isError ? (
        <Alert tone="danger">{D.loadFailed}</Alert>
      ) : query.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-ink-tertiary text-xs">{D.noHistory}</p>
      ) : (
        <DataTable
          columns={COLUMNS}
          data={rows}
          rowKey={(m) => m.movementId}
          caption={D.history}
          pageSize={PAGE_SIZE.sm}
        />
      )}
    </DetailSection>
  );
}
