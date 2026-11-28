import { LOAD_STATUS, UI_LABELS } from "@/constants";

import type { Load } from "./types";

const N = UI_LABELS.shipping.load.noActions;
const F = UI_LABELS.shipping.ftl;
const { PLANNED, VEHICLE_BOOKED, DISPATCHED, CANCELLED } = LOAD_STATUS;

/** Câu thay cho nút khi không còn thao tác nào (người dùng hiểu vì sao ô quét / nút không có). */
export function loadNoActionReason(load: Pick<Load, "status">): string {
  if (load.status === DISPATCHED) return N.dispatched;
  if (load.status === CANCELLED) return N.cancelled;
  if (load.status === PLANNED) return F.noActions.planned;
  if (load.status === VEHICLE_BOOKED) return F.noActions.booked;
  return N.viewOnly;
}
