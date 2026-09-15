"use client";

import { cn } from "cn";
import { AlertTriangle, ArrowLeft, CircleAlert, FileImage, Package } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { ADMIN_ROUTES } from "@/constants";
import { useInvoice } from "@/features/invoice/queries";
import {
  buildInvoiceTimeline,
  classifyLineVariance,
  collectVariances,
  formatMoney,
  lineMatchLabel,
} from "@/features/invoice";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";

import type { InvoiceLine } from "@/features/invoice/types";

interface InvoiceDetailProps {
  params: Promise<{ id: string }>;
}

export function InvoiceDetail({ params }: InvoiceDetailProps) {
  const { id } = use(params);
  const query = useInvoice(id);

  if (query.isLoading || !query.data) return <PageSkeleton variant="detail" />;
  const invoice = query.data;
  const timeline = buildInvoiceTimeline(invoice.status);
  const variances = collectVariances(invoice);
  const matchingColumns: ColumnDef<InvoiceLine>[] = [
    {
      key: "skuId",
      header: "Mã SKU",
      sortable: true,
      compare: (a, b) => a.skuId.localeCompare(b.skuId),
      cell: (line) => (
        <span className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium">
          {line.skuId}
        </span>
      ),
    },
    {
      key: "qtyPo",
      header: "SL đặt",
      align: "right",
      sortable: true,
      compare: (a, b) => a.match.qtyPo - b.match.qtyPo,
      cell: (line) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {line.match.qtyPo.toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      key: "qtyReceipt",
      header: "SL nhận",
      align: "right",
      sortable: true,
      compare: (a, b) => a.match.qtyReceipt - b.match.qtyReceipt,
      cell: (line) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {line.match.qtyReceipt.toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      key: "qtyInvoice",
      header: "SL hoá đơn",
      align: "right",
      sortable: true,
      compare: (a, b) => a.match.qtyInvoice - b.match.qtyInvoice,
      cell: (line) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {line.match.qtyInvoice.toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      key: "pricePo",
      header: "Đơn giá PO",
      align: "right",
      sortable: true,
      compare: (a, b) => a.match.pricePo - b.match.pricePo,
      cell: (line) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {formatMoney(line.match.pricePo, invoice.currency)}
        </span>
      ),
    },
    {
      key: "priceInvoice",
      header: "Đơn giá HĐ",
      align: "right",
      sortable: true,
      compare: (a, b) => a.match.priceInvoice - b.match.priceInvoice,
      cell: (line) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {formatMoney(line.match.priceInvoice, invoice.currency)}
        </span>
      ),
    },
    {
      key: "variance",
      header: "Chênh lệch",
      align: "right",
      sortable: true,
      compare: (a, b) =>
        Math.abs(a.match.varianceQty || a.match.variancePrice) -
        Math.abs(b.match.varianceQty || b.match.variancePrice),
      cell: (line) =>
        line.match.varianceQty !== 0 || line.match.variancePrice !== 0 ? (
          <span className="text-warning font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
            {line.match.varianceQty !== 0
              ? `${line.match.varianceQty > 0 ? "+" : ""}${line.match.varianceQty}`
              : `${line.match.variancePrice > 0 ? "+" : ""}${line.match.variancePrice}`}
          </span>
        ) : (
          <span className="text-ink-tertiary font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums">
            —
          </span>
        ),
    },
    {
      key: "result",
      header: "Kết quả",
      cell: (line) => (
        <StatusDot domain="invoice" status={lineMatchLabel(line)} size="sm" withIcon />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={invoice.invoiceNumber}
        subtitle="Chi tiết hoá đơn và kết quả đối chiếu ba chiều PO · Receipt · Invoice."
        actions={
          <Link
            href={ADMIN_ROUTES.invoices.list}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Quay lại
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="border-border-default bg-bg-surface overflow-hidden rounded-[var(--r-sm)] border shadow-[var(--card-shadow)]">
          <div className="border-border-default bg-bg-subtle flex items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <p className="text-ink-tertiary text-[0.6875rem] tracking-wide uppercase">
                Supplier invoice
              </p>
              <p className="text-ink-primary mt-1 font-[family-name:var(--font-mono)] text-xl font-semibold tracking-[-0.01em]">
                {invoice.invoiceNumber}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusDot domain="invoice" status={invoice.status} withIcon />
              <span className="text-ink-tertiary text-xs font-medium">{invoice.currency}</span>
            </div>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
                  <dt className="text-ink-tertiary text-xs">Nhà cung cấp</dt>
                  <dd className="text-ink-primary mt-1 font-medium">{invoice.supplierId}</dd>
                </div>
                <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
                  <dt className="text-ink-tertiary text-xs">Ngày hoá đơn</dt>
                  <dd className="text-ink-primary mt-1 tabular-nums">
                    {new Date(invoice.invoiceDate).toLocaleDateString("vi-VN")}
                  </dd>
                </div>
                <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
                  <dt className="text-ink-tertiary text-xs">Hạn thanh toán</dt>
                  <dd className="text-ink-primary mt-1 tabular-nums">
                    {new Date(invoice.dueDate).toLocaleDateString("vi-VN")}
                  </dd>
                </div>
              </dl>

              <div className="border-border-default rounded-[var(--r-sm)] border">
                <div className="border-border-default grid grid-cols-[140px_1fr] border-b px-3 py-2 text-sm last:border-b-0">
                  <span className="text-ink-tertiary">PO tham chiếu</span>
                  <span className="text-ink-primary font-mono">{invoice.poId}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] px-3 py-2 text-sm">
                  <span className="text-ink-tertiary">Receipt tham chiếu</span>
                  <span className="text-ink-primary font-mono">{invoice.receiptId}</span>
                </div>
              </div>
            </div>

            <div className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-3">
              <div className="text-right">
                <p className="text-ink-tertiary text-xs">Tổng cộng</p>
                <p className="text-ink-primary mt-2 font-mono text-xl font-semibold tabular-nums">
                  {formatMoney(invoice.grandTotal, invoice.currency)}
                </p>
              </div>
              <div className="border-border-default my-3 border-t" />
              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-tertiary">Tạm tính</dt>
                  <dd className="text-ink-primary font-mono tabular-nums">
                    {formatMoney(invoice.subtotal, invoice.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-tertiary">Thuế</dt>
                  <dd className="text-ink-primary font-mono tabular-nums">
                    {formatMoney(invoice.taxTotal, invoice.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-tertiary">Match result</dt>
                  <dd>
                    <StatusDot domain="invoice" status={invoice.matchResult} size="sm" withIcon />
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4">
          <p className="text-ink-primary text-sm font-semibold">Lifecycle</p>
          <div className="relative mt-4 pl-6">
            <div className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
            {timeline.map((step) => (
              <div key={step.status} className="relative pb-4 last:pb-0">
                <div
                  className={cn(
                    "border-bg-surface absolute top-0.5 -left-[22.5px] size-[11px] rounded-full border-2",
                    step.active
                      ? "bg-accent ring-accent/30 ring-2"
                      : step.completed
                        ? "bg-positive"
                        : "bg-bg-muted",
                  )}
                />
                <p
                  className={cn(
                    "text-xs font-medium",
                    step.active
                      ? "text-accent"
                      : step.completed
                        ? "text-ink-primary"
                        : "text-ink-tertiary",
                  )}
                >
                  {step.label}
                </p>
                <p className="text-ink-tertiary text-[0.6875rem]">{step.status}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4 shadow-[var(--card-shadow)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-ink-primary flex items-center gap-2 text-[0.9375rem] font-semibold">
            <FileImage className="text-accent size-4" />
            Tệp hoá đơn
          </h2>
          <span className="border-border-default bg-bg-subtle text-ink-tertiary rounded-[var(--r-sm)] border px-2 py-1 text-xs">
            Chưa có file
          </span>
        </div>
        <div className="border-border-default bg-bg-subtle flex min-h-[180px] items-center justify-center rounded-[var(--r-sm)] border border-dashed">
          <div className="text-center">
            <FileImage className="text-ink-tertiary mx-auto size-6" />
            <p className="text-ink-primary mt-2 text-sm font-medium">Chưa đính kèm chứng từ</p>
            <p className="text-ink-tertiary mt-1 text-xs">
              Sau này sẽ hiển thị PDF scan hoặc ảnh hoá đơn tại đây.
            </p>
          </div>
        </div>
      </section>

      <section className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4 shadow-[var(--card-shadow)]">
        <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
          <Package className="text-accent size-4" />
          Three-way Matching
        </h2>
        <DataTable
          data={invoice.lines}
          columns={matchingColumns}
          rowKey={(line) => line.lineId}
          caption={`${invoice.lines.length.toLocaleString("vi-VN")} dòng đối chiếu — ${invoice.invoiceNumber}`}
          flagRow={(line) => classifyLineVariance(line).length > 0}
          pageSize={50}
        />
      </section>

      {variances.length > 0 && (
        <section className="border-warning/30 bg-warning/5 rounded-[var(--r-sm)] border p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="text-warning size-4" />
            <h2 className="text-ink-primary text-sm font-semibold">Variance cần xử lý</h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {variances.map((variance) => (
              <div
                key={`${variance.lineId}-${variance.type}`}
                className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-3"
              >
                <div className="flex items-center gap-2">
                  <CircleAlert className="text-warning size-3.5" />
                  <span className="text-ink-primary text-xs font-semibold">{variance.label}</span>
                </div>
                <p className="text-ink-secondary mt-1 text-xs">{variance.detail}</p>
                <p className="text-ink-tertiary mt-1 font-mono text-[0.6875rem]">
                  {variance.skuId}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {invoice.disputeNote && (
        <section className="border-danger/30 bg-danger/5 rounded-[var(--r-sm)] border p-4">
          <div className="mb-2 flex items-center gap-2">
            <CircleAlert className="text-danger size-4" />
            <h2 className="text-ink-primary text-sm font-semibold">Dispute</h2>
          </div>
          <p className="text-ink-secondary text-sm">{invoice.disputeNote}</p>
        </section>
      )}

      <section className="border-border-default bg-bg-surface flex justify-end gap-6 rounded-[var(--r-sm)] border p-4 text-right">
        <div>
          <p className="text-ink-tertiary text-xs">Tạm tính</p>
          <p className="text-ink-primary mt-1 font-mono tabular-nums">
            {formatMoney(invoice.subtotal, invoice.currency)}
          </p>
        </div>
        <div>
          <p className="text-ink-tertiary text-xs">Thuế</p>
          <p className="text-ink-primary mt-1 font-mono tabular-nums">
            {formatMoney(invoice.taxTotal, invoice.currency)}
          </p>
        </div>
        <div>
          <p className="text-ink-tertiary text-xs">Tổng cộng</p>
          <p className="text-ink-primary mt-1 font-mono font-semibold tabular-nums">
            {formatMoney(invoice.grandTotal, invoice.currency)}
          </p>
        </div>
      </section>
    </div>
  );
}
