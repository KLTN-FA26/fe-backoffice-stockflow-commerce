"use client";

import { Button } from "@/components/ui/button";
import { SHORTAGE_LABELS, SHORTAGE_OPTION_LABELS } from "@/constants";

import { SHORTAGE_STALE_CODES, shortageExecuteErrorView } from "../../shortage-card-errors";
import { DANGER_OUTLINE_BUTTON } from "../button-styles";

import type { ShortageOption } from "@/constants";
import type { ShortageCard } from "@/lib/domain/shortage-card";
import type { Order } from "../../types";

export const SHORTAGE_EXECUTE_ACTION = {
  toView: shortageExecuteErrorView,
  staleCodes: SHORTAGE_STALE_CODES,
};

const L = SHORTAGE_LABELS;

export interface ShortageExecuteProps {
  order: Pick<Order, "orderId" | "orderNumber">;
  card: ShortageCard;
  allowed: boolean;
}

/** Nút "Thực hiện: <hướng>" — khoá (kèm lý do) khi thiếu quyền, không ẩn. */
export function ExecuteButton({
  option,
  allowed,
  onClick,
}: {
  option: ShortageOption;
  allowed: boolean;
  onClick: () => void;
}) {
  const danger = option === "CANCEL_ORDER";
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant={danger ? "outline" : "default"}
        className={danger ? DANGER_OUTLINE_BUTTON : undefined}
        disabled={!allowed}
        onClick={onClick}
      >
        {L.executeAs(SHORTAGE_OPTION_LABELS[option])}
      </Button>
      {!allowed && <p className="text-ink-secondary text-xs">{L.blockedNoPermission}</p>}
    </div>
  );
}
