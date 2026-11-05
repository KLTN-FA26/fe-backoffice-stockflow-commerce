"use client";

import { UI_LABELS } from "@/constants";
import { designLineViews } from "@/features/fulfillment/selectors";

import { Section } from "../primitives";
import { DesignLineCard } from "./DesignLineCard";

import type { FulfillmentTask } from "@/features/fulfillment/types";

const { fulfillment } = UI_LABELS;

/**
 * Các dòng tuỳ chỉnh kèm thiết kế đã khoá — dòng đi kèm task (`GET /tasks/{id}`, SCRUM-466), không cần quyền
 * đọc đơn hàng; task không kèm dòng thì suy từ evidence.
 */
export function DesignLinesSection({
  task,
  canDownload,
}: {
  task: FulfillmentTask;
  canDownload: boolean;
}) {
  const lines = designLineViews(task);

  return (
    <Section
      title="Dòng tuỳ chỉnh — thiết kế đã khoá"
      description="So thành phẩm với thiết kế khách đã chốt trước khi xác nhận đóng gói."
    >
      {lines.length > 0 ? (
        <div className="space-y-3">
          {lines.map((line, index) => (
            <DesignLineCard
              key={line.lineId}
              taskId={task.taskId}
              line={line}
              index={index}
              canDownload={canDownload}
            />
          ))}
        </div>
      ) : (
        <p className="text-ink-secondary text-[0.8125rem]">{fulfillment.noDesignLines}</p>
      )}
    </Section>
  );
}
