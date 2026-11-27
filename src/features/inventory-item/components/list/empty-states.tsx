"use client";

import { PackageSearch } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import type { InventoryItemListState } from "./useInventoryItemListState";

const L = UI_LABELS.inventoryItem;
/** EmptyState bỏ khung — nằm trong thân bảng, bảng và header vẫn giữ (backoffice-erp-ui A7). */
const IN_TABLE = "rounded-none border-0 bg-transparent py-10 whitespace-normal";
const icon = <PackageSearch className="size-8" />;

/**
 * Thông báo trong thân bảng cho ba trạng thái rỗng: chưa có dữ liệu, lọc không ra kết quả, trang vượt
 * quá dữ liệu. `undefined` khi có dòng để hiện.
 */
export function inventoryItemTableEmptyState(s: InventoryItemListState) {
  if (s.emptyState === "no-items") {
    return (
      <EmptyState
        className={IN_TABLE}
        icon={icon}
        title={L.empty.noItems}
        description={L.empty.noItemsHint}
      />
    );
  }
  if (s.emptyState === "no-results") {
    return (
      <EmptyState
        className={IN_TABLE}
        icon={icon}
        title={L.empty.noResults}
        action={
          <Button type="button" variant="outline" size="sm" onClick={s.clearFilters}>
            {L.empty.clearFilters}
          </Button>
        }
      />
    );
  }
  if (s.emptyState === "invalid-page") {
    return (
      <EmptyState
        className={IN_TABLE}
        icon={icon}
        title={L.invalidPage}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void s.filters.setPage(1)}
          >
            {L.empty.firstPage}
          </Button>
        }
      />
    );
  }
  return undefined;
}
