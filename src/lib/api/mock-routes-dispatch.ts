/**
 * Mock routes — chuyến xe, lô giao, hãng vận chuyển (module 09), theo hợp đồng BE PR #137
 * (`DispatchController`, `ShipmentController`, `CarrierController`; xem features/shipping/api.ts).
 * Chỉ dùng khi USE_MOCK=true. Trả đúng errorCode BE để FE map lỗi tiếng Việt. Quyền lấy từ phiên mock
 * như BE `@RequiresPermission` (BE PR #148): fulfillment-dispatch:CREATE / UPDATE cho mở chuyến / lên xe,
 * fulfillment-load-cancellations:UPDATE cho huỷ chuyến, fulfillment-delivery-outcomes:UPDATE (+ APPROVE
 * cho ĐÃ GIAO / GIAO THẤT BẠI) cho kết quả giao.
 */

import {
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS as OUTCOME,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS,
} from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { handover, recordOutcome } from "./mock-dispatch-handover";
import {
  addShipments,
  cancelLoad,
  openLoad,
  removeShipment,
  scan,
  unscan,
} from "./mock-dispatch-rules";
import { getDispatchState } from "./mock-dispatch-store";
import {
  carrierView,
  loadDetailView,
  loadRowView,
  manifestView,
  shipmentDetailView,
  shipmentRowView,
} from "./mock-dispatch-view";
import { currentActor, routeParam } from "./mock-routes-fulfillment-store";
import { fail, ok } from "./mock-route-utils";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_MAX_PAGE_SIZE,
  bePage,
  parseJsonBody,
  readInt,
  readParams,
  readString,
} from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { DispatchState, MockLoad, MockShipment } from "./mock-dispatch-store";
import type { MockResponseShape } from "./mock-route-utils";

const LOADS = "/fulfillment/loads";
const SHIPMENTS = "/fulfillment/shipments";
// BE PR #148: mỗi endpoint một mã quyền (không còn `@PreAuthorize` theo vai trò)
const DISPATCH_CREATE = FULFILLMENT_DISPATCH_PERMISSIONS.create;
const DISPATCH_UPDATE = FULFILLMENT_DISPATCH_PERMISSIONS.update;

const forbidden = () => fail(403, "FORBIDDEN", "Access denied");
const loadNotFound = (id: string) => fail(404, "LOAD_NOT_FOUND", `Load ${id} not found`);
const shipmentNotFound = () => fail(404, "SHIPMENT_NOT_FOUND", "Shipment not found");
const pageOf = <T>(items: readonly T[], config: AxiosRequestConfig) => {
  const params = readParams(config);
  const size = Math.min(BE_MAX_PAGE_SIZE, readInt(params.size, BE_DEFAULT_PAGE_SIZE));
  return ok(bePage(items, readInt(params.page, 0), size));
};

/** Chạy `apply` với chuyến tìm theo id (404 LOAD_NOT_FOUND) khi người gọi có mã quyền (null = không đòi). */
async function withLoad(
  config: AxiosRequestConfig,
  permission: PermissionCode | null,
  apply: (state: DispatchState, load: MockLoad) => MockResponseShape,
): Promise<MockResponseShape> {
  if (permission && !(await currentActor()).can(permission)) return forbidden();
  const state = await getDispatchState();
  const load = state.loads.get(routeParam(config, "id"));
  return load ? apply(state, load) : loadNotFound(routeParam(config, "id"));
}

async function withShipment(
  config: AxiosRequestConfig,
  apply: (state: DispatchState, shipment: MockShipment) => MockResponseShape,
): Promise<MockResponseShape> {
  const state = await getDispatchState();
  const shipment = state.shipments.get(routeParam(config, "id"));
  return shipment ? apply(state, shipment) : shipmentNotFound();
}

function registerCarrierAndShipmentRoutes(): void {
  registerMockRoute("GET", "/fulfillment/carriers", async (config) => {
    const params = readParams(config);
    const status = readString(params.status);
    const search = readString(params.search).toUpperCase();
    const state = await getDispatchState();
    return pageOf(
      state.carriers
        .filter((c) => !status || c.status === status)
        .filter((c) => !search || `${c.code} ${c.name}`.toUpperCase().includes(search))
        .map(carrierView),
      config,
    );
  });

  registerMockRoute("GET", SHIPMENTS, async (config) => {
    const params = readParams(config);
    const [warehouse, status, carrier, order, search] = [
      "warehouseId",
      "status",
      "carrierId",
      "orderId",
      "search",
    ].map((key) => readString(params[key]));
    const state = await getDispatchState();
    const rows = [...state.shipments.values()]
      .filter((s) => !warehouse || s.warehouseId === warehouse)
      .filter((s) => !status || s.status === status)
      .filter((s) => !carrier || s.carrierId === carrier)
      .filter((s) => !order || s.orderId === order)
      .filter((s) => !search || s.code.toUpperCase().includes((search ?? "").toUpperCase()))
      .sort((a, b) => Date.parse(b.readyAt) - Date.parse(a.readyAt) || a.code.localeCompare(b.code))
      .map((s) => shipmentRowView(state, s));
    return pageOf(rows, config);
  });

  registerMockRoute("GET", `${SHIPMENTS}/:id`, (config) =>
    withShipment(config, (state, shipment) => ok(shipmentDetailView(state, shipment))),
  );

  registerMockRoute("PUT", `${SHIPMENTS}/:id/carrier`, async (config) => {
    if (!(await currentActor()).can(DISPATCH_UPDATE)) return forbidden();
    return withShipment(config, (state, shipment) => {
      const body = parseJsonBody(config.data);
      const carrierId = typeof body.carrierId === "string" ? body.carrierId : null;
      if (carrierId) {
        const carrier = state.carriers.find((c) => c.carrierId === carrierId);
        if (!carrier) return fail(404, "CARRIER_NOT_FOUND", "Carrier not found");
        if (carrier.status !== "ACTIVE")
          return fail(409, "CARRIER_INACTIVE", `Carrier ${carrier.code} is not in use`);
      }
      if (shipment.carrierId === carrierId) return ok(shipmentDetailView(state, shipment));
      if (shipment.status !== "READY_TO_DISPATCH") {
        return fail(
          409,
          "SHIPMENT_STATE_CONFLICT",
          `Shipment ${shipment.code} is ${shipment.status}; its carrier is chosen before the handover`,
        );
      }
      if (shipment.loadId) {
        return fail(
          409,
          "SHIPMENT_ON_ANOTHER_LOAD",
          `Shipment ${shipment.code} is on load ${shipment.loadId}; take it off first`,
        );
      }
      shipment.carrierId = carrierId;
      shipment.version += 1;
      return ok(shipmentDetailView(state, shipment));
    });
  });

  registerMockRoute("POST", `${SHIPMENTS}/:id/delivery-outcome`, async (config) => {
    const body = parseJsonBody(config.data);
    const actor = await currentActor();
    // 09 BR-02: endpoint cần delivery-outcomes:UPDATE; ĐÃ GIAO / THẤT BẠI cần thêm :APPROVE
    if (!actor.can(OUTCOME.update)) return forbidden();
    if (body.outcome !== "RETURNED" && !actor.can(OUTCOME.approve)) return forbidden();
    return withShipment(config, (state, shipment) => recordOutcome(state, shipment, body));
  });
}

export function registerDispatchMockRoutes(): void {
  registerCarrierAndShipmentRoutes();

  registerMockRoute("GET", LOADS, async (config) => {
    const params = readParams(config);
    const [warehouse, status, carrier, search] = [
      "warehouseId",
      "status",
      "carrierId",
      "search",
    ].map((key) => readString(params[key]));
    const state = await getDispatchState();
    const rows = [...state.loads.values()]
      .filter((l) => !warehouse || l.warehouseId === warehouse)
      .filter((l) => !status || l.status === status)
      .filter((l) => !carrier || l.carrierId === carrier)
      .filter(
        (l) =>
          !search ||
          l.code.toUpperCase().includes(search.toUpperCase()) ||
          (l.vehiclePlate ?? "").toUpperCase().includes(search.toUpperCase()),
      )
      .sort((a, b) => b.code.localeCompare(a.code))
      .map((l) => loadRowView(state, l));
    return pageOf(rows, config);
  });

  registerMockRoute("GET", `${LOADS}/:id`, (config) =>
    withLoad(config, null, (state, load) => ok(loadDetailView(state, load))),
  );
  registerMockRoute("GET", `${LOADS}/:id/manifest`, (config) =>
    withLoad(config, null, (state, load) => ok(manifestView(state, load))),
  );

  registerMockRoute("POST", LOADS, async (config) => {
    if (!(await currentActor()).can(DISPATCH_CREATE)) return forbidden();
    return openLoad(await getDispatchState(), parseJsonBody(config.data));
  });
  registerMockRoute("POST", `${LOADS}/:id/shipments`, (config) =>
    withLoad(config, DISPATCH_UPDATE, (state, load) => {
      const ids = parseJsonBody(config.data).shipmentIds;
      return addShipments(
        state,
        load,
        Array.isArray(ids) ? ids.filter((v): v is string => typeof v === "string") : [],
      );
    }),
  );
  registerMockRoute("DELETE", `${LOADS}/:id/shipments/:sid`, (config) =>
    withLoad(config, DISPATCH_UPDATE, (state, load) =>
      removeShipment(state, load, routeParam(config, "sid")),
    ),
  );
  registerMockRoute("POST", `${LOADS}/:id/scans`, (config) =>
    withLoad(config, DISPATCH_UPDATE, (state, load) =>
      scan(state, load, parseJsonBody(config.data)),
    ),
  );
  registerMockRoute("DELETE", `${LOADS}/:id/scans/:pid`, (config) =>
    withLoad(config, DISPATCH_UPDATE, (state, load) =>
      unscan(state, load, routeParam(config, "pid")),
    ),
  );
  registerMockRoute("POST", `${LOADS}/:id/handover`, (config) =>
    withLoad(config, DISPATCH_UPDATE, (state, load) =>
      handover(state, load, parseJsonBody(config.data)),
    ),
  );
  registerMockRoute("POST", `${LOADS}/:id/cancellation`, (config) =>
    withLoad(config, FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS.update, (state, load) =>
      cancelLoad(state, load, readString(parseJsonBody(config.data).reason)),
    ),
  );
}
