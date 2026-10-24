"use client";

import { useState } from "react";

import { FULFILLMENT_LIMITS, UI_LABELS } from "@/constants";
import { fulfillmentErrorMessage } from "@/features/fulfillment/errors";
import { reverifyInputSchema } from "@/features/fulfillment/input-schemas";
import { useReverifyDesignIntegrity } from "@/features/fulfillment/mutations";
import { isOnDesignHold } from "@/features/fulfillment/selectors";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError, taskCode } from "../primitives";

const { fulfillment } = UI_LABELS;

/**
 * Flow X-CHK (BR-DSG-003, BE docs business-design/04c): người có fulfillment-design-reverification:UPDATE (QC, quản lý kho) yêu cầu BE đối chiếu lại
 * checksum sau khi đã khôi phục đúng file. Bắt buộc ghi cách đã xử lý; không có nút bỏ qua.
 * BE trả 200 cả khi vẫn lệch → dialog giữ nguyên, báo vẫn bị giữ (ghi chú lần đó không được lưu).
 */
export function ReverifyDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const reverify = useReverifyDesignIntegrity();
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = () => {
    const parsed = reverifyInputSchema.safeParse({ resolutionNote: note });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    reverify.mutate(
      { taskId, resolutionNote: parsed.data.resolutionNote },
      {
        onSuccess: (result) => {
          if (isOnDesignHold(result)) setServerError(fulfillment.stillOnHold);
          else onClose();
        },
        onError: (error) => setServerError(fulfillmentErrorMessage(error, "reverify")),
      },
    );
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={`${fulfillment.action.reverify} — task ${taskCode(taskId)}`}
        description="Hệ thống tải lại bundle thiết kế và so checksum với bản khách đã chốt. Chỉ khi khớp, đóng gói mới được gỡ giữ và quay lại đang đóng để người đóng hoàn tất."
        submitLabel={fulfillment.action.reverify}
        canSubmit
        isPending={reverify.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        <div>
          <Label htmlFor="resolution-note" className="text-[0.8125rem]">
            Cách đã xử lý
          </Label>
          <Textarea
            id="resolution-note"
            autoFocus
            rows={3}
            value={note}
            maxLength={FULFILLMENT_LIMITS.resolutionNoteMax}
            placeholder="Vd: đã khôi phục file in từ phiên bản đã chốt"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "resolution-note-error" : undefined}
            onChange={(event) => {
              setNote(event.target.value);
              setFieldError(undefined);
              setServerError(null);
            }}
            className="border-border-default bg-bg-surface mt-1 rounded-[var(--r-sm)] text-[0.8125rem]"
          />
          <FieldError id="resolution-note-error">{fieldError}</FieldError>
        </div>
      </FormDialogBody>
    </FormDialog>
  );
}
