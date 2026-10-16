"use client";

import Link from "next/link";
import { X } from "lucide-react";

import { ADMIN_ROUTES, PO_PERMISSIONS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { Can } from "@/lib/auth";
import { EmptyState } from "@/components/shared/EmptyState";
import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { PoLoadError } from "../PoLoadError";
import { PoListTable } from "./PoListTable";
import { usePoListColumns } from "./usePoListColumns";

import type { PoListController } from "./usePoListController";

const L = UI_LABELS.purchaseOrder;

export function PoOrdersTab({ c }: { c: PoListController }) {
  const columns = usePoListColumns({
    supplierRefs: c.supplierRefs,
    columnSearch: c.config.columnSearch,
    onColumnSearch: c.updateColumnSearch,
    onNavigate: (po) => c.router.push(ADMIN_ROUTES.purchaseOrders.detail(po.poId)),
  });
  const visibleColumns = columns.filter((col) => c.config.visibleColumns.includes(col.key));
  const hasServerFilter = c.filters.status.length > 0 || c.supplierId !== "";

  if (!c.canRead) return <PoLoadError error={null} kind="no-read" inline />;

  return (
    <>
      <ListStatsPanel
        stats={c.stats}
        open={c.config.showStats}
        gridClassName="lg:grid-cols-4 xl:grid-cols-7"
      />
      {c.supplierId && (
        <div className="mb-3 flex items-center gap-2 text-[0.8125rem]">
          <span className="text-ink-secondary">{L.supplierFilter}:</span>
          <Badge variant="outline" className="gap-1">
            {c.filterSupplierLabel}
            <button
              type="button"
              aria-label={L.clearSupplierFilter}
              onClick={() => c.setSupplierId("")}
              className="hover:text-ink-primary"
            >
              <X className="size-3" />
            </button>
          </Badge>
        </div>
      )}
      <PoListTable c={c} page={c.page} columns={visibleColumns} body={body(c, hasServerFilter)} />
    </>
  );
}

/** Thân danh sách khi KHÔNG hiện bảng: lỗi / đang tải / hai loại rỗng (§8). */
function body(c: PoListController, hasServerFilter: boolean): React.ReactNode | undefined {
  // `?supplierId=` không phải UUID → BE 400. Không báo "không tìm thấy đơn": lỗi nằm ở bộ lọc.
  if (
    c.poQ.isError &&
    c.supplierId &&
    c.poQ.error instanceof ApiError &&
    c.poQ.error.status === 400
  ) {
    return (
      <EmptyState
        title={L.invalidSupplierFilterTitle}
        description={L.invalidSupplierFilterDescription}
        action={
          <Button variant="outline" size="sm" onClick={() => c.setSupplierId("")}>
            {L.clearSupplierFilter}
          </Button>
        }
      />
    );
  }
  if (c.poQ.isError) {
    return <PoLoadError error={c.poQ.error} onRetry={() => void c.poQ.refetch()} inline />;
  }
  if (!c.page) return <PageSkeleton variant="list" />;
  if (c.page.totalElements > 0) return undefined;
  if (hasServerFilter) {
    return (
      <EmptyState
        title="Không tìm thấy đơn đặt hàng"
        description="Không có đơn nào khớp bộ lọc trạng thái / nhà cung cấp."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              c.filters.setStatus([]);
              c.setSupplierId("");
            }}
          >
            Bỏ bộ lọc
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      title="Chưa có đơn đặt hàng"
      description="Tạo đơn đầu tiên để bắt đầu mua hàng từ nhà cung cấp."
      action={
        <Can permission={PO_PERMISSIONS.create}>
          <Button size="sm" asChild>
            <Link href={ADMIN_ROUTES.purchaseOrders.create}>{L.createAction}</Link>
          </Button>
        </Can>
      }
    />
  );
}
