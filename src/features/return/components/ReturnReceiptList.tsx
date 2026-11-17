"use client";

import { useRouter } from "next/navigation";
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { PackageOpen, Plus } from "lucide-react";

import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { GOODS_RECEIPT_PERMISSIONS } from "@/constants/permissions";
import { RETURN_ROUTES, RETURN_STORAGE_KEYS } from "@/constants/returns";
import { usePagedList } from "@/hooks/use-paged-list";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { PageTabs } from "@/components/shared/PageTabs";
import { Button } from "@/components/ui/button";

import { useReturnReceipts } from "../queries";

import { CreateReturnReceiptDialog } from "./CreateReturnReceiptDialog";
import { RETURN_RECEIPT_COPY } from "./primitives";
import { RETURN_RECEIPT_COLUMNS } from "./receipt-columns";

const L = RETURN_RECEIPT_LABELS;
const NO_SORT = new Set<string>();
const TABS = ["draft", "all"] as const;
const ROUTE_SEGMENT = RETURN_ROUTES.receipts.list.split("/").at(-1);

function ReturnReceiptListContent() {
  const router = useRouter();
  const canRead = useCan(GOODS_RECEIPT_PERMISSIONS.read);
  // UI-only — Backend phải re-check (`procurement-goods-receipts:CREATE`, ReturnReceiptController)
  const canCreate = useCan(GOODS_RECEIPT_PERMISSIONS.create);
  const paged = usePagedList(RETURN_STORAGE_KEYS.receiptsConfig, NO_SORT);
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("draft"));
  // Link "Lập phiếu nhập hàng hoàn" từ chi tiết RMA: `?create=true&returnRequestId=…`
  const [creating, setCreating] = useQueryState("create", parseAsBoolean);
  const [returnRequestId, setReturnRequestId] = useQueryState("returnRequestId", parseAsString);
  const query = useReturnReceipts(
    {
      page: paged.apiPage,
      size: paged.pageSize,
      statuses: tab === "draft" ? ["DRAFT"] : undefined,
    },
    { enabled: canRead },
  );
  const closeCreate = () => {
    void setCreating(null);
    void setReturnRequestId(null);
  };

  return (
    <div className="surface-soft space-y-3">
      <h1 className="sr-only">{L.pageTitle}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageTabs
          idPrefix="return-receipts"
          ariaLabel={L.pageTitle}
          value={tab}
          onChange={(next) => {
            void setTab(next);
            paged.resetPage();
          }}
          tabs={[
            { value: "draft", label: L.tabs.draft },
            { value: "all", label: L.tabs.all },
          ]}
        />
        {canCreate && (
          <Button size="sm" onClick={() => void setCreating(true)}>
            <Plus className="size-3.5" /> {L.create}
          </Button>
        )}
      </div>
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={RETURN_RECEIPT_COLUMNS}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(RETURN_ROUTES.receipts.detail(row.id))}
        noun="phiếu nhập hàng hoàn"
        errorCopy={RETURN_RECEIPT_COPY}
        hasFilters={false}
        onClearFilters={paged.resetPage}
        empty={{
          icon: <PackageOpen className="size-8" />,
          title: L.emptyTitle,
          description: L.emptyDescription,
        }}
        pageSize={paged.pageSize}
        onPageChange={paged.goToPage}
        onPageSizeChange={paged.changePageSize}
      />
      <CreateReturnReceiptDialog
        open={canCreate && creating === true}
        returnRequestId={returnRequestId ?? undefined}
        onClose={closeCreate}
      />
    </div>
  );
}

/**
 * Phiếu nhập hàng hoàn (docs 03 §4.2, BR-14; BE `/goods-receipts/returns`): hàng của yêu cầu trả hàng đã duyệt hoặc
 * chuyến hãng hoàn về, nhận theo LPN vào khu cách ly. Quyền theo phiếu nhận (`procurement-goods-receipts`).
 */
export function ReturnReceiptList() {
  useBreadcrumbLabel(ROUTE_SEGMENT, L.pageTitle);
  return (
    <PermissionBoundary permissions={[GOODS_RECEIPT_PERMISSIONS.viewPage]} variant="list">
      <ReturnReceiptListContent />
    </PermissionBoundary>
  );
}
