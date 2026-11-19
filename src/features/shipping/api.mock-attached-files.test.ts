/**
 * Contract mock file đính kèm (BE `LoadWaybillController`, `ShipmentPodController`, `LoadWaybillFiles`, `ShipmentPodFiles`;
 * docs 09 §4.4, §4.3 bước 2, BR-28): chạy handler mock thật qua `resolveMockRoute`, parse bằng schema FE. Ba bước:
 * slot → PUT lên kho → gắn bằng uploadId.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
  FULFILLMENT_DISPATCH_PERMISSIONS,
} from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { resetDispatchMockStore } from "@/lib/api/mock-dispatch-store";
import { registerDispatchMockRoutes } from "@/lib/api/mock-routes-dispatch";
import { resetAttachedFilesMockStore } from "@/lib/api/mock-routes-dispatch-files";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";

import {
  beAttachedFileListSchema,
  beAttachedFileSchema,
  beDownloadLinkSchema,
} from "./attached-files-schemas";
import { beShipmentPageSchema } from "./schemas";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";

registerDispatchMockRoutes();

async function call(method: string, url: string, data?: unknown, params?: unknown) {
  const route = resolveMockRoute(method, url);
  if (!route) throw new Error(`Không có route mock ${method} ${url}`);
  const config = {
    url,
    data: data === undefined || data instanceof Blob ? data : JSON.stringify(data),
    params,
    _mockParams: route.params,
  };
  return route.handler(config as AxiosRequestConfig);
}

function actAs(grants: readonly PermissionCode[]) {
  MOCK_USER_GRANTS["u-test"] = grants;
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    status: "authenticated",
  });
}

const DISPATCH = FULFILLMENT_DISPATCH_PERMISSIONS.update;
const OUTCOME = FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS.update;
const LOADS = "/fulfillment/loads";
const SHIPMENTS = "/fulfillment/shipments";
// Seed `mock-dispatch-ftl-store.ts`
const BOOKED = "LD-2026-F002";
const CANCELLED = "LD-2026-F004";
const SHA = "a".repeat(64);
const MIME_PDF = "application/pdf";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface ErrorBody {
  errorCode?: string;
}
const errorCode = (res: { data: unknown }) => (res.data as ErrorBody).errorCode;

async function shipmentWithStatus(status: string): Promise<string> {
  const page = beShipmentPageSchema.parse(
    (await call("GET", SHIPMENTS, undefined, { size: "200" })).data,
  );
  const found = page.items.find((s) => s.status === status);
  if (!found) throw new Error(`Seed không có lô giao ${status}`);
  return found.shipmentId;
}

/** Seed không có lô đã giao: ghi nhận ĐÃ GIAO cho một lô đã bàn giao (quản lý kho có đủ UPDATE + APPROVE). */
async function deliveredShipment(): Promise<string> {
  const id = await shipmentWithStatus("HANDED_OVER");
  const granted = MOCK_USER_GRANTS["u-test"] ?? [];
  actAs([...granted, FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS.approve]);
  const res = await call("POST", `${SHIPMENTS}/${id}/delivery-outcome`, { outcome: "DELIVERED" });
  expect(res.status).toBe(200);
  actAs(granted);
  return id;
}

/** Ba bước tải lên của BE: slot → PUT lên kho mock → gắn. Trả phản hồi bước gắn. */
async function attach(
  base: string,
  declared: { fileName?: string; contentType?: string; sizeBytes?: number } = {},
  bytes = new Blob(["abc"]),
) {
  const slot = await call("POST", `${base}/uploads`, {
    fileName: declared.fileName ?? "van-don.pdf",
    contentType: declared.contentType ?? MIME_PDF,
    sizeBytes: declared.sizeBytes ?? 3,
    sha256: SHA,
  });
  if (slot.status !== 201) return slot;
  const { uploadId, url } = slot.data as { uploadId: string; url: string };
  await call("PUT", url, bytes);
  return call("POST", base, { uploadId });
}

beforeEach(() => {
  resetDispatchMockStore();
  resetAttachedFilesMockStore();
  actAs([DISPATCH, OUTCOME]);
});

describe("mock …/waybill-files — file vận đơn của chuyến", () => {
  const BASE = `${LOADS}/${BOOKED}/waybill-files`;

  it("chuyến chưa có file → danh sách rỗng; tải lên rồi liệt kê, tải xuống được link", async () => {
    expect(beAttachedFileListSchema.parse((await call("GET", BASE)).data)).toEqual([]);
    const created = await attach(BASE, { fileName: "van-don-NB.pdf" });
    expect(created.status).toBe(201);
    const file = beAttachedFileSchema.parse(created.data);
    expect(file).toMatchObject({ fileName: "van-don-NB.pdf", contentType: MIME_PDF, sizeBytes: 3 });
    expect(beAttachedFileListSchema.parse((await call("GET", BASE)).data)).toHaveLength(1);
    const link = beDownloadLinkSchema.parse(
      (await call("GET", `${BASE}/${file.fileId}/download-url`)).data,
    );
    expect(link.url.length).toBeGreaterThan(0);
  });

  it("gắn lại cùng uploadId trả đúng file cũ, không nhân đôi (BE: the same uploadId again answers the same file)", async () => {
    const slot = await call("POST", `${BASE}/uploads`, {
      fileName: "a.pdf",
      contentType: MIME_PDF,
      sizeBytes: 3,
      sha256: SHA,
    });
    const { uploadId, url } = slot.data as { uploadId: string; url: string };
    await call("PUT", url, new Blob(["abc"]));
    const first = beAttachedFileSchema.parse((await call("POST", BASE, { uploadId })).data);
    const second = beAttachedFileSchema.parse((await call("POST", BASE, { uploadId })).data);
    expect(second.fileId).toBe(first.fileId);
    expect(beAttachedFileListSchema.parse((await call("GET", BASE)).data)).toHaveLength(1);
  });

  it("nhận Excel (loại tài liệu của BE)", async () => {
    const res = await attach(BASE, { fileName: "bang-ke.xlsx", contentType: MIME_XLSX });
    expect(res.status).toBe(201);
  });

  it("loại lạ → 415; quá 25 MB → 413; khai báo sai → 400; file chưa tới kho → 400", async () => {
    expect(errorCode(await attach(BASE, { contentType: "text/plain" }))).toBe(
      "UNSUPPORTED_MEDIA_TYPE",
    );
    expect(errorCode(await attach(BASE, { sizeBytes: 25 * 1024 * 1024 + 1 }))).toBe(
      "PAYLOAD_TOO_LARGE",
    );
    expect(errorCode(await attach(BASE, { sizeBytes: 0 }))).toBe("VALIDATION_FAILED");
    const slot = await call("POST", `${BASE}/uploads`, {
      fileName: "a.pdf",
      contentType: MIME_PDF,
      sizeBytes: 3,
      sha256: SHA,
    });
    const { uploadId } = slot.data as { uploadId: string };
    expect(errorCode(await call("POST", BASE, { uploadId }))).toBe("VALIDATION_FAILED");
  });

  it("chuyến đã huỷ: không tải thêm (409 INVALID_LOAD_TRANSITION) nhưng danh sách vẫn đọc được", async () => {
    const base = `${LOADS}/${CANCELLED}/waybill-files`;
    expect(errorCode(await attach(base))).toBe("INVALID_LOAD_TRANSITION");
    expect((await call("GET", base)).status).toBe(200);
  });

  it("thiếu fulfillment-dispatch:UPDATE → 403 ở bước slot và bước gắn; đọc danh sách vẫn được", async () => {
    actAs([OUTCOME]);
    expect((await call("POST", `${BASE}/uploads`, { fileName: "a.pdf" })).status).toBe(403);
    expect((await call("POST", BASE, { uploadId: "x" })).status).toBe(403);
    expect((await call("GET", BASE)).status).toBe(200);
  });

  it("chuyến không có → 404 LOAD_NOT_FOUND; file không có → 404", async () => {
    expect(errorCode(await call("GET", `${LOADS}/khong-co/waybill-files`))).toBe("LOAD_NOT_FOUND");
    expect((await call("GET", `${BASE}/khong-co/download-url`)).status).toBe(404);
  });
});

describe("mock …/pod-files — POD của lô giao", () => {
  it("lô đã giao: tải lên PDF, liệt kê, tải xuống", async () => {
    const base = `${SHIPMENTS}/${await deliveredShipment()}/pod-files`;
    const created = await attach(base, { fileName: "bien-ban.pdf" });
    expect(created.status).toBe(201);
    const file = beAttachedFileSchema.parse(created.data);
    expect(beAttachedFileListSchema.parse((await call("GET", base)).data)).toEqual([file]);
    expect((await call("GET", `${base}/${file.fileId}/download-url`)).status).toBe(200);
  });

  it("lô chưa giao (đã bàn giao) → 409 SHIPMENT_STATE_CONFLICT ở bước slot", async () => {
    const base = `${SHIPMENTS}/${await shipmentWithStatus("HANDED_OVER")}/pod-files`;
    expect(errorCode(await attach(base))).toBe("SHIPMENT_STATE_CONFLICT");
    expect(beAttachedFileListSchema.parse((await call("GET", base)).data)).toEqual([]);
  });

  it("POD chỉ nhận PDF hoặc ảnh: Excel qua được slot nhưng bị 400 VALIDATION_FAILED khi gắn", async () => {
    const base = `${SHIPMENTS}/${await deliveredShipment()}/pod-files`;
    expect(errorCode(await attach(base, { fileName: "x.xlsx", contentType: MIME_XLSX }))).toBe(
      "VALIDATION_FAILED",
    );
    expect((await attach(base, { fileName: "x.png", contentType: "image/png" })).status).toBe(201);
  });

  it("thiếu fulfillment-delivery-outcomes:UPDATE → 403; lô không có → 404 SHIPMENT_NOT_FOUND", async () => {
    const base = `${SHIPMENTS}/${await deliveredShipment()}/pod-files`;
    actAs([DISPATCH]);
    expect((await call("POST", `${base}/uploads`, { fileName: "a.pdf" })).status).toBe(403);
    expect(errorCode(await call("GET", `${SHIPMENTS}/khong-co/pod-files`))).toBe(
      "SHIPMENT_NOT_FOUND",
    );
  });

  it("file của lô này không đọc được từ lô khác", async () => {
    const delivered = await deliveredShipment();
    const file = beAttachedFileSchema.parse(
      (await attach(`${SHIPMENTS}/${delivered}/pod-files`)).data,
    );
    const other = await shipmentWithStatus("READY_TO_DISPATCH");
    expect(
      (await call("GET", `${SHIPMENTS}/${other}/pod-files/${file.fileId}/download-url`)).status,
    ).toBe(404);
  });
});
