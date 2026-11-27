"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { ArrowLeftRight, Eye, Link2 } from "lucide-react";

import {
  BANK_TRANSACTION_LABELS,
  BANK_TRANSACTION_PERMISSIONS,
  BANK_TRANSACTION_ROUTES,
  BANK_TRANSACTION_STORAGE_KEYS,
  BANK_TRANSACTION_TABS,
} from "@/constants/bank-transaction";
import { usePagedList } from "@/hooks/use-paged-list";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { HeaderDateRangeFilter, withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { ListConfigSummary } from "@/components/shared/ListConfigSummary";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";

import { allowedBankTransactionActions } from "../lifecycle";
import { useBankTransactions } from "../queries";

import { AssignDialog } from "./AssignDialog";
import { BANK_TRANSACTION_COLUMNS } from "./list-columns";
import { BANK_TRANSACTION_COPY } from "./primitives";

import type { BankTransactionTab } from "@/constants/bank-transaction";
import type { RowAction } from "@/components/shared/RowActionsMenu";
import type { BankTransaction } from "../types";

const L = BANK_TRANSACTION_LABELS;
const NO_SORT = new Set<string>();

/** Ngày trên URL sai định dạng → chip hiện nguyên chữ (`formatDate` ném lỗi). */
function dayLabel(day: string): string {
  try {
    return formatDate(day);
  } catch {
    return day;
  }
}

function BankTransactionListContent() {
  const router = useRouter();
  const canRead = useCan(BANK_TRANSACTION_PERMISSIONS.read);
  const can = usePermissionChecker();
  const paged = usePagedList(BANK_TRANSACTION_STORAGE_KEYS.listConfig, NO_SORT);
  // Tab trên URL; mặc định "Chờ xử lý" (NEEDS_REVIEW) — hàng chờ của Kế toán
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(BANK_TRANSACTION_TABS).withDefault("review"),
  );
  // Ngày ngân hàng ghi (BE `from` / `to`), lọc ở header cột "Thời điểm"
  const [from, setFrom] = useQueryState("from", parseAsString.withDefault(""));
  const [to, setTo] = useQueryState("to", parseAsString.withDefault(""));
  const [assigning, setAssigning] = useState<BankTransaction | null>(null);
  const review = tab === "review";
  const query = useBankTransactions(
    {
      page: paged.apiPage,
      size: paged.pageSize,
      status: review ? "NEEDS_REVIEW" : undefined,
      from: from || undefined,
      to: to || undefined,
    },
    { enabled: canRead },
  );
  // Số giao dịch chờ xử lý cho tab (cả hàng chờ, không theo lọc ngày): một trang 1 dòng, đọc `totalElements`
  const pending = useBankTransactions(
    { page: 0, size: 1, status: "NEEDS_REVIEW" },
    { enabled: canRead },
  );
  const hasFilters = !!from || !!to;
  const clearDates = () => {
    void setFrom("");
    void setTo("");
    paged.resetPage();
  };

  const tabs = BANK_TRANSACTION_TABS.map((value) => ({
    value,
    label: L.tabs[value],
    count: value === "review" ? pending.data?.totalElements : undefined,
  }));

  const columns = [
    ...withHeaderFilters(BANK_TRANSACTION_COLUMNS, {
      transactionAt: (
        <HeaderDateRangeFilter
          label={L.dateFilterLabel}
          from={from}
          to={to}
          onChange={(range) => {
            void setFrom(range.from);
            void setTo(range.to);
            paged.resetPage();
          }}
        />
      ),
    }),
    rowActionsColumn<BankTransaction>((row) => {
      const actions: RowAction[] = [
        { label: L.viewDetail, icon: Eye, href: BANK_TRANSACTION_ROUTES.detail(row.id) },
      ];
      if (allowedBankTransactionActions(row.status, can).includes("assign"))
        actions.push({ label: L.assignAction, icon: Link2, onSelect: () => setAssigning(row) });
      return { label: L.rowActions(formatMoney(row.amount, row.currency)), actions };
    }),
  ];

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      <PageTabs<BankTransactionTab>
        tabs={tabs}
        value={tab}
        onChange={(next) => {
          void setTab(next);
          paged.resetPage();
        }}
        idPrefix="bank-transactions"
        ariaLabel={L.pageTitle}
      />
      <PageTabPanel idPrefix="bank-transactions" value={tab}>
        <ListConfigSummary
          items={[
            {
              label: L.dateChip,
              value: `${from ? dayLabel(from) : "…"} – ${to ? dayLabel(to) : "…"}`,
              active: hasFilters,
              onClear: clearDates,
            },
          ]}
          onResetAll={clearDates}
          resetDisabled={!hasFilters}
        />
        <ServerTableBody
          query={query}
          canRead={canRead}
          columns={columns}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(BANK_TRANSACTION_ROUTES.detail(row.id))}
          noun="giao dịch"
          errorCopy={BANK_TRANSACTION_COPY}
          hasFilters={hasFilters}
          onClearFilters={clearDates}
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
      {assigning && <AssignDialog transaction={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
}

/**
 * Giao dịch ngân hàng SePay (phần C): hàng chờ Kế toán gán vào đợt hoặc bỏ qua (tab có số đếm); tab Tất cả để tra cứu.
 * Lọc theo ngày ngân hàng ghi ở header cột "Thời điểm" (BE `from` / `to`); BE chưa lọc theo số tiền.
 */
export function BankTransactionList() {
  return (
    <PermissionBoundary permissions={[BANK_TRANSACTION_PERMISSIONS.viewPage]} variant="list">
      <BankTransactionListContent />
    </PermissionBoundary>
  );
}
