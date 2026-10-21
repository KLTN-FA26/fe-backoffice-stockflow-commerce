"use client";

import { useMemo, useState } from "react";

import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Checkbox } from "@/components/ui/checkbox";

import { attributeErrorMessage } from "../attribute-errors";
import { comboKey, previewGeneration } from "../axes-draft";
import { MATRIX_MAX_PER_CALL } from "../axes-schemas";
import { useGenerateVariants, useProductAttributes, useVariants } from "../variant-queries";

import type { GeneratedVariants } from "../variant-schemas";

/**
 * "Sinh tổ hợp biến thể" (BE `POST /products/{id}/variants/generation`): tạo các biến thể còn thiếu của
 * ma trận trục × giá trị, mỗi tổ hợp một SKU `MÃ-GIÁ_TRỊ-…` ở trạng thái Nháp. BE không có chế độ xem
 * thử nên bản xem trước tính phía FE theo cùng quy tắc; kết quả thật (SKU, tên, số tổ hợp đã có) hiện
 * sau khi sinh. Tối đa 100 tổ hợp một lần; chạy lại là an toàn (tổ hợp đã có được bỏ qua).
 */
export function GenerateVariantsDialog({
  productId,
  productCode,
  open,
  onOpenChange,
}: {
  productId: string;
  productCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <Body productId={productId} productCode={productCode} onDone={() => onOpenChange(false)} />
      )}
    </FormDialog>
  );
}

function Body({
  productId,
  productCode,
  onDone,
}: {
  productId: string;
  productCode: string;
  onDone: () => void;
}) {
  const attributes = useProductAttributes(productId);
  const variants = useVariants(productId);
  const generate = useGenerateVariants();
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedVariants | null>(null);
  const axes = attributes.data?.axes;

  const selection = useMemo(
    () =>
      new Map(
        (axes ?? []).map((axis) => [
          axis.attributeId,
          new Set(
            axis.options.filter((o) => o.active && !excluded.has(o.valueId)).map((o) => o.valueId),
          ),
        ]),
      ),
    [axes, excluded],
  );
  const existing = useMemo(
    () =>
      new Set(
        (variants.data ?? [])
          .filter((v) => v.options.length > 0)
          .map((v) => comboKey(v.options.map((o) => o.valueId))),
      ),
    [variants.data],
  );
  // Biến thể mặc định còn Nháp và chưa mang tuỳ chọn: nhận tổ hợp đầu tiên, giữ SKU của nó (BE `isUnassigned`).
  const unassignedDefault = (variants.data ?? []).find(
    (v) => v.defaultVariant && v.options.length === 0 && v.status === "DRAFT",
  );
  const preview = useMemo(
    () => previewGeneration(axes ?? [], selection, existing, productCode, unassignedDefault?.sku),
    [axes, selection, existing, productCode, unassignedDefault?.sku],
  );
  const emptyAxis = (axes ?? []).some((axis) => (selection.get(axis.attributeId)?.size ?? 0) === 0);

  if (result) {
    return (
      <FormDialogBody
        title="Đã sinh biến thể"
        description={`Tạo ${result.created.length} biến thể mới (Nháp); ${result.skipped} tổ hợp đã có nên được bỏ qua.`}
        submitLabel="Đóng"
        hideCancel
        canSubmit
        isPending={false}
        error={null}
        onSubmit={onDone}
        onCancel={onDone}
      >
        {result.created.length > 0 && (
          <ul className="border-border-default divide-border-default max-h-60 divide-y overflow-auto rounded-[var(--r-sm)] border text-[0.8125rem]">
            {result.created.map((v) => (
              <li key={v.variantId} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
                  {v.sku}
                </span>
                <span className="text-ink-secondary truncate">{v.name}</span>
              </li>
            ))}
          </ul>
        )}
      </FormDialogBody>
    );
  }

  const blocked = preview.overCap || emptyAxis || preview.toCreate === 0;
  return (
    <FormDialogBody
      title="Sinh tổ hợp biến thể"
      description="Tạo biến thể cho mọi tổ hợp giá trị của các trục mà sản phẩm chưa có. Bỏ chọn giá trị để không sinh tổ hợp chứa nó."
      submitLabel={`Sinh ${preview.toCreate} biến thể`}
      canSubmit={attributes.isSuccess && !blocked}
      isPending={generate.isPending}
      error={error}
      onSubmit={() => {
        setError(null);
        // Chỉ gửi các trục bị hạn chế; trục để nguyên dùng mọi giá trị đang dùng.
        const restricted = Object.fromEntries(
          (axes ?? [])
            .filter(
              (axis) =>
                (selection.get(axis.attributeId)?.size ?? 0) <
                axis.options.filter((o) => o.active).length,
            )
            .map((axis) => [axis.attributeId, [...(selection.get(axis.attributeId) ?? [])]]),
        );
        generate.mutate(
          { productId, optionValueIds: restricted },
          { onSuccess: setResult, onError: (e) => setError(attributeErrorMessage(e, "generate")) },
        );
      }}
      onCancel={onDone}
    >
      <DialogScrollArea>
        {attributes.isLoading && (
          <p className="text-ink-tertiary text-xs">Đang tải trục của sản phẩm…</p>
        )}
        {attributes.isError && (
          <p role="alert" className="text-danger text-xs">
            {attributeErrorMessage(attributes.error, "load")}
          </p>
        )}
        {(axes ?? []).map((axis) => (
          <fieldset key={axis.attributeId} className="space-y-1.5">
            <legend className="text-ink-secondary text-xs font-medium">{axis.name}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {axis.options
                .filter((o) => o.active)
                .map((o) => (
                  <label
                    key={o.valueId}
                    className="text-ink-secondary flex items-center gap-1.5 text-xs"
                  >
                    <Checkbox
                      checked={!excluded.has(o.valueId)}
                      onCheckedChange={(checked) =>
                        setExcluded((prev) => {
                          const next = new Set(prev);
                          if (checked === true) next.delete(o.valueId);
                          else next.add(o.valueId);
                          return next;
                        })
                      }
                    />
                    {o.label}
                  </label>
                ))}
            </div>
          </fieldset>
        ))}
        {attributes.isSuccess && (
          <div className="border-border-default bg-bg-subtle space-y-1.5 rounded-[var(--r-sm)] border p-3 text-[0.8125rem]">
            <p>
              <span className="tabular-nums">{preview.total}</span> tổ hợp ·{" "}
              <span className="tabular-nums">{preview.existing}</span> đã có ·{" "}
              <span className="text-ink-primary font-medium tabular-nums">{preview.toCreate}</span>{" "}
              sẽ tạo mới
            </p>
            {emptyAxis && (
              <p className="text-warning text-xs">Mỗi trục cần ít nhất một giá trị được chọn.</p>
            )}
            {preview.overCap && (
              <p role="alert" className="text-danger text-xs">
                Tối đa {MATRIX_MAX_PER_CALL} biến thể mỗi lần sinh — bỏ bớt giá trị của một trục.
              </p>
            )}
            {!emptyAxis && !preview.overCap && preview.toCreate === 0 && (
              <p className="text-ink-tertiary text-xs">Mọi tổ hợp đã có biến thể.</p>
            )}
            {preview.samples.length > 0 && (
              <ul className="text-ink-secondary space-y-0.5 text-xs">
                {preview.samples.map((s) => (
                  <li key={s.sku}>
                    <span className="text-ink-primary font-[family-name:var(--font-mono)]">
                      {s.sku}
                    </span>{" "}
                    — {s.label}
                    {s.keptDefault && (
                      <span className="text-ink-tertiary"> (biến thể mặc định, giữ SKU)</span>
                    )}
                  </li>
                ))}
                {preview.toCreate > preview.samples.length && <li>…</li>}
              </ul>
            )}
            {preview.usesDefault && (
              <p className="text-ink-tertiary text-xs">
                Biến thể mặc định hiện chưa có tuỳ chọn sẽ nhận tổ hợp đầu tiên (giữ nguyên SKU của
                nó) — tổ hợp này vẫn tính vào giới hạn {MATRIX_MAX_PER_CALL}.
              </p>
            )}
          </div>
        )}
      </DialogScrollArea>
    </FormDialogBody>
  );
}
