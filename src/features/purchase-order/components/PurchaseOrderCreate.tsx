"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { formatMoney } from "@/features/purchase-order";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { CreateBottomBar } from "./create/CreateBottomBar";
import { CreateStepper } from "./create/CreateStepper";
import { InfoStep } from "./create/InfoStep";
import { LinesStep } from "./create/LinesStep";
import { ReviewStep } from "./create/ReviewStep";
import { TotalsStep } from "./create/TotalsStep";
import { STEPS } from "./create/types";
import { useCreateForm } from "./create/useCreateForm";

export function PurchaseOrderCreate() {
  const f = useCreateForm();
  const idx = STEPS.findIndex((s) => s.key === f.currentStep);
  const curIssues = f.issuesByStep.get(f.currentStep) ?? [];
  const showErrors = f.submitAttempted || f.currentStep === "review";
  const displayCurrency = f.form.currency || f.selectedSupplier?.currency || "VND";
  const goNext = () => f.setCurrentStep(STEPS[Math.min(idx + 1, STEPS.length - 1)]!.key);
  const goBack = () => f.setCurrentStep(STEPS[Math.max(idx - 1, 0)]!.key);
  const stepStatus = (k: (typeof STEPS)[number]["key"]) => {
    if ((f.issuesByStep.get(k) ?? []).length > 0 && f.submitAttempted) return "error" as const;
    if (STEPS.findIndex((s) => s.key === k) < idx) return "done" as const;
    if (k === f.currentStep) return "active" as const;
    return "idle" as const;
  };
  const onSubmitAttempt = () => {
    f.setSubmitAttempted(true);
    if (f.validationIssues.length > 0) {
      f.setCurrentStep(f.validationIssues[0]!.step);
      return;
    }
    f.handleSubmitAttempt();
  };

  if (f.isLoading) return <PageSkeleton variant="form" />;
  return (
    <>
      <PageHeader
        title="Tạo đơn đặt hàng"
        subtitle="Khai báo Purchase Order từ nhà cung cấp, thêm dòng SKU và gửi vào luồng duyệt."
        actions={
          <Link
            href={ADMIN_ROUTES.purchaseOrders.list}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Quay lại danh sách
          </Link>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <CreateStepper
          stepStatus={stepStatus}
          lineCount={f.form.lines.length}
          onStepChange={f.setCurrentStep}
        />
        <div className="min-w-0 space-y-4 pb-24">
          {showErrors && curIssues.length > 0 && (
            <div className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]">
              <div className="font-semibold">Cần xử lý trước khi tạo PO</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {curIssues.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {f.currentStep === "info" && (
            <InfoStep
              form={f.form}
              activeSuppliers={f.activeSuppliers}
              selectedSupplier={f.selectedSupplier ?? undefined}
              showErrors={showErrors}
              onSupplierChange={f.handleSupplierChange}
              update={f.update}
            />
          )}
          {f.currentStep === "lines" && (
            <LinesStep
              form={f.form}
              activeSkus={f.activeSkus}
              showErrors={showErrors}
              currency={displayCurrency}
              onAddLine={f.addLine}
              onRemoveLine={f.removeLine}
              onSkuChange={f.handleSkuChange}
              updateLine={f.updateLine}
            />
          )}
          {f.currentStep === "totals" && (
            <TotalsStep totals={f.totals} currency={displayCurrency} lines={f.form.lines} />
          )}
          {f.currentStep === "review" && (
            <ReviewStep
              form={f.form}
              selectedSupplier={f.selectedSupplier ?? undefined}
              totals={f.totals}
              currency={displayCurrency}
              issuesByStep={f.issuesByStep}
              purchaseOrders={f.purchaseOrders}
              onSubmit={onSubmitAttempt}
            />
          )}
        </div>
      </div>
      <CreateBottomBar
        currentStep={f.currentStep}
        currentStepIndex={idx}
        onBack={goBack}
        onNext={goNext}
        onSubmit={onSubmitAttempt}
      />
      <ConfirmDialog
        open={f.confirmOpen}
        onOpenChange={f.setConfirmOpen}
        title="Tạo đơn đặt hàng"
        description={`Xác nhận tạo PO với ${f.form.lines.length} dòng hàng, tổng ${formatMoney(f.totals.grandTotal, displayCurrency)}? PO sẽ được tạo ở trạng thái DRAFT.`}
        confirmLabel="Tạo PO"
        variant="default"
        onConfirm={() => f.handleConfirmSubmit(() => {})}
      />
    </>
  );
}
