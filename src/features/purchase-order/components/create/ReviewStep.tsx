"use client";

import { CheckCircle, X } from "lucide-react";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/features/purchase-order";

import type { SupplierOption } from "@/lib/references/supplier-options";
import { Card } from "@/components/shared/Card";

import { SectionTitle, SummaryItem } from "./CreateFormPrimitives";
import { usesCatalogPrice } from "./helpers";
import { ReviewSubmitCard } from "./ReviewSubmitCard";
import type { PoCreateFormValues } from "@/features/purchase-order";
import type { StepKey, Totals } from "./types";
import { STEPS } from "./types";

const L = UI_LABELS.purchaseOrder;
const R = L.review;

export function ReviewStep({
  mode,
  poNumber,
  supplierLabel,
  form,
  selectedSupplier,
  warehouseName,
  totals,
  currency,
  suggestedDate,
  issuesByStep,
  onSubmit,
}: {
  mode: "create" | "edit";
  /** Màn sửa nháp: số PO đã cấp. */
  poNumber?: string;
  supplierLabel: string;
  form: PoCreateFormValues;
  selectedSupplier?: SupplierOption;
  warehouseName?: string;
  /** Hôm nay + leadTimeDays của NCC — BE tự đặt ngày này khi để trống `expectedAt`. */
  suggestedDate: string | null;
  totals: Totals;
  currency: string;
  issuesByStep: Map<StepKey, string[]>;
  onSubmit: () => void;
}) {
  const isEdit = mode === "edit";
  const submitLabel = isEdit ? L.editAction : L.createAction;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <SectionTitle
          title={isEdit ? L.draftEdit.reviewTitle : R.title}
          description={isEdit ? L.draftEdit.reviewDescription : R.description}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryItem label={L.supplier} value={supplierLabel} />
          <SummaryItem label={R.warehouse} value={warehouseName ?? "—"} />
          <SummaryItem
            label={UI_LABELS.purchaseOrder.expectedDate}
            value={
              form.expectedDate
                ? formatDate(form.expectedDate)
                : suggestedDate
                  ? // BE createPurchaseOrder: expectedAt trống → hôm nay (giờ VN) + leadTimeDays.
                    R.autoDate(formatDate(suggestedDate))
                  : "—"
            }
          />
          <SummaryItem
            label={L.paymentTermDays}
            value={selectedSupplier ? `${selectedSupplier.paymentTermDays} ${L.days}` : "—"}
          />
          <SummaryItem
            label={UI_LABELS.purchaseOrder.lineCount}
            value={String(form.lines.length)}
            mono
          />
          <SummaryItem label={UI_LABELS.purchaseOrder.currency} value={currency} mono />
          <SummaryItem
            label={UI_LABELS.purchaseOrder.catalog.catalogPriceLines}
            value={String(form.lines.filter((l) => usesCatalogPrice(l, currency)).length)}
            mono
          />
          <SummaryItem label={R.tax} value={formatMoney(totals.taxTotal, currency)} mono />
          <SummaryItem label={R.total} value={formatMoney(totals.grandTotal, currency)} mono />
          <SummaryItem label={R.poNumber} value={poNumber ?? R.poNumberPending} mono={!!poNumber} />
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
      <ReviewSubmitCard isEdit={isEdit} submitLabel={submitLabel} onSubmit={onSubmit} />
    </div>
  );
}
