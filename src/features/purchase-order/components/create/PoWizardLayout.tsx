"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { CreateBottomBar } from "./CreateBottomBar";
import { StepIssues } from "./CreateFormPrimitives";
import { CreateStepper } from "./CreateStepper";
import { InfoStep } from "./InfoStep";
import { LinesStep } from "./LinesStep";
import { ReviewStep } from "./ReviewStep";
import { SupplierChangeDialog } from "./SupplierChangeDialog";
import { TotalsStep } from "./TotalsStep";

import type { PoWizard } from "./usePoWizard";

const L = UI_LABELS.purchaseOrder;

export type PoWizardLayoutProps = {
  w: PoWizard;
  title: string;
  subtitle: string;
  back: { href: string; label: string };
  /** Màn sửa nháp: số PO, tên NCC (chỉ đọc), `notice` = cảnh báo dưới PageHeader. */
  draft?: { poNumber: string; supplierLabel: string; notice?: React.ReactNode };
};

/** Bố cục wizard PO (tạo + sửa nháp), như wizard NCC: stepper, nội dung bước, thanh dưới, xác nhận. */
export function PoWizardLayout({ w, title, subtitle, back, draft }: PoWizardLayoutProps) {
  if (w.suppliersQuery.isPending) return <PageSkeleton variant="form" />;
  const isEdit = w.mode === "edit";
  const submitLabel = isEdit ? L.editAction : L.createAction;
  const issuesTitle = isEdit ? L.draftEdit.stepIssuesTitle : L.stepIssuesTitle;
  const total = formatMoney(w.totals.grandTotal, w.values.currency);
  // NCC của nháp có thể đã ngừng hợp tác (không còn trong danh sách ACTIVE) ⇒ dùng tên trên PO.
  const supplierLabel = w.selectedSupplier
    ? `${w.selectedSupplier.code} — ${w.selectedSupplier.name}`
    : (draft?.supplierLabel ?? "—");

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Link
            href={back.href}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            {back.label}
          </Link>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <CreateStepper
          stepStatus={w.stepStatus}
          canGoTo={w.canGoTo}
          lineCount={w.values.lines.length}
          onStepChange={w.goToStep}
          reviewLabel={submitLabel}
        />
        <div className="min-w-0 space-y-4 pb-24">
          {/* Màn sửa: NCC cố định (BR-07) — danh sách NCC chỉ để hiển thị điều khoản, không cần báo */}
          {!isEdit && w.suppliersQuery.isError && (
            <Alert tone="danger" title={L.suppliersLoadFailedTitle}>
              {L.suppliersLoadFailed}{" "}
              <Button variant="link" size="sm" onClick={() => void w.suppliersQuery.refetch()}>
                {UI_LABELS.common.retry}
              </Button>
            </Alert>
          )}
          {draft?.notice}
          {w.showErrors && <StepIssues issues={w.currentStepIssues} title={issuesTitle} />}
          {/* Enter trong ô nhập = "Tiếp tục" (mode-a: Enter submit) — không gửi thẳng lên BE. */}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (w.currentStep === "review") w.handleReviewSubmit();
              else void w.goNext();
            }}
            className="space-y-4"
          >
            {w.currentStep === "info" && <InfoStep w={w} supplierLabel={supplierLabel} />}
            {w.currentStep === "lines" && <LinesStep w={w} />}
            {w.currentStep === "totals" && (
              <TotalsStep totals={w.totals} currency={w.values.currency} lines={w.values.lines} />
            )}
            {w.currentStep === "review" && (
              <ReviewStep
                mode={w.mode}
                poNumber={draft?.poNumber}
                form={w.values}
                suggestedDate={w.suggestedDate}
                selectedSupplier={w.selectedSupplier}
                supplierLabel={supplierLabel}
                warehouseName={
                  w.warehouses.find((wh) => wh.warehouseId === w.values.warehouseId)?.name ??
                  w.keptWarehouse?.name
                }
                totals={w.totals}
                currency={w.values.currency}
                issuesByStep={w.validationByStep}
                onSubmit={w.handleReviewSubmit}
              />
            )}
          </form>
        </div>
      </div>
      <CreateBottomBar
        currentStep={w.currentStep}
        currentStepIndex={w.currentStepIndex}
        isPending={w.isSubmitting}
        submitDisabled={w.blocked}
        submitLabel={submitLabel}
        pendingLabel={isEdit ? L.draftEdit.saving : L.creating}
        onBack={w.goBack}
        onNext={() => void w.goNext()}
        onSubmit={w.handleReviewSubmit}
      />
      <ConfirmDialog
        open={w.confirmOpen}
        onOpenChange={w.setConfirmOpen}
        title={submitLabel}
        description={
          isEdit
            ? L.draftEdit.confirmDescription(w.values.lines.length, total)
            : L.createConfirmDescription(w.values.lines.length, total)
        }
        confirmLabel={submitLabel}
        variant="default"
        loading={w.isSubmitting}
        onConfirm={w.handleConfirmCreate}
      />
      {/* Màn sửa không có đường đổi NCC (BR-07) nên dialog không bao giờ mở ở đó. */}
      {!isEdit && <SupplierChangeDialog w={w} />}
    </>
  );
}
