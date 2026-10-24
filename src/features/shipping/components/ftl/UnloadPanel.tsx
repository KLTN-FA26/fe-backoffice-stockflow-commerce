"use client";

import { useEffect, useRef, useState } from "react";

import { UI_LABELS } from "@/constants";
import { primeScanAudio } from "@/hooks/use-scan-tone";
import { formatTime } from "@/lib/format/date";
import { unloadErrorMessage } from "@/features/shipping/errors";
import { useUnloadPackage } from "@/features/shipping/ftl-mutations";
import { pendingUnloadsOf } from "@/features/shipping/ftl-selectors";
import { scanPackageInputSchema } from "@/features/shipping/input-schemas";
import { ScanInput } from "@/components/backoffice/ScanInput";
import { Alert } from "@/components/shared/Alert";

import { MONO } from "../primitives";
import { useScanFeedback } from "../load/useScanFeedback";

import type { Load } from "@/features/shipping/types";

const U = UI_LABELS.shipping.ftl.unload;

function PendingTable({ load }: { load: Load }) {
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{U.title}</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            {[U.parcel, U.shipment, U.reason, U.requestedAt].map((heading) => (
              <th key={heading} scope="col" className="px-3 py-2 text-left font-medium">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pendingUnloadsOf(load).map((item) => (
            <tr key={item.packageId} className="border-border-default border-t">
              <td className={`text-ink-primary px-3 py-2 font-medium ${MONO}`}>{item.labelCode}</td>
              <td className={`text-ink-secondary px-3 py-2 ${MONO}`}>{item.shipmentCode}</td>
              <td className="text-ink-secondary px-3 py-2">{item.reason ?? "—"}</td>
              <td className="text-ink-secondary px-3 py-2 tabular-nums">
                {item.requestedAt ? formatTime(item.requestedAt) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Kiện của đơn đã huỷ khi xe đang xếp (BE `pendingUnloads`): quét từng kiện để dỡ xuống; còn kiện thì bàn giao
 * trả 409 LOAD_UNLOAD_PENDING. Không có quyền dỡ → chỉ xem danh sách. Hàng dỡ về kho qua hàng đợi cất hàng của lấy hàng.
 */
export function UnloadPanel({ load, canUnload }: { load: Load; canUnload: boolean }) {
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
  return (
    <section
      aria-label={U.title}
      className="border-warning/50 bg-bg-surface space-y-3 rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary text-[0.9375rem] font-semibold">
        {U.title} ({count})
      </h2>
      <p className="text-ink-secondary text-[0.8125rem]">{U.description}</p>
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
      {count > 0 && <PendingTable load={load} />}
    </section>
  );
}
