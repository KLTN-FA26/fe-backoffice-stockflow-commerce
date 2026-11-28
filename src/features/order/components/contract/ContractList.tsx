"use client";

import { FileSignature } from "lucide-react";

import { SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { CONTRACT_ESIGN_LABELS as L, CONTRACT_ESIGN_PATHS as P } from "@/constants/contract-esign";

import { usePageConfig } from "@/hooks/use-page-config";

import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { LIST_PAGE_SIZE_OPTIONS } from "@/components/backoffice/ServerTableBody";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { useContractList, useContractSummary } from "../../sales-contract-esign-queries";

import { ContractListStats } from "./ContractListStats";

import { ContractListToolbar } from "./ContractListToolbar";

import { CONTRACT_LIST_COLUMNS } from "./contract-list-columns";
import { useContractListFilters } from "./contract-list-filters";

const ERROR_COPY = {
  pageTitle: L.title,
  notFoundTitle: L.unavailable,
  notFoundDescription: "Danh sách hợp đồng chưa được cung cấp.",
  forbiddenDescription: "Bạn không có quyền xem hợp đồng.",
  noReadDescription: "Bạn không có quyền xem hợp đồng.",
};

function ContractListContent() {
  const filters = useContractListFilters();
  const { paged } = filters;
  const query = useContractList(filters.params);
  const { config, updateConfig } = usePageConfig(
    P.statsStorage,
    { showStats: false },
    (stored, fallback) => ({
      showStats: typeof stored.showStats === "boolean" ? stored.showStats : fallback.showStats,
    }),
  );
  const showStats = config.showStats;
  const summary = useContractSummary(showStats);
  if (query.data === null)
    return (
      <EmptyState
        icon={<FileSignature />}
        title={L.unavailable}
        description="Danh sách hợp đồng chưa được cung cấp."
      />
    );
  const page = query.data;
  return (
    <div className="surface-soft space-y-3">
      <h1 className="sr-only">{L.title}</h1>
      <ContractListToolbar
        filters={filters}
        showStats={showStats}
        onToggleStats={() => updateConfig((current) => ({ showStats: !current.showStats }))}
      />
      {showStats && summary.isPending && <PageSkeleton variant="list" />}
      {showStats && summary.isError && (
        <LoadErrorState
          inline
          error={summary.error}
          copy={ERROR_COPY}
          onRetry={() => void summary.refetch()}
        />
      )}
      {showStats && summary.data && <ContractListStats summary={summary.data} />}
      {query.isPending ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <LoadErrorState
          inline
          error={query.error}
          copy={ERROR_COPY}
          onRetry={() => void query.refetch()}
        />
      ) : (
        page && (
          <>
            <RefetchBar active={query.isFetching} label="Đang tải lại danh sách hợp đồng" />
            <DataTable
              columns={CONTRACT_LIST_COLUMNS}
              data={page.items}
              rowKey={(row) => row.contractId ?? row.orderId ?? ""}
              stickyHeader
              caption={`Hiển thị ${page.items.length} / ${page.totalElements} hợp đồng`}
              pageSize={paged.pageSize}
              pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
              serverPagination={{
                ...page,
                onPageChange: paged.goToPage,
                onPageSizeChange: paged.changePageSize,
              }}
              emptyState={
                <EmptyState
                  title={filters.hasFilters ? "Không tìm thấy kết quả" : "Chưa có hợp đồng"}
                  description={
                    filters.hasFilters
                      ? "Không có hợp đồng khớp bộ lọc hiện tại."
                      : "Lập hợp đồng từ tab Hợp đồng của đơn hàng."
                  }
                  action={
                    filters.hasFilters ? (
                      <Button variant="outline" onClick={filters.reset}>
                        Bỏ bộ lọc
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </>
        )
      )}
    </div>
  );
}
export function ContractList() {
  return (
    <PermissionBoundary permissions={[SALES_CONTRACT_PERMISSIONS.read]} variant="list">
      <ContractListContent />
    </PermissionBoundary>
  );
}
