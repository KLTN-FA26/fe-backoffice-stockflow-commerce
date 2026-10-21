"use client";

import Link from "next/link";
import { cn } from "cn";

import { ADMIN_ROUTES, SUPPLIER_ITEM_LIMITS, UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import type { CreatePoWizard } from "./useCreateForm";

const C = UI_LABELS.purchaseOrder.catalog;

/** Trạng thái danh mục hàng NCC trên bước Dòng hàng: thiếu quyền, chưa chọn NCC, lỗi, rỗng, bị cắt. */
export function CatalogNotice({ w, className }: { w: CreatePoWizard; className?: string }) {
  const { catalog } = w;
  const supplierId = w.values.supplierId;
  if (!catalog.canRead)
    return (
      <Alert className={className} tone="warning">
        {w.mode === "edit" ? UI_LABELS.purchaseOrder.draftEdit.noCatalogPermission : C.noPermission}
      </Alert>
    );
  if (supplierId === "")
    return (
      <Alert className={className} tone="info">
        {C.needSupplier}
      </Alert>
    );
  if (catalog.query.isPending) {
    return (
      <p role="status" className={cn("text-ink-tertiary text-xs", className)}>
        {C.loading}
      </p>
    );
  }
  // Refetch nền lỗi nhưng còn data cũ → danh mục vẫn dùng được, không báo lỗi chặn
  if (catalog.query.isError && !catalog.query.data) {
    return (
      <Alert className={className} tone="danger">
        {C.loadFailed}{" "}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0"
          onClick={() => void catalog.query.refetch()}
        >
          {UI_LABELS.common.retry}
        </Button>
      </Alert>
    );
  }
  if (catalog.items.length === 0) {
    return (
      <Alert className={className} tone="warning">
        {C.empty}{" "}
        <Link
          href={`${ADMIN_ROUTES.suppliers.detail(supplierId)}?tab=items`}
          className="text-ink-primary font-medium underline underline-offset-2"
        >
          {C.openCatalog}
        </Link>
      </Alert>
    );
  }
  if (catalog.truncated) {
    return (
      <Alert className={className} tone="info">
        {C.truncated(SUPPLIER_ITEM_LIMITS.catalogPageSize)}
      </Alert>
    );
  }
  return null;
}
