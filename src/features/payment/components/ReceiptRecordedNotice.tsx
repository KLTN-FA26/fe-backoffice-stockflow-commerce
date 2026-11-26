"use client";

import Link from "next/link";
import { useState } from "react";

import { ADMIN_ROUTES, SHIPMENT_PERMISSIONS } from "@/constants";
import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_RECEIPT_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { useCan } from "@/lib/auth/components/Can";
import { formatMoney } from "@/lib/format";
import { Notice } from "@/components/shared/Notice";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import type { PaymentReceipt } from "../types";

const R = PAYMENT_LABELS.recordDialog.recorded;

/** Chuyến đang chờ bàn giao mà kế toán đi từ đó sang thu tiền (`?loadId=&loadCode=` của màn đợt thanh toán). */
export interface ReturnLoad {
  loadId: string;
  loadCode: string;
}

/**
 * Sau "Lập phiếu thu" (S07-5): thông báo nổi nói số tiền và mã sao kê; trên trang còn một dải cố định (thông báo nổi tự mất
 * sau vài giây) có liên kết tới phiếu vừa lập và — khi đi từ lý do chặn bàn giao của một chuyến — "Quay lại chuyến LD-…".
 * Dùng: `const recorded = useRecordedReceipt(returnLoad)`; `onRecorded={recorded.onRecorded}`; vẽ `{recorded.notice}`.
 */
export function useRecordedReceipt(returnLoad?: ReturnLoad | null) {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  return {
    onRecorded: (saved: PaymentReceipt) => {
      setReceipt(saved);
      toast.success(
        R.toastTitle,
        R.toastBody(formatMoney(saved.amount, saved.currency), saved.reference),
      );
    },
    notice: receipt && (
      <ReceiptRecordedNotice
        receipt={receipt}
        returnLoad={returnLoad ?? null}
        onDismiss={() => setReceipt(null)}
      />
    ),
  };
}

function ReceiptRecordedNotice({
  receipt,
  returnLoad,
  onDismiss,
}: {
  receipt: PaymentReceipt;
  returnLoad: ReturnLoad | null;
  onDismiss: () => void;
}) {
  const canRead = useCan(PAYMENT_RECEIPT_PERMISSIONS.read);
  // The load screen needs fulfillment-shipments:READ: without it the link would lead to a refusal page.
  const canOpenLoad = useCan(SHIPMENT_PERMISSIONS.read);
  return (
    <Notice tone="positive" live>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>{R.summary(formatMoney(receipt.amount, receipt.currency), receipt.reference)}</span>
        {canRead && (
          <Link
            href={PAYMENT_ROUTES.receipts.detail(receipt.receiptId)}
            className="text-accent-text font-medium hover:underline"
          >
            {R.view}
          </Link>
        )}
        {returnLoad && canOpenLoad && (
          <Link
            href={ADMIN_ROUTES.loads.detail(returnLoad.loadId)}
            className="text-accent-text font-medium hover:underline"
          >
            {R.backToLoad(returnLoad.loadCode)}
          </Link>
        )}
        <Button type="button" variant="ghost" size="xs" onClick={onDismiss}>
          {R.dismiss}
        </Button>
      </div>
    </Notice>
  );
}
