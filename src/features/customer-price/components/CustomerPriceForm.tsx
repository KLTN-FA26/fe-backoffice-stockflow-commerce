"use client";

import { useEffect } from "react";

import { CUSTOMER_PRICE_LIMITS, CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { SkuField } from "./SkuField";
import { TierEditor } from "./TierEditor";
import { useCustomerPriceEditor } from "./useCustomerPriceEditor";

import type { Refetch } from "@/lib/api/fresh-refetch";
import type { CustomerPrice } from "../schemas";
import type { EditorMode, ExistingPriceRef } from "./useCustomerPriceEditor";

const L = CUSTOMER_PRICE_UI_LABELS;
const F = L.form;

/** Nội dung dialog tạo / sửa — một form dùng chung (SKU, bậc giá, ghi chú); trạng thái ở hook. */
export function CustomerPriceForm({
  mode,
  customerId,
  customerLabel,
  initial,
  latest,
  reload,
  refreshFailed = false,
  locked,
  canSuggestSku,
  onDirtyChange,
  onPendingChange,
  onSaved,
  onCancel,
  onOpenExisting,
}: {
  mode: EditorMode;
  customerId: string;
  customerLabel: string;
  initial?: CustomerPrice;
  latest?: CustomerPrice;
  reload?: Refetch<CustomerPrice>;
  refreshFailed?: boolean;
  /** Câu khoá form (khách trên URL đã đổi) — có thì không lưu được. */
  locked: React.ReactNode;
  canSuggestSku: boolean;
  onDirtyChange: (dirty: boolean) => void;
  /** POST / PUT bắt đầu / xong (báo đồng bộ) — dialog chặn mọi lối đóng trong lúc đó. */
  onPendingChange: (pending: boolean) => void;
  onSaved: () => void;
  onCancel: () => void;
  /** Mở bảng giá đã có sau 409 CONFLICT — không truyền khi thiếu quyền đọc + sửa bảng giá. */
  onOpenExisting?: (existing: ExistingPriceRef) => void;
}) {
  const editor = useCustomerPriceEditor({
    mode,
    customerId,
    initial,
    latest,
    reload,
    onSaved,
    onSavingChange: onPendingChange,
  });
  const { form, conflict, duplicate, outdated, reloading, reloadFailed } = editor;
  const { isDirty, isValid, errors } = form.formState;
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);
  const hasInexact = form.watch("tiers").some((t) => t.inexact);

  return (
    <FormDialogBody
      title={mode === "create" ? F.createTitle : F.editTitle(editor.base?.sku ?? "")}
      description={`${F.description} ${F.customerLine(customerLabel)}`}
      submitLabel={editor.isPending ? F.saving : F.save}
      canSubmit={isValid && !locked}
      isPending={editor.isPending}
      error={editor.error}
      onSubmit={() => void editor.submit()}
      onCancel={onCancel}
    >
      {locked}
      <SkuField form={form} mode={mode} canSuggest={canSuggestSku} />
      {hasInexact && (
        <p role="note" className="text-warning text-xs">
          {F.inexactWarning}
        </p>
      )}
      <TierEditor form={form} />
      <div className="space-y-1">
        <Label htmlFor="cp-note" className="text-ink-secondary text-xs font-medium">
          {L.field.note}
        </Label>
        <Textarea
          id="cp-note"
          rows={2}
          maxLength={CUSTOMER_PRICE_LIMITS.noteMax + 1}
          {...form.register("note")}
        />
        {errors.note && <p className="text-danger text-xs">{errors.note.message}</p>}
      </div>
      {refreshFailed && <p className="text-warning text-xs">{F.refreshFailed}</p>}
      {outdated && conflict !== "version" && (
        <p role="status" className="text-warning text-xs">
          {F.outdated}
        </p>
      )}
      {(conflict === "version" || outdated) && reload && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reloading}
            onClick={() => void editor.reloadLatest()}
          >
            {reloading ? F.reloading : F.reload}
          </Button>
          <span className="text-ink-tertiary text-xs">{F.reloadWarning}</span>
          {reloadFailed && (
            <p role="alert" className="text-danger w-full text-xs">
              {F.reloadFailed}
            </p>
          )}
        </div>
      )}
      {/* Khoá (khách trên URL đã đổi) → không mở bản ghi nào; câu khoá đã nói cách xử lý */}
      {conflict === "duplicate" &&
        duplicate &&
        !locked &&
        (onOpenExisting ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenExisting(duplicate)}
          >
            {F.conflictOpenExisting(duplicate.sku)}
          </Button>
        ) : (
          <p className="text-ink-tertiary text-xs">{F.conflictNoAccess}</p>
        ))}
    </FormDialogBody>
  );
}
