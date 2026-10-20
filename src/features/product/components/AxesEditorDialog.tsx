"use client";

import { useMemo, useState } from "react";

import { UI_LABELS } from "@/constants";

import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { attributeErrorMessage } from "../attribute-errors";
import { useAttributes } from "../attribute-queries";
import { axesDraftIssue, toAxisInputs } from "../axes-draft";
import { useProductAttributes, useReplaceProductAxes } from "../variant-queries";
import { AxesPicker } from "./AxesPicker";

import type { AxisDraft } from "../axes-draft";
import type { ProductAttributes } from "../axes-schemas";

/**
 * Sửa trục biến thể của sản phẩm (BE `PUT /products/{id}/axes` — cả danh sách thay thế toàn bộ).
 * Thêm / gỡ trục chỉ khi sản phẩm còn Nháp và chưa biến thể nào mang tuỳ chọn; thêm / bớt giá trị của
 * trục đã có thì mở, trừ giá trị đang được biến thể dùng.
 */
export function AxesEditorDialog({
  productId,
  isDraft,
  open,
  onOpenChange,
}: {
  productId: string;
  /** Sản phẩm còn Nháp: mới thêm / gỡ trục được (BE `PRODUCT_AXES_LOCKED`). */
  isDraft: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <AxesForm productId={productId} isDraft={isDraft} onDone={() => onOpenChange(false)} />
      )}
    </FormDialog>
  );
}

function AxesForm({
  productId,
  isDraft,
  onDone,
}: {
  productId: string;
  isDraft: boolean;
  onDone: () => void;
}) {
  const attributesQuery = useProductAttributes(productId);
  const dictionary = useAttributes({});
  if (attributesQuery.isSuccess && dictionary.isSuccess) {
    return (
      <AxesFormBody
        productId={productId}
        isDraft={isDraft}
        current={attributesQuery.data}
        attributes={dictionary.data.items}
        onDone={onDone}
      />
    );
  }
  return (
    <FormDialogBody
      title="Trục biến thể"
      description={
        attributesQuery.isError || dictionary.isError
          ? "Không tải được thuộc tính của sản phẩm hoặc từ điển thuộc tính (cần quyền xem thuộc tính)."
          : "Đang tải…"
      }
      submitLabel="Lưu"
      canSubmit={false}
      isPending={false}
      error={null}
      onSubmit={onDone}
      onCancel={onDone}
    />
  );
}

function AxesFormBody({
  productId,
  isDraft,
  current,
  attributes,
  onDone,
}: {
  productId: string;
  isDraft: boolean;
  current: ProductAttributes;
  attributes: React.ComponentProps<typeof AxesPicker>["attributes"];
  onDone: () => void;
}) {
  const [drafts, setDrafts] = useState<AxisDraft[]>(() =>
    current.axes.map((axis) => ({
      attributeId: axis.attributeId,
      optionValueIds: axis.options.map((o) => o.valueId),
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const save = useReplaceProductAxes();
  const usedValueIds = useMemo(
    () =>
      new Set(
        current.axes.flatMap((a) => a.options.filter((o) => o.usedByVariant).map((o) => o.valueId)),
      ),
    [current.axes],
  );
  const issue = axesDraftIssue(drafts);

  return (
    <FormDialogBody
      title="Trục biến thể"
      // Lý do khoá (rời Nháp / đã có biến thể dùng giá trị) do `AxesPicker` nói ngay trên danh sách trục
      description={UI_LABELS.product.axes.description}
      submitLabel="Lưu trục"
      canSubmit={issue === null}
      isPending={save.isPending}
      error={error ?? (drafts.length > 0 ? issue : null)}
      onSubmit={() => {
        setError(null);
        save.mutate(
          { productId, axes: toAxisInputs(drafts) },
          { onSuccess: onDone, onError: (e) => setError(attributeErrorMessage(e, "axes")) },
        );
      }}
      onCancel={onDone}
    >
      <DialogScrollArea>
        <AxesPicker
          attributes={attributes}
          value={drafts}
          onChange={setDrafts}
          excludeAttributeIds={current.descriptives.map((d) => d.attributeId)}
          structureLocked={!isDraft}
          addLocked={usedValueIds.size > 0}
          usedValueIds={usedValueIds}
        />
      </DialogScrollArea>
    </FormDialogBody>
  );
}
