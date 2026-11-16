"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FileText } from "lucide-react";

import { EINVOICE_PERMISSIONS, EINVOICE_ROUTES } from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { needsAttention } from "../selectors";

import { EINVOICE_COPY } from "./copy";
import { DrawUpDialog } from "./DrawUpDialog";
import { EINVOICE_COLUMNS } from "./einvoice-columns";
import { EInvoiceFilters } from "./EInvoiceFilters";
import { useEInvoiceListState } from "./useEInvoiceListState";

const L = EINVOICE_LABELS.list;

function EInvoiceListContent() {
  const router = useRouter();
  const canRead = useCan(EINVOICE_PERMISSIONS.read);
  const canCreate = useCan(EINVOICE_PERMISSIONS.create);
  const s = useEInvoiceListState(canRead);
  const [drawingFor, setDrawingFor] = useState<string | null>(null);

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {canRead && (
        <EInvoiceFilters
          s={s}
          actions={
            canCreate && s.orderId ? (
              <Button
                type="button"
                size="sm"
                className={TOOLBAR_ACTION_CLASS}
                onClick={() => setDrawingFor(s.orderId)}
              >
                <FilePlus2 className="size-3.5" /> {L.drawUp}
              </Button>
            ) : null
          }
        />
      )}
      <ServerTableBody
        query={s.query}
        canRead={canRead}
        columns={EINVOICE_COLUMNS}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(EINVOICE_ROUTES.detail(row.id))}
        flagRow={needsAttention}
        noun="hoá đơn"
        errorCopy={EINVOICE_COPY}
        hasFilters={s.hasFilters}
        onClearFilters={s.clearFilters}
        empty={{
          icon: <FileText className="size-8" />,
          title: L.emptyTitle,
          description: L.emptyDescription,
        }}
        pageSize={s.pageSize}
        onPageChange={s.goToPage}
        onPageSizeChange={s.changePageSize}
        sorting={s.sorting}
      />
      <DrawUpDialog orderId={drawingFor} onClose={() => setDrawingFor(null)} />
    </div>
  );
}

/**
 * Danh sách hoá đơn điện tử của Kế toán (docs 21 §4.1–4.2): chưa phát hành trước, hạn gần trước;
 * lọc trạng thái / loại / ngày lập / quá hạn phát hành; nháp chờ phát hành, bị từ chối, quá hạn hay
 * nhà cung cấp không biết giao dịch được đánh dấu cần chú ý.
 */
export function EInvoiceList() {
  return (
    <PermissionBoundary permissions={[EINVOICE_PERMISSIONS.viewPage]} variant="list">
      <EInvoiceListContent />
    </PermissionBoundary>
  );
}
