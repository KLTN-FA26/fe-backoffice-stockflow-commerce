/**
 * Schema khớp BE PR #137: Jackson `non_null` bỏ trường null (nullish), enum khoan dung, kiểu nguyên thuỷ
 * bắt buộc — dữ liệu sai hợp đồng phải làm parse thất bại (không hạ chuẩn schema).
 */

import { describe, expect, it } from "vitest";

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
