import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { apiError, mockApi, renderScreen } from "@/test/api-screen";
import { toast } from "@/components/shared/Toast";

import { StandardPriceList } from "./StandardPriceList";

afterEach(() => vi.restoreAllMocks());

const LIST = "/catalog/standard-prices";
const CUP = "LY-GIAY-DEMO-12OZ";
/** BE `StandardPriceResponse` của seed demo `V20261230000300` (ly giấy 12 oz). */
const CUP_PRICE = {
  sku: CUP,
  productName: "Ly giấy 2 lớp in logo (demo)",
  variantName: "Ly giấy 2 lớp in logo - 12 oz",
  moq: 10,
  tiers: [
    { minQuantity: 10, unitPrice: 1300 },
    { minQuantity: 20, unitPrice: 1250 },
  ],
  note: "Giá chuẩn cho mẫu in thông thường (1-2 màu)",
  version: 2,
};

function setup(
  role: "SALES_MANAGER" | "SALES_STAFF" | "ACCOUNTANT",
  extra: Parameters<typeof mockApi>[1] = {},
) {
  const spies = mockApi(role, {
    ...extra,
    get: { [LIST]: () => [CUP_PRICE], [`${LIST}/${CUP}`]: () => CUP_PRICE, ...extra.get },
  });
  renderScreen(<StandardPriceList />, role);
  return spies;
}

describe("Giá chuẩn — action gating (3 vai trò, 13 BR-04)", () => {
  it("Quản lý kinh doanh: thấy danh sách, thêm / sửa / xoá", async () => {
    setup("SALES_MANAGER");
    const table = await screen.findByRole("table");
    expect(within(table).getByText(CUP)).toBeInTheDocument();
    expect(within(table).getByText("Ly giấy 2 lớp in logo (demo)")).toBeInTheDocument();
    expect(within(table).getByText(/Từ 10 thùng: 1\.300/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm giá chuẩn/ })).toBeInTheDocument();
    // sửa / xoá nằm trong menu "⋯" của dòng
    await userEvent.setup().click(screen.getByRole("button", { name: `Thao tác — ${CUP}` }));
    const menu = await screen.findByRole("dialog");
    expect(within(menu).getByRole("button", { name: "Sửa giá chuẩn" })).toBeEnabled();
    expect(within(menu).getByRole("button", { name: "Xoá giá chuẩn" })).toBeEnabled();
  });

  it("Sales: chỉ xem — không có nút thêm / sửa / xoá", async () => {
    setup("SALES_STAFF");
    expect(await screen.findByRole("table")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Thêm giá chuẩn/ })).toBeNull();
    expect(screen.queryByRole("button", { name: `Thao tác — ${CUP}` })).toBeNull();
    expect(screen.queryByRole("button", { name: `Sửa giá chuẩn ${CUP}` })).toBeNull();
    expect(screen.queryByRole("button", { name: `Xoá giá chuẩn ${CUP}` })).toBeNull();
  });

  it("Kế toán (không có catalog-standard-prices): không mở trang, không gọi API giá chuẩn", async () => {
    const { get } = setup("ACCOUNTANT");
    await waitFor(() =>
      expect(get.mock.calls.some(([url]) => url === "/identity/me/permissions")).toBe(true),
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(get.mock.calls.some(([url]) => url === LIST)).toBe(false);
  });
});

describe("Giá chuẩn — tạo / sửa / xoá", () => {
  it("tạo theo SKU quy cách: gửi bậc giá theo thùng, đơn giá là số", async () => {
    const success = vi.spyOn(toast, "success");
    const { post } = setup("SALES_MANAGER", {
      post: {
        [`${LIST}/LY-TRE-DEMO-12OZ`]: (_p, body) => ({
          ...CUP_PRICE,
          ...(body as object),
          sku: "LY-TRE-DEMO-12OZ",
          version: 0,
        }),
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Thêm giá chuẩn/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("SKU quy cách"), "ly-tre-demo-12oz");
    await user.type(within(dialog).getByLabelText("Bậc 1 — Từ số thùng"), "10");
    await user.type(within(dialog).getByLabelText("Bậc 1 — Đơn giá / cái (VND)"), "1900");
    await user.click(within(dialog).getByRole("button", { name: "Lưu giá chuẩn" }));
    await waitFor(() => expect(success).toHaveBeenCalledWith("Đã lưu giá chuẩn"));
    expect(post).toHaveBeenCalledWith(`${LIST}/LY-TRE-DEMO-12OZ`, {
      tiers: [{ minQuantity: 10, unitPrice: 1900 }],
      note: null,
    });
  });

  it("SKU riêng của khách → BE 409 STANDARD_PRICE_VARIANT_REQUIRED báo ngay ở ô SKU", async () => {
    setup("SALES_MANAGER", {
      post: {
        [`${LIST}/LY-GIAY-DEMO-12OZ-XANH`]: () => {
          throw apiError(409, "STANDARD_PRICE_VARIANT_REQUIRED");
        },
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Thêm giá chuẩn/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("SKU quy cách"), "LY-GIAY-DEMO-12OZ-XANH");
    await user.type(within(dialog).getByLabelText("Bậc 1 — Từ số thùng"), "10");
    await user.type(within(dialog).getByLabelText("Bậc 1 — Đơn giá / cái (VND)"), "1000");
    await user.click(within(dialog).getByRole("button", { name: "Lưu giá chuẩn" }));
    expect(
      await within(dialog).findByText(
        "Giá chuẩn đặt cho quy cách của danh mục, không đặt cho SKU riêng của khách.",
      ),
    ).toBeVisible();
  });

  it("sửa gửi PUT kèm version đang xem; SKU không đổi được", async () => {
    const { put } = setup("SALES_MANAGER", {
      put: { [`${LIST}/${CUP}`]: () => ({ ...CUP_PRICE, version: 3 }) },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: `Thao tác — ${CUP}` }));
    await user.click(await screen.findByRole("button", { name: "Sửa giá chuẩn" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("SKU quy cách")).toBeNull();
    const price = within(dialog).getByLabelText("Bậc 1 — Đơn giá / cái (VND)");
    await user.clear(price);
    await user.type(price, "1350");
    await user.click(within(dialog).getByRole("button", { name: "Lưu giá chuẩn" }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(`${LIST}/${CUP}`, {
        tiers: [
          { minQuantity: 10, unitPrice: 1350 },
          { minQuantity: 20, unitPrice: 1250 },
        ],
        note: CUP_PRICE.note,
        version: 2,
      }),
    );
  });

  it("xoá hỏi lại rồi gửi DELETE kèm version", async () => {
    setup("SALES_MANAGER");
    const remove = vi.spyOn(api, "delete").mockResolvedValue({ data: null });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: `Thao tác — ${CUP}` }));
    await user.click(await screen.findByRole("button", { name: "Xoá giá chuẩn" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(`Xoá giá chuẩn của ${CUP}?`)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Xoá giá chuẩn" }));
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith(`${LIST}/${CUP}`, { params: { version: 2 } }),
    );
  });
});
