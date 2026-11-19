/**
 * Link "Cấu hình in" của panel biến thể: chỉ hiện với sản phẩm tuỳ chỉnh, trỏ tới trang cấu hình in của
 * biến thể, bấm là đi thẳng (panel không còn form sửa dở nào cần hỏi trước).
 */
import { screen } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  CUSTOMIZATION_TEMPLATE_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  UI_LABELS,
  VARIANT_PERMISSIONS,
} from "@/constants";

import { installApi, renderApp } from "../../product-test-utils";
import { beVariantSchema } from "../../variant-schemas";
import { VariantPanel } from "./VariantPanel";

const C = UI_LABELS.cartonSpec;
const LINK = UI_LABELS.product.variants.printConfigLink;
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const PERMS: string[] = [
  PRODUCT_PERMISSIONS.read,
  PRODUCT_PERMISSIONS.update,
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
const UNITS = `/products/${PRODUCT}/variants/${A.variantId}/uom-conversions`;

afterEach(() => vi.restoreAllMocks());

function setup(customizable: boolean, permissions: readonly string[] = PERMS, variant = A) {
  installApi({
    permissions,
    get: (url) => {
      if (url === UNITS) {
        return {
          items: [
            {
              id: "u-base",
              sku: A.sku,
              unitOfMeasure: "EACH",
              factor: 1,
              base: true,
              defaultPurchase: true,
              active: true,
              version: 0,
              defaultShipping: true,
            },
          ],
          page: 0,
          size: 200,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        };
      }
      if (url.endsWith("/media")) return [];
      return undefined;
    },
  });
  renderApp(
    <VariantPanel
      productId={PRODUCT}
      variant={variant}
      productApproved
      acceptsChanges
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
    await screen.findByText(C.none);
    expect(screen.queryByRole("link", { name: LINK })).toBeNull();
  });

  it("sản phẩm tiêu chuẩn: không có link", async () => {
    setup(false);
    await screen.findByText(C.none);
    expect(screen.queryByRole("link", { name: LINK })).toBeNull();
  });

  it("SKU riêng của khách (chữ ký OWNED-SKU:): không có link cấu hình in, có câu giải thích", async () => {
    setup(true, PERMS, { ...A, attributeSignature: `OWNED-SKU:${A.sku}` });
    expect(await screen.findByText(UI_LABELS.product.variants.customerSkuHint)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: LINK })).toBeNull();
  });

  it("bấm link đi thẳng, không hỏi", async () => {
    const user = setup(true);
    const clicks = watchClicks();
    await user.click(await screen.findByRole("link", { name: LINK }));
    expect(clicks.seen).toEqual([false]);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    clicks.stop();
  });
});
