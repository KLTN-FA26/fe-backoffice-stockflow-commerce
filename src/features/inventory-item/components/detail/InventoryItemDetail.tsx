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
import { ItemEvaluationCard } from "./ItemEvaluationCard";
import { ItemLogisticsCard } from "./ItemLogisticsCard";
import { ItemPolicyCard } from "./ItemPolicyCard";

export type ItemEditing = "logistics" | "policy" | null;

function InventoryItemDetailContent({ id }: { id: string }) {
  const [editing, setEditing] = useState<ItemEditing>(null);
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang): thiếu thì không gọi API; UPDATE chỉ để hiện
  // nút Sửa. UI-only — Backend phải re-check (BE PR #119 @RequiresPermission).
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
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_320px]">
        {/* Logistics và chính sách tồn đứng cạnh nhau, mỗi khối một cột */}
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <ItemLogisticsCard
            item={item}
            editing={editing}
            canEdit={canEdit}
            onEdit={() => setEditing("logistics")}
            onDone={done}
          />
          <ItemPolicyCard
            item={item}
            editing={editing}
            canEdit={canEdit}
            onEdit={() => setEditing("policy")}
            onDone={done}
          />
        </div>
        <ItemEvaluationCard item={item} />
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
