"use client";

import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { formatNumber } from "@/lib/format/number";

import { InfoItem, MONO } from "../primitives";
import { ManifestShipmentRows } from "./ManifestShipmentRows";
import { ManifestVehicleInfo, ManifestVehicleNote } from "./ManifestVehicleInfo";

import type { Manifest } from "@/features/shipping/types";

const M = UI_LABELS.shipping.manifest;
const F = UI_LABELS.shipping.field;
const TH = "px-3 py-2 font-medium whitespace-nowrap";

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
 * Biên bản bàn giao in được (docs 09 §3 "Biên bản bàn giao", §4.1 bước 3): kho, hãng, xe, từng lô với
 * người nhận / kiện / COD (BR-04), tổng, và hai ô ký. Khi in, khung back-office bị ẩn (`print:hidden`
 * ở BackofficeShell) — chỉ còn tài liệu này. Bản thiếu kiện (in bằng Ctrl+P) chỉ là bản đối soát, không có ô ký.
 */
export function ManifestDocument({ manifest, draft }: { manifest: Manifest; draft: boolean }) {
  const money = (amount: number | null | undefined) =>
    amount != null && manifest.currency ? formatMoney(amount, manifest.currency) : "—";
  return (
    <article className="border-border-default bg-bg-surface space-y-4 rounded-[var(--card-radius)] border p-[var(--card-pad)] print:border-0 print:p-0">
      {draft && (
        <p className="border-danger text-danger hidden rounded-[var(--r-sm)] border p-2 text-center text-[0.8125rem] font-semibold print:block">
          {M.draftBanner}
        </p>
      )}
      <header className="text-center">
        <h2 className="text-ink-primary text-lg font-semibold">{M.docTitle}</h2>
        <p className={`text-ink-secondary text-[0.8125rem] ${MONO}`}>
          {M.loadPrefix} {manifest.loadCode}
        </p>
        <ManifestVehicleNote manifest={manifest} />
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 print:grid-cols-3">
        <InfoItem label={M.warehouse} value={manifest.warehouseName ?? "—"} />
        <InfoItem label={M.warehouseAddress} value={manifest.warehouseAddress ?? "—"} />
        <InfoItem
          label={F.carrier}
          value={
            manifest.carrierName
              ? `${manifest.carrierCode ?? ""} ${manifest.carrierName}`.trim()
              : "—"
          }
        />
        <InfoItem
          label={M.carrierContact}
          value={
            [manifest.carrierContactName, manifest.carrierContactPhone]
              .filter(Boolean)
              .join(" · ") || "—"
          }
        />
        <InfoItem label={F.vehiclePlate} value={manifest.vehiclePlate ?? "—"} mono />
        <InfoItem
          label={F.driverName}
          value={[manifest.driverName, manifest.driverPhone].filter(Boolean).join(" · ") || "—"}
        />
        <InfoItem
          label={M.handedOverAt}
          value={manifest.dispatchedAt ? formatDateTime(manifest.dispatchedAt) : M.handedOverBlank}
        />
        <ManifestVehicleInfo manifest={manifest} />
      </div>
      <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border print:overflow-visible">
        <table className="w-full text-[0.8125rem]">
          <caption className="sr-only">{`${M.shipment} ${manifest.loadCode}`}</caption>
          <thead className="bg-bg-subtle text-ink-secondary">
            <tr>
              <th scope="col" className={cn(TH, "text-left")}>
                {M.shipment}
              </th>
              <th scope="col" className={cn(TH, "text-left")}>
                {M.recipient}
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                {M.packages}
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                {M.weight}
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                {M.cod}
              </th>
            </tr>
          </thead>
          <ManifestShipmentRows shipments={manifest.shipments} money={money} />
        </table>
      </div>
      {/* In: tổng kết + ghi chú + ô ký là một khối không tách trang */}
      <div className="break-inside-avoid space-y-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.8125rem]">
          {[
            [M.totalShipments, String(manifest.shipmentCount)],
            [M.totalPackages, String(manifest.packageCount)],
            [M.totalWeight, `${formatNumber(manifest.totalWeightKg ?? 0)} ${F.weightUnit}`],
            [M.totalCod, money(manifest.codTotal)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-ink-secondary inline">{label} </dt>
              <dd className={cn("text-ink-primary inline font-semibold", MONO)}>{value}</dd>
            </div>
          ))}
        </dl>
        {manifest.handoverNote && (
          <p className="text-ink-secondary text-[0.8125rem]">
            {M.note} {manifest.handoverNote}
          </p>
        )}
        {manifest.signatureRef && (
          <p className="text-ink-secondary text-[0.8125rem]">
            {M.signatureRef} <span className={MONO}>{manifest.signatureRef}</span>
          </p>
        )}
        <div className={cn("grid grid-cols-2 gap-4 pt-2", draft && "print:hidden")}>
          <SignatureBox title={M.warehouseSign} name={manifest.dispatchedByName} />
          <SignatureBox title={M.carrierSign} name={manifest.carrierRepresentative} />
        </div>
      </div>
    </article>
  );
}
