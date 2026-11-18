/**
 * Mock route — SKU riêng của khách (BE `CustomerSkuController`, `GET /customer-skus?customerId[&productId]`,
 * trả mảng `CustomerSku`). SKU riêng chỉ sinh khi thiết kế của khách được duyệt; dữ liệu mock chưa có thiết kế
 * nào được duyệt thành SKU nên luôn trả mảng rỗng (không bịa SKU). Kiểm `customerId` như Spring.
 */
import { registerMockRoute } from "./mock-adapter";
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
    return ok([]);
  });
}
