"use client";

import { parseAsString, useQueryState } from "nuqs";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { STOCK_PACKAGE_PERMISSIONS } from "@/constants/permissions";
import { STOCK_PACKAGE_API_STATUSES, STOCK_PACKAGE_STATUS_BY_API } from "@/constants/statuses";
import { QUARANTINE_LABELS, QUARANTINE_LIMITS } from "@/constants/quarantine";

import { ScanInput } from "@/components/backoffice/ScanInput";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { quarantineActionError } from "../quarantine-errors";
import { isQuarantined } from "../quarantine-lifecycle";
import { useCarton } from "../quarantine-queries";
import { cartonLookupInput } from "../quarantine-schemas";
import { InventoryOffline } from "./InventoryFeedback";
import { InventoryPermissionGate } from "./InventoryPermissionGate";
import { QuarantineActions } from "./QuarantineActions";

import type { StockPackageDetail } from "../quarantine-types";

const L = QUARANTINE_LABELS;

export function QuarantineDecision() {
  return (
    <InventoryPermissionGate
      allOf={[STOCK_PACKAGE_PERMISSIONS.viewPage, STOCK_PACKAGE_PERMISSIONS.read]}
      variant="form"
    >
      <QuarantineDecisionContent />
    </InventoryPermissionGate>
  );
}

function QuarantineDecisionContent() {
  // LPN trên URL: F5 / sao chép link giữ nguyên thùng đang xem (state-persistence).
  const [lpn, setLpn] = useQueryState("lpn", parseAsString.withDefault(""));
  const parsed = cartonLookupInput.safeParse({ lpn });
  const carton = useCarton(parsed.success ? parsed.data.lpn : "");
  return (
    <div className="surface-soft surface-compact space-y-[var(--card-pad)]">
      <h1 className="sr-only">{L.title}</h1>
      <InventoryOffline />
      <ScanInput
        id="quarantine-lpn"
        label={L.lookupLabel}
        placeholder={L.lookupPlaceholder}
        maxLength={QUARANTINE_LIMITS.lpnLength}
        onScan={(code) => void setLpn(code.toUpperCase())}
      />
      {!parsed.success ? (
        <EmptyState title={L.prompt} description={L.promptDescription} />
      ) : carton.isLoading ? (
        <PageSkeleton variant="detail" />
      ) : carton.isError ? (
        <EmptyState
          title={L.loadError}
          description={quarantineActionError(carton.error).detail}
          action={
            <Button type="button" variant="outline" onClick={() => void carton.refetch()}>
              {INVENTORY_LABELS.retry}
            </Button>
          }
        />
      ) : (
        carton.data && <CartonCard carton={carton.data} />
      )}
    </div>
  );
}

// Trạng thái thùng BE → chuỗi của StatusDot; VOID (không có trong bảng) và mã lạ hiện nguyên văn.
function cartonStatusLabel(status: string): string {
  const known = STOCK_PACKAGE_API_STATUSES.find((value) => value === status);
  return known ? STOCK_PACKAGE_STATUS_BY_API[known] : status;
}

function CartonCard({ carton }: { carton: StockPackageDetail }) {
  const facts = [
    [L.lpn, carton.lpn],
    [L.sku, carton.sku],
    [L.lot, carton.lotNumber],
    [L.location, carton.locationCode],
    [L.onHand, carton.onHand.toLocaleString("vi-VN")],
    [L.reserved, carton.reserved.toLocaleString("vi-VN")],
    [L.stockStatus, isQuarantined(carton) ? L.quarantined : L.notQuarantined],
  ] as const;
  return (
    <div className="space-y-[var(--card-pad)]">
      <StatusDot domain="stock" status={cartonStatusLabel(carton.status)} />
      <dl className="border-border-default bg-bg-surface grid grid-cols-1 gap-[var(--card-pad)] rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow) md:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-ink-secondary text-sm">{label}</dt>
            <dd className="break-words tabular-nums">{value ?? L.missing}</dd>
          </div>
        ))}
      </dl>
      <QuarantineActions carton={carton} />
    </div>
  );
}
