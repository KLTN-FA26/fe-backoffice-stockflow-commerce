import { describe, expect, it } from "vitest";

import { RECEIPT_COUNT_FIELD_MESSAGES as M, RECEIPT_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  PRODUCTION_ORDER_LINE_ID,
  apiLine,
  apiReceipt,
  cartonPackage,
  productionProgress,
} from "./__fixtures__/receipt";
import { receiptCountInputSchema } from "./count-schemas";
import {
  buildCountRows,
  countFieldErrors,
  countResult,
  countSignature,
  toLinesRequest,
} from "./count-selectors";
import { toReceipt } from "./api";

import type { ProductionLineRef } from "@/lib/references/production-orders";
import type { CountRow } from "./types";

const OTHER_LINE_ID = "6c2f3a4b-8d5e-4f9a-8c1d-000000000002";
/** Dòng 1: 10 thùng × 50, đã nhận 4. Dòng 2: 6 thùng × 24, chưa nhận. */
const ORDER_LINES: ProductionLineRef[] = [
  {
    id: PRODUCTION_ORDER_LINE_ID,
    sku: "CUP-PRINT-ACME-12OZ",
    cartons: 10,
    unitsPerCarton: 50,
    receivedCartons: 4,
  },
  {
    id: OTHER_LINE_ID,
    sku: "LID-PRINT-ACME-90",
    cartons: 6,
    unitsPerCarton: 24,
    receivedCartons: 0,
  },
];

/** Phiếu nháp đã đếm dòng 1 với 2 thùng. */
function countedReceipt() {
  return toReceipt(
    apiReceipt({
      lines: [
        apiLine({
          packages: [
            cartonPackage({
              lpn: "LPN-20261024-000001",
              quantity: 50,
              nominalQty: 50,
            }),
            cartonPackage({
              id: "c-2",
              lpn: "LPN-20261024-000002",
              quantity: 50,
              nominalQty: 50,
            }),
          ],
          production: productionProgress(),
        }),
      ],
    }),
  );
}

function row(overrides: Partial<CountRow> = {}): CountRow {
  return {
    productionOrderLineId: OTHER_LINE_ID,
    sku: "LID-PRINT-ACME-90",
    unitsPerCarton: 24,
    orderedCartons: 6,
    receivedCartons: 0,
    maxCartons: 6,
    onReceipt: false,
    locationCode: "HCM-RCV01",
    existing: [],
    newCartons: 0,
    ...overrides,
  };
}

describe("buildCountRows — dòng form theo dòng Đơn sản xuất (docs 03 §4.1 bước 2)", () => {
  it("phiếu nháp mới (chưa dòng) → mỗi dòng Đơn sản xuất một dòng, giới hạn = đặt − đã nhận", () => {
    const rows = buildCountRows(toReceipt(apiReceipt()), ORDER_LINES, "HCM-RCV01");
    expect(rows.map((r) => [r.sku, r.maxCartons, r.onReceipt, r.existing.length])).toEqual([
      ["CUP-PRINT-ACME-12OZ", 6, false, 0],
      ["LID-PRINT-ACME-90", 6, false, 0],
    ]);
  });

  it("dòng đã đếm → giữ thùng RECEIVING, giới hạn = còn lại + phiếu này (BE đã trừ phiếu này khỏi còn lại)", () => {
    const [first] = buildCountRows(countedReceipt(), ORDER_LINES, "HCM-RCV02");
    expect(first?.onReceipt).toBe(true);
    expect(first?.maxCartons).toBe(4 + 2);
    expect(first?.existing).toEqual([
      { lpn: "LPN-20261024-000001", keep: true },
      { lpn: "LPN-20261024-000002", keep: true },
    ]);
    // Khu đã lưu của dòng thắng khu mặc định
    expect(first?.locationCode).toBe("HCM-RCV01");
  });
});

describe("toLinesRequest — body PUT /lines thay toàn bộ bản đếm", () => {
  it("bỏ dòng chưa đếm, thùng giữ gửi lpn, thùng mới gửi {}, thùng bỏ không gửi; rowOf trỏ đúng dòng form", () => {
    const rows = [
      row({ productionOrderLineId: "a", newCartons: 0 }),
      row({
        productionOrderLineId: "b",
        onReceipt: true,
        existing: [
          { lpn: "LPN-1", keep: true },
          { lpn: "LPN-2", keep: false },
        ],
        newCartons: 2,
      }),
    ];
    const { body, rowOf } = toLinesRequest(rows);
    expect(body).toEqual({
      lines: [
        {
          productionOrderLineId: "b",
          locationCode: "HCM-RCV01",
          packages: [{ lpn: "LPN-1" }, {}, {}],
        },
      ],
    });
    expect(rowOf).toEqual([1]);
    // BR-03: không gửi lô; BR-13: không gửi số cái
    expect(JSON.stringify(body)).not.toMatch(/lotNumber|quantity/);
  });
});

describe("countFieldErrors — lỗi BE lines[i] về đúng dòng form", () => {
  it("lines[0] của request là dòng form 1 khi dòng form 0 không được gửi", () => {
    const error = new ApiError(
      409,
      "RECEIPT_EXCEEDS_PRODUCTION_ORDER",
      "Receipt line: too many",
      { "lines[0].packages": "too many", "lines[0].locationCode": "not RECEIVING" },
      undefined,
      {
        "lines[0].packages": "RECEIPT_EXCEEDS_PRODUCTION_ORDER",
        "lines[0].locationCode": "LOCATION_AREA_MISMATCH",
      },
    );
    expect(countFieldErrors(error, [1])).toEqual([
      {
        row: 1,
        field: "newCartons",
        message: RECEIPT_ERROR_MESSAGES.RECEIPT_EXCEEDS_PRODUCTION_ORDER,
      },
      { row: 1, field: "locationCode", message: RECEIPT_ERROR_MESSAGES.LOCATION_AREA_MISMATCH },
    ]);
  });

  it("BE #396: thùng chưa đủ kích thước / khối lượng → RECEIPT_LINE_UNIT_INVALID ở lines[i].unitOfMeasure, hiện ở ô thùng của đúng dòng", () => {
    const error = new ApiError(
      422,
      "RECEIPT_LINE_UNIT_INVALID",
      "The carton has no size or weight yet",
      { "lines[1].unitOfMeasure": "The carton of LID, CARTON, has no size or weight yet" },
      undefined,
      { "lines[1].unitOfMeasure": "RECEIPT_LINE_UNIT_INVALID" },
    );
    expect(countFieldErrors(error, [0, 1])).toEqual([
      { row: 1, field: "newCartons", message: RECEIPT_ERROR_MESSAGES.RECEIPT_LINE_UNIT_INVALID },
    ]);
    expect(RECEIPT_ERROR_MESSAGES.RECEIPT_LINE_UNIT_INVALID).toMatch(/kích thước, khối lượng/);
  });

  it("lỗi không thuộc dòng nào / không phải ApiError → không map (form hiện lỗi chung)", () => {
    expect(countFieldErrors(new ApiError(409, "X", "x", { lines: "empty" }), [0])).toEqual([]);
    expect(countFieldErrors(new Error("boom"), [0])).toEqual([]);
  });
});

describe("countResult — đối chiếu đủ / thiếu / thừa theo số thùng luỹ kế (docs 03 §4.1 bước 3)", () => {
  it.each([
    [0, "none"],
    [3, "short"],
    [6, "full"],
    [7, "over"],
  ] as const)("đã nhận 0 / đặt 6, phiếu này %i thùng → %s", (cartons, expected) => {
    expect(countResult(row({ newCartons: cartons }))).toBe(expected);
  });
});

describe("receiptCountInputSchema — BR traceable", () => {
  const parse = (rows: CountRow[]) => receiptCountInputSchema.safeParse({ rows });
  const messages = (rows: CountRow[]) => {
    const result = parse(rows);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it("BR-02: vượt số thùng còn nhận được → chặn", () => {
    expect(messages([row({ newCartons: 7 })])).toContain(M.exceedsOpen(6));
  });

  it("Bước 5: dòng đã có thùng bỏ hết thùng → chặn", () => {
    expect(
      messages([row({ onReceipt: true, existing: [{ lpn: "LPN-1", keep: false }] })]),
    ).toContain(M.lineHadCartons);
  });

  it("Khu nhận bắt buộc với dòng có thùng", () => {
    expect(messages([row({ newCartons: 1, locationCode: "" })])).toContain(M.locationRequired);
  });

  it("BR-12: không dòng nào có thùng → chặn lưu", () => {
    expect(messages([row()])).toContain(M.nothingCounted);
  });

  it("số thùng không phải số nguyên ≥ 0 → báo lỗi ô", () => {
    expect(messages([row({ newCartons: Number.NaN })])).toContain(M.cartonsInvalid);
    expect(messages([row({ newCartons: -1 })])).toContain(M.cartonsInvalid);
  });

  it("bản đếm hợp lệ → qua", () => {
    expect(parse([row({ newCartons: 6 }), row({ productionOrderLineId: "x" })]).success).toBe(true);
  });
});

describe("countSignature", () => {
  it("đổi khi phiếu có thùng mới sau khi lưu, giữ nguyên khi không đổi", () => {
    const saved = countedReceipt();
    expect(countSignature(saved)).toBe(countSignature(countedReceipt()));
    expect(countSignature(saved)).not.toBe(countSignature(toReceipt(apiReceipt())));
  });
});
