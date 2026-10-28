"use client";

import { XCircle } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { useRejectedScansStore } from "@/features/shipping/rejected-scans-store";
import { loadedLabelCodes } from "@/features/shipping/selectors";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { MONO } from "../primitives";

import type { Load } from "@/features/shipping/types";
import type { RejectedScan } from "@/features/shipping/rejected-scans-store";

export type { RejectedScan };

const S = UI_LABELS.shipping.scan;

/**
 * Bỏ các mã đã thực sự lên xe (quét lại thành công, hoặc BE đã nhận dù response bị mất) — danh sách
 * này bảo người dùng gỡ kiện, giữ mã đã lên xe sẽ khiến gỡ nhầm kiện đúng.
 */
export function withoutLoaded(
  items: readonly RejectedScan[],
  loadedCodes: readonly string[],
): RejectedScan[] {
  const loaded = new Set(loadedCodes.map((code) => code.toUpperCase()));
  return items.filter((item) => !loaded.has(item.packageCode.toUpperCase()));
}

const EMPTY: RejectedScan[] = [];

/** Danh sách mã quét không thành công của một chuyến (xem rejected-scans-store.ts). */
export function useRejectedScans(loadId: string) {
  const items = useRejectedScansStore((state) => state.byLoad[loadId] ?? EMPTY);
  const add = useRejectedScansStore((state) => state.add);
  const clear = useRejectedScansStore((state) => state.clear);
  return {
    items,
    add: (codes: readonly string[], message: string) => add(loadId, codes, message),
    clear: () => clear(loadId),
  };
}

/**
 * Danh sách mã vừa bị từ chối, giữ tới khi người dùng xoá: máy quét gửi liên tục nên thông báo đỏ
 * của một mã có thể bị kết quả mã kế tiếp thay ngay — danh sách này cho biết đúng kiện nào phải gỡ
 * khỏi xe / để riêng (docs 09 §4 bước 4: kiện không thuộc chuyến không được xếp lên xe).
 */
export function RejectedScans({ items, onClear }: { items: RejectedScan[]; onClear: () => void }) {
  if (items.length === 0) return null;
  return (
    <div className="border-danger/40 mt-3 rounded-[var(--r-sm)] border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-danger text-[0.8125rem] font-semibold">
          {S.rejectedTitle} ({items.length})
        </h3>
        <Button type="button" variant="ghost" size="sm" className="h-7" onClick={onClear}>
          {S.clearRejected}
        </Button>
      </div>
      {/* Khối quét dính đầu màn hình → giới hạn chiều cao, không che bảng phía dưới */}
      <ul className="max-h-32 space-y-1 overflow-y-auto text-[0.8125rem]">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-1.5">
            <XCircle className="text-danger mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className={`text-ink-primary font-medium ${MONO}`}>{item.packageCode}</span>
            <span className="text-ink-secondary">— {item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Hộp bàn giao: nhắc các mã quét không thành công còn treo của chuyến (đã lọc mã đã lên xe) — bước kế
 * tiếp là ký, kiện sai còn trên xe phải được gỡ trước.
 */
export function RejectedScansNotice({ load }: { load: Load }) {
  const { items } = useRejectedScans(load.loadId);
  const pending = withoutLoaded(items, loadedLabelCodes(load));
  if (pending.length === 0) return null;
  return (
    <Alert tone="danger">
      {UI_LABELS.shipping.handover.rejectedPending}{" "}
      <span className={MONO}>{pending.map((item) => item.packageCode).join(", ")}</span>
    </Alert>
  );
}
