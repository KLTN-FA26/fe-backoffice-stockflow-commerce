import { SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { CONTRACT_ESIGN_PATHS } from "@/constants/contract-esign";

import { registerMockRoute } from "./mock-adapter";
import { chatCaller } from "./mock-chat-store";
import { contractEsignView } from "./mock-contract-esign";
import { findWf02Order, orderTotal } from "./mock-contract-orders";
import { mockContracts } from "./mock-contract-store";
import { guarded } from "./mock-quote-refusal";
import { ok, pageOf, queryOf } from "./mock-route-utils";
import { salesOwnerFields } from "./mock-routes-sales-owner";
import { callerWith } from "./mock-sales-owner-store";

async function rows() {
  return Promise.all(
    mockContracts().map(async (contract) => {
      const order = findWf02Order(contract.orderId);
      const fields = contractEsignView(contract);
      return {
        orderId: contract.orderId,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        orderNumber: order?.orderNumber,
        customerId: order?.customerId,
        customerName: contract.buyer.name,
        status: contract.status,
        revision: fields.revision,
        totalAmount: order ? orderTotal(order) : undefined,
        sentAt: contract.sentAt,
        signBy: fields.signBy,
        overdueToSign: fields.overdueToSign,
        customerSignedAt: fields.customerSignedAt,
        signedAt: contract.signedAt,
        termsReview: fields.termsReview,
        ...(order ? await salesOwnerFields(order.customerId) : {}),
      };
    }),
  );
}
export function registerContractListMockRoutes() {
  registerMockRoute(
    "GET",
    CONTRACT_ESIGN_PATHS.summary,
    guarded(async () => {
      const caller = await callerWith(SALES_CONTRACT_PERMISSIONS.read);
      if (typeof caller !== "string") return caller;
      const all = await rows();
      const counts: Record<string, number> = {};
      for (const row of all) counts[row.status] = (counts[row.status] ?? 0) + 1;
      return ok({
        byStatus: counts,
        awaitingCompanySignature: counts.CUSTOMER_SIGNED ?? 0,
        overdueToSign: all.filter((row) => row.overdueToSign).length,
        termsReviewPending: all.filter((row) => row.termsReview === "PENDING").length,
      });
    }),
  );
  registerMockRoute(
    "GET",
    CONTRACT_ESIGN_PATHS.list,
    guarded(async (config) => {
      const caller = await callerWith(SALES_CONTRACT_PERMISSIONS.read);
      if (typeof caller !== "string") return caller;
      const q = queryOf(config);
      const status = q.getAll("status");
      const mine = q.get("mine") === "true" ? (await chatCaller())?.id : null;
      const search = q.get("q")?.trim().toLocaleLowerCase("vi");
      const filtered = (await rows()).filter(
        (row) =>
          (!status.length || status.includes(row.status)) &&
          (!mine || mine === row.salesOwnerId) &&
          (!q.get("salesOwnerId") || q.get("salesOwnerId") === row.salesOwnerId) &&
          (!q.get("termsReview") || q.get("termsReview") === row.termsReview) &&
          (!q.get("signByBefore") ||
            (row.status === "SENT" &&
              !!row.signBy &&
              row.signBy < (q.get("signByBefore") ?? ""))) &&
          (!search ||
            [row.contractNumber, row.orderNumber, row.customerName].some((v) =>
              v?.toLocaleLowerCase("vi").includes(search),
            )),
      );
      return ok(
        pageOf(
          filtered,
          Math.max(0, Number(q.get("page")) || 0),
          Math.max(1, Number(q.get("size")) || 15),
        ),
      );
    }),
  );
}
