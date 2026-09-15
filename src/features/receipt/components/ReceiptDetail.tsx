"use client";

import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  MapPin,
  PackageCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { use, useMemo } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES } from "@/constants";

import {
  buildReceiptTimeline,
  discrepancyStatusLabel,
  discrepancyTypeLabel,
  lineDiscrepancyLabel,
  lotsForLine,
  qcStatusForLine,
  totalOrderedQty,
  totalReceivedQty,
} from "@/features/receipt/selectors";
import { useReceipt, useReceiptLots } from "@/features/receipt/queries";

import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { DiscrepancyRecord, Lot, ReceiptLine } from "@/features/receipt/types";

interface ReceiptDetailProps {
  params: Promise<{ id: string }>;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function quantityLabel(value: number, uom: string): string {
  return `${value.toLocaleString("vi-VN")} ${uom}`;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd className="text-ink-primary mt-1 text-[0.8125rem] font-medium">{value}</dd>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <div className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4 shadow-[var(--card-shadow)]">
      <div className="text-ink-tertiary flex items-center gap-2 text-xs">
        <Icon className="text-accent size-4" />
        {label}
      </div>
      <div className="text-ink-primary mt-2 font-[family-name:var(--font-mono)] text-lg font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function lotSummary(line: ReceiptLine, lots: Lot[]): string {
  const lineLots = lotsForLine(line, lots);
  if (!lineLots.length) return "—";
  return lineLots.map((lot) => lot.lotNumber).join(", ");
}

function expirySummary(line: ReceiptLine, lots: Lot[]): string {
  const lineLots = lotsForLine(line, lots);
  if (!lineLots.length) return "—";
  return lineLots.map((lot) => formatDate(lot.expiryDate)).join(", ");
}

function serialSummary(line: ReceiptLine): string {
  if (!line.serialIds.length) return "—";
  return line.serialIds.join(", ");
}

export function ReceiptDetail({ params }: ReceiptDetailProps) {
  const { id } = use(params);
  const router = useRouter();
  const receiptQuery = useReceipt(id);
  const lotsQuery = useReceiptLots({ pageSize: 500 });

  const receipt = receiptQuery.data;
  const lots = useMemo(() => lotsQuery.data?.items ?? [], [lotsQuery.data?.items]);

  const lineColumns = useMemo<ColumnDef<ReceiptLine>[]>(
    () => [
      {
        key: "skuId",
        header: "SKU",
        sortable: true,
        compare: (a, b) => a.skuId.localeCompare(b.skuId),
        cell: (line) => (
          <span className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium">
            {line.skuId}
          </span>
        ),
      },
      {
        key: "orderedQty",
        header: "SL dự kiến",
        align: "right",
        sortable: true,
        compare: (a, b) => a.orderedQty - b.orderedQty,
        cell: (line) => (
          <span className="text-ink-primary font-[family-name:var(--font-mono)] tabular-nums">
            {quantityLabel(line.orderedQty, line.uom)}
          </span>
        ),
      },
      {
        key: "receivedQty",
        header: "SL thực nhận",
        align: "right",
        sortable: true,
        compare: (a, b) => a.receivedQty - b.receivedQty,
        cell: (line) => (
          <span className="text-ink-primary font-[family-name:var(--font-mono)] font-semibold tabular-nums">
            {quantityLabel(line.receivedQty, line.uom)}
          </span>
        ),
      },
      {
        key: "lotIds",
        header: "Lô",
        cell: (line) => (
          <span className="text-ink-secondary text-[0.8125rem]">{lotSummary(line, lots)}</span>
        ),
      },
      {
        key: "expiryDate",
        header: "Hạn dùng",
        cell: (line) => (
          <span className="text-ink-tertiary text-[0.8125rem]">{expirySummary(line, lots)}</span>
        ),
      },
      {
        key: "serialIds",
        header: "Serial",
        cell: (line) => (
          <span className="text-ink-secondary text-[0.8125rem]">{serialSummary(line)}</span>
        ),
      },
      {
        key: "qcStatus",
        header: "QC",
        cell: (line) => (
          <StatusDot domain="qc" status={qcStatusForLine(line, lots)} size="sm" withIcon />
        ),
      },
      {
        key: "discrepancyQty",
        header: "Chênh lệch",
        cell: (line) => (
          <span className="text-ink-secondary text-[0.8125rem] font-medium">
            {lineDiscrepancyLabel(line)}
          </span>
        ),
      },
    ],
    [lots],
  );

  const discrepancyColumns = useMemo<ColumnDef<DiscrepancyRecord>[]>(
    () => [
      {
        key: "type",
        header: "Loại",
        cell: (item) => (
          <span className="text-ink-primary font-medium">{discrepancyTypeLabel(item.type)}</span>
        ),
      },
      {
        key: "quantity",
        header: "Số lượng",
        align: "right",
        cell: (item) => (
          <span className="text-ink-primary font-[family-name:var(--font-mono)] tabular-nums">
            {item.quantity.toLocaleString("vi-VN")}
          </span>
        ),
      },
      {
        key: "reason",
        header: "Lý do",
        cell: (item) => <span className="text-ink-secondary">{item.reason}</span>,
      },
      {
        key: "status",
        header: "Trạng thái",
        cell: (item) => (
          <span className="border-border-default bg-bg-subtle text-ink-secondary rounded-[var(--r-sm)] border px-2 py-1 text-xs">
            {discrepancyStatusLabel(item.status)}
          </span>
        ),
      },
      {
        key: "resolvedBy",
        header: "Người xử lý",
        cell: (item) => <span className="text-ink-tertiary">{item.resolvedBy ?? "—"}</span>,
      },
    ],
    [],
  );

  if (receiptQuery.isLoading) return <PageSkeleton variant="detail" />;

  if (!receipt) {
    return (
      <div className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-6">
        <PageHeader
          title="Không tìm thấy phiếu nhận"
          subtitle="Phiếu nhận không tồn tại hoặc đã bị xoá khỏi dữ liệu mock."
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push(ADMIN_ROUTES.receipts.list)}
            >
              <ArrowLeft className="size-3.5" />
              Quay lại
            </Button>
          }
        />
      </div>
    );
  }

  const discrepancies = receipt.discrepancies ?? [];
  const timeline = buildReceiptTimeline(receipt.status);
  const lotCount = receipt.lines.reduce((sum, line) => sum + line.lotIds.length, 0);
  const serialCount = receipt.lines.reduce((sum, line) => sum + line.serialIds.length, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={receipt.receiptNumber}
        subtitle={`PO nguồn ${receipt.poId} · Dock/Inbound zone: ${receipt.warehouseId} · Delivery note: ${receipt.notes ?? "Chưa ghi nhận"}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusDot domain="receipt" status={receipt.status} size="md" withIcon />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push(ADMIN_ROUTES.receipts.list)}
            >
              <ArrowLeft className="size-3.5" />
              Quay lại
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={ClipboardList}
          label="Dòng nhận"
          value={receipt.lines.length.toLocaleString("vi-VN")}
        />
        <SummaryCard
          icon={PackageCheck}
          label="SL thực nhận"
          value={totalReceivedQty(receipt).toLocaleString("vi-VN")}
        />
        <SummaryCard
          icon={Truck}
          label="SL dự kiến"
          value={totalOrderedQty(receipt).toLocaleString("vi-VN")}
        />
        <SummaryCard
          icon={MapPin}
          label="Lô / Serial"
          value={`${lotCount.toLocaleString("vi-VN")} / ${serialCount.toLocaleString("vi-VN")}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4 shadow-[var(--card-shadow)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-ink-primary text-lg font-semibold">Receipt lines</h2>
                <p className="text-ink-secondary text-sm">
                  SKU, số lượng dự kiến/thực nhận, lô, hạn dùng, serial và QC theo lot.
                </p>
              </div>
            </div>
            <DataTable
              data={receipt.lines}
              columns={lineColumns}
              rowKey={(line) => line.lineId}
              caption={`Hiển thị ${receipt.lines.length.toLocaleString("vi-VN")} dòng nhận`}
              flagRow={(line) => line.discrepancyQty !== 0}
              pageSize={10}
            />
          </section>

          {discrepancies.length > 0 && (
            <section className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4 shadow-[var(--card-shadow)]">
              <div className="mb-3">
                <h2 className="text-ink-primary text-lg font-semibold">Discrepancy</h2>
                <p className="text-ink-secondary text-sm">
                  Thiếu/thừa/hư hỏng trong quá trình nhận hàng theo docs module 03.
                </p>
              </div>
              <DataTable
                data={discrepancies}
                columns={discrepancyColumns}
                rowKey={(item) => item.discrepancyId}
                caption={`Hiển thị ${discrepancies.length.toLocaleString("vi-VN")} chênh lệch`}
                pageSize={10}
              />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4 shadow-[var(--card-shadow)]">
            <h2 className="text-ink-primary mb-3 text-lg font-semibold">Thông tin nhận hàng</h2>
            <dl className="grid gap-2">
              <InfoItem label="PO nguồn" value={receipt.poId} />
              <InfoItem label="NCC" value={receipt.supplierId} />
              <InfoItem label="Kho / inbound zone" value={receipt.warehouseId} />
              <InfoItem label="Người nhận" value={receipt.receivedBy} />
              <InfoItem label="Thời điểm nhận" value={formatDateTime(receipt.receivedAt)} />
              <InfoItem label="Delivery note" value={receipt.notes ?? "Chưa ghi nhận"} />
            </dl>
          </section>

          <section className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4 shadow-[var(--card-shadow)]">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="text-accent size-4" />
              <h2 className="text-ink-primary text-lg font-semibold">Timeline</h2>
            </div>
            <div className="relative pl-6">
              <div className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
              {timeline.map((step) => (
                <div key={step.status} className="relative pb-5 last:pb-0">
                  <div
                    className={
                      step.active
                        ? "border-bg-surface bg-accent ring-accent/30 absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2 ring-2"
                        : step.completed
                          ? "border-bg-surface bg-positive absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2"
                          : "border-bg-surface bg-bg-muted absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2"
                    }
                  />
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        step.active
                          ? "text-accent text-[0.8125rem] font-medium"
                          : step.completed
                            ? "text-ink-primary text-[0.8125rem] font-medium"
                            : "text-ink-tertiary text-[0.8125rem] font-medium"
                      }
                    >
                      {step.label}
                    </span>
                    {step.active && (
                      <span className="bg-accent/10 text-accent rounded-full px-2 py-0.5 text-[0.625rem] font-semibold">
                        Hiện tại
                      </span>
                    )}
                  </div>
                  <div className="text-ink-tertiary text-xs">{step.status}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4 shadow-[var(--card-shadow)]">
            <div className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
              <UserRound className="text-accent size-4" />
              QC summary
            </div>
            <div className="mt-3 space-y-2">
              {receipt.lines.map((line) => (
                <div
                  key={line.lineId}
                  className="border-border-default bg-bg-subtle flex items-center justify-between rounded-[var(--r-sm)] border px-3 py-2"
                >
                  <span className="text-ink-secondary font-[family-name:var(--font-mono)] text-xs">
                    {line.skuId}
                  </span>
                  <StatusDot domain="qc" status={qcStatusForLine(line, lots)} size="sm" withIcon />
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
