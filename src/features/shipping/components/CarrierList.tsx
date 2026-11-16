"use client";

import { useState } from "react";
import { Plus, Truck } from "lucide-react";

import { SHIPMENT_PERMISSIONS, PAGE_SIZE, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { carrierActions } from "@/features/shipping/carrier-lifecycle";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { SearchBar } from "@/components/shared/SearchBar";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { buildCarrierColumns } from "./carrier/carrier-columns";
import { CarrierFormDialog } from "./carrier/CarrierFormDialog";
import { useCarrierListState } from "./carrier/useCarrierListState";
import { RefetchErrorNotice } from "./primitives";
import { ShippingLoadError } from "./ShippingLoadError";
import { ShippingPermissionGate } from "./ShippingPermissionGate";
import { useShippingActor } from "./useShippingActor";

import type { Carrier } from "@/features/shipping/types";

const C = UI_LABELS.shipping.waybill.carriers;
const E = UI_LABELS.emptyList;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-[12rem] rounded-[var(--r-sm)] text-[0.8125rem]";

type Dialog = { kind: "create" } | { kind: "edit"; carrier: Carrier } | null;

function CarrierListContent() {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  const actor = useShippingActor();
  const actions = carrierActions(actor);
  const s = useCarrierListState(canRead);
  const [dialog, setDialog] = useState<Dialog>(null);
  const columns = buildCarrierColumns(
    actions.edit ? (carrier) => setDialog({ kind: "edit", carrier }) : null,
  );
  const { query } = s;
  const page = query.data;

  let body: React.ReactNode;
  if (!canRead) {
    body = <ShippingLoadError inline error={null} kind="no-read" />;
  } else if (query.isError && !page) {
    body = <ShippingLoadError inline error={query.error} onRetry={() => void query.refetch()} />;
  } else if (query.isPending || !page) {
    body = <PageSkeleton variant="list" />;
  } else if (s.emptyState === "no-carriers") {
    body = (
      <EmptyState
        icon={<Truck className="size-8" />}
        title={C.empty.noDataTitle}
        description={actions.create ? C.empty.noDataDescription : C.empty.noDataDescriptionReadOnly}
      />
    );
  } else if (s.emptyState === "no-results" || s.emptyState === "invalid-page") {
    const invalidPage = s.emptyState === "invalid-page";
    body = (
      <EmptyState
        icon={<Truck className="size-8" />}
        title={invalidPage ? E.invalidPageTitle : E.noResultsTitle}
        description={invalidPage ? E.invalidPageDescription : C.empty.noResultsDescription}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (invalidPage ? s.setPage(1) : s.clearFilters())}
          >
            {invalidPage ? E.firstPage : E.clearFilters}
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        <RefetchBar active={query.isFetching} label={C.refetching} />
        <DataTable
          stickyHeader
          columns={columns}
          data={page.items}
          rowKey={(row) => row.carrierId}
          caption={`${UI_LABELS.common.showing} ${page.items.length} / ${page.totalElements} ${C.listCaption}`}
          pageSize={PAGE_SIZE.md}
          pageSizeOptions={[PAGE_SIZE.md]}
          serverPagination={{
            page: page.page,
            size: page.size,
            totalElements: page.totalElements,
            totalPages: page.totalPages,
            hasNext: page.hasNext,
            hasPrevious: page.hasPrevious,
            onPageChange: (p) => s.setPage(p + 1),
            onPageSizeChange: () => undefined,
          }}
        />
      </>
    );
  }

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{C.title}</h1>
      {canRead && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <SearchBar
            value={s.q}
            onChange={s.setQ}
            placeholder={C.searchPlaceholder}
            aria-label={C.searchPlaceholder}
            className="max-w-xs"
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="carrier-status-filter" className="text-ink-secondary text-[0.8125rem]">
              {C.statusFilter}
            </Label>
            <Select value={s.status} onValueChange={s.setStatus}>
              <SelectTrigger id="carrier-status-filter" className={TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <TitledSelectContent title={C.statusFilter}>
                <SelectItem value="ALL">{C.all}</SelectItem>
                <SelectItem value="ACTIVE">{C.status.ACTIVE}</SelectItem>
                <SelectItem value="INACTIVE">{C.status.INACTIVE}</SelectItem>
              </TitledSelectContent>
            </Select>
          </div>
          {s.hasFilters && (
            <Button type="button" variant="ghost" size="xs" onClick={s.clearFilters}>
              {C.clearFilters}
            </Button>
          )}
          {actions.create && (
            <Button
              size="sm"
              className={`ml-auto ${TOOLBAR_ACTION_CLASS} bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse`}
              onClick={() => setDialog({ kind: "create" })}
            >
              <Plus className="size-3.5" /> {C.create}
            </Button>
          )}
        </div>
      )}
      {query.isError && page && <RefetchErrorNotice onRetry={() => void query.refetch()} />}
      {body}
      {dialog && (
        <CarrierFormDialog
          carrier={dialog.kind === "edit" ? dialog.carrier : null}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

/** Danh mục hãng vận chuyển (docs 09 §4.1): danh sách, thêm / sửa hãng (quản lý kho — `fulfillment-carriers:UPDATE`). */
export function CarrierList() {
  return (
    <ShippingPermissionGate permissions={[SHIPMENT_PERMISSIONS.viewPage]} variant="list">
      <CarrierListContent />
    </ShippingPermissionGate>
  );
}
