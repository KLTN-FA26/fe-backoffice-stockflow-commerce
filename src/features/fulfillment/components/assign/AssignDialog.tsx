"use client";

import { useState } from "react";

import { FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { fulfillmentErrorMessage } from "@/features/fulfillment/errors";
import { assignInputSchema } from "@/features/fulfillment/input-schemas";
import { useAssignFulfillmentTask } from "@/features/fulfillment/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { taskCode } from "../primitives";
import { AssigneeSelect } from "./AssigneeSelect";

import type { FulfillmentTask } from "@/features/fulfillment/types";

/** Gán lại task cho nhân viên khác — BE chỉ cho khi chưa bắt đầu lấy hàng (pick `PENDING`). */
export function AssignDialog({ task, onClose }: { task: FulfillmentTask; onClose: () => void }) {
  const canAssign = useCan(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.update);
  const assign = useAssignFulfillmentTask();
  const [assignedUserId, setAssignedUserId] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);

  const unchanged = assignedUserId !== "" && assignedUserId === task.assignedUserId;

  const submit = () => {
    const parsed = assignInputSchema.safeParse({ assignedUserId });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    assign.mutate(
      { taskId: task.taskId, assignedUserId: parsed.data.assignedUserId },
      {
        onSuccess: onClose,
        onError: (error) => setServerError(fulfillmentErrorMessage(error, "assign")),
      },
    );
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={`${UI_LABELS.fulfillment.action.assign} task ${taskCode(task.taskId)}`}
        description="Chỉ gán lại được khi task chưa bắt đầu lấy hàng. Người được gán phải là nhân viên kho hoặc quản lý kho đang hoạt động."
        submitLabel={UI_LABELS.fulfillment.action.assign}
        canSubmit={canAssign && !unchanged}
        isPending={assign.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        <AssigneeSelect
          autoFocus
          canAssign={canAssign}
          warehouseId={task.warehouseId}
          value={assignedUserId}
          currentUserId={task.assignedUserId}
          // Chọn lại đúng người đang được gán → nút gửi khoá, nói rõ lý do ngay dưới ô
          error={fieldError ?? (unchanged ? UI_LABELS.fulfillment.alreadyAssigned : undefined)}
          onChange={(userId) => {
            setAssignedUserId(userId);
            setFieldError(undefined);
            setServerError(null);
          }}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
