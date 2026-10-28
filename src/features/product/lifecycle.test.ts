import { describe, expect, it } from "vitest";

import { allowedProductActions, nextProductStatuses, isSelfApproval } from "./lifecycle";

import { PRODUCT_PERMISSIONS } from "@/constants/permissions";
import { hasPermission } from "@/lib/auth/me-permissions";

import type { ProductStatus } from "./types";

describe("product lifecycle", () => {
  it("allows product transitions from Draft per docs §5", () => {
    expect(nextProductStatuses("Draft")).toEqual(["Pending Approval"] satisfies ProductStatus[]);
  });

  it("gates Pending Approval actions by backend APPROVE permission", () => {
    expect(
      allowedProductActions("Pending Approval", (code) => code === PRODUCT_PERMISSIONS.approve).map(
        (action) => action.code,
      ),
    ).toEqual(["approve", "reject"]);
  });

  it("matches self approval only by the authenticated user UUID", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    expect(isSelfApproval(userId, userId)).toBe(true);
    expect(isSelfApproval(userId, "22222222-2222-4222-8222-222222222222")).toBe(false);
    expect(isSelfApproval(undefined, userId)).toBe(false);
  });

  it("uses the exact backend publication and discontinuation transitions", () => {
    expect(nextProductStatuses("Approved")).toEqual(["Published", "Discontinued", "Inactive"]);
    expect(nextProductStatuses("Published")).toEqual(["Approved", "Discontinued", "Inactive"]);
    expect(nextProductStatuses("Active")).toEqual([]);
  });

  it("Inactive (tạm ngưng) có thể về Approved hoặc ngừng kinh doanh; UNKNOWN không có thao tác", () => {
    expect(nextProductStatuses("Inactive")).toEqual(["Approved", "Discontinued"]);
    const canApprove = (code: string) => code === PRODUCT_PERMISSIONS.lifecycle;
    expect(allowedProductActions("Inactive", canApprove).map((a) => a.code)).toEqual([
      "resume",
      "discontinue",
    ]);
    expect(allowedProductActions("UNKNOWN", canApprove)).toEqual([]);
    expect(nextProductStatuses("UNKNOWN")).toEqual([]);
  });

  it("product capabilities depend on returned grants, never role names", () => {
    expect(
      hasPermission(
        { roles: ["ROLE_SYSTEM_ADMIN"], permissions: [], dataScope: "ALL" },
        PRODUCT_PERMISSIONS.create,
      ),
    ).toBe(false);
    expect(
      hasPermission(
        { roles: [], permissions: [PRODUCT_PERMISSIONS.create], dataScope: "ALL" },
        PRODUCT_PERMISSIONS.create,
      ),
    ).toBe(true);
    expect(allowedProductActions("Pending Approval", () => false)).toEqual([]);
  });

  // BE `ProductLifecycleController` (PR #123): suspension / resumption / discontinuation là
  // product-lifecycle:APPROVE (chỉ System Admin); publish / unpublish vẫn là product-products:APPROVE.
  // BE `ProductStatus#canTransitionTo`: INACTIVE chỉ đến từ APPROVED hoặc PUBLISHED.
  it("tạm ngưng chỉ từ Approved / Published, cần quyền lifecycle; tiếp tục chỉ từ Inactive", () => {
    const canApprove = (code: string) =>
      code === PRODUCT_PERMISSIONS.approve || code === PRODUCT_PERMISSIONS.lifecycle;
    const codes = (status: ProductStatus, can: (code: string) => boolean) =>
      allowedProductActions(status, can).map((a) => a.code);
    expect(codes("Approved", canApprove)).toEqual(["publish", "suspend", "discontinue"]);
    expect(codes("Published", canApprove)).toEqual(["unpublish", "suspend", "discontinue"]);
    expect(codes("Draft", canApprove)).not.toContain("suspend");
    expect(codes("Pending Approval", canApprove)).not.toContain("suspend");
    expect(codes("Discontinued", canApprove)).toEqual([]);
    // Chỉ có UPDATE thì không có nút tạm ngưng / tiếp tục.
    const canUpdate = (code: string) => code === PRODUCT_PERMISSIONS.update;
    expect(codes("Approved", canUpdate)).toEqual([]);
    expect(codes("Inactive", canUpdate)).toEqual([]);
    // E-commerce Admin: có product-products:APPROVE nhưng không có product-lifecycle:APPROVE.
    const ecommerceAdmin = (code: string) => code === PRODUCT_PERMISSIONS.approve;
    expect(codes("Approved", ecommerceAdmin)).toEqual(["publish"]);
    expect(codes("Published", ecommerceAdmin)).toEqual(["unpublish"]);
    expect(codes("Inactive", ecommerceAdmin)).toEqual([]);
  });

  // BE #123 (32d1506a, V20261019000700): tạm ngưng / tiếp tục / ngừng kinh doanh chỉ System Admin
  // (product-lifecycle:APPROVE); product-products:APPROVE vẫn duyệt / từ chối / xuất bản / gỡ.
  describe("quyền vòng đời tách khỏi quyền duyệt (BE #123)", () => {
    const codes = (status: ProductStatus, can: (code: string) => boolean) =>
      allowedProductActions(status, can).map((a) => a.code);
    const grants =
      (...granted: string[]) =>
      (code: string) =>
        granted.includes(code);
    const ECOMMERCE_ADMIN = grants(PRODUCT_PERMISSIONS.update, PRODUCT_PERMISSIONS.approve);
    const SYSTEM_ADMIN = grants(
      PRODUCT_PERMISSIONS.update,
      PRODUCT_PERMISSIONS.approve,
      PRODUCT_PERMISSIONS.lifecycle,
    );
    const CATALOG_EDITOR = grants(PRODUCT_PERMISSIONS.update);

    it("mã quyền khớp BE ProductResources.LIFECYCLE", () => {
      expect(PRODUCT_PERMISSIONS.lifecycle).toBe("product-lifecycle:APPROVE");
    });
    it("E-commerce Admin: duyệt / xuất bản / gỡ, KHÔNG tạm ngưng / tiếp tục / ngừng", () => {
      expect(codes("Pending Approval", ECOMMERCE_ADMIN)).toEqual(["approve", "reject"]);
      expect(codes("Approved", ECOMMERCE_ADMIN)).toEqual(["publish"]);
      expect(codes("Published", ECOMMERCE_ADMIN)).toEqual(["unpublish"]);
      expect(codes("Inactive", ECOMMERCE_ADMIN)).toEqual([]);
    });
    it("System Admin: đủ cả duyệt lẫn tạm ngưng / tiếp tục / ngừng", () => {
      expect(codes("Pending Approval", SYSTEM_ADMIN)).toEqual(["approve", "reject"]);
      expect(codes("Published", SYSTEM_ADMIN)).toEqual(["unpublish", "suspend", "discontinue"]);
      expect(codes("Inactive", SYSTEM_ADMIN)).toEqual(["resume", "discontinue"]);
    });
    it("người soạn catalog (chỉ UPDATE): không thao tác vòng đời nào", () => {
      expect(codes("Published", CATALOG_EDITOR)).toEqual([]);
      expect(codes("Inactive", CATALOG_EDITOR)).toEqual([]);
    });
  });

  // BR-02 docs 01 §6 + BE `Product.requireDeletable`: chỉ xoá sản phẩm Nháp, bằng quyền DELETE riêng.
  it("xoá chỉ cho sản phẩm Draft và cần quyền DELETE (không phải APPROVE / UPDATE)", () => {
    const codes = (status: ProductStatus, can: (code: string) => boolean) =>
      allowedProductActions(status, can).map((a) => a.code);
    const canDelete = (code: string) => code === PRODUCT_PERMISSIONS.delete;
    expect(codes("Draft", canDelete)).toEqual(["delete"]);
    expect(codes("Draft", (c) => c === PRODUCT_PERMISSIONS.update)).toEqual(["edit", "submit"]);
    expect(codes("Approved", canDelete)).toEqual([]);
    expect(codes("Inactive", canDelete)).toEqual([]);
    expect(PRODUCT_PERMISSIONS.delete).toBe("product-products:DELETE");
  });
});
