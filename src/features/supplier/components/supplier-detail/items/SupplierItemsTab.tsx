"use client";

import { useState } from "react";
import { Info, PackageSearch, Plus } from "lucide-react";

import { INVENTORY_ITEM_PERMISSIONS, SUPPLIER_ITEM_UI_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { supplierItemActions } from "@/features/supplier";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { SupplierLoadError } from "../../SupplierLoadError";
import { buildSupplierItemColumns } from "./supplier-item-columns";
import { SupplierItemFormDialog } from "./SupplierItemFormDialog";
import {
  ITEM_PAGE_SIZE_OPTIONS,
  useSupplierItemDeletion,
  useSupplierItemsState,
} from "./useSupplierItemsState";

import type { SupplierDto, SupplierItem } from "@/features/supplier/types";

const L = SUPPLIER_ITEM_UI_LABELS;
// Lỗi quyền của tab nói về danh mục hàng, không về hồ sơ NCC
const ERRORS = { forbidden: L.forbiddenDescription };
const RADIUS = "rounded-[var(--r-sm)]";

/**
 * Tab "Danh mục hàng" của chi tiết NCC — SKU mua được từ NCC này kèm giá, MOQ, quy cách, lead time
 * (BE `SupplierItemController`, docs 02 §4 bước 5). Thao tác gate theo `supplierItemActions`.
 */
export function SupplierItemsTab({ supplier }: { supplier: SupplierDto }) {
  const can = usePermissionChecker();
  // UI-only — Backend phải re-check (@RequiresPermission procurement-supplier-items)
  const actions = supplierItemActions(supplier.status, can);
  const s = useSupplierItemsState(supplier.supplierId);
  const { query } = s;
  const [editing, setEditing] = useState<{ item: SupplierItem | null } | null>(null);
  const refetch = () => void query.refetch();
  const del = useSupplierItemDeletion(supplier.supplierId, refetch);

  const addButton = (label: string) =>
    actions.create ? (
      <Button type="button" size="sm" onClick={() => setEditing({ item: null })} className={RADIUS}>
        <Plus className="size-3.5" /> {label}
      </Button>
    ) : undefined;
  const loadError = (error: unknown, kind?: "network") => (
    <SupplierLoadError inline error={error} kind={kind} onRetry={refetch} descriptions={ERRORS} />
  );

  const renderBody = () => {
    // React Query v5 giữ `data` khi refetch nền lỗi → vẫn hiện bảng cũ, chỉ báo lỗi khi chưa có data
    if (query.isError && !query.data) return loadError(query.error);
    if (query.isPending && query.fetchStatus === "paused") return loadError(null, "network");
    if (query.isPending) return <PageSkeleton variant="list" />;
    if (s.emptyState === "invalid-page") {
      // `?itemPage=` vượt số trang (gõ tay, hoặc xoá dòng cuối của trang cuối) — khác danh mục rỗng
      return (
        <EmptyState
          icon={<PackageSearch className="size-8" />}
          title={L.invalidPageTitle}
          description={L.invalidPageDescription}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => s.changePage(0)}>
              {L.action.firstPage}
            </Button>
          }
        />
      );
    }
    if (s.emptyState === "empty") {
      return (
        <EmptyState
          icon={<PackageSearch className="size-8" />}
          title={L.empty}
          description={L.emptyDescription}
          action={addButton(L.action.addFirst)}
        />
      );
    }
    const page = query.data;
    return (
      <>
        <RefetchBar active={query.isFetching} label={L.refetching} />
        <DataTable
          columns={buildSupplierItemColumns({
            actions,
            // UI-only — Backend phải re-check (@RequiresPermission inventory-inventory-items:READ)
            canOpenInventoryItem: can(INVENTORY_ITEM_PERMISSIONS.read),
            onEdit: (item) => setEditing({ item }),
            onDelete: del.open,
          })}
          data={page.items}
          rowKey={(row) => row.supplierItemId}
          caption={L.caption(page.items.length, page.totalElements)}
          pageSize={s.pageSize}
          pageSizeOptions={ITEM_PAGE_SIZE_OPTIONS}
          serverPagination={{
            ...page,
            onPageChange: s.changePage,
            onPageSizeChange: s.changePageSize,
          }}
          serverSorting={{ key: s.sort.key, direction: s.sort.direction, onChange: s.changeSort }}
        />
      </>
    );
  };

  return (
    <section className="space-y-3" aria-label={L.tabTitle}>
      <div className="flex items-center justify-between gap-3">
        {supplier.status !== "Active" ? (
          <p className="text-ink-secondary flex items-center gap-1.5 text-[0.8125rem]">
            <Info className="text-info size-3.5 shrink-0" /> {L.inactiveNotice}
          </p>
        ) : (
          <span />
        )}
        {s.emptyState !== "empty" && addButton(L.action.add)}
      </div>
      {renderBody()}
      <SupplierItemFormDialog
        supplierId={supplier.supplierId}
        item={editing?.item ?? null}
        currency={query.data?.items[0]?.currency ?? null}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        onConflict={refetch}
      />
      <ConfirmDialog
        open={del.isOpen}
        onOpenChange={(open) => !open && del.close()}
        title={L.deleteTitle}
        description={
          del.target?.preferred
            ? `${L.deleteDescription(del.target.sku)} ${L.deletePreferredWarning}`
            : L.deleteDescription(del.target?.sku ?? "")
        }
        confirmLabel={L.action.delete}
        loading={del.isPending}
        closeOnConfirm={false}
        error={del.error}
        onConfirm={del.confirm}
      />
    </section>
  );
}
