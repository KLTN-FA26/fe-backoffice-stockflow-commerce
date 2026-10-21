import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  next,
  patchJsdomForCmdk,
  pickSku,
  pickSupplier,
  renderCreate,
} from "../__fixtures__/create";
import { pickSelectOption } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeAll(patchJsdomForCmdk);

// Test đi qua wizard nhiều bước + cmdk bằng userEvent: 2–7s khi chạy riêng, vượt 5s mặc định
// khi cả bộ chạy song song → timeout 20s truyền vào từng `it` của nhánh này (không đổi config).

afterEach(() => vi.restoreAllMocks());

const priceInput = () => screen.getByLabelText(/Đơn giá/, { selector: "#po-line-0-price" });

describe("PurchaseOrderCreate — đổi tiền tệ PO sau khi đã điền giá danh mục (#30, BR-07)", () => {
  it("VND → USD xoá giá điền sẵn và bắt nhập; đổi lại VND thì điền lại giá danh mục", async () => {
    const user = userEvent.setup();
    renderCreate();
    await pickSupplier(user);
    await next(user);
    await pickSku(user, /SOFA-3S-GREY/);
    expect(priceInput()).toHaveValue(1500000);

    await user.click(screen.getByRole("button", { name: "Quay lại" }));
    await pickSelectOption(user, /Tiền tệ của PO/, "USD");
    await next(user);
    expect(priceInput()).toHaveValue(null);
    await next(user);
    expect(
      screen.getAllByText("Giá danh mục tính theo VND, khác tiền tệ PO (USD) — nhập đơn giá"),
    ).not.toHaveLength(0);
    expect(priceInput()).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("button", { name: "Quay lại" }));
    await user.click(screen.getByRole("button", { name: "Dùng VND để điền sẵn giá" }));
    await next(user);
    expect(priceInput()).toHaveValue(1500000);
    expect(priceInput()).not.toHaveAttribute("aria-invalid", "true");
  }, 20_000);

  it("giá người dùng tự gõ → đổi tiền tệ vẫn giữ nguyên", async () => {
    const user = userEvent.setup();
    renderCreate();
    await pickSupplier(user);
    await next(user);
    await pickSku(user, /SOFA-3S-GREY/);
    await user.clear(priceInput());
    await user.type(priceInput(), "1400000");
    await user.click(screen.getByRole("button", { name: "Quay lại" }));
    await pickSelectOption(user, /Tiền tệ của PO/, "USD");
    await next(user);
    expect(priceInput()).toHaveValue(1400000);
  }, 20_000);
});
