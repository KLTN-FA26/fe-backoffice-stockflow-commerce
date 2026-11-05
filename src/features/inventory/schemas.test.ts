import { describe, expect, it } from "vitest";

import { STOCK_ADJUSTMENT_REASONS, STOCK_MOVEMENT_TYPES } from "@/constants/inventory";

import {
  adjustmentCreateInput,
  adjustmentListInput,
  adjustmentRejectionInput,
  movementListInput,
  movementPageDto,
  stockAdjustmentDto,
} from "./schemas";

const input = {
  locationCode: "HCM-A01-1-A",
  sku: "CUP-PP-500",
  quantityDelta: -3,
  reason: "SCRAP",
};

describe("SKU của form điều chỉnh khớp BE @ValidSku", () => {
  it.each(["CUP_12", "A.B", "X", "cup-pp.500_a"])("chấp nhận %s", (sku) => {
    expect(adjustmentCreateInput.safeParse({ ...input, sku }).success).toBe(true);
  });

  it.each(["", " ", "-AB", "A B", "A".repeat(65)])("từ chối %j", (sku) => {
    expect(adjustmentCreateInput.safeParse({ ...input, sku }).success).toBe(false);
  });
});

describe("SCRUM-424 adjustment input contract", () => {
  it.each(STOCK_ADJUSTMENT_REASONS)("accepts the documented %s reason", (reason) => {
    expect(
      adjustmentCreateInput.safeParse({ ...input, reason, note: "Count correction" }).success,
    ).toBe(true);
  });

  it.each(["", "DAMAGE", "SUBCONTRACT_LOSS", "COUNT_VARIANCE"])(
    "does not send unsupported manual reason %s",
    (reason) => expect(adjustmentCreateInput.safeParse({ ...input, reason }).success).toBe(false),
  );

  it.each([0, 1.5, 1_000_001, -1_000_001])("rejects invalid delta %s", (quantityDelta) => {
    expect(adjustmentCreateInput.safeParse({ ...input, quantityDelta }).success).toBe(false);
  });

  it.each(["SCRAP", "SAMPLE"])("%s can only write down", (reason) => {
    expect(adjustmentCreateInput.safeParse({ ...input, reason, quantityDelta: 3 }).success).toBe(
      false,
    );
  });

  it("requires a nonblank note for OTHER", () => {
    expect(adjustmentCreateInput.safeParse({ ...input, reason: "OTHER", note: " " }).success).toBe(
      false,
    );
  });

  it("trims location and optional explanation", () => {
    const result = adjustmentCreateInput.parse({
      ...input,
      locationCode: " HCM-A01-1-A ",
      note: " reason ",
    });
    expect(result.locationCode).toBe(input.locationCode);
    expect(result.note).toBe("reason");
  });

  it("requires a rejection reason", () => {
    expect(adjustmentRejectionInput.safeParse({ reason: " " }).success).toBe(false);
  });
});

// Backend develop 0f18f24 StockMovementResponse / StockAdjustmentResponse expose
// type/status/toStatus/referenceType/reason as Strings.
const movement = {
  movementId: "00000000-0000-4000-8000-000000000001",
  type: "MOVE",
  sku: "CUP-PP-500",
  fromLocation: "HCM-A01-1-A",
  toLocation: "HCM-A01-1-B",
  quantity: 3,
  status: "AVAILABLE",
  toStatus: "AVAILABLE",
  referenceType: "MOVE_TASK",
  occurredAt: "2026-10-11T00:00:00Z",
};

function movementPage(items: unknown[]) {
  return {
    items,
    page: 0,
    size: 15,
    totalElements: items.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };
}

describe("stock movement response contract", () => {
  it.each(["STATUS_CHANGE", "PICK", "PUT_BACK"])("parses a current %s row", (type) => {
    expect(movementPageDto.parse(movementPage([{ ...movement, type }])).items[0]?.type).toBe(type);
  });

  it("keeps an unknown type verbatim without invalidating the rest of the page", () => {
    const result = movementPageDto.safeParse(
      movementPage([movement, { ...movement, type: "FUTURE_MOVEMENT_TYPE" }]),
    );
    expect(result.success).toBe(true);
    expect(result.data?.items.map((item) => item.type)).toEqual(["MOVE", "FUTURE_MOVEMENT_TYPE"]);
  });

  it("accepts null status/toStatus", () => {
    const parsed = movementPageDto.parse(
      movementPage([{ ...movement, status: null, toStatus: null }]),
    );
    expect(parsed.items[0]).toMatchObject({ status: null, toStatus: null });
  });

  it("accepts status/toStatus omitted under NON_NULL", () => {
    const { status: _status, toStatus: _toStatus, ...omitted } = movement;
    expect(movementPageDto.safeParse(movementPage([omitted])).success).toBe(true);
  });

  it.each(["PICK_LINE", "EXPIRY_SWEEP", "FUTURE_REFERENCE"])(
    "keeps referenceType %s open",
    (referenceType) => {
      expect(
        movementPageDto.parse(movementPage([{ ...movement, referenceType }])).items[0]
          ?.referenceType,
      ).toBe(referenceType);
    },
  );

  it("filters only by the backend MovementType values", () => {
    expect(STOCK_MOVEMENT_TYPES).toEqual([
      "RECEIPT",
      "MOVE",
      "ADJUSTMENT",
      "TRANSFER_OUT",
      "STATUS_CHANGE",
      "PICK",
      "PUT_BACK",
    ]);
    STOCK_MOVEMENT_TYPES.forEach((type) =>
      expect(movementListInput.safeParse({ page: 0, size: 15, type }).success).toBe(true),
    );
    expect(
      movementListInput.safeParse({ page: 0, size: 15, type: "FUTURE_MOVEMENT_TYPE" }).success,
    ).toBe(false);
  });
});

describe("stock adjustment response contract", () => {
  const adjustment = {
    adjustmentId: "00000000-0000-4000-8000-000000000002",
    number: "ADJ-1",
    locationCode: "HCM-A01-1-A",
    sku: "CUP-PP-500",
    quantityDelta: -3,
    reason: "SCRAP",
    status: "PENDING_APPROVAL",
    requestedBy: "00000000-0000-4000-8000-000000000003",
    requestedAt: "2026-10-11T00:00:00Z",
    version: 0,
  };

  it("parses known reason and status", () => {
    expect(stockAdjustmentDto.parse(adjustment)).toMatchObject({
      reason: "SCRAP",
      status: "PENDING_APPROVAL",
    });
  });

  it("keeps unknown reason and status verbatim", () => {
    expect(
      stockAdjustmentDto.parse({ ...adjustment, reason: "COUNT_VARIANCE", status: "APPROVED" }),
    ).toMatchObject({ reason: "COUNT_VARIANCE", status: "APPROVED" });
  });

  // BE tools/db/seed/seed_test_data.sql: id = md5('seed:' || key)::uuid — đúng dạng 8-4-4-4-12
  // nhưng không đúng version/variant RFC 9562. Dòng ADJ-20261011-0001 và movement của ADJ-20260905-0001.
  it("parses seeded rows whose ids are md5-derived", () => {
    expect(
      stockAdjustmentDto.safeParse({
        ...adjustment,
        adjustmentId: "3e61c961-f65c-6aa1-f4b6-bd405feff853",
        requestedBy: "a9609637-006a-05a8-6fb0-eb4cb5b18c70",
        decidedBy: "b5205f3d-6f81-b2d8-10d5-2b1bdf24a55c",
      }).success,
    ).toBe(true);
    expect(
      movementPageDto.safeParse(
        movementPage([
          {
            ...movement,
            movementId: "68dd0ee7-02e7-135e-dce9-cc92509d7a51",
            referenceId: "ad95bf27-4af5-17fd-4480-4da77cb52728",
            actorId: "b5205f3d-6f81-b2d8-10d5-2b1bdf24a55c",
          },
        ]),
      ).success,
    ).toBe(true);
  });

  it("read tolerance does not widen the create or list-query contract", () => {
    expect(stockAdjustmentDto.safeParse({ ...adjustment, reason: "COUNT_VARIANCE" }).success).toBe(
      true,
    );
    expect(adjustmentCreateInput.safeParse({ ...input, reason: "COUNT_VARIANCE" }).success).toBe(
      false,
    );
    expect(adjustmentListInput.safeParse({ page: 0, size: 15, status: "APPROVED" }).success).toBe(
      false,
    );
  });
});
