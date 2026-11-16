"use client";

import { AlertTriangle, Ban, XCircle } from "lucide-react";

import { EINVOICE_ROUTES } from "@/constants/einvoice";
import { CORRECTION_BASIS_LABELS, EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { ADMIN_ROUTES } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { Card } from "@/components/shared/Card";

import { invoiceReference, warningMessages } from "../selectors";

import { CodeLink, DateCell, EInvoiceStatusDot, InfoRow, TypeText } from "./primitives";

import type { EInvoice } from "../types";

const D = EINVOICE_LABELS.detail;
const C = EINVOICE_LABELS.columns;
const GRID = "grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]";

function Party({ title, party }: { title: string; party: EInvoice["buyer"] }) {
  return (
    <div className="space-y-1">
      <h3 className="text-ink-primary text-[0.8125rem] font-semibold">{title}</h3>
      <dl className={GRID}>
        <InfoRow label="Tên">{party?.name ?? "—"}</InfoRow>
        <InfoRow label="Mã số thuế">
          <span className="font-mono">{party?.taxCode ?? "Thiếu"}</span>
        </InfoRow>
        <InfoRow label="Địa chỉ">{party?.address ?? "Thiếu"}</InfoRow>
        <InfoRow label="Email nhận hoá đơn">{party?.email ?? "—"}</InfoRow>
      </dl>
    </div>
  );
}

/**
 * Thông tin chung của hoá đơn (docs 21 §3 Output): số / ký hiệu khi đã phát hành, đơn, lần giao,
 * ngày lập (= ngày giao thành công, §4.1), hạn phát hành, căn cứ điều chỉnh; cảnh báo của BE; lý do
 * bị từ chối hoặc huỷ nháp; bên bán và bên mua (chụp lại lúc lập, BR-06).
 */
export function EInvoiceInfoCard({ invoice }: { invoice: EInvoice }) {
  const warnings = warningMessages(invoice);
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ink-primary font-mono text-sm font-semibold">
          {invoiceReference(invoice)}
        </h2>
        <EInvoiceStatusDot status={invoice.status} />
      </div>
      {warnings.length > 0 && (
        <ul
          role="alert"
          className="border-warning/30 bg-warning/5 space-y-1 rounded-[var(--r-sm)] border p-3 text-[0.8125rem]"
        >
          {warnings.map((line) => (
            <li key={line} className="text-ink-primary flex gap-2">
              <AlertTriangle aria-hidden className="text-dot-warning mt-0.5 size-3.5 shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      )}
      {invoice.status === "REJECTED" && (
        <p className="text-danger flex gap-2 text-[0.8125rem]">
          <XCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Nhà cung cấp từ chối{invoice.rejectionCode ? ` (${invoice.rejectionCode})` : ""}:{" "}
          {invoice.rejectionMessage ?? "không nêu lý do"}. Sửa nguyên nhân, mở lại thành nháp rồi
          phát hành lại.
        </p>
      )}
      {invoice.status === "VOIDED_DRAFT" && (
        <p className="text-ink-secondary flex gap-2 text-[0.8125rem]">
          <Ban aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Đã huỷ nháp{invoice.voidedAt ? ` lúc ${formatDateTime(invoice.voidedAt)}` : ""}:{" "}
          {invoice.voidReason ?? "—"}
        </p>
      )}
      <dl className={GRID}>
        <InfoRow label={C.type}>
          <TypeText type={invoice.type} adjusted={invoice.adjusted} />
        </InfoRow>
        {invoice.originalEInvoiceId && (
          <InfoRow label="Hoá đơn gốc">
            <CodeLink href={EINVOICE_ROUTES.detail(invoice.originalEInvoiceId)}>
              Xem hoá đơn gốc
            </CodeLink>
          </InfoRow>
        )}
        {invoice.correctionBasis && (
          <InfoRow label="Căn cứ">
            {CORRECTION_BASIS_LABELS[invoice.correctionBasis]}
            {invoice.correctionReason ? ` — ${invoice.correctionReason}` : ""}
          </InfoRow>
        )}
        <InfoRow label={C.order}>
          {invoice.orderNumber ? (
            <CodeLink href={ADMIN_ROUTES.orders.detail(invoice.orderId)}>
              {invoice.orderNumber}
            </CodeLink>
          ) : (
            "—"
          )}
        </InfoRow>
        {invoice.contractNumber && <InfoRow label="Hợp đồng">{invoice.contractNumber}</InfoRow>}
        <InfoRow label={C.shipment}>
          <span className="font-mono">{invoice.shipmentCode ?? "Phần phí vận chuyển còn lại"}</span>
        </InfoRow>
        <InfoRow label={C.issueDate}>
          <DateCell iso={invoice.issueDate} />
        </InfoRow>
        {!invoice.issuedAt && invoice.issueDueAt && (
          <InfoRow label={C.dueAt}>
            <span className={invoice.overdue ? "text-danger font-medium" : undefined}>
              {formatDateTime(invoice.issueDueAt)}
              {invoice.overdue ? " — quá hạn" : ""}
            </span>
          </InfoRow>
        )}
        {invoice.issuedAt && (
          <InfoRow label="Phát hành lúc">{formatDateTime(invoice.issuedAt)}</InfoRow>
        )}
        {invoice.taxAuthorityCode && (
          <InfoRow label="Mã cơ quan thuế">
            <span className="font-mono">{invoice.taxAuthorityCode}</span>
          </InfoRow>
        )}
        {invoice.lookupCode && (
          <InfoRow label="Mã tra cứu">
            <span className="font-mono">{invoice.lookupCode}</span>
          </InfoRow>
        )}
        {invoice.agreement && (
          <InfoRow label="Văn bản thoả thuận">
            {invoice.agreement.number} — <DateCell iso={invoice.agreement.date} />
          </InfoRow>
        )}
      </dl>
      <div className="border-border-default grid gap-4 border-t pt-3 md:grid-cols-2">
        <Party title={D.seller} party={invoice.seller} />
        <Party title={D.buyer} party={invoice.buyer} />
      </div>
    </Card>
  );
}
