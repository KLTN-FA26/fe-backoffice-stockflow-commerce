"use client";

import { useState } from "react";
import { CalendarClock, Truck } from "lucide-react";

import { FULFILLMENT_DISPATCH_PERMISSIONS, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
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
          <Button size="sm" variant="outline" disabled className="rounded-[var(--r-sm)]">
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

  return (
    <>
      <PageHeader
        title={L.loads.title}
        subtitle={L.loads.subtitle}
        actions={
          <>
            <PlanLoadButton />
            {canOpen && (
              <Button
                size="sm"
                className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]"
                onClick={() => setOpening(true)}
              >
                <Truck className="size-3.5" /> {L.loads.open}
              </Button>
            )}
          </>
        }
      />
      {canRead && <LoadFilters s={s} />}
      <LoadListBody s={s} columns={columns} />
      <p className="text-ink-tertiary mt-3 text-xs">{L.noTracking}</p>
      {opening && (
        <OpenLoadDialog
          shipments={[]}
          defaultWarehouseId={s.warehouseId || undefined}
          onClose={() => setOpening(false)}
        />
      )}
    </>
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
