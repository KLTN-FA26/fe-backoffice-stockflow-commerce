/**
 * Tiện ích test cho component của feature product: bọc QueryClient + nuqs, đăng nhập giả để
 * `useMyPermissions` gọi `/identity/me/permissions`, và dựng spy cho `api` (axios) để test kiểm đúng
 * request gửi đi mà không cần BE hay mock adapter.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { expect, vi } from "vitest";

import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { UserEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";

type Handler = (url: string, config?: unknown) => unknown;

/** Spy `api.get/post/put/delete`; handler trả `undefined` = chưa mock (lỗi rõ ràng thay vì treo). */
export function installApi(options: {
  permissions: readonly string[];
  get?: Handler;
  post?: Handler;
  put?: Handler;
  delete?: Handler;
}) {
  const respond = (method: string, handler: Handler | undefined) =>
    vi.fn(async (url: string, ...rest: unknown[]) => {
      const data = handler?.(url, ...rest);
      if (data === undefined) throw new Error(`Không có mock cho ${method} ${url}`);
      return { data };
    });
  const get = vi.spyOn(api, "get").mockImplementation(async (url: string, config?: unknown) => {
    if (url === "/identity/me/permissions") {
      return { data: { roles: ["TEST"], permissions: [...options.permissions], dataScope: "ALL" } };
    }
    const data = options.get?.(url, config);
    if (data === undefined) throw new Error(`Không có mock cho GET ${url}`);
    return { data };
  });
  const post = vi.spyOn(api, "post").mockImplementation(respond("POST", options.post));
  const put = vi.spyOn(api, "put").mockImplementation(respond("PUT", options.put));
  const del = vi.spyOn(api, "delete").mockImplementation(respond("DELETE", options.delete));
  return { get, post, put, del };
}

/** jsdom thiếu pointer capture / scrollIntoView / ResizeObserver mà Radix Select và Dialog gọi → vá rỗng. */
function patchJsdomForRadix() {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/** Chọn một mục của shadcn `Select`: bấm trigger theo nhãn rồi bấm option. */
export async function pickOption(
  user: { click: (el: Element) => Promise<void> },
  trigger: string | RegExp,
  option: string | RegExp,
) {
  patchJsdomForRadix();
  await user.click(await screen.findByRole("combobox", { name: trigger }));
  await user.click(await screen.findByRole("option", { name: option }));
}

/**
 * Chọn một nút của `TreeSelect` (ô danh mục dạng cây): mở ô, gõ tên vào ô tìm (nút sâu nằm trong nhánh
 * đang thu gọn) rồi bấm dòng khớp.
 */
export async function pickTreeOption(user: UserEvent, trigger: string | RegExp, label: string) {
  patchJsdomForRadix();
  await user.click(await screen.findByRole("combobox", { name: trigger }));
  await user.type(await screen.findByRole("textbox", { name: /Tìm danh mục/ }), label);
  await user.click(await screen.findByRole("treeitem", { name: new RegExp(label) }));
}

type Clicker = { click: (el: Element) => Promise<void> };

const stepText = () => screen.getByText(/^Bước \d/).textContent;

/** Wizard sản phẩm: bấm "Tiếp tục" rồi chờ sang bước mới (bước hiện tại phải hợp lệ). */
async function advance(user: Clicker, next: Element) {
  const before = stepText();
  await user.click(next);
  await waitFor(() => expect(stepText()).not.toBe(before));
}

/** Wizard sản phẩm: qua `times` bước. */
export async function nextStep(user: Clicker, times = 1) {
  for (let i = 0; i < times; i += 1) {
    await advance(user, await screen.findByRole("button", { name: "Tiếp tục" }));
  }
}

/** Wizard sản phẩm: đi tới bước Rà soát (hết nút "Tiếp tục"). */
export async function goToLastStep(user: Clicker) {
  for (let next = screen.queryByRole("button", { name: "Tiếp tục" }); next;) {
    await advance(user, next);
    next = screen.queryByRole("button", { name: "Tiếp tục" });
  }
}

export function renderApp(ui: ReactElement, options: { searchParams?: string } = {}) {
  patchJsdomForRadix();
  // `useMyPermissions` chỉ gọi BE khi đã đăng nhập.
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
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={options.searchParams ?? ""} hasMemory>
        {ui}
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}
