"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Inbox } from "lucide-react";

import {
  GOODS_RECEIPT_PERMISSIONS,
  RECEIPT_STATUS,
  RECEIPT_TYPE,
  RECEIVING_LABELS,
  STORAGE_KEYS,
  UI_LABELS,
  WORKSPACE_PATHS,
} from "@/constants";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { usePagedList } from "@/hooks/use-paged-list";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useWorkspaceHref, useWorkspaceWarehouse } from "@/lib/workspace";
import { useGoodsReceipts } from "@/features/receipt/queries";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";

import { CreateReceiptAction } from "../create/CreateReceiptAction";
import { buildReceiptColumns } from "../list/columns";
import {
  DEFAULT_RECEIVING_TAB,
  LOCKED_RECEIVING_COLUMNS,
  RECEIVING_COLUMNS,
  RECEIVING_TABS,
  ReceivingToolbar,
} from "./ReceivingToolbar";

import type { GoodsReceiptRow } from "@/features/receipt/types";

const L = RECEIVING_LABELS;
const NO_SORT = new Set<string>();
const COLUMN_OPTIONS = { locked: LOCKED_RECEIVING_COLUMNS };

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
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(RECEIVING_TABS).withDefault(DEFAULT_RECEIVING_TAB),
  );
  const changeTab = (next: typeof tab) => {
    void setTab(next);
    paged.resetPage();
  };
  // Cột đang hiện — sở thích cá nhân, localStorage (state-persistence), khoá riêng với số dòng / trang
  const columnState = useColumnVisibility(
    STORAGE_KEYS.adminReceivingColumns,
    RECEIVING_COLUMNS,
    COLUMN_OPTIONS,
  );
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
    .filter((column) => columnState.visible.some((key) => key === column.key))
    // BE sắp theo ngày nhận mới nhất; không sắp phía FE trên một trang
    .map((column) => ({ ...column, sortable: false }));

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{`${L.title} — ${warehouse.prefix}`}</h1>
      {canRead && <ReceivingToolbar tab={tab} onTabChange={changeTab} columns={columnState} />}
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={open}
        noun={L.noun}
        errorCopy={UI_LABELS.receipt}
        // Đang nhận / Tất cả là hai góc nhìn có sẵn, không phải bộ lọc người dùng nhập → rỗng luôn là "chưa có phiếu"
        hasFilters={false}
        onClearFilters={paged.resetPage}
        empty={{
          icon: <Inbox className="size-8" />,
          title: tab === DEFAULT_RECEIVING_TAB ? L.emptyDraftTitle : L.emptyAllTitle,
          description: L.emptyDescription,
          // Trạng thái trống có ngay nút Lập phiếu nhập (nút tự ẩn khi không có quyền lập)
          action: (
            <CreateReceiptAction
              handleLink={false}
              warehouseId={warehouse.id}
              detailHref={(id) => href(WORKSPACE_PATHS.receivingReceipt(id))}
            />
          ),
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
