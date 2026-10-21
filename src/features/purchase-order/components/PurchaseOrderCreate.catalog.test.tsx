import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, SUPPLIER_ITEM_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { supplierItemKeys } from "@/lib/references/supplier-items";

import {
  CATALOG,
  SUPPLIER_REF_2,
  beSupplierItem,
  catalogPath,
  next,
  patchJsdomForCmdk,
  pickSku,
  pickSupplier,
  renderCreate,
  submitFromReview,
} from "../__fixtures__/create";
import { PO_PERMISSION_SETS, SUPPLIER_REF, bePage } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeAll(patchJsdomForCmdk);

// Test đi qua wizard nhiều bước + cmdk bằng userEvent: 2–7s khi chạy riêng, vượt 5s mặc định
// khi cả bộ chạy song song → timeout 20s truyền vào từng `it` của nhánh này (không đổi config).

afterEach(() => vi.restoreAllMocks());

const skuBox = (line = 1) => screen.findByRole("combobox", { name: `SKU dòng ${line}` });
const priceInput = (line = 1) =>
  screen.getByLabelText(/Đơn giá/, { selector: `#po-line-${line - 1}-price` });
const qtyInput = (line = 1) =>
  screen.getByLabelText(/SL đặt/, { selector: `#po-line-${line - 1}-qty` });

async function openLines(user: ReturnType<typeof userEvent.setup>) {
  await pickSupplier(user);
  await next(user);
}

describe("PurchaseOrderCreate — SKU theo danh mục NCC (#30)", () => {
  it("chỉ liệt kê SKU trong danh mục của NCC đã chọn", async () => {
    const user = userEvent.setup();
    const { get } = renderCreate();
    await openLines(user);
    await user.click(await skuBox());
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("SOFA-3S-GREY"),
      expect.stringContaining("TABLE-OAK-120"),
    ]);
    expect(get.mock.calls.some(([url]) => url === catalogPath(SUPPLIER_REF.supplierId))).toBe(true);
    await user.click(screen.getByRole("option", { name: /SOFA-3S-GREY/ }));

    // SKU đã chọn ở dòng khác không hiện lại (BE chặn SKU trùng trong PO)
    await user.click(screen.getByRole("button", { name: /Thêm dòng hàng/ }));
    await user.click(await skuBox(2));
    const second = await screen.findAllByRole("option");
    expect(second.map((o) => o.textContent)).toEqual([expect.stringContaining("TABLE-OAK-120")]);
  }, 20_000);

  it("chọn SKU → đơn giá điền sẵn, hiện MOQ và quy cách", async () => {
    const user = userEvent.setup();
    renderCreate();
    await openLines(user);
    await pickSku(user, /TABLE-OAK-120/);
    expect(priceInput()).toHaveValue(2000000);
    expect(screen.getByText("MOQ 10")).toBeInTheDocument();
    expect(screen.getByText("Quy cách 5")).toBeInTheDocument();
    expect(await skuBox()).toHaveValue("TABLE-OAK-120");
  }, 20_000);

  it("PO VND, danh mục USD → ô giá trống và bắt buộc", async () => {
    const user = userEvent.setup();
    renderCreate({
      catalog: () => bePage([beSupplierItem({ currency: "USD", price: 120 })]),
    });
    await openLines(user);
    await pickSku(user, /SOFA-3S-GREY/);
    expect(priceInput()).toHaveValue(null);
    await next(user);
    expect(
      screen.getAllByText("Giá danh mục tính theo USD, khác tiền tệ PO (VND) — nhập đơn giá"),
    ).not.toHaveLength(0);
    expect(priceInput()).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Tổng giá trị PO")).not.toBeInTheDocument();
  }, 20_000);

  it("SL 3, moq 10 pack 5 → lỗi nêu đúng 10 và 5, không qua được bước", async () => {
    const user = userEvent.setup();
    renderCreate();
    await openLines(user);
    await pickSku(user, /TABLE-OAK-120/);
    await user.clear(qtyInput());
    await user.type(qtyInput(), "3");
    await next(user);
    expect(screen.getAllByText("SL tối thiểu 10, theo bội số 5")).not.toHaveLength(0);
    expect(qtyInput()).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Tổng giá trị PO")).not.toBeInTheDocument();
  }, 20_000);

  it("đổi NCC khi đã chọn SKU → hỏi xác nhận; đồng ý thì xoá dòng", async () => {
    const user = userEvent.setup();
    renderCreate();
    await openLines(user);
    await pickSku(user, /SOFA-3S-GREY/);
    await user.click(screen.getByRole("button", { name: "Quay lại" }));

    const supplierBox = () => screen.getByRole("combobox", { name: "Nhà cung cấp" });
    const chooseSecond = async () => {
      await user.click(supplierBox());
      await user.click(await screen.findByRole("option", { name: /NOITHATVIET/ }));
    };
    // Huỷ → giữ NCC cũ
    await chooseSecond();
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Đổi nhà cung cấp?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Quay lại" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(supplierBox()).toHaveDisplayValue(/GOHOAPHAT/);

    // Đồng ý → đổi NCC, dòng hàng về một dòng trống
    await chooseSecond();
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Đổi nhà cung cấp" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(supplierBox()).toHaveDisplayValue(new RegExp(SUPPLIER_REF_2.code));
    await next(user);
    expect(await skuBox()).toHaveAttribute("placeholder", "Chọn SKU trong danh mục");
    expect(screen.queryByRole("combobox", { name: "SKU dòng 2" })).not.toBeInTheDocument();
  }, 20_000);

  it("danh mục rỗng → thông báo kèm link tới tab danh mục của NCC", async () => {
    const user = userEvent.setup();
    renderCreate();
    await pickSupplier(user, /NOITHATVIET/);
    await next(user);
    expect(await screen.findByText(/NCC này chưa có SKU nào trong danh mục/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở danh mục hàng của NCC" })).toHaveAttribute(
      "href",
      `${ADMIN_ROUTES.suppliers.detail(SUPPLIER_REF_2.supplierId)}?tab=items`,
    );
    expect(await skuBox()).toBeDisabled();
  }, 20_000);

  it("lỗi tải danh mục → thông báo + Thử lại; danh mục bị cắt → cảnh báo 200 SKU đầu", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderCreate({
      catalog: () => {
        if (fail) throw new ApiError(500, "INTERNAL_ERROR", "boom");
        return { ...bePage(CATALOG), totalElements: 350 };
      },
    });
    await openLines(user);
    expect(await screen.findByText("Không tải được danh mục hàng của NCC.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText(/chỉ hiện 200 SKU đầu/)).toBeInTheDocument();
    expect(await skuBox()).toBeEnabled();
  }, 20_000);

  it("refetch nền danh mục lỗi khi đã có dữ liệu → không báo lỗi, vẫn chọn SKU được", async () => {
    const user = userEvent.setup();
    let loads = 0;
    const { client } = renderCreate({
      catalog: () => {
        if (loads++ > 0) throw new ApiError(503, "SERVICE_UNAVAILABLE", "down");
        return bePage(CATALOG);
      },
    });
    await openLines(user);
    expect(await skuBox()).toBeEnabled();
    await client.refetchQueries({ queryKey: supplierItemKeys.all });
    await waitFor(() => expect(loads).toBeGreaterThan(1));
    expect(screen.queryByText("Không tải được danh mục hàng của NCC.")).not.toBeInTheDocument();
    expect(await skuBox()).toBeEnabled();
  }, 20_000);

  it("thiếu procurement-supplier-items:READ → ô SKU khoá kèm thông báo", async () => {
    const user = userEvent.setup();
    const { get } = renderCreate({
      permissions: PO_PERMISSION_SETS.procurement.filter(
        (p) => p !== SUPPLIER_ITEM_PERMISSIONS.read,
      ),
    });
    await openLines(user);
    expect(await skuBox()).toBeDisabled();
    expect(screen.getByText(/chưa có quyền xem danh mục hàng của NCC/)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).endsWith("/items"))).toBe(false);
  }, 20_000);

  it("BE trả SUPPLIER_TERMS_VIOLATED → lỗi dưới đúng dòng, quay về bước Dòng hàng", async () => {
    const user = userEvent.setup();
    renderCreate({
      onCreate: () => {
        throw new ApiError(409, "SUPPLIER_TERMS_VIOLATED", "x", {
          "lines[0].quantityOrdered": "Below MOQ",
        });
      },
    });
    await openLines(user);
    await pickSku(user, /TABLE-OAK-120/);
    await user.clear(qtyInput());
    await user.type(qtyInput(), "10");
    await next(user);
    await next(user);
    await submitFromReview(user);
    expect(await skuBox()).toBeInTheDocument();
    expect(qtyInput()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByText("SL tối thiểu 10, theo bội số 5")).not.toHaveLength(0);
  }, 20_000);

  it("giá trống cùng tiền tệ → payload POST không có unitPrice", async () => {
    const user = userEvent.setup();
    const { post } = renderCreate();
    await openLines(user);
    await pickSku(user, /SOFA-3S-GREY/);
    await user.clear(priceInput());
    await next(user);
    // Bước Tổng cộng: giá lấy theo danh mục, có ghi chú
    expect(screen.getAllByText(/theo danh mục/)).not.toHaveLength(0);
    await next(user);
    await submitFromReview(user);
    await waitFor(() => expect(post).toHaveBeenCalled());
    const body = post.mock.calls[0]?.[1] as { lines: Record<string, unknown>[] };
    expect(body.lines[0]?.sku).toBe("SOFA-3S-GREY");
    expect(body.lines[0]?.unitPrice).toBeUndefined();
  }, 20_000);
});
