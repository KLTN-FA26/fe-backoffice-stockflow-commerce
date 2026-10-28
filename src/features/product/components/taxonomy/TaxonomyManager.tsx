"use client";

import { useState } from "react";
import { cn } from "cn";
import { Plus } from "lucide-react";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { PRODUCT_PERMISSIONS, UI_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";
import { Button } from "@/components/ui/button";

import { BrandFormDialog } from "./BrandFormDialog";
import { BrandList } from "./BrandList";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { CategoryList } from "./CategoryList";

const L = UI_LABELS.taxonomy;
const TABS = ["brands", "categories"] as const;
type Tab = (typeof TABS)[number];
const TAB_ITEMS = [
  { value: "brands", label: L.tabBrands },
  { value: "categories", label: L.tabCategories },
] as const satisfies readonly { value: Tab; label: string }[];
// Tab + các khoá danh sách (`useTaxonomyListState`) — đổi tab thì xoá cả bộ trong một lần ghi URL
const URL_PARSERS = {
  tab: parseAsStringLiteral(TABS).withDefault("brands"),
  q: parseAsString,
  status: parseAsString,
  page: parseAsInteger,
};

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
  const createAction = can(PRODUCT_PERMISSIONS.create) ? (
    <Button
      type="button"
      size="sm"
      onClick={() => setCreating(true)}
      className={cn("bg-brand hover:bg-brand-hover", TOOLBAR_ACTION_CLASS)}
    >
      <Plus className="size-3.5" /> {isBrands ? L.createBrand : L.createCategory}
    </Button>
  ) : undefined;

  return (
    // Giao diện kiểu Vercel như trang danh sách sản phẩm (globals.css `.surface-soft`)
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      <PageTabs
        tabs={TAB_ITEMS}
        value={tab}
        onChange={(next) =>
          void setUrl({ tab: next === "brands" ? null : next, q: null, status: null, page: null })
        }
        idPrefix="taxonomy"
        ariaLabel={L.pageTitle}
      />
      <PageTabPanel idPrefix="taxonomy" value={tab}>
        {isBrands ? <BrandList actions={createAction} /> : <CategoryList actions={createAction} />}
      </PageTabPanel>
      {isBrands ? (
        <BrandFormDialog open={creating} onOpenChange={setCreating} />
      ) : (
        <CategoryFormDialog open={creating} onOpenChange={setCreating} />
      )}
    </div>
  );
}
