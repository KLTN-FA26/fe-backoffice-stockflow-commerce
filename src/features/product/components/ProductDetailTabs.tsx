"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";

import { ProductAttributesSection } from "./ProductAttributesSection";
import { ProductHistory } from "./ProductHistory";
import { ProductListingSection } from "./ProductListingSection";
import { canSeeOpenReferences, ProductOpenReferencesCard } from "./ProductOpenReferencesCard";
import { ProductPrintAreasSection } from "./ProductPrintAreasSection";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Product } from "@/features/product";

const TABS = ["attributes", "print", "references", "history"] as const;
type TabKey = (typeof TABS)[number];

const LABEL: Record<TabKey, string> = {
  // Thuộc tính và thông tin cửa hàng ít dữ liệu, cùng là mô tả sản phẩm → chung một tab
  attributes: "Thuộc tính & cửa hàng",
  print: "Vùng in",
  references: "Chứng từ còn mở",
  history: "Lịch sử",
};

/**
 * Các nhóm dữ liệu ít dùng hằng ngày của sản phẩm, gom thành tab dưới bảng biến thể (tab đang chọn
 * trên URL `?tab=`, state-persistence.md). Những gì xem / thao tác thường xuyên — thông số, mô tả, ảnh,
 * biến thể — nằm thẳng trên trang, không giấu vào tab. "Vùng in" chỉ có khi sản phẩm có vùng in.
 */
export function ProductDetailTabs({
  product,
  skuById,
  can,
  canReadVariants,
}: {
  product: Product;
  skuById: ReadonlyMap<string, string>;
  can: (permission: PermissionCode) => boolean;
  canReadVariants: boolean;
}) {
  const customizable = product.type === "Customizable";
  // "Vùng in" chỉ khi có dữ liệu (`ProductPrintAreasSection` không dựng gì khi trống)
  const hasPrintAreas = customizable && (product.printAreas?.length ?? 0) > 0;
  const tabs = TABS.filter(
    (key) =>
      (key !== "print" || hasPrintAreas) &&
      (key !== "references" || canSeeOpenReferences(product.status, can)),
  );
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("attributes"));
  const current: TabKey = tabs.includes(tab) ? tab : "attributes";

  return (
    <>
      <PageTabs
        tabs={tabs.map((value) => ({ value, label: LABEL[value] }))}
        value={current}
        onChange={(next) => void setTab(next === "attributes" ? null : next)}
        idPrefix="product-detail"
        ariaLabel="Thông tin sản phẩm"
      />
      <PageTabPanel idPrefix="product-detail" value={current}>
        {/* Mỗi tab là các panel cùng kiểu (thanh tiêu đề + nút thao tác bên phải); bảng không bọc thêm */}
        {current === "attributes" && (
          <div className="space-y-5">
            <ProductAttributesSection
              productId={product.productId}
              status={product.status}
              canRead={canReadVariants}
            />
            <ProductListingSection productId={product.productId} status={product.status} />
          </div>
        )}
        {current === "print" && <ProductPrintAreasSection product={product} />}
        {current === "references" && (
          <ProductOpenReferencesCard
            productId={product.productId}
            status={product.status}
            can={can}
          />
        )}
        {current === "history" && (
          // Bảng lịch sử tự có khung — không bọc thêm
          <ProductHistory productId={product.productId} skuById={skuById} />
        )}
      </PageTabPanel>
    </>
  );
}
