"use client";

import { formatDate } from "@/lib/format/date";
import { countVariantsByStatus, productCategoryLabel, taxClassLabel } from "@/features/product";

import { ProductLifecycleStepper } from "./ProductLifecycleCard";

import type { ReactNode } from "react";
import type { Product, Variant } from "@/features/product";

const TYPE_LABEL: Record<Product["type"], string> = {
  Standard: "Tiêu chuẩn",
  Customizable: "In theo thiết kế khách",
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-bg-surface min-w-0 space-y-1 px-4 py-3">
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd className="text-ink-primary truncate text-[0.8125rem] font-medium">{children}</dd>
    </div>
  );
}

/** Id người dùng (UUID) — rút gọn, đủ dòng nằm gọn trong ô; bản đầy đủ ở tooltip gốc `title`. */
function UserId({ id }: { id: string }) {
  return (
    <span title={id} className="font-[family-name:var(--font-mono)] font-normal">
      {id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id}
    </span>
  );
}

/**
 * Khung hồ sơ sản phẩm (như bản ghi master của ERP): đầu khung là vòng đời nằm ngang + nút sửa bên
 * phải; dưới là bảng thông số 4 cột kiểu Summary của AWS Console (nhãn nhỏ + giá trị, ngăn bằng vạch
 * mảnh) và mô tả. Gom "Thông tin chung", "Mô tả", "Vòng đời" và "Tổng quan biến thể" trước nằm rải.
 */
export function ProductOverviewPanel({
  product,
  variants,
  actions,
}: {
  product: Product;
  variants: readonly Variant[];
  /** Nút sửa ở bên phải đầu khung (vd "Chỉnh sửa sản phẩm" khi còn Nháp). */
  actions?: ReactNode;
}) {
  const counts = countVariantsByStatus(variants);
  const description = product.description.trim();
  const descriptionEn = product.descriptionEn.trim();
  return (
    <section
      aria-label="Hồ sơ sản phẩm"
      className="border-border-default bg-bg-surface mb-6 overflow-hidden rounded-(--section-radius) border shadow-(--card-shadow)"
    >
      <div className="border-border-default flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <ProductLifecycleStepper status={product.status} />
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {/* `gap-px` trên nền màu vạch kẻ → đường ngăn 1px giữa các ô; 8 ô lấp đủ hàng ở 2 lẫn 4 cột */}
      <dl className="grid grid-cols-2 gap-px bg-(--table-line) md:grid-cols-4">
        {/* Issue #286: tên danh mục BE trả kèm — không tải danh sách danh mục chỉ để tra tên */}
        <Fact label="Danh mục">{productCategoryLabel(product)}</Fact>
        <Fact label="Thương hiệu">{product.brand || "—"}</Fact>
        <Fact label="Thuế">{taxClassLabel(product.taxClass)}</Fact>
        <Fact label="Loại sản phẩm">{TYPE_LABEL[product.type]}</Fact>
        <Fact label="Biến thể">
          <span className="tabular-nums">
            {counts.ACTIVE} đang dùng / {variants.length}
          </span>
        </Fact>
        <Fact label="Ngày tạo">
          <span className="tabular-nums">{formatDate(product.createdAt)}</span>
        </Fact>
        <Fact label="Người tạo">
          <UserId id={product.createdBy} />
        </Fact>
        <Fact label="Ngày duyệt">
          <span className="tabular-nums">
            {product.approvedAt ? formatDate(product.approvedAt) : "Chưa duyệt"}
          </span>
        </Fact>
      </dl>
      <div className="border-t border-(--table-line) px-4 py-3">
        <p className="text-ink-tertiary mb-1 text-xs">Mô tả</p>
        {description || descriptionEn ? (
          <>
            <p className="text-ink-primary max-w-[75ch] text-[0.8125rem] leading-relaxed">
              {description || "Chưa có mô tả tiếng Việt."}
            </p>
            {descriptionEn && (
              <p className="text-ink-tertiary mt-1 max-w-[75ch] text-xs">{descriptionEn}</p>
            )}
          </>
        ) : (
          <p className="text-ink-tertiary text-[0.8125rem]">Chưa có mô tả.</p>
        )}
      </div>
    </section>
  );
}
