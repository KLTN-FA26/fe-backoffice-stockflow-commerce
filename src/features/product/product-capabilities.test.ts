import { describe, expect, it } from "vitest";

import { PRODUCT_PERMISSIONS, PRODUCT_STATUS } from "@/constants";

import { mediaCapabilities, productChangeGate } from "./product-capabilities";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ProductStatus } from "./types";

const role = (...codes: PermissionCode[]) => {
  const granted = new Set(codes);
  return (code: PermissionCode) => granted.has(code);
};
/** Seed BE: ECOMMERCE_ADMIN sửa + duyệt sản phẩm (ảnh: UPDATE tải / xoá, APPROVE xuất bản / gỡ). */
const ECOMMERCE_ADMIN = role(
  PRODUCT_PERMISSIONS.read,
  PRODUCT_PERMISSIONS.update,
  PRODUCT_PERMISSIONS.approve,
);
/** Người soạn catalog: sửa nội dung, không duyệt. */
const CATALOG_EDITOR = role(PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.update);
/** Người duyệt: duyệt / xuất bản, không sửa nội dung. */
const APPROVER = role(PRODUCT_PERMISSIONS.read, PRODUCT_PERMISSIONS.approve);
const VIEWER = role(PRODUCT_PERMISSIONS.read);

const media = (status: ProductStatus, can = ECOMMERCE_ADMIN, obsolete = false) =>
  mediaCapabilities(productChangeGate(status), can, obsolete);

describe("productChangeGate — BE Product.acceptsChanges / ProductMediaService.publish", () => {
  it.each([
    [PRODUCT_STATUS.DRAFT, true, false],
    [PRODUCT_STATUS.PENDING_APPROVAL, false, false],
    [PRODUCT_STATUS.APPROVED, true, true],
    [PRODUCT_STATUS.PUBLISHED, true, true],
    [PRODUCT_STATUS.INACTIVE, true, false],
    [PRODUCT_STATUS.DISCONTINUED, false, false],
    [PRODUCT_STATUS.UNKNOWN, false, false],
  ])("%s → acceptsChanges %s, approved %s", (status, acceptsChanges, approved) => {
    expect(productChangeGate(status)).toEqual({ acceptsChanges, approved });
  });
});

describe("mediaCapabilities — tải / xuất bản / gỡ ảnh như BE", () => {
  it("Approved / Published + đủ quyền: tải, xuất bản, gỡ đều được", () => {
    for (const status of [PRODUCT_STATUS.APPROVED, PRODUCT_STATUS.PUBLISHED]) {
      expect(media(status)).toEqual({ upload: true, manage: true, publish: true, withdraw: true });
    }
  });

  it("Draft / Inactive: chưa xuất bản được (PRODUCT_NOT_APPROVED) nhưng vẫn tải và gỡ được", () => {
    for (const status of [PRODUCT_STATUS.DRAFT, PRODUCT_STATUS.INACTIVE]) {
      expect(media(status)).toEqual({ upload: true, manage: true, publish: false, withdraw: true });
    }
  });

  it("Pending Approval / Discontinued: không nhận thay đổi → không thao tác ảnh nào", () => {
    for (const status of [PRODUCT_STATUS.PENDING_APPROVAL, PRODUCT_STATUS.DISCONTINUED]) {
      expect(media(status)).toEqual({
        upload: false,
        manage: false,
        publish: false,
        withdraw: false,
      });
    }
  });

  it("CATALOG_EDITOR (UPDATE, không APPROVE): chỉ tải, không xuất bản / gỡ", () => {
    expect(media(PRODUCT_STATUS.PUBLISHED, CATALOG_EDITOR)).toEqual({
      upload: true,
      manage: true,
      publish: false,
      withdraw: false,
    });
  });

  it("APPROVER (APPROVE, không UPDATE): xuất bản / gỡ, không tải", () => {
    expect(media(PRODUCT_STATUS.APPROVED, APPROVER)).toEqual({
      upload: false,
      manage: false,
      publish: true,
      withdraw: true,
    });
    expect(media(PRODUCT_STATUS.INACTIVE, APPROVER)).toEqual({
      upload: false,
      manage: false,
      publish: false,
      withdraw: true,
    });
  });

  it("chỉ xem: không thao tác ảnh nào ở mọi trạng thái", () => {
    expect(media(PRODUCT_STATUS.PUBLISHED, VIEWER)).toEqual({
      upload: false,
      manage: false,
      publish: false,
      withdraw: false,
    });
  });

  // BE `ProductMediaService`: chỉ `upload` gọi `requireAcceptsImages` (chặn OBSOLETE); `delete` /
  // `describe` (đặt ảnh bìa) chỉ `requireChangeable`.
  it("biến thể ngừng dùng không nhận ảnh mới, vẫn xoá / đặt ảnh bìa / xuất bản / gỡ ảnh cũ", () => {
    expect(media(PRODUCT_STATUS.PUBLISHED, ECOMMERCE_ADMIN, true)).toEqual({
      upload: false,
      manage: true,
      publish: true,
      withdraw: true,
    });
  });
});
