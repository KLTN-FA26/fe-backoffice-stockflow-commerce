"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DASHBOARD_LABELS,
  DASHBOARD_QUERY_KEYS,
  ROLE_DASHBOARD_LABELS as L,
  ROLE_DASHBOARD_LIMITS,
} from "@/constants/dashboard";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { hasPermission, useMyPermissions } from "@/lib/auth";

import { StatCell, StatStrip } from "@/components/shared/StatStrip";

import { fetchCounts, fetchExpiringQuotes } from "../role-api";
import { ROLE_TILES } from "../role-tiles";

import type { RoleTile } from "../role-tiles";

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
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
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
      <StatStrip columns={COLUMNS[visible.length] ?? COLUMNS[6]}>
        {visible.map((tile) => (
          <RoleTileCell key={tile.key} tile={tile} unreadChats={unreadChats} />
        ))}
      </StatStrip>
    </section>
  );
}
