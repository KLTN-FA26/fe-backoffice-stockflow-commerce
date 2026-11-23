/**
 * Sidebar chia tab theo nhóm chức năng và module của docs (docs 00 §3 "Bản đồ module"):
 * mỗi trang nằm ở nhóm của module sở hữu nó, không gom chung một nhóm "Thực hiện đơn".
 */
import { describe, expect, it } from "vitest";

import { ADMIN_ROUTES, NAV_GROUP_LABELS, PRODUCTION_LABELS, UI_LABELS } from "@/constants";
import { EINVOICE_ROUTES } from "@/constants/einvoice";
import { INVENTORY_ROUTES } from "@/constants/inventory";
import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES } from "@/constants/payment";
import { RETURN_ROUTES } from "@/constants/returns";

import { NAV_GROUPS } from "./BackofficeShell";

const hrefsOf = (title: string) =>
  NAV_GROUPS.find((group) => group.title === title)?.items.map((item) => item.href);

describe("NAV_GROUPS — chia tab theo docs 00 §3", () => {
  it("thứ tự nhóm theo luồng end-to-end: sản phẩm → bán → sản xuất → kho → giao → thu tiền", () => {
    expect(NAV_GROUPS.map((group) => group.title)).toEqual([
      NAV_GROUP_LABELS.overview,
      NAV_GROUP_LABELS.product,
      NAV_GROUP_LABELS.design,
      NAV_GROUP_LABELS.sales,
      NAV_GROUP_LABELS.order,
      PRODUCTION_LABELS.navGroup,
      NAV_GROUP_LABELS.receiving,
      UI_LABELS.warehouseMap.workspace.navGroup,
      NAV_GROUP_LABELS.inventory,
      NAV_GROUP_LABELS.shipping,
      PAYMENT_LABELS.navGroup,
      NAV_GROUP_LABELS.system,
    ]);
  });

  it("Sản phẩm (01) gồm hồ sơ hàng tồn — quy cách thùng là dữ liệu sản phẩm (§4.7)", () => {
    expect(hrefsOf(NAV_GROUP_LABELS.product)).toEqual([
      ADMIN_ROUTES.products.list,
      ADMIN_ROUTES.attributes,
      ADMIN_ROUTES.taxonomy.list,
      ADMIN_ROUTES.inventoryItems.list,
    ]);
  });

  it("Thiết kế (12) tách khỏi Bán hàng", () => {
    expect(hrefsOf(NAV_GROUP_LABELS.design)).toEqual([
      ADMIN_ROUTES.designs.reviewQueue,
      ADMIN_ROUTES.designQuoteRequests.list,
    ]);
  });

  it("Bán hàng gồm bảng giá nội bộ của khách (13 §4.2), không nằm ở dữ liệu sản phẩm", () => {
    expect(hrefsOf(NAV_GROUP_LABELS.sales)).toEqual([
      ADMIN_ROUTES.customers.list,
      ADMIN_ROUTES.customerPrices.list,
      ADMIN_ROUTES.quotes.list,
      // L-6: người làm báo giá thấy "Đơn hàng" ở đây (bản ở nhóm Đơn hàng ẩn với họ — `unlessPermission`)
      ADMIN_ROUTES.orders.list,
      ADMIN_ROUTES.chat.list,
      ADMIN_ROUTES.chat.canned,
      ADMIN_ROUTES.chat.agentsReport,
    ]);
  });

  it("Đơn hàng (17) chỉ còn việc của đơn — không lẫn vận chuyển hay công nợ", () => {
    expect(hrefsOf(NAV_GROUP_LABELS.order)).toEqual([
      ADMIN_ROUTES.orders.list,
      ADMIN_ROUTES.orders.cancellationRequests,
      ADMIN_ROUTES.orders.deliveryFailures,
      RETURN_ROUTES.list,
    ]);
  });

  it("Nhập kho (03) gồm phiếu theo Đơn sản xuất và phiếu hàng hoàn", () => {
    expect(hrefsOf(NAV_GROUP_LABELS.receiving)).toEqual([
      ADMIN_ROUTES.receipts.list,
      RETURN_ROUTES.receipts.list,
    ]);
  });

  it("Tồn kho (20) không chứa trang của module 01 hay 06", () => {
    expect(hrefsOf(NAV_GROUP_LABELS.inventory)).toEqual([
      INVENTORY_ROUTES.overview,
      INVENTORY_ROUTES.adjustments,
      INVENTORY_ROUTES.quarantine,
      INVENTORY_ROUTES.movements,
    ]);
  });

  it("Vận chuyển (09) gom ước tính tải, kế hoạch xếp xe, chuyến và hãng", () => {
    expect(hrefsOf(NAV_GROUP_LABELS.shipping)).toEqual([
      ADMIN_ROUTES.loadEstimateTrial,
      ADMIN_ROUTES.loadPlans.list,
      ADMIN_ROUTES.shipments.list,
      ADMIN_ROUTES.loads.list,
      ADMIN_ROUTES.vehicleTypes,
      ADMIN_ROUTES.carriers,
      ADMIN_ROUTES.carrierEvents,
    ]);
  });

  it("đơn treo công nợ nằm ở Thanh toán & hoá đơn — Kế toán duyệt (15 §4.3)", () => {
    expect(hrefsOf(PAYMENT_LABELS.navGroup)).toEqual([
      PAYMENT_ROUTES.installments.list,
      PAYMENT_ROUTES.receivables,
      PAYMENT_ROUTES.receipts.list,
      PAYMENT_ROUTES.refunds.list,
      ADMIN_ROUTES.orders.creditHolds,
      EINVOICE_ROUTES.list,
      EINVOICE_ROUTES.register,
      EINVOICE_ROUTES.settings,
    ]);
  });

  it("mỗi trang chỉ thuộc đúng một nhóm — trừ bản ẩn bằng `unlessPermission` (L-6)", () => {
    const items = NAV_GROUPS.flatMap((group) => group.items);
    const hrefs = items.filter((item) => !item.unlessPermission).map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    // Bản ẩn phải có bản thay thế mở bằng đúng mã đó — một người dùng không bao giờ thấy hai lần, cũng không mất mục
    for (const hidden of items) {
      const code = hidden.unlessPermission;
      if (!code) continue;
      const twin = items.find(
        (item) =>
          item !== hidden && item.href === hidden.href && item.anyPermission?.includes(code),
      );
      expect(twin).toBeDefined();
    }
  });

  it("tên nhóm không trùng nhau (drill-down mở màn con theo tên nhóm)", () => {
    const titles = NAV_GROUPS.map((group) => group.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
