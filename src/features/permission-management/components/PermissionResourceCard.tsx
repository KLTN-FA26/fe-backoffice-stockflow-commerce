import { EmptyState } from "@/components/shared/EmptyState";

import { PermissionActionChip } from "./PermissionActionChip";

import type { RoleMatrixResource } from "../types";

export function PermissionResourceCard({ resource }: { resource: RoleMatrixResource }) {
  return (
    <article className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-ink-primary font-semibold">{resource.label}</h3>
          <p className="text-ink-tertiary mt-1 font-[family-name:var(--font-mono)] text-xs">
            {resource.code}
          </p>
        </div>
        <span className="text-ink-secondary shrink-0 text-xs tabular-nums">
          {resource.grantedCount}/{resource.totalCount} quyền được cấp
        </span>
      </div>

      {resource.actions.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {resource.actions.map((action) => (
            <PermissionActionChip key={action.action} action={action} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-4 py-6"
          title="Chưa có action"
          description="Resource này chưa khai báo action nào."
        />
      )}
    </article>
  );
}
