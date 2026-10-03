"use client";

import { CheckCircle, Send, Settings2, ShoppingCart, X } from "lucide-react";
import { cn } from "cn";

import { PO_STATUS, UI_LABELS } from "@/constants";
import { formatDate } from "@/lib/format";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { formatMoney } from "@/features/purchase-order";

import type { SupplierOption } from "@/lib/references/supplier-options";
import { Card } from "@/components/shared/Card";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { SectionTitle, SummaryItem } from "./CreateFormPrimitives";
import type { PoCreateFormValues } from "@/features/purchase-order";
import type { StepKey, Totals } from "./types";
import { STEPS } from "./types";

const DRAFT_LABEL = STATUS_LABEL_VI[PO_STATUS.DRAFT] ?? PO_STATUS.DRAFT;

export function ReviewStep({
  form,
  selectedSupplier,
  totals,
  currency,
  suggestedDate,
  issuesByStep,
  onSubmit,
}: {
  form: PoCreateFormValues;
  selectedSupplier?: SupplierOption;
  /** Hôm nay + leadTimeDays của NCC — BE tự đặt ngày này khi để trống `expectedAt`. */
  suggestedDate: string | null;
  totals: Totals;
  currency: string;
  issuesByStep: Map<StepKey, string[]>;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <SectionTitle
          title="Rà soát trước khi tạo PO"
          description="Tổng hợp PO và các mục cần kiểm tra trước khi tạo."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryItem
            label={UI_LABELS.purchaseOrder.supplier}
            value={selectedSupplier ? `${selectedSupplier.code} — ${selectedSupplier.name}` : "—"}
          />
          <SummaryItem
            label={UI_LABELS.purchaseOrder.expectedDate}
            value={
              form.expectedDate
                ? formatDate(form.expectedDate)
                : suggestedDate
                  ? // BE createPurchaseOrder: expectedAt trống → hôm nay (giờ VN) + leadTimeDays.
                    `Hệ thống tự đặt: ${formatDate(suggestedDate)}`
                  : "—"
            }
          />
          <SummaryItem
            label="Thời hạn thanh toán"
            value={selectedSupplier ? `${selectedSupplier.paymentTermDays} ngày` : "—"}
          />
          <SummaryItem
            label={UI_LABELS.purchaseOrder.lineCount}
            value={String(form.lines.length)}
            mono
          />
          <SummaryItem label={UI_LABELS.purchaseOrder.currency} value={currency} mono />
          <SummaryItem label="Tổng PO" value={formatMoney(totals.grandTotal, currency)} mono />
          <SummaryItem label="Số PO" value="Hệ thống tự cấp khi tạo đơn" />
        </div>
        <div className="border-border-default mt-5 rounded-[var(--r-sm)] border">
          {STEPS.map((step) => {
            const issues = issuesByStep.get(step.key) ?? [];
            return (
              <div
                key={step.key}
                className="border-border-default flex items-start gap-3 border-b px-3 py-2 last:border-b-0"
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-5 items-center justify-center rounded-full",
                    issues.length ? "bg-danger/10 text-danger" : "bg-positive/10 text-positive",
                  )}
                >
                  {issues.length ? <X className="size-3" /> : <CheckCircle className="size-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-ink-primary text-[0.8125rem] font-medium">{step.label}</div>
                  {issues.length ? (
                    <div className="text-danger mt-0.5 text-xs">{issues.join(" · ")}</div>
                  ) : (
                    <div className="text-ink-tertiary mt-0.5 text-xs">Sẵn sàng</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="h-fit">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-ink-tertiary text-xs font-medium">Trạng thái sau khi tạo</div>
            <div className="mt-1 flex items-center gap-2">
              <StatusDot domain="po" status={PO_STATUS.DRAFT} withIcon />
            </div>
          </div>
          <Settings2 className="text-accent size-5" />
        </div>
        <div className="border-border-default bg-bg-subtle text-ink-secondary rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]">
          <div className="text-ink-primary mb-1 flex items-center gap-2 font-medium">
            <ShoppingCart className="text-accent size-3.5" />
            {UI_LABELS.purchaseOrder.createAction} → {DRAFT_LABEL}
          </div>
          Nhấn &quot;{UI_LABELS.purchaseOrder.createAction}&quot; để tạo đơn ở trạng thái{" "}
          {DRAFT_LABEL}; duyệt đơn ở màn chi tiết.
        </div>
        <Button
          variant="default"
          type="button"
          size="sm"
          onClick={onSubmit}
          className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--r-sm)] px-3 py-2 text-[0.8125rem] font-medium transition-colors"
        >
          <Send className="size-3.5" />
          {UI_LABELS.purchaseOrder.createAction}
        </Button>
      </Card>
    </div>
  );
}
