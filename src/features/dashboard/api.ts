import {
  DASHBOARD_ALERT_OPEN_STATUS,
  DASHBOARD_API,
  DASHBOARD_LABELS,
  DASHBOARD_LIMITS,
} from "@/constants/dashboard";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { alertSummaryDto, countPageDto, stockAlertPageDto } from "./schemas";

import type { z } from "zod";
import type { AlertSummary, CountSource, StockAlertPage } from "./types";

function parseContract<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(502, "INVALID_DASHBOARD_CONTRACT", DASHBOARD_LABELS.unavailableHint);
  }
  return result.data;
}

// `status` repeats (`status=A&status=B`) where the BE takes a list; axios would send `status[]=`.
const REPEAT_ARRAY_PARAMS = { indexes: null } as const;

async function countOnce(path: string, status: string[], signal?: AbortSignal): Promise<number> {
  const { data } = await api.get<unknown>(path, {
    params: {
      page: 0,
      size: DASHBOARD_LIMITS.countPageSize,
      // One status goes out as a plain `status=A` (the BE of fulfillment tasks takes a single value).
      status: status.length > 1 ? status : status[0],
    },
    paramsSerializer: REPEAT_ARRAY_PARAMS,
    signal,
  });
  return parseContract(countPageDto, data).totalElements;
}

/**
 * How many rows a list endpoint holds in the given statuses. A single `status` is sent once per
 * request where the BE takes one (fulfillment tasks), so those statuses are counted one by one.
 */
export async function fetchCount(source: CountSource, signal?: AbortSignal): Promise<number> {
  if (source.repeatStatus) return countOnce(source.path, [...source.statuses], signal);
  const counts = await Promise.all(
    source.statuses.map((status) => countOnce(source.path, [status], signal)),
  );
  return counts.reduce((sum, value) => sum + value, 0);
}

/** `GET /inventory/alerts/summary` — open (not resolved) alerts per kind. */
export async function fetchAlertSummary(signal?: AbortSignal): Promise<AlertSummary> {
  const { data } = await api.get<unknown>(DASHBOARD_API.alertSummary, { signal });
  return parseContract(alertSummaryDto, data);
}

/** `GET /inventory/alerts?status=OPEN` — newest first (BE order). */
export async function listOpenAlerts(signal?: AbortSignal): Promise<StockAlertPage> {
  const { data } = await api.get<unknown>(DASHBOARD_API.alerts, {
    params: { page: 0, size: DASHBOARD_LIMITS.alertRows, status: DASHBOARD_ALERT_OPEN_STATUS },
    signal,
  });
  return parseContract(stockAlertPageDto, data);
}
