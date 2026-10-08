"use client";

import { createInventoryMockService } from "../mock-service";
import { InventoryAccess } from "./InventoryAccess";

const service = createInventoryMockService();

/** Explicit demo adapter until the inventory read contracts are finalized. */
export function InventoryRoute() {
  return <InventoryAccess service={service} />;
}
