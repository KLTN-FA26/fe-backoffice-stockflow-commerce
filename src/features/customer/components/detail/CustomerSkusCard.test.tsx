import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { CustomerSkusCard } from "./CustomerSkusCard";

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const sku = (over: Record<string, unknown> = {}) => ({
  variantId: "v-1",
  productId: "p-1",
  sku: "LY12OZ-C1-01",
  name: "Ly 12oz in logo Cà Phê A",
  ownerCustomerId: CUSTOMER,
  designSnapshotId: "d-1",
  sourceSku: "LY12OZ-TRANG",
  status: "ACTIVE",
  ...over,
});

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => vi.restoreAllMocks());

function setup(
  rows: unknown[],
  perms: { canRead?: boolean; canBlock?: boolean; canApprove?: boolean } = {},
) {
  const get = vi.spyOn(api, "get").mockResolvedValue({ data: rows });
  const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CustomerSkusCard
        customerId={CUSTOMER}
        canRead={perms.canRead ?? true}
        canBlock={perms.canBlock ?? false}
        canApprove={perms.canApprove ?? false}
      />
    </QueryClientProvider>,
  );
  return { get, post };
}

describe("CustomerSkusCard — SKU riêng của khách (BE GET /customer-skus)", () => {
  it("không có product-variants:READ → không hiện, không gọi API", () => {
    const { get } = setup([sku()], { canRead: false });
    expect(screen.queryByText("SKU riêng của khách")).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("liệt kê SKU (link sản phẩm), tên, quy cách gốc; chỉ xem thì không có nút", async () => {
    const { get } = setup([sku()]);
    const link = await screen.findByRole("link", { name: "LY12OZ-C1-01" });
    expect(link).toHaveAttribute("href", "/admin/products/p-1");
    expect(screen.getByText("Từ quy cách LY12OZ-TRANG")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    const params = get.mock.calls[0]?.[1]?.params as URLSearchParams;
    expect(get.mock.calls[0]?.[0]).toBe("/customer-skus");
    expect(params.get("customerId")).toBe(CUSTOMER);
  });

  it("chưa có SKU riêng → câu giải thích sinh khi thiết kế được duyệt", async () => {
    setup([]);
    expect(await screen.findByText(/sinh tự động khi thiết kế/)).toBeInTheDocument();
  });

  it("nút theo trạng thái + quyền; tạm chặn hỏi xác nhận rồi POST /blocking; kích hoạt POST thẳng", async () => {
    const user = userEvent.setup();
    const { post } = setup(
      [sku(), sku({ variantId: "v-2", sku: "LY12OZ-C1-02", status: "BLOCKED" })],
      { canBlock: true, canApprove: true },
    );
    const rows = await screen.findAllByRole("listitem");
    expect(
      within(rows[0] as HTMLElement).getByRole("button", { name: "Tạm chặn" }),
    ).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).getByRole("button", { name: "Kích hoạt" }),
    ).toBeInTheDocument();

    await user.click(within(rows[1] as HTMLElement).getByRole("button", { name: "Kích hoạt" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/products/p-1/variants/v-2/activation"));

    await user.click(within(rows[0] as HTMLElement).getByRole("button", { name: "Tạm chặn" }));
    const dialog = await screen.findByRole("dialog", { name: /Tạm chặn SKU LY12OZ-C1-01/ });
    await user.click(within(dialog).getByRole("button", { name: "Tạm chặn" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/products/p-1/variants/v-1/blocking"));
  });
});
