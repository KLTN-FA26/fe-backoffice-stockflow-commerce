import { useState } from "react";

import { PICK_LINE_ERROR_MESSAGES, PICK_LINE_LABELS } from "@/constants";
import { sameScannedCode } from "@/features/fulfillment/pick-line-selectors";

import type { ScanFeedback } from "@/components/backoffice/ScanInput";

/**
 * Bước "quét vị trí" của lấy hàng / báo thiếu (docs 07 §4.2 bước 5, §4.4 bước 9). Mã quét so với vị trí của dòng như BE
 * (cắt khoảng trắng, không phân biệt hoa thường): sai → báo ngay tại ô, không đi tiếp; đúng → nhận chính MÃ CỦA DÒNG
 * (không phải chữ vừa gõ — BE vẫn kiểm lại khi gửi). Lỗi BE trả về ô (`serverMessage` + `serverSeq`) hiện cùng chỗ; `seq`
 * tăng mỗi lần để cùng một câu lỗi lặp lại vẫn được đọc lại.
 */
export function useLocationScan({
  expected,
  current,
  accept,
  reject,
  serverMessage,
  serverSeq = 0,
}: {
  expected: string;
  /** Vị trí đã nhận (rỗng = chưa quét). */
  current: string;
  accept: (canonicalCode: string) => void;
  reject?: () => void;
  serverMessage?: string;
  serverSeq?: number;
}) {
  const [wrong, setWrong] = useState<ScanFeedback | null>(null);
  const [seq, setSeq] = useState(0);

  const onScan = (code: string) => {
    if (!sameScannedCode(code, expected)) {
      setSeq((n) => n + 1);
      setWrong({
        tone: "danger",
        message: PICK_LINE_ERROR_MESSAGES.locationMismatch(expected),
        seq: seq + 1,
      });
      reject?.();
      return;
    }
    setWrong(null);
    accept(expected);
  };

  const feedback: ScanFeedback | null = current
    ? { tone: "positive", message: PICK_LINE_LABELS.locationOk(current) }
    : serverMessage
      ? { tone: "danger", message: serverMessage, seq: 1000 + serverSeq }
      : wrong;
  return { onScan, feedback };
}
