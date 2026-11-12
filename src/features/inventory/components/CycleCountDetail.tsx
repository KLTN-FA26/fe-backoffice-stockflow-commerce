"use client";

import { useState } from "react";

import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

import { usePermissionChecker } from "@/lib/auth";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { canCountCycleCount } from "../cycle-count-lifecycle";
import { useCycleCount } from "../cycle-count-queries";
import { recountableLines } from "../cycle-count-selectors";
import { CycleCountActions } from "./CycleCountActions";
import { CycleCountHeader } from "./CycleCountHeader";
import { CycleCountLines } from "./CycleCountLines";
import { CycleCountScan } from "./CycleCountScan";
import { InventoryError, InventoryOffline } from "./InventoryFeedback";
import { InventoryPermissionGate } from "./InventoryPermissionGate";

import type { CycleCount, CycleCountLine } from "../cycle-count-types";

export function CycleCountDetail({ id }: { id: string }) {
  return (
    <InventoryPermissionGate
      allOf={[CYCLE_COUNT_PERMISSIONS.viewPage, CYCLE_COUNT_PERMISSIONS.read]}
    >
      <CycleCountDetailContent id={id} />
    </InventoryPermissionGate>
  );
}

function CycleCountDetailContent({ id }: { id: string }) {
  const query = useCycleCount(id);
  if (query.isLoading) return <PageSkeleton variant="detail" />;
  if (query.isError)
    return <InventoryError error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return null;
  return <CycleCountSheet count={query.data} busy={query.isFetching} />;
}

function CycleCountSheet({ count, busy }: { count: CycleCount; busy: boolean }) {
  const can = usePermissionChecker();
  const canCount = canCountCycleCount(count.status, can);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  // Chỉ các dòng có điều chỉnh bị từ chối đếm lại được; quản lý chọn trên phiếu đã nộp (docs 20 §4.2 d11).
  const selectable = new Set(recountableLines(count.lines).map((line) => line.id));
  const selected = new Set([...picked].filter((lineId) => selectable.has(lineId)));
  const toggle = (line: CycleCountLine) => {
    const next = new Set(selected);
    if (!next.delete(line.id)) next.add(line.id);
    setPicked(next);
  };
  return (
    // Giao diện kiểu Vercel như chi tiết điều chỉnh (`.surface-soft`); không hiện tiêu đề — mã phiếu nằm ở đầu khối
    // thông tin, h1 giữ cho screen reader.
    <div className="surface-soft surface-compact space-y-[var(--card-pad)]" aria-busy={busy}>
      <h1 className="sr-only">{count.countNumber}</h1>
      <InventoryOffline />
      <CycleCountHeader count={count} />
      {canCount && <CycleCountScan count={count} />}
      <CycleCountLines
        count={count}
        canCount={canCount}
        recount={{
          enabled: selectable.size > 0 && can(CYCLE_COUNT_PERMISSIONS.approve),
          selectable,
          selected,
        }}
        onToggleRecount={toggle}
      />
      <CycleCountActions count={count} recountLineIds={[...selected]} />
    </div>
  );
}
