"use client";

import { useState } from "react";

import { IDENTITY_USER_PERMISSIONS, ORDER_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { fulfillmentErrorMessage } from "@/features/fulfillment/errors";
import { createTaskInputSchema } from "@/features/fulfillment/input-schemas";
import { useCreateFulfillmentTask } from "@/features/fulfillment/mutations";
import { useFulfillableOrders } from "@/features/fulfillment/queries";
import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FieldError, MONO } from "../primitives";
import { AssigneeSelect, SELECT_FIELD } from "./AssigneeSelect";

const { fulfillment, loadError, common } = UI_LABELS;

type FieldErrors = Partial<Record<"orderId" | "assignedUserId", string>>;

/**
 * Đưa một đơn vào xuất kho và gán người lấy hàng (BE `POST /fulfillment/tasks`).
 * BR-01 (docs 07 §6): chỉ picking khi đơn đã release — BE (PR #133) chỉ nhận đơn READY_TO_FULFILL;
 * đơn CONFIRMED phải release trước, đơn có dòng in phải release sản xuất trước (BR-06).
 */
export function CreateTaskDialog({ onClose }: { onClose: () => void }) {
  const canReadOrders = useCan(ORDER_PERMISSIONS.read);
  const canReadUsers = useCan(IDENTITY_USER_PERMISSIONS.read);
  const orders = useFulfillableOrders(canReadOrders);
  const create = useCreateFulfillmentTask();
  const [orderId, setOrderId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const edit = (apply: () => void, field: keyof FieldErrors) => {
    apply();
    setErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
  };

  const submit = () => {
    const parsed = createTaskInputSchema.safeParse({ orderId, assignedUserId });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({ orderId: flat.orderId?.[0], assignedUserId: flat.assignedUserId?.[0] });
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: onClose,
      onError: (error) => setServerError(fulfillmentErrorMessage(error, "create")),
    });
  };

  const options = orders.data ?? [];
  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={fulfillment.action.create}
        description="Chọn đơn đã release (sẵn sàng xuất kho) để đưa vào xuất kho và gán nhân viên lấy hàng. Mỗi đơn chỉ có một task."
        submitLabel={fulfillment.action.create}
        canSubmit={canReadOrders && canReadUsers && !orders.isError}
        isPending={create.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        {!canReadOrders ? (
          <Alert tone="warning" title={fulfillment.noOrderReadTitle}>
            Tạo task cần chọn đơn hàng. Tài khoản chưa được cấp quyền xem đơn hàng — liên hệ quản
            trị để được cấp.
          </Alert>
        ) : orders.isError ? (
          <Alert tone="danger" title={loadError.serverTitle}>
            Không tải được danh sách đơn hàng chờ xuất kho.{" "}
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto p-0 align-baseline"
              onClick={() => void orders.refetch()}
            >
              {common.retry}
            </Button>
          </Alert>
        ) : (
          <div>
            <Label htmlFor="task-order" className="text-[0.8125rem]">
              Đơn hàng
            </Label>
            <Select
              value={orderId}
              onValueChange={(value) => edit(() => setOrderId(value), "orderId")}
              disabled={orders.isPending}
            >
              <SelectTrigger
                id="task-order"
                autoFocus
                aria-invalid={errors.orderId ? true : undefined}
                aria-describedby={errors.orderId ? "task-order-error" : undefined}
                className={SELECT_FIELD}
              >
                <SelectValue
                  placeholder={
                    orders.isPending
                      ? "Đang tải đơn hàng…"
                      : options.length
                        ? "Chọn đơn hàng"
                        : "Không có đơn nào chờ xuất kho"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((order) => (
                  <SelectItem key={order.orderId} value={order.orderId}>
                    {/* Dòng danh sách đơn của BE không kèm dòng hàng (OrderSearchRepository) → chỉ hiện số đơn */}
                    <span className={MONO}>{order.orderNumber}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id="task-order-error">{errors.orderId}</FieldError>
          </div>
        )}
        <AssigneeSelect
          canReadUsers={canReadUsers}
          value={assignedUserId}
          error={errors.assignedUserId}
          onChange={(userId) => edit(() => setAssignedUserId(userId), "assignedUserId")}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
