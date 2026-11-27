"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { ArrowLeftRight } from "lucide-react";

import {
  BANK_TRANSACTION_LABELS,
  BANK_TRANSACTION_PERMISSIONS,
  BANK_TRANSACTION_ROUTES,
  BANK_TRANSACTION_STORAGE_KEYS,
  BANK_TRANSACTION_TABS,
} from "@/constants/bank-transaction";
import { usePagedList } from "@/hooks/use-paged-list";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";

import { useBankTransactions } from "../queries";

import { BANK_TRANSACTION_COLUMNS } from "./list-columns";
import { BANK_TRANSACTION_COPY } from "./primitives";

import type { BankTransactionTab } from "@/constants/bank-transaction";

const L = BANK_TRANSACTION_LABELS;
const NO_SORT = new Set<string>();
const TAB_ITEMS = BANK_TRANSACTION_TABS.map((value) => ({ value, label: L.tabs[value] }));

function BankTransactionListContent() {
  const router = useRouter();
  const canRead = useCan(BANK_TRANSACTION_PERMISSIONS.read);
  const paged = usePagedList(BANK_TRANSACTION_STORAGE_KEYS.listConfig, NO_SORT);
  // Tab trên URL; mặc định "Chờ xử lý" (NEEDS_REVIEW) — hàng chờ của Kế toán
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(BANK_TRANSACTION_TABS).withDefault("review"),
  );
  const query = useBankTransactions(
    {
      page: paged.apiPage,
      size: paged.pageSize,
      status: tab === "review" ? "NEEDS_REVIEW" : undefined,
    },
    { enabled: canRead },
  );
  const review = tab === "review";

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      <PageTabs<BankTransactionTab>
        tabs={TAB_ITEMS}
        value={tab}
        onChange={(next) => {
          void setTab(next);
          paged.resetPage();
        }}
        idPrefix="bank-transactions"
        ariaLabel={L.pageTitle}
      />
      <PageTabPanel idPrefix="bank-transactions" value={tab}>
        <ServerTableBody
          query={query}
          canRead={canRead}
          columns={BANK_TRANSACTION_COLUMNS}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(BANK_TRANSACTION_ROUTES.detail(row.id))}
          noun="giao dịch"
          errorCopy={BANK_TRANSACTION_COPY}
          hasFilters={false}
          onClearFilters={() => void setTab("review")}
          empty={{
            icon: <ArrowLeftRight className="size-8" />,
            title: review ? L.emptyReviewTitle : L.emptyAllTitle,
            description: review ? L.emptyReviewDescription : L.emptyAllDescription,
          }}
          pageSize={paged.pageSize}
          onPageChange={paged.goToPage}
          onPageSizeChange={paged.changePageSize}
          stickyHeader
          emptyInTable
        />
      </PageTabPanel>
    </div>
  );
}

/** Giao dịch ngân hàng SePay (phần C): hàng chờ Kế toán gán vào đợt hoặc bỏ qua; tab Tất cả để tra cứu. */
export function BankTransactionList() {
  return (
    <PermissionBoundary permissions={[BANK_TRANSACTION_PERMISSIONS.viewPage]} variant="list">
      <BankTransactionListContent />
    </PermissionBoundary>
  );
}
