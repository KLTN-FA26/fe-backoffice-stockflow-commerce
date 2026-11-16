"use client";

import { useState } from "react";

import { CYCLE_COUNT_LABELS, CYCLE_COUNT_LIMITS } from "@/constants/cycle-count";

import { Alert } from "@/components/shared/Alert";
import { DataTable } from "@/components/shared/DataTable";

import { cycleCountActionError } from "../cycle-count-errors";
import { useCountCycleCountLine } from "../cycle-count-mutations";
import { showsBooks } from "../cycle-count-selectors";
import { buildLineColumns } from "./cycle-count-line-columns";

import type { CycleCount, CycleCountLine } from "../cycle-count-types";

interface CycleCountLinesProps {
  count: CycleCount;
  canCount: boolean;
  recount: { enabled: boolean; selectable: ReadonlySet<string>; selected: ReadonlySet<string> };
  onToggleRecount: (line: CycleCountLine) => void;
}

/** Mỗi dòng một thùng LPN (docs 20 §4.2 a2). Không có ô nhập số lượng — chỉ có mặt / không thấy (BR-14). */
export function CycleCountLines({
  count,
  canCount,
  recount,
  onToggleRecount,
}: CycleCountLinesProps) {
  const countLine = useCountCycleCountLine(count.id);
  const [error, setError] = useState<string | null>(null);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const markMissing = async (line: CycleCountLine) => {
    if (busyLineId) return;
    setBusyLineId(line.id);
    setError(null);
    try {
      await countLine.mutateAsync({ lineId: line.id, input: { found: false } });
    } catch (failure: unknown) {
      setError(cycleCountActionError(failure).detail);
    } finally {
      setBusyLineId(null);
    }
  };
  const columns = buildLineColumns({
    showBooks: showsBooks(count.lines),
    showAdjustments: count.lines.some((line) => (line.adjustments ?? []).length > 0),
    canCount,
    busyLineId,
    onMissing: (line) => void markMissing(line),
    recount,
    onToggleRecount,
  });
  return (
    <section className="space-y-[var(--el-gap)]">
      <h2 className="text-ink-primary text-sm font-semibold">{CYCLE_COUNT_LABELS.lines}</h2>
      {error && (
        <div role="alert">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <DataTable
        columns={columns}
        data={count.lines}
        rowKey={(line) => line.id}
        caption={CYCLE_COUNT_LABELS.lines}
        pageSize={CYCLE_COUNT_LIMITS.maxLines}
        pageSizeOptions={[CYCLE_COUNT_LIMITS.maxLines]}
      />
    </section>
  );
}
