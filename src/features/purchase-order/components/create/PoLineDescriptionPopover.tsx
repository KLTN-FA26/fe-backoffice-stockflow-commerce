"use client";

import { useState } from "react";
import { cn } from "cn";
import { StickyNote } from "lucide-react";

import { PO_LIMITS, UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "./CreateFormPrimitives";
import { fieldClass } from "./helpers";

import type { CreatePoWizard } from "./useCreateForm";

const S = UI_LABELS.purchaseOrder.linesStep;

/**
 * Mô tả của một dòng (BE `purchase_order_lines.note` ≤ 255) — popover neo vào nút ở cột thao tác
 * thay vì textarea thường trực, để bảng dòng hàng giữ một hàng mỗi dòng. Đóng popover không mất
 * giá trị (react-hook-form giữ). Icon đổi tone khi đã có mô tả / có lỗi.
 */
export function PoLineDescriptionPopover({ w, index }: { w: CreatePoWizard; index: number }) {
  const [open, setOpen] = useState(false);
  const description = w.values.lines[index]?.description ?? "";
  const error = w.errors.lines?.[index]?.description?.message;
  const id = `po-line-${index}-desc`;
  const errorId = `${id}-error`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={S.descriptionButton(index + 1)}
          className={cn(
            "hover:bg-bg-muted size-8 rounded-[var(--r-sm)]",
            error
              ? "text-danger"
              : description.trim() !== ""
                ? "text-dot-info"
                : "text-ink-tertiary hover:text-ink-primary",
          )}
        >
          <StickyNote className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <label htmlFor={id} className="text-ink-secondary mb-1 block text-xs font-medium">
          {S.descriptionLabel(index + 1)}
        </label>
        <Textarea
          id={id}
          {...w.form.register(`lines.${index}.description`)}
          autoFocus
          rows={3}
          maxLength={PO_LIMITS.lineDescriptionMax}
          placeholder={UI_LABELS.purchaseOrder.lineDescriptionPlaceholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          // Ctrl/⌘ + Enter = xong (Enter thường xuống dòng trong mô tả)
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              setOpen(false);
            }
          }}
          className={cn(fieldClass(!!error).replace("h-8", ""), "min-h-[72px] resize-y py-2")}
        />
        <FieldError id={errorId}>{error}</FieldError>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-ink-tertiary text-[11px] tabular-nums">
            {description.length}/{PO_LIMITS.lineDescriptionMax}
          </span>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            {S.descriptionDone}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
