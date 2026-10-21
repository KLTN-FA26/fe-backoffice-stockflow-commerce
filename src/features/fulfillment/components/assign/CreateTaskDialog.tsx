"use client";

import { useState } from "react";

import { FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/format";
import { useCan } from "@/lib/auth";
import { fulfillmentErrorMessage } from "@/features/fulfillment/errors";
import { createTaskInputSchema } from "@/features/fulfillment/input-schemas";
import { useCreateFulfillmentTask } from "@/features/fulfillment/mutations";
import { useTaskCandidates } from "@/features/fulfillment/queries";
import { Alert } from "@/components/shared/Alert";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";

import { FieldError, MONO } from "../primitives";
import { AssigneeSelect, SELECT_FIELD } from "./AssigneeSelect";

import type { TaskCandidate } from "@/features/fulfillment/types";

const { fulfillment, loadError, common } = UI_LABELS;
const { candidate: candidateCopy } = fulfillment;

/** Có dòng in tuỳ chỉnh (BE `lines[].printed`) — cần chú ý khi lấy hàng / đóng gói. */
const hasPrintedLines = (candidate: TaskCandidate) => candidate.lines.some((line) => line.printed);

const customerOf = (candidate: TaskCandidate) =>
  candidate.customerName || candidateCopy.guestCustomer;

/** Hiện trong ô chọn sau khi chọn: số đơn + tên khách. */
function CandidateSummary({ candidate }: { candidate: TaskCandidate }) {
  return (
    <span className="truncate">
      <span className={MONO}>{candidate.orderNumber}</span>
      <span className="text-ink-tertiary"> · {customerOf(candidate)}</span>
    </span>
  );
}

/** Một dòng trong danh sách: số đơn, khách, số dòng / số lượng, ngày đặt, dấu "có dòng in". */
function CandidateOption({ candidate }: { candidate: TaskCandidate }) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <span className="flex items-center gap-2">
        <span className={MONO}>{candidate.orderNumber}</span>
        <span className="truncate">{customerOf(candidate)}</span>
        {hasPrintedLines(candidate) && (
          <Badge variant="outline" className="text-[0.6875rem]">
            {candidateCopy.printed}
          </Badge>
        )}
      </span>
      <span className="text-ink-tertiary text-xs">
        {candidateCopy.summary(candidate.lineCount, candidate.totalQuantity)}
        {candidate.placedAt && ` · ${candidateCopy.placed(formatDate(candidate.placedAt))}`}
      </span>
    </span>
  );
}

/** 403 (thiếu quyền / kho ngoài phạm vi) là quyết định của BE, thử lại không đổi được → không có nút Thử lại. */
function CandidatesError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const denied = status === 403;
  return (
    <Alert
      tone={denied ? "warning" : "danger"}
      title={denied ? fulfillment.noCreateTitle : loadError.serverTitle}
    >
      {denied || status === 404
        ? fulfillmentErrorMessage(error, "candidates")
        : candidateCopy.loadFailed}
      {!denied && (
        <>
          {" "}
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto p-0 align-baseline"
            onClick={onRetry}
          >
            {common.retry}
          </Button>
        </>
      )}
    </Alert>
  );
}

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
  const selected = options.find((order) => order.orderId === orderId);
  // Người nhận theo kho của đơn đã chọn (BE `GET /fulfillment/assignees?warehouseId=`)
  const warehouseId = selected?.warehouseId;
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
        {!canCreate ? (
          <Alert tone="warning" title={fulfillment.noCreateTitle}>
            {fulfillment.noCreateDescription}
          </Alert>
        ) : candidates.isError ? (
          <CandidatesError error={candidates.error} onRetry={() => void candidates.refetch()} />
        ) : !candidates.isPending && options.length === 0 ? (
          <EmptyState
            className="py-6"
            title={candidateCopy.emptyTitle}
            description={candidateCopy.emptyDescription}
          />
        ) : (
          <div>
            <Label htmlFor="task-order" className="text-[0.8125rem]">
              {candidateCopy.fieldLabel}
            </Label>
            <Select
              value={orderId}
              onValueChange={(value) =>
                edit(() => {
                  setOrderId(value);
                  // Đổi đơn có thể đổi kho → danh sách người nhận khác, bỏ lựa chọn cũ
                  setAssignedUserId("");
                }, "orderId")
              }
              disabled={candidates.isPending}
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
                    candidates.isPending ? candidateCopy.loading : candidateCopy.placeholder
                  }
                >
                  {selected && <CandidateSummary candidate={selected} />}
                </SelectValue>
              </SelectTrigger>
              <TitledSelectContent title={candidateCopy.fieldLabel}>
                {options.map((candidate) => (
                  <SelectItem key={candidate.orderId} value={candidate.orderId}>
                    <CandidateOption candidate={candidate} />
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
            <FieldError id="task-order-error">{errors.orderId}</FieldError>
            {candidates.data?.hasNext && (
              <p className="text-ink-tertiary mt-1 text-xs">
                {candidateCopy.truncated(options.length, candidates.data.totalElements)}
              </p>
            )}
          </div>
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
