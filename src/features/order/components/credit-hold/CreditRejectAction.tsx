"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { XCircle } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { CREDIT_REJECTION_ACTION_LABELS, ORDER_LIMITS, UI_LABELS } from "@/constants";
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
import { Textarea } from "@/components/ui/textarea";

import { CREDIT_REJECTION_FIELD_ERRORS, creditDecisionErrorView } from "../../errors";
import { CREDIT_REJECTION_FORM_DEFAULTS, creditRejectionFormSchema } from "../../form-schemas";
import { useRejectCreditHold } from "../../mutations";
import { orderKeys } from "../../queries";
import { availableRefusalActions } from "../../selectors";
import { DANGER_OUTLINE_BUTTON } from "../button-styles";
import { FormFieldError, RequiredMark } from "../FormFieldError";
import { OrderRefusalAlert } from "../OrderRefusalAlert";
import { STALE_CODES, useOrderActionErrors } from "../useOrderActionErrors";
import { usePendingSafeDialog } from "../usePendingSafeDialog";

import { CreditPositionPanel } from "./CreditPositionPanel";
import { DepositPercentField } from "./DepositPercentField";
import { useCustomerCreditPosition } from "./useCustomerCreditPosition";

import type { ApiError } from "@/lib/api/error";
import type { CreditRejectionFormValues } from "../../form-schemas";
import type { CreditRejectionInput } from "../../types";
import type { CreditHoldTarget } from "./types";

const LABEL = "text-ink-secondary text-xs font-medium";
const TERM_NOT_ALLOWED =
  "Khách không còn được dùng phương thức này — đã tải lại công nợ hiện tại, chọn cách xử lý khác.";

/**
 * Từ chối vượt hạn mức (SCRUM-427, docs 15 §4.3): huỷ đơn (CREDIT_REJECTED) hoặc chuyển khách
 * sang trả trước / đặt cọc → đơn về Chờ thanh toán. Cách chuyển chỉ hiện khi công nợ HIỆN TẠI
 * của khách (`GET /orders/credit-position`) cho phép phương thức đó; % cọc điền sẵn từ hồ sơ khách.
 * UI-only gate — Backend phải re-check (CreditHoldController @RequiresPermission
 * sales-order-credit-holds:APPROVE; PAYMENT_TERM_NOT_ALLOWED).
 */
export function CreditRejectAction({
  order,
  compact = false,
}: {
  order: CreditHoldTarget;
  compact?: boolean;
}) {
  // Mutation ở đây (không ở form) để Esc / bấm ra ngoài không đóng dialog khi đang gửi
  const mutation = useRejectCreditHold();
  const dialog = usePendingSafeDialog(mutation.isPending);
  const label = UI_LABELS.order.actions.creditReject;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={compact ? `${label} vượt hạn mức đơn ${order.orderNumber}` : undefined}
        className={`${DANGER_OUTLINE_BUTTON} ${compact ? "" : "w-full"}`}
        onClick={dialog.show}
      >
        <XCircle className="size-3.5" /> {label}
      </Button>
      <FormDialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
        <RejectForm order={order} mutation={mutation} onClose={dialog.close} />
      </FormDialog>
    </>
  );
}

function RejectForm({
  order,
  mutation,
  onClose,
}: {
  order: CreditHoldTarget;
  mutation: ReturnType<typeof useRejectCreditHold>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { mutate: reject, isPending } = mutation;
  const position = useCustomerCreditPosition(order.customerId);
  const allowedTerms = position.data?.allowedTerms ?? null;
  const options = availableRefusalActions(allowedTerms);
  const form = useForm<CreditRejectionFormValues, unknown, CreditRejectionInput>({
    resolver: zodResolver(creditRejectionFormSchema),
    mode: "onChange",
    defaultValues: CREDIT_REJECTION_FORM_DEFAULTS,
  });
  const { refusal, clearRefusal, onError, beginSubmit, idempotencyKeyFor, finishAttempt } =
    useOrderActionErrors(creditDecisionErrorView, STALE_CODES.credit, onClose, {
      map: CREDIT_REJECTION_FIELD_ERRORS,
      setError: (field, message) => form.setError(field, { type: "server", message }),
    });
  const action = useWatch({ control: form.control, name: "action" });
  const { errors } = form.formState;

  // % cọc mặc định lấy từ hồ sơ khách (BE, đơn vị %), chỉ khi người dùng chưa sửa tay — tải lại
  // nền không ghi đè giá trị đã nhập. `setValue` (không `resetField`): ô cọc chỉ đăng ký khi chọn
  // "Chuyển sang đặt cọc"; không đánh dirty nên vẫn phân biệt được giá trị người dùng tự nhập.
  const defaultDeposit = position.data?.depositPercent ?? null;
  useEffect(() => {
    if (defaultDeposit === null || form.getFieldState("depositPercent").isDirty) return;
    form.setValue("depositPercent", String(defaultDeposit), { shouldDirty: false });
  }, [defaultDeposit, form]);

  // Công nợ tải lại không còn cho phép cách đang chọn → bỏ chọn (giữ lỗi đang hiện, nếu có)
  useEffect(() => {
    const current = form.getValues("action");
    if (current && !availableRefusalActions(allowedTerms).some((a) => a === current)) {
      form.setValue("action", "");
    }
  }, [allowedTerms, form]);

  const handleError = (error: ApiError) => {
    if (error.code === "PAYMENT_TERM_NOT_ALLOWED") {
      // Công nợ khách đổi giữa lúc tải và lúc gửi — BE quyết; tải lại để lựa chọn khớp BE
      form.setError("action", { message: TERM_NOT_ALLOWED });
      void queryClient.invalidateQueries({
        queryKey: orderKeys.creditPosition(order.customerId ?? ""),
      });
    }
    onError(error);
  };

  const submit = form.handleSubmit((input) => {
    // Chặn ở biên gửi, không chỉ dựa vào Select: cách xử lý phải khớp công nợ hiện tại đã tải
    if (!options.includes(input.action)) {
      form.setError("action", { message: TERM_NOT_ALLOWED });
      return;
    }
    if (!beginSubmit()) return;
    clearRefusal();
    // Một lần bấm = một request; cùng nội dung bấm lại sau lỗi tạm thời → cùng Idempotency-Key
    const variables = { id: order.orderId, ...input };
    reject(
      { ...variables, idempotencyKey: idempotencyKeyFor(variables) },
      {
        onSuccess: () => {
          finishAttempt();
          onClose();
        },
        onError: handleError,
      },
    );
  });

  return (
    <FormDialogBody
      title="Từ chối vượt hạn mức công nợ"
      description={`Chọn cách xử lý đơn ${order.orderNumber} khi không duyệt vượt hạn mức.`}
      submitLabel="Từ chối"
      danger={action === "CANCEL"}
      canSubmit={form.formState.isValid}
      isPending={isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <CreditPositionPanel state={position} />
      <div className="grid gap-1.5">
        <Label htmlFor="credit-reject-action" className={LABEL}>
          Cách xử lý <RequiredMark />
        </Label>
        <Controller
          control={form.control}
          name="action"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id="credit-reject-action"
                autoFocus
                aria-required="true"
                aria-invalid={errors.action ? true : undefined}
                aria-describedby={errors.action ? "credit-reject-action-error" : undefined}
                className="w-full"
              >
                <SelectValue placeholder="Chọn cách xử lý" />
              </SelectTrigger>
              <SelectContent>
                {options.map((a) => (
                  <SelectItem key={a} value={a}>
                    {CREDIT_REJECTION_ACTION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FormFieldError id="credit-reject-action-error" message={errors.action?.message} />
        {!position.available && (
          <p className="text-ink-tertiary text-xs">
            Chuyển sang trả trước / đặt cọc cần xem được hồ sơ công nợ của khách — hiện chỉ huỷ đơn
            được.
          </p>
        )}
      </div>
      {action === "SWITCH_TO_DEPOSIT" && (
        <DepositPercentField
          registration={form.register("depositPercent")}
          error={errors.depositPercent?.message}
        />
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="credit-reject-note" className={LABEL}>
          Ghi chú <RequiredMark />
        </Label>
        <Textarea
          id="credit-reject-note"
          maxLength={ORDER_LIMITS.creditNoteMax}
          rows={3}
          aria-required="true"
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? "credit-reject-note-error" : undefined}
          {...form.register("note")}
        />
        <FormFieldError id="credit-reject-note-error" message={errors.note?.message} />
      </div>
      {refusal && <OrderRefusalAlert view={refusal} />}
    </FormDialogBody>
  );
}
