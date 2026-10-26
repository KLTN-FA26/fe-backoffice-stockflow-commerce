/**
 * Fixture màn tạo PO: NCC, kho, danh mục hàng NCC (`GET /suppliers/{id}/items`) và các bước
 * thao tác wizard dùng chung cho các file test của màn tạo.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PurchaseOrderCreate } from "../components/PurchaseOrderCreate";
import {
  PO_PERMISSION_SETS,
  SUPPLIER_REF,
  bePage,
  bePo,
  mockApi,
  pickSelectOption,
  renderPoScreen,
} from "./render";

import type { PermissionCode } from "@/lib/auth";

export type User = ReturnType<typeof userEvent.setup>;

/** jsdom không có ResizeObserver / scrollIntoView mà `cmdk` (combobox) dùng. */
export function patchJsdomForCmdk() {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
}

/** BE `GET /warehouses?status=ACTIVE` (PR #71: `prefix` là mã kho). */
export const WAREHOUSE_REF = {
  id: "d99123fd-2997-4751-6bb9-e10a2e6d9949",
  prefix: "HCM",
  name: "Kho Hồ Chí Minh",
  address: "Q.7, TP.HCM",
  status: "ACTIVE",
};

export const SUPPLIER_REF_2 = {
  ...SUPPLIER_REF,
  supplierId: "55555555-5555-4555-8555-555555555555",
  code: "NOITHATVIET",
  name: "Nội thất Việt",
};

/** Một dòng `SupplierItemResponse` của BE (`GET /suppliers/{id}/items`). */
export function beSupplierItem(overrides: Record<string, unknown> = {}) {
  return {
    supplierItemId: "66666666-6666-4666-8666-666666666666",
    supplierId: SUPPLIER_REF.supplierId,
    inventoryItemId: "44444444-4444-4444-8444-444444444444",
    sku: "SOFA-3S-GREY",
    supplierSkuCode: "HP-SOFA-01",
    price: 1500000,
    currency: "VND",
    moq: 1,
    packSize: 1,
    leadTimeDays: null,
    effectiveLeadTimeDays: 7,
    preferred: false,
    version: 0,
    createdAt: "2026-09-01T00:00:00Z",
    lastModifiedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

export const CATALOG = [
  beSupplierItem(),
  beSupplierItem({
    supplierItemId: "77777777-7777-4777-8777-777777777777",
    inventoryItemId: "88888888-8888-4888-8888-888888888888",
    sku: "TABLE-OAK-120",
    supplierSkuCode: null,
    price: 2000000,
    moq: 10,
    packSize: 5,
    effectiveLeadTimeDays: 14,
  }),
];

export const catalogPath = (supplierId: string) => `/suppliers/${supplierId}/items`;

export type RenderCreateOptions = {
  permissions?: readonly PermissionCode[];
  onCreate?: (body: unknown) => unknown;
  catalog?: () => unknown;
  /** GET `/warehouses` — throw (vd ApiError) để giả lập lỗi tải danh sách kho. */
  warehouses?: () => unknown;
};

export function renderCreate({
  permissions = PO_PERMISSION_SETS.procurement,
  onCreate = (body) => ({ ...bePo(), ...(body as object) }),
  catalog = () => bePage(CATALOG),
  warehouses = () => bePage([WAREHOUSE_REF]),
}: RenderCreateOptions = {}) {
  const spies = mockApi(
    permissions,
    {
      "/suppliers": () => bePage([SUPPLIER_REF, SUPPLIER_REF_2]),
      "/warehouses": warehouses,
      [catalogPath(SUPPLIER_REF.supplierId)]: catalog,
      [catalogPath(SUPPLIER_REF_2.supplierId)]: () => bePage([]),
    },
    { "/purchase-orders": (_p, body) => onCreate(body) },
  );
  const { client } = renderPoScreen(<PurchaseOrderCreate />);
  return { ...spies, client };
}

export const next = (user: User) => user.click(screen.getByRole("button", { name: /Tiếp tục/ }));

/** Chọn NCC trong combobox và kho nhận (cùng bước 1). */
export async function pickSupplier(user: User, name: RegExp = /GOHOAPHAT/) {
  await user.click(await screen.findByRole("combobox", { name: "Nhà cung cấp" }));
  await user.click(await screen.findByRole("option", { name }));
  await pickSelectOption(user, /Kho nhận hàng/, /HCM — Kho Hồ Chí Minh/);
}

/** Chọn SKU của dòng `line` (đếm từ 1) qua combobox danh mục NCC. */
export async function pickSku(user: User, sku: string | RegExp, line = 1) {
  await user.click(await screen.findByRole("combobox", { name: `SKU dòng ${line}` }));
  await user.click(await screen.findByRole("option", { name: sku }));
}

/** Gõ mô tả của dòng `line` (đếm từ 1): mở popover ở cột thao tác, gõ, bấm "Xong". */
export async function typeDescription(user: User, text: string, line = 1) {
  await user.click(screen.getByRole("button", { name: `Mô tả dòng ${line}` }));
  await user.type(await screen.findByLabelText(`Mô tả sản phẩm dòng ${line}`), text);
  await user.click(screen.getByRole("button", { name: "Xong" }));
}

/** Bước Rà soát: bấm "Tạo đơn đặt hàng" ở thanh dưới rồi xác nhận trong dialog. */
export async function submitFromReview(user: User) {
  await user.click(
    screen.getAllByRole("button", { name: "Tạo đơn đặt hàng" }).at(-1) ?? document.body,
  );
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Tạo đơn đặt hàng" }));
}
