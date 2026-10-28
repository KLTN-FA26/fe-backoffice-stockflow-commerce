"use client";

import { useEffect, useRef, useState } from "react";

import { SHIPPING_LIMITS } from "@/constants";
import { useScanTone } from "@/hooks/use-scan-tone";

import type { ScanFeedback } from "@/components/backoffice/ScanInput";

/**
 * Quét đúng: màu xanh tự tắt sau `scanFeedbackMs`. Quét sai: giữ màu đỏ tới lần quét kế — người
 * đang bốc kiện có thể không nhìn màn hình đúng 1–2 giây đó. Kèm tiếng báo đúng / sai.
 */
export function useScanFeedback(alive: React.RefObject<boolean>) {
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playTone = useScanTone();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const show = (next: Omit<ScanFeedback, "seq">) => {
    if (!alive.current) return;
    if (timer.current) clearTimeout(timer.current);
    // `seq` đổi mỗi lần quét → quét lại đúng mã lỗi cũ vẫn chớp lại + đọc lại cho trình đọc màn hình
    setFeedback((prev) => ({ ...next, seq: (prev?.seq ?? 0) + 1 }));
    playTone(next.tone);
    if (next.tone === "positive") {
      timer.current = setTimeout(() => setFeedback(null), SHIPPING_LIMITS.scanFeedbackMs);
    }
  };
  return [feedback, show] as const;
}
