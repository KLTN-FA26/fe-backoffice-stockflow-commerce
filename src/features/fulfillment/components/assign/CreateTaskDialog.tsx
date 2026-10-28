"use client";

import { useState } from "react";

import { FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { fulfillmentErrorMessage } from "@/features/fulfillment/errors";
import { createTaskInputSchema } from "@/features/fulfillment/input-schemas";
import { useCreateFulfillmentTask } from "@/features/fulfillment/mutations";
import { useTaskCandidates } from "@/features/fulfillment/queries";
import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { AssigneeSelect } from "./AssigneeSelect";
import { TaskCandidateSelect } from "./TaskCandidateSelect";

const { fulfillment } = UI_LABELS;

type FieldErrors = Partial<Record<"orderId" | "assignedUserId", string>>;

/**
 * Đưa một đơn vào xuất kho và gán người lấy hàng (BE `POST /fulfillment/tasks`).
 * BR-01 (docs 07 §6): chỉ picking khi đơn đã release — BE (PR #133) chỉ nhận đơn READY_TO_FULFILL;
 * đơn CONFIRMED phải release trước, đơn có dòng in phải release sản xuất trước (BR-06).
 * Danh sách đơn đọc từ `GET /fulfillment/task-candidates` (BE PR #151, cần `fulfillment-task-assignment:CREATE`)
 * thay cho `GET /orders` (cần `sales-orders:READ` — quản lý kho không có). Người nhận vẫn lấy từ
 * `GET /fulfillment/assignees` (cần `fulfillment-task-assignment:UPDATE`).
 */
export function CreateTaskDialog({ onClose }: { onClose: () => void }) {
  const canCreate = useCan(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.create);
  const canAssign = useCan(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.update);
  const candidates = useTaskCandidates(canCreate);
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

  const options = candidates.data?.items ?? [];
  // Người nhận theo kho của đơn đã chọn (BE `GET /fulfillment/assignees?warehouseId=`)
  const warehouseId = options.find((order) => order.orderId === orderId)?.warehouseId;
  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={fulfillment.action.create}
        description="Chọn đơn đã release (sẵn sàng xuất kho) để đưa vào xuất kho và gán nhân viên lấy hàng. Mỗi đơn chỉ có một task."
        submitLabel={fulfillment.action.create}
        canSubmit={canCreate && canAssign && !candidates.isError && options.length > 0}
        isPending={create.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        {canCreate ? (
          <TaskCandidateSelect
            query={candidates}
            value={orderId}
            error={errors.orderId}
            onChange={(value) =>
              edit(() => {
                setOrderId(value);
                // Đổi đơn có thể đổi kho → danh sách người nhận khác, bỏ lựa chọn cũ
                setAssignedUserId("");
              }, "orderId")
            }
          />
        ) : (
          <Alert tone="warning" title={fulfillment.noCreateTitle}>
            {fulfillment.noCreateDescription}
          </Alert>
        )}
        <AssigneeSelect
          canAssign={canAssign}
          warehouseId={warehouseId}
          value={assignedUserId}
          error={errors.assignedUserId}
          onChange={(userId) => edit(() => setAssignedUserId(userId), "assignedUserId")}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
