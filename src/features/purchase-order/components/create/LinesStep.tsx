"use client";

import { Plus } from "lucide-react";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";

import { FieldError, SummaryItem } from "./CreateFormPrimitives";
import { createEmptyLine } from "./helpers";
import { PoLineCard } from "./PoLineCard";

import type { CreatePoWizard } from "./useCreateForm";

/** Bước 2 — dòng hàng (`useFieldArray`, api-conventions §4). Lỗi từng ô hiện inline. */
export function LinesStep({ w }: { w: CreatePoWizard }) {
  const { fields, append, remove } = w.lines;
  const rootError = w.errors.lines?.root?.message ?? w.errors.lines?.message;

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-ink-primary font-[family-name:var(--font-display)] text-[1rem] font-semibold">
            Dòng hàng
          </h2>
          <p className="text-ink-secondary mt-1 text-[0.8125rem]">
            Nhập mã SKU (Active), số lượng đặt và đơn giá theo tiền tệ của PO — tổng = số lượng ×
            đơn giá.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(createEmptyLine())}
          className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
        >
          <Plus className="size-3.5" />
          Thêm dòng hàng
        </Button>
      </div>

      {fields.length === 0 ? (
        <div
          className={cn(
            "rounded-[var(--r-sm)] border px-4 py-8 text-center text-[0.8125rem]",
            rootError
              ? "border-danger/30 bg-danger/5 text-danger"
              : "border-border-default bg-bg-subtle text-ink-tertiary",
          )}
        >
          Chưa có dòng hàng. Cần ít nhất một dòng trước khi tạo PO.
        </div>
      ) : (
        <div className="max-h-[min(58vh,520px)] space-y-3 overflow-y-auto pr-1">
          {fields.map((field, index) => (
            <PoLineCard key={field.id} w={w} index={index} onRemove={() => remove(index)} />
          ))}
        </div>
      )}
      {fields.length > 0 && <FieldError>{rootError}</FieldError>}

      {/* BE chưa có thuế / chiết khấu → tạm tính = tổng, chỉ hiện một số. */}
      <div className="bg-bg-surface border-border-default sticky bottom-0 mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
        <SummaryItem label={UI_LABELS.purchaseOrder.lineCount} value={String(fields.length)} mono />
        <SummaryItem
          label={UI_LABELS.purchaseOrder.grandTotal}
          value={formatMoney(w.totals.grandTotal, w.values.currency)}
          mono
        />
      </div>
    </Card>
  );
}
