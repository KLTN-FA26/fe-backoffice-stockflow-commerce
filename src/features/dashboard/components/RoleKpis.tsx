"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CalendarX2, FileInput, Hourglass, MessagesSquare } from "lucide-react";

import {
  ADMIN_ROUTES,
  CHAT_PERMISSIONS,
  DESIGN_QUOTE_REQUEST_PERMISSIONS,
  QUOTE_PERMISSIONS,
} from "@/constants";
import {
  DASHBOARD_LABELS,
  DASHBOARD_QUERY_KEYS,
  ROLE_DASHBOARD_API,
  ROLE_DASHBOARD_LABELS as L,
  ROLE_DASHBOARD_LIMITS,
} from "@/constants/dashboard";
import {
  PAYMENT_INSTALLMENT_PERMISSIONS,
  PAYMENT_RECEIPT_PERMISSIONS,
  PAYMENT_ROUTES,
} from "@/constants/payment";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { hasPermission, useMyPermissions } from "@/lib/auth";

import { StatCell, StatStrip } from "@/components/shared/StatStrip";

import { fetchCounts, fetchExpiringQuotes } from "../role-api";

import type { LucideIcon } from "lucide-react";
import type { StatTone } from "@/components/shared/StatStrip";
import type { PermissionCode } from "@/lib/auth";

type CountSources = readonly { path: string; params: Readonly<Record<string, string>> }[];

interface RoleTile {
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
 * thu): đợt đến hạn chưa thu (`owing=true`, BE-5), đợt quá hạn (`overdue=true`). Mỗi ô dẫn tới danh sách đã lọc đúng
 * tập nó đếm.
 */
const ROLE_TILES: readonly RoleTile[] = [
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
];

function useTileValue(tile: RoleTile, unreadChats: number | undefined) {
  const count = useQuery({
    queryKey: [DASHBOARD_QUERY_KEYS.count, "role", tile.key],
    queryFn: ({ signal }) => fetchCounts(tile.sources ?? [], signal),
    enabled: tile.kind === "count",
    ...QUERY_TIMES.dashboard,
  });
  const expiring = useQuery({
    queryKey: [
      DASHBOARD_QUERY_KEYS.count,
      "role",
      tile.key,
      ROLE_DASHBOARD_LIMITS.expiringWithinDays,
    ],
    queryFn: ({ signal }) =>
      fetchExpiringQuotes(ROLE_DASHBOARD_LIMITS.expiringWithinDays, Date.now(), signal),
    enabled: tile.kind === "expiring-quotes",
    ...QUERY_TIMES.dashboard,
  });
  if (tile.kind === "unread-chats") return { value: unreadChats ?? DASHBOARD_LABELS.loading };
  const query = tile.kind === "count" ? count : expiring;
  // Lỗi / đang tải không bao giờ thay bằng số đoán
  if (query.isError)
    return { value: DASHBOARD_LABELS.unavailable, title: DASHBOARD_LABELS.unavailableHint };
  if (query.isPending) return { value: DASHBOARD_LABELS.loading };
  if (tile.kind === "count") return { value: count.data ?? DASHBOARD_LABELS.loading };
  const result = expiring.data;
  return result?.truncated
    ? { value: `${result.count}+`, title: L.expiringQuotesTruncated }
    : { value: result?.count ?? DASHBOARD_LABELS.loading };
}

function RoleTileCell({ tile, unreadChats }: { tile: RoleTile; unreadChats?: number }) {
  const state = useTileValue(tile, unreadChats);
  return (
    <StatCell
      label={tile.label}
      icon={tile.icon}
      tone={tile.tone}
      href={tile.href}
      value={state.value}
      title={state.title}
    />
  );
}

const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 xl:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
};

/**
 * Hàng "Việc của bạn" trên trang tổng quan (L-12) — chỉ các ô người dùng có đủ quyền; không ô nào thì không hiện.
 * `unreadChats` do trang truyền vào (badge chat dùng chung của sidebar): feature này không import feature chat.
 */
export function RoleKpis({ unreadChats }: { unreadChats?: number }) {
  const permissions = useMyPermissions();
  if (!permissions.isSuccess) return null;
  const visible = ROLE_TILES.filter((tile) =>
    tile.permissions.every((code) => hasPermission(permissions.data, code)),
  );
  if (visible.length === 0) return null;
  return (
    <section aria-label={L.title} className="mb-6">
      <h2 className="text-ink-primary mb-2 text-[0.9375rem] font-semibold">{L.title}</h2>
      <StatStrip columns={COLUMNS[visible.length] ?? COLUMNS[5]}>
        {visible.map((tile) => (
          <RoleTileCell key={tile.key} tile={tile} unreadChats={unreadChats} />
        ))}
      </StatStrip>
    </section>
  );
}
