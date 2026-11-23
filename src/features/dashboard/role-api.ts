import { DASHBOARD_LABELS, ROLE_DASHBOARD_API, ROLE_DASHBOARD_LIMITS } from "@/constants/dashboard";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { countPageDto, expiringQuotesPageDto } from "./schemas";

const DAY_MS = 86_400_000;

/** Một trang cỡ 1 → `totalElements` (cùng cách đếm của các ô KPI). */
export async function fetchFilteredCount(
  path: string,
  params: Readonly<Record<string, string>>,
  signal?: AbortSignal,
): Promise<number> {
  const { data } = await api.get<unknown>(path, {
    params: { page: 0, size: 1, ...params },
    signal,
  });
  const parsed = countPageDto.safeParse(data);
  if (!parsed.success)
    throw new ApiError(502, "INVALID_DASHBOARD_CONTRACT", DASHBOARD_LABELS.unavailableHint);
  return parsed.data.totalElements;
}

/** Tổng của nhiều nguồn đếm (vd yêu cầu báo giá đơn lẻ + dự án). */
export async function fetchCounts(
  sources: readonly { path: string; params: Readonly<Record<string, string>> }[],
  signal?: AbortSignal,
): Promise<number> {
  const counts = await Promise.all(
    sources.map((source) => fetchFilteredCount(source.path, source.params, signal)),
  );
  return counts.reduce((sum, value) => sum + value, 0);
}

export interface ExpiringQuotes {
  count: number;
  /** Trang đọc đầy mà mục cuối vẫn còn trong cửa sổ → có thể còn nữa: số là "ít nhất". */
  truncated: boolean;
}

/**
 * Báo giá đã gửi (SENT) còn hiệu lực nhưng hết trong `withinDays` ngày tới. BE `GET /quotes` không lọc theo hạn, nhưng
 * sắp được theo `validUntil` → đọc một trang tăng dần rồi đếm ở FE.
 */
export async function fetchExpiringQuotes(
  withinDays: number,
  now: number = Date.now(),
  signal?: AbortSignal,
): Promise<ExpiringQuotes> {
  const size = ROLE_DASHBOARD_LIMITS.expiringScanSize;
  const { data } = await api.get<unknown>(ROLE_DASHBOARD_API.quotes, {
    params: { page: 0, size, status: "SENT", sort: "validUntil,asc" },
    signal,
  });
  const parsed = expiringQuotesPageDto.safeParse(data);
  if (!parsed.success)
    throw new ApiError(502, "INVALID_DASHBOARD_CONTRACT", DASHBOARD_LABELS.unavailableHint);
  const until = now + withinDays * DAY_MS;
  const inWindow = parsed.data.items.filter((row) => {
    const at = Date.parse(row.validUntil);
    return at > now && at <= until;
  });
  const last = parsed.data.items.at(-1);
  const truncated =
    parsed.data.items.length === size && !!last && Date.parse(last.validUntil) <= until;
  return { count: inWindow.length, truncated };
}
