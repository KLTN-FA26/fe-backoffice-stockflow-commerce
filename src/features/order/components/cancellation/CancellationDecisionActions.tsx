"use client";

import { CircleCheck, CircleX } from "lucide-react";

import { CANCELLATION_REQUEST_LABELS, ORDER_LIMITS } from "@/constants";
import { Button } from "@/components/ui/button";

import {
  CANCELLATION_REQUEST_STALE_CODES,
  cancellationDecisionErrorView,
} from "../../cancellation-request-errors";
import {
  useApproveCancellationRequest,
  useRejectCancellationRequest,
} from "../../cancellation-request-mutations";
import {
  approveCancellationSchema,
  rejectCancellationSchema,
} from "../../cancellation-request-schemas";
import { OrderReasonDialog } from "../OrderReasonDialog";
import { ORDER_ACTION_BUTTON, useOrderActionDialog } from "../useOrderActionDialog";

import { CancellationFeeFields } from "./CancellationFeeFields";
import { useCancellationFee } from "./useCancellationFee";

import type { CustomOrderAction } from "../useOrderActionDialog";
import type { CancellationFeeFacts } from "./CancellationFeeFields";

interface DecisionProps {
  orderId: string;
  /**
   * BO-UX-35: số đã thu và đã in hàng loạt chưa (R5-6 trên dòng yêu cầu huỷ). Vắng → hộp thoại không đoán, BE quyết
   * (409 CANCELLATION_FEE_BEFORE_PRINTING).
   */
  facts?: CancellationFeeFacts;
  /** Mã đơn để ghi vào mô tả hộp thoại; hàng đợi chưa biết thì để null (không đoán). */
  orderNumber: string | null;
  requestId: string;
  /** Nút gọn trong hàng của bảng. */
  compact?: boolean;
}

const APPROVE: CustomOrderAction = {
  toView: (error) => cancellationDecisionErrorView(error, "approve"),
  staleCodes: CANCELLATION_REQUEST_STALE_CODES,
};
const REJECT: CustomOrderAction = {
  toView: (error) => cancellationDecisionErrorView(error, "reject"),
  staleCodes: CANCELLATION_REQUEST_STALE_CODES,
};

const orderLabel = (orderNumber: string | null) => orderNumber ?? "này";
const COMPACT = "bg-bg-surface rounded-[var(--r-sm)] border px-2.5 py-1 text-xs font-medium";
/**
 * Nút gọn trong hàng đợi (BO-UX-36): "Duyệt huỷ" tông nguy hiểm vì nó huỷ đơn ngay, "Từ chối" trung tính — hai nút
 * không còn trông như nhau.
 */
const BUTTON = (compact: boolean | undefined, danger = false) =>
  compact
    ? `${COMPACT} ${
        danger
          ? "border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
          : "border-border-default text-ink-primary hover:bg-bg-muted"
      }`
    : ORDER_ACTION_BUTTON;
/** Tên truy cập kèm số đơn khi biết: mười dòng không còn là mười nút "Duyệt huỷ" giống hệt nhau. */
const rowLabel = (label: string, orderNumber: string | null, compact: boolean | undefined) =>
  compact && orderNumber ? `${label} — ${orderNumber}` : undefined;

/**
 * Duyệt yêu cầu huỷ (`POST …/cancellation-requests/{id}/approval`, docs 17 §4.8 bước 28, 30): huỷ đơn ngay, kèm phí nếu
 * có. Hiện khi yêu cầu `PENDING` và người dùng có `sales-order-cancellations:UPDATE` (UI-only — Backend phải re-check:
 * @RequiresPermission + ORDER_NOT_CANCELLABLE sau thùng dán nhãn đầu tiên, BR-12). Dialog chỉ mount khi mở nên mỗi lần mở
 * là một lần thử mới (form và Idempotency-Key sạch).
 */
export function CancellationApproveAction({
  orderId,
  orderNumber,
  requestId,
  compact,
  facts,
}: DecisionProps) {
  const L = CANCELLATION_REQUEST_LABELS.approve;
  const dialog = useOrderActionDialog(APPROVE);
  const { mutate, isPending } = useApproveCancellationRequest(dialog.hookOptions);
  const fee = useCancellationFee();
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={dialog.show}
        aria-label={rowLabel(L.button, orderNumber, compact)}
        className={BUTTON(compact, true)}
      >
        <CircleCheck className="size-3.5" aria-hidden="true" /> {L.button}
      </Button>
      {dialog.open && (
        <OrderReasonDialog
          title={L.title}
          description={L.description(orderLabel(orderNumber))}
          submitLabel={L.submit}
          noteLabel={L.noteLabel}
          noteMax={ORDER_LIMITS.cancellationDecisionNoteMax}
          schema={approveCancellationSchema}
          extra={{
            values: fee.values,
            render: (errors) => <CancellationFeeFields fee={fee} errors={errors} facts={facts} />,
          }}
          isPending={isPending}
          error={dialog.error}
          onSubmit={(values) => dialog.submit(mutate, { orderId, requestId, ...values })}
          onClose={dialog.close}
        />
      )}
    </>
  );
}

/** Từ chối yêu cầu huỷ (`…/rejection`): lý do BẮT BUỘC — khách đọc được (docs 17 §4.8 bước 28). */
export function CancellationRejectAction({
  orderId,
  orderNumber,
  requestId,
  compact,
}: DecisionProps) {
  const L = CANCELLATION_REQUEST_LABELS.reject;
  const dialog = useOrderActionDialog(REJECT);
  const { mutate, isPending } = useRejectCancellationRequest(dialog.hookOptions);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={dialog.show}
        aria-label={rowLabel(L.button, orderNumber, compact)}
        className={BUTTON(compact)}
      >
        <CircleX className="size-3.5" aria-hidden="true" /> {L.button}
      </Button>
      {dialog.open && (
        <OrderReasonDialog
          title={L.title}
          description={L.description(orderLabel(orderNumber))}
          submitLabel={L.submit}
          noteLabel={L.noteLabel}
          noteMax={ORDER_LIMITS.cancellationDecisionNoteMax}
          noteAlwaysRequired
          schema={rejectCancellationSchema}
          isPending={isPending}
          error={dialog.error}
          onSubmit={(values) => dialog.submit(mutate, { orderId, requestId, ...values })}
          onClose={dialog.close}
        />
      )}
    </>
  );
}
