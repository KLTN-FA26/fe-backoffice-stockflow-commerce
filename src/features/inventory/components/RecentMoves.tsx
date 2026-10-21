"use client";

import Link from "next/link";

import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";
import { MOVE_LABELS, MOVE_LIMITS } from "@/constants/move";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { hasPermission, useMyPermissions } from "@/lib/auth";

import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";

import { useMovements } from "../queries";
import { InventoryError } from "./InventoryFeedback";
import { buildMovementColumns } from "./inventory-columns";

const MOVEMENT_COLUMNS = buildMovementColumns();

/**
 * Các lần chuyển vị trí gần đây — sổ kho lọc `type=MOVE` (BE `GET /inventory/movements`,
 * inventory-stock-movements:READ). Không có quyền đọc sổ kho thì chỉ hiện ghi chú, không gọi API.
 */
export function RecentMoves() {
  const permissions = useMyPermissions();
  // Nothing while the permissions load: a user who may read the ledger must not see "no access".
  if (permissions.isPending) return null;
  if (!hasPermission(permissions.data, INVENTORY_PERMISSIONS.movementRead)) {
    return <RecentMovesUnavailable />;
  }
  return <RecentMovesList />;
}

function RecentMovesUnavailable() {
  return <p className="text-ink-secondary text-sm">{MOVE_LABELS.recentUnavailable}</p>;
}

function RecentMovesList() {
  const query = useMovements({ page: 0, size: MOVE_LIMITS.recentSize, type: "MOVE" });
  return (
    <section
      aria-label={MOVE_LABELS.recentTitle}
      className="border-border-default bg-bg-surface space-y-[var(--el-gap)] rounded-[var(--r-sm)] border p-[var(--card-pad)]"
    >
      <div className="flex items-center justify-between gap-[var(--el-gap)]">
        <h2 className="text-ink-primary text-[0.9375rem] font-semibold">
          {MOVE_LABELS.recentTitle}
        </h2>
        <Button className="rounded-[var(--r-sm)]" asChild variant="outline" size="sm">
          <Link href={INVENTORY_ROUTES.movements}>{MOVE_LABELS.recentAll}</Link>
        </Button>
      </div>
      {query.isLoading ? (
        <p className="text-ink-tertiary text-sm">{INVENTORY_LABELS.fetching}</p>
      ) : query.isError ? (
        <InventoryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data?.items.length ? (
        <DataTable
          columns={MOVEMENT_COLUMNS}
          data={query.data.items}
          rowKey={(row) => row.movementId}
          caption={INVENTORY_LABELS.movementTitle}
        />
      ) : (
        <p className="text-ink-secondary text-sm">{MOVE_LABELS.recentEmpty}</p>
      )}
    </section>
  );
}
