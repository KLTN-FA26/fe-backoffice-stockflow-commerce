import { describe, expect, it } from "vitest";

import { PRODUCT_PERMISSIONS } from "@/constants";

import { allowedVariantActions, countVariantsByStatus } from "./variant-lifecycle";

import type { PermissionCode } from "@/lib/auth";
import type { Variant } from "./variant-schemas";

const with_ =
  (...codes: PermissionCode[]) =>
  (code: PermissionCode) =>
    codes.includes(code);
const actions = (
  status: Variant["status"],
  can: (c: PermissionCode) => boolean,
  defaultVariant = false,
) => allowedVariantActions({ status, defaultVariant }, can).map((a) => a.code);
const { update, approve } = PRODUCT_PERMISSIONS;

describe("allowedVariantActions (BE VariantStatus#canTransitionTo + @RequiresPermission)", () => {
  it("DRAFT → kích hoạt / ngừng dùng cần APPROVE; UPDATE thôi thì không có gì", () => {
    expect(actions("DRAFT", with_(update, approve))).toEqual(["activate", "obsolete"]);
    expect(actions("DRAFT", with_(update))).toEqual([]);
  });

  it("ACTIVE → tạm chặn (UPDATE) + ngừng dùng (APPROVE); BLOCKED → kích hoạt lại", () => {
    expect(actions("ACTIVE", with_(update))).toEqual(["block"]);
    expect(actions("ACTIVE", with_(update, approve))).toEqual(["block", "obsolete"]);
    expect(actions("BLOCKED", with_(approve))).toEqual(["activate", "obsolete"]);
  });

  it("sản phẩm chưa duyệt: không có Kích hoạt (BE 409; duyệt sản phẩm tự kích hoạt biến thể Nháp)", () => {
    expect(
      allowedVariantActions(
        { status: "DRAFT", defaultVariant: false },
        with_(update, approve),
        false,
      ).map((a) => a.code),
    ).toEqual(["obsolete"]);
  });

  it("OBSOLETE là kết thúc; biến thể mặc định không ngừng dùng riêng", () => {
    expect(actions("OBSOLETE", with_(update, approve))).toEqual([]);
    expect(actions("ACTIVE", with_(update, approve), true)).toEqual(["block"]);
  });

  it("đếm biến thể theo trạng thái", () => {
    const v = (status: Variant["status"]) => ({ status }) as Variant;
    expect(countVariantsByStatus([v("ACTIVE"), v("ACTIVE"), v("OBSOLETE")])).toEqual({
      DRAFT: 0,
      ACTIVE: 2,
      BLOCKED: 0,
      OBSOLETE: 1,
    });
  });
});
