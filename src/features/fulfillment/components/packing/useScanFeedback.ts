import { useEffect, useRef, useState } from "react";

import { PACKING_LIMITS } from "@/constants";
import { useScanTone } from "@/hooks/use-scan-tone";

import type { RefObject } from "react";
import type { ScanFeedback } from "@/components/backoffice/ScanInput";

/**
 * Phản hồi từng lần quét: đúng → xanh, tự tắt sau `scanFeedbackMs`; sai → đỏ, giữ tới lần quét kế
 * (người đang đóng hàng có thể không nhìn màn hình đúng 1–2 giây đó). Kèm tiếng báo đúng / sai.
 */
export function useScanFeedback(alive: RefObject<boolean>) {
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
      timer.current = setTimeout(() => setFeedback(null), PACKING_LIMITS.scanFeedbackMs);
    }
  };
  return [feedback, show] as const;
}
