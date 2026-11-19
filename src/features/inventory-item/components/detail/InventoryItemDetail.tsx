"use client";

import { useState } from "react";

import { INVENTORY_ITEM_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { inventoryItemCapabilities } from "../../lifecycle";
import { useInventoryItem } from "../../queries";
import { ItemDetailError } from "./ItemDetailError";
import { ItemLogisticsCard } from "./ItemLogisticsCard";
import { ItemStockRulesCard } from "./ItemStockRulesCard";

export type ItemEditing = "logistics" | null;

function InventoryItemDetailContent({ id }: { id: string }) {
  const [editing, setEditing] = useState<ItemEditing>(null);
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang): thiếu thì không gọi API; UPDATE chỉ để hiện
  // nút Sửa. UI-only — Backend phải re-check (BE `InventoryItemController` @RequiresPermission).
  const { canRead, canEdit } = inventoryItemCapabilities(usePermissionChecker());
  const query = useInventoryItem(id, { enabled: canRead });
  // Breadcrumb hiện SKU thay vì UUID của BE
  useBreadcrumbLabel(id, query.data?.sku);

  if (!canRead) return <ItemDetailError kind="no-read" />;
  if (query.isError) {
    return (
      <ItemDetailError kind="error" error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  if (query.isPending) return <PageSkeleton variant="detail" />;

  const item = query.data;
  const done = () => setEditing(null);

  return (
    // Giao diện kiểu Vercel như chi tiết sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có SKU và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{item.sku}</h1>
      {/* Logistics (sửa được) cạnh chính sách tồn cố định (chỉ đọc) */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ItemLogisticsCard
          item={item}
          editing={editing}
          canEdit={canEdit}
          onEdit={() => setEditing("logistics")}
          onDone={done}
        />
        <ItemStockRulesCard />
      </div>
    </div>
  );
}

export function InventoryItemDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[INVENTORY_ITEM_PERMISSIONS.viewPage]}>
      <InventoryItemDetailContent id={id} />
    </PermissionBoundary>
  );
}
