import { useEffect, useRef, useState } from "react";

import { UI_LABELS } from "@/constants";
import { primeScanAudio } from "@/hooks/use-scan-tone";
import {
  isRetryablePackingError,
  packingErrorMessage,
} from "@/features/fulfillment/packing-errors";
import { useScanPackage } from "@/features/fulfillment/packing-mutations";
import { scanQuantityInputSchema } from "@/features/fulfillment/packing-input-schemas";
import { planScan } from "@/features/fulfillment/packing-selectors";

import { useScanFeedback } from "./useScanFeedback";

import type {
  PackLine,
  PackPackage,
  PackScan,
  PackingSession,
} from "@/features/fulfillment/packing-types";

const S = UI_LABELS.packing.scan;

interface QueuedScan {
  scan: PackScan;
  packageId: string;
  packageNo: number;
  /** SKU hiện trong phản hồi (dòng đã khớp, hoặc chính mã quét). */
  label: string;
}

export interface FailedScan {
  item: QueuedScan;
  message: string;
}

/** Lần quét cần chi tiết (dòng / lô / serial) trước khi gửi — hộp thoại hỏi người đóng. */
export interface ScanPrompt {
  code: string;
  quantity: number;
  /** Dòng khớp mã; > 1 dòng = phải chọn dòng (BE `PACK_SCAN_AMBIGUOUS`). */
  candidates: PackLine[];
  packageId: string;
  packageNo: number;
}

export interface ScanDetail {
  orderLineId?: string;
  lotNumber?: string;
  serialNumber?: string;
}

/**
 * Luồng quét vào kiện (docs 08 bước 2). Mỗi lần quét có `scanId` MỚI (`crypto.randomUUID()`); máy quét
 * gửi liên tục nên các lần quét xếp hàng đợi và gửi lần lượt (số "còn lại" phụ thuộc lần trước). Lỗi
 * nghiệp vụ 4xx: BE không ghi gì → bỏ lần quét, hiện lỗi. Lỗi có thể chưa tới BE (mạng, 5xx, khoá
 * bận): hàng đợi dừng, lần quét giữ nguyên `scanId` và "Gửi lại" dùng đúng id đó nên BE không ghi hai lần.
 */
export function useScanFlow({
  taskId,
  session,
  target,
  quantityText,
  onQuantityUsed,
}: {
  taskId: string;
  session: PackingSession;
  target: PackPackage | undefined;
  quantityText: string;
  /** Số lượng đã dùng cho một lần quét — ô số lượng về 1 (quét hàng loạt là một lần duy nhất). */
  onQuantityUsed: () => void;
}) {
  const scan = useScanPackage();
  const alive = useRef(true);
  const [feedback, show] = useScanFeedback(alive);
  const queue = useRef<QueuedScan[]>([]);
  const busy = useRef(false);
  const halted = useRef(false);
  const packerName = useRef(session.packerName);
  const [queued, setQueued] = useState(0);
  const [failed, setFailed] = useState<FailedScan | null>(null);
  const [prompt, setPrompt] = useState<ScanPrompt | null>(null);

  useEffect(() => {
    packerName.current = session.packerName;
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      queue.current = [];
    };
  }, []);

  const drain = async () => {
    if (busy.current || halted.current) return;
    busy.current = true;
    while (alive.current && !halted.current && queue.current.length > 0) {
      const item = queue.current[0];
      if (!item) break;
      try {
        await scan.mutateAsync({ taskId, packageId: item.packageId, scan: item.scan });
        show({
          tone: "positive",
          message: S.added(item.scan.quantity, item.label, item.packageNo),
        });
        queue.current.shift();
      } catch (error: unknown) {
        const message = packingErrorMessage(error, { packerName: packerName.current });
        show({ tone: "danger", message: `${item.scan.scannedCode} — ${message}` });
        if (isRetryablePackingError(error)) {
          halted.current = true;
          if (alive.current) setFailed({ item, message });
        } else {
          queue.current.shift();
        }
      }
      if (alive.current) setQueued(queue.current.length);
    }
    busy.current = false;
  };

  const enqueue = (item: QueuedScan) => {
    queue.current.push(item);
    setQueued(queue.current.length);
    void drain();
  };

  const onScan = (raw: string) => {
    // Đang trong cử chỉ người dùng (Enter) → mở audio ngay, để tiếng báo sau khi có kết quả phát được
    primeScanAudio();
    if (!target) {
      show({ tone: "danger", message: S.noOpenPackage });
      return;
    }
    const quantity = scanQuantityInputSchema.safeParse(quantityText);
    if (!quantity.success) {
      show({ tone: "danger", message: quantity.error.issues[0]?.message ?? S.quantity });
      return;
    }
    const plan = planScan(session.lines, raw);
    const base = { packageId: target.packageId, packageNo: target.packageNo };
    // Số lượng khác 1 chỉ cho đúng lần quét này, không dính sang các lần quét sau
    onQuantityUsed();
    const tracked = plan.kind === "line" && (plan.line.lotTracked || plan.line.serialTracked);
    if (tracked || plan.kind === "ambiguous") {
      const candidates =
        plan.kind === "line" ? [plan.line] : plan.kind === "ambiguous" ? plan.candidates : [];
      setPrompt({ code: raw, quantity: quantity.data, candidates, ...base });
      return;
    }
    enqueue({
      ...base,
      scan: { scanId: crypto.randomUUID(), scannedCode: raw, quantity: quantity.data },
      label: plan.kind === "line" ? plan.line.sku : raw,
    });
  };

  /** Hộp thoại chi tiết đã đủ → xếp vào hàng đợi như một lần quét thường (serial: mỗi lần một đơn vị). */
  const submitPrompt = (detail: ScanDetail) => {
    if (!prompt) return;
    const line =
      prompt.candidates.find((c) => c.orderLineId === detail.orderLineId) ?? prompt.candidates[0];
    enqueue({
      packageId: prompt.packageId,
      packageNo: prompt.packageNo,
      label: line?.sku ?? prompt.code,
      scan: {
        scanId: crypto.randomUUID(),
        scannedCode: prompt.code,
        quantity: detail.serialNumber ? 1 : prompt.quantity,
        orderLineId: prompt.candidates.length > 1 ? detail.orderLineId : undefined,
        lotNumber: detail.lotNumber || undefined,
        serialNumber: detail.serialNumber || undefined,
      },
    });
    setPrompt(null);
  };

  /** Gửi lại lần quét bị lỗi mạng — GIỮ `scanId` cũ, BE không ghi hai lần. */
  const retry = () => {
    halted.current = false;
    setFailed(null);
    void drain();
  };

  /** Bỏ lần quét chưa gửi được; các lần quét sau trong hàng đợi vẫn đi tiếp. */
  const dismiss = () => {
    queue.current.shift();
    halted.current = false;
    setFailed(null);
    setQueued(queue.current.length);
    void drain();
  };

  return {
    feedback,
    queued,
    failed,
    prompt,
    onScan,
    submitPrompt,
    closePrompt: () => setPrompt(null),
    retry,
    dismiss,
  };
}
