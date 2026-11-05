"use client";

import { UI_LABELS } from "@/constants";
import { isAutoCancelled } from "@/features/shipping/ftl-selectors";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { StatusDot } from "@/components/shared/StatusDot";

import { InfoItem, LoadProgress } from "../primitives";

import type { Load } from "@/features/shipping/types";

const L = UI_LABELS.shipping.load;
const F = UI_LABELS.shipping.field;
const dt = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : "—");

/** Thông tin chuyến: kho, hãng, xe, tài xế, mốc thời gian, kết quả ký; tiến độ quét kiện. */
export function LoadInfoCard({
  load,
  actions,
}: {
  load: Load;
  /** Nút thao tác của chuyến (trang không còn tiêu đề) — cạnh trạng thái. */
  actions?: React.ReactNode;
}) {
  const { data: warehouses } = useWarehouseDirectory();
  const warehouse = warehouses?.find((w) => w.warehouseId === load.warehouseId);
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{L.info}</h2>
          <StatusDot domain="shipment" status={load.status} size="md" withIcon />
        </div>
        {actions}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoItem label={L.code} value={load.code} mono />
        <InfoItem
          label={F.warehouse}
          value={warehouse ? `${warehouse.code} · ${warehouse.name}` : load.warehouseId}
        />
        <InfoItem
          label={F.carrier}
          value={load.carrierName ? `${load.carrierCode ?? ""} ${load.carrierName}`.trim() : "—"}
        />
        <InfoItem label={F.vehiclePlate} value={load.vehiclePlate ?? "—"} mono />
        <InfoItem label={F.driverName} value={load.driverName ?? "—"} />
        <InfoItem label={F.driverPhone} value={load.driverPhone ?? "—"} mono />
        <InfoItem label={L.modeLabel} value={L.mode[load.mode]} />
        <InfoItem label={L.startedAt} value={dt(load.loadingStartedAt)} />
        <InfoItem
          label={L.codTotal}
          value={
            load.codTotal != null && load.currency ? formatMoney(load.codTotal, load.currency) : "—"
          }
          mono
        />
        {load.dispatchedAt && (
          <>
            <InfoItem label={L.dispatchedAt} value={dt(load.dispatchedAt)} />
            <InfoItem label={L.dispatchedBy} value={load.dispatchedByName ?? "—"} />
            <InfoItem label={L.representative} value={load.carrierRepresentative ?? "—"} />
            <InfoItem label={L.signatureRef} value={load.signatureRef ?? "—"} mono />
          </>
        )}
        {load.cancelledAt && (
          <>
            <InfoItem label={L.cancelledAt} value={dt(load.cancelledAt)} />
            <InfoItem
              label={L.cancelReason}
              // Lý do tự huỷ do BE viết bằng tiếng Anh → câu tiếng Việt
              value={
                isAutoCancelled(load)
                  ? UI_LABELS.shipping.ftl.bookingToCancel.autoCancelled
                  : (load.cancelReason ?? "—")
              }
            />
          </>
        )}
      </div>
      {load.handoverNote && (
        <p className="text-ink-secondary mt-3 text-[0.8125rem]">
          {L.handoverNote}: {load.handoverNote}
        </p>
      )}
      <div className="mt-4">
        <div className="text-ink-tertiary mb-1 text-xs">{L.progress}</div>
        <LoadProgress
          loaded={load.loadedPackageCount}
          expected={load.expectedPackageCount}
          size="md"
        />
      </div>
    </section>
  );
}
