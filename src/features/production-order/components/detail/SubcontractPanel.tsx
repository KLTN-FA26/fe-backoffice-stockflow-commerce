"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";

import {
  ADMIN_ROUTES,
  MATERIAL_ISSUE_PERMISSIONS,
  PO_PERMISSIONS,
  PRODUCTION_ORDER_PERMISSIONS,
} from "@/constants";

import { usePermissionChecker } from "@/lib/auth/components/Can";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { formatNumber } from "@/lib/format/number";

import { canReconcileReceipt } from "@/features/production-order/lifecycle";
import {
  useDispatchNote,
  useSettlement,
  useSubcontractReceipts,
} from "@/features/production-order/queries";

import { Card } from "@/components/shared/Card";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO } from "../copy";
import { SettlementSection } from "./SettlementSection";
import { ReconcileForm } from "./SubcontractForms";
import { SubcontractRecovery } from "./SubcontractRecovery";
import { METHOD } from "./SubcontractTerms";

import type { ProductionDetail } from "@/features/production-order/types";

/** Gia công ngoài (SCRUM-442): điều khoản, phiếu giao, nhận về + đối soát phôi, quyết toán. */
export function SubcontractPanel({ order }: { order: ProductionDetail }) {
  const can = usePermissionChecker();
  const terms = order.subcontract;
  const id = order.summary.id;
  const readIssues = can(MATERIAL_ISSUE_PERMISSIONS.read);
  const prepressDone = !!order.prepressCheckedAt;
  const note = useDispatchNote(id, readIssues && prepressDone);
  const receipts = useSubcontractReceipts(id, readIssues);
  const ended = order.summary.status === "COMPLETED" || order.summary.status === "CANCELLED";
  const settlement = useSettlement(id, ended && can(PRODUCTION_ORDER_PERMISSIONS.read));
  const [reconciling, setReconciling] = useState<string | null>(null);
  if (!terms) return null;

  return (
    <Card className="space-y-4">
      <h2 className="text-ink-primary text-sm font-semibold">Gia công ngoài</h2>
      <dl className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
        <dt className="text-ink-tertiary">Hình thức</dt>
        <dd>{METHOD[terms.method]}</dd>
        <dt className="text-ink-tertiary">Đơn giá</dt>
        <dd className={MONO}>{formatMoney(terms.unitPrice, terms.currency)}</dd>
        <dt className="text-ink-tertiary">Nhà gia công</dt>
        <dd>
          {note.data ? (
            `${note.data.subcontractorCode} — ${note.data.subcontractorName}`
          ) : (
            <span className={MONO}>{terms.subcontractorId.slice(0, 8)}</span>
          )}
        </dd>
        <dt className="text-ink-tertiary">Đơn đặt gia công</dt>
        <dd>
          {terms.purchaseOrderId && can(PO_PERMISSIONS.read) ? (
            <Link
              href={ADMIN_ROUTES.purchaseOrders.detail(terms.purchaseOrderId)}
              className="text-accent hover:underline"
            >
              {note.data?.purchaseOrderNumber ?? "Mở đơn đặt"}
            </Link>
          ) : terms.purchaseOrderId ? (
            <span className={MONO}>
              {note.data?.purchaseOrderNumber ?? terms.purchaseOrderId.slice(0, 8)}
            </span>
          ) : (
            "—"
          )}
          {note.data && (
            <span className="text-ink-tertiary ml-2">({note.data.purchaseOrderStatus})</span>
          )}
        </dd>
      </dl>
      {!prepressDone && (
        <p className="text-ink-tertiary text-[0.8125rem]">
          Phiếu giao chỉ có sau khi prepress đạt.
        </p>
      )}
      {note.data && (
        <section aria-labelledby="dispatch-note" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 id="dispatch-note" className="text-ink-primary text-[0.8125rem] font-semibold">
              Phiếu giao gia công
            </h3>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="size-3.5" /> In phiếu
            </Button>
          </div>
          <p className="text-ink-secondary text-[0.8125rem]">
            {note.data.blankSku} · {formatNumber(note.data.quantity)} cái
            {note.data.dueDate ? ` · hạn ${formatDate(note.data.dueDate)}` : ""} · checksum{" "}
            <span className={MONO}>{note.data.designChecksum.slice(0, 12)}</span>
          </p>
          {note.data.blanks.length > 0 && (
            <ul className={`space-y-0.5 ${MONO}`}>
              {note.data.blanks.map((blank, index) => (
                <li key={`${blank.sentAt}-${index}`}>
                  {formatDateTime(blank.sentAt)}: {blank.sku}
                  {blank.lotNumber ? `·${blank.lotNumber}` : ""} {blank.fromLocation} →{" "}
                  {blank.toLocation} × {formatNumber(blank.quantity)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section aria-labelledby="sub-receipts" className="space-y-2">
        <h3 id="sub-receipts" className="text-ink-primary text-[0.8125rem] font-semibold">
          Các lần nhận về
        </h3>
        {!readIssues && (
          <p className="text-ink-tertiary text-[0.8125rem]">
            Chưa có quyền xem các lần nhận (production-material-issues:READ).
          </p>
        )}
        {receipts.data?.length === 0 && (
          <p className="text-ink-tertiary text-[0.8125rem]">
            Chưa nhận lần nào — hàng về nhận qua phiếu nhận kho của đơn đặt gia công.
          </p>
        )}
        {receipts.data?.map((receipt) => (
          <div
            key={receipt.receiptId}
            className="border-border-default space-y-1 border-t pt-2 text-[0.8125rem]"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={ADMIN_ROUTES.receipts.detail(receipt.receiptId)}
                className="text-accent hover:underline"
              >
                Phiếu nhận
              </Link>
              <span className={MONO}>
                {formatNumber(receipt.quantity)} cái · {formatDateTime(receipt.receivedAt)}
              </span>
              {terms.method === "SUPPLIED_BLANKS" &&
                (receipt.reconciledAt ? (
                  <span className="text-ink-secondary">
                    Đã đối soát: dùng {receipt.usedBlanks ?? "—"} · hỏng {receipt.spoiltBlanks ?? 0}{" "}
                    · trả {receipt.returnedBlanks ?? 0}
                  </span>
                ) : canReconcileReceipt(order, receipt, can) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReconciling(receipt.receiptId)}
                  >
                    Đối soát phôi
                  </Button>
                ) : (
                  <StatusDot domain="order" status="Not Reconciled" />
                ))}
            </div>
            {reconciling === receipt.receiptId && (
              <ReconcileForm
                order={order}
                receiptId={receipt.receiptId}
                onDone={() => setReconciling(null)}
              />
            )}
          </div>
        ))}
      </section>
      <SubcontractRecovery order={order} />
      {settlement.data && <SettlementSection order={order} settlement={settlement.data} />}
    </Card>
  );
}
