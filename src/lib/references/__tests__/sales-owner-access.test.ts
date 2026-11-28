import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  UNKNOWN_SALES_OWNER_ACCESS,
  salesOwnerAccessOf,
  salesOwnerErrorMessage,
  salesOwnerLine,
  salesOwnerSchema,
} from "../sales-owner-access";

const ME = "me";
const owned = (salesOwnerId: string, extra: Record<string, unknown> = {}) =>
  salesOwnerSchema.parse({
    customerId: "c-1",
    salesOwnerId,
    salesOwnerName: "Trần Văn Sales",
    active: true,
    state: "ASSIGNED",
    ...extra,
  });
const BLOCKED = "Khách này do Trần Văn Sales phụ trách. Nhờ Trần Văn Sales hoặc Sales Manager.";

describe("salesOwnerAccessOf — BR-S12 strict mode (mirror of BE SalesOwnership.mayActFor)", () => {
  it("BR-S12: another Sales' customer → may not act, with the reason naming the owner", () => {
    const access = salesOwnerAccessOf(owned("other"), ME, false);
    expect(access).toMatchObject({ known: true, owned: true, mayAct: false, mine: false });
    expect(access.blockedReason).toBe(BLOCKED);
  });

  it("BR-S12: the owner may act", () => {
    expect(salesOwnerAccessOf(owned(ME), ME, false)).toMatchObject({
      mayAct: true,
      mine: true,
      blockedReason: null,
      coverNote: null,
    });
  });

  it("BR-S07: the active cover may act and reads 'Bạn đang lo thay cho … tới …'", () => {
    const access = salesOwnerAccessOf(
      owned("other", { cover: { userId: ME, name: "Tôi", until: "2099-12-05" } }),
      ME,
      false,
    );
    expect(access).toMatchObject({ mayAct: true, mine: true, blockedReason: null });
    expect(access.coverNote).toBe("Bạn đang lo thay cho Trần Văn Sales tới 05/12/2099");
  });

  it("BR-S07: someone else's cover does not open the customer to me", () => {
    const access = salesOwnerAccessOf(
      owned("other", { cover: { userId: "third", name: "B", until: "2099-12-05" } }),
      ME,
      false,
    );
    expect(access.mayAct).toBe(false);
    expect(access.coverNote).toBeNull();
  });

  it("BR-S12: a manager (customer-sales-owners:UPDATE) may act on anyone's customer", () => {
    expect(salesOwnerAccessOf(owned("other"), ME, true)).toMatchObject({
      mayAct: true,
      mine: false,
      blockedReason: null,
    });
  });

  it.each([
    ["UNASSIGNED", { salesOwnerId: null, salesOwnerName: null, state: "UNASSIGNED" }],
    ["NEEDS_ASSIGNMENT (owner left)", { active: false, state: "NEEDS_ASSIGNMENT" }],
  ])("BR-S12 / case 8: no active owner (%s) → any Sales may act", (_, extra) => {
    expect(salesOwnerAccessOf(owned("other", extra), ME, false)).toMatchObject({
      owned: false,
      mayAct: true,
    });
  });

  it("an older BE without `state`: owned when there is an active owner id", () => {
    expect(salesOwnerAccessOf(owned("other", { state: undefined }), ME, false).mayAct).toBe(false);
    expect(
      salesOwnerAccessOf(owned("other", { state: undefined, active: false }), ME, false).mayAct,
    ).toBe(true);
  });

  it("fallback: unknown owner (no endpoint, no permission, loading) blocks nothing", () => {
    expect(salesOwnerAccessOf(undefined, ME, false)).toEqual(UNKNOWN_SALES_OWNER_ACCESS);
    expect(UNKNOWN_SALES_OWNER_ACCESS.mayAct).toBe(true);
  });

  it("an unknown cover shape is ignored, not a parse failure", () => {
    expect(salesOwnerSchema.parse({ salesOwnerId: "x", cover: "weird" }).cover).toBeNull();
  });
});

describe("salesOwnerErrorMessage — BE error codes", () => {
  const error = (code: string, message = code, details?: Record<string, unknown>) =>
    new ApiError(409, code, message, undefined, undefined, undefined, undefined, details);

  it("CUSTOMER_OWNED_BY_OTHER_SALES: the name the screen knows wins", () => {
    expect(salesOwnerErrorMessage(error("CUSTOMER_OWNED_BY_OTHER_SALES"), "Trần Văn Sales")).toBe(
      BLOCKED,
    );
  });

  it("CUSTOMER_OWNED_BY_OTHER_SALES: else the name in `details`", () => {
    expect(
      salesOwnerErrorMessage(
        error("CUSTOMER_OWNED_BY_OTHER_SALES", "x", { salesOwnerName: "Trần Văn Sales" }),
      ),
    ).toBe(BLOCKED);
  });

  it("CUSTOMER_OWNED_BY_OTHER_SALES: else the BE's own Vietnamese sentence, else a generic one", () => {
    expect(
      salesOwnerErrorMessage(error("CUSTOMER_OWNED_BY_OTHER_SALES", "Khách này do A phụ trách.")),
    ).toBe("Khách này do A phụ trách.");
    expect(salesOwnerErrorMessage(error("CUSTOMER_OWNED_BY_OTHER_SALES"))).toBe(
      "Khách này do Sale khác phụ trách. Nhờ người đó hoặc Sales Manager.",
    );
  });

  it("BR-S05 / case 18: CUSTOMER_UNASSIGNED_CLAIM_ONLY names the owner", () => {
    expect(salesOwnerErrorMessage(error("CUSTOMER_UNASSIGNED_CLAIM_ONLY"), "A")).toBe(
      "Khách này do A phụ trách nên không nhận được hội thoại. Nhờ A hoặc Sales Manager.",
    );
  });

  it("other codes and non-API errors → null (the caller's own message)", () => {
    expect(salesOwnerErrorMessage(error("QUOTE_EXPIRED"))).toBeNull();
    expect(salesOwnerErrorMessage(new Error("x"))).toBeNull();
  });
});

describe("salesOwnerLine — the owner line of the inbox / quote request rows", () => {
  it("owner, owner with a cover, unassigned, needs assignment", () => {
    expect(salesOwnerLine(owned("other"))).toBe("Sale phụ trách: Trần Văn Sales");
    expect(
      salesOwnerLine(owned("other", { cover: { userId: "b", name: "Lê B", until: null } })),
    ).toBe("Sale phụ trách: Trần Văn Sales (Lê B lo thay)");
    expect(
      salesOwnerLine(owned("x", { salesOwnerId: null, salesOwnerName: null, state: "UNASSIGNED" })),
    ).toBe("Chưa có Sale phụ trách");
    expect(salesOwnerLine(owned("x", { active: false, state: "NEEDS_ASSIGNMENT" }))).toBe(
      "Cần giao người phụ trách (trước đây: Trần Văn Sales)",
    );
    expect(salesOwnerLine(undefined)).toBeNull();
  });
});
