/**
 * Fixture màn sửa PO nháp (`/admin/purchase-orders/[id]/edit`, BE `PUT /purchase-orders/{id}`).
 */

import { screen, within } from "@testing-library/react";
import { vi } from "vitest";

import { api } from "@/lib/api/client";

import { PurchaseOrderEdit } from "../components/PurchaseOrderEdit";
import { CATALOG, SUPPLIER_REF_2, WAREHOUSE_REF, catalogPath, next } from "./create";
import { PO_PERMISSION_SETS, SUPPLIER_REF, bePage, bePo, mockApi, renderPoScreen } from "./render";

import type { User } from "./create";
import type { PermissionCode } from "@/lib/auth";

export const PO_ID = "11111111-1111-4111-8111-111111111111";
export const poPath = `/purchase-orders/${PO_ID}`;

export type RenderEditOptions = {
  permissions?: readonly PermissionCode[];
  /** GET chi tiết PO — gọi mỗi lần tải (lần đầu + refetch). */
  getPo?: () => unknown;
  onPut?: (body: unknown) => unknown;
  /** GET danh mục NCC — gọi mỗi lần tải. */
  getCatalog?: () => unknown;
  /** GET thêm theo path (vd `/procurement/skus/{sku}/suppliers`). */
  extraRoutes?: Record<string, () => unknown>;
};

export function renderEdit({
  permissions = PO_PERMISSION_SETS.procurement,
  getPo = () => bePo(),
  // Response = `PurchaseOrderResponse` đầy đủ (không phải body vừa gửi).
  onPut = () => bePo(),
  getCatalog = () => bePage(CATALOG),
  extraRoutes = {},
}: RenderEditOptions = {}) {
  const spies = mockApi(permissions, {
    [poPath]: getPo,
    "/suppliers": () => bePage([SUPPLIER_REF, SUPPLIER_REF_2]),
    "/warehouses": () => bePage([WAREHOUSE_REF]),
    [catalogPath(SUPPLIER_REF.supplierId)]: getCatalog,
    ...extraRoutes,
  });
  const put = vi
    .spyOn(api, "put")
    .mockImplementation(async (_url: string, body?: unknown) => ({ data: onPut(body) }));
  const { client } = renderPoScreen(<PurchaseOrderEdit id={PO_ID} />);
  return { ...spies, put, client };
}

/** Đi từ bước Thông tin tới Rà soát (3 lần "Tiếp tục"). */
export async function goToReview(user: User) {
  await screen.findByLabelText("Nhà cung cấp");
  await next(user);
  await next(user);
  await next(user);
}

/** Bước Rà soát: bấm "Lưu thay đổi" ở thanh dưới rồi xác nhận trong dialog. */
export async function saveFromReview(user: User) {
  await user.click(screen.getAllByRole("button", { name: "Lưu thay đổi" }).at(-1) ?? document.body);
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
}
