"use client";

import { useState } from "react";
import { cn } from "cn";
import { Boxes } from "lucide-react";

import { SLOTTING_LABELS } from "@/constants";
import { filterPutawayTasks } from "@/features/putaway/selectors";

import { DETAIL_CARD_CLASS, DetailCardTitle } from "@/components/shared/DetailSection";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";

import type { PutawayTask } from "@/features/putaway/types";

const L = SLOTTING_LABELS;
const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

/**
 * Cột trái trang Gợi ý vị trí: thùng chờ cất của kho, chọn một thùng để xem bin gợi ý. Ô lọc chỉ lọc dòng đã tải
 * (BE không có tìm kiếm) và là trạng thái tạm của màn — thùng đang chọn mới lên URL (`?task=`).
 */
export function SlottingCartonList({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: readonly PutawayTask[];
  selectedId: string | null;
  onSelect: (taskId: string) => void;
}) {
  const [q, setQ] = useState("");
  const rows = filterPutawayTasks(tasks, { q, lpn: "", sku: "", location: "" });
  return (
    <section className={DETAIL_CARD_CLASS} aria-labelledby="slotting-cartons">
      <DetailCardTitle icon={Boxes}>
        <span id="slotting-cartons">{L.cartons}</span>
        <span className="text-ink-tertiary ml-auto text-xs font-normal">
          {L.cartonCount(tasks.length)}
        </span>
      </DetailCardTitle>
      <Input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder={L.search}
        aria-label={L.search}
        className={cn(FORM_INPUT_CLASS, "mb-2")}
      />
      {rows.length === 0 ? (
        <p className="text-ink-tertiary py-6 text-center text-[0.8125rem]">{L.noMatch}</p>
      ) : (
        <ul className="-mx-1 max-h-[calc(100svh-17rem)] space-y-0.5 overflow-y-auto px-1">
          {rows.map((task) => {
            const active = task.id === selectedId;
            return (
              <li key={task.id}>
                <button
                  type="button"
                  aria-current={active || undefined}
                  onClick={() => onSelect(task.id)}
                  className={cn(
                    "hover:bg-bg-muted focus-visible:ring-border-strong flex w-full items-start justify-between gap-3 rounded-[var(--r-sm)] px-2.5 py-2 text-left outline-none focus-visible:ring-2",
                    active && "bg-bg-muted",
                  )}
                >
                  <span className="min-w-0">
                    <span
                      className={`text-ink-primary block truncate text-[0.8125rem] font-medium ${MONO}`}
                    >
                      {task.lpn ?? task.id}
                    </span>
                    <span
                      className="text-ink-tertiary block truncate text-xs"
                      title={task.lotNumber ? `${task.sku} · ${task.lotNumber}` : task.sku}
                    >
                      {task.lotNumber ? `${task.sku} · ${task.lotNumber}` : task.sku}
                    </span>
                  </span>
                  <span className={`text-ink-secondary shrink-0 text-xs ${MONO}`}>
                    {task.sourceLocationCode}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
