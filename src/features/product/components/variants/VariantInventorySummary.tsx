"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useInventoryItemSummary } from "@/lib/references/inventory-item-lookup";

const L = UI_LABELS.inventoryItem;
const S = L.variantSummary;
const F = L.field;
const STORAGE_LABEL: Readonly<Record<string, string>> = L.storageClass;
const NOTE = "text-ink-tertiary text-xs";

/**
 * Tóm tắt hồ sơ hàng tồn của một SKU — chỉ đọc; sửa logistics / chính sách tồn ở trang Hồ sơ hàng
 * tồn (BE PR #119 `/inventory/items/{id}`). Quyền là `inventory-inventory-items` (phía kho), không
 * theo trạng thái sản phẩm / biến thể. UI-only — Backend phải re-check quyền READ.
 */
export function VariantInventorySummary({
  inventoryItemId,
  canRead,
}: {
  inventoryItemId: string | null | undefined;
  canRead: boolean;
}) {
  // Không có quyền đọc → không gọi API (tránh 403); role catalog không được cấp theo chủ ý BE.
  const query = useInventoryItemSummary(inventoryItemId, canRead);

  if (!canRead) return <p className={NOTE}>{S.noPermission}</p>;
  if (!inventoryItemId) return <p className={NOTE}>{S.noItem}</p>;
  if (query.isPending) return <p className={NOTE}>{S.loading}</p>;
  if (query.isError) {
    return (
      <p role="alert" className="text-danger text-xs">
        {summaryErrorMessage(query.error)}
      </p>
    );
  }
  const { id, logistics } = query.data;
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
        <Item label={F.unitOfMeasure} value={logistics.unitOfMeasure} mono />
        <Item label={F.barcode} value={logistics.barcode || L.notProvided} mono />
        <Item
          label={L.weightView}
          value={logistics.weightKg == null ? L.notProvided : S.weightValue(logistics.weightKg)}
        />
        <Item
          label={F.storageClass}
          value={STORAGE_LABEL[logistics.storageClass] ?? logistics.storageClass}
        />
      </dl>
      <Link
        href={ADMIN_ROUTES.inventoryItems.detail(id)}
        className="text-info mt-3 inline-block text-xs font-medium hover:underline"
      >
        {S.openInInventory}
      </Link>
    </div>
  );
}

/** Lỗi của hồ sơ hàng tồn (BE PR #119), không phải của biến thể: 404 / 403 / còn lại. */
function summaryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404 || error.code === "INVENTORY_ITEM_NOT_FOUND") return S.notFound;
    if (error.status === 403) return S.forbidden;
  }
  return S.loadFailed;
}

function Item({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd className={mono ? "font-[family-name:var(--font-mono)]" : undefined}>{value}</dd>
    </div>
  );
}
