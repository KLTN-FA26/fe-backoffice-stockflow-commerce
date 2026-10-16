import { ZodError } from "zod";

import { ApiError } from "@/lib/api/error";

import {
  REMOVAL_STRATEGY_LABELS,
  INVENTORY_CONTROL_TEXT as text,
  TRACKING_MODE_LABELS,
} from "./constants";

import type { InventoryControlViewModel } from "./view-model";

type Policy = InventoryControlViewModel["policy"];

/**
 * The tracking/removal settings this save changes — exactly what BE `policies.incompatible` checks
 * against existing stock (lot, serial, expiry, FIFO receipt time, shelf life). Thresholds are not
 * part of that check, so they are never listed as the refused setting.
 */
export function operationalChanges(before: Policy, after: Policy): string[] {
  const shelf = (days: number | null) =>
    days === null ? text.unconfigured : `${days} ${text.days}`;
  const flag = (value: boolean) => (value ? text.yes : text.no);
  const changes: string[] = [];
  if (before.trackingMode !== after.trackingMode)
    changes.push(
      `${text.trackingMode}: ${TRACKING_MODE_LABELS[before.trackingMode]} → ${TRACKING_MODE_LABELS[after.trackingMode]}`,
    );
  if (before.expiryTracked !== after.expiryTracked)
    changes.push(
      `${text.expiryTracked}: ${flag(before.expiryTracked)} → ${flag(after.expiryTracked)}`,
    );
  if (before.removalStrategy !== after.removalStrategy)
    changes.push(
      `${text.removalStrategy}: ${REMOVAL_STRATEGY_LABELS[before.removalStrategy]} → ${REMOVAL_STRATEGY_LABELS[after.removalStrategy]}`,
    );
  if (before.maxShelfLifeDays !== after.maxShelfLifeDays)
    changes.push(
      `${text.maxShelfLifeDays}: ${shelf(before.maxShelfLifeDays)} → ${shelf(after.maxShelfLifeDays)}`,
    );
  return changes;
}

/** Branch on the backend `errorCode`; the backend message is its translated, per-code detail. */
export function inventoryPolicyError(error: unknown, stockChanges: readonly string[] = []) {
  if (error instanceof ZodError) return text.malformed;
  if (!(error instanceof ApiError)) return text.saveFailed;
  switch (error.code) {
    // CONFLICT is also emitted for PENDING_APPROVAL / DISCONTINUED, not only stale versions.
    case "CONFLICT":
    case "OPTIMISTIC_LOCK":
      return `${text.stateConflict} ${error.message}`;
    case "COUNT_POLICY_CONFLICT":
      return `${text.countConflict} ${error.message}`;
    case "INVENTORY_POLICY_STOCK_CONFLICT":
      return [
        `${text.stockConflict} ${error.message}`,
        ...(stockChanges.length
          ? [text.stockConflictChanges, ...stockChanges.map((c) => `• ${c}`)]
          : []),
      ].join("\n");
    case "INVENTORY_POLICY_INVALID":
      return `${text.policyInvalid} ${error.message}`;
    default:
      return error.status === 403 ? text.saveDenied : error.message;
  }
}

/** Only a stale version or a product-state change can be fixed by reloading the policy. */
export const isPolicyConflict = (error: unknown) =>
  error instanceof ApiError && (error.code === "CONFLICT" || error.code === "OPTIMISTIC_LOCK");
