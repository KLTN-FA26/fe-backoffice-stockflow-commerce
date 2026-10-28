/**
 * Luồng thật GET → sửa → PUT → GET của mục "Thông tin mua hàng" qua mock adapter (route mock Step 2B,
 * không spy từng request): chỉ `/identity/me/permissions` được trả tay để chọn quyền.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INVENTORY_ITEM_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  SUPPLIER_ITEM_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductHistoryMock } from "@/lib/api/mock-product-history";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetSkuPurchasingMockStore } from "@/lib/api/mock-routes-sku-purchasing";
import {
  resetSupplierItemMockStore,
  seedMockSupplierItem,
} from "@/lib/api/mock-routes-supplier-items-store";
import { resetSupplierMockStore } from "@/lib/api/mock-routes-suppliers";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";
import { fetchSkuSuppliers } from "@/lib/references/sku-suppliers";

import { pickOption, renderApp } from "../../product-test-utils";
import { getSkuPurchasing } from "../../purchasing-api";
import { listVariants } from "../../variant-api";
import { VariantPanel } from "./VariantPanel";

const L = UI_LABELS.skuPurchasing;
const PRODUCT = "PRD-001";
const SKU = "SKU-001-BLK-L";
const ITEM_PATH = `/inventory/items/item-${SKU}`;

// Mỗi request mock trễ ~350ms (Math.random = 0.5).
vi.setConfig({ testTimeout: 30_000 });

/** `api.get` gốc (đi qua mock adapter) — lấy một lần trước mọi spy, để spy không gọi lại chính nó. */
const passThrough = api.get.bind(api);

beforeAll(() => activateMockAdapter());

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  resetVariantMockStore();
  resetProductMockStore();
  resetProductHistoryMock();
  resetSupplierMockStore();
  resetSupplierItemMockStore();
  resetSkuPurchasingMockStore();
});

afterEach(() => vi.restoreAllMocks());

/** Quyền trả tay; mọi request khác đi qua mock adapter thật. */
async function openPanel(permissions: readonly string[]) {
  const get = vi
    .spyOn(api, "get")
    .mockImplementation(async (url, config) =>
      url === "/identity/me/permissions"
        ? { data: { roles: ["TEST"], permissions: [...permissions], dataScope: "ALL" } }
        : passThrough(url, config),
    );
  const variant = (await listVariants(PRODUCT)).find((v) => v.variantId === SKU);
  if (!variant) throw new Error(`mock variant ${SKU} missing`);
  renderApp(
    <VariantPanel
      productId={PRODUCT}
      variant={variant}
      productApproved
      acceptsChanges
      productDiscontinued={false}
      open
      onClose={() => {}}
    />,
  );
  return { get, user: userEvent.setup() };
}

const reference = () => screen.findByRole("region", { name: L.referenceTitle });
const valueOf = (region: HTMLElement, label: string) =>
  within(region).getByText(label).nextElementSibling?.textContent ?? "";
const FULL = [PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update, SUPPLIER_ITEM_PERMISSIONS.read];

describe("Thông tin mua hàng — luồng qua mock adapter", () => {
  it("E25 lưu thành công: hiện dữ liệu BE trả về, GET lại thấy đúng giá trị + version mới", async () => {
    const before = await getSkuPurchasing(PRODUCT, SKU);
    const { user } = await openPanel(FULL);
    await user.click(await screen.findByRole("button", { name: L.edit }));
    await user.type(screen.getByLabelText(L.field.moq), "36");
    await user.type(screen.getByLabelText(L.field.leadTimeDays), "0");
    await user.click(screen.getByRole("button", { name: L.save }));
    const ref = await reference();
    await waitFor(() => expect(valueOf(ref, L.field.moq)).toBe("36"));
    expect(valueOf(ref, L.field.leadTimeDays)).toBe(L.days(0));
    const after = await getSkuPurchasing(PRODUCT, SKU);
    expect(after).toMatchObject({ moq: 36, leadTimeDays: 0, version: before.version + 1 });
  });

  it("E26 đổi NCC mặc định trong form → cột 'ưu tiên' của danh mục NCC đổi theo", async () => {
    seedMockSupplierItem({
      supplierId: "SUP-001",
      sku: SKU,
      price: 100,
      currency: "VND",
      preferred: true,
    });
    seedMockSupplierItem({ supplierId: "SUP-002", sku: SKU, price: 90, currency: "VND" });
    const { user } = await openPanel(FULL);
    await user.click(await screen.findByRole("button", { name: L.edit }));
    await pickOption(user, L.field.defaultSupplier, /^SUP-002 — /);
    await user.click(screen.getByRole("button", { name: L.save }));
    const ref = await reference();
    await waitFor(() => expect(valueOf(ref, L.field.defaultSupplier)).toMatch(/^SUP-002 — /));
    const suppliers = await fetchSkuSuppliers(SKU);
    expect(suppliers.filter((s) => s.preferred).map((s) => s.supplierId)).toEqual(["SUP-002"]);
  });

  it("E27 lưu làm mới hồ sơ hàng tồn đang hiện (cùng version) qua invalidation có sẵn", async () => {
    const { get, user } = await openPanel([...FULL, INVENTORY_ITEM_PERMISSIONS.read]);
    await screen.findByText(UI_LABELS.inventoryItem.variantSummary.openInInventory);
    const itemReads = () => get.mock.calls.filter(([url]) => url === ITEM_PATH).length;
    const readsBefore = itemReads();
    await user.click(await screen.findByRole("button", { name: L.edit }));
    await user.type(screen.getByLabelText(L.field.moq), "5");
    await user.click(screen.getByRole("button", { name: L.save }));
    await waitFor(() => expect(itemReads()).toBeGreaterThan(readsBefore));
  });
});
