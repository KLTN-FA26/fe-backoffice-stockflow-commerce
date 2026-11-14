"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { EINVOICE_PERMISSIONS } from "@/constants/einvoice";
import { EINVOICE_TYPE_LABELS } from "@/constants/labels-einvoice";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { DatePicker } from "@/components/shared/DatePicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { exportRegister } from "../api";
import { einvoiceErrorMessage } from "../errors";
import { registerRangeInputSchema } from "../input-schemas";
import { useRegister } from "../queries";

import { EINVOICE_COPY, MONO } from "./copy";
import { DateCell, MoneyCell } from "./primitives";

const COPY = { ...EINVOICE_COPY, pageTitle: "Bảng kê hoá đơn" };
const CELL = "py-1.5 pr-3";

/** Mặc định: tháng hiện tại theo giờ VN. */
function monthRange() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(),
  );
  return { from: `${today.slice(0, 8)}01`, to: today };
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function RegisterContent() {
  const canRead = useCan(EINVOICE_PERMISSIONS.read);
  const canExport = useCan(EINVOICE_PERMISSIONS.export);
  const fallback = monthRange();
  const [from, setFrom] = useQueryState("from", parseAsString.withDefault(fallback.from));
  const [to, setTo] = useQueryState("to", parseAsString.withDefault(fallback.to));
  const parsed = registerRangeInputSchema.safeParse({ from, to });
  const range = parsed.success ? parsed.data : null;
  const query = useRegister(canRead ? range : null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  if (!canRead) return <LoadErrorState error={null} kind="no-read" copy={COPY} />;
  const rows = query.data ?? [];
  const grand = rows.reduce((sum, row) => sum + row.grandTotal, 0);
  const download = async () => {
    if (!range) return;
    setExporting(true);
    setError(null);
    try {
      saveBlob(await exportRegister(range), `bang-ke-hoa-don_${range.from}_${range.to}.csv`);
    } catch (failure: unknown) {
      setError(einvoiceErrorMessage(failure));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="surface-soft surface-compact space-y-4">
      <h1 className="sr-only">{COPY.pageTitle}</h1>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="register-from" className="text-ink-secondary text-[0.8125rem]">
            Từ ngày lập
          </Label>
          <DatePicker
            id="register-from"
            value={from}
            onChange={(value) => void setFrom(value)}
            className="h-8 w-[10.5rem]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="register-to" className="text-ink-secondary text-[0.8125rem]">
            Đến ngày
          </Label>
          <DatePicker
            id="register-to"
            value={to}
            onChange={(value) => void setTo(value)}
            className="h-8 w-[10.5rem]"
          />
        </div>
        {canExport && (
          <Button
            size="sm"
            variant="outline"
            disabled={!range || exporting}
            onClick={() => void download()}
          >
            <Download className="size-3.5" /> Xuất CSV
          </Button>
        )}
        {!parsed.success && (
          <p role="alert" className="text-danger text-[0.8125rem]">
            {parsed.error.issues[0]?.message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-danger text-[0.8125rem]">
            {error}
          </p>
        )}
      </div>
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-ink-primary text-sm font-semibold">Hoá đơn đã phát hành trong kỳ</h2>
          <span className="text-ink-secondary text-[0.8125rem]">
            {rows.length} hoá đơn · tổng có thuế <MoneyCell amount={grand} />
          </span>
        </div>
        {query.isError ? (
          <p role="alert" className="text-danger text-[0.8125rem]">
            {einvoiceErrorMessage(query.error)}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-ink-tertiary text-[0.8125rem]">
            {query.isPending && range ? "Đang tải…" : "Không có hoá đơn nào được lập trong kỳ này."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[0.8125rem]">
              <thead className="text-ink-tertiary text-left">
                <tr>
                  <th className={CELL}>Ký hiệu - Số</th>
                  <th className={CELL}>Ngày lập</th>
                  <th className={CELL}>Loại</th>
                  <th className={CELL}>Bên mua</th>
                  <th className={CELL}>Đơn</th>
                  <th className={`${CELL} text-right`}>Tiền hàng</th>
                  <th className={`${CELL} text-right`}>Thuế GTGT</th>
                  <th className="py-1.5 text-right">Tổng có thuế</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--table-line)]">
                {rows.map((row) => (
                  <tr key={`${row.symbol}-${row.invoiceNumber}`}>
                    <td className={`${CELL} ${MONO}`}>
                      {row.templateCode}
                      {row.symbol}-{String(row.invoiceNumber).padStart(7, "0")}
                    </td>
                    <td className={CELL}>
                      <DateCell iso={row.issueDate} />
                    </td>
                    <td className={CELL}>
                      {EINVOICE_TYPE_LABELS[row.type]}
                      {row.originalReference ? ` (gốc ${row.originalReference})` : ""}
                    </td>
                    <td className={CELL}>
                      <div>{row.buyerName ?? "—"}</div>
                      <div className="text-ink-tertiary font-mono text-xs">
                        {row.buyerTaxCode ?? ""}
                      </div>
                    </td>
                    <td className={`${CELL} font-mono`}>{row.orderNumber ?? "—"}</td>
                    <td className={`${CELL} text-right`}>
                      <MoneyCell amount={row.subtotal} />
                    </td>
                    <td className={`${CELL} text-right`}>
                      <MoneyCell amount={row.taxTotal} />
                    </td>
                    <td className="py-1.5 text-right">
                      <MoneyCell amount={row.grandTotal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Bảng kê hoá đơn đã phát hành theo kỳ (BE `GET /einvoices/register`), sắp theo ký hiệu và số; xuất
 * CSV (UTF-8 có BOM) cho phần mềm kế toán với quyền `einvoices:EXPORT`.
 */
export function EInvoiceRegister() {
  return (
    <PermissionBoundary permissions={[EINVOICE_PERMISSIONS.viewPage]}>
      <RegisterContent />
    </PermissionBoundary>
  );
}
