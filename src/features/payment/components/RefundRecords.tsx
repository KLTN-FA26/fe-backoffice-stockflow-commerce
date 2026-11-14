"use client";

import { Ban } from "lucide-react";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { formatDateTime } from "@/lib/format/date";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";

import { DateCell, MoneyCell, ReceiptStatusDot } from "./primitives";

import type { RefundRecord } from "../types";

const L = PAYMENT_LABELS.refunds;

/** Các lần ghi nhận đã hoàn của đơn; ghi nhận ghi sai thì huỷ (giữ lại kèm lý do — docs 15 §4.5 bước 16). */
export function RefundRecords({
  records,
  canVoid,
  onVoid,
}: {
  records: readonly RefundRecord[];
  canVoid: (record: RefundRecord) => boolean;
  onVoid: (record: RefundRecord) => void;
}) {
  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">{L.records}</h2>
      {records.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.noRecords}</p>
      ) : (
        <ul className="divide-border-default divide-y text-[0.8125rem]">
          {records.map((record) => (
            <li key={record.refundRecordId} className="space-y-1 py-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-mono">{record.reference}</span>
                <DateCell iso={record.refundedOn} />
                <MoneyCell amount={record.amount} currency={record.currency} />
                <ReceiptStatusDot status={record.status} />
                {canVoid(record) && (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="text-danger ml-auto"
                    onClick={() => onVoid(record)}
                  >
                    <Ban className="size-3.5" /> {L.voidAction}
                  </Button>
                )}
              </div>
              {record.note && <p className="text-ink-secondary">{record.note}</p>}
              {record.status === "VOIDED" && (
                <p className="text-ink-tertiary">
                  {L.voidInfo}: {record.voidReason ?? PAYMENT_LABELS.empty}
                  {record.voidedAt ? ` · ${formatDateTime(record.voidedAt)}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
