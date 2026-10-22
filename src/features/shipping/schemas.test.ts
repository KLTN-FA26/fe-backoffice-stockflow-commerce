/**
 * Schema khớp BE PR #137: Jackson `non_null` bỏ trường null (nullish), enum khoan dung, kiểu nguyên thuỷ
 * bắt buộc — dữ liệu sai hợp đồng phải làm parse thất bại (không hạ chuẩn schema).
 */

import { describe, expect, it } from "vitest";

import { ftlLoad, ftlManifest, ftlRow, kit, pendingUnload } from "./__fixtures__/ftl-load";
import { apiLoad, apiManifest, apiShipment, shipmentRow } from "./__fixtures__/load";
import { beLoadPageSchema, beLoadSchema, beManifestSchema } from "./load-schemas";
import { beCarrierSchema, beShipmentPageSchema, beShipmentSchema } from "./schemas";

const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 15,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});

describe("chuyến xe", () => {
  it("parse chuyến với trường tuỳ chọn vắng (không có driverPhone, dispatchedAt, cancelReason…)", () => {
    const load = beLoadSchema.parse(apiLoad());
    expect(load.driverPhone).toBeUndefined();
    expect(load.dispatchedAt).toBeUndefined();
    expect(load.shipments[0]?.packages[0]).toMatchObject({ loaded: true });
    expect(load.shipments[1]?.packages[0]?.loadedAt).toBeUndefined();
  });

  it("enum lạ (BE thêm sau) → UNKNOWN thay vì làm hỏng cả trang", () => {
    const load = beLoadSchema.parse({ ...apiLoad(), status: "ON_THE_MOON", mode: "DRONE" });
    expect(load).toMatchObject({ status: "UNKNOWN", mode: "UNKNOWN" });
    const row = beLoadPageSchema.parse(
      page([
        {
          loadId: "L",
          code: "L",
          warehouseId: "w",
          mode: "PARCEL",
          status: "LOADING",
          shipmentCount: 0,
          packageCount: 0,
          version: 0,
        },
      ]),
    );
    expect(row.items[0]?.carrierName).toBeUndefined();
  });

  it("thiếu kiểu nguyên thuỷ bắt buộc (version, loaded) hoặc ngày sai định dạng → parse thất bại", () => {
    const { version: _version, ...noVersion } = apiLoad();
    expect(() => beLoadSchema.parse(noVersion)).toThrow();
    const bad = apiLoad();
    expect(() => beLoadSchema.parse({ ...bad, loadingStartedAt: "hôm qua" })).toThrow();
    const noLoaded = JSON.parse(JSON.stringify(apiLoad())) as {
      shipments: { packages: Record<string, unknown>[] }[];
    };
    delete noLoaded.shipments[0]?.packages[0]?.loaded;
    expect(() => beLoadSchema.parse(noLoaded)).toThrow();
  });

  it("biên bản: parse đủ và giữ cờ codChangedSinceLabel", () => {
    const manifest = beManifestSchema.parse(apiManifest());
    expect(manifest.shipments[0]?.codChangedSinceLabel).toBe(false);
    expect(manifest.dispatchedAt).toBeUndefined();
    expect(() => beManifestSchema.parse({ ...apiManifest(), printedAt: undefined })).toThrow();
  });
});

describe("lô giao + hãng", () => {
  it("danh sách lô: trạng thái / cách giao lạ → UNKNOWN; hãng và chuyến vắng là bình thường", () => {
    const parsed = beShipmentPageSchema.parse(
      page([{ ...shipmentRow(), status: "TELEPORTED", deliveryMode: "X" }]),
    );
    expect(parsed.items[0]).toMatchObject({ status: "UNKNOWN", deliveryMode: "UNKNOWN" });
    expect(parsed.items[0]?.carrierId).toBeUndefined();
    expect(parsed.items[0]?.loadId).toBeUndefined();
  });

  it("chi tiết lô kèm kiện và lịch sử; thiếu mảng kiện → thất bại", () => {
    const detail = beShipmentSchema.parse(apiShipment());
    expect(detail.packages).toHaveLength(2);
    expect(detail.timeline[0]?.status).toBe("READY_TO_DISPATCH");
    const { packages: _packages, ...incomplete } = apiShipment();
    expect(() => beShipmentSchema.parse(incomplete)).toThrow();
  });

  it("taskId / currency (BE #137 bổ sung) tuỳ chọn: parse được cả trước và sau khi BE thêm", () => {
    const before = beShipmentSchema.parse(apiShipment());
    expect(before.shipment.taskId).toBeUndefined();
    expect(before.shipment.currency).toBeUndefined();
    const after = beShipmentSchema.parse({
      ...apiShipment({ taskId: "task-1", currency: "VND" }),
      taskId: "task-1",
      currency: "VND",
    });
    expect(after).toMatchObject({ taskId: "task-1", currency: "VND" });
    expect(after.shipment).toMatchObject({ taskId: "task-1", currency: "VND" });
    const load = beLoadSchema.parse(
      apiLoad({ shipments: [{ ...apiLoad().shipments[0]!, taskId: "t", currency: "USD" }] }),
    );
    expect(load.shipments[0]).toMatchObject({ taskId: "t", currency: "USD" });
    expect(beLoadSchema.parse(apiLoad()).shipments[0]?.taskId).toBeUndefined();
  });

  it("hãng: liên hệ tuỳ chọn, trạng thái lạ → UNKNOWN", () => {
    const carrier = beCarrierSchema.parse({
      carrierId: "c",
      code: "GHN",
      name: "GHN",
      status: "RETIRED",
      version: 1,
    });
    expect(carrier.status).toBe("UNKNOWN");
    expect(carrier.contactName).toBeUndefined();
  });
});

describe("chuyến nguyên xe (BE PR #162)", () => {
  it("chuyến FTL: kế hoạch, số xe, đặt xe, kiện cần dỡ, kiện thuộc bộ", () => {
    const load = beLoadSchema.parse(
      ftlLoad({ pendingUnloads: [pendingUnload()], carrierBookingToCancel: true }),
    );
    expect(load).toMatchObject({
      mode: "FULL_TRUCKLOAD",
      loadPlanCode: "LP-2026-0001",
      vehicleSeq: 1,
      vehicleTypeCode: "TRUCK-1T25",
      bookedAt: "2026-10-21T01:00:00Z",
      carrierBookingToCancel: true,
    });
    expect(load.pendingUnloads?.[0]).toMatchObject({
      labelCode: "PKG-SO-9-1",
      shipmentCode: "SO-9-S1",
    });
    expect(load.shipments[0]?.packages[0]?.kit).toEqual({ ...kit(1) });
  });

  it("chuyến gửi kiện (không có trường FTL) vẫn parse: mọi trường mới vắng", () => {
    const load = beLoadSchema.parse(apiLoad());
    expect(load.loadPlanCode).toBeUndefined();
    expect(load.pendingUnloads).toBeUndefined();
    expect(load.carrierBookingToCancel).toBeUndefined();
    expect(load.shipments[0]?.packages[0]?.kit).toBeUndefined();
  });

  it("kit sai hợp đồng (partNo < 1) bị từ chối, không hạ chuẩn", () => {
    const bad = ftlLoad();
    const shipment = bad.shipments[0];
    if (!shipment?.packages[0]) throw new Error("fixture");
    shipment.packages[0] = {
      ...shipment.packages[0],
      kit: { groupId: "k", partNo: 0, partCount: 2 },
    };
    expect(() => beLoadSchema.parse(bad)).toThrow();
  });

  it("dòng danh sách: mã kế hoạch + số xe; biên bản: mode, kế hoạch, xe, loại xe, kiện thuộc bộ", () => {
    const rows = beLoadPageSchema.parse(page([ftlRow()]));
    expect(rows.items[0]).toMatchObject({ loadPlanCode: "LP-2026-0001", vehicleSeq: 1 });
    const manifest = beManifestSchema.parse(
      ftlManifest({
        shipments: [
          {
            shipmentCode: "SO-1-S1",
            packageCount: 1,
            codChangedSinceLabel: false,
            packages: [{ labelCode: "PKG-SO-1-1", loaded: true, kit: kit(1), labelOutdated: true }],
          },
        ],
      }),
    );
    expect(manifest).toMatchObject({
      mode: "FULL_TRUCKLOAD",
      loadPlanCode: "LP-2026-0001",
      vehicleSeq: 1,
      vehicleTypeCode: "TRUCK-1T25",
    });
    expect(manifest.shipments[0]?.packages[0]).toMatchObject({ kit: kit(1), labelOutdated: true });
    // Biên bản BE cũ không có mode → vắng, không phải UNKNOWN
    expect(beManifestSchema.parse(apiManifest()).mode).toBeUndefined();
  });
});
