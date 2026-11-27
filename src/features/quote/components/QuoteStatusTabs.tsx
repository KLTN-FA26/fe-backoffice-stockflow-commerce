"use client";

import { PageTabs } from "@/components/shared/PageTabs";

import { QUOTE_LIST_TABS as T } from "./copy";

import type { QuoteApiStatus } from "@/constants";
import type { PageTabItem } from "@/components/shared/PageTabs";
import type { QuoteListFilters } from "./useQuoteListFilters";

type QuoteTab =
  "all" | "priceReview" | "DRAFT" | "SENT" | "CHANGES_REQUESTED" | "ACCEPTED" | "CONVERTED";

/** Thứ tự theo việc của Sale: soạn → chờ duyệt giá → đã gửi → khách yêu cầu sửa → chấp nhận → đã tạo đơn. */
const TABS: readonly PageTabItem<QuoteTab>[] = [
  { value: "all", label: T.all },
  { value: "DRAFT", label: T.DRAFT },
  { value: "priceReview", label: T.priceReview },
  { value: "SENT", label: T.SENT },
  { value: "CHANGES_REQUESTED", label: T.CHANGES_REQUESTED },
  { value: "ACCEPTED", label: T.ACCEPTED },
  { value: "CONVERTED", label: T.CONVERTED },
];

/** Tab đang khớp với bộ lọc trên URL; lọc kết hợp khác (vd hai trạng thái) thì không tab nào sáng. */
function activeTab(status: readonly QuoteApiStatus[], priceReview: boolean): QuoteTab | null {
  if (priceReview) return status.length === 0 ? "priceReview" : null;
  if (status.length === 0) return "all";
  const only = status.length === 1 ? status[0] : undefined;
  return TABS.find((tab) => tab.value === only)?.value ?? null;
}

/**
 * Tab nhanh theo trạng thái của danh sách báo giá (rà UI WF-02 bo-06): một bấm thay cho mở "Bộ lọc". Tab chỉ là lối tắt
 * của hai bộ lọc có sẵn trên URL — `status` (BE `status`) và `priceReview` (BE `priceReview=PENDING`); bấm tab về trang 1.
 * BE không trả số đếm theo trạng thái nên tab không có số.
 */
export function QuoteStatusTabs({ state }: { state: QuoteListFilters }) {
  const { filters, priceReview } = state;
  const value = activeTab(filters.status, !!priceReview.value);
  return (
    <PageTabs<QuoteTab | "custom">
      tabs={TABS}
      value={value ?? "custom"}
      idPrefix="quote-status"
      ariaLabel={T.ariaLabel}
      onChange={(next) => {
        if (next === "custom") return;
        if (next === "priceReview") {
          void filters.setStatus([]);
          priceReview.select();
        } else {
          priceReview.clear();
          void filters.setStatus(next === "all" ? [] : [next]);
        }
        void filters.setPage(1);
      }}
    />
  );
}
