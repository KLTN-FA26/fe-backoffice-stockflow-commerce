import { describe, expect, it } from "vitest";

import { CARRIER_EVENT_RESULTS } from "@/constants";

import {
  beCarrierEventDetailSchema,
  beCarrierEventPageSchema,
  beCarrierEventRowSchema,
  carrierEventNoteSchema,
} from "./carrier-event-schemas";

const MINIMAL = {
  eventId: "ev-1",
  carrierId: "car-1",
  carrierCode: "AHAMOVE",
  source: "WEBHOOK",
  receivedAt: "2026-11-18T06:58:56.561938Z",
  signatureValid: false,
  result: "INVALID_SIGNATURE",
  resultNote: "Carrier AHAMOVE does not take webhooks now",
  decidedAt: "2026-11-18T06:58:56.561938Z",
};

describe("beCarrierEventRowSchema — BE CarrierEvents.EventRow", () => {
  it("nhận dòng tối thiểu (BE bỏ null): trường tuỳ chọn vắng", () => {
    const row = beCarrierEventRowSchema.parse(MINIMAL);
    expect(row.kind).toBeUndefined();
    expect(row.loadCode).toBeUndefined();
    expect(row.resolvedAt).toBeUndefined();
  });

  it("nhận dòng đầy đủ đã được xử lý", () => {
    const row = beCarrierEventRowSchema.parse({
      ...MINIMAL,
      source: "FILE",
      signatureValid: true,
      kind: "DELIVERED",
      carrierReference: "NB-1-1",
      carrierReportedAt: "2026-11-18T03:00:00Z",
      warehouseId: "wh-1",
      loadId: "ld-1",
      loadCode: "LD-20261117-0001",
      shipmentId: "sh-1",
      shipmentCode: "SO-1-S1",
      result: "NEEDS_REVIEW",
      resolvedAt: "2026-11-18T08:00:00Z",
      resolvedBy: "u-1",
      resolvedByName: "Trần Minh Khoa",
      resolutionNote: "Đã ghi tay",
    });
    expect(row.loadCode).toBe("LD-20261117-0001");
    expect(row.resolvedByName).toBe("Trần Minh Khoa");
  });

  it("enum lạ của BE không làm hỏng cả trang: thành UNKNOWN", () => {
    const row = beCarrierEventRowSchema.parse({
      ...MINIMAL,
      result: "SOMETHING_NEW",
      source: "QUEUE",
      kind: "NEW_KIND",
    });
    expect(row.result).toBe("UNKNOWN");
    expect(row.source).toBe("UNKNOWN");
    expect(row.kind).toBe("UNKNOWN");
  });

  it("nhận đủ mọi kết quả của BE", () => {
    for (const result of CARRIER_EVENT_RESULTS) {
      expect(beCarrierEventRowSchema.parse({ ...MINIMAL, result }).result).toBe(result);
    }
  });

  it("thiếu mã sự kiện hoặc thời điểm nhận là sai hợp đồng", () => {
    expect(beCarrierEventRowSchema.safeParse({ ...MINIMAL, eventId: undefined }).success).toBe(
      false,
    );
    expect(beCarrierEventRowSchema.safeParse({ ...MINIMAL, receivedAt: "hôm qua" }).success).toBe(
      false,
    );
  });
});

describe("trang và chi tiết", () => {
  it("trang BE PageResponse", () => {
    const page = beCarrierEventPageSchema.parse({
      items: [MINIMAL],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(page.items).toHaveLength(1);
  });

  it("chi tiết kèm nội dung; nội dung có thể vắng", () => {
    const detail = beCarrierEventDetailSchema.parse({ event: MINIMAL, payload: "{}" });
    expect(detail.payload).toBe("{}");
    expect(beCarrierEventDetailSchema.parse({ event: MINIMAL }).payload).toBeUndefined();
  });
});

describe("carrierEventNoteSchema — ghi chú xử lý", () => {
  const schema = carrierEventNoteSchema({ required: "thiếu", tooLong: "dài" }, 10);
  it("bắt buộc, cắt khoảng trắng đầu / cuối", () => {
    expect(schema.safeParse({ note: "   " }).error?.issues[0]?.message).toBe("thiếu");
    expect(schema.parse({ note: "  ok  " })).toEqual({ note: "ok" });
  });
  it("tối đa theo giới hạn", () => {
    expect(schema.safeParse({ note: "x".repeat(10) }).success).toBe(true);
    expect(schema.safeParse({ note: "x".repeat(11) }).error?.issues[0]?.message).toBe("dài");
  });
});
