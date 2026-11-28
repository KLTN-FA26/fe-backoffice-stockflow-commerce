import { FEE_BEARER_LABELS } from "@/constants";
import { formatDate } from "@/lib/format/date";
import { CustomerName } from "@/components/backoffice/CustomerName";

import {
  COLUMN_LABELS,
  DEFAULT_COLUMNS,
  FILTER_LABELS,
  SEARCH_SCOPE_LABEL,
  STATUS_OPTIONS,
} from "./constants";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { OrderListState } from "./useOrderListState";

/** Thanh "Cấu hình" dưới toolbar (data-table-mode-a §3); lọc chữ ở header cột gom vào "Tìm trong cột". */
export function buildSummaryItems(s: OrderListState): ListSummaryItem[] {
  const { filters, extra } = s;
  const dateRange =
    extra.placedFrom || extra.placedTo
      ? `${extra.placedFrom ? formatDate(extra.placedFrom) : "…"} → ${extra.placedTo ? formatDate(extra.placedTo) : "…"}`
      : "Tất cả";
  // Tên khách lấy từ chính các dòng đang lọc (BE-15) — chip không bao giờ hiện UUID (R3)
  const named = extra.customerId
    ? s.query.data?.items.find((order) => order.customerId === extra.customerId)
    : undefined;
  const statusLabel = filters.status
    .map((v) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .join(", ");
  return [
    {
      label: "Tìm kiếm chính",
      value: filters.q.trim() ? `“${filters.q}”` : "Chưa dùng",
      active: filters.q.trim() !== "",
      onClear: () => void filters.setQ(""),
    },
    { label: "Tìm theo", value: SEARCH_SCOPE_LABEL },
    {
      label: "Tìm trong cột",
      value:
        [
          extra.numberText.trim() && `Mã đơn “${extra.numberText.trim()}”`,
          extra.recipientText.trim() && `Người nhận “${extra.recipientText.trim()}”`,
          (extra.totalFrom || extra.totalTo) &&
            `Tổng tiền ${extra.totalFrom || "…"}–${extra.totalTo || "…"}`,
        ]
          .filter(Boolean)
          .join(", ") || "Chưa dùng",
      active: extra.columnTextActive,
      onClear: extra.clearColumnText,
    },
    {
      label: "Trạng thái",
      value: statusLabel || "Tất cả",
      active: filters.status.length > 0,
      onClear: () => void filters.setStatus([]),
    },
    {
      label: FILTER_LABELS.customer,
      value: extra.customerId ? (
        <CustomerName
          id={extra.customerId}
          name={named?.customerName}
          code={named?.customerCode}
          link={false}
        />
      ) : (
        "Tất cả"
      ),
      active: extra.customerId !== "",
      onClear: () => extra.setCustomerId(""),
    },
    {
      label: FEE_BEARER_LABELS.legend,
      value: extra.feeBearer
        ? FEE_BEARER_LABELS.optionLabel(extra.feeBearer)
        : FEE_BEARER_LABELS.all,
      active: extra.feeBearer !== "",
      onClear: () => extra.setFeeBearer(""),
    },
    {
      label: FILTER_LABELS.placedAt,
      value: dateRange,
      active: extra.placedFrom !== "" || extra.placedTo !== "",
      onClear: extra.clearDates,
    },
    {
      label: "Sắp xếp",
      value: s.sort.key
        ? `${COLUMN_LABELS[s.sort.key]} (${s.sort.direction === "asc" ? "tăng" : "giảm"})`
        : "Mặc định (mới đặt trước)",
      active: s.sort.key !== null,
      onClear: () => void filters.setSort(""),
    },
    {
      label: "Cột hiển thị",
      value: `${s.visibleColumnCount}/${DEFAULT_COLUMNS.length - 1}`,
      active: s.hasColumnConfig,
      onClear: () => s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS })),
    },
  ];
}
