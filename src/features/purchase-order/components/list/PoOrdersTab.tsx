"use client";

import { ADMIN_ROUTES } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import { Button } from "@/components/ui/button";

import { PoListTable } from "./PoListTable";
import { usePoListColumns } from "./usePoListColumns";

import type { usePoListController } from "./usePoListController";

export function PoOrdersTab({ c }: { c: ReturnType<typeof usePoListController> }) {
  const columns = usePoListColumns({
    suppliers: c.suppliers,
    warehouses: c.warehouses,
    columnSearch: c.config.columnSearch,
    onColumnSearch: c.updateColumnSearch,
    onNavigate: (po) => c.router.push(ADMIN_ROUTES.purchaseOrders.detail(po.poId)),
  });
  const visibleColumns = columns.filter((col) => c.config.visibleColumns.includes(col.key));

  return (
    <>
      <ListStatsPanel
        stats={c.stats}
        open={c.config.showStats}
        gridClassName="lg:grid-cols-4 xl:grid-cols-7"
      />
      {c.poQ.isError && (
        <Alert tone="danger" title="Không tải được danh sách PO" className="mb-3">
          <span>{c.poQ.error.message} </span>
          <Button type="button" size="sm" variant="outline" onClick={() => void c.poQ.refetch()}>
            Thử lại
          </Button>
        </Alert>
      )}
      {c.masterDataError && (
        <Alert tone="info" className="mb-3">
          Không tải được tên NCC/kho (BE chưa có API danh mục) — cột NCC/kho hiển thị mã.
        </Alert>
      )}
      <PoListTable c={c} columns={visibleColumns} />
    </>
  );
}
