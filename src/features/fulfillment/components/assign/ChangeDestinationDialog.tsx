"use client";

import { useState } from "react";

import { FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS, PICK_DESTINATION, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { fulfillmentErrorMessage } from "@/features/fulfillment/errors";
import { changeDestinationInputSchema } from "@/features/fulfillment/input-schemas";
import { useChangeFulfillmentTaskDestination } from "@/features/fulfillment/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { taskCode } from "../primitives";
import { DestinationField, useStagingArea } from "./DestinationField";

import type { PickDestination } from "@/constants";
import type { FulfillmentTask } from "@/features/fulfillment/types";

const { fulfillment } = UI_LABELS;

/**
 * Đổi đích lấy hàng của task (BE `PUT /fulfillment/tasks/{id}/destination`, docs 07 §4.1 bước 3, BR-08): khu xuất hàng
 * hoặc khu chờ xuất của kho, chỉ khi task còn `Pending`. Dùng lại ô chọn đích của màn tạo task; mở lên với đích hiện tại
 * của task, và không cho gửi khi chưa đổi gì.
 */
export function ChangeDestinationDialog({
  task,
  onClose,
}: {
  task: FulfillmentTask;
  onClose: () => void;
}) {
  const canChange = useCan(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.update);
  const change = useChangeFulfillmentTaskDestination();
  const current: PickDestination = task.destination ?? PICK_DESTINATION.DISPATCH;
  const [destination, setDestination] = useState<PickDestination>(current);
  const [stagingChoice, setStagingChoice] = useState(task.stagingLocationCode ?? "");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const stagingArea = useStagingArea(task.warehouseId ?? undefined, destination, stagingChoice);

  const unchanged =
    destination === current &&
    (destination === PICK_DESTINATION.DISPATCH || stagingArea.code === task.stagingLocationCode);

  const submit = () => {
    const parsed = changeDestinationInputSchema.safeParse({
      destination,
      stagingLocationCode: stagingArea.code || undefined,
    });
    if (!parsed.success || stagingArea.needsChoice) {
      setFieldError(
        stagingArea.needsChoice ? fulfillment.destination.stagingAreaRequired : undefined,
      );
      return;
    }
    change.mutate(
      { taskId: task.taskId, ...parsed.data },
      {
        onSuccess: onClose,
        onError: (error) => setServerError(fulfillmentErrorMessage(error, "destination")),
      },
    );
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={fulfillment.destination.changeTitle(taskCode(task))}
        description={fulfillment.destination.changeDescription}
        submitLabel={fulfillment.action.changeDestination}
        canSubmit={canChange && !unchanged && !stagingArea.none}
        isPending={change.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        <DestinationField
          value={destination}
          onChange={(value) => {
            setDestination(value);
            setStagingChoice("");
            setFieldError(undefined);
            setServerError(null);
          }}
          stagingArea={stagingArea}
          chosenStaging={stagingChoice}
          onStagingChange={(code) => {
            setStagingChoice(code);
            setFieldError(undefined);
            setServerError(null);
          }}
          error={fieldError}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
