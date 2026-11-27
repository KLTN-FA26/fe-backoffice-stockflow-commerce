"use client";

import { useState } from "react";

import { STORAGE_KEYS, TAXONOMY_BRAND_COLUMNS, UI_LABELS } from "@/constants";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";

import { useBrandPage } from "../../taxonomy-queries";
import { BRAND_COLUMN_LABELS, actionsColumn, buildBrandColumns } from "./taxonomy-columns";
import { matchesColumnFilters, taxonomyHeaderFilters } from "./taxonomy-header-filters";
import { BrandFormDialog } from "./BrandFormDialog";
import { TaxonomyListBody } from "./TaxonomyListBody";
import { TaxonomyToolbar } from "./TaxonomyToolbar";
import { useTaxonomyListState } from "./useTaxonomyListState";

import type { Brand } from "../../taxonomy-schemas";

const L = UI_LABELS.taxonomy;
const ALL_COLUMNS = Object.values(TAXONOMY_BRAND_COLUMNS);

/** Tab Thương hiệu — bấm dòng để sửa (hoặc xem khi thiếu quyền sửa); lọc ngay trên header cột. */
export function BrandList() {
  const s = useTaxonomyListState(STORAGE_KEYS.adminTaxonomyBrandsConfig, ALL_COLUMNS, "brand");
  const query = useBrandPage({ ...s.params, sort: "name,asc" }, { enabled: s.canRead });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = query.data?.items.find((b) => b.brandId === selectedId);
  const rows = (query.data?.items ?? []).filter((b) => matchesColumnFilters(b, s.columnFilters));
  const columns = [
    ...withHeaderFilters(
      buildBrandColumns().filter((c) => s.config.visibleColumns.includes(c.key)),
      taxonomyHeaderFilters(s, L.brandNoun),
    ),
    actionsColumn<Brand>((row) => ({
      label: `${L.viewRow} ${row.name}`,
      onOpen: () => setSelectedId(row.brandId),
    })),
  ];

  return (
    <>
      <TaxonomyToolbar
        s={s}
        searchPlaceholder={L.brandSearchPlaceholder}
        columnLabels={BRAND_COLUMN_LABELS}
        lockedColumn={TAXONOMY_BRAND_COLUMNS.CODE}
      />
      <TaxonomyListBody
        s={s}
        query={query}
        rows={rows}
        columns={columns}
        rowKey={(row) => row.brandId}
        onRowClick={(row) => setSelectedId(row.brandId)}
        noun={L.brandNoun}
        emptyTitle={L.brandEmptyTitle}
        emptyDescription={L.brandEmptyDescription}
      />
      <BrandFormDialog
        brand={selected}
        open={selected !== undefined}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </>
  );
}
