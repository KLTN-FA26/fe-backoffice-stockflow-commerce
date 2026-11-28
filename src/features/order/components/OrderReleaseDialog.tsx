"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ORDER_RELEASE_LABELS } from "@/constants";
import { toast } from "@/components/shared/Toast";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { useReleaseOrder } from "../mutations";
import { releaseFormSchema } from "../release-schemas";

import { OrderRefusalAlert } from "./OrderRefusalAlert";
import { ReleaseBatchField } from "./ReleaseBatchField";
import { ReleaseOverdueWarning } from "./ReleaseOverdueWarning";
import { ReleaseWarehouseField } from "./ReleaseWarehouseField";
import { useReleaseAttempt } from "./useReleaseAttempt";

import type { OrderEstimateSlot } from "../estimate-slot";
import type { ReleaseFormValues } from "../release-schemas";
import type { Order } from "../types";

interface OrderReleaseDialogProps {
  order: Pick<Order, "orderId" | "orderNumber" | "lines"> & { warehouseName?: string | null };
  /** Có `sales-order-delivery-batches:READ` — mới đọc được lịch giao để chọn đợt (xem `ReleaseBatchField`). */
  canChooseBatch: boolean;
  /** Khe "Ước tính xếp xe": nhận kho đang chọn (đơn CONFIRMED chưa có kho). */
  /** Kho xuất Sale đã chọn cho đơn (nếu có) — chọn sẵn ở ô kho. */
  defaultWarehouseId?: string | null;
  estimateSlot?: OrderEstimateSlot;
  onClose: () => void;
}

/**
 * Release đơn cho kho xuất (`POST /orders/{id}/release`, docs 17 §4.2 bước 5, BR-03), kiểm bằng zod (react-hook-form):
 * chọn kho xuất; khách của đơn có đợt thanh toán quá hạn thì hiện cảnh báo ngay khi mở (không chặn release); với đơn có lịch giao và người có quyền đọc lịch thì chọn thêm đợt giao (BR-29, mặc định đợt kế tiếp).
 * Không còn hình thức giao (mọi đơn giao nguyên chuyến, BR-16). Mỗi lần thử mang một `Idempotency-Key`; lý do BE từ
 * chối (thiếu hàng giữ, sai kho, không phải đợt kế tiếp…) hiện trong hộp thoại, không đóng.
 */
export function OrderReleaseDialog({
  order,
  canChooseBatch,
  defaultWarehouseId,
  estimateSlot,
  onClose,
}: OrderReleaseDialogProps) {
  const L = ORDER_RELEASE_LABELS;
  const { mutate, isPending } = useReleaseOrder();
  const release = useReleaseAttempt(onClose);
  const form = useForm<ReleaseFormValues>({
    resolver: zodResolver(releaseFormSchema),
    mode: "onChange",
    defaultValues: { warehouseId: defaultWarehouseId ?? "", deliveryBatchId: "" },
  });
  const warehouseId = useWatch({ control: form.control, name: "warehouseId" });
  // Kho Sale chọn có thể về sau khi hộp thoại đã mở (truy vấn tải muộn): đồng bộ vào form, nếu không ô kho trống mà
  // không có ô chọn để người dùng tự điền → kẹt ở "Chọn kho xuất hàng".
  useEffect(() => {
    if (defaultWarehouseId && !form.getValues("warehouseId")) {
      form.setValue("warehouseId", defaultWarehouseId, { shouldValidate: true });
    }
  }, [defaultWarehouseId, form]);
  const batchId = useWatch({ control: form.control, name: "deliveryBatchId" }) ?? "";
  const setBatch = useCallback(
    (value: string) => form.setValue("deliveryBatchId", value, { shouldValidate: true }),
    [form],
  );

  const submit = form.handleSubmit((values) => {
    release.clearRefusal();
    const request = {
      id: order.orderId,
      warehouseId: values.warehouseId,
      deliveryBatchId: values.deliveryBatchId || undefined,
    };
    mutate(
      { ...request, idempotencyKey: release.idempotencyKeyFor(request) },
      {
        onSuccess: () => {
          release.finishAttempt();
          toast.success(L.success);
          onClose();
        },
        onError: (error) =>
          release.onError(error, (message) =>
            form.setError("warehouseId", { type: "server", message }),
          ),
      },
    );
  });

  return (
    <FormDialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <FormDialogBody
        title={L.title}
        description={L.description(order.orderNumber)}
        submitLabel={L.submit}
        canSubmit={form.formState.isValid}
        isPending={isPending}
        error={null}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <ReleaseOverdueWarning orderId={order.orderId} />
        <ReleaseWarehouseField
          value={warehouseId}
          onChange={(value) => form.setValue("warehouseId", value, { shouldValidate: true })}
          error={form.formState.errors.warehouseId?.message}
          chosenWarehouseId={defaultWarehouseId}
          chosenWarehouseName={order.warehouseName}
        />
        {canChooseBatch && (
          <ReleaseBatchField orderId={order.orderId} value={batchId} onChange={setBatch} />
        )}
        {estimateSlot?.({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          warehouseId: warehouseId || null,
          released: false,
          lines: order.lines,
        })}
        {release.refusal && <OrderRefusalAlert view={release.refusal} />}
      </FormDialogBody>
    </FormDialog>
  );
}
