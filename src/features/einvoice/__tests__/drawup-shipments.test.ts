import { describe, expect, it } from "vitest";

import { formatDate } from "@/lib/format/date";

import { shipmentChoiceLabel, shipmentChoices } from "../drawup-shipments";
import { listItemJson } from "../__fixtures__/screen";

import type { EInvoiceListItem } from "../types";

const item = (over: Record<string, unknown>) => listItemJson(over) as unknown as EInvoiceListItem;
const TEXT = {
  byDate: (date: string) => `Lô giao ngày ${date}`,
  invoiceState: (status: string) => `hoá đơn ${status.toLowerCase()}`,
  noInvoice: "chưa có hoá đơn",
};

describe("shipmentChoices", () => {
  it("one row per shipment, sorted by code, ignoring invoices that name no shipment", () => {
    const rows = shipmentChoices(
      [
        item({ id: "a", shipmentId: "s2", shipmentCode: "SO-1-S10" }),
        item({ id: "b", shipmentId: "s1", shipmentCode: "SO-1-S2" }),
        item({ id: "c", shipmentId: null, shipmentCode: null }),
      ],
      [],
    );
    expect(rows.map((row) => row.code)).toEqual(["SO-1-S2", "SO-1-S10"]);
  });

  it("prefers a live invoice over a voided one, and the base invoice over an adjustment", () => {
    const rows = shipmentChoices(
      [
        item({ id: "v", status: "VOIDED_DRAFT", shipmentId: "s1", shipmentCode: "SO-1-S1" }),
        item({
          id: "adj",
          type: "ADJUSTMENT",
          status: "ISSUED",
          shipmentId: "s1",
          shipmentCode: "SO-1-S1",
        }),
        item({
          id: "base",
          type: "ORIGINAL",
          status: "DRAFT",
          shipmentId: "s1",
          shipmentCode: "SO-1-S1",
        }),
      ],
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.statusLabel).toBe("Nháp");
  });

  it("adds delivered shipments with no invoice, oldest delivery first, after the invoiced ones", () => {
    const rows = shipmentChoices(
      [item({ id: "a", shipmentId: "s1", shipmentCode: "SO-1-S1" })],
      [
        { shipmentId: "s1", deliveredAt: "2026-11-10T03:00:00Z" },
        { shipmentId: "s3", deliveredAt: "2026-11-12T03:00:00Z" },
        { shipmentId: "s2", deliveredAt: "2026-11-11T03:00:00Z" },
      ],
    );
    expect(rows.map((row) => row.shipmentId)).toEqual(["s1", "s2", "s3"]);
    expect(rows.map((row) => shipmentChoiceLabel(row, TEXT))).toEqual([
      "SO-1-S1 · hoá đơn nháp",
      `Lô giao ngày ${formatDate("2026-11-11T03:00:00Z")} · chưa có hoá đơn`,
      `Lô giao ngày ${formatDate("2026-11-12T03:00:00Z")} · chưa có hoá đơn`,
    ]);
  });

  it("an invoice that carries no shipment code is named by the delivery date, never by its id", () => {
    const [row] = shipmentChoices(
      [item({ id: "a", shipmentId: "s9", shipmentCode: null })],
      [{ shipmentId: "s9", deliveredAt: "2026-11-10T03:00:00Z" }],
    );
    expect(row && shipmentChoiceLabel(row, TEXT)).toBe(
      `Lô giao ngày ${formatDate("2026-11-10T03:00:00Z")} · hoá đơn nháp`,
    );
  });
});
