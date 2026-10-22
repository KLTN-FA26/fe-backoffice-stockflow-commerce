"use client";

import { loadNoActionReason, hasLoadAction } from "@/features/shipping/lifecycle";
import { hasPendingUnloads, isFtlLoad } from "@/features/shipping/ftl-selectors";
import { loadedLabelCodes } from "@/features/shipping/selectors";
import { Alert } from "@/components/shared/Alert";

import { UnloadPanel } from "../ftl/UnloadPanel";
import { RejectedScans, withoutLoaded } from "./RejectedScans";
import { ScanPanel } from "./ScanPanel";

import type { AllowedLoadAction } from "@/features/shipping/lifecycle";
import type { Load } from "@/features/shipping/types";
import type { useRejectedScans } from "./RejectedScans";

/**
 * Vùng quét của màn chuyến. Đang có kiện của đơn đã huỷ cần dỡ (chuyến nguyên xe) → ô quét DỠ thay ô quét lên
 * xe (hai ô cùng "luôn focus" sẽ giành mã của nhau, và kiện đó phải xuống xe trước khi bàn giao). Không quét
 * được (đã bàn giao / huỷ ở máy khác, chỉ có quyền xem, chưa tới bước xếp hàng…) → nói rõ vì sao.
 */
export function LoadScanSection({
  load,
  actions,
  rejected,
}: {
  load: Load;
  actions: readonly AllowedLoadAction[];
  rejected: ReturnType<typeof useRejectedScans>;
}) {
  const canScan = !!hasLoadAction(actions, "scan");
  const rejectedItems = withoutLoaded(rejected.items, loadedLabelCodes(load));
  if (load.status === "LOADING" && hasPendingUnloads(load)) {
    return (
      <>
        <UnloadPanel load={load} canUnload={!!hasLoadAction(actions, "unload")} />
        <RejectedScans items={rejectedItems} onClear={rejected.clear} />
      </>
    );
  }
  if (canScan) {
    // Dính đầu vùng cuộn: đang xem bảng phía dưới mà quét tiếp vẫn thấy phản hồi xanh / đỏ
    return (
      <section className="border-border-default bg-bg-surface sticky top-0 z-10 rounded-[var(--card-radius)] border p-[var(--card-pad)]">
        <ScanPanel load={load} onReject={rejected.add} />
        <RejectedScans items={rejectedItems} onClear={rejected.clear} />
      </section>
    );
  }
  // Chuyến nguyên xe chưa tới bước xếp hàng: thẻ Đặt xe đã chỉ bước kế tiếp
  if (isFtlLoad(load) && (load.status === "PLANNED" || load.status === "VEHICLE_BOOKED"))
    return null;
  return (
    <>
      <Alert tone="info">{loadNoActionReason(load)}</Alert>
      {/* Ô quét vừa biến mất giữa lúc còn danh sách kiện cần gỡ → vẫn hiện (chỉ khi chuyến còn xếp) */}
      {load.status === "LOADING" && (
        <RejectedScans items={rejectedItems} onClear={rejected.clear} />
      )}
    </>
  );
}
