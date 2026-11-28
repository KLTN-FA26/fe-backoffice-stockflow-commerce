"use client";

import { useState } from "react";
import { Tag } from "lucide-react";

import { Section } from "./ProductSection";
import { VariantsActions } from "./variants/VariantsActions";
import { VariantsSection } from "./variants/VariantsSection";

import type { UseQueryResult } from "@tanstack/react-query";
import type { Variant } from "@/features/product";
import type { VariantDialog } from "./variants/VariantsActions";

/**
 * Mục "Biến thể" của trang chi tiết (BE PR #71): nút thêm / sinh biến thể trên dòng tiêu đề mục,
 * bảng + panel + hộp thoại bên dưới. Mục giữ hộp thoại đang mở để nút ở tiêu đề mở được nó.
 */
export function ProductVariantsSection({
  productId,
  productCode,
  productApproved,
  acceptsChanges,
  customizable,
  canRead,
  query,
}: {
  productId: string;
  /** Mã sản phẩm — gốc của SKU sinh tự động. */
  productCode: string;
  /** Đã duyệt / đang bán: chỉ khi đó biến thể mới kích hoạt được. */
  productApproved: boolean;
  /** Không chờ duyệt, không ngừng kinh doanh (BE `Product.acceptsChanges`). */
  acceptsChanges: boolean;
  /** Sản phẩm tuỳ chỉnh / in ấn (`kind` CUSTOMIZABLE). */
  customizable: boolean;
  /** `product-variants:READ` — thiếu thì BE trả 403 cho GET biến thể; mục báo không có quyền. */
  canRead: boolean;
  query: UseQueryResult<Variant[]>;
}) {
  const [dialog, setDialog] = useState<VariantDialog>(null);
  return (
    <Section
      title={`Biến thể (${query.data?.length ?? 0})`}
      icon={Tag}
      // Bảng tự có khung — không bọc thêm thẻ quanh tiêu đề + bảng
      bare
      actions={
        <VariantsActions productId={productId} acceptsChanges={acceptsChanges} onOpen={setDialog} />
      }
    >
      {!canRead ? (
        <p className="text-ink-tertiary text-[0.8125rem]">
          Bạn không có quyền xem biến thể của sản phẩm.
        </p>
      ) : (
        <VariantsSection
          productId={productId}
          productCode={productCode}
          productApproved={productApproved}
          acceptsChanges={acceptsChanges}
          customizable={customizable}
          query={query}
          dialog={dialog}
          onDialogChange={setDialog}
        />
      )}
    </Section>
  );
}
