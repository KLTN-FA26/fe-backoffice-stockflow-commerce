/**
 * Mock hàng giữ hộ khách (WF-05 Q-4 / TH-6, audit r2 returns H1; BE `ReturnedCartonOwnership`, `CustomerGoodsCustody`):
 * một yêu cầu trả hàng kết thúc không hoàn đơn vị nào → các thùng NGUYÊN đã nhập trên phiếu nhập hàng hoàn của nó là hàng của
 * khách, giữ hộ ở khu cách ly (ngoài sổ). Sale ghi lựa chọn của khách trên yêu cầu; Quản lý kho ghi đã thực hiện. Chỉ trạng
 * thái + route; chỉ dùng khi USE_MOCK=true.
 *
 *   (POST /returns/{id}/custody-choice ở `mock-routes-returns.ts`, dùng `custodyChoiceRefusal`)
 *   GET  /inventory/stock-packages/customer-custody?returnRequestId&ended&page&size
 *   POST /inventory/stock-packages/{lpn}/customer-custody/end {note}
 */

import { registerMockRoute } from "./mock-adapter";
import { mockEndedCustody, mockReturnReceipts, mockReturns } from "./mock-returns-store";
import { bodyOf, fail, ok, pageOf, pathParams, queryOf, text } from "./mock-route-utils";

import type { MockReturn, MockReturnReceipt } from "./mock-returns-store";

const now = () => new Date().toISOString();
/** Thùng đã thực hiện (xoá cùng `resetReturnMockStore`). */
const ended = mockEndedCustody();

/** Yêu cầu RESOLVED không hoàn đơn vị nào (BE: hàng vẫn là của khách). */
export const refundedNothing = (ret: MockReturn): boolean =>
  ret.status === "RESOLVED" && ret.lines.every((line) => line.refundQuantity === 0);

/** Thùng nguyên đã nhập trên phiếu đã xác nhận của yêu cầu — giữ hộ khi yêu cầu không hoàn gì. */
function heldCartonsOf(ret: MockReturn) {
  if (!refundedNothing(ret)) return [];
  return mockReturnReceipts()
    .filter((receipt) => receipt.returnRequestId === ret.id && receipt.status !== "DRAFT")
    .flatMap((receipt) =>
      receipt.cartons
        .filter((carton) => !carton.opened && carton.stockEntered !== false)
        .map((carton) => ({ carton, receipt })),
    );
}

/** BE `CartonView.heldForCustomer` trên phiếu nhập hàng hoàn. */
export function mockHeldForCustomer(receipt: MockReturnReceipt, lpn: string): boolean {
  const ret = mockReturns().find((r) => r.id === receipt.returnRequestId);
  return !!ret && heldCartonsOf(ret).some((held) => held.carton.lpn === lpn);
}

function rowOf(ret: MockReturn, held: ReturnType<typeof heldCartonsOf>[number]) {
  const done = ended.get(held.carton.lpn);
  return {
    lpn: held.carton.lpn,
    sku: held.carton.sku,
    lotNumber: held.carton.lotNumber,
    quantity: held.carton.countedQuantity,
    locationCode: held.receipt.quarantineLocationCode,
    returnRequestId: ret.id,
    ownership: done?.ownership ?? "CUSTOMER_HELD",
    heldAt: ret.closedAt,
    choice: ret.custodyChoice ?? null,
    endedAt: done?.endedAt ?? null,
    endedBy: done ? "mock-current-user" : null,
    note: done?.note ?? null,
  };
}

const allHeld = () =>
  mockReturns().flatMap((ret) => heldCartonsOf(ret).map((held) => rowOf(ret, held)));

/**
 * Như BE `ReturnRequestService.recordCustodyChoice` + `CartonReturns.instructCustody`: lỗi khi không ghi được lựa chọn cho
 * yêu cầu (chưa kết thúc / có hoàn, không thùng nào giữ hộ, kho đã thực hiện); null = ghi được.
 */
export function custodyChoiceRefusal(ret: MockReturn) {
  if (!refundedNothing(ret))
    return fail(409, "RETURN_INVALID_TRANSITION", "Only a return that refunded nothing");
  const held = heldCartonsOf(ret);
  if (held.length === 0)
    return fail(409, "RETURN_INVALID_TRANSITION", "Nothing of the return is held");
  if (held.some((h) => ended.has(h.carton.lpn)))
    return fail(409, "INVALID_STOCK_PACKAGE_TRANSITION", "Already carried out");
  return null;
}

export function registerCustomerCustodyMockRoutes(): void {
  registerMockRoute("GET", "/inventory/stock-packages/customer-custody", (config) => {
    const q = queryOf(config);
    const wantEnded = q.get("ended") === "true";
    const rows = allHeld()
      .filter(
        (row) => !q.get("returnRequestId") || row.returnRequestId === q.get("returnRequestId"),
      )
      .filter((row) => (row.endedAt !== null) === wantEnded);
    return ok(pageOf(rows, Number(q.get("page") ?? 0), Number(q.get("size") ?? 50)));
  });
  registerMockRoute("POST", "/inventory/stock-packages/:lpn/customer-custody/end", (config) => {
    const lpn = pathParams(config).lpn ?? "";
    const row = allHeld().find((r) => r.lpn === lpn);
    if (!row) return fail(404, "STOCK_PACKAGE_NOT_FOUND", "Not held for a customer");
    if (row.endedAt) return fail(409, "INVALID_STOCK_PACKAGE_TRANSITION", "Already carried out");
    if (!row.choice) return fail(409, "STOCK_PACKAGE_DECISION_PENDING", "No choice recorded");
    const note = text(bodyOf(config).note);
    if (!note) return fail(400, "VALIDATION_FAILED", "note is required");
    ended.set(lpn, {
      endedAt: now(),
      note,
      ownership: row.choice === "SEND_BACK" ? "CUSTOMER_SENT_BACK" : "CUSTOMER_DESTROYED",
    });
    return ok(allHeld().find((r) => r.lpn === lpn));
  });
}
