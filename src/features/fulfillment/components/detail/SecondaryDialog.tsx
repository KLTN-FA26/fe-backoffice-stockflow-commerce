"use client";

import { AssignDialog } from "../assign/AssignDialog";
import { ChangeDestinationDialog } from "../assign/ChangeDestinationDialog";

import type { FulfillmentActionCode } from "@/features/fulfillment/lifecycle";
import type { FulfillmentTask } from "@/features/fulfillment/types";

/** Dialog của thao tác phụ trên task Pending (`isSecondaryCode`): gán lại, đổi đích. */
export function SecondaryDialog({
  code,
  task,
  onClose,
}: {
  code: FulfillmentActionCode | null;
  task: FulfillmentTask;
  onClose: () => void;
}) {
  if (code === "assign") return <AssignDialog task={task} onClose={onClose} />;
  if (code === "changeDestination")
    return <ChangeDestinationDialog task={task} onClose={onClose} />;
  return null;
}
