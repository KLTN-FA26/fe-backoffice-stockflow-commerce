"use client";

import { Loader2, Plus, Save } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { Section } from "../primitives";
import { CountLinesTable } from "./CountLinesTable";
import { useCountLinesForm } from "./useCountLinesForm";

import type { GoodsReceipt, ReceivablePo } from "@/features/receipt/types";

/**
 * Kiểm đếm phiếu DRAFT (docs 03 bước 3–5): mỗi dòng = một dòng PO × một lô, tách lô bằng "Tách
 * lô" (chuyển 1 đơn vị sang dòng mới). Lưu = `PUT /goods-receipts/{id}/lines` thay toàn bộ. Lỗi zod / @Valid hiện ngay dưới ô;
 * lỗi nghiệp vụ BE (dung sai, lô, khu) hiện ở đầu form.
 */
export function CountLinesForm({
  receipt,
  po,
  onDirtyChange,
  onSaved,
  onCancel,
}: {
  receipt: GoodsReceipt;
  po: ReceivablePo;
  onDirtyChange: (dirty: boolean) => void;
  onSaved?: () => void;
  /** Có = phiếu đã có kết quả lưu → cho bỏ sửa, quay về kết quả. */
  onCancel?: () => void;
}) {
  const {
    form,
    fields,
    append,
    split,
    remove,
    save,
    serverError,
    clearServerError,
    isDirty,
    watched,
    overOpen,
    poLineById,
    missingPoLines,
    submit,
    blankFor,
  } = useCountLinesForm(receipt, po, onDirtyChange, onSaved);

  return (
    <Section
      title="Kiểm đếm"
      description="Nhập SL thực nhận theo từng lô và mã khu nhận hàng. Lưu trước khi xác nhận nhập kho."
      actions={
        <>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={save.isPending}
            >
              {UI_LABELS.receipt.cancelEdit}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={save.isPending || (receipt.lines.length > 0 && !isDirty)}
            className="rounded-[var(--r-sm)]"
          >
            {save.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            {UI_LABELS.receipt.action.saveLines}
          </Button>
        </>
      }
    >
      {serverError && (
        <div className="mb-3" role="alert">
          <Alert tone="danger">{serverError}</Alert>
        </div>
      )}
      {form.formState.errors.lines?.root?.message && (
        <p role="alert" className="text-danger mb-2 text-xs">
          {form.formState.errors.lines.root.message}
        </p>
      )}
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        // Sửa ô bất kỳ → lỗi server cũ không còn đúng
        onChange={clearServerError}
      >
        <CountLinesTable
          receiptNumber={receipt.number}
          rowIds={fields.map((field) => field.id)}
          lines={watched}
          poLineById={poLineById}
          overOpen={overOpen}
          register={form.register}
          errors={form.formState.errors.lines}
          onSplit={split}
          onRemove={remove}
        />
        {/* Enter trong ô nhập = lưu (thao tác không cần chuột) */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
      {missingPoLines.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {missingPoLines.map((l) => (
            <Button
              key={l.lineId}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(blankFor(l.lineId, l.openQuantity))}
            >
              <Plus className="size-3.5" /> Thêm dòng {l.sku}
            </Button>
          ))}
        </div>
      )}
    </Section>
  );
}
