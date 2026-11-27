"use client";

import { parseAsString, useQueryState } from "nuqs";

import { isValidOrderCustomerId } from "../../schemas";

/** Khoá URL của bộ lọc riêng trang đơn (ngoài status/q/page/sort của `useUrlFilters`). */
export const ORDER_FILTER_KEYS = {
  customer: "customer",
  from: "from",
  to: "to",
  /** Lọc chữ trên header cột Mã đơn / Người nhận — tách khỏi ô tìm chính `q`. */
  number: "ordNo",
  recipient: "ordRecipient",
  /** Khoảng tổng tiền (BE không có tham số → chỉ lọc trang đang xem). */
  totalFrom: "ordTotalFrom",
  totalTo: "ordTotalTo",
} as const;

/** `yyyy-MM-dd` — đúng định dạng `LocalDate` BE nhận ở `placedFrom/placedTo`. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bộ lọc khách / ngày đặt trên URL (state-persistence: người khác mở link phải thấy cùng danh
 * sách). Đổi bộ lọc → về trang 1 (`resetPage`). Chỉ những tham số BE `GET /orders` nhận —
 * không có phương thức thanh toán (BE chưa hỗ trợ lọc theo `paymentTerm`).
 *
 * `customer` trên URL có thể sai (link cũ, gõ tay): chỉ UUID hợp lệ mới vào `params` / query key — không bao giờ để
 * BE trả 400 cả trang; giá trị sai bị bỏ qua (ô chọn khách chỉ ghi UUID thật).
 */
export function useOrderExtraFilters(resetPage: () => void) {
  const [customerRaw, setCustomerId] = useQueryState(
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

  const [numberText, setNumberText] = useQueryState(
    ORDER_FILTER_KEYS.number,
    parseAsString.withDefault(""),
  );
  const [recipientText, setRecipientText] = useQueryState(
    ORDER_FILTER_KEYS.recipient,
    parseAsString.withDefault(""),
  );

  const [totalFrom, setTotalFrom] = useQueryState(
    ORDER_FILTER_KEYS.totalFrom,
    parseAsString.withDefault(""),
  );
  const [totalTo, setTotalTo] = useQueryState(
    ORDER_FILTER_KEYS.totalTo,
    parseAsString.withDefault(""),
  );

  const customerInput = customerRaw.trim();
  const customerId = isValidOrderCustomerId(customerInput) ? customerInput : "";
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
    /** Khách đang lọc thật (UUID hợp lệ) — "" khi không lọc hoặc giá trị URL sai. */
    customerId,
    placedFrom: from,
    placedTo: to,
    invalidRange,
    /** Giá trị gửi API — bỏ khách / khoảng ngày sai thay vì để BE trả 400. */
    params: {
      customerId: customerId || undefined,
      placedFrom: invalidRange ? undefined : from || undefined,
      placedTo: invalidRange ? undefined : to || undefined,
    },
    /** Chữ lọc trên header cột Mã đơn / Người nhận (URL). */
    numberText,
    recipientText,
    totalFrom,
    totalTo,
    columnTextActive:
      numberText.trim() !== "" || recipientText.trim() !== "" || totalFrom !== "" || totalTo !== "",
    active:
      customerId !== "" ||
      from !== "" ||
      to !== "" ||
      numberText.trim() !== "" ||
      recipientText.trim() !== "" ||
      totalFrom !== "" ||
      totalTo !== "",
    setCustomerId: withPageReset((v: string) => setCustomerId(v.trim() || null)),
    setPlacedFrom: withPageReset((v: string) => setPlacedFrom(v || null)),
    setPlacedTo: withPageReset((v: string) => setPlacedTo(v || null)),
    /** Lọc header cột Ngày đặt đổi cả hai đầu một lần. */
    setPlacedRange: withPageReset(({ from: f, to: t }: { from: string; to: string }) => {
      void setPlacedFrom(f || null);
      return setPlacedTo(t || null);
    }),
    setTotalRange: withPageReset(({ from: f, to: t }: { from: string; to: string }) => {
      void setTotalFrom(f || null);
      return setTotalTo(t || null);
    }),
    setNumberText: withPageReset((v: string) => setNumberText(v || null)),
    setRecipientText: withPageReset((v: string) => setRecipientText(v || null)),
    clearColumnText: () => {
      void setNumberText(null);
      void setRecipientText(null);
      void setTotalFrom(null);
      void setTotalTo(null);
      resetPage();
    },
    clearDates: () => {
      void setPlacedFrom(null);
      void setPlacedTo(null);
      resetPage();
    },
    reset: () => {
      void setTotalFrom(null);
      void setTotalTo(null);
      void setNumberText(null);
      void setRecipientText(null);
      void setCustomerId(null);
      void setPlacedFrom(null);
      void setPlacedTo(null);
    },
  };
}

export type OrderExtraFilters = ReturnType<typeof useOrderExtraFilters>;
