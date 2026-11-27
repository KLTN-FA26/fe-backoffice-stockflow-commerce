"use client";

import { FileText, Layers } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatDate } from "@/lib/format/date";
import { categoryName, taxClassLabel } from "@/features/product";
import { RichTextView } from "@/components/shared/RichTextView";
import { StatusDot } from "@/components/shared/StatusDot";

import { InfoRow, Section } from "./ProductSection";

import type { Category, Product } from "@/features/product";

const D = UI_LABELS.product.description;
const F = UI_LABELS.product.edit.fields;

/**
 * "Thông tin chung": mã, loại, danh mục, thương hiệu, thuế, trạng thái, người tạo / duyệt. Sửa và lý do
 * tạm ngưng / ngừng kinh doanh nằm ở thẻ trạng thái cột phải (ProductActionCard).
 */
export function ProductGeneralSection({
  product,
  categories,
}: {
  product: Product;
  categories: readonly Category[];
}) {
  return (
    <Section title="Thông tin chung" icon={Layers}>
      <div className="divide-y divide-(--table-line)">
        <InfoRow label="Mã sản phẩm">
          <span className="text-accent font-[family-name:var(--font-mono)] font-medium">
            {product.code ?? product.productId}
          </span>
        </InfoRow>
        {/* Trang chi tiết không có tiêu đề — tên sản phẩm (BE `name`) nằm ở đây */}
        <InfoRow label={F.name}>
          <span className="font-medium">{product.name}</span>
        </InfoRow>
        <InfoRow label="Danh mục">{categoryName(product.categoryId, categories)}</InfoRow>
        <InfoRow label="Thương hiệu">{product.brand}</InfoRow>
        <InfoRow label="Thuế">{taxClassLabel(product.taxClass)}</InfoRow>
        <InfoRow label="Trạng thái">
          <StatusDot domain="product" status={product.status} size="sm" withIcon />
        </InfoRow>
        <InfoRow label="Người tạo">{product.createdBy}</InfoRow>
        <InfoRow label="Ngày tạo">
          <span className="tabular-nums">{formatDate(product.createdAt)}</span>
        </InfoRow>
        {product.approvedBy && (
          <InfoRow label="ID người duyệt">
            <span className="font-[family-name:var(--font-mono)]">{product.approvedBy}</span>
          </InfoRow>
        )}
        {product.approvedAt && (
          <InfoRow label="Ngày duyệt">
            <span className="tabular-nums">{formatDate(product.approvedAt)}</span>
          </InfoRow>
        )}
      </div>
    </Section>
  );
}

/** "Mô tả": HTML của Tiptap (ADR-0013), lọc lại qua RichTextView; rỗng thì nói rõ thay vì để mục trống trơn. */
export function ProductDescriptionSection({ product }: { product: Product }) {
  return (
    <Section title={D.title} icon={FileText}>
      <RichTextView html={product.description} empty={D.empty} />
    </Section>
  );
}
