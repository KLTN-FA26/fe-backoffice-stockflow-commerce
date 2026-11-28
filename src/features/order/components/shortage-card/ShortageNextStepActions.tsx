"use client";

import { SHORTAGE_LABELS } from "@/constants";

import { shortageNextStep } from "../../shortage-card-lifecycle";

import { ShortageCloseRestAction } from "./ShortageCloseRestAction";
import {
  ShortageCancelAction,
  ShortageReduceAction,
  ShortageShipPartAction,
} from "./ShortageExecuteActions";
import { ShortageWaitAction } from "./ShortageWaitAction";

import type { PermissionCode } from "@/lib/auth";
import type { ShortageCard } from "@/lib/domain/shortage-card";
import type { Order } from "../../types";

const L = SHORTAGE_LABELS;

/**
 * Việc tiếp theo của Sale trên thẻ sống, MỘT chỗ quyết bằng `shortageNextStep` (trạng thái thẻ + quyền): chờ khách chọn →
 * câu nhắc; khách đã chọn → "Thực hiện: <hướng>"; giao một phần → chờ kho kiểm xong rồi "Đóng phần còn lại".
 */
export function ShortageNextStepActions({
  order,
  card,
  can,
}: {
  order: Pick<Order, "orderId" | "orderNumber" | "status">;
  card: ShortageCard;
  can: (code: PermissionCode) => boolean;
}) {
  const step = shortageNextStep(card, order.status, can);
  switch (step.kind) {
    case "wait-customer":
      return <p className="text-ink-secondary text-[0.8125rem]">{L.waiting}</p>;
    case "await-partial-check":
      return <p className="text-ink-secondary text-[0.8125rem]">{L.awaitingPartialCheck}</p>;
    case "close-rest":
      return <ShortageCloseRestAction order={order} card={card} allowed={step.allowed} />;
    case "execute": {
      const props = { order, card, allowed: step.allowed };
      switch (step.option) {
        case "WAIT_FOR_PRODUCTION":
          return <ShortageWaitAction {...props} />;
        case "REDUCE_CARTONS":
          return <ShortageReduceAction {...props} />;
        case "SHIP_PART_CLOSE_REST":
          return <ShortageShipPartAction {...props} />;
        case "CANCEL_ORDER":
          return <ShortageCancelAction {...props} />;
      }
      return null;
    }
    case "none":
      return null;
  }
}
