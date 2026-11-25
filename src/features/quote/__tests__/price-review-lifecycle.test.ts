import { describe, expect, it } from "vitest";

import { QUOTE_PERMISSIONS, QUOTE_PRICE_APPROVAL_PERMISSIONS } from "@/constants";

import { QUOTE_ACCEPTED, QUOTE_ROW } from "../__fixtures__/quote-ds02";
import { allowedStaffQuoteActions } from "../lifecycle";
import { quoteDtoSchema, quoteRowDtoSchema } from "../schemas";
import { isPriceReviewSubmitter } from "../selectors";

/** Sales: sửa / gửi / huỷ / rút lại (`sales-quotes:UPDATE`), không duyệt giá. */
const sales = (code: string) => code === QUOTE_PERMISSIONS.update;
/** Quản lý kinh doanh: xem báo giá + duyệt giá, không sửa (`sales-quotes` chỉ VIEW_PAGE / READ). */
const manager = (code: string) =>
  code === QUOTE_PERMISSIONS.read || code === QUOTE_PRICE_APPROVAL_PERMISSIONS.approve;
const readOnly = (code: string) => code === QUOTE_PERMISSIONS.read;
const pending = { pending: true, submittedByMe: false };

describe("allowedStaffQuoteActions — nháp chờ duyệt giá (14 BR-10, 3 vai trò)", () => {
  it("Sales: không sửa / gửi; rút lại hoặc huỷ", () => {
    expect(allowedStaffQuoteActions("DRAFT", sales, false, false, pending)).toEqual([
      "withdrawPriceReview",
      "cancel",
    ]);
  });
  it("Quản lý kinh doanh: duyệt / từ chối, không rút lại, không huỷ", () => {
    expect(allowedStaffQuoteActions("DRAFT", manager, false, false, pending)).toEqual([
      "approvePrice",
      "rejectPrice",
    ]);
  });
  it("chỉ đọc: không có nút nào", () => {
    expect(allowedStaffQuoteActions("DRAFT", readOnly, false, false, pending)).toEqual([]);
  });
  it("bốn mắt: người gửi duyệt không duyệt / từ chối dù có quyền", () => {
    const both = (code: string) => sales(code) || manager(code);
    expect(
      allowedStaffQuoteActions("DRAFT", both, false, false, { pending: true, submittedByMe: true }),
    ).toEqual(["withdrawPriceReview", "cancel"]);
  });
  it("nháp không chờ duyệt: như trước (sửa, gửi, huỷ); cờ chờ chỉ có nghĩa với DRAFT", () => {
    expect(allowedStaffQuoteActions("DRAFT", sales)).toEqual(["edit", "send", "cancel"]);
    expect(allowedStaffQuoteActions("SENT", manager, false, false, pending)).toEqual([]);
  });
});

describe("hợp đồng BE — trường duyệt giá", () => {
  it("BE cũ chưa có trường: không chờ duyệt, không có kiểm tra giá", () => {
    const quote = quoteDtoSchema.parse(QUOTE_ACCEPTED);
    expect([quote.priceReviewPending, quote.priceReview, quote.priceCheck]).toEqual([
      false,
      null,
      null,
    ]);
    expect(quoteRowDtoSchema.parse(QUOTE_ROW).priceReviewPending).toBe(false);
  });
  it("bậc không có giá tham chiếu: nguồn / giá / phần trăm bị bỏ khỏi JSON (`non_null`)", () => {
    const quote = quoteDtoSchema.parse({
      ...QUOTE_ACCEPTED,
      status: "DRAFT",
      priceReviewPending: true,
      priceCheck: {
        thresholdPercent: 10.0,
        needsApproval: true,
        lines: [
          {
            lineNo: 1,
            sku: "X",
            cartons: 5,
            needsApproval: true,
            tiers: [{ minQuantity: 1, unitPrice: 900, needsApproval: true }],
          },
        ],
      },
    });
    expect(quote.priceCheck?.lines[0]?.tiers[0]).toMatchObject({
      referencePrice: null,
      source: null,
      discountPercent: null,
    });
  });
});

describe("isPriceReviewSubmitter", () => {
  const quote = (submittedBy: string, outcome = "PENDING", pendingFlag = true) =>
    quoteDtoSchema.parse({
      ...QUOTE_ACCEPTED,
      status: "DRAFT",
      priceReviewPending: pendingFlag,
      priceReview: {
        id: "r1",
        revision: 1,
        outcome,
        thresholdPercent: 10,
        submittedAt: "2099-11-12T05:00:00Z",
        submittedBy,
        lines: [],
      },
    });
  it("so id không phân biệt hoa thường; chỉ khi lần gửi duyệt đang chờ", () => {
    expect(isPriceReviewSubmitter(quote("ABC"), "abc")).toBe(true);
    expect(isPriceReviewSubmitter(quote("abc"), "other")).toBe(false);
    expect(isPriceReviewSubmitter(quote("abc", "REJECTED", false), "abc")).toBe(false);
    expect(isPriceReviewSubmitter(quote("abc"), null)).toBe(false);
  });
});
