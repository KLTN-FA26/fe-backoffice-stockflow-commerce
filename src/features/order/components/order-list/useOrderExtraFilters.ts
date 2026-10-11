"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { ORDER_PAYMENT_TERMS } from "@/constants";

/** Khoá URL của bộ lọc riêng trang đơn (ngoài status/q/page/sort của `useUrlFilters`). */
export const ORDER_FILTER_KEYS = {
  customer: "customer",
  from: "from",
  to: "to",
  term: "term",
} as const;

/** `yyyy-MM-dd` — đúng định dạng `LocalDate` BE nhận ở `placedFrom/placedTo`. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bộ lọc khách / ngày đặt / phương thức thanh toán trên URL (state-persistence: người khác mở
 * link phải thấy cùng danh sách). Đổi bộ lọc → về trang 1 (`resetPage`).
 */
export function useOrderExtraFilters(resetPage: () => void) {
  const [customerId, setCustomerId] = useQueryState(
    ORDER_FILTER_KEYS.customer,
    parseAsString.withDefault(""),
  );
  const [placedFrom, setPlacedFrom] = useQueryState(
    ORDER_FILTER_KEYS.from,
    parseAsString.withDefault(""),
  );
  const [placedTo, setPlacedTo] = useQueryState(
    ORDER_FILTER_KEYS.to,
    parseAsString.withDefault(""),
  );
  const [paymentTerm, setPaymentTerm] = useQueryState(
    ORDER_FILTER_KEYS.term,
    parseAsStringLiteral(ORDER_PAYMENT_TERMS),
  );

  const from = ISO_DAY.test(placedFrom) ? placedFrom : "";
  const to = ISO_DAY.test(placedTo) ? placedTo : "";
  // BE OrderServiceImpl: placedTo trước placedFrom → 400. Chặn ở FE, không gửi khoảng sai.
  const invalidRange = from !== "" && to !== "" && to < from;

  const withPageReset =
    <T>(setter: (value: T) => unknown) =>
    (value: T) => {
      void setter(value);
      resetPage();
    };

  return {
    customerId: customerId.trim(),
    placedFrom: from,
    placedTo: to,
    paymentTerm,
    invalidRange,
    /** Giá trị gửi API — bỏ khoảng ngày sai thay vì để BE trả 400. */
    params: {
      customerId: customerId.trim() || undefined,
      placedFrom: invalidRange ? undefined : from || undefined,
      placedTo: invalidRange ? undefined : to || undefined,
      paymentTerm: paymentTerm ?? undefined,
    },
    active: customerId.trim() !== "" || from !== "" || to !== "" || paymentTerm !== null,
    setCustomerId: withPageReset((v: string) => setCustomerId(v.trim() || null)),
    setPlacedFrom: withPageReset((v: string) => setPlacedFrom(v || null)),
    setPlacedTo: withPageReset((v: string) => setPlacedTo(v || null)),
    setPaymentTerm: withPageReset(setPaymentTerm),
    clearDates: () => {
      void setPlacedFrom(null);
      void setPlacedTo(null);
      resetPage();
    },
    reset: () => {
      void setCustomerId(null);
      void setPlacedFrom(null);
      void setPlacedTo(null);
      void setPaymentTerm(null);
    },
  };
}

export type OrderExtraFilters = ReturnType<typeof useOrderExtraFilters>;
