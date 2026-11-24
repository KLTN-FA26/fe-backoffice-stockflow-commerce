import { useRef, useState } from "react";

import { MOVE_LIMITS, MOVE_MESSAGES } from "@/constants/move";

import { ApiError } from "@/lib/api/error";

import { getCarton } from "./api";
import { cartonProblem, normalizeLpn, toScanned } from "./selectors";

import type { Carton, ScannedCarton } from "./types";

export type ScanFeedback = { tone: "positive" | "danger" | "info"; text: string };

const unverified = (lpn: string): ScannedCarton => ({
  lpn,
  sku: null,
  lotNumber: null,
  onHand: null,
  locationCode: null,
});

/**
 * Danh sách thùng của một lệnh chuyển (docs 11 §4.1 bước 1). Mỗi LPN quét được tra `GET /inventory/stock-packages/{lpn}`
 * rồi mới thêm; thùng giữ cho đơn (BR-05), không In Stock (BR-04) hoặc ở kho khác (BR-01) bị báo đỏ và KHÔNG thêm.
 * Không có quyền tra (`canLookup` false) → thêm thẳng LPN, BE kiểm khi gửi. `onChange` nhận danh sách mới sau mỗi lần
 * thêm / bỏ — form giữ `lpns` theo nó.
 */
export function useCartonScan({
  prefix,
  canLookup,
  onChange,
}: {
  prefix: string;
  canLookup: boolean;
  onChange: (cartons: ScannedCarton[]) => void;
}) {
  const [cartons, setCartons] = useState<ScannedCarton[]>([]);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [pending, setPending] = useState(false);
  // Danh sách mới nhất cho handler chạy sau `await` (tra thùng): state của lần render cũ có thể đã lỗi thời.
  const latest = useRef<ScannedCarton[]>([]);

  const apply = (next: ScannedCarton[]) => {
    latest.current = next;
    setCartons(next);
    onChange(next);
  };
  const has = (lpn: string) => latest.current.some((row) => row.lpn === lpn);
  const full = () => latest.current.length >= MOVE_LIMITS.lpnsMax;

  /** Thêm một thùng đã tra (vd từ bộ tìm) — cùng luật với quét. */
  const add = (carton: Carton) => {
    const problem = cartonProblem(carton, prefix);
    if (problem) return setFeedback({ tone: "danger", text: problem });
    const lpn = normalizeLpn(carton.lpn);
    if (has(lpn)) {
      return setFeedback({ tone: "info", text: MOVE_MESSAGES.duplicate(lpn) });
    }
    if (full()) {
      return setFeedback({ tone: "danger", text: MOVE_MESSAGES.tooManyCartons });
    }
    apply([...latest.current, toScanned(carton)]);
    setFeedback({ tone: "positive", text: MOVE_MESSAGES.scanned(lpn) });
  };

  const scan = async (raw: string) => {
    const lpn = normalizeLpn(raw);
    if (lpn.length > MOVE_LIMITS.lpnLength) {
      return setFeedback({ tone: "danger", text: MOVE_MESSAGES.lpnLength });
    }
    if (has(lpn)) {
      return setFeedback({ tone: "info", text: MOVE_MESSAGES.duplicate(lpn) });
    }
    if (!canLookup) {
      if (full()) {
        return setFeedback({ tone: "danger", text: MOVE_MESSAGES.tooManyCartons });
      }
      apply([...latest.current, unverified(lpn)]);
      return setFeedback({ tone: "info", text: MOVE_MESSAGES.addedUnverified(lpn) });
    }
    setPending(true);
    try {
      add(await getCarton(lpn));
    } catch (error: unknown) {
      const missing = error instanceof ApiError && error.status === 404;
      setFeedback({
        tone: "danger",
        text: missing ? MOVE_MESSAGES.notFound(lpn) : MOVE_MESSAGES.lookupFailed(lpn),
      });
    } finally {
      setPending(false);
    }
  };

  const remove = (lpn: string) => apply(latest.current.filter((row) => row.lpn !== lpn));
  const clear = () => {
    apply([]);
    setFeedback(null);
  };

  return { cartons, feedback, pending, scan, add, remove, clear };
}
