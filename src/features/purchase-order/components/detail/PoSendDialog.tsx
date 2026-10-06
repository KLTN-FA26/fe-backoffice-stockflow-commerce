"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { toLocalIsoDate } from "@/lib/format";
import {
  PO_REASON_MAX,
  isExpectedDatePast,
  linesMissingDescription,
  sendPoInputSchema,
} from "@/features/purchase-order";
import { Alert } from "@/components/shared/Alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { PoDialog, PoDialogForm } from "./PoDialog";

import type { PurchaseOrder, SendPoInput } from "@/features/purchase-order";

interface PoSendDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  po: PurchaseOrder;
  supplierName: string;
  isPending: boolean;
  serverError: string | null;
  onConfirm: (input: SendPoInput) => void;
}

/**
 * Xác nhận trước khi gửi NCC — gửi email/API ra ngoài, không thu hồi được.
 * BE `PurchaseOrder#confirmDeliveryDate` (#36 9fbb90f): ngày giao phải có; đổi ngày thì bắt buộc
 * lý do. Ngày đã qua chỉ cảnh báo (BR-06). Dòng thiếu mô tả có thể bị BE từ chối khi gửi.
 */
export function PoSendDialog({ open, onOpenChange, ...formProps }: PoSendDialogProps) {
  return (
    <PoDialog open={open} onOpenChange={onOpenChange}>
      <SendForm onCancel={() => onOpenChange(false)} {...formProps} />
    </PoDialog>
  );
}

function SendForm({
  po,
  supplierName,
  isPending,
  serverError,
  onConfirm,
  onCancel,
}: Omit<PoSendDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const today = toLocalIsoDate(new Date().toISOString());
  const current = po.expectedDate || null;
  const [expectedAt, setExpectedAt] = useState(current ?? "");
  const [reason, setReason] = useState("");
  const parsed = sendPoInputSchema(current).safeParse({ expectedAt, reason });
  const missingDescription = linesMissingDescription(po).length;
  const errorOf = (field: "expectedAt" | "reason") =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;
  const dateChanged = expectedAt !== "" && expectedAt !== current;

  return (
    <PoDialogForm
      title={UI_LABELS.purchaseOrder.action.send}
      description={`Gửi đơn ${po.poNumber} tới ${supplierName}. Thao tác gửi email/API ra ngoài, không thu hồi được.`}
      submitLabel={UI_LABELS.purchaseOrder.action.send}
      canSubmit={parsed.success}
      isPending={isPending}
      error={serverError}
      onSubmit={() => parsed.success && onConfirm(parsed.data)}
      onCancel={onCancel}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="po-send-date" className="text-ink-secondary text-xs font-medium">
          Ngày giao dự kiến <span className="text-danger">*</span>
        </Label>
        <Input
          id="po-send-date"
          type="date"
          value={expectedAt}
          autoFocus
          aria-invalid={expectedAt !== "" && !!errorOf("expectedAt")}
          onChange={(e) => setExpectedAt(e.target.value)}
        />
        {expectedAt !== "" && errorOf("expectedAt") && (
          <p className="text-danger text-xs">{errorOf("expectedAt")}</p>
        )}
        {/* BR-06 (docs 02 §6): ngày đã qua chỉ cảnh báo, vẫn gửi được. */}
        {isExpectedDatePast(expectedAt, today) && (
          <Alert tone="warning" className="mt-1">
            {UI_LABELS.purchaseOrder.deliveryDateInPast}
          </Alert>
        )}
      </div>
      {missingDescription > 0 && (
        <div role="alert">
          <Alert tone="warning">
            {missingDescription} dòng chưa có mô tả sản phẩm. Nếu SKU không có trong danh mục, hệ
            thống sẽ từ chối gửi — khi đó cần huỷ PO và tạo lại kèm mô tả.
          </Alert>
        </div>
      )}
      {dateChanged && (
        <div className="grid gap-1.5">
          <Label htmlFor="po-send-reason" className="text-ink-secondary text-xs font-medium">
            Lý do đổi ngày giao <span className="text-danger">*</span>
          </Label>
          <Input
            id="po-send-reason"
            value={reason}
            maxLength={PO_REASON_MAX}
            placeholder="Nhập lý do…"
            onChange={(e) => setReason(e.target.value)}
          />
          {reason !== "" && errorOf("reason") && (
            <p className="text-danger text-xs">{errorOf("reason")}</p>
          )}
        </div>
      )}
    </PoDialogForm>
  );
}
