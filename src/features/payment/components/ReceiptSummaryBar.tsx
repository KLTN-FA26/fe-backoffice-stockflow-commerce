"use client";

import { Download } from "lucide-react";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_RECEIPT_PERMISSIONS } from "@/constants/payment";
import { formatMoney } from "@/lib/format/money";
import { useCan } from "@/lib/auth/components/Can";
import { Button } from "@/components/ui/button";

import { receiptErrorMessage } from "../errors";
import { useExportReceipts } from "../mutations";
import { useReceiptSummary } from "../queries";

import type { ReceiptFilterParams } from "../api";

const L = PAYMENT_LABELS.receipts;

/**
 * Tổng phiếu thu theo bộ lọc hiện tại (`GET /payment-receipts/summary`, không tính phiếu đã huỷ) và nút
 * "Xuất Excel" (`/export`, cần `payment-receipts:EXPORT`). Nhiều loại tiền thì liệt kê từng loại.
 */
export function ReceiptSummaryBar({
  filter,
  disabled,
}: {
  filter: ReceiptFilterParams;
  /** Bộ lọc chưa hợp lệ (từ ngày sau đến ngày): không gọi BE. */
  disabled: boolean;
}) {
  const canExport = useCan(PAYMENT_RECEIPT_PERMISSIONS.export);
  const summary = useReceiptSummary(filter, !disabled);
  const exportFile = useExportReceipts();
  const data = summary.data;
  const totals =
    data && data.totalAmount != null && data.currency
      ? formatMoney(data.totalAmount, data.currency)
      : (data?.byCurrency.map((row) => formatMoney(row.totalAmount, row.currency)).join(" · ") ??
        "");
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
      <p className="text-ink-secondary" aria-live="polite">
        {summary.isError ? (
          L.summaryError
        ) : data ? (
          <>
            <span className="tabular-nums">{L.summaryCount(data.count)}</span>
            {data.count > 0 && (
              <>
                {" · "}
                {L.summaryTitle}{" "}
                <span className="text-ink-primary font-semibold tabular-nums">{totals}</span>
              </>
            )}
            <span className="text-ink-tertiary"> · {L.summaryNote}</span>
          </>
        ) : null}
      </p>
      {canExport && (
        <div className="ml-auto flex items-center gap-2">
          {exportFile.isError && (
            <p role="alert" className="text-danger text-xs">
              {receiptErrorMessage(exportFile.error)}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || exportFile.isPending}
            onClick={() => exportFile.mutate({ filter, fallbackName: L.exportFallbackName })}
          >
            <Download className="size-4" />
            {exportFile.isPending ? L.exporting : L.exportAction}
          </Button>
        </div>
      )}
    </div>
  );
}
