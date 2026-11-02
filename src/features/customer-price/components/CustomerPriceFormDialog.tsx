"use client";

import { useCallback, useEffect, useState } from "react";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { useCustomerPrice } from "../queries";
import { CustomerChangedLock } from "./CustomerChangedLock";
import { CustomerPriceForm } from "./CustomerPriceForm";
import { OpenExistingConfirm } from "./OpenExistingConfirm";
import { useSaveLock } from "./useSaveLock";

import type { ExistingPriceRef } from "./useCustomerPriceEditor";

const F = CUSTOMER_PRICE_UI_LABELS.form;

/** Bảng giá đang mở form: danh tính chụp lúc mở (khách + chế độ + SKU), không đọc lại từ URL. */
export type PriceFormTarget =
  { mode: "create"; customerId: string } | { mode: "edit"; customerId: string; sku: string };

export const targetKey = (t: PriceFormTarget) =>
  t.mode === "create" ? `create|${t.customerId}` : `edit|${t.customerId}|${t.sku}`;

/**
 * Dialog tạo / sửa bảng giá. Danh tính (khách, SKU) cố định theo `target` — đổi bản ghi là dựng lại
 * (cha đặt `key={targetKey}`). Đóng khi đang có thay đổi chưa lưu → hỏi trước. Khách trên URL đổi (Back /
 * Forward) khi form đang mở: chưa sửa gì → đóng; đang sửa dở → giữ bản nháp nhưng KHOÁ lưu (không ghi
 * nhầm sang khách khác), cho quay lại khách đó hoặc bỏ bản nháp. "Mở bảng giá hiện có" sau 409 cũng
 * hỏi trước khi bỏ bản nháp tạo mới, và không chạy khi khách trên URL đã đổi. Đang lưu thì mọi lối đóng
 * (Esc, bấm nền, Huỷ, bỏ bản nháp, mở bản có sẵn) bị bỏ qua tới khi POST / PUT có kết quả.
 */
export function CustomerPriceFormDialog({
  target,
  currentCustomerId,
  customerLabel,
  canRead,
  canSuggestSku,
  onClose,
  onOpenExisting,
  onReturnToCustomer,
}: {
  target: PriceFormTarget;
  currentCustomerId: string | null;
  customerLabel: string;
  canRead: boolean;
  canSuggestSku: boolean;
  onClose: () => void;
  onOpenExisting?: (existing: ExistingPriceRef) => void;
  onReturnToCustomer: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pendingExisting, setPendingExisting] = useState<ExistingPriceRef | null>(null);
  const { saving, onSavingChange: onPendingChange, whenIdle } = useSaveLock();
  const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);
  const customerChanged = currentCustomerId !== target.customerId;
  const detail = useCustomerPrice(
    target.customerId,
    target.mode === "edit" ? target.sku : null,
    canRead && target.mode === "edit",
  );

  // Khách đổi mà form chưa có thay đổi → không có gì để giữ, đóng luôn
  useEffect(() => {
    if (customerChanged && !dirty && !saving) onClose();
  }, [customerChanged, dirty, saving, onClose]);

  // Một cổng cho mọi lối đóng / đổi bản ghi: đang lưu thì bỏ qua (không đóng, không hỏi bỏ bản nháp)
  const requestClose = () => whenIdle(() => (dirty ? setConfirmDiscard(true) : onClose()));
  const requestOpenExisting =
    onOpenExisting &&
    ((existing: ExistingPriceRef) =>
      whenIdle(() => (dirty ? setPendingExisting(existing) : onOpenExisting(existing))));
  const locked = customerChanged ? (
    <CustomerChangedLock
      customerLabel={customerLabel}
      onReturn={onReturnToCustomer}
      onDiscard={() => whenIdle(onClose)}
    />
  ) : null;

  const common = {
    customerId: target.customerId,
    customerLabel,
    locked,
    canSuggestSku,
    onDirtyChange,
    onPendingChange,
    onSaved: onClose,
    onCancel: requestClose,
    onOpenExisting: requestOpenExisting,
  };

  return (
    <>
      <FormDialog open onOpenChange={(open) => !open && requestClose()}>
        {target.mode === "create" ? (
          <CustomerPriceForm mode="create" {...common} />
        ) : detail.data ? (
          // Đã có bản trong cache: lần tải lại nền lỗi không gỡ form (giữ bản nháp)
          <CustomerPriceForm
            mode="edit"
            {...common}
            initial={detail.data}
            latest={detail.data}
            reload={detail.refetch}
            refreshFailed={detail.isError}
          />
        ) : (
          <FormDialogBody
            title={F.editTitle(target.sku)}
            description={detail.isError ? F.loadFailed : F.loading}
            submitLabel={F.save}
            canSubmit={false}
            isPending={false}
            error={null}
            onSubmit={() => undefined}
            onCancel={onClose}
          />
        )}
      </FormDialog>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={F.discardTitle}
        description={F.discardDescription}
        confirmLabel={F.discard}
        cancelLabel={F.keepEditing}
        variant="danger"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
      <OpenExistingConfirm
        existing={pendingExisting}
        onKeepEditing={() => setPendingExisting(null)}
        onConfirm={(existing) => {
          setPendingExisting(null);
          // Khách trên URL đổi trong lúc hỏi → giữ khoá bản nháp, không mở bản ghi nào
          if (!customerChanged) onOpenExisting?.(existing);
        }}
      />
    </>
  );
}
