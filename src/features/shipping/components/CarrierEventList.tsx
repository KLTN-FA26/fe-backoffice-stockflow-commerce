"use client";

import { RadioTower } from "lucide-react";

import {
  CARRIER_EVENT_PAGE_SIZES,
  FULFILLMENT_CARRIER_EVENT_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { CARRIER_EVENT_ALL_FILTER } from "@/features/shipping/carrier-event-lifecycle";
import { useCan } from "@/lib/auth";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { buildCarrierEventColumns } from "./carrier-event/carrier-event-columns";
import { CarrierEventDialog } from "./carrier-event/CarrierEventDialog";
import { CarrierEventFilters } from "./carrier-event/CarrierEventFilters";
import { CarrierEventSummary } from "./carrier-event/CarrierEventSummary";
import { useCarrierEventListState } from "./carrier-event/useCarrierEventListState";
import { RefetchErrorNotice } from "./primitives";
import { ShippingLoadError } from "./ShippingLoadError";
import { ShippingPermissionGate } from "./ShippingPermissionGate";

import type { CarrierEventListState } from "./carrier-event/useCarrierEventListState";

const E = UI_LABELS.shipping.carrierEvents;
const EMPTY = UI_LABELS.emptyList;

function EmptyBody({ s }: { s: CarrierEventListState }) {
  const icon = <RadioTower className="size-8" />;
  if (s.emptyState === "no-errors") {
    return (
      <EmptyState
        icon={icon}
        title={E.empty.noErrorsTitle}
        description={E.empty.noErrorsDescription}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => s.setResult(CARRIER_EVENT_ALL_FILTER)}
          >
            {E.empty.seeAll}
          </Button>
        }
      />
    );
  }
  if (s.emptyState === "no-data") {
    return (
      <EmptyState icon={icon} title={E.empty.noDataTitle} description={E.empty.noDataDescription} />
    );
  }
  const invalidPage = s.emptyState === "invalid-page";
  return (
    <EmptyState
      icon={icon}
      title={invalidPage ? EMPTY.invalidPageTitle : EMPTY.noResultsTitle}
      description={invalidPage ? EMPTY.invalidPageDescription : E.empty.noResultsDescription}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => (invalidPage ? s.setPage(1) : s.clearFilters())}
        >
          {invalidPage ? EMPTY.firstPage : EMPTY.clearFilters}
        </Button>
      }
    />
  );
}

function CarrierEventListContent() {
  const canRead = useCan(FULFILLMENT_CARRIER_EVENT_PERMISSIONS.read);
  const canLink = useCan(SHIPMENT_PERMISSIONS.viewPage);
  const s = useCarrierEventListState(canRead);
  const { query } = s;
  const page = query.data;
  const columns = buildCarrierEventColumns((row) => s.openEvent(row.eventId), canLink);

  let body: React.ReactNode;
  if (!canRead) {
    body = <ShippingLoadError inline error={null} kind="no-read" />;
  } else if (query.isError && !page) {
    body = <ShippingLoadError inline error={query.error} onRetry={() => void query.refetch()} />;
  } else if (query.isPending || !page) {
    body = <PageSkeleton variant="list" />;
  } else if (s.emptyState !== "none") {
    body = <EmptyBody s={s} />;
  } else {
    body = (
      <>
        <RefetchBar active={query.isFetching} label={E.refetching} />
        <DataTable
          stickyHeader
          columns={columns}
          data={page.items}
          rowKey={(row) => row.eventId}
          onRowClick={(row) => s.openEvent(row.eventId)}
          caption={`${UI_LABELS.common.showing} ${page.items.length} / ${page.totalElements} ${E.listCaption}`}
          pageSize={s.size}
          pageSizeOptions={[...CARRIER_EVENT_PAGE_SIZES]}
          serverPagination={{
            page: page.page,
            size: page.size,
            totalElements: page.totalElements,
            totalPages: page.totalPages,
            hasNext: page.hasNext,
            hasPrevious: page.hasPrevious,
            onPageChange: (p) => s.setPage(p + 1),
            onPageSizeChange: s.setPageSize,
          }}
        />
      </>
    );
  }

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{E.title}</h1>
      {canRead && <CarrierEventFilters s={s} />}
      {canRead && <CarrierEventSummary s={s} />}
      {query.isError && page && <RefetchErrorNotice onRetry={() => void query.refetch()} />}
      {body}
      {s.eventId && <CarrierEventDialog eventId={s.eventId} onClose={s.closeEvent} />}
    </div>
  );
}

/**
 * Nhật ký sự kiện webhook và danh sách lỗi của hãng vận chuyển (docs 09 §3 Output, §4.5 bước 2, 8): xem mọi sự kiện, mặc
 * định là danh sách lỗi; mở một sự kiện để xem nội dung hãng gửi và đánh dấu đã xử lý kèm ghi chú. BE không có thao tác áp
 * lại sự kiện. Quyền: `fulfillment-carrier-events:READ` để xem, `:UPDATE` để đánh dấu. Backend phải re-check.
 */
export function CarrierEventList() {
  return (
    <ShippingPermissionGate
      permissions={[FULFILLMENT_CARRIER_EVENT_PERMISSIONS.read]}
      variant="list"
    >
      <CarrierEventListContent />
    </ShippingPermissionGate>
  );
}
