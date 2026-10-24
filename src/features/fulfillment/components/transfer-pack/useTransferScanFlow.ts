import { useEffect, useRef, useState } from "react";

import { UI_LABELS } from "@/constants";
import { primeScanAudio } from "@/hooks/use-scan-tone";
import { isRetryablePackingError } from "@/features/fulfillment/packing-errors";
import { scanQuantityInputSchema } from "@/features/fulfillment/packing-input-schemas";
import { useScanTransferPackage } from "@/features/fulfillment/transfer-pack-mutations";
import { transferPackErrorMessage } from "@/features/fulfillment/transfer-pack-errors";
import { planTransferScan } from "@/features/fulfillment/transfer-pack-selectors";

import { useScanFeedback } from "../packing/useScanFeedback";

import type {
  TransferPackLine,
  TransferPackSession,
  TransferParcel,
  TransferScan,
} from "@/features/fulfillment/transfer-pack-types";

const S = UI_LABELS.packing.scan;

interface QueuedScan {
  scan: TransferScan;
  packageId: string;
  packageNo: number;
  /** SKU hiện trong phản hồi (dòng đã khớp, hoặc chính mã quét). */
  label: string;
}

export interface FailedTransferScan {
  item: QueuedScan;
  message: string;
}

/** Mã nằm trên nhiều dòng của lệnh (cùng SKU khác lô): hỏi người đóng chọn dòng trước khi gửi. */
export interface TransferLinePrompt {
  code: string;
  quantity: number;
  candidates: TransferPackLine[];
  packageId: string;
  packageNo: number;
}

/**
 * Luồng quét vào kiện của lệnh chuyển kho (docs 08 bước 2). Như trạm đóng gói đơn: mỗi lần quét có `scanId` MỚI, các
 * lần quét xếp hàng đợi và gửi lần lượt; lỗi có thể chưa tới BE (mạng, 5xx, khoá bận) thì hàng đợi dừng và "Gửi lại"
 * dùng đúng `scanId` cũ nên BE không ghi hai lần. Khác đơn: không serial, lô lấy từ dòng của lệnh (dòng nêu lô thì lần
 * quét tự kèm lô đó) và chỉ hỏi người đóng khi mã nằm trên nhiều dòng.
 */
export function useTransferScanFlow({
  packId,
  session,
  target,
  quantityText,
  onQuantityUsed,
}: {
  packId: string;
  session: TransferPackSession;
  target: TransferParcel | undefined;
  quantityText: string;
  onQuantityUsed: () => void;
}) {
  const scan = useScanTransferPackage();
  const alive = useRef(true);
  const [feedback, show] = useScanFeedback(alive);
  const queue = useRef<QueuedScan[]>([]);
  const busy = useRef(false);
  const halted = useRef(false);
  const [queued, setQueued] = useState(0);
  const [failed, setFailed] = useState<FailedTransferScan | null>(null);
  const [prompt, setPrompt] = useState<TransferLinePrompt | null>(null);

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
        await scan.mutateAsync({ packId, packageId: item.packageId, scan: item.scan });
        show({
          tone: "positive",
          message: S.added(item.scan.quantity, item.label, item.packageNo),
        });
        queue.current.shift();
      } catch (error: unknown) {
        const message = transferPackErrorMessage(error, { packerName: session.packerName });
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
    const base = { packageId: target.packageId, packageNo: target.packageNo };
    // Số lượng khác 1 chỉ cho đúng lần quét này, không dính sang các lần quét sau
    onQuantityUsed();
    const plan = planTransferScan(session.lines, raw);
    if (plan.kind === "ambiguous") {
      setPrompt({ code: raw, quantity: quantity.data, candidates: plan.candidates, ...base });
      return;
    }
    enqueue({
      ...base,
      scan: {
        scanId: crypto.randomUUID(),
        scannedCode: raw,
        quantity: quantity.data,
        lotNumber: plan.kind === "line" ? (plan.line.lotNumber ?? undefined) : undefined,
      },
      label: plan.kind === "line" ? plan.line.sku : raw,
    });
  };

  /** Người đóng đã chọn dòng → xếp vào hàng đợi như một lần quét thường, kèm dòng và lô của dòng đó. */
  const submitPrompt = (transferLineId: string) => {
    if (!prompt) return;
    const line = prompt.candidates.find((c) => c.transferLineId === transferLineId);
    enqueue({
      packageId: prompt.packageId,
      packageNo: prompt.packageNo,
      label: line?.sku ?? prompt.code,
      scan: {
        scanId: crypto.randomUUID(),
        scannedCode: prompt.code,
        quantity: prompt.quantity,
        transferLineId,
        lotNumber: line?.lotNumber ?? undefined,
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
