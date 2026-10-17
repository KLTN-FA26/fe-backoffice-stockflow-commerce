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
    const canApprove = (code: string) => code === PRODUCT_PERMISSIONS.approve;
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

  // BE `ProductController`: suspension / resumption / discontinuation đều là product-products:APPROVE;
  // BE `ProductStatus#canTransitionTo`: INACTIVE chỉ đến từ APPROVED hoặc PUBLISHED.
  it("tạm ngưng chỉ từ Approved / Published, cần APPROVE; tiếp tục chỉ từ Inactive", () => {
    const canApprove = (code: string) => code === PRODUCT_PERMISSIONS.approve;
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
