"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Inbox } from "lucide-react";

import {
  GOODS_RECEIPT_PERMISSIONS,
  RECEIPT_COLUMNS,
  RECEIPT_STATUS,
  RECEIPT_TYPE,
  RECEIVING_LABELS,
  STORAGE_KEYS,
  UI_LABELS,
  WORKSPACE_PATHS,
} from "@/constants";
import { usePagedList } from "@/hooks/use-paged-list";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useWorkspaceHref, useWorkspaceWarehouse } from "@/lib/workspace";
import { useGoodsReceipts } from "@/features/receipt/queries";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { PageTabs } from "@/components/shared/PageTabs";

import { buildReceiptColumns } from "../list/columns";

import type { GoodsReceiptRow } from "@/features/receipt/types";

const L = RECEIVING_LABELS;
const TABS = ["draft", "all"] as const;
const NO_SORT = new Set<string>();
// Cột "Xác nhận lúc" để ở trang Phiếu nhận — màn kho gọn cho người đứng ở khu nhận hàng
const HIDDEN = new Set<string>([RECEIPT_COLUMNS.CONFIRMED_AT]);

/** Phiếu hàng hoàn mở màn quét LPN riêng (docs 03 §4.2); còn lại là phiếu theo Đơn sản xuất (§4.1). */
export function receivingPathOf(row: Pick<GoodsReceiptRow, "id" | "receiptType">): string {
  return row.receiptType === RECEIPT_TYPE.RETURN
    ? WORKSPACE_PATHS.receivingReturn(row.id)
    : WORKSPACE_PATHS.receivingReceipt(row.id);
}

function ReceivingListContent() {
  const router = useRouter();
  const warehouse = useWorkspaceWarehouse();
  const href = useWorkspaceHref();
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE — BE ADR-0004): thiếu thì không gọi API
  const canRead = useCan(GOODS_RECEIPT_PERMISSIONS.read);
  const paged = usePagedList(STORAGE_KEYS.adminReceivingConfig, NO_SORT);
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("draft"));
  const query = useGoodsReceipts(
    {
      page: paged.apiPage,
      size: paged.pageSize,
      // Kho lấy từ URL của tab — không có ô chọn kho trong màn (spec 2026-11-22 §2)
      warehouseId: warehouse.id,
      status: tab === "draft" ? [RECEIPT_STATUS.DRAFT] : undefined,
    },
    { enabled: canRead },
  );
  const open = (row: GoodsReceiptRow) => router.push(href(receivingPathOf(row)));
  const columns = buildReceiptColumns(open, (row) => href(receivingPathOf(row)))
    .filter((column) => !HIDDEN.has(column.key))
    // BE sắp theo ngày nhận mới nhất; không sắp phía FE trên một trang
    .map((column) => ({ ...column, sortable: false }));

  return (
    <div className="surface-soft space-y-3">
      <h1 className="sr-only">{`${L.title} — ${warehouse.prefix}`}</h1>
      <PageTabs
        idPrefix="receiving"
        ariaLabel={L.title}
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
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={open}
        noun={L.noun}
        errorCopy={UI_LABELS.receipt}
        hasFilters={false}
        onClearFilters={paged.resetPage}
        empty={{
          icon: <Inbox className="size-8" />,
          title: tab === "draft" ? L.emptyDraftTitle : L.emptyAllTitle,
          description: L.emptyDescription,
        }}
        pageSize={paged.pageSize}
        onPageChange={paged.goToPage}
        onPageSizeChange={paged.changePageSize}
        stickyHeader
      />
    </div>
  );
}

/**
 * Nhận hàng của một kho (docs 03): phiếu theo Đơn sản xuất và phiếu hàng hoàn đang nhận ở kho trên URL. NV kho kiểm
 * đếm / quét thùng / xác nhận ngay trong tab; lập phiếu và tra cứu nhiều kho vẫn ở nhóm Nhập kho.
 */
export function ReceivingList() {
  return (
    <PermissionBoundary permissions={[GOODS_RECEIPT_PERMISSIONS.viewPage]} variant="list">
      <ReceivingListContent />
    </PermissionBoundary>
  );
}
