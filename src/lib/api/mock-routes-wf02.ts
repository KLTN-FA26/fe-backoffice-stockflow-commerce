/**
 * Mock route WF-02 (plan WF02-FE-plan, BE origin/develop): báo giá theo thùng, hợp đồng của đơn, chat của Sale.
 * Dữ liệu lấy theo seed demo của BE (`src/main/resources/db/demo/V20261124000500__demo_chat.sql`,
 * `V20261124000600__demo_wf02.sql`, `V20261203000100__demo_wf02_ds02b_overdue_customer.sql`), không bịa.
 */
import { registerChatMockRoutes } from "./mock-routes-chat";
import { registerContractMockRoutes } from "./mock-routes-contracts";
import { registerLegalProfileMockRoutes } from "./mock-routes-legal-profile";
import { registerQuoteMockRoutes } from "./mock-routes-quotes";

export function registerWf02MockRoutes(): void {
  registerQuoteMockRoutes();
  registerContractMockRoutes();
  registerLegalProfileMockRoutes();
  registerChatMockRoutes();
}
