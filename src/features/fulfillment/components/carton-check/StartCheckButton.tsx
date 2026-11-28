"use client";

import { PlayCircle } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { cartonCheckErrorMessage } from "@/features/fulfillment/carton-check-errors";
import { useStartCartonCheck } from "@/features/fulfillment/carton-check-mutations";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import type { CartonCheckSession } from "@/features/fulfillment/carton-check-types";

/** Nút cấp phiên của cột trạng thái: cao bằng nhau, rộng hết cột. */
export const CARTON_CHECK_BUTTON = "h-(--action-h) w-full rounded-(--action-radius)";

/** Bắt đầu kiểm thùng (`packing-start`); người khác bắt đầu trước thì câu báo nêu tên người đó. */
export function StartCheckButton({ session }: { session: CartonCheckSession }) {
  const start = useStartCartonCheck();
  return (
    <Button
      type="button"
      size="sm"
      disabled={start.isPending}
      onClick={() =>
        start.mutate(session.taskId, {
          onError: (error) =>
            toast.error(cartonCheckErrorMessage(error, { starterName: session.startedByName })),
        })
      }
      className={CARTON_CHECK_BUTTON}
    >
      <PlayCircle className="size-3.5" /> {UI_LABELS.cartonCheck.action.start}
    </Button>
  );
}
