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
 * Đưa một đơn vào xuất kho, chọn đích lấy hàng (khu xuất hàng / khu chờ xuất) và gán người lấy hàng (BE
 * `POST /fulfillment/tasks`, docs 07 §4.1 bước 2). BR-01 (docs 07 §6): chỉ picking khi đơn đã release — BE chỉ nhận
 * đơn READY_TO_FULFILL; đơn CONFIRMED phải được quản lý kho release trước. Đơn đang chờ hàng đã giữ được một phần
 * thùng (docs 07 §4.1 bước 1) lấy trước phần đó: về khu chờ xuất, hoặc sang khu xuất hàng khi Sale đã cho phép giao
 * một phần (bước 2, 17 §4.4 bước 15) — chưa cho thì khoá đích khu xuất hàng.
 * Danh sách đơn đọc từ `GET /fulfillment/task-candidates` (BE PR #151, cần `fulfillment-task-assignment:CREATE`)
 * thay cho `GET /orders` (cần `sales-orders:READ` — quản lý kho không có). Người nhận vẫn lấy từ
 * `GET /fulfillment/assignees` (cần `fulfillment-task-assignment:UPDATE`).
 */
export function CreateTaskDialog({
  onClose,
  warehouseId: tabWarehouseId,
  initialOrderId = "",
}: {
  onClose: () => void;
  /** Kho của tab theo kho — chỉ đơn xuất từ kho này (BE `task-candidates?warehouseId=` lọc). */
  warehouseId: string;
  /** Mở từ một đơn (nút "Tạo nhiệm vụ lấy hàng" ở chi tiết đơn): chọn sẵn đơn đó. */
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
  // Chỉ có đúng một đơn chờ xuất kho → chọn sẵn (R6); người dùng vẫn đổi được
  const orderId = pickedOrderId || (options.length === 1 ? (options[0]?.orderId ?? "") : "");
  const selected = options.find((order) => order.orderId === orderId);
  // Người nhận và khu chờ xuất theo kho của đơn đã chọn (BE `GET /fulfillment/assignees?warehouseId=`)
  // Chưa chọn đơn thì dùng kho của tab (danh sách đơn đã lọc theo kho đó) — người nhận hiện sẵn, không khoá tới khi chọn đơn
  const warehouseId = selected?.warehouseId ?? tabWarehouseId;
  // Docs 07 §4.1 bước 2: đơn chờ hàng chưa được giao một phần → chỉ khu chờ xuất (Backend phải re-check)
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
