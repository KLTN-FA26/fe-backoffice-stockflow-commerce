"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import {
  PRODUCT_PERMISSIONS,
  STANDARD_PRICE_PERMISSIONS,
  STANDARD_PRICE_UI_LABELS,
  VARIANT_PERMISSIONS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { Button } from "@/components/ui/button";

import { useStandardPrices } from "../queries";
import { pricedSkus } from "../selectors";
import { StandardPriceFormDialog, targetKey } from "./StandardPriceFormDialog";
import { StandardPriceTable } from "./StandardPriceTable";

import type { StandardPriceTarget } from "./StandardPriceFormDialog";

const L = STANDARD_PRICE_UI_LABELS;

/**
 * Giá chuẩn theo quy cách (kltn-docs 13 BR-04 sửa ngày 2026-11-26). Quyền tách nhau, đều UI-only (BE re-check):
 * `catalog-standard-prices` VIEW_PAGE mở trang (PermissionBoundary), READ tải danh sách, CREATE / UPDATE / DELETE thêm /
 * sửa / xoá (Quản lý kinh doanh, Quản trị hệ thống); Sales chỉ xem. Ô chọn sản phẩm / quy cách khi tạo cần thêm
 * `product-products:READ` + `product-variants:READ`; thiếu thì vẫn nhập SKU tay được.
 */
function StandardPriceListContent() {
  const canRead = useCan(STANDARD_PRICE_PERMISSIONS.read);
  const canCreate = useCan(STANDARD_PRICE_PERMISSIONS.create);
  const canUpdate = useCan(STANDARD_PRICE_PERMISSIONS.update);
  const canDelete = useCan(STANDARD_PRICE_PERMISSIONS.delete);
  const canReadProducts = useCan(PRODUCT_PERMISSIONS.read);
  const canReadVariants = useCan(VARIANT_PERMISSIONS.read);
  const query = useStandardPrices(canRead);
  const [target, setTarget] = useState<StandardPriceTarget | null>(null);

  return (
    // Trang danh sách kiểu Vercel (mode-a-backoffice §3 loại trang): không title hiển thị, tên ở breadcrumb
    <div className="surface-soft space-y-4">
      <h1 className="sr-only">{L.title}</h1>
      <p className="text-ink-secondary max-w-3xl text-[0.8125rem]">{L.intro}</p>
      {canCreate && (
        <Button type="button" size="sm" onClick={() => setTarget({ mode: "create" })}>
          <Plus className="size-3.5" /> {L.form.create}
        </Button>
      )}
      <StandardPriceTable
        query={query}
        canRead={canRead}
        canDelete={canDelete}
        onEdit={canUpdate ? (price) => setTarget({ mode: "edit", price }) : undefined}
      />
      {target && (
        <StandardPriceFormDialog
          key={targetKey(target)}
          target={target}
          priced={pricedSkus(query.data ?? [])}
          canBrowseVariants={canReadProducts && canReadVariants}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}

export function StandardPriceList() {
  return (
    <PermissionBoundary permissions={[STANDARD_PRICE_PERMISSIONS.viewPage]} variant="list">
      <StandardPriceListContent />
    </PermissionBoundary>
  );
}
