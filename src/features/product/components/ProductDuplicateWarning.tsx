"use client";

import Link from "next/link";
import { useWatch } from "react-hook-form";

import { ADMIN_ROUTES } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { statusLabelVi } from "@/lib/status-map";

import { useProductDuplicates } from "../queries";

import type { UseFormReturn } from "react-hook-form";
import type { ProductDraftFormValues, ProductMatch } from "../schemas";

/** Debounce khi gõ tên (PRODUCTION-FRONTEND-RULES §9). */
const NAME_DEBOUNCE_MS = 300;

/** BE trả mã trạng thái (`DRAFT`…) — đổi sang tên hiển thị của sản phẩm. */
const BE_TO_DISPLAY: Readonly<Record<string, string>> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  INACTIVE: "Inactive",
  DISCONTINUED: "Discontinued",
};

/**
 * Danh sách sản phẩm có thể trùng — cảnh báo, không chặn lưu (docs 01 §4.3, BR-16; BE `ProductMatchResponse`:
 * cùng thương hiệu + danh mục chính, tên trùng khoá khi bỏ dấu / hoa thường / khoảng trắng / dấu câu).
 */
export function ProductDuplicateList({ matches }: { matches: readonly ProductMatch[] }) {
  if (matches.length === 0) return null;
  return (
    <div
      role="status"
      className="border-warning/40 bg-bg-subtle rounded-(--section-radius) border p-3"
    >
      <p className="text-warning text-xs font-semibold">
        Có thể trùng với {matches.length} sản phẩm cùng thương hiệu và danh mục — kiểm tra trước khi
        lưu.
      </p>
      <ul className="mt-2 space-y-1 text-[0.8125rem]">
        {matches.map((m) => (
          <li key={m.productId} className="flex flex-wrap items-baseline gap-2">
            <Link
              href={ADMIN_ROUTES.products.detail(m.productId)}
              className="text-accent-text font-[family-name:var(--font-mono)] hover:underline"
              target="_blank"
            >
              {m.code}
            </Link>
            <span className="text-ink-primary">{m.name}</span>
            <span className="text-ink-tertiary text-xs">
              {statusLabelVi(BE_TO_DISPLAY[m.status] ?? m.status, "product") ?? m.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Cảnh báo trùng ngay trong form tạo / sửa: hỏi `GET /products/duplicates` khi đã có tên + thương hiệu + danh
 * mục (BE trả rỗng nếu thiếu một trong hai). Sửa thì bỏ chính sản phẩm đang sửa (`excludeProductId`).
 */
export function ProductDuplicateWarning({
  form,
  excludeProductId,
}: {
  form: UseFormReturn<ProductDraftFormValues>;
  excludeProductId?: string;
}) {
  const [name, brandId, categoryId] = useWatch({
    control: form.control,
    name: ["name", "brandId", "categoryId"],
  });
  const debouncedName = useDebouncedValue(name.trim(), NAME_DEBOUNCE_MS);
  const query = useProductDuplicates({
    name: debouncedName,
    brandId,
    categoryId,
    excludeProductId,
  });
  return <ProductDuplicateList matches={query.data ?? []} />;
}
