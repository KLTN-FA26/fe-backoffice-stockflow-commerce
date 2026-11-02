"use client";

import { ProductReviewStep } from "./create/ProductReviewStep";
import { ProductWizardBottomBar } from "./create/ProductWizardBottomBar";
import { ProductWizardStepper } from "./create/ProductWizardStepper";
import { ProductAxesFields } from "./ProductAxesFields";
import { ProductDescriptionFields } from "./ProductDescriptionFields";
import { ProductFormServerAlert, ProductStepIssues } from "./ProductFormParts";
import { ProductMasterFields } from "./ProductMasterFields";

import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { AxisDraft, MatrixPreview } from "../axes-draft";
import type { BrandDto, ProductDraftFormValues } from "../schemas";
import type { Category } from "../types";
import type { ProductWizard } from "./create/useProductWizard";

const HEADER = {
  create: {
    title: "Tạo sản phẩm",
    subtitle:
      "Khai báo thông tin, mô tả và trục biến thể — lưu Product master ở trạng thái Draft cùng một biến thể mặc định, hoặc đủ ma trận nếu chọn trục.",
  },
  edit: {
    title: "Chỉnh sửa sản phẩm",
    subtitle:
      "Sửa thông tin chung và mô tả của sản phẩm Draft; trục biến thể sửa ở trang chi tiết.",
  },
} as const;

/**
 * Bố cục wizard sản phẩm — cùng kiểu PO / NCC: stepper trái, nội dung bước, thanh dưới cố định.
 * Các bước nhập liệu luôn được mount (chỉ ẩn bước không đứng) để giữ nguyên hành vi form một trang:
 * trục bắt buộc của danh mục vẫn điền sẵn ngay khi chọn danh mục ở bước đầu.
 */
export function ProductWizardView({
  wizard,
  form,
  isEditing,
  brands,
  categories,
  productCode,
  categoryId,
  axes,
  onAxesChange,
  matrix,
  serverMessage,
  isPending,
  onSubmit,
  confirmDialog,
}: {
  wizard: ProductWizard;
  form: UseFormReturn<ProductDraftFormValues>;
  isEditing: boolean;
  brands: readonly BrandDto[];
  categories: readonly Category[];
  /** Theo dõi (`useWatch`) ở trang — bước trục cần để xem trước SKU và điền sẵn trục của danh mục. */
  productCode: string;
  categoryId: string;
  axes: AxisDraft[];
  onAxesChange: (next: AxisDraft[]) => void;
  matrix: MatrixPreview | null;
  serverMessage: string | undefined;
  isPending: boolean;
  onSubmit: () => void;
  confirmDialog: ReactNode;
}) {
  const header = HEADER[isEditing ? "edit" : "create"];
  const step = wizard.currentStep;
  const summary = isEditing
    ? "Trục và SKU sửa ở trang chi tiết"
    : matrix
      ? `${matrix.total} SKU sẽ được tạo`
      : "1 biến thể mặc định";

  return (
    // Giao diện kiểu Vercel như trang danh sách / chi tiết (globals.css `.surface-soft`). Không hiện
    // tiêu đề — breadcrumb topbar đã có tên trang và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{header.title}</h1>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <ProductWizardStepper wizard={wizard} isEditing={isEditing} summary={summary} />
        <div className="min-w-0 space-y-4 pb-24">
          <ProductFormServerAlert message={serverMessage} />
          <ProductStepIssues issues={wizard.currentIssues} />
          {/* Enter trong ô nhập = "Tiếp tục" (mode-a: Enter submit); chỉ bước cuối mới gửi lên BE */}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (wizard.isLast) onSubmit();
              else void wizard.goNext();
            }}
          >
            <div hidden={step !== "info"}>
              <ProductMasterFields
                brands={brands}
                categories={categories}
                form={form}
                isEditing={isEditing}
              />
            </div>
            <div hidden={step !== "description"}>
              <ProductDescriptionFields form={form} />
            </div>
            {!isEditing && (
              <div hidden={step !== "axes"}>
                <ProductAxesFields
                  productCode={productCode}
                  categoryId={categoryId}
                  value={axes}
                  onChange={onAxesChange}
                />
              </div>
            )}
            {step === "review" && (
              <ProductReviewStep
                wizard={wizard}
                values={form.getValues()}
                brands={brands}
                categories={categories}
                isEditing={isEditing}
                matrix={matrix}
              />
            )}
            {/* Nút điều hướng ở thanh dưới; form nhiều ô cần một nút submit để Enter gửi form */}
            <button type="submit" tabIndex={-1} aria-hidden="true" className="sr-only" />
          </form>
        </div>
      </div>
      <ProductWizardBottomBar
        wizard={wizard}
        isEditing={isEditing}
        isPending={isPending}
        onSubmit={onSubmit}
      />
      {confirmDialog}
    </div>
  );
}
