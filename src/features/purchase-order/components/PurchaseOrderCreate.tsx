"use client";

import { PO_PERMISSIONS, UI_LABELS } from "@/constants";

import { PoWizardLayout } from "./create/PoWizardLayout";
import { useCreateForm } from "./create/useCreateForm";
import { PoPermissionGate } from "./PoPermissionGate";

export function PurchaseOrderCreate() {
  return (
    <PoPermissionGate permissions={[PO_PERMISSIONS.viewPage, PO_PERMISSIONS.create]} variant="form">
      <PurchaseOrderCreateBody />
    </PoPermissionGate>
  );
}

function PurchaseOrderCreateBody() {
  const w = useCreateForm();
  return <PoWizardLayout w={w} title={UI_LABELS.purchaseOrder.createAction} />;
}
