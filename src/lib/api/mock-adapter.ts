/**
 * Mock adapter for axios.
 *
 * When `USE_MOCK=true` (server-only flag, see `src/lib/config.ts`) this
 * adapter intercepts every request and resolves it against `mock-data.ts` —
 * simulating server-side pagination, filtering, sorting, latency, and
 * occasional errors.
 *
 * `activateMockAdapter()` is only called (from `AppProviders`) when the
 * server-derived `isMock` flag is true — no env var is read here.
 *
 * **Only this file may import mock-data.ts** — enforced by CI grep.
 */

import {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { api } from "./client";

/* ── Types ───────────────────────────────────────────────────────────── */

interface MockResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
  statusText?: string;
}

type RouteHandler = (config: AxiosRequestConfig) => Promise<MockResponse> | MockResponse;

/* ── Route registry ──────────────────────────────────────────────────── */

const routes = new Map<string, Map<string, RouteHandler>>();

export function registerMockRoute(method: string, pattern: string, handler: RouteHandler): void {
  const methodUpper = method.toUpperCase();
  if (!routes.has(methodUpper)) routes.set(methodUpper, new Map());
  routes.get(methodUpper)!.set(pattern, handler);
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Random delay between 200–500ms to simulate network latency. */
const delay = (ms?: number) =>
  new Promise<void>((r) => setTimeout(r, ms ?? 200 + Math.random() * 300));

/** Paginate an array server-style. */
export function paginate<T>(
  items: T[],
  page = 1,
  pageSize = 15,
): { items: T[]; total: number; page: number; pageSize: number } {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

/* ── Match URL to registered pattern ─────────────────────────────────── */

function matchRoute(
  method: string,
  url: string,
): { handler: RouteHandler; params: Record<string, string> } | null {
  const methodRoutes = routes.get(method.toUpperCase());
  if (!methodRoutes) return null;

  for (const [pattern, handler] of methodRoutes) {
    const regex = new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$");
    const match = url.replace(/\?.*$/, "").match(regex);
    if (match) return { handler, params: match.groups ?? {} };
  }
  return null;
}

/* ── Adapter ─────────────────────────────────────────────────────────── */

/**
 * Resolves once `registerAllMockRoutes()` has run. `activateMockAdapter()`
 * sets this before any request can reach `mockAdapter` (see below) — the
 * adapter itself awaits it, closing the race where a request fired before
 * the dynamic import of `./mock-routes` finished would find no routes
 * registered yet and get a bogus 404.
 */
let routesReady: Promise<void> | undefined;

async function mockAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  if (routesReady) await routesReady;

  const url = config.url ?? "/";
  const method = (config.method ?? "GET").toUpperCase();

  const matched = matchRoute(method, url);
  if (!matched) {
    console.warn(`[mock-adapter] No handler for ${method} ${url}`);
    return settleMockResponse({ status: 404, data: { message: "Not found" }, headers: {} }, config);
  }

  // Simulate latency
  await delay();

  // 5% random server error for resilience testing
  if (Math.random() < 0.05) {
    return settleMockResponse(
      {
        status: 500,
        data: {
          code: "MOCK_RANDOM_ERROR",
          message: "Lỗi ngẫu nhiên từ mock server (5% chance)",
          traceId: `mock-${Date.now()}`,
        },
        headers: {},
      },
      config,
    );
  }

  // Inject URL params into config for handlers to use
  (config as AxiosRequestConfig & { _mockParams: Record<string, string> })._mockParams =
    matched.params;

  return settleMockResponse(await matched.handler(config), config);
}

function settleMockResponse(response: MockResponse, config: AxiosRequestConfig): AxiosResponse {
  const axiosResponse: AxiosResponse = {
    data: response.data,
    status: response.status,
    statusText: response.statusText ?? String(response.status),
    headers: response.headers,
    config: config as InternalAxiosRequestConfig,
    request: undefined,
  };
  const validateStatus =
    config.validateStatus ?? ((status: number) => status >= 200 && status < 300);
  if (!validateStatus(response.status)) {
    throw new AxiosError(
      getMockErrorMessage(response.data),
      undefined,
      config as InternalAxiosRequestConfig,
      undefined,
      axiosResponse,
    );
  }
  return axiosResponse;
}

function getMockErrorMessage(data: unknown): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }
  return "Mock request failed";
}

/* ── Activate ────────────────────────────────────────────────────────── */

export function activateMockAdapter(): void {
  // Register all mock routes before activating the adapter. The dynamic
  // import is async even though the module is already bundled, so the
  // adapter must await `routesReady` (set below) rather than assume routes
  // exist by the time the first request arrives.
  routesReady = import("./mock-routes").then(({ registerAllMockRoutes }) => {
    registerAllMockRoutes();
  });

  api.defaults.adapter = mockAdapter;
  console.info("[mock-adapter] Activated — all API calls will be served from mock-data.ts");
}
