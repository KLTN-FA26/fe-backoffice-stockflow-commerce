import { describe, expect, it } from "vitest";

import { buildBreadcrumbItems } from "./BackofficeShell";

describe("buildBreadcrumbItems", () => {
  it("trang sửa hiện '… / <mã> / Chỉnh sửa', không hiện chữ 'edit'", () => {
    expect(buildBreadcrumbItems("/admin/suppliers/SUP-001/edit")).toEqual([
      { label: "Back-office", href: "/admin" },
      { label: "Nhà cung cấp", href: "/admin/suppliers" },
      { label: "SUP-001", href: "/admin/suppliers/SUP-001" },
      { label: "Chỉnh sửa" },
    ]);
  });

  it("trang chi tiết và trang tạo giữ nguyên như cũ", () => {
    expect(buildBreadcrumbItems("/admin/suppliers/SUP-001").at(-1)).toEqual({ label: "SUP-001" });
    expect(buildBreadcrumbItems("/admin/suppliers/create").at(-1)).toEqual({
      label: "Tạo nhà cung cấp",
    });
  });
});
