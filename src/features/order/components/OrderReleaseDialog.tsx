"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { ORDER_DELIVERY_MODE_UI, ORDER_RELEASE_LABELS } from "@/constants";
import { toast } from "@/components/shared/Toast";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { ftlConflictsWithCod } from "../delivery-mode";
import { releaseDeliveryMode } from "../delivery-mode-api";
import { useReleaseOrder } from "../mutations";
import { releaseFormSchema } from "../release-schemas";

import { DeliveryModeField } from "./DeliveryModeField";
import { OrderRefusalAlert } from "./OrderRefusalAlert";
import { ReleaseWarehouseField } from "./ReleaseWarehouseField";
import { useReleaseAttempt } from "./useReleaseAttempt";

import type { OrderEstimateSlot } from "../estimate-slot";
import type { ReleaseFormValues } from "../release-schemas";
import type { Order } from "../types";

interface OrderReleaseDialogProps {
  order: Pick<
    Order,
    "orderId" | "orderNumber" | "deliveryMode" | "paymentTerm" | "balancePolicy" | "printLineCount"
  >;
  /** Có mã quyền `sales-order-delivery-modes:UPDATE` — không có thì hình thức giao chỉ đọc. */
  canChangeMode: boolean;
  /** Khe "Ước tính xếp xe": nhận kho đang chọn (đơn CONFIRMED chưa có kho). */
  estimateSlot?: OrderEstimateSlot;
  onClose: () => void;
}

/**
 * Release đơn cho kho (`POST /orders/{id}/release`): chọn kho + hình thức giao (LP-1), kiểm bằng zod (react-hook-form).
 * Hình thức CHỈ gửi khi khác hình thức hiện tại (`releaseDeliveryMode`); thiếu mã quyền thì chỉ đọc nên không bao giờ
 * gửi. Mỗi lần thử mang một `Idempotency-Key`; lý do BE từ chối (BR-PRD-08 / 09, công nợ, FTL + COD…) hiện trong hộp
 * thoại, không đóng. Đơn thu COD mà chọn nguyên xe: báo trước (LP-2) — BE vẫn là bên quyết.
 */
export function OrderReleaseDialog({
  order,
  canChangeMode,
  estimateSlot,
  onClose,
}: OrderReleaseDialogProps) {
  const L = ORDER_RELEASE_LABELS;
  const { mutate, isPending } = useReleaseOrder();
  const release = useReleaseAttempt(onClose);
  const form = useForm<ReleaseFormValues>({
    resolver: zodResolver(releaseFormSchema),
    mode: "onChange",
    defaultValues: {
      warehouseId: "",
      deliveryMode: order.deliveryMode === "FULL_TRUCKLOAD" ? "FULL_TRUCKLOAD" : "PARCEL",
    },
  });
  const warehouseId = useWatch({ control: form.control, name: "warehouseId" });
  const mode = useWatch({ control: form.control, name: "deliveryMode" });

  const submit = form.handleSubmit((values) => {
    release.clearRefusal();
    const request = {
      id: order.orderId,
      warehouseId: values.warehouseId,
      deliveryMode: canChangeMode
        ? releaseDeliveryMode(values.deliveryMode, order.deliveryMode)
        : undefined,
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
        description={L.description(order.orderNumber, order.printLineCount)}
        submitLabel={L.submit}
        canSubmit={form.formState.isValid}
        isPending={isPending}
        error={null}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <ReleaseWarehouseField
          value={warehouseId}
          onChange={(value) => form.setValue("warehouseId", value, { shouldValidate: true })}
          error={form.formState.errors.warehouseId?.message}
        />
        {order.printLineCount > 0 && <p className="text-ink-tertiary text-xs">{L.printHint}</p>}
        <DeliveryModeField
          value={mode}
          onChange={(value) => form.setValue("deliveryMode", value, { shouldValidate: true })}
          readOnly={!canChangeMode}
          name="release-delivery-mode"
        />
        {ftlConflictsWithCod(order, mode) && (
          <p role="status" className="text-warning text-xs">
            {ORDER_DELIVERY_MODE_UI.ftlNoCod}
          </p>
        )}
        {estimateSlot?.({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          warehouseId: warehouseId || null,
          released: false,
        })}
        {release.refusal && <OrderRefusalAlert view={release.refusal} />}
      </FormDialogBody>
    </FormDialog>
  );
}
