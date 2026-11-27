"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";
import { SALES_OWNER_PERMISSIONS, STAFF_COVER_PERMISSIONS } from "@/constants/sales-owner";

import { useAuthStore, useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useAssignableSales } from "@/lib/references/sales-agents";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { DetailPanel } from "@/components/shared/DetailPanel";
import { ToolbarSwitch } from "@/components/shared/ListToolbar";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { coverErrorMessage } from "../errors";
import { useCancelCover } from "../mutations";
import { useCovers } from "../queries";
import { todayInVietnam } from "../selectors";

import { COVERS_COPY } from "./copy";
import { coverColumns } from "./cover-columns";
import { CoverCreateDialog } from "./CoverCreateDialog";

import type { StaffCover } from "../types";

function CoversContent() {
  const me = useAuthStore((s) => s.user);
  const canCreate = useCan(STAFF_COVER_PERMISSIONS.create);
  const canUpdate = useCan(STAFF_COVER_PERMISSIONS.update);
  // Quản lý: lập / huỷ lịch cho mọi người (BR-S07). UI-only — Backend phải re-check
  // (hợp đồng: "Manager" trên FE = người có customer-sales-owners:UPDATE)
  const isManager = useCan(SALES_OWNER_PERMISSIONS.update);
  // D42: người vắng / người thay chỉ là Sale đang làm
  const sales = useAssignableSales(canCreate);
  const [activeOnly, setActiveOnly] = useState(true);
  const query = useCovers({ active: activeOnly || undefined });
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<StaffCover | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancel = useCancelCover();
  const today = todayInVietnam();

  if (query.isPending) return <PageSkeleton variant="list" />;
  if (query.isError || query.data === null)
    return (
      <LoadErrorState error={query.error} copy={COVERS_COPY} onRetry={() => void query.refetch()} />
    );
  const self = { userId: me?.userId ?? "", name: me?.fullName ?? me?.username ?? "Tôi" };

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{SALES_OWNER_LABELS.nav.covers}</h1>
      <DetailPanel
        title={SALES_OWNER_LABELS.nav.covers}
        count={query.data.length}
        description="Sale vắng (nghỉ phép ≤ 60 ngày) thì người thay nhận mọi việc với khách của họ; hết lịch tự trả về."
        actions={
          <>
            <ToolbarSwitch
              label="Chỉ lịch còn hiệu lực"
              checked={activeOnly}
              onCheckedChange={setActiveOnly}
            />
            {canCreate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setCreating(true)}
              >
                <CalendarPlus className="size-3.5" aria-hidden /> Lập lịch thay
              </Button>
            )}
          </>
        }
        flush
      >
        <DataTable
          data={query.data}
          columns={coverColumns({
            today,
            ctx: { userId: me?.userId ?? null, canUpdate, isManager },
            onCancel: (cover) => {
              setError(null);
              setCancelling(cover);
            },
          })}
          rowKey={(cover) => cover.id}
          emptyState="Chưa có lịch người thay nào."
        />
      </DetailPanel>
      {creating && (
        <CoverCreateDialog
          self={self}
          isManager={isManager}
          sales={sales.options ?? []}
          onClose={() => setCreating(false)}
        />
      )}
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Huỷ lịch người thay"
        description={
          cancelling
            ? `Huỷ lịch ${cancelling.coverUserName ?? "người thay"} lo thay ${cancelling.userName ?? "Sale"}. Việc với khách quay về người phụ trách ngay.`
            : ""
        }
        confirmLabel="Huỷ lịch"
        closeOnConfirm={false}
        loading={cancel.isPending}
        error={error}
        onConfirm={() =>
          cancelling &&
          cancel.mutate(cancelling.id, {
            onSuccess: () => setCancelling(null),
            onError: (e) => setError(coverErrorMessage(e)),
          })
        }
      />
    </div>
  );
}

/** "Lịch người thay" (`/admin/sales/covers`, BR-S07) — Sale và quản lý (`staff-covers:READ`). */
export function CoversPage() {
  return (
    <PermissionBoundary permissions={[STAFF_COVER_PERMISSIONS.read]} variant="list">
      <CoversContent />
    </PermissionBoundary>
  );
}
