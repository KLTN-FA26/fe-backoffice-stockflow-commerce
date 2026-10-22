"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { UI_LABELS, VEHICLE_TYPE_PERMISSIONS } from "@/constants";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { vehicleTypeActions } from "@/features/vehicle-type/lifecycle";

import { buildVehicleTypeColumns } from "./list/columns";
import { useVehicleTypeListState } from "./list/useVehicleTypeListState";
import { VehicleTypeFilters } from "./list/VehicleTypeFilters";
import { VehicleTypeListBody } from "./list/VehicleTypeListBody";
import { VehicleTypeFormDialog } from "./VehicleTypeFormDialog";
import { VehicleTypeStatusDialog } from "./VehicleTypeStatusDialog";

import type { VehicleType } from "@/features/vehicle-type/types";

const L = UI_LABELS.vehicleType;

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; vehicleType: VehicleType }
  | { kind: "status"; vehicleType: VehicleType; target: VehicleType["status"] };

function VehicleTypeListContent() {
  const canRead = useCan(VEHICLE_TYPE_PERMISSIONS.read);
  const can = usePermissionChecker();
  const s = useVehicleTypeListState(canRead);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const actionsOf = (row: VehicleType | null) => vehicleTypeActions(row, { can });
  const columns = buildVehicleTypeColumns({
    actionsOf,
    onEdit: (vehicleType) => setDialog({ kind: "edit", vehicleType }),
    onToggleStatus: (vehicleType) => {
      const [target] = actionsOf(vehicleType).statusTargets;
      if (target) setDialog({ kind: "status", vehicleType, target });
    },
  });
  const close = () => setDialog(null);

  return (
    <>
      <PageHeader
        title={L.pageTitle}
        subtitle={L.pageSubtitle}
        actions={
          actionsOf(null).create && (
            <Button
              size="sm"
              className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]"
              onClick={() => setDialog({ kind: "create" })}
            >
              <Plus className="size-3.5" /> {L.create}
            </Button>
          )
        }
      />
      {canRead && <VehicleTypeFilters s={s} />}
      <VehicleTypeListBody
        s={s}
        columns={columns}
        onRowClick={
          actionsOf(null).create
            ? (vehicleType) => setDialog({ kind: "edit", vehicleType })
            : undefined
        }
      />
      {dialog?.kind === "create" && <VehicleTypeFormDialog onClose={close} />}
      {dialog?.kind === "edit" && (
        <VehicleTypeFormDialog vehicleType={dialog.vehicleType} onClose={close} />
      )}
      {dialog?.kind === "status" && (
        <VehicleTypeStatusDialog
          vehicleType={dialog.vehicleType}
          target={dialog.target}
          onClose={close}
        />
      )}
    </>
  );
}

/**
 * Danh mục loại xe (docs 09 §3): container, xe tải, xe bán tải dùng cho kế hoạch xếp xe. Xem cần
 * `fulfillment-vehicle-types:READ`; thêm / sửa / ngừng dùng cần `:UPDATE` (UI-only — Backend phải
 * re-check). Không có xoá; loại xe mặc định không đổi mã.
 */
export function VehicleTypeList() {
  return (
    <PermissionBoundary permissions={[VEHICLE_TYPE_PERMISSIONS.viewPage]} variant="list">
      <VehicleTypeListContent />
    </PermissionBoundary>
  );
}
