"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ADMIN_ROUTES, PO_PERMISSIONS, UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { CreateBottomBar } from "./create/CreateBottomBar";
import { StepIssues } from "./create/CreateFormPrimitives";
import { CreateStepper } from "./create/CreateStepper";
import { InfoStep } from "./create/InfoStep";
import { LinesStep } from "./create/LinesStep";
import { ReviewStep } from "./create/ReviewStep";
import { TotalsStep } from "./create/TotalsStep";
import { useCreateForm } from "./create/useCreateForm";
import { PoPermissionGate } from "./PoPermissionGate";

export function PurchaseOrderCreate() {
  return (
    <PoPermissionGate permissions={[PO_PERMISSIONS.viewPage, PO_PERMISSIONS.create]} variant="form">
      <PurchaseOrderCreateBody />
    </PoPermissionGate>
  );
}

/** Cùng bố cục + luồng wizard tạo NCC (`SupplierForm`): stepper trái, nội dung bước, thanh dưới. */
function PurchaseOrderCreateBody() {
  const w = useCreateForm();

  if (w.suppliersQuery.isPending) return <PageSkeleton variant="form" />;
  return (
    <>
      <PageHeader
        title={UI_LABELS.purchaseOrder.createAction}
        subtitle="Chọn nhà cung cấp, thêm dòng SKU — PO được tạo ở trạng thái Nháp, duyệt ở màn chi tiết."
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
          stepStatus={w.stepStatus}
          canGoTo={w.canGoTo}
          lineCount={w.values.lines.length}
          onStepChange={w.goToStep}
        />
        <div className="min-w-0 space-y-4 pb-24">
          {w.suppliersQuery.isError && (
            <Alert tone="danger" title="Không tải được danh sách nhà cung cấp">
              Cần quyền xem nhà cung cấp để chọn NCC cho đơn.{" "}
              <Button variant="link" size="sm" onClick={() => void w.suppliersQuery.refetch()}>
                {UI_LABELS.common.retry}
              </Button>
            </Alert>
          )}
          {w.showErrors && <StepIssues issues={w.currentStepIssues} />}
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
            {w.currentStep === "info" && <InfoStep w={w} />}
            {w.currentStep === "lines" && <LinesStep w={w} />}
            {w.currentStep === "totals" && (
              <TotalsStep totals={w.totals} currency={w.values.currency} lines={w.values.lines} />
            )}
            {w.currentStep === "review" && (
              <ReviewStep
                form={w.values}
                suggestedDate={w.suggestedDate}
                selectedSupplier={w.selectedSupplier}
                warehouseName={
                  w.warehouses.find((wh) => wh.warehouseId === w.values.warehouseId)?.name
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
        onBack={w.goBack}
        onNext={() => void w.goNext()}
        onSubmit={w.handleReviewSubmit}
      />
      <ConfirmDialog
        open={w.confirmOpen}
        onOpenChange={w.setConfirmOpen}
        title={UI_LABELS.purchaseOrder.createAction}
        description={`Xác nhận tạo PO với ${w.values.lines.length} dòng hàng, tổng ${formatMoney(w.totals.grandTotal, w.values.currency)}? PO được tạo ở trạng thái Nháp.`}
        confirmLabel={UI_LABELS.purchaseOrder.createAction}
        variant="default"
        loading={w.isSubmitting}
        onConfirm={w.handleConfirmCreate}
      />
    </>
  );
}
