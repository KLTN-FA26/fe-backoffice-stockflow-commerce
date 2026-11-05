"use client";

import { UI_LABELS } from "@/constants";

import { MONO, formatMeasure } from "../primitives";
import { LabelBlock } from "../packing/LabelSheet";

import type { TransferLabel } from "@/features/fulfillment/transfer-pack-types";

const L = UI_LABELS.packing.label;
const T = UI_LABELS.transferPack.label;

function Warehouse({ name, address }: { name?: string | null; address?: string | null }) {
  return (
    <>
      <div className="font-semibold">{name ?? "—"}</div>
      {address && <div>{address}</div>}
    </>
  );
}

/**
 * Nhãn kiện nội bộ của LỆNH CHUYỂN KHO (BE `GET …/label`): số lệnh, kiện n/N trong các kiện đã niêm phong, kho đi và kho đến
 * (người nhận), số đo, cờ, nội dung, phần của bộ. Không thu hộ. Bố cục như nhãn của đơn (`LabelSheet`).
 */
export function TransferLabelSheet({ label }: { label: TransferLabel }) {
  const size =
    label.lengthCm != null && label.widthCm != null && label.heightCm != null
      ? ` · ${formatMeasure(label.lengthCm, 2)} × ${formatMeasure(label.widthCm, 2)} × ${formatMeasure(label.heightCm, 2)} cm`
      : "";
  return (
    <article className="border-border-strong bg-bg-surface mx-auto w-full max-w-[26rem] rounded-[var(--r-sm)] border print:max-w-none print:rounded-none print:border-2 print:border-black">
      <header className="flex items-start justify-between gap-3 px-3 py-3">
        <div className="min-w-0">
          <div className={`text-ink-primary text-lg font-bold break-all print:text-black ${MONO}`}>
            {label.labelCode}
          </div>
          <div className="text-ink-secondary text-xs print:text-black">
            {T.transfer} <span className={MONO}>{label.transferNumber}</span>
            {label.kit &&
              ` · ${UI_LABELS.transferPack.packages.kitPart(label.kit.partNo, label.kit.partCount)}`}
          </div>
        </div>
        <div
          className={`text-ink-primary text-3xl leading-none font-bold print:text-black ${MONO}`}
        >
          {L.parcelOf(label.packageNo, label.packageCount)}
        </div>
      </header>
      <LabelBlock title={T.to}>
        <Warehouse name={label.toWarehouseName} address={label.toWarehouseAddress} />
      </LabelBlock>
      <LabelBlock title={T.from}>
        <Warehouse name={label.fromWarehouseName} address={label.fromWarehouseAddress} />
      </LabelBlock>
      <LabelBlock title={L.cod}>
        <span className={MONO}>{T.noCod}</span>
      </LabelBlock>
      <LabelBlock title={L.measures}>
        <span className={MONO}>
          {label.weightKg != null ? `${formatMeasure(label.weightKg)} kg` : "—"}
          {size}
        </span>
      </LabelBlock>
      <LabelBlock title={L.flags}>
        <div className="flex flex-wrap gap-2 font-bold">
          {label.fragile && (
            <span className="border-danger text-danger rounded-[var(--r-sm)] border px-2 py-0.5 print:border-black print:text-black">
              {L.fragile}
            </span>
          )}
          {!label.rotatable && (
            <span className="border-danger text-danger rounded-[var(--r-sm)] border px-2 py-0.5 print:border-black print:text-black">
              {L.notRotatable}
            </span>
          )}
          {!label.fragile && label.rotatable && (
            <span className="text-ink-secondary font-normal print:text-black">{L.noFlags}</span>
          )}
        </div>
      </LabelBlock>
      <LabelBlock title={L.contents}>
        <ul>
          {label.contents.map((content) => (
            <li key={`${content.transferLineId}|${content.lotNumber ?? ""}`}>
              <span className={MONO}>{content.quantity} ×</span> {content.sku}
              {content.lotNumber ? ` · ${content.lotNumber}` : ""}
            </li>
          ))}
        </ul>
      </LabelBlock>
    </article>
  );
}
