import { EmptyState } from "@/components/shared/EmptyState";

import { PermissionResourceCard } from "./PermissionResourceCard";

import type { RoleMatrixGroup } from "../types";

export function PermissionGroup({ group }: { group: RoleMatrixGroup }) {
  return (
    <section aria-labelledby={`permission-group-${group.name}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`permission-group-${group.name}`} className="text-ink-primary text-base font-bold">
          {group.name}
        </h2>
        <span className="text-ink-secondary text-xs tabular-nums">
          {group.grantedCount}/{group.totalCount} quyền được cấp
        </span>
      </div>
      {group.resources.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {group.resources.map((resource) => (
            <PermissionResourceCard key={resource.code} resource={resource} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Chưa có resource"
          description="Nhóm này chưa có resource phân quyền nào."
        />
      )}
    </section>
  );
}
