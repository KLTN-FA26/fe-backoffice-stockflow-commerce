"use client";

import { SUPPLIER_PERMISSIONS } from "@/constants";

import { SupplierForm } from "./SupplierForm";
import { SupplierPermissionGate } from "./SupplierPermissionGate";

export function CreateSupplierPage() {
  return (
    <SupplierPermissionGate
      permissions={[SUPPLIER_PERMISSIONS.viewPage, SUPPLIER_PERMISSIONS.create]}
    >
      <SupplierForm />
    </SupplierPermissionGate>
  );
}
