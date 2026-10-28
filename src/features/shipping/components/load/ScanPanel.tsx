"use client";

import { useEffect, useRef, useState } from "react";

import { UI_LABELS } from "@/constants";
import { primeScanAudio } from "@/hooks/use-scan-tone";
import { ApiError } from "@/lib/api/error";
import {
  isScanQueueFatal,
  isTransientError,
  shippingErrorMessage,
} from "@/features/shipping/errors";
import { scanPackageInputSchema } from "@/features/shipping/input-schemas";
import { useScanPackage } from "@/features/shipping/mutations";
import { forgetScanId, scanIdFor } from "@/features/shipping/scan-ids";
import { isLabelLoaded, reconcileLoad } from "@/features/shipping/selectors";
import { ScanInput } from "@/components/backoffice/ScanInput";

import { useScanFeedback } from "./useScanFeedback";

import type { Load } from "@/features/shipping/types";

const S = UI_LABELS.shipping.scan;

/**
 * Quét kiện lên xe (docs 09 §4.1 bước 3): BE chỉ nhận kiện của các lô trên biên bản (PACKAGE_NOT_IN_LOAD
 * nếu không), từ chối kiện đã lên chuyến khác (PACKAGE_ALREADY_LOADED), chưa sẵn sàng (PACKAGE_NOT_READY)
 * hoặc của hãng khác (PACKAGE_OTHER_CARRIER). Quét lại kiện đã lên đúng chuyến này → 200 → báo "đã lên
 * xe" như lần đầu.
 *
 * Mỗi lần quét có `scanId` riêng; lần quét lại cùng mã sau lỗi tạm thời (mất mạng, 5xx, phản hồi sai —
 * yêu cầu có thể đã tới BE) dùng lại ĐÚNG `scanId` đó để BE không ghi hai lần. Lỗi 4xx là câu trả lời
 * dứt khoát nên lần quét sau lấy `scanId` mới.
 * Máy quét gửi mã liên tục → mã xếp hàng đợi và gửi lần lượt (giữ thứ tự, không gửi chồng); mã đang
 * chờ / đang gửi mà quét lại thì bỏ qua. Rời màn hoặc chuyến đổi trạng thái ở nơi khác → bỏ phần còn
 * lại của hàng đợi, ghi các mã đó vào danh sách từ chối với lý do "chưa gửi được".
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
      // Id của lần quét chưa có câu trả lời dứt khoát (retry cùng id) — xem scan-ids.ts
      const scanId = scanIdFor(load.loadId, packageCode);
      try {
        const next = await scan.mutateAsync({ loadId: load.loadId, packageCode, scanId });
        forgetScanId(load.loadId, packageCode);
        // BE trả lại câu trả lời cũ cho scanId đã ghi mà không xếp kiện: chỉ báo thành công khi chuyến
        // trả về thật sự có kiện này trên xe
        if (isLabelLoaded(next, packageCode)) {
          const { loaded, expected } = reconcileLoad(next);
          show({
            tone: "positive",
            message: `${packageCode} — ${S.accepted} (${loaded}/${expected})`,
          });
        } else {
          show({ tone: "danger", message: `${packageCode} — ${S.notLoaded}` });
          onReject([packageCode], S.notLoaded);
        }
      } catch (error: unknown) {
        if (!isTransientError(error)) forgetScanId(load.loadId, packageCode);
        if (!(error instanceof ApiError)) {
          // Response sai hợp đồng (BE có thể đã nhận mã) → không ghi là kiện bị từ chối; bảng tải lại
          show({ tone: "danger", message: `${packageCode} — ${S.invalidResponse}` });
        } else {
          const message = isTransientError(error) ? S.notSent : shippingErrorMessage(error);
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
