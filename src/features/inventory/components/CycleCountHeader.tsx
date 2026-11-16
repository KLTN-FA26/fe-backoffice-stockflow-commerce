"use client";

import { CYCLE_COUNT_LABELS } from "@/constants/cycle-count";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

import { usePermissionChecker } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatDate, formatDateTime } from "@/lib/format/date";

import { Alert } from "@/components/shared/Alert";
import { StatusDot } from "@/components/shared/StatusDot";

import { countProgress } from "../cycle-count-selectors";
import { triggerLabel } from "./cycle-count-columns";

import type { CycleCount } from "../cycle-count-types";

const L = CYCLE_COUNT_LABELS;

/** Thông tin chung của phiếu kiểm kê (docs 20 §4.2, §5.2). Ghi chú và sổ sách chỉ có khi BE trả — không tự dựng. */
export function CycleCountHeader({ count }: { count: CycleCount }) {
  const userId = useAuthStore((state) => state.user?.userId);
  const can = usePermissionChecker();
  const progress = countProgress(count.lines);
  // Docs 20 BR-07: ai có APPROVE mới thấy sổ sách của phiếu kiểm mù; người đếm thì không.
  const booksHidden = count.blind && !can(CYCLE_COUNT_PERMISSIONS.approve);
  const assignee = !count.assignedUserId
    ? L.unassigned
    : count.assignedUserId === userId
      ? L.assignedToYou
      : L.assignedToOther;
  const facts = [
    [L.number, count.countNumber],
    [L.trigger, triggerLabel(count.triggerType)],
    [L.plannedDate, count.plannedDate ? formatDate(count.plannedDate) : null],
    [L.progress, `${progress.counted}/${progress.total}`],
    [L.blind, count.blind ? L.blindBadge : null],
    [L.counter, assignee],
    [L.startedAt, count.startedAt ? formatDateTime(count.startedAt) : null],
    [L.completedAt, count.completedAt ? formatDateTime(count.completedAt) : null],
    [L.note, count.note],
  ] as const;
  return (
    <div className="space-y-[var(--el-gap)]">
      <StatusDot domain="stock" status={count.status} />
      {booksHidden && <Alert tone="info">{L.blindHint}</Alert>}
      <dl className="border-border-default bg-bg-surface grid grid-cols-1 gap-[var(--card-pad)] rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow) md:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-ink-secondary text-sm">{label}</dt>
            <dd className="break-words tabular-nums">{value ?? L.missing}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
