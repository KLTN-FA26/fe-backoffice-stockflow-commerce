/**
 * Mock routes — sự kiện hãng vận chuyển (BE `CarrierEventController`, docs 09 §4.5): danh sách, chi tiết, đánh dấu đã xử lý.
 * Chỉ dùng khi USE_MOCK=true. Quyền như BE `@RequiresPermission`: fulfillment-carrier-events:READ xem,
 * fulfillment-carrier-events:UPDATE đánh dấu. Trả đúng errorCode BE (CARRIER_EVENT_NOT_FOUND, CARRIER_EVENT_NOT_RESOLVABLE).
 */

import { CARRIER_EVENT_ERROR_RESULTS, FULFILLMENT_CARRIER_EVENT_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { fail, ok } from "./mock-route-utils";
import { currentActor, routeParam } from "./mock-routes-fulfillment-store";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_MAX_PAGE_SIZE,
  bePage,
  parseJsonBody,
  readInt,
  readParams,
  readString,
} from "./mock-routes-purchase-orders-store";

const PATH = "/fulfillment/carrier-events";
const ERRORS = "ERRORS";

interface MockEvent extends Record<string, unknown> {
  eventId: string;
  carrierId: string;
  loadId?: string;
  result: string;
  receivedAt: string;
  resolvedAt?: string;
}

const base = (n: number, extra: Record<string, unknown>): MockEvent => ({
  eventId: `mock-event-${n}`,
  carrierId: "car-vtp",
  carrierCode: "VTP",
  source: "WEBHOOK",
  receivedAt: `2026-11-18T0${n}:00:00Z`,
  signatureValid: true,
  result: "APPLIED",
  ...extra,
});

let events: MockEvent[] = [
  base(5, { result: "INVALID_SIGNATURE", signatureValid: false }),
  base(4, { result: "UNMATCHED", kind: "DELIVERED", carrierReference: "LD-0000" }),
  base(3, { result: "NEEDS_REVIEW", kind: "DELIVERY_FAILED", loadCode: "LD-20261117-0001" }),
  base(2, { result: "APPLIED", kind: "PICKED_UP", loadCode: "LD-20261117-0001" }),
  base(1, { result: "STALE", kind: "IN_TRANSIT" }),
];

const forbidden = () => fail(403, "FORBIDDEN", "Access denied");
const notFound = () => fail(404, "CARRIER_EVENT_NOT_FOUND", "Carrier event not found");

const detail = (event: MockEvent) =>
  ok({ event, payload: JSON.stringify({ type: event.kind ?? "OTHER" }) });

export function registerCarrierEventMockRoutes(): void {
  registerMockRoute("GET", PATH, async (config) => {
    if (!(await currentActor()).can(FULFILLMENT_CARRIER_EVENT_PERMISSIONS.read)) return forbidden();
    const params = readParams(config);
    const [result, carrier, load] = ["result", "carrierId", "loadId"].map((k) =>
      readString(params[k]),
    );
    const open = readString(params.open);
    const size = Math.min(BE_MAX_PAGE_SIZE, readInt(params.size, BE_DEFAULT_PAGE_SIZE));
    const rows = events
      .filter(
        (e) =>
          !result ||
          (result === ERRORS
            ? CARRIER_EVENT_ERROR_RESULTS.some((r) => r === e.result)
            : e.result === result),
      )
      .filter((e) => !open || (open === "true") === !e.resolvedAt)
      .filter((e) => !carrier || e.carrierId === carrier)
      .filter((e) => !load || e.loadId === load);
    return ok(bePage(rows, readInt(params.page, 0), size));
  });

  registerMockRoute("GET", `${PATH}/:id`, async (config) => {
    if (!(await currentActor()).can(FULFILLMENT_CARRIER_EVENT_PERMISSIONS.read)) return forbidden();
    const event = events.find((e) => e.eventId === routeParam(config, "id"));
    return event ? detail(event) : notFound();
  });

  registerMockRoute("POST", `${PATH}/:id/resolution`, async (config) => {
    const actor = await currentActor();
    if (!actor.can(FULFILLMENT_CARRIER_EVENT_PERMISSIONS.update)) return forbidden();
    const note = readString(parseJsonBody(config.data).note).trim();
    if (!note || note.length > 1000) {
      return fail(400, "VALIDATION_FAILED", "Validation failed", [
        { field: "note", message: "required, at most 1000 characters" },
      ]);
    }
    const event = events.find((e) => e.eventId === routeParam(config, "id"));
    if (!event) return notFound();
    if (!CARRIER_EVENT_ERROR_RESULTS.some((r) => r === event.result) || event.resolvedAt) {
      return fail(409, "CARRIER_EVENT_NOT_RESOLVABLE", "This carrier event cannot be resolved");
    }
    events = events.map((e) =>
      e === event
        ? {
            ...e,
            resolvedAt: new Date().toISOString(),
            resolvedByName: "Quản lý kho",
            resolutionNote: note,
          }
        : e,
    );
    return detail(events.find((e) => e.eventId === event.eventId) ?? event);
  });
}
