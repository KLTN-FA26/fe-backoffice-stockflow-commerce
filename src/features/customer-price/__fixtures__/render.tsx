/**
 * Render màn bảng giá khách hàng trong test, đi qua MOCK ADAPTER THẬT (route Step 4B) — chỉ
 * `/identity/me/permissions` được trả tay (adapter để endpoint này đi mạng). Quyền giả lập theo MÃ
 * QUYỀN, không theo vai trò. URL do `NuqsTestingAdapter` giữ: `urlUpdates` ghi mọi lần component đổi
 * URL; `navigate()` đổi URL từ ngoài như Back / Forward / mở link.
 */

import { Suspense, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { OnUrlUpdateFunction } from "nuqs/adapters/testing";

// jsdom thiếu ResizeObserver / scrollIntoView / pointer capture mà Radix Popover / Sheet dùng.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

/** `api.get` gốc (đi qua mock adapter) — lấy một lần trước mọi spy để spy không gọi lại chính nó. */
export const passThrough = api.get.bind(api);

/** Tham số query của một lời gọi `api.get` (URLSearchParams hoặc object thường). */
export function paramsOf(config: unknown): URLSearchParams {
  const params = (config as { params?: unknown } | undefined)?.params;
  if (params instanceof URLSearchParams) return params;
  return new URLSearchParams((params ?? {}) as Record<string, string>);
}

/**
 * Spy `api.get`: trả quyền tay, mọi request khác đi qua adapter. `override(url, params)` trả Promise để
 * chen lỗi / hoãn một request cụ thể (vd danh sách giá của đúng một khách); trả undefined = đi adapter.
 */
export function stubPermissions(
  permissions: readonly string[],
  override?: (url: string, params: URLSearchParams) => Promise<unknown> | undefined,
) {
  return vi.spyOn(api, "get").mockImplementation(async (url, config) => {
    if (url === "/identity/me/permissions") {
      return { data: { roles: ["TEST"], permissions: [...permissions], dataScope: "ALL" } };
    }
    const injected = override?.(url, paramsOf(config));
    if (injected) return injected as never;
    return passThrough(url, config);
  });
}

export function renderCustomerPrices(ui: React.ReactElement, search = "") {
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "Test",
      email: "t@t.vn",
      roles: [],
      username: "test",
      status: "ACTIVE",
      lastLoginAt: null,
    },
    isAuthenticated: true,
    status: "authenticated",
    impersonatedRole: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const urlUpdates: string[] = [];
  let setSearch: (next: string) => void = () => undefined;
  const onUrlUpdate: OnUrlUpdateFunction = ({ queryString }) => urlUpdates.push(queryString);

  function Harness() {
    const [current, set] = useState(search);
    setSearch = set;
    return (
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter searchParams={current} hasMemory onUrlUpdate={onUrlUpdate}>
          <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );
  }

  const result = render(<Harness />);
  /** Đổi URL từ ngoài component (Back / Forward / dán link). */
  const navigate = (next: string) => act(() => setSearch(next));
  return { ...result, client, urlUpdates, navigate };
}
