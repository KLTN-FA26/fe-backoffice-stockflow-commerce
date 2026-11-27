"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { ListFilterColumn } from "@/components/shared/ListToolbar";

const R = QUOTE_PRICE_REVIEW_LABELS;
/** `?priceReview=PENDING` — hàng chờ duyệt giá của Quản lý kinh doanh (14 BR-10, BE `GET /quotes?priceReview=PENDING`). */
const PRICE_REVIEW_FILTER = parseAsStringLiteral(["PENDING"] as const);
const OPTIONS = [{ value: "PENDING" as const, label: R.filter }];

/**
 * Lọc "Chờ duyệt giá" của danh sách báo giá — sống trên URL (nuqs, state-persistence): một cột trong bảng "Bộ lọc"
 * (backoffice-erp-ui §4 — không đặt nút lọc rời trên hàng tìm kiếm), mục tóm tắt bộ lọc, và `clear` cho "Bỏ lọc". Đổi lọc
 * thì về trang 1 (`onChange`).
 */
export function usePriceReviewFilter(onChange: () => void) {
  const [value, setValue] = useQueryState("priceReview", PRICE_REVIEW_FILTER);
  const clear = () => {
    void setValue(null);
    onChange();
  };
  const column = (
    <ListFilterColumn
      title={R.filterSummary}
      searchPlaceholder="Tìm…"
      emptyText="Không có lựa chọn"
      options={OPTIONS}
      isChecked={() => !!value}
      onSelect={() => {
        void setValue(value ? null : "PENDING");
        onChange();
      }}
    />
  );
  const summaryItem = {
    label: R.filterSummary,
    value: value ? R.filter : R.filterAll,
    active: !!value,
    onClear: clear,
  };
  return { value: value ?? undefined, column, summaryItem, clear: () => void setValue(null) };
}
