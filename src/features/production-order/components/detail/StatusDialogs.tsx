"use client";

import { FormDialog } from "@/components/shared/FormDialog";

import { PrepressForm, HoldForm } from "./PrepressHoldForms";
import { CancelForm, StopForm } from "./CancelStopForms";

import type { ProductionDetail } from "@/features/production-order/types";

export type StatusDialogKind = "prepress" | "hold" | "cancel" | "stop";
interface Props {
  order: ProductionDetail;
  onClose: () => void;
}

const FORMS: Record<StatusDialogKind, (props: Props) => React.ReactNode> = {
  prepress: PrepressForm,
  hold: HoldForm,
  cancel: CancelForm,
  stop: StopForm,
};

export function StatusDialog({
  kind,
  order,
  onClose,
}: {
  kind: StatusDialogKind | null;
  order: ProductionDetail;
  onClose: () => void;
}) {
  const Form = kind ? FORMS[kind] : null;
  return (
    <FormDialog open={!!kind} onOpenChange={(open) => !open && onClose()}>
      {Form && <Form order={order} onClose={onClose} />}
    </FormDialog>
  );
}
