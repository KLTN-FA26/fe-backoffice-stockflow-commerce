"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { cartonCheckErrorMessage } from "@/features/fulfillment/carton-check-errors";
import { useReprintCartonLabel } from "@/features/fulfillment/carton-check-mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import type { Carton, CartonCheckSession } from "@/features/fulfillment/carton-check-types";

const R = UI_LABELS.cartonCheck.reprint;

/**
 * In lại nhãn rách / mất (docs 08 §4.3 bước 7, BR-08): phiên bản nhãn +1, nhãn cũ vô hiệu. Gửi `fromVersion` = phiên
 * bản đang dán nên bấm lại sau lỗi mạng không tạo thêm một phiên bản. Xong thì mở luôn PDF nhãn mới.
 */
export function ReprintLabelDialog({
  session,
  carton,
  onClose,
  onReprinted,
}: {
  session: CartonCheckSession;
  carton: Carton;
  onClose: () => void;
  onReprinted: (lpn: string) => void;
}) {
  const reprint = useReprintCartonLabel();
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = () => {
    setServerError(null);
    reprint.mutate(
      { taskId: session.taskId, lpn: carton.lpn, fromVersion: carton.labelVersion },
      {
        onSuccess: () => onReprinted(carton.lpn),
        onError: (error) =>
          setServerError(
            cartonCheckErrorMessage(error, {
              context: "reprint",
              starterName: session.startedByName,
            }),
          ),
      },
    );
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={R.title(carton.lpn)}
        description={R.description(carton.labelVersion)}
        submitLabel={R.submit}
        canSubmit
        isPending={reprint.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      />
    </FormDialog>
  );
}
