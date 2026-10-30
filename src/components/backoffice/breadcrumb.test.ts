import { describe, expect, it } from "vitest";

import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";

import { buildBreadcrumbItems } from "./BackofficeShell";

describe("buildBreadcrumbItems", () => {
  it("đăng ký route Inventory trong điều hướng back-office", () => {
    expect(buildBreadcrumbItems(INVENTORY_ROUTES.overview)).toEqual([
      { label: "Back-office", href: "/admin" },
      { label: INVENTORY_LABELS.overviewTitle, href: undefined },
    ]);
  });

  it("trang sửa hiện '… / <mã> / Chỉnh sửa', không hiện chữ 'edit'", () => {
    expect(buildBreadcrumbItems("/admin/suppliers/SUP-001/edit")).toEqual([
      { label: "Back-office", href: "/admin" },
      { label: "Nhà cung cấp", href: "/admin/suppliers" },
      { label: "SUP-001", href: "/admin/suppliers/SUP-001" },
      { label: "Chỉnh sửa" },
    ]);
  });

  it("biên bản bàn giao của chuyến hiện '… / <chuyến> / Biên bản bàn giao'", () => {
    expect(buildBreadcrumbItems("/admin/loads/LOAD-2026-0001/manifest").slice(1)).toEqual([
      { label: "Chuyến xe", href: "/admin/loads" },
      { label: "LOAD-2026-0001", href: "/admin/loads/LOAD-2026-0001" },
      { label: "Biên bản bàn giao" },
    ]);
    expect(buildBreadcrumbItems("/admin/transfers/create").at(-1)).toEqual({
      label: "Tạo lệnh chuyển kho",
    });
  });

  it("phiếu xếp hàng của xe hiện '… / <mã kế hoạch> / Phiếu xếp hàng', liên kết về kế hoạch", () => {
    expect(
      buildBreadcrumbItems("/admin/load-plans/plan-1/vehicles/2/print", undefined, (id) =>
        id === "plan-1" ? "LP-20261022-0001" : undefined,
      ).slice(1),
    ).toEqual([
      { label: "Kế hoạch xếp xe", href: "/admin/load-plans" },
      { label: "LP-20261022-0001", href: "/admin/load-plans/plan-1" },
      { label: "Phiếu xếp hàng" },
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

  it("điều chỉnh tồn: danh sách, trang tạo và chi tiết đều nằm dưới menu Điều chỉnh tồn", () => {
    const root = { label: "Back-office", href: "/admin" };
    const parent = { label: "Điều chỉnh tồn", href: INVENTORY_ROUTES.adjustments };
    expect(buildBreadcrumbItems(INVENTORY_ROUTES.adjustments)).toEqual([
      root,
      { label: "Điều chỉnh tồn", href: undefined },
    ]);
    expect(buildBreadcrumbItems(INVENTORY_ROUTES.createAdjustment)).toEqual([
      root,
      parent,
      { label: INVENTORY_LABELS.createAdjustment },
    ]);
    const id = "d0000001-0000-4000-8000-000000000009";
    expect(buildBreadcrumbItems(INVENTORY_ROUTES.adjustment(id))).toEqual([
      root,
      parent,
      { label: id },
    ]);
  });

  it("lịch sử biến động có breadcrumb riêng, không lẫn với Di chuyển nội bộ", () => {
    expect(buildBreadcrumbItems(INVENTORY_ROUTES.movements)).toEqual([
      { label: "Back-office", href: "/admin" },
      { label: "Lịch sử biến động", href: undefined },
    ]);
    expect(buildBreadcrumbItems("/admin/moves").at(-1)?.label).toBe("Di chuyển nội bộ");
  });
});
