"use client";

import { useState } from "react";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { PRODUCT_PERMISSIONS, UI_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { HeaderActions, HeaderCreateButton } from "@/components/shared/HeaderActions";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";

import { BrandFormDialog } from "./BrandFormDialog";
import { BrandList } from "./BrandList";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { CategoryList } from "./CategoryList";
import { columnFilterKeys } from "./useTaxonomyListState";

const L = UI_LABELS.taxonomy;
const TABS = ["brands", "categories"] as const;
type Tab = (typeof TABS)[number];
const TAB_ITEMS = [
  { value: "brands", label: L.tabBrands },
  { value: "categories", label: L.tabCategories },
] as const satisfies readonly { value: Tab; label: string }[];
const BRAND_KEYS = columnFilterKeys("brand");
const CATEGORY_KEYS = columnFilterKeys("category");
// Tab + các khoá danh sách (`useTaxonomyListState`, kể cả lọc header cột) — đổi tab thì xoá cả bộ
// trong một lần ghi URL
const URL_PARSERS = {
  tab: parseAsStringLiteral(TABS).withDefault("brands"),
  q: parseAsString,
  status: parseAsString,
  page: parseAsInteger,
  [BRAND_KEYS.code]: parseAsString,
  [BRAND_KEYS.name]: parseAsString,
  [CATEGORY_KEYS.code]: parseAsString,
  [CATEGORY_KEYS.name]: parseAsString,
};
const CLEAR_LIST_KEYS = Object.fromEntries(
  Object.keys(URL_PARSERS)
    .filter((key) => key !== "tab")
    .map((key) => [key, null]),
);

/**
 * Màn `/admin/taxonomy` — thương hiệu và danh mục sản phẩm (BE `ProductTaxonomyController`).
 * Tab nằm trên URL (`?tab=`); đổi tab thì bỏ tìm kiếm / lọc / trang của tab cũ.
 */
export function TaxonomyManager() {
  const can = usePermissionChecker();
  const [{ tab }, setUrl] = useQueryStates(URL_PARSERS);
  const [creating, setCreating] = useState(false);
  const isBrands = tab === "brands";
  // UI-only — Backend phải re-check (@RequiresPermission product-products:CREATE)
  const canCreate = can(PRODUCT_PERMISSIONS.create);

  return (
    // Giao diện kiểu Vercel như trang danh sách sản phẩm (globals.css `.surface-soft`)
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {/* Nút tạo mới của tab đang mở nằm trên thanh breadcrumb (backoffice-erp-ui A1) */}
      {canCreate && (
        <HeaderActions>
          <HeaderCreateButton
            onClick={() => setCreating(true)}
            aria-label={`Tạo mới ${isBrands ? L.brandNoun : L.categoryNoun}`}
            tooltip={isBrands ? L.createBrand : L.createCategory}
          />
        </HeaderActions>
      )}
      <PageTabs
        tabs={TAB_ITEMS}
        value={tab}
        onChange={(next) =>
          void setUrl({ ...CLEAR_LIST_KEYS, tab: next === "brands" ? null : next })
        }
        idPrefix="taxonomy"
        ariaLabel={L.pageTitle}
      />
      <PageTabPanel idPrefix="taxonomy" value={tab}>
        {isBrands ? <BrandList /> : <CategoryList />}
      </PageTabPanel>
      {isBrands ? (
        <BrandFormDialog open={creating} onOpenChange={setCreating} />
      ) : (
        <CategoryFormDialog open={creating} onOpenChange={setCreating} />
      )}
    </div>
  );
}
