/**
 * Mock route — SKU riêng của khách (BE `CustomerSkuController`, `GET /customer-skus?customerId[&productId]`,
 * trả mảng `CustomerSku`). SKU riêng chỉ sinh khi thiết kế của khách được duyệt; mock chỉ có các SKU riêng của seed demo
 * WF-02 của BE (`mock-quote-seed.ts`: `LY-GIAY-DEMO-12OZ-XANH` của "Khách hàng demo", `LY-GIAY-DEMO-12OZ-TSM` của Trà Sữa
 * Mây) — khách khác trả mảng rỗng (không bịa SKU). Kiểm `customerId` như Spring.
 */
import { registerMockRoute } from "./mock-adapter";
import { wf02CustomerSkus } from "./mock-quote-seed";
import { fail, isUuidText, ok, queryOf, typeMismatch } from "./mock-route-utils";

export function registerCustomerSkuMockRoutes(): void {
  registerMockRoute("GET", "/customer-skus", async (config) => {
    const customerId = queryOf(config).get("customerId");
    if (!customerId) {
      return fail(
        400,
        "VALIDATION_FAILED",
        "Required request parameter 'customerId' is not present",
      );
    }
    if (!isUuidText(customerId)) return typeMismatch("customerId", "UUID");
    return ok(wf02CustomerSkus(customerId, queryOf(config).get("productId")));
  });
}
