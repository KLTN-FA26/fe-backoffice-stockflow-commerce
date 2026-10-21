"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { categoryName, taxClassLabel } from "../../selectors";
import { MatrixPreviewBox } from "../MatrixPreviewBox";

import type { MatrixPreview } from "../../axes-draft";
import type { BrandDto, ProductDraftFormValues } from "../../schemas";
import type { Category } from "../../types";
import type { ProductWizard } from "./useProductWizard";

const L = UI_LABELS.product;

/** Bước rà soát: tóm tắt thông tin + checklist lỗi theo bước + ma trận sẽ tạo. */
export function ProductReviewStep({
  wizard,
  values,
  brands,
  categories,
  isEditing,
  matrix,
}: {
  wizard: ProductWizard;
  values: ProductDraftFormValues;
  brands: readonly BrandDto[];
  categories: readonly Category[];
  isEditing: boolean;
  /** Ma trận của các trục đã chọn; `null` = không chọn trục (một biến thể mặc định). */
  matrix: MatrixPreview | null;
}) {
  const items: [string, string, boolean?][] = [
    // Mã hiện viết hoa như BE lưu (`ProductWebMapper`: code.toUpperCase()) và như SKU xem trước
    [L.wizard.fields.productCode, values.productCode.trim().toUpperCase() || "—", true],
    [L.wizard.fields.name, values.name || "—"],
    [L.edit.fields.nameEn, values.nameEn || "—"],
    [
      L.edit.fields.categoryId,
      values.categoryId ? categoryName(values.categoryId, categories) : "—",
    ],
    [L.edit.fields.brandId, brands.find((b) => b.brandId === values.brandId)?.name ?? "—"],
    [L.edit.fields.taxClass, taxClassLabel(values.taxClass)],
    [
      L.wizard.fields.kind,
      values.customizable ? L.wizard.kind.customizable : L.wizard.kind.standard,
    ],
  ];
  return (
    <section className="border-border-default bg-bg-surface space-y-4 rounded-[var(--r-sm)] border p-4">
      <div>
        <h2 className="text-ink-primary text-sm font-semibold">
          {isEditing ? "Rà soát trước khi lưu" : "Rà soát trước khi tạo"}
        </h2>
        <p className="text-ink-secondary mt-1 text-xs">
          {isEditing
            ? "Chỉ lưu thông tin chung và mô tả; sản phẩm vẫn ở trạng thái Draft."
            : "Sản phẩm được tạo ở trạng thái Draft; biến thể ở trạng thái Nháp."}
        </p>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([label, value, mono]) => (
          <div
            key={label}
            className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2"
          >
            <dt className="text-ink-tertiary text-xs">{label}</dt>
            <dd
              className={cn(
                "text-ink-primary mt-1 truncate text-[0.8125rem] font-medium",
                mono && "font-[family-name:var(--font-mono)]",
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <ul className="space-y-1 text-[0.8125rem]">
        {wizard.steps
          .filter((s) => s.key !== "review")
          .map((step) => {
            const issues = wizard.issues.get(step.key) ?? [];
            return (
              <li
                key={step.key}
                className={cn(
                  "flex items-start gap-2",
                  issues.length ? "text-danger" : "text-ink-secondary",
                )}
              >
                {issues.length ? (
                  <CircleAlert className="mt-0.5 size-3.5" />
                ) : (
                  <CheckCircle2 className="text-positive mt-0.5 size-3.5" />
                )}
                <span>
                  {step.label}
                  {issues.length > 0 && `: ${issues.join("; ")}`}
                </span>
              </li>
            );
          })}
      </ul>
      {isEditing ? (
        <p className="text-ink-tertiary text-[0.8125rem]">
          Trục biến thể và SKU không đổi ở đây — sửa ở trang chi tiết sản phẩm.
        </p>
      ) : matrix ? (
        <MatrixPreviewBox preview={matrix} />
      ) : (
        <p className="text-ink-tertiary text-[0.8125rem]">
          Không có trục — tạo một biến thể mặc định với SKU = mã sản phẩm.
        </p>
      )}
    </section>
  );
}
