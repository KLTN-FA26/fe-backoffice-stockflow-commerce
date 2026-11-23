"use client";

import { ArrowLeft } from "lucide-react";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { STOCK_PACKAGE_PERMISSIONS, WAREHOUSE_LOCATION_PERMISSIONS } from "@/constants/permissions";
import { QUARANTINE_LABELS, QUARANTINE_LIMITS } from "@/constants/quarantine";

import { usePermissionChecker } from "@/lib/auth";
import { formatDateTime } from "@/lib/format/date";
import { useWarehouseAreas } from "@/lib/references/warehouse-layout";
import { useAppStore } from "@/lib/store/use-app-store";

import { ScanInput } from "@/components/backoffice/ScanInput";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { quarantineActionError } from "../quarantine-errors";
import { cartonStatusLabel, isOpenedOnReturn, isQuarantined } from "../quarantine-lifecycle";
import { useCarton } from "../quarantine-queries";
import { cartonLookupInput } from "../quarantine-schemas";
import { useQuarantineFilters } from "../use-quarantine-filters";
import { InventoryOffline } from "./InventoryFeedback";
import { InventoryPermissionGate } from "./InventoryPermissionGate";
import { QuarantineActions } from "./QuarantineActions";
import { QuarantineList } from "./QuarantineList";

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

/** Khu QUARANTINE đầu tiên của kho đang chọn — mặc định cho danh sách (cần `warehouse-locations:READ`, như phiếu nhận hàng hoàn). */
function useDefaultQuarantineArea(): string | null {
  const can = usePermissionChecker();
  const warehouseId = useAppStore((state) => state.warehouseId);
  const areas = useWarehouseAreas(
    warehouseId ?? undefined,
    can(WAREHOUSE_LOCATION_PERMISSIONS.read),
  );
  return areas.data?.find((area) => area.type === "QUARANTINE")?.locationCode ?? null;
}

function QuarantineDecisionContent() {
  // LPN, khu và SKU trên URL: F5 / sao chép link giữ nguyên thùng / khu đang xem (state-persistence).
  const filters = useQuarantineFilters(useDefaultQuarantineArea());
  const parsed = cartonLookupInput.safeParse({ lpn: filters.lpn });
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
        onScan={(code) => void filters.openCarton(code.toUpperCase())}
      />
      {!parsed.success ? (
        <QuarantineList filters={filters} />
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void filters.closeCarton()}
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" /> {L.backToList}
          </Button>
          {carton.isLoading ? (
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
        </>
      )}
    </div>
  );
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
    ...(isOpenedOnReturn(carton)
      ? ([
          [
            L.openedOnReturn,
            carton.returnOpenedAt ? formatDateTime(carton.returnOpenedAt) : L.openedOnReturnYes,
          ],
        ] as const)
      : []),
  ];
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
