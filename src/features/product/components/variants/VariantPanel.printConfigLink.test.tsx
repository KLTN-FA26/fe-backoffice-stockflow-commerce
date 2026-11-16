/**
 * Link "Cấu hình in" của panel biến thể: chỉ hiện với sản phẩm tuỳ chỉnh, trỏ tới trang cấu hình in của
 * biến thể, và đi qua cùng hộp hỏi "bỏ thay đổi chưa lưu" như các lối đóng panel khác.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  CUSTOMIZATION_TEMPLATE_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  SUPPLIER_ITEM_PERMISSIONS,
  UI_LABELS,
  VARIANT_PERMISSIONS,
} from "@/constants";

import { installApi, renderApp } from "../../product-test-utils";
import { beVariantSchema } from "../../variant-schemas";
import { VariantPanel } from "./VariantPanel";

const L = UI_LABELS.skuPurchasing;
const G = L.closeGuard;
const LINK = UI_LABELS.product.variants.printConfigLink;
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const SUP = "33333333-3333-4333-8333-333333333333";
const PERMS: string[] = [
  PRODUCT_PERMISSIONS.read,
  PRODUCT_PERMISSIONS.update,
  SUPPLIER_ITEM_PERMISSIONS.read,
  VARIANT_PERMISSIONS.update,
  CUSTOMIZATION_TEMPLATE_PERMISSIONS.read,
];
const A = beVariantSchema.parse({
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
const HREF = ADMIN_ROUTES.products.printConfig(PRODUCT, A.variantId);
const PATH = `/products/${PRODUCT}/variants/${A.variantId}/purchasing`;

afterEach(() => vi.restoreAllMocks());

function setup(customizable: boolean, permissions: readonly string[] = PERMS) {
  installApi({
    permissions,
    get: (url) => {
      if (url === PATH) {
        return {
          variantId: A.variantId,
          sku: A.sku,
          version: 7,
          defaultSupplierId: SUP,
          referencePurchasePrice: 10000,
          referencePurchaseCurrency: "VND",
          leadTimeDays: 5,
          moq: 10,
        };
      }
      if (url === `/procurement/skus/${A.sku}/suppliers`) return [];
      if (url.endsWith("/base-price")) return { sku: A.sku, revision: 0 };
      if (url.endsWith("/media")) return [];
      return undefined;
    },
  });
  renderApp(
    <VariantPanel
      productId={PRODUCT}
      variant={A}
      productApproved
      acceptsChanges
      productDiscontinued={false}
      customizable={customizable}
      open
      onClose={() => {}}
    />,
  );
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** Clicks that reach the page after React's handlers, with whether they were cancelled. */
function watchClicks() {
  const seen: boolean[] = [];
  const listener = (event: MouseEvent) => {
    if (
      event.target instanceof Element &&
      event.target.closest("a")?.getAttribute("href") === HREF
    ) {
      seen.push(event.defaultPrevented);
      event.preventDefault(); // jsdom cannot navigate; the click was recorded above
    }
  };
  document.addEventListener("click", listener);
  return { seen, stop: () => document.removeEventListener("click", listener) };
}

describe("VariantPanel — link tới cấu hình in", () => {
  it("sản phẩm tuỳ chỉnh: có link tới trang cấu hình in của biến thể", async () => {
    setup(true);
    const link = await screen.findByRole("link", { name: LINK });
    expect(link).toHaveAttribute("href", HREF);
  });

  it("sản phẩm tuỳ chỉnh nhưng không có quyền đọc cấu hình in: không có link", async () => {
    setup(
      true,
      PERMS.filter((code) => code !== CUSTOMIZATION_TEMPLATE_PERMISSIONS.read),
    );
    await screen.findByRole("region", { name: L.referenceTitle });
    expect(screen.queryByRole("link", { name: LINK })).toBeNull();
  });

  it("sản phẩm tiêu chuẩn: không có link", async () => {
    setup(false);
    await screen.findByRole("region", { name: L.referenceTitle });
    expect(screen.queryByRole("link", { name: LINK })).toBeNull();
  });

  it("form mua hàng đang sửa dở: bấm link hỏi trước, chỉ đi tiếp khi xác nhận bỏ", async () => {
    const user = setup(true);
    const clicks = watchClicks();
    await user.click(await screen.findByRole("button", { name: L.edit }));
    const moq = screen.getByLabelText<HTMLInputElement>(L.field.moq);
    await user.clear(moq);
    await user.type(moq, "20");

    await user.click(screen.getByRole("link", { name: LINK }));
    expect(await screen.findByText(G.title)).toBeInTheDocument();
    expect(clicks.seen).toEqual([true]);

    await user.click(screen.getByRole("button", { name: G.keepEditing }));
    await waitFor(() => expect(screen.queryByText(G.title)).toBeNull());
    expect(screen.getByLabelText<HTMLInputElement>(L.field.moq).value).toBe("20");

    await user.click(screen.getByRole("link", { name: LINK }));
    await user.click(await screen.findByRole("button", { name: G.discard }));
    await waitFor(() => expect(clicks.seen).toEqual([true, true, false]));
    clicks.stop();
  });

  it("không có gì sửa dở: link đi thẳng, không hỏi", async () => {
    const user = setup(true);
    const clicks = watchClicks();
    await user.click(await screen.findByRole("link", { name: LINK }));
    expect(clicks.seen).toEqual([false]);
    expect(screen.queryByText(G.title)).toBeNull();
    clicks.stop();
  });
});
