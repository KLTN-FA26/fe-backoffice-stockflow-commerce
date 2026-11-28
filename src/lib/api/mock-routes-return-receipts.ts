/**
 * Mock routes — phiếu nhập hàng hoàn (BE `ReturnReceiptController`, `/goods-receipts/returns`; docs 03 §4.2, BR-14):
 *   GET    /goods-receipts/returns                 danh sách (status lặp, returnRequestId, orderId)
 *   GET    /goods-receipts/returns/{id}            phiếu + thùng đã quét + thùng của nguồn
 *   POST   /goods-receipts/returns                 lập phiếu DRAFT từ RMA AWAITING_RETURN (mock chưa có chuyến RTO)
 *   POST   /goods-receipts/returns/{id}/cartons    quét LPN (+ tình trạng, + số đếm thực của thùng mở — WF-05 TH-4)
 *   DELETE /goods-receipts/returns/{id}/cartons/{lpn}
 *   POST   /goods-receipts/returns/{id}/loose-lines           hàng lẻ không nhãn (phiếu của RMA, WF-05 TH-4; Q-18: ảnh
 *                                                       bắt buộc `photoId`, tối đa số đã duyệt còn lại)
 *   POST   /goods-receipts/{id}/photos/uploads → PUT /__mock-storage/return-receipts/{uploadId}
 *          → POST /goods-receipts/{id}/photos {uploadId}   ảnh hàng lẻ = ảnh nhận hàng của phiếu (Q-18)
 *   DELETE /goods-receipts/returns/{id}/loose-lines/{lineId}
 *   POST   /goods-receipts/returns/{id}/confirmation   CLOSED; một lần hàng về của RMA — đủ số đã duyệt thì RECEIVED,
 *                                                       về một phần thì vẫn AWAITING_RETURN (WF-05 TH-3)
 *   POST   /goods-receipts/returns/{id}/cancellation   CANCELLED
 * Phải đăng ký TRƯỚC `/goods-receipts/:id` (mock adapter khớp route đăng ký trước).
 */

import { RETURN_LIMITS, RETURN_RECEIPT_APPROVAL_PERMISSIONS } from "@/constants/returns";

import { registerMockRoute } from "./mock-adapter";
import { mockHeldForCustomer } from "./mock-customer-custody";
import {
  approvedOf,
  candidatesOf,
  cartonState,
  progressOf,
  returnOf,
  unitsBack,
} from "./mock-return-receiving";
import {
  mockReceiptOpenable,
  mockReturnReceipts,
  mockReturns,
  nextMockReturnId,
  sourceCartonsOf,
} from "./mock-returns-store";
import {
  bodyOf,
  fail,
  ok,
  pageOf,
  pathParams,
  queryOf,
  text,
  validationFailed,
} from "./mock-route-utils";
import { mockUsableAreaCodes } from "./mock-routes-warehouse-layout";
import { mockCan } from "./mock-warehouse-rules";

import type { MockReturn, MockReturnReceipt } from "./mock-returns-store";

const BASE = "/goods-receipts/returns";
const now = () => new Date().toISOString();
const byId = (id: string) => mockReturnReceipts().find((r) => r.id === id);
const notFound = (id: string) => fail(404, "GOODS_RECEIPT_NOT_FOUND", `No receipt ${id}`);
const notDraft = () => fail(409, "INVALID_RECEIPT_TRANSITION", "The receipt is not a draft");

/** Người đang dùng phiên mock — người quét / đếm / ghi hàng lẻ (BE lấy từ token). */
async function mockUserId(): Promise<string> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  return useAuthStore.getState().user?.userId ?? "mock-current-user";
}

function wire(receipt: MockReturnReceipt) {
  const { source, ...rest } = receipt;
  const scanned = new Set(receipt.cartons.map((c) => c.lpn));
  const ret = returnOf(receipt);
  // BE-22: thùng cần đối chiếu là của SKU được duyệt; Q-11: thùng đã về ở phiếu trước không phải thùng thiếu
  const expected = ret ? source.filter((c) => approvedOf(ret, c.sku) > 0) : source;
  return {
    ...rest,
    // WF-05 Q-4 (audit r2 returns H1): thùng nguyên của yêu cầu không hoàn tiền là hàng giữ hộ khách
    cartons: rest.cartons.map((carton) => ({
      ...carton,
      heldForCustomer: mockHeldForCustomer(receipt, carton.lpn),
    })),
    receiptType: "RETURN",
    expectedCartons: expected.map((c) => ({
      ...c,
      scanned: scanned.has(c.lpn),
      receivedEarlier: !scanned.has(c.lpn) && cartonState(receipt, c.lpn) !== null,
    })),
    // BE `ReturnProgress` / `CandidateCarton`: chỉ phiếu của yêu cầu; ứng viên chỉ khi phiếu nháp
    ...(ret
      ? {
          returnProgress: progressOf(receipt),
          candidateCartons: receipt.status === "DRAFT" ? candidatesOf(receipt) : [],
        }
      : {}),
    // WF-05 Q-18 (BE G4 `ReturnReceipt.needsManagerConfirmation`): chỉ phiếu nháp
    managerConfirmationRequired:
      receipt.status === "DRAFT" &&
      (receipt.looseLines.length > 0 || receipt.cartons.some((c) => c.opened)),
  };
}

function row(receipt: MockReturnReceipt) {
  return {
    id: receipt.id,
    number: receipt.number,
    receiptType: "RETURN",
    status: receipt.status,
    warehouseId: receipt.warehouseId,
    orderId: receipt.orderId,
    shipmentId: receipt.shipmentId,
    returnRequestId: receipt.returnRequestId,
    receivedAt: receipt.receivedAt,
    closedAt: receipt.closedAt,
    cartonCount: receipt.cartons.length,
  };
}

async function create(body: Record<string, unknown>) {
  const returnRequestId = text(body.returnRequestId);
  const shipmentId = text(body.shipmentId);
  if (!!returnRequestId === !!shipmentId)
    return fail(400, "VALIDATION_FAILED", "Exactly one of shipmentId and returnRequestId");
  if (shipmentId) return fail(404, "SHIPMENT_NOT_FOUND", "Mock has no returned shipment");
  const ret = mockReturns().find((r) => r.id === returnRequestId);
  if (!ret) return fail(404, "RETURN_REQUEST_NOT_FOUND", "No return request");
  // WF-05 Q-11 (BE-13): cả kiện về muộn — sau "Đã nhận đủ", hết hạn, rút sau khi duyệt
  if (!mockReceiptOpenable(ret))
    return fail(409, "RETURN_NOT_AWAITING_GOODS", "Not awaiting its goods");
  // WF-05 TH-3: mỗi kiện về một phiếu riêng — chỉ một phiếu NHÁP mỗi lúc (BE `findDraftForReturnRequest`)
  const open = mockReturnReceipts().find(
    (r) => r.returnRequestId === ret.id && r.status === "DRAFT",
  );
  if (open)
    return fail(409, "RETURN_RECEIPT_ALREADY_OPEN", "Already open", [], { receiptId: open.id });
  const code = text(body.quarantineLocationCode);
  const usable = await mockUsableAreaCodes(ret.warehouseId, "QUARANTINE");
  // Kho mock-data cũ chưa có khu QUARANTINE ở bản đồ → nhận mọi mã (ASSUMPTION mock-only)
  if (usable.length && !usable.includes(code))
    return fail(409, "LOCATION_AREA_MISMATCH", `${code} is not a QUARANTINE area`);
  const id = nextMockReturnId("RRC");
  const receipt: MockReturnReceipt = {
    id,
    number: `GR-RET-${id.slice(-4)}`,
    status: "DRAFT",
    warehouseId: ret.warehouseId,
    orderId: ret.orderId,
    orderNumber: ret.orderNumber,
    shipmentId: null,
    shipmentCode: null,
    returnRequestId: ret.id,
    rmaNumber: ret.rmaNumber,
    quarantineLocationCode: code,
    note: text(body.note) || null,
    receivedAt: now(),
    closedAt: null,
    cartons: [],
    looseLines: [],
    source: sourceCartonsOf(ret),
    version: 0,
  };
  mockReturnReceipts().unshift(receipt);
  return ok(wire(receipt), 201);
}

/** BE `requireClaimed`: SKU được duyệt và tổng trên các phiếu không huỷ không vượt số duyệt — thùng không chia. */
function notClaimed(
  receipt: MockReturnReceipt,
  sku: string,
  lpn: string,
  units: number,
  already: number,
) {
  const approved = approvedOf(returnOf(receipt), sku);
  const back = approved === 0 ? 0 : unitsBack(receipt, sku) - already;
  if (approved !== 0 && back + units <= approved) return null;
  return fail(409, "RETURN_CARTON_NOT_CLAIMED", `${lpn} does not fit the approval`, [], {
    lpn,
    sku,
    approved,
    alreadyBack: back,
    units,
  });
}

async function scan(receipt: MockReturnReceipt, body: Record<string, unknown>) {
  if (receipt.status !== "DRAFT") return notDraft();
  const lpn = text(body.lpn).toUpperCase();
  if (!lpn) return validationFailed("lpn", "must not be blank");
  // WF-05 TH-4: số đếm 0..nhãn; không gửi = nguyên thùng (lần quét lại giữ số đã đếm)
  const raw = body.countedQuantity;
  const counted = typeof raw === "number" ? raw : null;
  if (raw != null && (counted === null || !Number.isInteger(counted) || counted < 0))
    return validationFailed("countedQuantity", "countedQuantity must be zero or more");
  const condition = text(body.condition) || null;
  const userId = await mockUserId();
  const existing = receipt.cartons.find((c) => c.lpn === lpn);
  if (existing) {
    if (counted !== null && counted > existing.quantity)
      return validationFailed("countedQuantity", "More than the carton's label");
    // Audit r2 L6: đếm lại tăng số cũng bị giữ trong số duyệt
    if (receipt.returnRequestId && counted !== null && counted > existing.countedQuantity) {
      const refused = notClaimed(receipt, existing.sku, lpn, counted, existing.countedQuantity);
      if (refused) return refused;
    }
    existing.condition = condition ?? existing.condition;
    if (counted !== null) {
      existing.countedQuantity = counted;
      existing.countedBy = userId;
    }
    existing.opened = existing.countedQuantity < existing.quantity;
  } else {
    const carton = receipt.source.find((c) => c.lpn.toUpperCase() === lpn);
    if (!carton) return fail(409, "RETURN_CARTON_NOT_OF_SOURCE", `${lpn} is not of this source`);
    if (counted !== null && counted > carton.quantity)
      return validationFailed("countedQuantity", "More than the carton's label");
    // BE `ReturnCartonEligibility.ofCarton`: đã về, từng về mở, hàng giữ hộ khách
    const state = cartonState(receipt, carton.lpn);
    if (state)
      return fail(409, "RETURN_CARTON_IN_WAREHOUSE", `${lpn} cannot come back`, [], {
        lpn,
        reason: state,
      });
    const units = counted ?? carton.quantity;
    if (receipt.returnRequestId) {
      const refused = notClaimed(receipt, carton.sku, lpn, units, 0);
      if (refused) return refused;
    }
    receipt.cartons.push({
      ...carton,
      condition,
      scannedAt: now(),
      countedQuantity: units,
      opened: units < carton.quantity,
      scannedBy: userId,
      countedBy: userId,
    });
  }
  receipt.version += 1;
  return ok(wire(receipt));
}

/** Hàng lẻ không nhãn (BE `ReturnReceipt.recordLoose`): phiếu nháp của RMA, SKU của đơn, cùng SKU + lô thì thay số. */
async function recordLoose(receipt: MockReturnReceipt, body: Record<string, unknown>) {
  if (receipt.status !== "DRAFT" || !receipt.returnRequestId) return notDraft();
  const sku = text(body.sku);
  const lotNumber = text(body.lotNumber) || null;
  const quantity = typeof body.quantity === "number" ? body.quantity : 0;
  if (!sku || sku.length > 64) return validationFailed("sku", "Name the SKU of the loose units");
  if (lotNumber && lotNumber.length > 64) return validationFailed("lotNumber", "At most 64");
  if (!Number.isInteger(quantity) || quantity < 1)
    return validationFailed("quantity", "quantity must be at least 1");
  const ret = returnOf(receipt);
  if (!receipt.source.some((c) => c.sku === sku) && !ret?.lines.some((l) => l.sku === sku))
    return validationFailed("sku", `${sku} is not a SKU of the order`);
  // WF-05 Q-18 (BE-43): ảnh bắt buộc; tổng đã về của SKU không vượt số đã duyệt
  const photoId = text(body.photoId);
  if (!receiptPhotos.has(`${receipt.id}:${photoId}`))
    return fail(400, "RETURN_LOOSE_PHOTO_REQUIRED", "A loose line needs a photo of this receipt");
  const held = receipt.looseLines.find((l) => l.sku === sku && l.lotNumber === lotNumber);
  // BE `recordLoose`: mọi phiếu không huỷ của yêu cầu (thùng theo số đếm + hàng lẻ), bỏ dòng đang ghi lại
  const approved = approvedOf(ret, sku);
  const back = unitsBack(receipt, sku, held?.id);
  if (back + quantity > approved)
    return fail(409, "RETURN_LOOSE_EXCEEDS_APPROVED", "More than approved", [], {
      sku,
      approved,
      alreadyBack: back,
    });
  const recordedBy = await mockUserId();
  if (held) {
    held.quantity = quantity;
    held.photoId = photoId;
    held.recordedBy = recordedBy;
  } else
    receipt.looseLines.push({
      id: nextMockReturnId("RLL"),
      sku,
      lotNumber,
      quantity,
      photoId,
      recordedBy,
    });
  receipt.version += 1;
  return ok(wire(receipt));
}

function removeLoose(receipt: MockReturnReceipt, lineId: string) {
  if (receipt.status !== "DRAFT") return notDraft();
  const before = receipt.looseLines.length;
  receipt.looseLines = receipt.looseLines.filter((l) => l.id !== lineId);
  if (receipt.looseLines.length === before)
    return fail(404, "NOT_FOUND", `No loose line ${lineId}`);
  receipt.version += 1;
  return ok(wire(receipt));
}

/**
 * Một lần hàng về của yêu cầu (BE `ReturnRequest.goodsReceived`): cộng số của phiếu (thùng theo số đếm + hàng lẻ) vào
 * từng dòng, ghi một parcel; đủ số đã duyệt → RECEIVED, chưa đủ → vẫn AWAITING_RETURN; EXPIRED nhận về → RECEIVED.
 */
function takeParcel(ret: MockReturn, receipt: MockReturnReceipt) {
  const units = (sku: string) =>
    receipt.cartons.filter((c) => c.sku === sku).reduce((sum, c) => sum + c.countedQuantity, 0) +
    receipt.looseLines.filter((l) => l.sku === sku).reduce((sum, l) => sum + l.quantity, 0);
  for (const line of ret.lines)
    line.receivedQuantity = (line.receivedQuantity ?? 0) + units(line.sku);
  const parcels = ret.receipt?.parcels ?? [];
  const parcel = {
    parcel: parcels.length + 1,
    goodsReceiptId: receipt.id,
    receiptNumber: receipt.number,
    locationCode: receipt.quarantineLocationCode,
    receivedBy: "mock-current-user",
    receivedAt: now(),
  };
  ret.receipt = {
    receivedBy: parcel.receivedBy,
    receivedAt: parcel.receivedAt,
    locationCode: parcel.locationCode,
    goodsReceiptId: ret.receipt?.goodsReceiptId ?? receipt.id,
    parcels: [...parcels, parcel],
  };
  const complete = ret.lines.every((l) => (l.receivedQuantity ?? 0) >= (l.approvedQuantity ?? 0));
  // Kiện muộn trên yêu cầu đã RECEIVED / chờ duyệt hoàn: chỉ cộng số đã về, không đổi trạng thái
  const reopens = ret.status === "EXPIRED" || ret.status === "CANCELLED";
  if (reopens || (ret.status === "AWAITING_RETURN" && complete)) {
    ret.history.push({
      from: ret.status,
      to: "RECEIVED",
      reason: receipt.number,
      occurredAt: now(),
    });
    ret.status = "RECEIVED";
  }
  ret.version += 1;
}

async function confirm(receipt: MockReturnReceipt) {
  if (receipt.status === "CLOSED") return ok(wire(receipt));
  // BE `ReturnReceipt.confirm`: cần ít nhất một thùng hoặc một dòng hàng lẻ
  if (receipt.status !== "DRAFT" || (!receipt.cartons.length && !receipt.looseLines.length))
    return notDraft();
  // WF-05 Q-18: thùng mở / hàng lẻ — Quản lý kho xác nhận, và không phải người đã đếm
  if (receipt.looseLines.length > 0 || receipt.cartons.some((c) => c.opened)) {
    if (!(await mockCan(RETURN_RECEIPT_APPROVAL_PERMISSIONS.approve)))
      return fail(
        403,
        "RETURN_RECEIPT_MANAGER_CONFIRMATION_REQUIRED",
        "A warehouse manager confirms it",
      );
    const userId = await mockUserId();
    const counted =
      receipt.cartons.some((c) => c.scannedBy === userId || c.countedBy === userId) ||
      receipt.looseLines.some((l) => l.recordedBy === userId);
    if (counted)
      return fail(
        409,
        "RETURN_RECEIPT_SELF_CONFIRMATION",
        "Confirmed by someone who counted nothing",
      );
  }
  receipt.status = "CLOSED";
  const closedAt = now();
  receipt.closedAt = closedAt;
  receipt.version += 1;
  // WF-05 Q-18: thùng mở không nhập tồn
  for (const carton of receipt.cartons) carton.stockEntered = !carton.opened;
  const ret = mockReturns().find((r) => r.id === receipt.returnRequestId);
  if (ret && mockReceiptOpenable(ret)) takeParcel(ret, receipt);
  return ok(wire(receipt));
}

/* ── Ảnh hàng lẻ tải thẳng lên kho (WF-05 Q-18; BE ảnh nhận hàng của phiếu nhập) ──────────────── */

const loosePhotos = new Map<string, { receiptId: string; received: boolean }>();

function beginLoosePhoto(receipt: MockReturnReceipt, body: Record<string, unknown>) {
  if (receipt.status !== "DRAFT") return notDraft();
  const contentType = text(body.contentType);
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
  if (!text(body.fileName)) return validationFailed("fileName", "fileName is required");
  if (!(sizeBytes > 0)) return validationFailed("sizeBytes", "sizeBytes must be positive");
  if (!/^[0-9a-f]{64}$/.test(text(body.sha256)))
    return validationFailed("sha256", "must be a lower-case hex SHA-256");
  if (!(RETURN_LIMITS.loosePhotoTypes as readonly string[]).includes(contentType))
    return fail(415, "UNSUPPORTED_MEDIA_TYPE", "This file type is not accepted");
  if (sizeBytes > RETURN_LIMITS.loosePhotoMaxBytes)
    return fail(413, "PAYLOAD_TOO_LARGE", "The uploaded file is too large");
  const uploadId = crypto.randomUUID();
  loosePhotos.set(uploadId, { receiptId: receipt.id, received: false });
  return ok(
    {
      uploadId,
      method: "PUT",
      url: `/__mock-storage/return-receipts/${uploadId}`,
      headers: { "Content-Type": contentType },
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    },
    201,
  );
}

/** Ảnh nhận hàng đã giữ của phiếu (`${receiptId}:${photoId}`) — `photoId` của dòng hàng lẻ phải là một trong số này. */
const receiptPhotos = new Set<string>();

/** BE `POST /goods-receipts/{id}/photos` `{uploadId}`: ảnh đã PUT thành ảnh của phiếu; cùng `uploadId` = cùng ảnh. */
function attachLoosePhoto(receipt: MockReturnReceipt, body: Record<string, unknown>) {
  const uploadId = text(body.uploadId);
  const photo = loosePhotos.get(uploadId);
  if (!photo || photo.receiptId !== receipt.id || !photo.received)
    return validationFailed("uploadId", "No uploaded file with this id");
  receiptPhotos.add(`${receipt.id}:${uploadId}`);
  return ok({ id: uploadId, receiptId: receipt.id, stage: "RECEIPT" }, 201);
}

/** Test-only: một ảnh của phiếu đã giữ mà không qua PUT (môi trường test không có `crypto.subtle`); trả `photoId`. */
export function mockLoosePhotoReceived(receiptId: string): string {
  const photoId = crypto.randomUUID();
  loosePhotos.set(photoId, { receiptId, received: true });
  receiptPhotos.add(`${receiptId}:${photoId}`);
  return photoId;
}

export function registerReturnReceiptMockRoutes(): void {
  registerMockRoute("GET", BASE, (config) => {
    const params = queryOf(config);
    const statuses = params.getAll("status");
    const items = mockReturnReceipts()
      .filter((r) => !statuses.length || statuses.includes(r.status))
      .filter(
        (r) =>
          !params.get("returnRequestId") || r.returnRequestId === params.get("returnRequestId"),
      )
      .filter((r) => !params.get("orderId") || r.orderId === params.get("orderId"))
      .map(row);
    return ok(pageOf(items, Number(params.get("page") ?? 0), Number(params.get("size") ?? 15)));
  });
  registerMockRoute("POST", BASE, (config) => create(bodyOf(config)));
  const withReceipt =
    (
      fn: (
        receipt: MockReturnReceipt,
        config: Parameters<typeof bodyOf>[0],
      ) => ReturnType<typeof ok> | Promise<ReturnType<typeof ok>>,
    ) =>
    (config: Parameters<typeof bodyOf>[0]) => {
      const id = pathParams(config).id ?? "";
      const receipt = byId(id);
      return receipt ? fn(receipt, config) : notFound(id);
    };
  registerMockRoute(
    "GET",
    `${BASE}/:id`,
    withReceipt((r) => ok(wire(r))),
  );
  registerMockRoute(
    "POST",
    `${BASE}/:id/cartons`,
    withReceipt((r, c) => scan(r, bodyOf(c))),
  );
  registerMockRoute(
    "DELETE",
    `${BASE}/:id/cartons/:lpn`,
    withReceipt((r, c) => {
      if (r.status !== "DRAFT") return notDraft();
      const lpn = (pathParams(c).lpn ?? "").toUpperCase();
      // BE `ReturnReceipt.remove`: gỡ khỏi nháp trả lại phần số đã duyệt nó chiếm
      r.cartons = r.cartons.filter((carton) => carton.lpn.toUpperCase() !== lpn);
      r.version += 1;
      return ok(wire(r));
    }),
  );
  registerMockRoute(
    "POST",
    `${BASE}/:id/loose-lines`,
    withReceipt((r, c) => recordLoose(r, bodyOf(c))),
  );
  registerMockRoute(
    "POST",
    "/goods-receipts/:id/photos/uploads",
    withReceipt((r, c) => beginLoosePhoto(r, bodyOf(c))),
  );
  registerMockRoute(
    "POST",
    "/goods-receipts/:id/photos",
    withReceipt((r, c) => attachLoosePhoto(r, bodyOf(c))),
  );
  registerMockRoute("PUT", "/__mock-storage/return-receipts/:uploadId", (config) => {
    const photo = loosePhotos.get(pathParams(config).uploadId ?? "");
    if (!photo) return fail(404, "NOT_FOUND", "No such upload");
    photo.received = true;
    return ok(null);
  });
  registerMockRoute(
    "DELETE",
    `${BASE}/:id/loose-lines/:lineId`,
    withReceipt((r, c) => removeLoose(r, pathParams(c).lineId ?? "")),
  );
  registerMockRoute(
    "POST",
    `${BASE}/:id/confirmation`,
    withReceipt((r) => confirm(r)),
  );
  registerMockRoute(
    "POST",
    `${BASE}/:id/cancellation`,
    withReceipt((r) => {
      if (r.status !== "DRAFT") return notDraft();
      r.status = "CANCELLED";
      r.closedAt = now();
      r.version += 1;
      return ok(wire(r));
    }),
  );
}
