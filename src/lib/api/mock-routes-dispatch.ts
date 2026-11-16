/**
 * Mock routes — chuyến xe, lô giao, hãng vận chuyển, mã vận đơn (module 09), theo hợp đồng BE (`DispatchController`,
 * `LoadWaybillController`, `WaybillImportController`, `ShipmentController`, `CarrierController`; xem features/shipping/api.ts).
 * Chỉ dùng khi USE_MOCK=true. Trả đúng errorCode BE để FE map lỗi tiếng Việt. Quyền lấy từ phiên mock như BE
 * `@RequiresPermission`: fulfillment-dispatch:UPDATE cho đặt xe / mã vận đơn / quét / bàn giao,
 * fulfillment-controlled-cancellations:UPDATE cho huỷ có kiểm soát, fulfillment-waybill-corrections:UPDATE cho sửa mã sau khi
 * rời kho, fulfillment-waybill-imports:READ / CREATE cho file nhập, fulfillment-carriers:UPDATE cho danh mục hãng,
 * fulfillment-delivery-outcomes:UPDATE (+ APPROVE cho ĐÃ GIAO / GIAO THẤT BẠI) cho kết quả giao.
 */

import {
  FULFILLMENT_CARRIER_PERMISSIONS,
  FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS as OUTCOME,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  FULFILLMENT_WAYBILL_CORRECTION_PERMISSIONS,
  FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS,
} from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { createCarrier, updateCarrier } from "./mock-dispatch-carriers";
import { book, cancelBooking, startLoading } from "./mock-dispatch-booking";
import { cancelControlled, dropFromPlan, overrideUnload, unload } from "./mock-dispatch-ftl-rules";
import { handover, recordOutcome } from "./mock-dispatch-handover";
import { scan, unscan } from "./mock-dispatch-rules";
import { getDispatchState } from "./mock-dispatch-store";
import {
  IMPORT_TEMPLATE,
  applyImport,
  checkImport,
  previewResponse,
  recordWaybill,
  waybillHistory,
} from "./mock-dispatch-waybill";
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
const CARRIERS = "/fulfillment/carriers";
const WAYBILL_IMPORTS = "/fulfillment/waybill-imports";
// Mỗi endpoint một mã quyền (BE `@RequiresPermission`, không còn `@PreAuthorize` theo vai trò)
const DISPATCH_UPDATE = FULFILLMENT_DISPATCH_PERMISSIONS.update;
const IMPORT_READ = FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS.read;
const IMPORT_CREATE = FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS.create;

const forbidden = () => fail(403, "FORBIDDEN", "Access denied");
const loadNotFound = (id: string) => fail(404, "LOAD_NOT_FOUND", `Load ${id} not found`);
const shipmentNotFound = () => fail(404, "SHIPMENT_NOT_FOUND", "Shipment not found");
const carrierNotFound = () => fail(404, "CARRIER_NOT_FOUND", "Carrier not found");
const pageOf = <T>(items: readonly T[], config: AxiosRequestConfig) => {
  const params = readParams(config);
  const size = Math.min(BE_MAX_PAGE_SIZE, readInt(params.size, BE_DEFAULT_PAGE_SIZE));
  return ok(bePage(items, readInt(params.page, 0), size));
};

/** Chạy `apply` với chuyến tìm theo id (404 LOAD_NOT_FOUND) khi người gọi có mã quyền (null = không đòi). */
async function withLoad(
  config: AxiosRequestConfig,
  permission: PermissionCode | null,
  apply: (state: DispatchState, load: MockLoad) => MockResponseShape | Promise<MockResponseShape>,
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

/** File `file` của body multipart (`FormData`); vắng → null. */
function uploadOf(config: AxiosRequestConfig): File | null {
  const file = config.data instanceof FormData ? config.data.get("file") : null;
  return file instanceof File ? file : null;
}

/** Số dòng ghi đè đã xác nhận: `overwriteLines=1,3` (BE `Set<Integer>`). */
function overwriteLinesOf(config: AxiosRequestConfig): Set<number> {
  const raw = readString(readParams(config).overwriteLines);
  return new Set(
    raw
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value)),
  );
}

function registerCarrierRoutes(): void {
  registerMockRoute("GET", CARRIERS, async (config) => {
    const params = readParams(config);
    const status = readString(params.status);
    const search = readString(params.search).toUpperCase();
    const state = await getDispatchState();
    return pageOf(
      state.carriers
        .filter((c) => !status || c.status === status)
        .filter((c) => !search || `${c.code} ${c.name}`.toUpperCase().includes(search))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(carrierView),
      config,
    );
  });
  registerMockRoute("GET", `${CARRIERS}/:id`, async (config) => {
    const state = await getDispatchState();
    const carrier = state.carriers.find((c) => c.carrierId === routeParam(config, "id"));
    return carrier ? ok(carrierView(carrier)) : carrierNotFound();
  });
  registerMockRoute("POST", CARRIERS, async (config) => {
    if (!(await currentActor()).can(FULFILLMENT_CARRIER_PERMISSIONS.update)) return forbidden();
    return createCarrier(await getDispatchState(), parseJsonBody(config.data));
  });
  registerMockRoute("PUT", `${CARRIERS}/:id`, async (config) => {
    if (!(await currentActor()).can(FULFILLMENT_CARRIER_PERMISSIONS.update)) return forbidden();
    const state = await getDispatchState();
    const carrier = state.carriers.find((c) => c.carrierId === routeParam(config, "id"));
    return carrier ? updateCarrier(state, carrier, parseJsonBody(config.data)) : carrierNotFound();
  });
}

function registerShipmentRoutes(): void {
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

  registerMockRoute("POST", `${SHIPMENTS}/:id/delivery-outcome`, async (config) => {
    const body = parseJsonBody(config.data);
    const actor = await currentActor();
    // 09 BR-02: endpoint cần delivery-outcomes:UPDATE; ĐÃ GIAO / THẤT BẠI cần thêm :APPROVE
    if (!actor.can(OUTCOME.update)) return forbidden();
    if (body.outcome !== "RETURNED" && !actor.can(OUTCOME.approve)) return forbidden();
    return withShipment(config, (state, shipment) => recordOutcome(state, shipment, body));
  });
}

function registerWaybillRoutes(): void {
  registerMockRoute("PUT", `${LOADS}/:id/waybill`, (config) =>
    withLoad(config, DISPATCH_UPDATE, async (state, load) =>
      recordWaybill(
        state,
        load,
        parseJsonBody(config.data),
        (await currentActor()).can(FULFILLMENT_WAYBILL_CORRECTION_PERMISSIONS.update),
      ),
    ),
  );
  registerMockRoute("GET", `${LOADS}/:id/waybill-history`, (config) =>
    withLoad(config, null, (_state, load) => waybillHistory(load)),
  );
  registerMockRoute("GET", `${WAYBILL_IMPORTS}/template`, async () => {
    if (!(await currentActor()).can(IMPORT_READ)) return forbidden();
    return {
      status: 200,
      data: new Blob([IMPORT_TEMPLATE], { type: "text/csv;charset=UTF-8" }),
      headers: {},
    };
  });
  registerMockRoute("POST", `${WAYBILL_IMPORTS}/preview`, async (config) => {
    if (!(await currentActor()).can(IMPORT_CREATE)) return forbidden();
    const file = uploadOf(config);
    const checked = await checkImport(await getDispatchState(), file);
    return "lines" in checked ? previewResponse(checked.lines, file?.name ?? "") : checked;
  });
  registerMockRoute("POST", WAYBILL_IMPORTS, async (config) => {
    if (!(await currentActor()).can(IMPORT_CREATE)) return forbidden();
    const file = uploadOf(config);
    const state = await getDispatchState();
    const checked = await checkImport(state, file);
    return "lines" in checked
      ? applyImport(state, checked.lines, file?.name ?? "", overwriteLinesOf(config))
      : checked;
  });
}

export function registerDispatchMockRoutes(): void {
  registerCarrierRoutes();
  registerShipmentRoutes();
  registerWaybillRoutes();

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
          (l.vehiclePlate ?? "").toUpperCase().includes(search.toUpperCase()) ||
          // Tìm cả theo mã kế hoạch xếp xe
          l.ftl.loadPlanCode.toUpperCase().includes(search.toUpperCase()),
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
  registerMockRoute("POST", `${LOADS}/:id/booking`, (config) =>
    withLoad(config, DISPATCH_UPDATE, (state, load) =>
      book(state, load, parseJsonBody(config.data)),
    ),
  );
  registerMockRoute("POST", `${LOADS}/:id/booking-cancellation`, (config) =>
    withLoad(config, DISPATCH_UPDATE, (state, load) =>
      cancelBooking(state, load, readString(parseJsonBody(config.data).reason)),
    ),
  );
  registerMockRoute("POST", `${LOADS}/:id/loading-start`, (config) =>
    withLoad(config, DISPATCH_UPDATE, (state, load) => startLoading(state, load)),
  );
  registerMockRoute("POST", `${LOADS}/:id/unloads`, (config) =>
    withLoad(config, DISPATCH_UPDATE, (state, load) =>
      unload(state, load, parseJsonBody(config.data)),
    ),
  );
  // SCRUM-474 UNLOAD-DESIGN: huỷ có kiểm soát một xe + xác nhận dỡ không quét — quyền riêng của quản lý kho
  registerMockRoute("POST", `${LOADS}/:id/controlled-cancellation`, (config) =>
    withLoad(config, FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS.update, (state, load) =>
      cancelControlled(state, load, parseJsonBody(config.data)),
    ),
  );
  // SCRUM-474 UNLOAD-DROP: bỏ xe chưa xếp khỏi kế hoạch khi mọi xe còn lại đã đi — cùng mã quyền
  registerMockRoute("POST", `${LOADS}/:id/plan-removal`, (config) =>
    withLoad(config, FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS.update, (state, load) =>
      dropFromPlan(state, load, parseJsonBody(config.data)),
    ),
  );
  registerMockRoute("POST", `${LOADS}/:id/unload-overrides`, (config) =>
    withLoad(config, FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS.update, (state, load) =>
      overrideUnload(state, load, parseJsonBody(config.data)),
    ),
  );
}
