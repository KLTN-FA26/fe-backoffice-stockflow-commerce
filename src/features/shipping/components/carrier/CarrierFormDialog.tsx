"use client";

import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { CarrierConnectionFields } from "./CarrierConnectionFields";
import { CarrierGeneralFields } from "./CarrierGeneralFields";
import { useCarrierForm } from "./useCarrierForm";

import type { Carrier } from "@/features/shipping/types";

const FORM = UI_LABELS.shipping.waybill.carriers.form;

/**
 * Thêm / sửa hãng vận chuyển (BE `POST` / `PUT /fulfillment/carriers`, docs 09 §4.1): mã, tên, liên hệ, trạng thái, kiểu kết
 * nối và cấu hình của kiểu đó — webhook theo chuyến (khoá bí mật), tích hợp API đặt xe (môi trường, tài khoản, khoá API, xác
 * thực webhook, mã dịch vụ theo loại xe, điểm lấy hàng), bảng lý do giao thất bại. Khoá chỉ đi vào, không hiện lại. Lỗi 409
 * OPTIMISTIC_LOCK / CARRIER_CODE_EXISTS và lỗi từng ô của BE hiện inline; lưu một phần được nói rõ (xem `useCarrierForm`).
 */
export function CarrierFormDialog({
  carrier,
  onClose,
}: {
  /** `null` = thêm hãng mới. */
  carrier: Carrier | null;
  onClose: () => void;
}) {
  const state = useCarrierForm(carrier, onClose);
  const { form, pending } = state;
  return (
    <FormDialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      // Kiểu API đặt xe có bảng nên cần rộng hơn khung form thường (artboard: 560)
      className={cn(state.api ? "sm:max-w-[920px]" : "sm:max-w-[560px]")}
    >
      <FormDialogBody
        title={state.isEdit ? FORM.editTitle : FORM.createTitle}
        description={FORM.description}
        submitLabel={state.isEdit ? FORM.save : FORM.create}
        canSubmit={state.canSubmit}
        isPending={pending}
        error={state.serverError}
        onSubmit={state.submit}
        onCancel={() => !pending && onClose()}
      >
        <div className="max-h-[62vh] space-y-5 overflow-y-auto pr-1">
          <CarrierGeneralFields form={form} autoFocusCode={!carrier} />
          <CarrierConnectionFields form={form} state={state} />
        </div>
      </FormDialogBody>
    </FormDialog>
  );
}
