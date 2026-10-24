"use client";

import { Card } from "@/components/shared/Card";
import { StatusDot } from "@/components/shared/StatusDot";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { SupplierFormSteps } from "./supplier-form/SupplierFormSteps";
import { useSupplierWizard } from "./supplier-form/useSupplierWizard";
import { STEPS } from "./supplier-form/wizard-constants";
import { WizardBottomBar } from "./supplier-form/WizardBottomBar";
import { WizardSidebar } from "./supplier-form/WizardSidebar";

import type { SupplierDto } from "@/features/supplier/types";

export function SupplierForm({ existingSupplier }: { existingSupplier?: SupplierDto }) {
  const w = useSupplierWizard(existingSupplier);

  return (
    // Giao diện kiểu Vercel như wizard sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có tên trang và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">
        {w.isEdit ? `Chỉnh sửa NCC — ${existingSupplier?.name}` : "Tạo nhà cung cấp mới"}
      </h1>
      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <Card className="h-fit p-0">
          <div className="border-b border-(--table-line) px-4 py-3">
            <div className="text-ink-tertiary text-xs font-semibold tracking-[0.08em] uppercase">
              Quy trình
            </div>
            <div className="mt-1 flex items-center gap-2">
              <StatusDot domain="sku" status="Active" size="sm" withIcon />
              <span className="text-ink-tertiary text-xs">
                {w.isEdit ? "Chỉnh sửa" : "Tạo mới"}
              </span>
            </div>
          </div>
          <WizardSidebar
            stepStatus={w.stepStatus}
            canGoTo={w.canGoTo}
            onStepChange={w.goToStep}
            isEdit={w.isEdit}
          />
        </Card>

        <div className="min-w-0 space-y-4 pb-24">
          {w.showErrors && w.currentStepIssues.length > 0 && (
            <div className="border-danger/30 bg-danger/5 text-danger rounded-(--section-radius) border px-4 py-3 text-[0.8125rem]">
              <div className="font-semibold">Cần xử lý trước khi lưu</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {w.currentStepIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          <form onSubmit={w.handleSubmit(w.onSubmit)} className="space-y-4">
            <SupplierFormSteps w={w} />
          </form>
        </div>
      </div>

      <WizardBottomBar
        currentStepIndex={w.currentStepIndex}
        currentStep={w.currentStep}
        steps={STEPS}
        isPending={w.isPending}
        isEdit={w.isEdit}
        onBack={w.goBack}
        onNext={() => void w.goNext()}
        onSubmit={w.handleReviewSubmit}
      />

      {!w.isEdit && (
        <ConfirmDialog
          open={w.confirmOpen}
          onOpenChange={w.setConfirmOpen}
          title="Tạo nhà cung cấp?"
          description={`Xác nhận tạo NCC "${w.watchedValues.name || "(chưa đặt tên)"}" (mã ${w.watchedValues.code || "—"}, MST ${w.watchedValues.taxCode || "—"})?`}
          confirmLabel="Tạo nhà cung cấp"
          variant="default"
          loading={w.isPending}
          onConfirm={w.handleConfirmCreate}
        />
      )}
    </div>
  );
}
