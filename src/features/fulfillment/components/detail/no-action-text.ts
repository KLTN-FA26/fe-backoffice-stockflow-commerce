import { PICK_STATUS, UI_LABELS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import {
  isBlockedAsNonAssignee,
  isTaskCancelled,
  isTaskClosed,
} from "@/features/fulfillment/lifecycle";
import { isOnDesignHold } from "@/features/fulfillment/selectors";

import type { FulfillmentActionCode, FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { FulfillmentTask } from "@/features/fulfillment/types";
import type { FulfillmentScope } from "../primitives";

const { noActions } = UI_LABELS.fulfillment;

const ASSIGNEE_ONLY: Record<FulfillmentScope, readonly FulfillmentActionCode[]> = {
  picking: ["startPicking", "completePicking"],
  packing: [],
};

/**
 * Câu thay cho nút khi task không còn thao tác nào trong màn này với người dùng này. `incompleteReason`: người
 * được gán chưa hoàn tất được vì còn dòng chưa lấy / thiếu hàng ("Còn n dòng…").
 */
export function noActionText(
  task: FulfillmentTask,
  actor: FulfillmentActor,
  scope: FulfillmentScope,
  incompleteReason?: string,
): string {
  if (isTaskCancelled(task)) return `${STATUS_LABEL_VI.Cancelled} — không còn thao tác.`;
  if (scope === "picking" && task.pickStatus === PICK_STATUS.PICKED) {
    return `${STATUS_LABEL_VI[task.pickStatus]} — không còn thao tác lấy hàng.`;
  }
  if (scope === "picking" && incompleteReason) return incompleteReason;
  if (scope === "packing") {
    if (isTaskClosed(task)) return `${STATUS_LABEL_VI[task.packStatus]} — không còn thao tác.`;
    if (isOnDesignHold(task)) return UI_LABELS.packing.notice.holdReadOnly;
    if (task.pickStatus !== PICK_STATUS.PICKED) return noActions.waitingPick;
  }
  if (isBlockedAsNonAssignee(task, actor, ASSIGNEE_ONLY[scope])) return noActions.notAssignee;
  return noActions.viewOnly;
}
