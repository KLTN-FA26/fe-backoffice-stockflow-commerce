"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ReceiptText } from "lucide-react";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import {
  PAYMENT_INSTALLMENT_PERMISSIONS,
  PAYMENT_ROUTES,
  PAYMENT_STORAGE_KEYS,
} from "@/constants/payment";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { Button } from "@/components/ui/button";

import { allowedInstallmentActions } from "../lifecycle";
import { installmentRef } from "../selectors";

import { INSTALLMENT_COPY } from "./copy";
import {
  buildInstallmentColumns,
  INSTALLMENT_COLUMNS,
  INSTALLMENT_DEFAULT_COLUMNS,
  INSTALLMENT_LOCKED_COLUMNS,
} from "./installment-columns";
import { InstallmentFilters } from "./InstallmentFilters";
import { InstallmentKpis } from "./InstallmentKpis";
import { useRecordedReceipt } from "./ReceiptRecordedNotice";
import { RecordReceiptDialog } from "./RecordReceiptDialog";
import { useInstallmentListState } from "./useInstallmentListState";

import type { Installment } from "../types";

const L = PAYMENT_LABELS.installments;

function InstallmentListContent() {
  const router = useRouter();
  const can = usePermissionChecker();
  const canRead = useCan(PAYMENT_INSTALLMENT_PERMISSIONS.read);
  const s = useInstallmentListState(canRead);
  const [recording, setRecording] = useState<Installment | null>(null);
  const recorded = useRecordedReceipt();
  const columnState = useColumnVisibility(
    PAYMENT_STORAGE_KEYS.installmentsColumns,
    INSTALLMENT_COLUMNS,
    { defaults: INSTALLMENT_DEFAULT_COLUMNS, locked: INSTALLMENT_LOCKED_COLUMNS },
  );
  const columns = buildInstallmentColumns((row) =>
    allowedInstallmentActions(row, can).includes("recordReceipt") ? (
      // Tên truy cập mang hợp đồng + đợt: mỗi dòng một menu phân biệt được (BO-UX-11)
      <RowActionsMenu
        label={`Thao tác — ${row.contractNumber} ${installmentRef(row)}`}
        actions={[
          {
            label: PAYMENT_LABELS.receipts.createAction,
            icon: ReceiptText,
            onSelect: () => setRecording(row),
          },
        ]}
      />
    ) : null,
  ).filter((column) => columnState.visible.some((key) => key === column.key));

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {recorded.notice && <div className="mb-3">{recorded.notice}</div>}
      <InstallmentKpis canRead={canRead} />
      {canRead && <InstallmentFilters s={s} columns={columnState} />}
      <ServerTableBody
        query={s.query}
        canRead={canRead}
        columns={columns}
        rowKey={(row) => row.installmentId}
        onRowClick={(row) => router.push(PAYMENT_ROUTES.installments.detail(row.installmentId))}
        flagRow={(row) => row.overdue}
        noun="đợt thanh toán"
        errorCopy={INSTALLMENT_COPY}
        hasFilters={s.hasFilters && !s.defaultQueue}
        onClearFilters={s.clearFilters}
        empty={
          s.defaultQueue
            ? {
                icon: <CalendarClock className="size-8" />,
                title: L.emptyQueueTitle,
                description: L.emptyQueueDescription,
                action: (
                  <Button type="button" variant="outline" size="sm" onClick={s.clearFilters}>
                    {L.showAll}
                  </Button>
                ),
              }
            : {
                icon: <CalendarClock className="size-8" />,
                title: L.emptyTitle,
                description: L.emptyDescription,
              }
        }
        pageSize={s.pageSize}
        onPageChange={s.goToPage}
        onPageSizeChange={s.changePageSize}
        sorting={s.sorting}
        stickyHeader
      />
      <RecordReceiptDialog
        installment={recording}
        onClose={() => setRecording(null)}
        onRecorded={recorded.onRecorded}
      />
    </div>
  );
}

/** Danh sách đợt thanh toán của hợp đồng đã ký (docs 15 §4.1, §5.1): lọc, theo dõi quá hạn, lập phiếu thu. */
export function InstallmentList() {
  return (
    <PermissionBoundary permissions={[PAYMENT_INSTALLMENT_PERMISSIONS.viewPage]} variant="list">
      <InstallmentListContent />
    </PermissionBoundary>
  );
}
