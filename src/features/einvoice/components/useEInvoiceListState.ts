"use client";

import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import {
  EINVOICE_LATE_WARNING,
  EINVOICE_STATUSES,
  EINVOICE_STORAGE_KEYS,
  EINVOICE_TYPES,
} from "@/constants/einvoice";
import { usePagedList } from "@/hooks/use-paged-list";

import { useEInvoices } from "../queries";

const NO_SORT = new Set<string>();

/**
 * Trạng thái danh sách hoá đơn — mọi bộ lọc trên URL (nuqs): trạng thái, loại, ngày lập, quá hạn
 * phát hành, đơn, khách. BE nhận MỘT trạng thái / loại và tự xếp: chưa phát hành trước, hạn gần trước.
 */
export function useEInvoiceListState(canRead: boolean) {
  const paged = usePagedList(EINVOICE_STORAGE_KEYS.listConfig, NO_SORT);
  const [status, setStatus] = useQueryState("status", parseAsStringLiteral(EINVOICE_STATUSES));
  const [type, setType] = useQueryState("type", parseAsStringLiteral(EINVOICE_TYPES));
  const [issuedFrom, setIssuedFrom] = useQueryState("issuedFrom", parseAsString.withDefault(""));
  const [issuedTo, setIssuedTo] = useQueryState("issuedTo", parseAsString.withDefault(""));
  const [overdue, setOverdue] = useQueryState("overdue", parseAsBoolean);
  // WF-05 Q-10: "Hoá đơn lập trễ" — Kế toán đếm được hoá đơn phát hành sau ngày giao
  const [late, setLate] = useQueryState("late", parseAsBoolean);
  const [orderId, setOrderId] = useQueryState("orderId", parseAsString.withDefault(""));
  const [customerId, setCustomerId] = useQueryState("customerId", parseAsString.withDefault(""));

  const query = useEInvoices(
    {
      page: paged.apiPage,
      size: paged.pageSize,
      status: status ?? undefined,
      type: type ?? undefined,
      issuedFrom: issuedFrom || undefined,
      issuedTo: issuedTo || undefined,
      // Quá hạn phát hành = chưa phát hành và hạn trước "bây giờ" (BE `dueBefore`)
      dueBefore: overdue ? new Date().toISOString().slice(0, 16) + ":00Z" : undefined,
      orderId: orderId || undefined,
      customerId: customerId || undefined,
      warning: late ? EINVOICE_LATE_WARNING : undefined,
    },
    { enabled: canRead },
  );

  const hasFilters =
    !!status ||
    !!type ||
    !!issuedFrom ||
    !!issuedTo ||
    !!overdue ||
    !!late ||
    !!orderId ||
    !!customerId;
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
    type,
    issuedFrom,
    issuedTo,
    overdue,
    late,
    orderId,
    customerId,
    hasFilters,
    pendingOn: status === "DRAFT",
    setStatus: filter(setStatus),
    setType: filter(setType),
    setIssuedFrom: filter(setIssuedFrom),
    setIssuedTo: filter(setIssuedTo),
    setOverdue: filter(setOverdue),
    setLate: filter(setLate),
    setOrderId: filter(setOrderId),
    setCustomerId: filter(setCustomerId),
    clearFilters: () => {
      for (const clear of [setStatus, setType, setOverdue, setLate]) void clear(null);
      for (const clear of [setIssuedFrom, setIssuedTo, setOrderId, setCustomerId]) void clear("");
      paged.resetPage();
    },
  };
}

export type EInvoiceListState = ReturnType<typeof useEInvoiceListState>;
