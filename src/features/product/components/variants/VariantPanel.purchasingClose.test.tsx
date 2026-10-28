/**
 * Step 6E — đóng panel biến thể (Esc / bấm nền / nút Đóng của `SlideOverPanel`) khi form "Thông tin mua
 * hàng" đang sửa dở hoặc đang lưu. Dựng đúng cây thật `VariantPanel` → `VariantPurchasing` → form; Esc và bấm
 * nền đi qua Radix Dialog thật (userEvent gửi đủ pointerdown → click mà Radix cần).
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PRODUCT_PERMISSIONS,
  SUPPLIER_ITEM_PERMISSIONS,
  UI_LABELS,
  VARIANT_PERMISSIONS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { installApi, renderApp } from "../../product-test-utils";
import { beVariantSchema } from "../../variant-schemas";
import { VariantPanel } from "./VariantPanel";

import type { Variant } from "../../variant-schemas";

const L = UI_LABELS.skuPurchasing;
const G = L.closeGuard;
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const SUP = "33333333-3333-4333-8333-333333333333";
const PERMS = [
  PRODUCT_PERMISSIONS.read,
  PRODUCT_PERMISSIONS.update,
  SUPPLIER_ITEM_PERMISSIONS.read,
  VARIANT_PERMISSIONS.update,
];

const A: Variant = beVariantSchema.parse({
  variantId: "v-a",
  productId: PRODUCT,
  sku: "CUP-A",
  name: "CUP-A",
  status: "ACTIVE",
  defaultVariant: false,
  position: 0,
  version: 0,
  options: [],
  inventoryItemId: null,
});
const PATH = `/products/${PRODUCT}/variants/${A.variantId}/purchasing`;
const server = (over: Record<string, unknown> = {}) => ({
  variantId: A.variantId,
  sku: A.sku,
  version: 7,
  defaultSupplierId: SUP,
  referencePurchasePrice: 10000,
  referencePurchaseCurrency: "VND",
  leadTimeDays: 5,
  moq: 10,
  ...over,
});
const catalog = () => [
  {
    supplierId: SUP,
    supplierCode: "SUP-A",
    supplierName: "NCC SUP-A",
    supplierStatus: "ACTIVE",
    supplierItemId: "si-a",
    supplierSkuCode: null,
    price: 9000,
    currency: "VND",
    moq: 12,
    packSize: 6,
    effectiveLeadTimeDays: 4,
    preferred: true,
  },
];

afterEach(() => vi.restoreAllMocks());

/** Trang giả: mở / đóng panel như `VariantsSection` (đóng = gỡ panel khỏi cây). */
function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        mở lại
      </button>
      <VariantPanel
        productId={PRODUCT}
        variant={open ? A : null}
        productApproved
        acceptsChanges
        productDiscontinued={false}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function setup(serverState: { current: Record<string, unknown> } = { current: server() }) {
  const calls = installApi({
    permissions: PERMS,
    get: (url) => {
      if (url === PATH) return serverState.current;
      if (url === `/procurement/skus/${A.sku}/suppliers`) return catalog();
      if (url.endsWith("/base-price")) return { sku: A.sku, revision: 0 };
      if (url.endsWith("/media")) return [];
      return undefined;
    },
    put: () => server({ version: 8, moq: 20 }),
  });
  renderApp(<Harness />);
  return {
    ...calls,
    serverState,
    user: userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never }),
  };
}

// Hộp hỏi mở thì Radix ẩn panel bên dưới khỏi cây trợ năng (aria-hidden) — panel vẫn còn trên trang
const panelOpen = () =>
  [...document.querySelectorAll('[role="dialog"][data-state="open"]')].some(
    (d) => d.querySelector("h2")?.textContent === A.sku,
  );
const confirmShown = () => screen.queryByText(G.title) !== null;
const moq = () => screen.getByLabelText<HTMLInputElement>(L.field.moq);
const overlay = () => document.querySelector<HTMLElement>(".backdrop-blur-xs");

async function editMoq(user: ReturnType<typeof userEvent.setup>, value = "20") {
  await user.click(await screen.findByRole("button", { name: L.edit }));
  await user.clear(moq());
  await user.type(moq(), value);
}
async function clickOverlay(user: ReturnType<typeof userEvent.setup>) {
  const el = overlay();
  expect(el).not.toBeNull();
  if (el) await user.click(el);
}
/** Đang lưu: PUT treo tới khi test gọi `release` / `fail`. */
function holdPut(put: ReturnType<typeof installApi>["put"]) {
  let release: () => void = () => undefined;
  let fail: (e: unknown) => void = () => undefined;
  put.mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        release = () => resolve({ data: server({ version: 8, moq: 20 }) });
        fail = reject;
      }),
  );
  return { release: () => release(), fail: (e: unknown) => fail(e) };
}

describe("đóng panel biến thể khi form mua hàng đang sửa dở", () => {
  it("T1 + T2 Esc → hỏi trước, panel + bản nháp còn; Tiếp tục sửa → hỏi đóng, vẫn sửa + lưu được với version cũ", async () => {
    const { user, put } = setup();
    await editMoq(user);
    await user.keyboard("{Escape}");
    expect(await screen.findByText(G.title)).toBeInTheDocument();
    expect(panelOpen()).toBe(true);
    expect(moq().value).toBe("20");

    await user.click(screen.getByRole("button", { name: G.keepEditing }));
    await waitFor(() => expect(confirmShown()).toBe(false));
    expect(panelOpen()).toBe(true);
    expect(moq().value).toBe("20");
    await user.click(screen.getByRole("button", { name: L.save }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]?.[1]).toMatchObject({ version: 7, moq: 20 });
  });

  it("T3 xác nhận bỏ → panel đóng; mở lại hiện dữ liệu hiện tại (không còn bản nháp)", async () => {
    const { user, put } = setup();
    await editMoq(user, "33");
    await user.keyboard("{Escape}");
    await screen.findByText(G.title);
    await user.click(screen.getByRole("button", { name: G.discard }));
    await waitFor(() => expect(panelOpen()).toBe(false));
    expect(confirmShown()).toBe(false);
    expect(put).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "mở lại", hidden: true }));
    const ref = await screen.findByRole("region", { name: L.referenceTitle });
    expect(within(ref).getByText(L.field.moq).nextElementSibling).toHaveTextContent("10");
    expect(screen.queryByLabelText(L.field.moq)).toBeNull();
  });

  it("T4 bấm nền → hỏi trước, bản nháp còn", async () => {
    const { user } = setup();
    await editMoq(user);
    await clickOverlay(user);
    expect(await screen.findByText(G.title)).toBeInTheDocument();
    expect(panelOpen()).toBe(true);
    expect(moq().value).toBe("20");
  });

  it("nút Đóng của panel → hỏi trước, bản nháp còn", async () => {
    const { user } = setup();
    await editMoq(user);
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    expect(await screen.findByText(G.title)).toBeInTheDocument();
    expect(panelOpen()).toBe(true);
    expect(moq().value).toBe("20");
  });
});

describe("form chưa sửa / không mở form → đóng như cũ", () => {
  it("T5 mở form nhưng chưa đổi gì + Esc → đóng ngay, không hỏi", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: L.edit }));
    expect(moq()).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(panelOpen()).toBe(false));
    expect(confirmShown()).toBe(false);
  });

  it("T6 form chưa sửa + bấm nền → đóng ngay, không hỏi", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: L.edit }));
    await clickOverlay(user);
    await waitFor(() => expect(panelOpen()).toBe(false));
    expect(confirmShown()).toBe(false);
  });

  it("đổi rồi gõ lại đúng giá trị cũ → không còn thay đổi → đóng không hỏi", async () => {
    const { user } = setup();
    await editMoq(user, "10");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(panelOpen()).toBe(false));
    expect(confirmShown()).toBe(false);
  });

  it("T11 không mở form mua hàng: Esc đóng panel ngay; dialog Sửa biến thể (lồng trong panel) đóng riêng như cũ", async () => {
    const { user } = setup();
    await screen.findByRole("region", { name: L.referenceTitle });
    await user.click(screen.getByRole("button", { name: "Sửa" }));
    expect(await screen.findByText(`Sửa biến thể ${A.sku}`)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText(`Sửa biến thể ${A.sku}`)).toBeNull());
    expect(panelOpen()).toBe(true);
    expect(confirmShown()).toBe(false);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(panelOpen()).toBe(false));
    expect(confirmShown()).toBe(false);
  });
});

describe("đóng panel khi đang lưu", () => {
  it("T7 + T8 + T10 Esc / bấm nền / nút Đóng khi PUT đang chạy → bỏ qua, không hỏi, một PUT; xong → lưu như cũ", async () => {
    const { user, put } = setup();
    const held = holdPut(put);
    await editMoq(user);
    await user.click(screen.getByRole("button", { name: L.save }));
    await screen.findByRole("button", { name: L.saving });
    expect(put).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(panelOpen()).toBe(true);
    expect(confirmShown()).toBe(false);
    await clickOverlay(user);
    expect(panelOpen()).toBe(true);
    expect(confirmShown()).toBe(false);
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    expect(panelOpen()).toBe(true);
    expect(confirmShown()).toBe(false);
    await user.click(screen.getByRole("button", { name: L.saving }));
    expect(put).toHaveBeenCalledTimes(1);

    held.release();
    const ref = await screen.findByRole("region", { name: L.referenceTitle });
    expect(within(ref).getByText(L.field.moq).nextElementSibling).toHaveTextContent("20");
    expect(confirmShown()).toBe(false);
    // đã lưu, form đóng → Esc đóng panel không hỏi
    await user.keyboard("{Escape}");
    await waitFor(() => expect(panelOpen()).toBe(false));
    expect(confirmShown()).toBe(false);
  });

  it("T7b Esc ngay lúc PUT vừa bắt đầu (trước khi React hiện 'Đang lưu…') → vẫn bị chặn, không hỏi", async () => {
    const { user, put } = setup();
    let release: () => void = () => undefined;
    let saveEnabledAtStart = false;
    put.mockImplementation(() => {
      saveEnabledAtStart = !screen.getByRole("button", { name: L.save }).hasAttribute("disabled");
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      return new Promise((resolve) => {
        release = () => resolve({ data: server({ version: 8, moq: 20 }) });
      });
    });
    await editMoq(user);
    await user.click(screen.getByRole("button", { name: L.save }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(saveEnabledAtStart).toBe(true);
    expect(panelOpen()).toBe(true);
    expect(confirmShown()).toBe(false);
    release();
    await screen.findByRole("region", { name: L.referenceTitle });
    expect(confirmShown()).toBe(false);
  });

  it("T9 lưu lỗi → bản nháp + lỗi còn; sau khi xong, Esc hỏi như thường", async () => {
    const { user, put } = setup();
    const held = holdPut(put);
    await editMoq(user);
    await user.click(screen.getByRole("button", { name: L.save }));
    await screen.findByRole("button", { name: L.saving });
    await user.keyboard("{Escape}");
    expect(confirmShown()).toBe(false);
    held.fail(new ApiError(409, "OPTIMISTIC_LOCK", "stale"));
    expect(await screen.findByText(L.saveError.versionConflict)).toBeInTheDocument();
    expect(moq().value).toBe("20");

    await user.keyboard("{Escape}");
    expect(await screen.findByText(G.title)).toBeInTheDocument();
    expect(panelOpen()).toBe(true);
    await user.click(screen.getByRole("button", { name: G.keepEditing }));
    await waitFor(() => expect(confirmShown()).toBe(false));
    expect(moq().value).toBe("20");
    expect(screen.getByText(L.saveError.versionConflict)).toBeInTheDocument();
  });
});
