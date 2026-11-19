"use client";

import { useState } from "react";

import { INVENTORY_PAGE_SIZES } from "@/constants/inventory";
import { QUARANTINE_LIMITS, QUARANTINE_LIST_LABELS } from "@/constants/quarantine";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useQuarantineCartons } from "../quarantine-queries";
import { InventoryError, InventoryInvalidPage } from "./InventoryFeedback";
import { isInvalidPage, serverPage } from "./inventory-page";
import { buildQuarantineColumns } from "./quarantine-columns";

import type { useQuarantineFilters } from "../use-quarantine-filters";

const L = QUARANTINE_LIST_LABELS;

type Filters = ReturnType<typeof useQuarantineFilters>;

/**
 * Thùng đang nằm trong một khu cách ly (WF-05 B4; BE `GET /inventory/stock-packages?location=`). Thùng không có trạng thái
 * QUARANTINE riêng — khu được lọc bằng đúng mã vị trí. Bấm LPN mở màn quyết định (gỡ cách ly / ghi giảm) của thùng đó.
 */
export function QuarantineList({ filters }: { filters: Filters }) {
  const query = useQuarantineCartons({
    location: filters.location,
    sku: filters.sku || undefined,
    page: filters.page - 1,
    size: filters.size,
  });
  const columns = buildQuarantineColumns((lpn) => void filters.openCarton(lpn));
  return (
    <section aria-label={L.title} className="space-y-[var(--card-pad)]">
      <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{L.title}</h2>
      {/* key: URL đổi (bỏ lọc, khu mặc định đổi theo kho) thì ô nhập lấy lại giá trị mới */}
      <QuarantineFilterForm key={`${filters.location}|${filters.sku}`} filters={filters} />
      {query.isFetching && !query.isLoading && (
        <div role="status" aria-label={L.fetching} className="bg-info h-1" />
      )}
      {!filters.location ? (
        <EmptyState title={L.prompt} description={L.promptDescription} />
      ) : query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <InventoryError error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <div aria-busy={query.isFetching}>
            {query.data.items.length ? (
              <DataTable
                stickyHeader
                columns={columns}
                data={query.data.items}
                rowKey={(row) => row.lpn}
                caption={L.caption}
                pageSize={filters.size}
                pageSizeOptions={INVENTORY_PAGE_SIZES}
                serverPagination={serverPage(query.data, filters)}
              />
            ) : isInvalidPage(query.data) ? (
              <InventoryInvalidPage toFirstPage={() => void filters.setPage(1)} />
            ) : filters.sku ? (
              <EmptyState
                title={L.noMatch}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void filters.applyFilters(filters.location, "")}
                  >
                    {L.reset}
                  </Button>
                }
              />
            ) : (
              <EmptyState title={L.empty} description={L.emptyDescription} />
            )}
          </div>
        )
      )}
    </section>
  );
}

function QuarantineFilterForm({ filters }: { filters: Filters }) {
  const [location, setLocation] = useState(filters.location);
  const [sku, setSku] = useState(filters.sku);
  return (
    <form
      className="flex flex-wrap items-end gap-[var(--el-gap)]"
      onSubmit={(event) => {
        event.preventDefault();
        void filters.applyFilters(location, sku);
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="quarantine-list-location" className="text-ink-secondary text-[0.8125rem]">
          {L.location}
        </Label>
        <Input
          id="quarantine-list-location"
          value={location}
          maxLength={QUARANTINE_LIMITS.locationLength}
          autoComplete="off"
          placeholder={L.locationPlaceholder}
          aria-describedby="quarantine-list-location-hint"
          className={`${FORM_INPUT_CLASS} w-[12rem] font-mono uppercase`}
          onChange={(event) => setLocation(event.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="quarantine-list-sku" className="text-ink-secondary text-[0.8125rem]">
          {L.sku}
        </Label>
        <Input
          id="quarantine-list-sku"
          value={sku}
          autoComplete="off"
          placeholder={L.skuPlaceholder}
          className={`${FORM_INPUT_CLASS} w-[14rem] font-mono uppercase`}
          onChange={(event) => setSku(event.target.value)}
        />
      </div>
      <Button type="submit" variant="outline" disabled={!location.trim()}>
        {L.apply}
      </Button>
      {filters.hasFilters && (
        <Button type="button" variant="ghost" onClick={() => void filters.reset()}>
          {L.reset}
        </Button>
      )}
      <p id="quarantine-list-location-hint" className="text-ink-tertiary w-full text-xs">
        {L.locationHint}
      </p>
    </form>
  );
}
