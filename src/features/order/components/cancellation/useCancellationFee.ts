"use client";

import { useState } from "react";

import { parseFeeAmount } from "../useAgreedFeeFields";

import type { FeeBearerChoice } from "../FeeBearerField";

export type CancellationFeeMode = "none" | "percent" | "agreed";

/**
 * Trạng thái ô "phí giữ lại" của hộp thoại duyệt yêu cầu huỷ (docs 17 §4.8 bước 30): không phí / % số tiền đã thu / số
 * tiền thoả thuận — chọn một. `values` gộp vào input trước khi validate: chế độ nào không chọn thì không gửi field đó.
 * Ô % rỗng ở chế độ "percent" thành NaN để schema báo "Nhập tỷ lệ…" thay vì lặng lẽ coi là 0.
 */
export function useCancellationFee() {
  const [mode, setMode] = useState<CancellationFeeMode>("none");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [feeBearer, setFeeBearer] = useState<FeeBearerChoice>("");
  return {
    mode,
    percent,
    amount,
    reason,
    detail,
    feeBearer,
    setFeeBearer,
    setMode,
    setPercent,
    setAmount,
    setReason,
    setDetail,
    values: {
      retainedPercent:
        mode === "percent" ? (percent.trim() === "" ? Number.NaN : Number(percent)) : undefined,
      agreedFee: mode === "agreed" ? { amount: parseFeeAmount(amount), reason, detail } : undefined,
      // D50: chỉ gửi khi có phí (BE 400 nếu có bên chịu mà không có phí)
      feeBearer: mode !== "none" && feeBearer !== "" ? feeBearer : undefined,
    },
    /** Có phí (% hoặc thoả thuận) mà chưa chọn bên chịu → chưa cho gửi. */
    canSubmit: mode === "none" || feeBearer !== "",
  };
}

export type CancellationFeeState = ReturnType<typeof useCancellationFee>;
