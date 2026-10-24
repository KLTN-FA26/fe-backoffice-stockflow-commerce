"use client";

import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { formatNumber } from "@/lib/format/number";

import { MONO, formatMeasure } from "../primitives";

import type { PackLabelRecipient, PackageLabel } from "@/features/fulfillment/packing-types";

const L = UI_LABELS.packing.label;

export function LabelBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border-default border-t px-3 py-2 print:border-black">
      <h3 className="text-ink-tertiary text-[0.6875rem] font-semibold tracking-wide uppercase print:text-black">
        {title}
      </h3>
      <div className="text-ink-primary mt-0.5 text-[0.8125rem] print:text-black">{children}</div>
    </section>
  );
}

function recipientLines(recipient: PackLabelRecipient): string[] {
  return [
    recipient.line1,
    recipient.line2,
    [recipient.wardName, recipient.provinceName].filter(Boolean).join(", "),
    [recipient.countryCode, recipient.postalCode].filter(Boolean).join(" "),
  ].filter((line): line is string => !!line);
}

function codText(label: PackageLabel): string {
  const amount = label.codAmount ?? 0;
  if (amount <= 0) return L.noCod;
  return label.currency ? formatMoney(amount, label.currency) : formatNumber(amount);
}

/**
 * Nhãn kiện nội bộ in tại bàn đóng gói (docs 08 bước 6): mã kiện, số kiện n/N trong lô, người nhận,
 * địa chỉ hoàn hàng, thu hộ (COD), số đo, cờ và nội dung. FE tự dựng bố cục từ dữ liệu BE (không gọi
 * hãng vận chuyển). Nhãn TẠM (`provisional`) in đậm cảnh báo: n/N và COD có thể đổi.
 */
export function LabelSheet({ label }: { label: PackageLabel }) {
  const cod = (label.codAmount ?? 0) > 0;
  return (
    <article className="border-border-strong bg-bg-surface mx-auto w-full max-w-[26rem] rounded-[var(--r-sm)] border print:max-w-none print:rounded-none print:border-2 print:border-black">
      {label.provisional && (
        <p className="border-warning text-warning border-b px-3 py-1.5 text-center text-[0.8125rem] font-bold print:border-black print:text-black">
          {L.provisional}
        </p>
      )}
      <header className="flex items-start justify-between gap-3 px-3 py-3">
        <div className="min-w-0">
          <div className={`text-ink-primary text-lg font-bold break-all print:text-black ${MONO}`}>
            {label.labelCode}
          </div>
          <div className="text-ink-secondary text-xs print:text-black">
            {L.order} <span className={MONO}>{label.orderNumber ?? "—"}</span> · {L.shipment}{" "}
            <span className={MONO}>{label.shipmentCode ?? "—"}</span>
          </div>
        </div>
        <div
          className={`text-ink-primary text-3xl leading-none font-bold print:text-black ${MONO}`}
        >
          {L.parcelOf(label.packageNo, label.packageCount)}
        </div>
      </header>
      <LabelBlock title={L.recipient}>
        <div className="font-semibold">{label.recipient.name ?? "—"}</div>
        {label.recipient.phone && <div className={MONO}>{label.recipient.phone}</div>}
        {recipientLines(label.recipient).map((line) => (
          <div key={line}>{line}</div>
        ))}
      </LabelBlock>
      <LabelBlock title={L.cod}>
        <span className={`${cod ? "text-xl font-bold" : ""} ${MONO}`}>{codText(label)}</span>
      </LabelBlock>
      <LabelBlock title={L.returnTo}>
        <div className="font-medium">{label.returnWarehouseName ?? "—"}</div>
        {label.returnAddress && <div>{label.returnAddress}</div>}
      </LabelBlock>
      <LabelBlock title={L.measures}>
        <span className={MONO}>
          {label.weightKg != null ? `${formatMeasure(label.weightKg)} kg` : "—"}
          {label.lengthCm != null && label.widthCm != null && label.heightCm != null
            ? ` · ${formatMeasure(label.lengthCm, 2)} × ${formatMeasure(label.widthCm, 2)} × ${formatMeasure(label.heightCm, 2)} cm`
            : ""}
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
            <li
              key={`${content.orderLineId}|${content.lotNumber ?? ""}|${content.serialNumber ?? ""}`}
            >
              <span className={MONO}>{content.quantity} ×</span> {content.sku}
              {content.lotNumber ? ` · ${content.lotNumber}` : ""}
              {content.serialNumber ? ` · ${content.serialNumber}` : ""}
            </li>
          ))}
        </ul>
      </LabelBlock>
    </article>
  );
}
