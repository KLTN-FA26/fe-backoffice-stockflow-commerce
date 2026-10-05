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

  it("thiếu quyền vào menu → breadcrumb chỉ hiện chữ, không có link tới trang bị chặn", () => {
    const items = buildBreadcrumbItems("/admin/suppliers/SUP-001/edit", () => false);
    expect(items.slice(1)).toEqual([
      { label: "Nhà cung cấp", href: undefined },
      { label: "SUP-001", href: undefined },
      { label: "Chỉnh sửa" },
    ]);
  });

  it("có nhãn đăng ký cho id (vd UUID → mã NCC) thì hiện nhãn thay vì id", () => {
    const uuid = "d0000001-0000-4000-8000-000000000002";
    const labelFor = (id: string) => (id === uuid ? "SUP-002" : undefined);

    expect(buildBreadcrumbItems(`/admin/suppliers/${uuid}`, () => true, labelFor).at(-1)).toEqual({
      label: "SUP-002",
    });
    expect(
      buildBreadcrumbItems(`/admin/suppliers/${uuid}/edit`, () => true, labelFor).slice(2),
    ).toEqual([{ label: "SUP-002", href: `/admin/suppliers/${uuid}` }, { label: "Chỉnh sửa" }]);
  });
});
