"use client";

import { useEffect, useRef, useState } from "react";

import { LOAD_STATUS, UI_LABELS } from "@/constants";
import { primeScanAudio } from "@/hooks/use-scan-tone";
import { unloadErrorMessage } from "@/features/shipping/errors";
import { useUnloadPackage } from "@/features/shipping/ftl-mutations";
import { pendingUnloadsOf } from "@/features/shipping/ftl-selectors";
import { scanPackageInputSchema } from "@/features/shipping/input-schemas";
import { ScanInput } from "@/components/backoffice/ScanInput";
import { Alert } from "@/components/shared/Alert";

import { useScanFeedback } from "../load/useScanFeedback";
import { PendingUnloadTable } from "./PendingUnloadTable";

import type { Load } from "@/features/shipping/types";

const U = UI_LABELS.shipping.ftl.unload;

/**
 * Kiện còn phải dỡ khỏi xe (BE `pendingUnloads`): quét từng kiện để dỡ xuống. Hai nguồn: đơn đã huỷ khi xe đang xếp (còn kiện
 * thì bàn giao trả 409 LOAD_UNLOAD_PENDING; hàng về kho qua hàng đợi cất hàng) và xe đã huỷ có kiểm soát (SCRUM-474: chuyến
 * CANCELLED, kiện bị khoá tới khi dỡ). Không có quyền dỡ → chỉ xem danh sách. `canOverride` (quyền huỷ có kiểm soát): quản lý
 * kho xác nhận dỡ kiện không quét khi nhãn hỏng.
 */
export function UnloadPanel({
  load,
  canUnload,
  canOverride,
}: {
  load: Load;
  canUnload: boolean;
  canOverride: boolean;
}) {
  const unload = useUnloadPackage();
  const alive = useRef(true);
  const [feedback, show] = useScanFeedback(alive);
  const queue = useRef<string[]>([]);
  const busy = useRef(false);
  const [queued, setQueued] = useState(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const drain = async () => {
    if (busy.current) return;
    busy.current = true;
    while (alive.current && queue.current.length > 0) {
      const packageCode = queue.current[0] ?? "";
      try {
        await unload.mutateAsync({ loadId: load.loadId, packageCode });
        show({ tone: "positive", message: `${packageCode} — ${U.accepted}` });
      } catch (error: unknown) {
        show({ tone: "danger", message: `${packageCode} — ${unloadErrorMessage(error)}` });
      }
      queue.current.shift();
      if (alive.current) setQueued(queue.current.length);
    }
    busy.current = false;
  };

  const onScan = (raw: string) => {
    primeScanAudio();
    const parsed = scanPackageInputSchema.safeParse({ packageCode: raw });
    if (!parsed.success) {
      show({ tone: "danger", message: parsed.error.issues[0]?.message ?? U.placeholder });
      return;
    }
    const { packageCode } = parsed.data;
    if (queue.current.includes(packageCode)) return;
    queue.current.push(packageCode);
    setQueued(queue.current.length);
    void drain();
  };

  const count = pendingUnloadsOf(load).length;
  const controlled = load.status === LOAD_STATUS.CANCELLED;
  return (
    <section
      aria-label={controlled ? U.controlledTitle : U.title}
      className="border-warning/50 bg-bg-surface space-y-3 rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary text-[0.9375rem] font-semibold">
        {controlled ? U.controlledTitle : U.title} ({count})
      </h2>
      <p className="text-ink-secondary text-[0.8125rem]">
        {controlled ? U.controlledDescription : U.description}
      </p>
      {canUnload ? (
        <ScanInput
          id="load-unload"
          label={U.label}
          placeholder={U.placeholder}
          hint={U.hint}
          onScan={onScan}
          pending={queued > 0}
          feedback={feedback}
        />
      ) : (
        <Alert tone="info">{U.readOnly}</Alert>
      )}
      {canUnload && !canOverride && controlled && count > 0 && (
        <p className="text-ink-tertiary text-xs">{U.needsManager}</p>
      )}
      {count > 0 && <PendingUnloadTable load={load} canOverride={canOverride} />}
    </section>
  );
}
