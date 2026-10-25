"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "cn";

import { PO_LIMITS, UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";
import { Card } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { CatalogNotice } from "./CatalogNotice";
import { FieldError, SummaryItem } from "./CreateFormPrimitives";
import { createEmptyLine } from "./helpers";
import { PoLineCard } from "./PoLineCard";

import type { CreatePoWizard } from "./useCreateForm";

const S = UI_LABELS.purchaseOrder.linesStep;
const D = UI_LABELS.purchaseOrder.draftEdit;

/** Bước 2 — dòng hàng (`useFieldArray`, api-conventions §4). Lỗi từng ô hiện inline. */
export function LinesStep({ w }: { w: CreatePoWizard }) {
  const { fields, append, remove } = w.lines;
  const rootError = w.errors.lines?.root?.message ?? w.errors.lines?.message;
  // Chỉ màn sửa nháp có trần (BE `UpdatePurchaseOrderRequest.lines` @Size(max = 200)).
  const atLimit = w.mode === "edit" && fields.length >= PO_LIMITS.linesMax;
  // Sửa nháp thiếu quyền đọc danh mục NCC: không chọn được SKU cho dòng mới → khoá thêm dòng.
  const noCatalog = w.mode === "edit" && !w.catalog.canRead;
  const cannotAdd = atLimit || noCatalog;
  // Không thêm lại được dòng đã lưu khi thiếu quyền danh mục → hỏi trước khi xoá. Giữ `removing` sau
  // khi đóng để nội dung hộp không đổi trong lúc animation đóng.
  const [removing, setRemoving] = useState<{ index: number; sku: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const requestRemove = (index: number) => {
    const line = w.values.lines[index];
    if (!noCatalog || !line || line.lineId === "") return remove(index);
    setRemoving({ index, sku: line.skuId });
    setConfirmRemove(true);
  };

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-ink-primary font-[family-name:var(--font-display)] text-[1rem] font-semibold">
            {S.title}
          </h2>
          <p className="text-ink-secondary mt-1 text-[0.8125rem]">
            {noCatalog
              ? S.editDescriptionNoCatalog
              : w.mode === "edit"
                ? S.editDescription
                : S.description}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(createEmptyLine())}
          disabled={cannotAdd}
          className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
        >
          <Plus className="size-3.5" />
          {S.add}
        </Button>
      </div>

      <CatalogNotice w={w} className="mb-3" />
      {atLimit && (
        <p className="text-warning mb-3 text-[0.8125rem]" role="status">
          {UI_LABELS.purchaseOrder.draftEdit.linesLimit(PO_LIMITS.linesMax)}
        </p>
      )}

      {fields.length === 0 ? (
        <div
          className={cn(
            "rounded-[var(--r-sm)] border px-4 py-8 text-center text-[0.8125rem]",
            rootError
              ? "border-danger/30 bg-danger/5 text-danger"
              : "border-border-default bg-bg-subtle text-ink-tertiary",
          )}
        >
          {w.mode === "edit"
            ? UI_LABELS.purchaseOrder.draftEdit.linesEmpty
            : UI_LABELS.purchaseOrder.linesEmpty}
        </div>
      ) : (
        <div className="max-h-[min(58vh,520px)] space-y-3 overflow-y-auto pr-1">
          {fields.map((field, index) => (
            <PoLineCard key={field.id} w={w} index={index} onRemove={() => requestRemove(index)} />
          ))}
        </div>
      )}
      {fields.length > 0 && <FieldError>{rootError}</FieldError>}

      {/* BE chưa có thuế / chiết khấu → tạm tính = tổng, chỉ hiện một số. */}
      <div className="bg-bg-surface border-border-default sticky bottom-0 mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
        <SummaryItem label={UI_LABELS.purchaseOrder.lineCount} value={String(fields.length)} mono />
        <SummaryItem
          label={UI_LABELS.purchaseOrder.grandTotal}
          value={formatMoney(w.totals.grandTotal, w.values.currency)}
          mono
        />
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={D.removeSavedLineTitle}
        description={D.removeSavedLineDescription(removing?.sku ?? "")}
        confirmLabel={D.removeSavedLineConfirm}
        // ConfirmDialog tự đóng sau khi xác nhận (`closeOnConfirm` mặc định)
        onConfirm={() => removing && remove(removing.index)}
      />
    </Card>
  );
}
