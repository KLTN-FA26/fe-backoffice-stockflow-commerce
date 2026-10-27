import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  next,
  patchJsdomForCmdk,
  pickSku,
  pickSupplier,
  renderCreate,
  typeDescription,
} from "../__fixtures__/create";

import type { User } from "../__fixtures__/create";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeAll(patchJsdomForCmdk);

// Wizard nhiều bước + cmdk bằng userEvent: chậm khi cả bộ chạy song song → timeout 20s mỗi `it`.

afterEach(() => vi.restoreAllMocks());

const skuBoxes = () => screen.getAllByRole("combobox", { name: /^SKU dòng/ });
const stepperStep = () => screen.queryByRole("button", { name: /Thông tin PO/ });

async function openLines(user: User) {
  await pickSupplier(user);
  await next(user);
  await screen.findByRole("combobox", { name: "SKU dòng 1" });
}

async function openMultiPick(user: User) {
  await user.click(screen.getByRole("button", { name: "Thêm nhiều SKU" }));
  return screen.findByRole("dialog", { name: "Thêm nhiều SKU" });
}

describe("PurchaseOrderCreate — bảng dòng hàng", () => {
  it("Thêm nhiều SKU → mỗi SKU một dòng, SL = mức tối thiểu MOQ/quy cách, dòng trống bị thay", async () => {
    const user = userEvent.setup();
    renderCreate();
    await openLines(user);
    const dialog = await openMultiPick(user);
    await user.click(within(dialog).getByRole("option", { name: /SOFA-3S-GREY/ }));
    await user.click(within(dialog).getByRole("option", { name: /TABLE-OAK-120/ }));
    await user.click(within(dialog).getByRole("button", { name: "Thêm 2 dòng" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(skuBoxes().map((b) => (b as HTMLInputElement).value)).toEqual([
      "SOFA-3S-GREY",
      "TABLE-OAK-120",
    ]);
    // TABLE-OAK-120: MOQ 10, quy cách 5 → 10; giá danh mục cùng tiền tệ PO điền sẵn
    expect(screen.getByLabelText("SL đặt dòng 2")).toHaveValue(10);
    expect(screen.getByLabelText("Đơn giá dòng 2")).toHaveValue(2000000);
    // Submit trong dialog không lọt ra form wizard → vẫn ở bước Dòng hàng
    expect(screen.getByRole("button", { name: "Thêm nhiều SKU" })).toBeInTheDocument();
  }, 20_000);

  it("SKU đã có trong đơn không hiện lại trong hộp Thêm nhiều SKU", async () => {
    const user = userEvent.setup();
    renderCreate();
    await openLines(user);
    await pickSku(user, /SOFA-3S-GREY/);
    const dialog = await openMultiPick(user);
    const options = within(dialog).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining("TABLE-OAK-120")]);
    expect(within(dialog).getByRole("button", { name: "Thêm dòng" })).toBeDisabled();
  }, 20_000);

  it("mô tả nhập trong popover — đóng vẫn giữ, hiện tóm tắt dưới SKU", async () => {
    const user = userEvent.setup();
    renderCreate();
    await openLines(user);
    await pickSku(user, /SOFA-3S-GREY/);
    await typeDescription(user, "Sofa 3 chỗ xám");
    expect(screen.queryByLabelText("Mô tả sản phẩm dòng 1")).not.toBeInTheDocument();
    expect(screen.getByText("Sofa 3 chỗ xám")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mô tả dòng 1" }));
    expect(await screen.findByLabelText("Mô tả sản phẩm dòng 1")).toHaveValue("Sofa 3 chỗ xám");
  }, 20_000);

  it("Mở rộng ẩn cột Quy trình; Thu gọn / rời bước thì hiện lại", async () => {
    const user = userEvent.setup();
    renderCreate();
    await openLines(user);
    expect(stepperStep()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mở rộng" }));
    expect(stepperStep()).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thu gọn" }));
    expect(stepperStep()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mở rộng" }));
    await user.click(screen.getByRole("button", { name: /Quay lại/ }));
    expect(await screen.findByRole("button", { name: /Thông tin PO/ })).toBeInTheDocument();
  }, 20_000);
});
