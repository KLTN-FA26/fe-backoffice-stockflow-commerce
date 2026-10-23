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
  productDiscontinued,
  query,
}: {
  productId: string;
  /** Mã sản phẩm — gốc của SKU sinh tự động. */
  productCode: string;
  /** Đã duyệt / đang bán: chỉ khi đó biến thể mới kích hoạt được. */
  productApproved: boolean;
  /** Không chờ duyệt, không ngừng kinh doanh (BE `Product.acceptsChanges`). */
  acceptsChanges: boolean;
  /** Đã ngừng kinh doanh — chỉ trường hợp này BE từ chối đặt giá. */
  productDiscontinued: boolean;
  query: UseQueryResult<Variant[]>;
}) {
  const [dialog, setDialog] = useState<VariantDialog>(null);
  return (
    <Section
      title={`Biến thể (${query.data?.length ?? 0})`}
      icon={Tag}
      actions={
        <VariantsActions productId={productId} acceptsChanges={acceptsChanges} onOpen={setDialog} />
      }
    >
      <VariantsSection
        productId={productId}
        productCode={productCode}
        productApproved={productApproved}
        acceptsChanges={acceptsChanges}
        productDiscontinued={productDiscontinued}
        query={query}
        dialog={dialog}
        onDialogChange={setDialog}
      />
    </Section>
  );
}
