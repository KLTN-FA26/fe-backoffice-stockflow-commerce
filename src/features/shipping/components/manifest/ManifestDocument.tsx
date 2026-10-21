"use client";

import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { orderCount, reconcileLoad } from "@/features/shipping/selectors";

import { LoadLinesTable } from "../LoadLinesTable";
import { InfoItem, MONO } from "../primitives";

import type { Load } from "@/features/shipping/types";

const M = UI_LABELS.shipping.manifest;
const F = UI_LABELS.shipping.field;
const D = UI_LABELS.shipping.document;

function SignatureBox({ title, name }: { title: string; name?: string | null }) {
  return (
    <div className="border-border-default flex min-h-36 flex-col rounded-[var(--r-sm)] border p-3 text-center">
      <div className="text-ink-primary text-[0.8125rem] font-semibold">{title}</div>
      <div className="text-ink-tertiary text-xs">({M.signNote})</div>
      <div className="text-ink-primary mt-auto text-[0.8125rem] font-medium">{name ?? ""}</div>
    </div>
  );
}

/**
 * Biên bản bàn giao in được (docs 09 §3: danh sách kiện giao cho hãng trong một lần, hai bên ký).
 * Không có mã vận đơn / COD (BR-04 tạm hoãn từ 2026-10-06). Khi in, khung back-office bị ẩn
 * (`print:hidden` ở BackofficeShell) — chỉ còn tài liệu này.
 */
export function ManifestDocument({ load }: { load: Load }) {
  const { data: warehouses } = useWarehouseDirectory();
  const warehouse = warehouses?.find((w) => w.warehouseId === load.warehouseId);
  const { planned, loaded, totalWeightKg } = reconcileLoad(load);
  const manifest = load.manifest;
  // In bằng Ctrl+P khi chưa đủ kiện → bản đối soát, không có ô ký (không dùng làm biên bản bàn giao)
  const draft = !manifest && (planned === 0 || loaded < planned);

  return (
    <article className="border-border-default bg-bg-surface space-y-4 rounded-[var(--card-radius)] border p-[var(--card-pad)] print:border-0 print:p-0">
      {draft && (
        <p className="border-danger text-danger hidden rounded-[var(--r-sm)] border p-2 text-center text-[0.8125rem] font-semibold print:block">
          {D.draftBanner}
        </p>
      )}
      <header className="text-center">
        <h2 className="text-ink-primary text-lg font-semibold">{D.title}</h2>
        <p className={`text-ink-secondary text-[0.8125rem] ${MONO}`}>
          {/* Số biên bản chỉ có sau bàn giao. Trước đó: bản đủ kiện (để in, ký rồi xác nhận) ghi số
              chuyến — không ghi "chưa bàn giao" lên tờ hai bên sắp ký; chỉ bản đối soát thiếu kiện ghi */}
          {manifest
            ? `${D.numberPrefix} ${manifest.manifestNumber}`
            : draft
              ? `${D.loadPrefix} ${load.number} ${D.notHandedOver}`
              : `${D.loadPrefix} ${load.number}`}
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 print:grid-cols-3">
        <InfoItem
          label={F.warehouse}
          value={warehouse ? `${warehouse.code} · ${warehouse.name}` : load.warehouseId}
        />
        <InfoItem label={F.load} value={load.number} mono />
        <InfoItem label={F.carrier} value={load.carrierName ?? "—"} />
        <InfoItem label={F.vehiclePlate} value={load.vehiclePlate ?? "—"} mono />
        <InfoItem label={F.vehicleType} value={load.vehicleType ?? "—"} />
        <InfoItem
          label={F.handedOverAt}
          value={manifest ? formatDateTime(manifest.handedOverAt) : F.handedOverBlank}
        />
      </div>
      <LoadLinesTable
        caption={`${UI_LABELS.shipping.caption.manifest} ${load.number}`}
        lines={load.lines}
        emptyText={UI_LABELS.shipping.empty.noLines}
        showCheck
      />
      {/* In: tổng kết + ghi chú + ô ký là một khối không tách trang — ô ký không bị đẩy sang trang trắng */}
      <div className="break-inside-avoid space-y-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.8125rem]">
          <div>
            <dt className="text-ink-secondary inline">{F.totalLoaded} </dt>
            <dd className={`text-ink-primary inline font-semibold ${MONO}`}>
              {loaded}/{planned}
            </dd>
          </div>
          <div>
            <dt className="text-ink-secondary inline">{F.totalWeight} </dt>
            <dd className={`text-ink-primary inline font-semibold ${MONO}`}>
              {formatNumber(totalWeightKg)} {F.weightUnit}
            </dd>
          </div>
          <div>
            <dt className="text-ink-secondary inline">{F.orderCount} </dt>
            <dd className={`text-ink-primary inline font-semibold ${MONO}`}>{orderCount(load)}</dd>
          </div>
        </dl>
        {manifest?.note && (
          <p className="text-ink-secondary text-[0.8125rem]">
            {F.note} {manifest.note}
          </p>
        )}
        <div className={cn("grid grid-cols-2 gap-4 pt-2", draft && "print:hidden")}>
          <SignatureBox title={M.warehouseSign} />
          <SignatureBox title={M.carrierSign} name={manifest?.carrierRepresentative} />
        </div>
      </div>
    </article>
  );
}
