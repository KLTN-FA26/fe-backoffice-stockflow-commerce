"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ReceiptText } from "lucide-react";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_INSTALLMENT_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { allowedInstallmentActions } from "../lifecycle";

import { INSTALLMENT_COPY } from "./copy";
import { buildInstallmentColumns } from "./installment-columns";
import { InstallmentFilters } from "./InstallmentFilters";
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
  const columns = buildInstallmentColumns((row) =>
    allowedInstallmentActions(row, can).includes("recordReceipt") ? (
      <Button
        type="button"
        size="xs"
        variant="outline"
        className={TOOLBAR_ACTION_CLASS}
        onClick={(event) => {
          event.stopPropagation();
          setRecording(row);
        }}
      >
        <ReceiptText className="size-3.5" /> {PAYMENT_LABELS.receipts.createAction}
      </Button>
    ) : null,
  );

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {canRead && <InstallmentFilters s={s} />}
      <ServerTableBody
        query={s.query}
        canRead={canRead}
        columns={columns}
        rowKey={(row) => row.installmentId}
        onRowClick={(row) => router.push(PAYMENT_ROUTES.installments.detail(row.installmentId))}
        flagRow={(row) => row.status === "OVERDUE"}
        noun="đợt thanh toán"
        errorCopy={INSTALLMENT_COPY}
        hasFilters={s.hasFilters}
        onClearFilters={s.clearFilters}
        empty={{
          icon: <CalendarClock className="size-8" />,
          title: L.emptyTitle,
          description: L.emptyDescription,
        }}
        pageSize={s.pageSize}
        onPageChange={s.goToPage}
        onPageSizeChange={s.changePageSize}
        sorting={s.sorting}
      />
      <RecordReceiptDialog installment={recording} onClose={() => setRecording(null)} />
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
