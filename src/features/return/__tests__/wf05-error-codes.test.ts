/**
 * Invariant G5 (WF-05 fix plan): mọi mã lỗi BE mà một màn WF-05 về trả hàng / phiếu nhập hàng hoàn / hoàn tiền / phiếu thu
 * có thể nhận đều có câu tiếng Việt — mã mới của PR-0 (`pr0-contracts.md` §1) và các mã sẵn có mà các luồng dùng lại.
 */
import { describe, expect, it } from "vitest";

import { apiError } from "@/test/api-screen";

import { PAYMENT_ERROR_MESSAGES, paymentErrorMessage } from "@/features/payment/errors";

import { RETURN_ERROR_MESSAGES, returnErrorMessage } from "../errors";

const RETURN_CODES = [
  // PR-0 §1 (G4)
  "RETURN_REFUSAL_REASON_REQUIRED",
  "RETURN_RECEIPT_DRAFT_OPEN",
  "RETURN_CARTON_NOT_CLAIMED",
  "RETURN_LOOSE_EXCEEDS_APPROVED",
  "RETURN_LOOSE_PHOTO_REQUIRED",
  "RETURN_RECEIPT_MANAGER_CONFIRMATION_REQUIRED",
  "RETURN_RECEIPT_SELF_CONFIRMATION",
  "RETURN_SHIPMENT_NOT_RETURNABLE",
  // reused by the fixes
  "RETURN_RECEIPT_ALREADY_OPEN",
  "RETURN_NOT_AWAITING_GOODS",
  "RETURN_QUANTITIES_INVALID",
  "RETURN_EVIDENCE_LIMIT_REACHED",
  "RETURN_ORDER_NOT_RETURNABLE",
] as const;

describe("WF-05: every return / payment error code has a Vietnamese sentence", () => {
  it.each(RETURN_CODES)("%s", (code) => {
    const sentence = RETURN_ERROR_MESSAGES[code];
    expect(sentence).toBeTruthy();
    // BE sends its English log detail as the message: the screen shows the FE sentence instead
    expect(returnErrorMessage(apiError(409, code, undefined, "English detail"))).toBe(sentence);
  });

  it("PAYMENT_RECEIPT_VOID_AFTER_HANDOVER (PR-0 §1, G2)", () => {
    const sentence = PAYMENT_ERROR_MESSAGES.PAYMENT_RECEIPT_VOID_AFTER_HANDOVER;
    expect(sentence).toMatch(/bàn giao/);
    expect(paymentErrorMessage(apiError(409, "PAYMENT_RECEIPT_VOID_AFTER_HANDOVER"))).toBe(
      sentence,
    );
  });
});
