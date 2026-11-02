"use client";

import { UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";

import type { SkuSupplierRef, useSkuSuppliers } from "@/lib/references/sku-suppliers";

const L = UI_LABELS.skuPurchasing;
const NOTE = "text-ink-tertiary text-xs";
const MONO = "font-[family-name:var(--font-mono)]";

/** Trạng thái tra NCC mặc định trong `GET /procurement/skus/{sku}/suppliers`. */
export type SupplierLookup =
  | { kind: "none" } // SKU chưa có NCC mặc định
  | { kind: "noPermission" } // thiếu `procurement-supplier-items:READ` → không gọi API
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "notListed" } // id có trong thông tin mua hàng nhưng NCC không còn bán SKU này
  | { kind: "found"; row: SkuSupplierRef };

/**
 * Khớp NCC mặc định theo `supplierId` — KHÔNG lấy dòng đầu danh sách làm NCC mặc định. Có dữ liệu cũ
 * trong cache thì dùng dù lần tải lại vừa lỗi.
 */
export function supplierLookup(
  defaultId: string | null,
  canReadSuppliers: boolean,
  suppliers: ReturnType<typeof useSkuSuppliers>,
): SupplierLookup {
  if (defaultId === null) return { kind: "none" };
  if (!canReadSuppliers) return { kind: "noPermission" };
  if (suppliers.data === undefined)
    return suppliers.isError ? { kind: "failed" } : { kind: "loading" };
  const row = suppliers.data.find((s) => s.supplierId === defaultId);
  return row ? { kind: "found", row } : { kind: "notListed" };
}

/**
 * Giá trị ô "Nhà cung cấp mặc định". `defaultSupplierId` của thông tin mua hàng là nguồn đúng: không
 * tra được NCC thì vẫn hiện id kèm lý do, không bao giờ nói "chưa thiết lập".
 */
export function DefaultSupplierValue({
  supplierId,
  lookup,
}: {
  supplierId: string | null;
  lookup: SupplierLookup;
}) {
  if (supplierId === null) return <>{L.notSet}</>;
  if (lookup.kind === "found") {
    const { row } = lookup;
    return (
      <>
        <span>{L.supplier.name(row.supplierCode, row.supplierName)}</span>
        {row.supplierStatus !== "ACTIVE" && (
          <span className="text-warning block text-xs">{L.supplier.inactive}</span>
        )}
      </>
    );
  }
  const note: Record<Exclude<SupplierLookup["kind"], "found">, string | null> = {
    none: null,
    noPermission: L.supplier.noPermission,
    loading: L.supplier.loading,
    failed: L.supplier.loadFailed,
    notListed: L.supplier.notListed,
  };
  const message = note[lookup.kind];
  return (
    <>
      <span className={`${MONO} break-all`}>{supplierId}</span>
      {message && <span className={`${NOTE} block`}>{message}</span>}
    </>
  );
}

/**
 * Điều khoản thật của NCC mặc định theo danh mục hàng (MOQ, bội số đặt hàng = quy cách, thời gian giao
 * hiệu lực) — tách hẳn khỏi giá trị tham khảo của SKU. Chỉ hiện field BE trả về.
 */
export function SupplierTerms({ row }: { row: SkuSupplierRef }) {
  return (
    <section aria-label={L.supplierTermsTitle}>
      <h4 className="text-ink-secondary mb-1 text-xs font-semibold">{L.supplierTermsTitle}</h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
        {row.supplierSkuCode !== null && (
          <Term label={L.field.supplierSkuCode} value={row.supplierSkuCode} mono />
        )}
        <Term label={L.field.supplierMoq} value={formatNumber(row.moq)} />
        <Term label={L.field.packSize} value={formatNumber(row.packSize)} />
        <Term label={L.field.effectiveLeadTime} value={L.days(row.effectiveLeadTimeDays)} />
      </dl>
      <p className={`${NOTE} mt-1`}>{L.supplierTermsHint}</p>
    </section>
  );
}

function Term({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className={NOTE}>{label}</dt>
      <dd className={mono ? MONO : "tabular-nums"}>{value}</dd>
    </div>
  );
}
