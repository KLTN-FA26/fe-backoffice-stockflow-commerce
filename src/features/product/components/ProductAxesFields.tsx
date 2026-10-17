"use client";

import { useAttributes } from "../attribute-queries";
import { axesDraftIssue, previewMatrix } from "../axes-draft";
import { MATRIX_MAX_PER_CALL } from "../axes-schemas";
import { AxesPicker } from "./AxesPicker";

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
 */
export function ProductAxesFields({
  productCode,
  value,
  onChange,
}: {
  productCode: string;
  value: AxisDraft[];
  onChange: (next: AxisDraft[]) => void;
}) {
  const dictionary = useAttributes({ active: true });
  const attributes = dictionary.data?.items ?? [];
  const preview = previewMatrix(value, attributes, productCode || "MÃ");
  const issue = createAxesIssue(value, preview);

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
