/** Ô của hàng "Việc của bạn" (L-12): mỗi ô là một tập việc theo vai trò, quyền cần có và danh sách nó dẫn tới. */
import {
  CalendarClock,
  CalendarX2,
  FileInput,
  Hourglass,
  MessagesSquare,
  ShieldAlert,
} from "lucide-react";

import {
  ADMIN_ROUTES,
  CHAT_PERMISSIONS,
  CREDIT_HOLD_PERMISSIONS,
  DESIGN_QUOTE_REQUEST_PERMISSIONS,
  QUOTE_PERMISSIONS,
} from "@/constants";
import { ROLE_DASHBOARD_API, ROLE_DASHBOARD_LABELS as L } from "@/constants/dashboard";
import {
  PAYMENT_INSTALLMENT_PERMISSIONS,
  PAYMENT_RECEIPT_PERMISSIONS,
  PAYMENT_ROUTES,
} from "@/constants/payment";

import type { LucideIcon } from "lucide-react";
import type { StatTone } from "@/components/shared/StatStrip";
import type { PermissionCode } from "@/lib/auth";

type CountSources = readonly { path: string; params: Readonly<Record<string, string>> }[];

export interface RoleTile {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: StatTone;
  /** Mọi mã phải có: quyền của endpoint + (nếu cần) quyền xác định vai trò. UI-only — BE kiểm lại. */
  permissions: readonly PermissionCode[];
  href: string;
  kind: "count" | "expiring-quotes" | "unread-chats";
  sources?: CountSources;
}

/**
 * Sale: yêu cầu báo giá mới (đơn lẻ + dự án, OPEN), báo giá sắp hết hạn, tin chat chưa đọc. Kế toán (người lập phiếu
 * thu): đợt đến hạn chưa thu (`owing=true`, BE-5), đợt quá hạn (`overdue=true`), đơn chờ duyệt công nợ (FLOW-1). Mỗi ô
 * dẫn tới danh sách đã lọc đúng tập nó đếm.
 */
export const ROLE_TILES: readonly RoleTile[] = [
  {
    key: "quote-requests",
    label: L.newQuoteRequests,
    icon: FileInput,
    tone: "info",
    permissions: [DESIGN_QUOTE_REQUEST_PERMISSIONS.read],
    href: ADMIN_ROUTES.designQuoteRequests.list,
    kind: "count",
    sources: [
      { path: ROLE_DASHBOARD_API.designQuoteRequests, params: { status: "OPEN" } },
      { path: ROLE_DASHBOARD_API.projectQuoteRequests, params: { status: "OPEN" } },
    ],
  },
  {
    key: "expiring-quotes",
    label: L.expiringQuotes,
    icon: Hourglass,
    tone: "warning",
    permissions: [QUOTE_PERMISSIONS.read],
    href: `${ADMIN_ROUTES.quotes.list}?status=SENT&sort=validUntil,asc`,
    kind: "expiring-quotes",
  },
  {
    key: "unread-chats",
    label: L.unreadChats,
    icon: MessagesSquare,
    tone: "special",
    permissions: [CHAT_PERMISSIONS.read],
    href: ADMIN_ROUTES.chat.list,
    kind: "unread-chats",
  },
  {
    key: "installments-owing",
    label: L.installmentsOwing,
    icon: CalendarClock,
    tone: "info",
    // Sales cũng đọc được đợt; ô này là việc của người lập phiếu thu (Kế toán)
    permissions: [PAYMENT_INSTALLMENT_PERMISSIONS.read, PAYMENT_RECEIPT_PERMISSIONS.create],
    href: PAYMENT_ROUTES.installments.receivables,
    kind: "count",
    sources: [{ path: ROLE_DASHBOARD_API.installments, params: { owing: "true" } }],
  },
  {
    key: "installments-overdue",
    label: L.installmentsOverdue,
    icon: CalendarX2,
    tone: "danger",
    permissions: [PAYMENT_INSTALLMENT_PERMISSIONS.read, PAYMENT_RECEIPT_PERMISSIONS.create],
    href: PAYMENT_ROUTES.installments.overdue,
    kind: "count",
    sources: [
      { path: ROLE_DASHBOARD_API.installments, params: { owing: "true", overdue: "true" } },
    ],
  },
  {
    // FLOW-1: đơn ON_HOLD vì vượt hạn mức (BE `GET /orders/credit-holds` chỉ trả đúng hàng đợi này, cũ nhất trước).
    // READ để gọi được endpoint, APPROVE để chỉ người duyệt (Kế toán) thấy — Sales/Điều phối chỉ xem hàng đợi.
    key: "credit-holds",
    label: L.creditHolds,
    icon: ShieldAlert,
    tone: "warning",
    permissions: [CREDIT_HOLD_PERMISSIONS.read, CREDIT_HOLD_PERMISSIONS.approve],
    href: ADMIN_ROUTES.orders.creditHolds,
    kind: "count",
    sources: [{ path: ROLE_DASHBOARD_API.creditHolds, params: {} }],
  },
];
