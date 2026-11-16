import { useEffect, useRef, useState } from "react";

import { UI_LABELS } from "@/constants";
import { primeScanAudio } from "@/hooks/use-scan-tone";
import { lpnInputSchema } from "@/features/fulfillment/carton-check-input-schemas";
import { cartonCheckErrorMessage } from "@/features/fulfillment/carton-check-errors";
import { useCheckCarton } from "@/features/fulfillment/carton-check-mutations";
import { findCarton, isChecked } from "@/features/fulfillment/carton-check-selectors";

import { useScanFeedback } from "./useScanFeedback";

import type { CartonCheckSession } from "@/features/fulfillment/carton-check-types";

const S = UI_LABELS.cartonCheck.scan;

/**
 * Luồng quét LPN (docs 08 §4.2 bước 3). Máy quét gửi liên tục nên các lần quét xếp hàng đợi và gửi lần lượt. BE xử lý
 * mỗi LPN một cách bất biến — quét lại thùng đã kiểm trả 200, không ghi thêm (BR-05) — nên lỗi mạng không cần mã lần
 * quét: quét lại là đủ. Quét sai (LPN lạ / của đơn khác) → BE 409 `CARTON_NOT_IN_TASK`, hiện đỏ tới lần quét kế.
 */
export function useCartonScan(session: CartonCheckSession) {
  const check = useCheckCarton();
  const alive = useRef(true);
  const [feedback, show] = useScanFeedback(alive);
  const queue = useRef<string[]>([]);
  const busy = useRef(false);
  const latest = useRef(session);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    latest.current = session;
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      queue.current = [];
    };
  }, []);

  const drain = async () => {
    if (busy.current) return;
    busy.current = true;
    while (alive.current && queue.current.length > 0) {
      const lpn = queue.current.shift();
      if (!lpn) break;
      // Trước lần gọi: thùng đã quét / dán nhãn từ trước → BE không ghi thêm
      const before = findCarton(latest.current, lpn);
      try {
        await check.mutateAsync({ taskId: latest.current.taskId, lpn });
        show({
          tone: "positive",
          message:
            before && isChecked(before) ? S.repeated(before.lpn) : S.checked(before?.lpn ?? lpn),
        });
      } catch (error: unknown) {
        const message = cartonCheckErrorMessage(error, {
          starterName: latest.current.startedByName,
        });
        show({ tone: "danger", message: `${lpn} — ${message}` });
      }
      if (alive.current) setQueued(queue.current.length);
    }
    busy.current = false;
  };

  const onScan = (raw: string) => {
    // Đang trong cử chỉ người dùng (Enter) → mở audio ngay, để tiếng báo sau khi có kết quả phát được
    primeScanAudio();
    const parsed = lpnInputSchema.safeParse(raw);
    if (!parsed.success) {
      show({ tone: "danger", message: parsed.error.issues[0]?.message ?? S.label });
      return;
    }
    queue.current.push(parsed.data);
    setQueued(queue.current.length);
    void drain();
  };

  return { feedback, queued, onScan };
}
