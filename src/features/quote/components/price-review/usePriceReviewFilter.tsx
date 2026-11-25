"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Hourglass } from "lucide-react";

import { QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

const R = QUOTE_PRICE_REVIEW_LABELS;
/** `?priceReview=PENDING` — hàng chờ duyệt giá của Quản lý kinh doanh (14 BR-10, BE `GET /quotes?priceReview=PENDING`). */
const PRICE_REVIEW_FILTER = parseAsStringLiteral(["PENDING"] as const);

/**
 * Lọc "Chờ duyệt giá" của danh sách báo giá — sống trên URL (nuqs, state-persistence): nút bật / tắt cho toolbar, mục
 * tóm tắt bộ lọc, và `clear` cho "Bỏ lọc". Đổi lọc thì về trang 1 (`onChange`).
 */
export function usePriceReviewFilter(onChange: () => void) {
  const [value, setValue] = useQueryState("priceReview", PRICE_REVIEW_FILTER);
  const clear = () => {
    void setValue(null);
    onChange();
  };
  const toggle = (
    <Button
      type="button"
      size="sm"
      variant={value ? "default" : "outline"}
      aria-pressed={!!value}
      className={TOOLBAR_ACTION_CLASS}
      onClick={() => {
        void setValue(value ? null : "PENDING");
        onChange();
      }}
    >
      <Hourglass className="size-3.5" /> {R.filter}
    </Button>
  );
  const summaryItem = {
    label: R.filterSummary,
    value: value ? R.filter : R.filterAll,
    active: !!value,
    onClear: clear,
  };
  return { value: value ?? undefined, toggle, summaryItem, clear: () => void setValue(null) };
}
