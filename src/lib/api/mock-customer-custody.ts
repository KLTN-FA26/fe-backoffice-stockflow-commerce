/**
 * Mock hàng giữ hộ khách (WF-05 Q-4 / Q-11 / TH-6; BE `ReturnedCartonOwnership`, `ReturnedCartonSettlement`,
 * `ReturnCustodyNotes`). Chỉ trạng thái + route; chỉ dùng khi USE_MOCK=true.
 *
 * - Thùng giữ hộ sau hoàn tiền (audit r3 RAD-1, như BE `ReturnedCartonSettlement.split`): theo từng SKU, số đơn vị được hoàn
 *   trước hết bù hàng về ngoài thùng nguyên (thùng mở, hàng lẻ — chưa từng nhập tồn), phần còn lại lấy thùng nguyên theo thứ
 *   tự LPN — thùng nào được chạm tới thành hàng công ty cả thùng; mọi thùng nguyên khác là của khách (CUSTOMER_HELD).
 * - Hàng trên biên nhận giữ hộ (audit r3 RAD-3): Sale ghi lựa chọn (SEND_BACK / DESTROY_ON_BEHALF có biên bản /
 *   TAKEN_BY_RETURN trên yêu cầu bổ sung cùng khách), Quản lý kho ghi đã rời kho (biên bản, một lần).
 *
 *   (POST /returns/{id}/custody-choice ở `mock-routes-returns.ts`, dùng `custodyChoiceRefusal`)
 *   GET  /inventory/stock-packages/customer-custody?returnRequestId&ended&page&size
 *   POST /inventory/stock-packages/{lpn}/customer-custody/end {note}
 *   GET  /returns/custody-notes?returnRequestId&ended&page&size
 *   POST /returns/{id}/custody/{evidenceId}/choice {choice, note?, takenByReturnId?}
 *   POST /returns/{id}/custody/{evidenceId}/end {note}
 */

import { registerMockRoute } from "./mock-adapter";
import {
  mockCustodyOutcomes,
  mockEndedCustody,
  mockReturnReceipts,
  mockReturns,
} from "./mock-returns-store";
import { bodyOf, fail, ok, pageOf, pathParams, queryOf, text } from "./mock-route-utils";

import type { MockCustodyOutcome, MockReturn, MockReturnReceipt } from "./mock-returns-store";

const now = () => new Date().toISOString();
/** Thùng đã thực hiện (xoá cùng `resetReturnMockStore`). */
const ended = mockEndedCustody();
/** Kết cục của biên nhận giữ hộ theo `evidenceId` (xoá cùng `resetReturnMockStore`). */
const outcomes = mockCustodyOutcomes();
const NOTE_MAX = 500;
const TAKES_NOTHING = ["REJECTED", "CANCELLED", "EXPIRED"];

/** Thùng nguyên giữ hộ khách của một yêu cầu RESOLVED — chia theo từng SKU như BE (audit r3 RAD-1). */
function heldCartonsOf(ret: MockReturn) {
  if (ret.status !== "RESOLVED") return [];
  const receipts = mockReturnReceipts().filter(
    (receipt) => receipt.returnRequestId === ret.id && receipt.status !== "DRAFT",
  );
  const refunded = new Map<string, number>();
  for (const line of ret.lines)
    refunded.set(line.sku, (refunded.get(line.sku) ?? 0) + line.refundQuantity);
  // Hàng về ngoài thùng nguyên (thùng mở, hàng lẻ) được bù trước
  const outside = new Map<string, number>();
  for (const receipt of receipts) {
    for (const carton of receipt.cartons.filter((c) => c.opened))
      outside.set(carton.sku, (outside.get(carton.sku) ?? 0) + carton.countedQuantity);
    for (const loose of receipt.looseLines)
      outside.set(loose.sku, (outside.get(loose.sku) ?? 0) + loose.quantity);
  }
  const sealed = receipts
    .flatMap((receipt) =>
      receipt.cartons
        .filter((carton) => !carton.opened && carton.stockEntered !== false)
        .map((carton) => ({ carton, receipt })),
    )
    .sort((a, b) => a.carton.lpn.localeCompare(b.carton.lpn));
  const left = new Map<string, number>();
  for (const [sku, units] of refunded) left.set(sku, Math.max(0, units - (outside.get(sku) ?? 0)));
  return sealed.filter(({ carton }) => {
    const remaining = left.get(carton.sku) ?? 0;
    if (remaining <= 0) return true;
    left.set(carton.sku, remaining - carton.countedQuantity);
    return false;
  });
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

/** BE `ReturnRequestResponse.custodyCartons`: thùng của yêu cầu giữ hộ khách (đang giữ hoặc đã xử lý). */
export function mockCustodyCartons(ret: MockReturn) {
  return heldCartonsOf(ret).map((held) => {
    const row = rowOf(ret, held);
    return {
      lpn: row.lpn,
      sku: row.sku,
      quantity: row.quantity,
      locationCode: row.locationCode,
      ownership: row.ownership,
      choice: row.choice,
      heldAt: row.heldAt,
      endedAt: row.endedAt,
    };
  });
}

const allHeld = () =>
  mockReturns().flatMap((ret) => heldCartonsOf(ret).map((held) => rowOf(ret, held)));

/**
 * Như BE `ReturnRequestService.recordCustodyChoice` + `CartonReturns.instructCustody`: lỗi khi không ghi được lựa chọn cho
 * yêu cầu (chưa kết thúc, không thùng nào giữ hộ, kho đã thực hiện); null = ghi được. Audit r3 RAD-1: không còn đòi "không
 * đơn vị nào được hoàn".
 */
export function custodyChoiceRefusal(ret: MockReturn) {
  if (ret.status !== "RESOLVED")
    return fail(409, "RETURN_INVALID_TRANSITION", "Only a resolved return");
  const held = heldCartonsOf(ret);
  if (held.length === 0)
    return fail(409, "RETURN_INVALID_TRANSITION", "Nothing of the return is held");
  if (held.some((h) => ended.has(h.carton.lpn)))
    return fail(409, "INVALID_STOCK_PACKAGE_TRANSITION", "Already carried out");
  return null;
}

/** BE `ReturnRequestResponse.CustodyOutcome` của một biên nhận; null khi Sale chưa ghi lựa chọn. */
export const mockCustodyOutcome = (evidenceId: string): MockCustodyOutcome | null =>
  outcomes.get(evidenceId) ?? null;

/** BE `CustodyNoteResponse`: mỗi biên nhận giữ hộ của mọi yêu cầu. */
function custodyNotes() {
  return mockReturns().flatMap((ret) =>
    ret.evidence
      .filter((evidence) => evidence.stage === "CUSTODY" && evidence.custody)
      .map((evidence) => {
        const outcome = outcomes.get(evidence.id) ?? null;
        return {
          evidenceId: evidence.id,
          returnRequestId: ret.id,
          rmaNumber: ret.rmaNumber,
          orderId: ret.orderId,
          orderNumber: ret.orderNumber,
          customerId: ret.customerId,
          warehouseId: ret.warehouseId,
          sku: evidence.custody?.sku ?? null,
          lpn: evidence.custody?.lpn ?? null,
          quantity: evidence.custody?.quantity ?? 0,
          note: evidence.custody?.note ?? null,
          keptBy: "mock-current-user",
          keptAt: evidence.uploadedAt,
          choice: outcome?.choice ?? null,
          choiceNote: outcome?.choiceNote ?? null,
          takenByReturnId: outcome?.takenByReturnId ?? null,
          takenByRmaNumber: outcome?.takenByRmaNumber ?? null,
          chosenBy: outcome?.chosenBy ?? null,
          chosenAt: outcome?.chosenAt ?? null,
          endedAt: outcome?.endedAt ?? null,
          endedBy: outcome?.endedBy ?? null,
          endedNote: outcome?.endedNote ?? null,
        };
      }),
  );
}

/** Biên nhận giữ hộ `evidenceId` của yêu cầu `returnId`, hoặc lỗi như BE. */
function custodyNoteOf(returnId: string, evidenceId: string) {
  const ret = mockReturns().find((r) => r.id === returnId);
  if (!ret)
    return { error: fail(404, "RETURN_REQUEST_NOT_FOUND", `No return request ${returnId}`) };
  const note = ret.evidence.find((e) => e.id === evidenceId && e.stage === "CUSTODY");
  if (!note) return { error: fail(404, "NOT_FOUND", `No custody note ${evidenceId}`) };
  return { ret };
}

/** Như BE `ReturnRequest.chooseForCustody`: lỗi khi lựa chọn không ghi được, null khi ghi được. */
function choiceRefusal(ret: MockReturn, body: Record<string, unknown>, takenBy: MockReturn | null) {
  const choice = text(body.choice);
  if (choice !== "SEND_BACK" && choice !== "DESTROY_ON_BEHALF" && choice !== "TAKEN_BY_RETURN")
    return fail(400, "VALIDATION_FAILED", "choice is required");
  const note = text(body.note);
  if (note.length > NOTE_MAX) return fail(400, "VALIDATION_FAILED", "note is too long");
  if (choice === "DESTROY_ON_BEHALF" && !note)
    return fail(400, "VALIDATION_FAILED", "A destruction names the customer's consent");
  if ((choice === "TAKEN_BY_RETURN") !== (takenBy !== null))
    return fail(400, "VALIDATION_FAILED", "Name the supplementary return when it takes the goods");
  if (takenBy && (takenBy.id === ret.id || takenBy.customerId !== ret.customerId))
    return fail(400, "VALIDATION_FAILED", "Another return of the same customer");
  if (takenBy && TAKES_NOTHING.includes(takenBy.status))
    return fail(409, "RETURN_INVALID_TRANSITION", `Return ${takenBy.rmaNumber} takes no goods`);
  return null;
}

function registerCustodyNoteMockRoutes(wire: (ret: MockReturn) => Record<string, unknown>) {
  registerMockRoute("GET", "/returns/custody-notes", (config) => {
    const q = queryOf(config);
    const wantEnded = q.get("ended") === "true";
    const rows = custodyNotes()
      .filter(
        (row) => !q.get("returnRequestId") || row.returnRequestId === q.get("returnRequestId"),
      )
      .filter((row) => (row.endedAt !== null) === wantEnded)
      .sort((a, b) =>
        wantEnded
          ? (b.endedAt ?? "").localeCompare(a.endedAt ?? "")
          : a.keptAt.localeCompare(b.keptAt),
      );
    return ok(pageOf(rows, Number(q.get("page") ?? 0), Number(q.get("size") ?? 50)));
  });
  registerMockRoute("POST", "/returns/:id/custody/:evidenceId/choice", (config) => {
    const { id = "", evidenceId = "" } = pathParams(config);
    const found = custodyNoteOf(id, evidenceId);
    if (found.error) return found.error;
    const ret = found.ret;
    if (outcomes.get(evidenceId)?.endedAt)
      return fail(409, "RETURN_INVALID_TRANSITION", "The goods left already");
    const body = bodyOf(config);
    const takenById = text(body.takenByReturnId);
    const takenBy = takenById ? (mockReturns().find((r) => r.id === takenById) ?? null) : null;
    if (takenById && !takenBy)
      return fail(404, "RETURN_REQUEST_NOT_FOUND", `No return request ${takenById}`);
    const refusal = choiceRefusal(ret, body, takenBy);
    if (refusal) return refusal;
    outcomes.set(evidenceId, {
      choice: text(body.choice),
      choiceNote: text(body.note) || null,
      takenByReturnId: takenBy?.id ?? null,
      takenByRmaNumber: takenBy?.rmaNumber ?? null,
      chosenBy: "mock-current-user",
      chosenAt: now(),
      endedAt: null,
      endedBy: null,
      endedNote: null,
    });
    ret.version += 1;
    return ok(wire(ret));
  });
  registerMockRoute("POST", "/returns/:id/custody/:evidenceId/end", (config) => {
    const { id = "", evidenceId = "" } = pathParams(config);
    const found = custodyNoteOf(id, evidenceId);
    if (found.error) return found.error;
    const chosen = outcomes.get(evidenceId);
    if (!chosen)
      return fail(409, "RETURN_CUSTODY_CHOICE_REQUIRED", "Sales have not recorded the choice");
    if (chosen.endedAt) return fail(409, "RETURN_INVALID_TRANSITION", "Ended already");
    const takenBy = chosen.takenByReturnId
      ? mockReturns().find((r) => r.id === chosen.takenByReturnId)
      : null;
    if (chosen.choice === "TAKEN_BY_RETURN" && (!takenBy || TAKES_NOTHING.includes(takenBy.status)))
      return fail(409, "RETURN_INVALID_TRANSITION", "The supplementary return took no goods");
    const note = text(bodyOf(config).note);
    if (!note || note.length > NOTE_MAX) return fail(400, "VALIDATION_FAILED", "note is required");
    const done = { ...chosen, endedAt: now(), endedBy: "mock-current-user", endedNote: note };
    outcomes.set(evidenceId, done);
    return ok(done);
  });
}

export function registerCustomerCustodyMockRoutes(
  wire: (ret: MockReturn) => Record<string, unknown>,
): void {
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
  // Audit r3 RAD-3: biên nhận giữ hộ — danh sách TH-6, lựa chọn của khách, rời kho
  registerCustodyNoteMockRoutes(wire);
}
