"use client";

import { Plus } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { Button } from "@/components/ui/button";

import { useAttributes } from "../attribute-queries";
import { axesDraftIssue, previewMatrix } from "../axes-draft";
import { MATRIX_MAX_PER_CALL } from "../axes-schemas";
import { AxesPicker } from "./AxesPicker";
import { useCategoryAxisPrefill } from "./useCategoryAxisPrefill";

import type { AxisDraft } from "../axes-draft";

/** Có chặn tạo sản phẩm không, và vì sao — dùng chung với nút lưu của form. */
export function createAxesIssue(
  drafts: readonly AxisDraft[],
  preview: ReturnType<typeof previewMatrix>,
): string | null {
  if (drafts.length === 0) return null;
  const issue = axesDraftIssue(drafts);
  if (issue) return issue;
  if (preview.overCap) {
    return `Ma trận có ${preview.total} biến thể — tối đa ${MATRIX_MAX_PER_CALL} khi tạo sản phẩm. Bỏ bớt giá trị của một trục.`;
  }
  if (preview.anyTooLong) {
    return "Có SKU sinh ra dài quá 64 ký tự — rút ngắn mã sản phẩm hoặc bỏ bớt giá trị có mã dài.";
  }
  return null;
}

/**
 * Chọn trục biến thể ngay khi tạo sản phẩm (BE PR #116 `CreateProductRequest.axes`): BE tạo sản phẩm
 * cùng MỌI tổ hợp giá trị trong một lần gọi — SKU `MÃ-GIÁ_TRỊ-…` theo thứ tự trục, tổ hợp đầu tiên là
 * biến thể mặc định, mọi biến thể ở trạng thái Nháp. Bị từ chối (SKU trùng, quá 100 tổ hợp…) thì không
 * có sản phẩm nào được tạo. Bỏ trống: sản phẩm có một biến thể mặc định, SKU = mã sản phẩm.
 * Danh mục có bộ thuộc tính gợi ý → điền sẵn trục bắt buộc và nút thêm nhanh trục gợi ý (spec D9).
 */
export function ProductAxesFields({
  productCode,
  categoryId,
  value,
  onChange,
}: {
  productCode: string;
  categoryId: string;
  value: AxisDraft[];
  onChange: (next: AxisDraft[]) => void;
}) {
  const dictionary = useAttributes({ active: true });
  const attributes = dictionary.data?.items ?? [];
  const preview = previewMatrix(value, attributes, productCode || "MÃ");
  const issue = createAxesIssue(value, preview);
  const suggested = useCategoryAxisPrefill({
    categoryId,
    enabled: dictionary.isSuccess,
    value,
    onChange,
  });
  const required = suggested.filter((s) => s.required).map((s) => s.attributeName);
  // Thêm nhanh: trục gợi ý chưa chọn và có trong từ điển (AxesPicker cần giá trị của thuộc tính)
  const quickAdd = suggested.filter(
    (s) =>
      !value.some((axis) => axis.attributeId === s.attributeId) &&
      attributes.some((a) => a.attributeId === s.attributeId),
  );

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4">
      <h2 className="text-ink-primary text-sm font-semibold">Trục biến thể (tuỳ chọn)</h2>
      <p className="text-ink-secondary mt-1 text-xs">
        Chọn thuộc tính (màu, cỡ…) và các giá trị để tạo sẵn mọi biến thể cùng lúc. Bỏ trống thì sản
        phẩm chỉ có một biến thể mặc định, thêm trục sau khi tạo.
      </p>
      <div className="mt-4 space-y-3">
        {dictionary.isLoading ? (
          <p className="text-ink-tertiary text-xs">Đang tải từ điển thuộc tính…</p>
        ) : dictionary.isError ? (
          <p role="alert" className="text-warning text-xs">
            Không tải được từ điển thuộc tính (cần quyền xem thuộc tính) — vẫn tạo được sản phẩm
            không kèm trục.
          </p>
        ) : (
          <AxesPicker attributes={attributes} value={value} onChange={onChange} />
        )}
        {required.length > 0 && (
          <p className="text-ink-tertiary text-xs">
            {UI_LABELS.product.create.prefilled(required)}
          </p>
        )}
        {quickAdd.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-secondary">{UI_LABELS.product.create.quickAdd}</span>
            {quickAdd.map((s) => (
              <Button
                key={s.attributeId}
                type="button"
                variant="outline"
                size="xs"
                className="rounded-[var(--r-sm)]"
                onClick={() =>
                  onChange([...value, { attributeId: s.attributeId, optionValueIds: [] }])
                }
              >
                <Plus className="size-3" /> {s.attributeName}
              </Button>
            ))}
          </div>
        )}
        {value.length > 0 && preview.total > 0 && (
          <div className="border-border-default bg-bg-subtle space-y-1 rounded-[var(--r-sm)] border p-3 text-[0.8125rem]">
            <p>
              Sẽ tạo{" "}
              <span className="text-ink-primary font-medium tabular-nums">{preview.total}</span>{" "}
              biến thể (Nháp)
            </p>
            {preview.samples.length > 0 && (
              <ul className="text-ink-secondary space-y-0.5 text-xs">
                {preview.samples.map((s) => (
                  <li key={s.sku}>
                    <span className="text-ink-primary font-[family-name:var(--font-mono)]">
                      {s.sku}
                    </span>{" "}
                    — {s.label}
                    {s.tooLong && <span className="text-danger"> (SKU quá dài)</span>}
                  </li>
                ))}
                {preview.total > preview.samples.length && <li>…</li>}
              </ul>
            )}
          </div>
        )}
        {issue && (
          <p role="alert" className="text-danger text-xs">
            {issue}
          </p>
        )}
      </div>
    </section>
  );
}
