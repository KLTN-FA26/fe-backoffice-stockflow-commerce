/**
 * Mock route WF-02 (plan WF02-FE-plan, BE origin/develop): báo giá theo thùng, hợp đồng của đơn, chat của Sale.
 * Dữ liệu lấy theo seed demo của BE (`src/main/resources/db/demo/V20261124000500__demo_chat.sql`,
 * `V20261124000600__demo_wf02.sql`, `V20261203000100__demo_wf02_ds02b_overdue_customer.sql`), không bịa.
 */
import { registerBusinessDocumentMockRoutes } from "./mock-routes-business-documents";
import { registerChatMockRoutes } from "./mock-routes-chat";
import { registerContractEsignMockRoutes } from "./mock-routes-contract-esign";
import { registerContractListMockRoutes } from "./mock-routes-contract-list";

import { registerContractMockRoutes } from "./mock-routes-contracts";
import { registerLegalProfileMockRoutes } from "./mock-routes-legal-profile";
import { registerQuoteMockRoutes } from "./mock-routes-quotes";

export function registerWf02MockRoutes(): void {
  // Giấy tờ WF-05 (BE feat/business-documents): đăng ký ở đây vì nhóm này chạy trước module đơn / thanh toán / hoá đơn
  registerBusinessDocumentMockRoutes();
  registerQuoteMockRoutes();
  registerContractMockRoutes();
  registerContractEsignMockRoutes();
  registerContractListMockRoutes();
  registerLegalProfileMockRoutes();
  registerChatMockRoutes();
}
