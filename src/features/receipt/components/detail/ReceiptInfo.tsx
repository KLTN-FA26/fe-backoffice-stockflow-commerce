"use client";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { totalReceivedQuantity } from "@/features/receipt/selectors";

import { InfoItem, Section } from "../primitives";

import type { GoodsReceipt } from "@/features/receipt/types";

const FIELD = UI_LABELS.receipt.field;

const dt = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : "—");

/** Người trong phiếu: tên BE trả kèm (nếu có), tooltip là id. */
const person = (id: string | null | undefined, name: string | null | undefined) => (
  <span title={id ?? undefined}>{name ?? id ?? "—"}</span>
);

export function ReceiptInfo({ receipt }: { receipt: GoodsReceipt }) {
  return (
    <Section title="Thông tin phiếu">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {/* Trang chi tiết không có tiêu đề — số phiếu nằm ở đây */}
        <InfoItem label="Số phiếu" value={receipt.number} mono />
        <InfoItem
          label={FIELD.receiptType}
          value={UI_LABELS.receipt.receiptType[receipt.receiptType]}
        />
        <InfoItem label={FIELD.productionOrder} value={receipt.productionOrderCode ?? "—"} mono />
        <InfoItem label={FIELD.producer} value={receipt.producerName ?? "—"} />
        <InfoItem label="Kho nhận" value={receipt.warehouseName ?? receipt.warehouseCode ?? "—"} />
        <InfoItem label="Phiếu giao" value={receipt.deliveryNote ?? "—"} mono />
        <InfoItem label="Ngày nhận" value={dt(receipt.receivedAt)} />
        <InfoItem label="Người nhận" value={person(receipt.receivedBy, receipt.receivedByName)} />
        <InfoItem label="Ngày xác nhận" value={dt(receipt.confirmedAt)} />
        <InfoItem
          label="Người xác nhận"
          value={person(receipt.confirmedBy, receipt.confirmedByName)}
        />
        <InfoItem label="Ngày đóng" value={dt(receipt.closedAt)} />
        <InfoItem label="Ghi chú" value={receipt.note ?? "—"} wrap />
      </div>
    </Section>
  );
}

/** Cột phải — số liệu derive từ dòng BE trả về. */
export function ReceiptOverviewCard({ receipt }: { receipt: GoodsReceipt }) {
  const rows = [
    { label: "Số dòng", value: receipt.lines.length },
    { label: "Tổng SL nhận", value: totalReceivedQuantity(receipt) },
    { label: "Số thùng", value: receipt.lines.reduce((sum, l) => sum + l.packages.length, 0) },
  ];
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Tổng quan</h2>
      <dl className="space-y-2 text-[0.8125rem]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between">
            <dt className="text-ink-secondary">{row.label}</dt>
            <dd className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
