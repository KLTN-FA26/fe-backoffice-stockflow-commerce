/** Thẻ thiếu thùng mẫu (BE `ShortageCardResponse` / `ShortagePreviewResponse`, docs 17 §4.14) cho test. */

export const CARD_ID = "7c1d2e3f-0000-4000-8000-000000000a01";

export const waitOption = {
  option: "WAIT_FOR_PRODUCTION",
  expectedDeliveryDate: "2026-12-22",
  afterWindow: true,
};

export const baseCard = {
  cardId: CARD_ID,
  number: "TT-20261128-0001",
  orderId: "0b6f7c1e-4c5d-4f1a-9a77-2f3e6f1d2a10",
  orderNumber: "SO-20260907-000431",
  status: "SENT",
  version: 3,
  batch: { seq: 1, windowFrom: "2026-12-05", windowTo: "2026-12-10", moved: false },
  missingCartons: 2,
  lines: [
    {
      sku: "LY-GIAY-2L-12OZ-CPM",
      skuName: "Ly giấy 2 lớp 12oz",
      batchCartons: 10,
      availableCartons: 8,
      missingCartons: 2,
      unitsPerCarton: 1000,
    },
  ],
  options: [
    waitOption,
    { option: "REDUCE_CARTONS", amountReduced: 2530000 },
    { option: "SHIP_PART_CLOSE_REST", amountReduced: 12650000, laterBatchesClosed: [2, 3] },
    { option: "CANCEL_ORDER", refundUpTo: 30000000, feePossible: true },
  ],
  salesNote: null,
  sentAt: "2026-11-28T03:00:00Z",
  chosen: null,
  executedAt: null,
  executionStarted: false,
  endedReason: null,
};

export const answeredCard = (option: string, patch: Record<string, unknown> = {}) => ({
  ...baseCard,
  status: "ANSWERED",
  chosen: { option, at: "2026-11-28T04:30:00Z", note: "Em chờ được, anh nhé" },
  ...patch,
});

export const staffOf = (card: Record<string, unknown>) => ({
  card,
  sentByName: "Nguyễn Thị Lan",
  chosenByName: null,
  executedByName: null,
  expectedDateSource: "PRODUCTION_ORDER",
});

export const previewOf = (live: Record<string, unknown> | null, history: unknown[] = []) => ({
  orderId: baseCard.orderId,
  orderNumber: baseCard.orderNumber,
  sendable: live === null,
  notSendable: live === null ? null : "LIVE_CARD",
  batch: baseCard.batch,
  lines: baseCard.lines,
  options: baseCard.options,
  expectedDateSource: "STANDARD_LEAD_TIME",
  live: live ? staffOf(live) : null,
  history,
});
