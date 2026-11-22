/** Lý do gốc của hãng (docs 09 §4.1): chỉ ghi chú của bước giao thất bại do webhook báo mới được gắn nhãn "của hãng". */
import { describe, expect, it } from "vitest";

import { failureNoteIsCarrierWording, isCarrierOriginalWording } from "./carrier-original-note";

import type { Shipment } from "./types";

type Step = Shipment["timeline"][number];

const step = (over: Partial<Step>): Step =>
  ({
    status: "DELIVERY_FAILED",
    occurredAt: "2026-11-21T02:31:00Z",
    note: "CUSTOMER_NOT_AVAILABLE",
    source: "CARRIER_WEBHOOK",
    ...over,
  }) as Step;

describe("isCarrierOriginalWording", () => {
  it("bước giao thất bại do webhook báo kèm ghi chú → lý do gốc của hãng", () => {
    expect(isCarrierOriginalWording(step({}))).toBe(true);
  });

  it("ghi tay, bước khác, hoặc không có ghi chú → không phải lý do gốc của hãng", () => {
    expect(isCarrierOriginalWording(step({ source: "MANUAL" }))).toBe(false);
    expect(isCarrierOriginalWording(step({ status: "RETURNED" }))).toBe(false);
    expect(isCarrierOriginalWording(step({ note: null }))).toBe(false);
  });
});

describe("failureNoteIsCarrierWording", () => {
  it("ghi chú của lô trùng chữ với bước webhook → gắn nhãn của hãng", () => {
    const data = { failureNote: "CUSTOMER_NOT_AVAILABLE", timeline: [step({})] } as Shipment;
    expect(failureNoteIsCarrierWording(data)).toBe(true);
  });

  it("ghi chú do kho nhập tay (không có bước webhook cùng chữ) → giữ nhãn 'Ghi chú nội bộ'", () => {
    const data = {
      failureNote: "Gọi 3 lần không ai nghe",
      timeline: [step({ source: "MANUAL", note: "Gọi 3 lần không ai nghe" })],
    } as Shipment;
    expect(failureNoteIsCarrierWording(data)).toBe(false);
  });
});
