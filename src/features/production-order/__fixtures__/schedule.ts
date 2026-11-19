/** Fixture theo hợp đồng BE `ProductionSchedule` (`ProductionScheduleController`, docs 17 §4.12). */

import { PRODUCER_ID } from "./production-order";

import type {
  ProductionSchedule,
  ScheduledProductionOrder,
  ShortDeliveryBatch,
} from "../schedule-schemas";

export function scheduledOrder(
  overrides: Partial<ScheduledProductionOrder> = {},
): ScheduledProductionOrder {
  return {
    id: "po-1",
    code: "PRD-20261120-0001",
    status: "ACCEPTED",
    producerId: PRODUCER_ID,
    producerCode: "IN-MINHPHAT",
    producerName: "In Minh Phát",
    salesOrderId: "so-1",
    orderNumber: "SO-2026-0042",
    deliveryBatchId: "batch-1",
    deliveryBatchSeq: 1,
    windowStart: "2026-12-10",
    windowEnd: "2026-12-15",
    receivingWarehouseId: "wh-1",
    receivingWarehouseCode: "HCM",
    needByDate: "2026-12-10",
    expectedCompletionDate: "2026-12-12",
    cartons: 14,
    receivedCartons: 0,
    alerts: [{ alertId: "al-1", type: "AT_RISK", openedAt: "2026-11-19T01:00:00Z" }],
    ...overrides,
  };
}

export function shortBatch(overrides: Partial<ShortDeliveryBatch> = {}): ShortDeliveryBatch {
  return {
    salesOrderId: "so-2",
    orderNumber: "SO-2026-0050",
    shippingWarehouseId: "wh-1",
    shippingWarehouseCode: "HCM",
    deliveryBatchId: "batch-9",
    seq: 2,
    windowStart: "2026-12-01",
    windowEnd: "2026-12-05",
    shortCartons: 6,
    lines: [{ orderLineId: "ol-9", sku: "CUS-BAG-009", cartons: 6 }],
    alerts: [{ alertId: "al-2", type: "PO_NEEDED", openedAt: "2026-11-18T01:00:00Z" }],
    ...overrides,
  };
}

export function schedule(overrides: Partial<ProductionSchedule> = {}): ProductionSchedule {
  return {
    productionOrders: [scheduledOrder()],
    shortBatches: [shortBatch()],
    truncated: false,
    ...overrides,
  };
}
