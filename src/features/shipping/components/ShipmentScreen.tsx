"use client";

import { useState } from "react";
import { CheckCircle2, PackageX, Undo2 } from "lucide-react";

import { ADMIN_ROUTES, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import {
  allowedOutcomes,
  canAssignCarrier,
  noOutcomeReason,
} from "@/features/shipping/shipment-lifecycle";
import { useShipment } from "@/features/shipping/queries";
import { Alert } from "@/components/shared/Alert";
import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { RefetchErrorNotice } from "./primitives";
import { OutcomeDialog } from "./shipment/OutcomeDialog";
import { ShipmentDetails } from "./shipment/ShipmentDetails";
import { ShipmentInfoCard } from "./shipment/ShipmentInfoCard";
import { ShippingLoadError } from "./ShippingLoadError";
import { ShippingPermissionGate } from "./ShippingPermissionGate";
import { useShippingActor } from "./useShippingActor";

import type { DeliveryOutcome } from "@/constants";

const L = UI_LABELS.shipping.shipment;
const OUTCOME_ICON = {
  DELIVERED: CheckCircle2,
  DELIVERY_FAILED: PackageX,
  RETURNED: Undo2,
} as const;

function ShipmentBody({ id }: { id: string }) {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  const actor = useShippingActor();
  const query = useShipment(id, { enabled: canRead });
  const [outcome, setOutcome] = useState<DeliveryOutcome | null>(null);
  useBreadcrumbLabel(id, query.data?.shipment.code);

  if (!canRead) return <ShippingLoadError error={null} kind="no-read" />;
  if (query.isPending) {
    // Mất mạng khi chưa có dữ liệu → báo mạng, không skeleton mãi
    if (query.fetchStatus === "paused") {
      return <ShippingLoadError error={null} kind="network" onRetry={() => void query.refetch()} />;
    }
    return <PageSkeleton variant="detail" />;
  }
  const data = query.data;
  if (!data) return <ShippingLoadError error={query.error} onRetry={() => void query.refetch()} />;
  const { shipment } = data;
  const outcomes = allowedOutcomes(shipment, actor);

  return (
    <>
      <PageHeader
        title={`${L.title} · ${shipment.code}`}
        subtitle={UI_LABELS.shipping.noTracking}
        actions={
          <>
            <BackLink href={ADMIN_ROUTES.shipments.list} label={L.back} />
            {outcomes.map((value) => {
              const Icon = OUTCOME_ICON[value];
              return (
                <Button
                  key={value}
                  size="sm"
                  variant={value === "DELIVERED" ? "default" : "outline"}
                  onClick={() => setOutcome(value)}
                >
                  <Icon className="size-3.5" /> {L.outcomeAction[value]}
                </Button>
              );
            })}
          </>
        }
      />
      {query.isError && <RefetchErrorNotice onRetry={() => void query.refetch()} />}
      <div className="space-y-5">
        {outcomes.length === 0 && <Alert tone="info">{noOutcomeReason(shipment, actor)}</Alert>}
        <ShipmentInfoCard data={data} canAssign={canAssignCarrier(shipment, actor)} />
        <ShipmentDetails data={data} />
      </div>
      {outcome && outcomes.includes(outcome) && (
        <OutcomeDialog shipment={shipment} outcome={outcome} onClose={() => setOutcome(null)} />
      )}
    </>
  );
}

/** Chi tiết lô giao (BE `GET /fulfillment/shipments/{id}`): kiện, lịch sử, chọn hãng, ghi nhận kết quả giao. */
export function ShipmentScreen({ id }: { id: string }) {
  return (
    <ShippingPermissionGate permissions={[SHIPMENT_PERMISSIONS.viewPage]}>
      <ShipmentBody id={id} />
    </ShippingPermissionGate>
  );
}
