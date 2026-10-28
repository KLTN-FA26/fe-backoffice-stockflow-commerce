/**
 * Tài khoản demo THẬT của mock (`MOCK_USER_GRANTS`) với màn bảng giá khách hàng: quyền lấy từ
 * `mockGrantsOf` — đúng tập BFF mock trả cho `/identity/me/permissions` sau khi đăng nhập
 * (`mockSessionPermissions`; đường đăng nhập + BFF kiểm ở `lib/auth/server/mock-permissions.test.ts`),
 * không tự liệt kê mã quyền.
 * Menu dùng `NAV_GROUPS` + `useCanSeeNavItem` của `BackofficeShell`; dữ liệu đi qua mock adapter thật.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import {
  PRICED_CUSTOMER as A,
  resetCustomerPriceMockStore,
} from "@/lib/api/mock-customer-price-store";
import { resetCustomerMockStore } from "@/lib/api/mock-customer-store";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";
import { mockGrantsOf } from "@/lib/api/mock-user-grants";
import { NAV_GROUPS, useCanSeeNavItem } from "@/components/backoffice/BackofficeShell";

import { renderCustomerPrices, stubPermissions } from "../__fixtures__/render";
import { CustomerPriceList } from "./CustomerPriceList";

vi.mock("@/providers/app-providers", () => ({ useIsMock: () => true }));

const L = CUSTOMER_PRICE_UI_LABELS;
const F = L.form;
const PRICES = "/catalog/customer-prices";
const SKU = "SKU-003-WHT-L";

// Mỗi request mock trễ ~350ms (Math.random = 0.5 → không có lỗi 500 ngẫu nhiên).
vi.setConfig({ testTimeout: 30_000 });
const WAIT = { timeout: 5_000 };

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetCustomerMockStore();
  resetCustomerPriceMockStore();
  resetVariantMockStore();
});
afterEach(() => vi.restoreAllMocks());

/** Menu của BackofficeShell, lọc đúng như sidebar thật. */
function Navigation() {
  const canSee = useCanSeeNavItem();
  return (
    <nav aria-label="menu">
      {NAV_GROUPS.flatMap((group) => group.items)
        .filter(canSee)
        .map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
    </nav>
  );
}

/** Đăng nhập demo `userId`: quyền là đúng danh sách BFF mock trả cho phiên đó. */
function signInAs(userId: string, search = "") {
  const get = stubPermissions([...mockGrantsOf(userId)]);
  renderCustomerPrices(
    <>
      <Navigation />
      <CustomerPriceList />
    </>,
    search,
  );
  return { get, user: userEvent.setup() };
}
const navEntry = () =>
  within(screen.getByRole("navigation", { name: "menu" })).queryByRole("link", {
    name: L.navLabel,
  });
const calledWith = (get: ReturnType<typeof stubPermissions>, prefix: string) =>
  get.mock.calls.filter(([url]) => String(url).startsWith(prefix));

/** Tra khách qua ô chọn (`GET /customers?q=`) và chọn khách đã có bảng giá trong mock. */
async function pickPricedCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("combobox", { name: L.picker.label }, WAIT));
  await user.type(screen.getByRole("combobox", { name: L.picker.label }), "khach1@");
  await user.click(await screen.findByRole("option", { name: /In Ấn Sài Gòn/ }, WAIT));
}

describe("tài khoản demo — menu bảng giá khách hàng", () => {
  it.each(["USER-ADMIN-01", "USER-ECAD-01", "USER-SALE-01"])(
    "A %s thấy mục Bảng giá khách hàng, dẫn tới /admin/customer-prices",
    async (userId) => {
      signInAs(userId);
      // chờ quyền về (trang đã qua PermissionBoundary) rồi mới đọc menu
      await screen.findByRole("combobox", { name: L.picker.label }, WAIT);
      expect(navEntry()).toHaveAttribute("href", ADMIN_ROUTES.customerPrices.list);
    },
  );

  it.each(["USER-COORD-01", "USER-PROC-01", "USER-WH-01"])(
    "E %s không thấy mục menu; mở thẳng URL vẫn bị chặn, không gọi API giá / khách",
    async (userId) => {
      const { get } = signInAs(userId, `customerId=${A}`);
      expect(await screen.findByText(PERMISSION_UI.deniedTitle, {}, WAIT)).toBeInTheDocument();
      expect(navEntry()).toBeNull();
      expect(calledWith(get, PRICES)).toHaveLength(0);
      expect(calledWith(get, "/customers")).toHaveLength(0);
    },
  );
});

describe("tài khoản demo — dùng màn bảng giá", () => {
  it.each(["USER-ECAD-01", "USER-ADMIN-01"])(
    "B + C %s: tra khách, xem giá, thấy và mở được form Thêm / Sửa",
    async (userId) => {
      const { get, user } = signInAs(userId);
      await pickPricedCustomer(user);
      expect(calledWith(get, "/customers").length).toBeGreaterThan(0);
      expect(await screen.findByText(SKU, {}, WAIT)).toBeInTheDocument();
      expect(calledWith(get, PRICES).length).toBeGreaterThan(0);

      await user.click(screen.getByRole("button", { name: F.create }));
      expect(await screen.findByText(F.createTitle, {}, WAIT)).toBeInTheDocument();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      await user.click(await screen.findByRole("button", { name: F.editRow(SKU) }, WAIT));
      expect(await screen.findByText(F.editTitle(SKU), {}, WAIT)).toBeInTheDocument();
    },
  );

  it("D USER-SALE-01 (SALES_STAFF): tra khách + xem giá, KHÔNG có Thêm / Sửa", async () => {
    const { user } = signInAs("USER-SALE-01");
    await pickPricedCustomer(user);
    expect(await screen.findByText(SKU, {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: F.create })).toBeNull();
    expect(screen.queryByRole("button", { name: F.editRow(SKU) })).toBeNull();
  });

  it("F USER-COORD-01 (có READ giá, không VIEW_PAGE / tra khách): không có ô chọn khách, không gọi /customers", async () => {
    const { get } = signInAs("USER-COORD-01");
    expect(await screen.findByText(PERMISSION_UI.deniedTitle, {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: L.picker.label })).toBeNull();
    expect(calledWith(get, "/customers")).toHaveLength(0);
  });
});
