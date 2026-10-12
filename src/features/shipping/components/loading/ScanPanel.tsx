"use client";

import { useEffect, useRef, useState } from "react";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { primeScanAudio, useScanTone } from "@/hooks/use-scan-tone";
import { ApiError } from "@/lib/api/error";
import { isScanQueueFatal, shippingErrorMessage } from "@/features/shipping/errors";
import { scanPackageInputSchema } from "@/features/shipping/input-schemas";
import { useScanPackage } from "@/features/shipping/mutations";
import { reconcileLoad } from "@/features/shipping/selectors";
import { ScanInput } from "@/components/backoffice/ScanInput";

import type { ScanFeedback } from "@/components/backoffice/ScanInput";
import type { Load } from "@/features/shipping/types";

const S = UI_LABELS.shipping.scan;

/**
 * Quét đúng: màu xanh tự tắt sau `scanFeedbackMs`. Quét sai: giữ màu đỏ tới lần quét kế — người
 * đang bốc kiện có thể không nhìn màn hình đúng 1–2 giây đó. Kèm tiếng báo đúng / sai.
 */
function useScanFeedback(alive: React.RefObject<boolean>) {
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

/**
 * Quét kiện lên xe (docs 09 §4 bước 4, F-SHP bước 04): BE từ chối kiện không thuộc chuyến
 * (PACKAGE_NOT_IN_LOAD) hoặc đã quét (PACKAGE_ALREADY_LOADED).
 * Máy quét gửi mã liên tục → mã xếp hàng đợi và gửi lần lượt (giữ thứ tự, không gửi chồng); mã
 * đang chờ / đang gửi mà quét lại thì bỏ qua. Rời màn hoặc chuyến đổi trạng thái ở nơi khác → bỏ
 * phần còn lại của hàng đợi, không gửi tiếp các mã chắc chắn bị từ chối (các mã đó vào danh sách
 * từ chối với lý do "chưa gửi được" để người dùng quét lại).
 */
export function ScanPanel({
  load,
  onReject,
}: {
  load: Load;
  /** Mã quét không thành công → danh sách ở màn (xem RejectedScans). */
  onReject: (codes: readonly string[], message: string) => void;
}) {
  const scan = useScanPackage();
  const alive = useRef(true);
  const [feedback, show] = useScanFeedback(alive);
  const queue = useRef<string[]>([]);
  const busy = useRef(false);
  const [queued, setQueued] = useState(0);

  // Ref để cleanup lúc unmount gọi được bản `onReject` mới nhất
  const onRejectRef = useRef(onReject);
  useEffect(() => {
    onRejectRef.current = onReject;
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Ô quét biến mất giữa lúc còn mã chờ gửi (chuyến đổi trạng thái / mất quyền) → ghi các mã chưa
      // gửi vào danh sách để quét lại, không bỏ âm thầm (mã đang gửi tự báo kết quả khi về)
      onRejectRef.current(queue.current.slice(busy.current ? 1 : 0), S.notSent);
      queue.current = [];
    };
  }, []);

  const drain = async () => {
    if (busy.current) return;
    busy.current = true;
    while (alive.current && queue.current.length > 0) {
      const packageCode = queue.current[0] ?? "";
      try {
        const next = await scan.mutateAsync({ loadId: load.loadId, packageCode });
        const { loaded, planned } = reconcileLoad(next);
        show({
          tone: "positive",
          message: `${packageCode} — ${S.accepted} (${loaded}/${planned})`,
        });
      } catch (error: unknown) {
        // Kiện đã lên xe từ trước (quét đúp / máy khác đã quét) → không phải lỗi, không bắt gỡ khỏi xe
        if (error instanceof ApiError && error.code === "PACKAGE_ALREADY_LOADED") {
          show({ tone: "positive", message: `${packageCode} — ${shippingErrorMessage(error)}` });
        } else if (!(error instanceof ApiError)) {
          // Response sai hợp đồng (BE có thể đã nhận mã) → không ghi là kiện bị từ chối; bảng tải lại
          show({ tone: "danger", message: `${packageCode} — ${S.invalidResponse}` });
        } else {
          const message = shippingErrorMessage(error);
          show({ tone: "danger", message: `${packageCode} — ${message}` });
          onReject([packageCode], message);
        }
        // Chuyến không còn LOADING / mất quyền / mất mạng → các mã sau chắc chắn thất bại như nhau: bỏ
        // hàng đợi, ghi lại để quét lại. Lỗi khác (OPTIMISTIC_LOCK khi hai máy cùng quét, kiện không
        // thuộc chuyến) → vẫn gửi tiếp mã sau
        if (isScanQueueFatal(error)) {
          onReject(queue.current.slice(1), S.notSent);
          queue.current = [packageCode];
        }
      }
      queue.current.shift();
      if (alive.current) setQueued(queue.current.length);
    }
    busy.current = false;
  };

  const onScan = (raw: string) => {
    // Đang trong cử chỉ người dùng (Enter) → mở audio ngay, để tiếng báo sau khi có kết quả phát được
    primeScanAudio();
    const parsed = scanPackageInputSchema.safeParse({ packageCode: raw });
    if (!parsed.success) {
      show({ tone: "danger", message: parsed.error.issues[0]?.message ?? S.placeholder });
      return;
    }
    const { packageCode } = parsed.data;
    if (queue.current.includes(packageCode)) return;
    queue.current.push(packageCode);
    setQueued(queue.current.length);
    void drain();
  };

  return (
    <ScanInput
      id="load-scan"
      label={S.label}
      placeholder={S.placeholder}
      hint={S.hint}
      onScan={onScan}
      pending={queued > 0}
      feedback={feedback}
    />
  );
}
