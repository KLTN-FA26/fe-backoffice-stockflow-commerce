"use client";

import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import {
  INSTALLMENT_FILTER_STATUSES,
  INSTALLMENT_MILESTONES,
  PAYMENT_STORAGE_KEYS,
} from "@/constants/payment";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { useInstallments } from "../queries";
import { usePagedList } from "@/hooks/use-paged-list";

import { INSTALLMENT_SORTABLE } from "./installment-columns";

/**
 * Trạng thái danh sách đợt thanh toán — mọi bộ lọc trên URL (nuqs): trạng thái, mốc, "đã đến mốc",
 * hạn trả trước ngày, khách, đơn. BE nhận MỘT trạng thái / mốc (docs 15 §4.1, §5.1).
 *
 * Mặc định là hàng việc của Kế toán (bo-22): "Công nợ phải thu" (`owing=true`) theo hạn trả sớm nhất trước — không phải
 * "Tất cả", nơi các đợt đã trả từ lâu chiếm trang 1. Mặc định chỉ áp khi URL không nói gì về `owing` và không chọn
 * trạng thái / khách / đơn (xem một trạng thái, "Các đợt của khách này", các đợt của một đơn là xem đủ). Người dùng tắt
 * thì URL giữ `owing=false`.
 */
export function useInstallmentListState(canRead: boolean) {
  const paged = usePagedList(PAYMENT_STORAGE_KEYS.installmentsConfig, INSTALLMENT_SORTABLE);
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(INSTALLMENT_FILTER_STATUSES),
  );
  const [milestone, setMilestone] = useQueryState(
    "milestone",
    parseAsStringLiteral(INSTALLMENT_MILESTONES),
  );
  const [owing, setOwing] = useQueryState("owing", parseAsBoolean);
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const debouncedSearch = useDebouncedValue(search, 300);
  const [reached, setReached] = useQueryState("reached", parseAsBoolean);
  const [overdue, setOverdue] = useQueryState("overdue", parseAsBoolean);
  const [dueBefore, setDueBefore] = useQueryState("dueBefore", parseAsString.withDefault(""));
  const [customerId, setCustomerId] = useQueryState("customerId", parseAsString.withDefault(""));
  const [orderId, setOrderId] = useQueryState("orderId", parseAsString.withDefault(""));

  const owingByDefault = !status && !customerId && !orderId;
  /** Đang xem đúng công nợ phải thu (BE-5 `owing=true`): theo URL, không có thì theo mặc định. */
  const receivablesOn = owing ?? owingByDefault;

  const query = useInstallments(
    {
      page: paged.apiPage,
      size: paged.pageSize,
      sort: paged.apiSort,
      status: status ?? undefined,
      milestone: milestone ?? undefined,
      reached: reached ?? undefined,
      owing: receivablesOn ? true : undefined,
      search: debouncedSearch.trim() || undefined,
      overdue: overdue ?? undefined,
      dueBefore: dueBefore || undefined,
      customerId: customerId || undefined,
      orderId: orderId || undefined,
    },
    { enabled: canRead },
  );

  /** Bộ lọc người dùng chọn (ngoài "Công nợ phải thu"). */
  const narrowed =
    !!status ||
    !!milestone ||
    reached !== null ||
    !!search.trim() ||
    overdue !== null ||
    !!dueBefore ||
    !!customerId ||
    !!orderId;
  /** Đang thu hẹp danh sách, kể cả "Công nợ phải thu". */
  const hasFilters = narrowed || receivablesOn;
  /** Đúng hàng việc mặc định (Công nợ phải thu, không lọc gì thêm) — rỗng nghĩa là "không còn đợt nào cần thu". */
  const defaultQueue = receivablesOn && owing === null && !narrowed;
  /** Khác cấu hình mặc định (để bật "Đặt lại"): bộ lọc nào đó, hoặc "Công nợ phải thu" lệch mặc định. */
  const changedFromDefault = narrowed || receivablesOn !== owingByDefault;

  /** Đổi bộ lọc → về trang 1. */
  const filter =
    <T>(setter: (value: T) => unknown) =>
    (value: T) => {
      void setter(value);
      paged.resetPage();
    };

  const clear = () => {
    void setStatus(null);
    void setMilestone(null);
    void setReached(null);
    void setSearch("");
    void setOverdue(null);
    void setDueBefore("");
    void setCustomerId("");
    void setOrderId("");
    paged.clearSort();
    paged.resetPage();
  };

  return {
    ...paged,
    // Không chọn cột: BE xếp theo hạn trả sớm nhất trước (`InstallmentService.SORT`) — header hiện đúng điều đó
    sorting: {
      ...paged.sorting,
      key: paged.sorting.key ?? "dueDate",
      direction: paged.sorting.key ? paged.sorting.direction : ("asc" as const),
    },
    query,
    status,
    milestone,
    reached,
    owing,
    search,
    overdue,
    dueBefore,
    customerId,
    orderId,
    hasFilters,
    defaultQueue,
    changedFromDefault,
    receivablesOn,
    setStatus: filter(setStatus),
    setMilestone: filter(setMilestone),
    setReached: filter(setReached),
    setSearch: filter(setSearch),
    setOverdue: filter(setOverdue),
    setDueBefore: filter(setDueBefore),
    setCustomerId: filter(setCustomerId),
    setOrderId: filter(setOrderId),
    /** Bật / tắt "Công nợ phải thu"; trùng mặc định thì xoá hẳn tham số khỏi URL. */
    toggleReceivables: () => {
      const next = !receivablesOn;
      void setOwing(next === owingByDefault ? null : next);
      paged.resetPage();
    },
    /** "Bỏ bộ lọc" của trạng thái rỗng: xem mọi đợt, kể cả "Công nợ phải thu" mặc định. */
    clearFilters: () => {
      clear();
      void setOwing(false);
    },
    /** "Đặt lại": về cấu hình mặc định (Công nợ phải thu, hạn sớm nhất trước). */
    resetToDefault: () => {
      clear();
      void setOwing(null);
    },
  };
}

export type InstallmentListState = ReturnType<typeof useInstallmentListState>;
