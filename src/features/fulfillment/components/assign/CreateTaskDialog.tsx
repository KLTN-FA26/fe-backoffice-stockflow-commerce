"use client";

import { useState } from "react";

import { FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS, PICK_DESTINATION, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { fulfillmentErrorMessage } from "@/features/fulfillment/errors";
import { createTaskInputSchema } from "@/features/fulfillment/input-schemas";
import { useCreateFulfillmentTask } from "@/features/fulfillment/mutations";
import { useTaskCandidates } from "@/features/fulfillment/queries";
import { prePickStagingOnly } from "@/features/fulfillment/selectors";
import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { AssigneeSelect } from "./AssigneeSelect";
import { DestinationField, useStagingArea } from "./DestinationField";
import { TaskCandidateSelect } from "./TaskCandidateSelect";

import type { PickDestination } from "@/constants";

const { fulfillment } = UI_LABELS;

type FieldErrors = Partial<Record<"orderId" | "assignedUserId" | "stagingLocationCode", string>>;

/**
 * Tạo nhiệm vụ lấy hàng (BE `POST /fulfillment/tasks`, docs 07 §4.1 bước 2): chọn đơn (đã có lệnh xuất kho, hoặc đơn chờ
 * hàng lấy trước phần đã giữ), đích lấy hàng (BR-01) và người lấy hàng; chọn sẵn khi chỉ có một đơn / một người.
 */
export function CreateTaskDialog({
  onClose,
  warehouseId: tabWarehouseId,
  initialOrderId = "",
}: {
  onClose: () => void;
  /** Kho của tab — chỉ đơn xuất từ kho này. */
  warehouseId: string;
  /** Mở từ chi tiết đơn: chọn sẵn đơn đó. */
  initialOrderId?: string;
}) {
  const canCreate = useCan(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.create);
  const canAssign = useCan(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.update);
  const candidates = useTaskCandidates(canCreate, tabWarehouseId);
  const create = useCreateFulfillmentTask();
  const [pickedOrderId, setPickedOrderId] = useState(initialOrderId);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [destination, setDestination] = useState<PickDestination>(PICK_DESTINATION.DISPATCH);
  const [stagingChoice, setStagingChoice] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const edit = (apply: () => void, field: keyof FieldErrors) => {
    apply();
    setErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
  };

  const options = candidates.data?.items ?? [];
  const orderId = pickedOrderId || (options.length === 1 ? (options[0]?.orderId ?? "") : "");
  const selected = options.find((order) => order.orderId === orderId);
  // Người nhận / khu chờ xuất theo kho của đơn; chưa chọn đơn thì kho của tab (người nhận hiện sẵn, không khoá)
  const warehouseId = selected?.warehouseId ?? tabWarehouseId;
  // Docs 07 §4.1 bước 2: đơn chờ hàng chưa giao một phần → chỉ khu chờ xuất (BE re-check)
  const stagingOnly = prePickStagingOnly(selected);
  const target = stagingOnly ? PICK_DESTINATION.STAGING : destination;
  const stagingArea = useStagingArea(warehouseId, target, stagingChoice);

  const submit = () => {
    const parsed = createTaskInputSchema.safeParse({
      orderId,
      assignedUserId,
      destination: target,
      stagingLocationCode: stagingArea.code || undefined,
    });
    if (!parsed.success || stagingArea.needsChoice) {
      const flat: Partial<Record<string, string[]>> = parsed.success
        ? {}
        : parsed.error.flatten().fieldErrors;
      setErrors({
        orderId: flat.orderId?.[0],
        assignedUserId: flat.assignedUserId?.[0],
        stagingLocationCode: stagingArea.needsChoice
          ? fulfillment.destination.stagingAreaRequired
          : undefined,
      });
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: onClose,
      onError: (error) => setServerError(fulfillmentErrorMessage(error, "create")),
    });
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={fulfillment.action.create}
        description={fulfillment.createDescription}
        submitLabel={fulfillment.action.create}
        canSubmit={
          canCreate && canAssign && !candidates.isError && options.length > 0 && !stagingArea.none
        }
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
                setPickedOrderId(value);
                // Đổi đơn có thể đổi kho → danh sách người nhận khác, bỏ lựa chọn cũ
                setAssignedUserId("");
                setStagingChoice("");
              }, "orderId")
            }
          />
        ) : (
          <Alert tone="warning" title={fulfillment.noCreateTitle}>
            {fulfillment.noCreateDescription}
          </Alert>
        )}
        <DestinationField
          value={target}
          stagingOnly={stagingOnly}
          onChange={(value) =>
            edit(() => {
              setDestination(value);
              setStagingChoice("");
            }, "stagingLocationCode")
          }
          stagingArea={stagingArea}
          chosenStaging={stagingChoice}
          onStagingChange={(code) => edit(() => setStagingChoice(code), "stagingLocationCode")}
          error={errors.stagingLocationCode}
        />
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
