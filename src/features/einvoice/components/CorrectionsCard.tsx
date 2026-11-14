"use client";

import { EINVOICE_ROUTES } from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { Card } from "@/components/shared/Card";

import { useCorrections } from "../queries";
import { invoiceReference } from "../selectors";

import { CodeLink, DateCell, EInvoiceStatusDot, MoneyCell, TypeText } from "./primitives";

/** Hoá đơn điều chỉnh / thay thế của một hoá đơn gốc, cả bản đã huỷ, cũ nhất trước (docs 21 §4.4). */
export function CorrectionsCard({ id }: { id: string }) {
  const query = useCorrections(id);
  const rows = query.data ?? [];
  if (!query.isPending && rows.length === 0) return null;
  return (
    <Card className="space-y-2">
      <h2 className="text-ink-primary text-sm font-semibold">
        {EINVOICE_LABELS.detail.corrections}
      </h2>
      <ul className="divide-y divide-[var(--table-line)] text-[0.8125rem]">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5">
            <CodeLink href={EINVOICE_ROUTES.detail(row.id)}>{invoiceReference(row)}</CodeLink>
            <TypeText type={row.type} />
            <DateCell iso={row.issueDate} />
            <span className="ml-auto">
              <MoneyCell amount={row.grandTotal} />
            </span>
            <EInvoiceStatusDot status={row.status} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
