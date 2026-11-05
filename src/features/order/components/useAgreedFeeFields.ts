"use client";

import { useState } from "react";

/** Một chuỗi chữ số liền, hoặc các nhóm 3 chữ số cùng dùng một dấu nghìn (chấm, phẩy hoặc khoảng trắng). */
const AMOUNT_TEXT = /^(?:\d+|\d{1,3}(?:([.,\s])\d{3}(?:\1\d{3})*))$/;

/**
 * Số tiền gõ vào → số nguyên VND. Chỉ nhận chữ số liền ("4000000") hoặc nhóm 3 chữ số cùng một dấu nghìn
 * ("4.000.000", "4,000,000", "4 000 000"). Mọi dạng khác — dấu thập phân ("150000.50", "1,5"), trộn dấu
 * ("150.000,5"), ký tự lạ, trống — trả NaN để schema báo "Nhập số tiền nguyên lớn hơn 0" thay vì lặng lẽ đọc
 * sai thành một số khác (VND không có số lẻ, `Order#requireRemainderFee`).
 */
export function parseFeeAmount(text: string): number {
  const trimmed = text.trim();
  if (!AMOUNT_TEXT.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(/[.,\s]/g, ""));
}

/** Trạng thái ô "phí đã thoả thuận" của hộp thoại đóng phần còn lại. */
export function useAgreedFeeFields() {
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  return {
    enabled,
    amount,
    reason,
    detail,
    setEnabled,
    setAmount,
    setReason,
    setDetail,
    /** Phần gộp vào input của schema: không bật thì không gửi `agreedFee`. */
    values: {
      agreedFee: enabled ? { amount: parseFeeAmount(amount), reason, detail } : undefined,
    },
    reset: () => {
      setEnabled(false);
      setAmount("");
      setReason("");
      setDetail("");
    },
  };
}

export type AgreedFeeFields = ReturnType<typeof useAgreedFeeFields>;
