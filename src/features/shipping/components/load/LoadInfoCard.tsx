"use client";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { isAutoCancelled } from "@/features/shipping/ftl-selectors";
import { warehouseRefLabel } from "@/features/shipping/selectors";
import { StatusDot } from "@/components/shared/StatusDot";

import { formatPhone } from "../../format-phone";
import { InfoItem, LoadProgress } from "../primitives";

import type { Load } from "@/features/shipping/types";

const L = UI_LABELS.shipping.load;
const F = UI_LABELS.shipping.field;
const W = UI_LABELS.shipping.waybill.card;
const dt = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : "—");

/** Thông tin chuyến: kho, hãng, xe, tài xế, mã vận đơn, mốc thời gian, kết quả ký; tiến độ quét kiện. */
export function LoadInfoCard({
  load,
  actions,
}: {
  load: Load;
  /** Nút thao tác của chuyến (trang không còn tiêu đề) — cạnh trạng thái. */
  actions?: React.ReactNode;
}) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{L.info}</h2>
          <StatusDot domain="shipment" status={load.status} size="md" withIcon />
        </div>
        {actions}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoItem label={L.code} value={load.code} mono />
        {/* Mã + tên kho do BE trả (#286) — không tải danh mục kho; BE cũ chưa trả thì "—", không hiện UUID */}
        <InfoItem label={F.warehouse} value={warehouseRefLabel(load) ?? "—"} />
        <InfoItem
          label={F.carrier}
          value={
            load.carrierName ? (
              <span title={load.carrierCode ?? undefined}>{load.carrierName}</span>
            ) : (
              "—"
            )
          }
        />
        <InfoItem label={F.vehiclePlate} value={load.vehiclePlate ?? "—"} mono />
        <InfoItem label={F.driverName} value={load.driverName ?? "—"} />
        <InfoItem
          label={F.driverPhone}
          value={load.driverPhone ? formatPhone(load.driverPhone) : "—"}
        />
        <InfoItem label={W.number} value={load.waybillNo ?? "—"} mono />
        <InfoItem label={L.startedAt} value={dt(load.loadingStartedAt)} />
        {load.loadingStartedAt && (
          <InfoItem label={L.startedBy} value={load.loadingStartedByName ?? "—"} />
        )}
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
