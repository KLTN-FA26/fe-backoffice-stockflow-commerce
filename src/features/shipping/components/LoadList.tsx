"use client";

import { useState } from "react";
import { cn } from "cn";
import { CalendarClock, Truck } from "lucide-react";

import { FULFILLMENT_DISPATCH_PERMISSIONS, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { buildLoadColumns } from "./list/columns";
import { LoadFilters } from "./list/LoadFilters";
import { LoadListBody } from "./list/LoadListBody";
import { useLoadListState } from "./list/useLoadListState";
import { OpenLoadDialog } from "./OpenLoadDialog";
import { ShippingPermissionGate } from "./ShippingPermissionGate";
import { useShippingActor } from "./useShippingActor";

const L = UI_LABELS.shipping;

/** Lập kế hoạch xếp xe 3D (chuyến nguyên xe) thuộc SCRUM-452 — ở đây chỉ để nút khoá. */
function PlanLoadButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>
          <Button
            size="sm"
            variant="outline"
            disabled
            className={cn(
              "border-border-default bg-bg-surface text-ink-primary",
              TOOLBAR_ACTION_CLASS,
            )}
          >
            <CalendarClock className="size-3.5" /> {L.loadPlanTitle}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{L.loadPlanInProgress}</TooltipContent>
    </Tooltip>
  );
}

function LoadListContent() {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  const actor = useShippingActor();
  const s = useLoadListState(canRead);
  const [opening, setOpening] = useState(false);
  const canOpen = actor.can(FULFILLMENT_DISPATCH_PERMISSIONS.create);
  const columns = buildLoadColumns(s.navigateToLoad);
  const pageActions = (
    <>
      <PlanLoadButton />
      {canOpen && (
        <Button
          size="sm"
          className={cn(
            "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse",
            TOOLBAR_ACTION_CLASS,
          )}
          onClick={() => setOpening(true)}
        >
          <Truck className="size-3.5" /> {L.loads.open}
        </Button>
      )}
    </>
  );

  return (
    // Giao diện kiểu Vercel như danh sách sản phẩm (globals.css `.surface-soft`): không tiêu đề hiển
    // thị — breadcrumb là tên trang; nút của trang ở cuối hàng lọc.
    <div className="surface-soft">
      <h1 className="sr-only">{L.loads.title}</h1>
      {canRead ? (
        <LoadFilters s={s} actions={pageActions} />
      ) : (
        <div className="mb-3 flex justify-end gap-2">{pageActions}</div>
      )}
      <LoadListBody s={s} columns={columns} />
      <p className="text-ink-tertiary mt-3 text-xs">{L.noTracking}</p>
      {opening && (
        <OpenLoadDialog
          shipments={[]}
          defaultWarehouseId={s.warehouseId || undefined}
          onClose={() => setOpening(false)}
        />
      )}
    </div>
  );
}

/** Danh sách chuyến xe: mỗi chuyến là một lần bàn giao cho một hãng (docs 09 §4.1 bước 3). */
export function LoadList() {
  return (
    <ShippingPermissionGate permissions={[SHIPMENT_PERMISSIONS.viewPage]} variant="list">
      <LoadListContent />
    </ShippingPermissionGate>
  );
}
