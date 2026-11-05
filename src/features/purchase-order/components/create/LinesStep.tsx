"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";

import { PO_LIMITS, UI_LABELS } from "@/constants";
import { useAppStore } from "@/lib/store/use-app-store";
import { Card } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { CatalogNotice } from "./CatalogNotice";
import { FieldError } from "./CreateFormPrimitives";
import { createEmptyLine } from "./helpers";
import { LinesStepHeader } from "./LinesStepHeader";
import { LinesTotalsBar } from "./LinesTotalsBar";
import { PoLinesEditor } from "./PoLinesEditor";
import { SkuMultiPickDialog } from "./SkuMultiPickDialog";

import type { CreatePoWizard } from "./useCreateForm";

const D = UI_LABELS.purchaseOrder.draftEdit;

/** Bước 2 — bảng dòng hàng (`useFieldArray`, api-conventions §4). Lỗi từng ô hiện inline. */
export function LinesStep({ w }: { w: CreatePoWizard }) {
  const { fields, append, remove } = w.lines;
  const rootError = w.errors.lines?.root?.message ?? w.errors.lines?.message;
  // Chỉ màn sửa nháp có trần (BE `UpdatePurchaseOrderRequest.lines` @Size(max = 200)).
  const atLimit = w.mode === "edit" && fields.length >= PO_LIMITS.linesMax;
  // Sửa nháp thiếu quyền đọc danh mục NCC: không chọn được SKU cho dòng mới → khoá thêm dòng.
  const noCatalog = w.mode === "edit" && !w.catalog.canRead;
  const cannotAdd = atLimit || noCatalog;
  const pickable = w.catalog.canRead && w.catalog.items.length > 0;
  // Không thêm lại được dòng đã lưu khi thiếu quyền danh mục → hỏi trước khi xoá. Giữ `removing` sau
  // khi đóng để nội dung hộp không đổi trong lúc animation đóng.
  const [removing, setRemoving] = useState<{ index: number; sku: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [multiPickOpen, setMultiPickOpen] = useState(false);
  const requestRemove = (index: number) => {
    const line = w.values.lines[index];
    if (!noCatalog || !line || line.lineId === "") return remove(index);
    setRemoving({ index, sku: line.skuId });
    setConfirmRemove(true);
  };

  // Chế độ mở rộng chỉ sống trong bước này: rời bước / rời trang thì trả sidebar + stepper.
  const expanded = useAppStore((s) => s.focusMode);
  const setExpanded = useAppStore((s) => s.setFocusMode);
  useEffect(() => () => setExpanded(false), [setExpanded]);

  const usedSkus = new Set(w.values.lines.flatMap((l) => (l.skuId !== "" ? [l.skuId] : [])));
  // Dòng mới còn trống bị thay khi thêm nhiều SKU ⇒ không tính vào trần dòng.
  const kept = w.values.lines.filter((l) => l.lineId !== "" || l.skuId !== "" || l.description);
  const errorCount = w.errors.lines ? fields.filter((_, i) => w.errors.lines?.[i]).length : 0;

  return (
    <Card>
      <LinesStepHeader
        w={w}
        summary={UI_LABELS.purchaseOrder.linesStep.lineSummary(fields.length, errorCount)}
        expanded={expanded}
        onToggleExpanded={() => setExpanded(!expanded)}
        canAdd={!cannotAdd}
        canAddMany={!cannotAdd && pickable}
        onAdd={() => append(createEmptyLine())}
        onAddMany={() => setMultiPickOpen(true)}
      />

      <CatalogNotice w={w} className="mb-3" />
      {atLimit && (
        <p className="text-warning mb-3 text-[0.8125rem]" role="status">
          {D.linesLimit(PO_LIMITS.linesMax)}
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
          {w.mode === "edit" ? D.linesEmpty : UI_LABELS.purchaseOrder.linesEmpty}
        </div>
      ) : (
        <PoLinesEditor w={w} expanded={expanded} onRemove={requestRemove} />
      )}
      {fields.length > 0 && <FieldError>{rootError}</FieldError>}

      <LinesTotalsBar totals={w.totals} currency={w.values.currency} />

      {/* Dialog portal ra ngoài nhưng sự kiện React vẫn nổi lên form wizard — chặn submit lọt ra
          ngoài để "Thêm N dòng" không kích hoạt "Tiếp tục". */}
      <div onSubmit={(e) => e.stopPropagation()}>
        <SkuMultiPickDialog
          open={multiPickOpen}
          onOpenChange={setMultiPickOpen}
          items={w.catalog.items}
          usedSkus={usedSkus}
          remaining={w.mode === "edit" ? PO_LIMITS.linesMax - kept.length : undefined}
          onAdd={w.catalog.addSkus}
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
