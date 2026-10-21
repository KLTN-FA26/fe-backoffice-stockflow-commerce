"use client";

import { useState } from "react";

import {
  ADMIN_ROUTES,
  PO_PERMISSIONS,
  PO_STATUS,
  PO_TYPE,
  SUPPLIER_ITEM_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { useSupplierTermsForSkus } from "@/lib/references/sku-suppliers";
import { useSupplierCatalog } from "@/lib/references/supplier-items";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import {
  allowedPoActions,
  usePurchaseOrder,
  usePurchaseOrderReload,
} from "@/features/purchase-order";
import { Alert } from "@/components/shared/Alert";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { PoWizardLayout } from "./create/PoWizardLayout";
import { useEditDraftForm } from "./create/useEditDraftForm";
import { PoLoadError } from "./PoLoadError";
import { PoNotEditable } from "./PoNotEditable";
import { PoPermissionGate } from "./PoPermissionGate";

import type { SkuSupplierRef } from "@/lib/references/sku-suppliers";
import type { SupplierCatalog } from "@/lib/references/supplier-items";
import type { PurchaseOrder } from "@/features/purchase-order";
import type { PoReload } from "./create/types";

const L = UI_LABELS.purchaseOrder;

/** Màn sửa PO nháp (BE SCRUM-462 `PUT /purchase-orders/{id}`, issue #30). */
export function PurchaseOrderEdit({ id }: { id: string }) {
  return (
    // UI-only — Backend phải re-check (@RequiresPermission procurement-purchase-orders:UPDATE)
    <PoPermissionGate
      permissions={[PO_PERMISSIONS.viewPage, PO_PERMISSIONS.read, PO_PERMISSIONS.update]}
      variant="form"
    >
      <PurchaseOrderEditBody id={id} />
    </PoPermissionGate>
  );
}

function PurchaseOrderEditBody({ id }: { id: string }) {
  const can = usePermissionChecker();
  const poQuery = usePurchaseOrder(id);
  const reload = usePurchaseOrderReload(id);
  const po = poQuery.data;
  // Cùng gate với nút "Sửa nháp" ở màn chi tiết: DRAFT + STANDARD + UPDATE (`lifecycle.ts`).
  const editable = po !== undefined && allowedPoActions(po, can).some((a) => a.code === "edit");
  // UI-only — Backend phải re-check (@RequiresPermission procurement-supplier-items:READ)
  const canReadCatalog = can(SUPPLIER_ITEM_PERMISSIONS.read);
  const catalogQuery = useSupplierCatalog(po?.supplierId ?? "", canReadCatalog);
  // Danh mục > 200 dòng (trang tối đa BE): SKU dòng cũ ngoài trang đã tải → tra theo SKU
  // (`/procurement/skus/{sku}/suppliers`), kẻo form báo nhầm "không có trong danh mục".
  const listed = new Set(catalogQuery.data?.items.map((item) => item.sku));
  const missingSkus = catalogQuery.data?.truncated
    ? (po?.lines ?? []).map((l) => l.skuId).filter((sku) => !listed.has(sku))
    : [];
  const extra = useSupplierTermsForSkus(po?.supplierId ?? "", missingSkus, canReadCatalog);
  useBreadcrumbLabel(id, po?.poNumber);
  // Form đã mở một lần thì không quay lại skeleton / màn lỗi tải: danh mục tải lại nền có thể đổi
  // `missingSkus` (query mới đang pending) — gỡ form là mất dữ liệu đang nhập.
  const [opened, setOpened] = useState(false);
  const loadingTerms = canReadCatalog && (catalogQuery.isPending || extra.isPending);
  const termsFailed =
    canReadCatalog && ((catalogQuery.isError && !catalogQuery.data) || extra.isError);
  if (editable && !opened && !loadingTerms && !termsFailed) setOpened(true);

  // Chỉ báo lỗi tải khi CHƯA có data: React Query v5 giữ `data` khi refetch nền (focus, tải lại
  // sau OPTIMISTIC_LOCK) thất bại nhưng đổi status sang "error" — không được gỡ form đang nhập.
  if (poQuery.isPending) return <PageSkeleton variant="form" />;
  if (!po) return <PoLoadError error={poQuery.error} onRetry={() => void poQuery.refetch()} />;
  // Chỉ chặn trước khi mở form. Đã mở mà refetch nền thấy đơn đổi trạng thái (người khác gửi duyệt…)
  // → giữ form + banner, không gỡ form làm mất dữ liệu đang nhập; lưu thì BE báo NOT_EDITABLE.
  if (!opened && !editable) return <PoNotEditable po={po} />;
  // Mở form khi đã có danh mục + điều khoản từng dòng: giá trị mặc định chỉ tính một lần.
  if (!opened && loadingTerms) return <PageSkeleton variant="form" />;
  if (!opened && termsFailed) {
    const retry = () => {
      void catalogQuery.refetch();
      extra.refetch();
    };
    // Báo lỗi của nguồn thực sự hỏng: danh mục còn data (lỗi refetch cũ) thì lỗi là ở tra theo SKU.
    const error = catalogQuery.isError && !catalogQuery.data ? catalogQuery.error : extra.error;
    return <PoLoadError error={error} onRetry={retry} />;
  }
  return (
    <EditForm
      po={po}
      catalog={catalogQuery.data}
      extraTerms={extra.bySku}
      reload={reload}
      // Đã mở form mà không còn sửa được: đơn đổi trạng thái hay người dùng mất quyền UPDATE
      lockReason={
        editable
          ? null
          : isDraftStandard(po)
            ? L.draftEdit.permissionLost
            : L.draftEdit.statusChanged
      }
    />
  );
}

function EditForm({
  po,
  catalog,
  extraTerms,
  reload,
  lockReason,
}: {
  po: PurchaseOrder;
  catalog: SupplierCatalog | undefined;
  extraTerms: ReadonlyMap<string, SkuSupplierRef>;
  reload: PoReload;
  lockReason: string | null;
}) {
  const w = useEditDraftForm(po, catalog, extraTerms, reload, lockReason !== null);
  return (
    <PoWizardLayout
      w={w}
      title={L.draftEdit.title(po.poNumber)}
      subtitle={L.draftEdit.subtitle}
      back={{ href: ADMIN_ROUTES.purchaseOrders.detail(po.poId), label: L.draftEdit.backToDetail }}
      draft={{
        poNumber: po.poNumber,
        supplierLabel: po.supplierName ?? L.supplierUnavailable,
        notice: lockReason && <Alert tone="warning">{lockReason}</Alert>,
      }}
    />
  );
}

/** BE `PurchaseOrder#reviseDraft`: chỉ PO thường ở trạng thái nháp sửa được. */
function isDraftStandard(po: PurchaseOrder): boolean {
  return po.status === PO_STATUS.DRAFT && po.type === PO_TYPE.STANDARD;
}
