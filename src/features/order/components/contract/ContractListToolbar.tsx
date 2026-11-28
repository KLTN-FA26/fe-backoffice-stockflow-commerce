"use client";

import { SALES_CONTRACT_STATUSES, SALES_CONTRACT_STATUS_LABELS } from "@/constants";
import { useAssignableSales } from "@/lib/references/sales-agents";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { ContractListFacets } from "./ContractListFacets";

import type { useContractListFilters } from "./contract-list-filters";

const STATUS_OPTIONS = SALES_CONTRACT_STATUSES.map((value) => ({
  value,
  label: SALES_CONTRACT_STATUS_LABELS[value],
}));
export function ContractListToolbar({
  filters,
  showStats,
  onToggleStats,
}: {
  filters: ReturnType<typeof useContractListFilters>;
  showStats: boolean;
  onToggleStats: () => void;
}) {
  const { values, set } = filters;
  const sales = useAssignableSales(true);
  return (
    <ListToolbar
      search={values.q}
      onSearchChange={(q) => set({ q })}
      searchPlaceholder="Tìm mã hợp đồng, đơn hàng, khách hàng…"
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={values.status}
      onToggleStatus={(status) =>
        set({
          status: values.status.includes(status)
            ? values.status.filter((s) => s !== status)
            : [...values.status, status],
        })
      }
      onClearStatuses={() => set({ status: [] })}
      hasStatusFilter={!!values.status.length}
      actions={
        <Button variant="outline" onClick={onToggleStats}>
          {showStats ? "Ẩn thống kê" : "Hiện thống kê"}
        </Button>
      }
      facets={<ContractListFacets filters={filters} sales={sales} />}
      summaryItems={[
        {
          label: "Trạng thái",
          value: values.status
            .map(
              (s) =>
                SALES_CONTRACT_STATUS_LABELS[s as keyof typeof SALES_CONTRACT_STATUS_LABELS] ??
                "Không rõ",
            )
            .join(", "),
          active: !!values.status.length,
          onClear: () => set({ status: [] }),
        },
        { label: "Tìm kiếm", value: values.q, active: !!values.q, onClear: () => set({ q: "" }) },
        {
          label: "Sale phụ trách",
          value: sales.options?.find((s) => s.userId === values.salesOwnerId)?.name ?? "Đang lọc",
          active: !!values.salesOwnerId,
          onClear: () => set({ salesOwnerId: "" }),
        },
        {
          label: "Của tôi",
          value: "Có",
          active: values.mine,
          onClear: () => set({ mine: false }),
        },
        {
          label: "Hạn ký",
          value: values.signByBefore,
          active: !!values.signByBefore,
          onClear: () => set({ signByBefore: "" }),
        },
        {
          label: "Điều khoản",
          value: "Chờ duyệt",
          active: !!values.termsReview,
          onClear: () => set({ termsReview: "" }),
        },
      ]}
      onResetAll={filters.reset}
      resetDisabled={!filters.hasFilters}
    />
  );
}
