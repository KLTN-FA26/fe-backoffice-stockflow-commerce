"use client";

import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import {
  INSTALLMENT_FILTER_STATUSES,
  INSTALLMENT_MILESTONES,
  PAYMENT_STORAGE_KEYS,
} from "@/constants/payment";

import { useInstallments } from "../queries";
import { usePagedList } from "@/hooks/use-paged-list";

import { INSTALLMENT_SORTABLE } from "./installment-columns";

/**
 * Trạng thái danh sách đợt thanh toán — mọi bộ lọc trên URL (nuqs): trạng thái, mốc, "đã đến mốc",
 * hạn trả trước ngày, khách, đơn. BE nhận MỘT trạng thái / mốc (docs 15 §4.1, §5.1).
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
  const [reached, setReached] = useQueryState("reached", parseAsBoolean);
  const [overdue, setOverdue] = useQueryState("overdue", parseAsBoolean);
  const [dueBefore, setDueBefore] = useQueryState("dueBefore", parseAsString.withDefault(""));
  const [customerId, setCustomerId] = useQueryState("customerId", parseAsString.withDefault(""));
  const [orderId, setOrderId] = useQueryState("orderId", parseAsString.withDefault(""));

  const query = useInstallments(
    {
      page: paged.apiPage,
      size: paged.pageSize,
      sort: paged.apiSort,
      status: status ?? undefined,
      milestone: milestone ?? undefined,
      reached: reached ?? undefined,
      overdue: overdue ?? undefined,
      dueBefore: dueBefore || undefined,
      customerId: customerId || undefined,
      orderId: orderId || undefined,
    },
    { enabled: canRead },
  );

  const hasFilters =
    !!status ||
    !!milestone ||
    reached !== null ||
    overdue !== null ||
    !!dueBefore ||
    !!customerId ||
    !!orderId;
  /** Đang xem đúng công nợ phải thu: đợt trả sau giao đã đến mốc (docs 15 §4.3 bước 8). */
  const receivablesOn = milestone === "AFTER_DELIVERY" && reached === true;

  /** Đổi bộ lọc → về trang 1. */
  const filter =
    <T>(setter: (value: T) => unknown) =>
    (value: T) => {
      void setter(value);
      paged.resetPage();
    };

  return {
    ...paged,
    query,
    status,
    milestone,
    reached,
    overdue,
    dueBefore,
    customerId,
    orderId,
    hasFilters,
    receivablesOn,
    setStatus: filter(setStatus),
    setMilestone: filter(setMilestone),
    setReached: filter(setReached),
    setOverdue: filter(setOverdue),
    setDueBefore: filter(setDueBefore),
    setCustomerId: filter(setCustomerId),
    setOrderId: filter(setOrderId),
    toggleReceivables: () => {
      void setMilestone(receivablesOn ? null : "AFTER_DELIVERY");
      void setReached(receivablesOn ? null : true);
      paged.resetPage();
    },
    clearFilters: () => {
      void setStatus(null);
      void setMilestone(null);
      void setReached(null);
      void setOverdue(null);
      void setDueBefore("");
      void setCustomerId("");
      void setOrderId("");
      paged.clearSort();
      paged.resetPage();
    },
  };
}

export type InstallmentListState = ReturnType<typeof useInstallmentListState>;
