"use client";

import Link from "next/link";
import { cn } from "cn";
import { BookOpen } from "lucide-react";

import { INVENTORY_LABELS, INVENTORY_ROUTES, STOCK_MOVEMENT_LABELS } from "@/constants/inventory";
import { MOVE_LABELS, MOVE_LIMITS } from "@/constants/move";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { hasPermission, useMyPermissions } from "@/lib/auth";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ListToolbar, TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { useMovements } from "../queries";
import { InventoryError } from "./InventoryFeedback";
import { buildMovementColumns } from "./inventory-columns";

import type { ReactNode } from "react";

// Mọi dòng đều là MOVE (chip "Loại biến động" đã nói) — bỏ cột loại để bảng gọn, đỡ cuộn ngang
const MOVEMENT_COLUMNS = buildMovementColumns().filter((column) => column.key !== "type");
const SECONDARY_ACTION_CLASS = cn(
  "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted",
  TOOLBAR_ACTION_CLASS,
);
// Danh sách cố định (loại MOVE, kho của tab, N lần gần nhất) — một dòng chữ để đọc, không phải chip của thanh Cấu hình
const NOTE = `${INVENTORY_LABELS.movementType}: ${STOCK_MOVEMENT_LABELS.MOVE} · ${MOVE_LABELS.recentShown}: ${MOVE_LABELS.recentShownValue(MOVE_LIMITS.recentSize)}`;

/**
 * Danh sách chính của trang Di chuyển nội bộ: các lần chuyển vị trí gần đây của một kho — sổ kho lọc `type=MOVE` +
 * `warehouseId` (BE `GET /inventory/movements`, inventory-stock-movements:READ). Toolbar chuẩn Mode A: `actions` do trang
 * ghép (nút tạo lệnh của feature move) + link "Xem sổ kho". Không có quyền đọc sổ kho → vẫn có toolbar để tạo lệnh,
 * thân trang chỉ là ghi chú, không gọi API.
 */
export function RecentMoves({
  warehouseId,
  actions,
}: {
  warehouseId: string;
  actions?: ReactNode;
}) {
  const permissions = useMyPermissions();
  // Nothing while the permissions load: a user who may read the ledger must not see "no access".
  if (permissions.isPending) return null;
  const canRead = hasPermission(permissions.data, INVENTORY_PERMISSIONS.movementRead);
  return (
    <>
      <ListToolbar
        summaryItems={[]}
        note={NOTE}
        onResetAll={() => undefined}
        resetDisabled
        actions={
          <>
            {canRead && (
              <Button asChild variant="outline" size="sm" className={SECONDARY_ACTION_CLASS}>
                <Link href={INVENTORY_ROUTES.movements}>
                  <BookOpen className="text-dot-info size-3.5" />
                  {MOVE_LABELS.recentAll}
                </Link>
              </Button>
            )}
            {actions}
          </>
        }
      />
      {canRead ? (
        <RecentMovesList warehouseId={warehouseId} />
      ) : (
        <p className="text-ink-secondary text-sm">{MOVE_LABELS.recentUnavailable}</p>
      )}
    </>
  );
}

function RecentMovesList({ warehouseId }: { warehouseId: string }) {
  const query = useMovements({ page: 0, size: MOVE_LIMITS.recentSize, type: "MOVE", warehouseId });
  if (query.isLoading) return <PageSkeleton variant="list" />;
  if (query.isError)
    return <InventoryError error={query.error} retry={() => void query.refetch()} />;
  return (
    <section aria-label={MOVE_LABELS.recentTitle} aria-busy={query.isFetching}>
      <RefetchBar active={query.isFetching} label={MOVE_LABELS.recentFetching} className="mb-2" />
      <DataTable
        stickyHeader
        columns={MOVEMENT_COLUMNS}
        data={query.data?.items ?? []}
        rowKey={(row) => row.movementId}
        caption={MOVE_LABELS.recentTitle}
        emptyState={<EmptyState title={MOVE_LABELS.recentEmpty} />}
      />
    </section>
  );
}
