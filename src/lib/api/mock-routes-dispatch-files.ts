/**
 * Mock routes — file vận đơn của chuyến và biên bản giao nhận (POD) của lô giao, theo hợp đồng BE (`LoadWaybillController`,
 * `ShipmentPodController`, `LoadWaybillFiles`, `ShipmentPodFiles`; docs 09 §4.4, §4.3 bước 2, BR-28). Chỉ dùng khi
 * USE_MOCK=true. Cùng ba bước tải thẳng lên kho như BE: POST `…/uploads` (slot) → PUT lên "kho" mock → POST `…` `{uploadId}`.
 *
 * - File vận đơn: tải lên cần `fulfillment-dispatch:UPDATE`; chuyến đã huỷ → 409 INVALID_LOAD_TRANSITION.
 * - POD: tải lên cần `fulfillment-delivery-outcomes:UPDATE`; lô chưa DELIVERED → 409 SHIPMENT_STATE_CONFLICT; chỉ PDF / ảnh
 *   (400 VALIDATION_FAILED khi gắn Word / Excel — BE kiểm sau khi nhận file).
 * - Đọc danh sách và lấy link tải: người xem được chuyến / lô (mock không dựng lại quyền READ).
 */

import {
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS as OUTCOME,
  FULFILLMENT_DISPATCH_PERMISSIONS,
} from "@/constants";
import { SHIPPING_FILE_MAX_BYTES, SHIPPING_FILE_RULES } from "@/constants/shipping-files";

import { registerMockRoute } from "./mock-adapter";
import { getDispatchState } from "./mock-dispatch-store";
import { fail, ok } from "./mock-route-utils";
import { currentActor, routeParam } from "./mock-routes-fulfillment-store";
import { parseJsonBody } from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";
import type { ShippingFileKind } from "@/constants/shipping-files";
import type { MockResponseShape } from "./mock-route-utils";

const LOADS = "/fulfillment/loads";
const SHIPMENTS = "/fulfillment/shipments";

interface MockAttachedFile {
  fileId: string;
  ownerId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  blob: Blob | null;
}

interface MockUpload {
  kind: ShippingFileKind;
  ownerId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  received: Blob | null;
  attachedAs: string | null;
}

const files = new Map<string, MockAttachedFile[]>();
const uploads = new Map<string, MockUpload>();
const key = (kind: ShippingFileKind, ownerId: string) => `${kind}:${ownerId}`;

/** Về trạng thái đầu (test). */
export function resetAttachedFilesMockStore(): void {
  files.clear();
  uploads.clear();
}

const forbidden = () => fail(403, "FORBIDDEN", "Access denied");

const view = (file: MockAttachedFile) => ({
  fileId: file.fileId,
  fileName: file.fileName,
  contentType: file.contentType,
  sizeBytes: file.sizeBytes,
  uploadedBy: file.uploadedBy,
  uploadedAt: file.uploadedAt,
});

/** Chủ của file (chuyến / lô) có tồn tại không — 404 như BE `requireLoad` / `requireShipment`. */
async function ownerError(
  kind: ShippingFileKind,
  ownerId: string,
  forUpload: boolean,
): Promise<MockResponseShape | null> {
  const state = await getDispatchState();
  if (kind === "waybill") {
    const load = state.loads.get(ownerId);
    if (!load) return fail(404, "LOAD_NOT_FOUND", "Load not found");
    if (forUpload && load.status === "CANCELLED") {
      return fail(
        409,
        "INVALID_LOAD_TRANSITION",
        "Load is cancelled: its waybill files are history",
      );
    }
    return null;
  }
  const shipment = state.shipments.get(ownerId);
  if (!shipment) return fail(404, "SHIPMENT_NOT_FOUND", "Shipment not found");
  if (forUpload && shipment.status !== "DELIVERED") {
    return fail(
      409,
      "SHIPMENT_STATE_CONFLICT",
      "A proof of delivery is kept with a delivered shipment",
    );
  }
  return null;
}

const uploadPermission = (kind: ShippingFileKind) =>
  kind === "waybill" ? FULFILLMENT_DISPATCH_PERMISSIONS.update : OUTCOME.update;

function registerKind(kind: ShippingFileKind, base: string): void {
  const ownerOf = (config: AxiosRequestConfig) => routeParam(config, "id");

  registerMockRoute("GET", base, async (config) => {
    const id = ownerOf(config);
    return (await ownerError(kind, id, false)) ?? ok((files.get(key(kind, id)) ?? []).map(view));
  });

  // Bước 1: khai báo file → slot PUT
  registerMockRoute("POST", `${base}/uploads`, async (config) => {
    if (!(await currentActor()).can(uploadPermission(kind))) return forbidden();
    const id = ownerOf(config);
    const refused = await ownerError(kind, id, true);
    if (refused) return refused;
    const body = parseJsonBody(config.data);
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
    // `UploadSlotRequest`: @NotBlank fileName ≤ 255, @NotBlank contentType, @Positive sizeBytes, sha256 hex thường 64
    if (!fileName || fileName.length > 255)
      return fail(400, "VALIDATION_FAILED", "fileName is required", [
        { field: "fileName", message: "required" },
      ]);
    if (!contentType || !(sizeBytes > 0) || !/^[0-9a-f]{64}$/.test(String(body.sha256)))
      return fail(400, "VALIDATION_FAILED", "Invalid declaration");
    // `FileCategory.DOCUMENT`: PDF / Word / Excel / JPEG / PNG ≤ 25 MB (cả POD: lọc PDF / ảnh ở bước gắn)
    if (!(SHIPPING_FILE_RULES.waybill.contentTypes as readonly string[]).includes(contentType))
      return fail(415, "UNSUPPORTED_MEDIA_TYPE", "This file type is not accepted");
    if (sizeBytes > SHIPPING_FILE_MAX_BYTES)
      return fail(413, "PAYLOAD_TOO_LARGE", "The uploaded file is too large");
    const uploadId = crypto.randomUUID();
    uploads.set(uploadId, {
      kind,
      ownerId: id,
      fileName,
      contentType,
      sizeBytes,
      received: null,
      attachedAs: null,
    });
    return ok(
      {
        uploadId,
        method: "PUT",
        url: `/__mock-storage/shipping/${uploadId}`,
        headers: { "Content-Type": contentType },
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      },
      201,
    );
  });

  // Bước 3: gắn file đã tải lên kho; cùng uploadId gửi lại trả cùng file
  registerMockRoute("POST", base, async (config) => {
    const actor = await currentActor();
    if (!actor.can(uploadPermission(kind))) return forbidden();
    const id = ownerOf(config);
    const uploadId = String(parseJsonBody(config.data).uploadId ?? "");
    const upload = uploads.get(uploadId);
    if (upload?.attachedAs && upload.kind === kind && upload.ownerId === id) {
      const same = (files.get(key(kind, id)) ?? []).find((f) => f.fileId === upload.attachedAs);
      if (same) return ok(view(same), 201);
    }
    const refused = await ownerError(kind, id, true);
    if (refused) return refused;
    if (!upload || upload.kind !== kind || upload.ownerId !== id || !upload.received)
      return fail(400, "VALIDATION_FAILED", "The stored file is not the declared one");
    // `ShipmentPodFiles`: POD là PDF hoặc ảnh (loại Word / Excel của danh mục tài liệu bị từ chối)
    if (!(SHIPPING_FILE_RULES[kind].contentTypes as readonly string[]).includes(upload.contentType))
      return fail(400, "VALIDATION_FAILED", "A proof of delivery is a PDF or an image");
    const file: MockAttachedFile = {
      fileId: crypto.randomUUID(),
      ownerId: id,
      fileName: upload.fileName,
      contentType: upload.contentType,
      sizeBytes: upload.sizeBytes,
      uploadedBy: actor.userId,
      uploadedAt: new Date().toISOString(),
      blob: upload.received,
    };
    files.set(key(kind, id), [...(files.get(key(kind, id)) ?? []), file]);
    upload.attachedAs = file.fileId;
    return ok(view(file), 201);
  });

  registerMockRoute("GET", `${base}/:fileId/download-url`, async (config) => {
    const id = ownerOf(config);
    const missing = await ownerError(kind, id, false);
    if (missing) return missing;
    const file = (files.get(key(kind, id)) ?? []).find(
      (f) => f.fileId === routeParam(config, "fileId"),
    );
    if (!file) return fail(404, "NOT_FOUND", "No such file");
    const url =
      file.blob && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(file.blob)
        : `/__mock-storage/shipping/download/${file.fileId}`;
    return ok({ url, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() });
  });
}

/** Mock dùng tên đường dẫn riêng (`/__mock-storage/shipping/`) để không đụng "kho" của tệp bằng chứng dời cửa sổ giao. */
export function registerAttachedFilesMockRoutes(): void {
  registerKind("waybill", `${LOADS}/:id/waybill-files`);
  registerKind("pod", `${SHIPMENTS}/:id/pod-files`);
  // Kho đối tượng: nhận byte đúng khai báo (URL ký sẵn, không xác thực)
  registerMockRoute("PUT", "/__mock-storage/shipping/:uploadId", async (config) => {
    const upload = uploads.get(routeParam(config, "uploadId"));
    if (!upload) return fail(403, "SIGNATURE_MISMATCH", "Request signature does not match");
    const data: unknown = config.data;
    upload.received = data instanceof Blob ? data : new Blob([]);
    return { status: 200, data: null, headers: {} };
  });
}
