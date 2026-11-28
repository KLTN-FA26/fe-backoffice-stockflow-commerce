"use client";

import { SalesPickerField } from "@/components/backoffice/SalesPickerField";
import { Checkbox } from "@/components/ui/checkbox";

import type { SalesOption } from "@/lib/references/sales-workload";
import type { useContractListFilters } from "./contract-list-filters";

export function ContractListFacets({
  filters,
  sales,
}: {
  filters: ReturnType<typeof useContractListFilters>;
  sales: { options: readonly SalesOption[] | null | undefined };
}) {
  const { values, set } = filters;
  return (
    <div className="flex flex-wrap items-end gap-3">
      {sales.options?.length || values.salesOwnerId ? (
        <div className="w-full sm:w-60">
          <SalesPickerField
            id="contract-sales-owner"
            label="Sale phụ trách"
            value={values.salesOwnerId}
            options={sales.options ?? []}
            onChange={(salesOwnerId) => set({ salesOwnerId, mine: false })}
          />
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={values.mine}
          onCheckedChange={(checked) => set({ mine: checked === true, salesOwnerId: "" })}
        />
        Của tôi
      </label>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={!!values.signByBefore}
          onCheckedChange={(checked) => set({ signByBefore: checked ? filters.soonDate : "" })}
        />
        Sắp hết hạn ký (7 ngày)
      </label>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={values.termsReview === "PENDING"}
          onCheckedChange={(checked) => set({ termsReview: checked ? "PENDING" : "" })}
        />
        Chờ duyệt điều khoản
      </label>
    </div>
  );
}
