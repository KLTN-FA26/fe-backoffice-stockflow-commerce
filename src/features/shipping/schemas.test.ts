/**
 * Schema khớp BE PR #137: Jackson `non_null` bỏ trường null (nullish), enum khoan dung, kiểu nguyên thuỷ
 * bắt buộc — dữ liệu sai hợp đồng phải làm parse thất bại (không hạ chuẩn schema).
 */

import { describe, expect, it } from "vitest";

import {
  dispatchedLoad,
  ftlLoad,
  ftlManifest,
  ftlRow,
  loadingFtl,
  pendingUnload,
} from "./__fixtures__/ftl-load";
import { apiLoad, apiManifest, apiShipment, shipmentRow } from "./__fixtures__/load";
import { carrierBookingSchema, handoverWarningSchema, pendingUnloadSchema } from "./ftl-schemas";
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
    const load = beLoadSchema.parse({ ...apiLoad(), status: "ON_THE_MOON" });
    expect(load.status).toBe("UNKNOWN");
    const row = beLoadPageSchema.parse(
      page([
        {
          loadId: "L",
          code: "L",
          warehouseId: "w",
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

  it("trường cũ của chuyến gửi kiện (mode, COD) bị bỏ khi parse — không lọt vào dữ liệu FE", () => {
    const legacy = { ...apiLoad(), mode: "PARCEL", codTotal: 100 };
    const parsed: Record<string, unknown> = beLoadSchema.parse(legacy);
    expect(parsed).not.toHaveProperty("mode");
    expect(parsed).not.toHaveProperty("codTotal");
  });

  it("biên bản: parse đủ, mã vận đơn và kế hoạch xe tuỳ chọn", () => {
    const manifest = beManifestSchema.parse(apiManifest());
    expect(manifest).toMatchObject({ waybillNo: "GHN-250001", loadPlanCode: "LP-2026-0001" });
    expect(beManifestSchema.parse(apiManifest({ waybillNo: undefined })).waybillNo).toBeUndefined();
    expect(manifest.dispatchedAt).toBeUndefined();
    expect(() => beManifestSchema.parse({ ...apiManifest(), printedAt: undefined })).toThrow();
  });
});

describe("lô giao + hãng", () => {
  it("danh sách lô: trạng thái lạ → UNKNOWN; hãng và chuyến vắng là bình thường", () => {
    const parsed = beShipmentPageSchema.parse(page([{ ...shipmentRow(), status: "TELEPORTED" }]));
    expect(parsed.items[0]?.status).toBe("UNKNOWN");
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

  it("taskId tuỳ chọn ở hàng lô và ở chi tiết lô; trên chuyến cũng đọc được", () => {
    expect(beShipmentSchema.parse(apiShipment()).shipment.taskId).toBeUndefined();
    const after = beShipmentSchema.parse({
      ...apiShipment({ taskId: "task-1" }),
      taskId: "task-1",
    });
    expect(after).toMatchObject({ taskId: "task-1" });
    expect(after.shipment.taskId).toBe("task-1");
    const first = apiLoad().shipments[0];
    if (!first) throw new Error("fixture");
    const load = beLoadSchema.parse(apiLoad({ shipments: [{ ...first, taskId: "t" }] }));
    expect(load.shipments[0]?.taskId).toBe("t");
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
    expect(carrier.connection).toBeUndefined();
  });

  it("hãng: kết nối — khoá bí mật chỉ có cờ đã đặt; kiểu kết nối lạ → UNKNOWN", () => {
    const base = { carrierId: "c", code: "GHN", name: "GHN", status: "ACTIVE", version: 1 };
    const webhook = beCarrierSchema.parse({
      ...base,
      connection: { connectionType: "WEBHOOK_LOAD", webhookSecretConfigured: true },
    });
    expect(webhook.connection).toMatchObject({
      connectionType: "WEBHOOK_LOAD",
      webhookSecretConfigured: true,
    });
    expect(webhook.connection).not.toHaveProperty("webhookSecret");
    const api = beCarrierSchema.parse({
      ...base,
      connection: { connectionType: "API_BOOKING", apiKeyConfigured: true, apiEnvironment: "TEST" },
    });
    expect(api.connection?.connectionType).toBe("API_BOOKING");
    const strange = beCarrierSchema.parse({
      ...base,
      connection: { connectionType: "CARRIER_PIGEON" },
    });
    expect(strange.connection?.connectionType).toBe("UNKNOWN");
  });
});

describe("chuyến là một xe của kế hoạch xếp xe", () => {
  it("parse kế hoạch, số xe, loại xe, đặt xe, kiện cần dỡ, mã vận đơn", () => {
    const load = beLoadSchema.parse(
      ftlLoad({
        pendingUnloads: [pendingUnload()],
        carrierBookingToCancel: true,
        waybillNo: "GHN-1",
        carrierConnectionType: "WEBHOOK_LOAD",
      }),
    );
    expect(load).toMatchObject({
      loadPlanCode: "LP-2026-0001",
      vehicleSeq: 1,
      vehicleTypeCode: "TRUCK-1T25",
      bookedAt: "2026-10-21T01:00:00Z",
      carrierBookingToCancel: true,
      waybillNo: "GHN-1",
      carrierConnectionType: "WEBHOOK_LOAD",
    });
    expect(load.pendingUnloads?.[0]).toMatchObject({
      labelCode: "PKG-SO-9-1",
      shipmentCode: "SO-9-S1",
    });
  });

  it("trường của xe vắng vẫn parse (chuyến chưa đặt xe, BE bỏ null)", () => {
    const load = beLoadSchema.parse(
      dispatchedLoad({ waybillNo: undefined, pendingUnloads: undefined }),
    );
    expect(load.waybillNo).toBeUndefined();
    expect(load.pendingUnloads).toBeUndefined();
    expect(load.handoverWarnings).toBeUndefined();
    expect(load.carrierBooking).toBeUndefined();
  });

  it("kiểu kết nối của hãng lạ → UNKNOWN thay vì hỏng cả chuyến", () => {
    const load = beLoadSchema.parse({ ...ftlLoad(), carrierConnectionType: "CARRIER_PIGEON" });
    expect(load.carrierConnectionType).toBe("UNKNOWN");
  });

  it("cảnh báo bàn giao trong câu trả lời bắt đầu xếp: số tiền, đợt giao, ngày mở cửa sổ", () => {
    const load = beLoadSchema.parse(
      loadingFtl({
        handoverWarnings: [
          {
            orderId: "o1",
            orderNumber: "SO-2",
            reasonCode: "DELIVERY_BATCH_WINDOW_NOT_OPEN",
            deliveryBatchSeq: 2,
            windowStart: "2026-11-20",
          },
        ],
      }),
    );
    expect(load.handoverWarnings?.[0]).toMatchObject({
      reasonCode: "DELIVERY_BATCH_WINDOW_NOT_OPEN",
      deliveryBatchSeq: 2,
      windowStart: "2026-11-20",
    });
  });

  it("đơn đặt xe ở hãng API: trạng thái lạ → UNKNOWN; thiếu thời điểm vẫn parse", () => {
    const booking = carrierBookingSchema.parse({ status: "TELEPORTED", carrierOrderId: "X1" });
    expect(booking.status).toBe("UNKNOWN");
    expect(booking.carrierOrderId).toBe("X1");
    expect(carrierBookingSchema.parse({ status: "REQUESTED" }).bookedAt).toBeUndefined();
    expect(() =>
      carrierBookingSchema.parse({ status: "REQUESTED", bookedAt: "hôm qua" }),
    ).toThrow();
  });

  it("kiện cần dỡ: mã lý do huỷ có kiểm soát là tập đóng", () => {
    expect(
      pendingUnloadSchema.parse({ packageId: "p", labelCode: "PKG-1", reasonCode: "XE_HONG" })
        .reasonCode,
    ).toBe("XE_HONG");
    expect(() =>
      pendingUnloadSchema.parse({ packageId: "p", labelCode: "PKG-1", reasonCode: "LY_DO_LA" }),
    ).toThrow();
    expect(
      pendingUnloadSchema.parse({ packageId: "p", labelCode: "PKG-1" }).reasonCode,
    ).toBeUndefined();
  });

  it("dòng danh sách: mã kế hoạch + số xe + mã vận đơn; biên bản: kế hoạch, xe, loại xe", () => {
    const rows = beLoadPageSchema.parse(page([ftlRow({ waybillNo: "GHN-9" })]));
    expect(rows.items[0]).toMatchObject({
      loadPlanCode: "LP-2026-0001",
      vehicleSeq: 1,
      waybillNo: "GHN-9",
    });
    const manifest = beManifestSchema.parse(ftlManifest());
    expect(manifest).toMatchObject({
      loadPlanCode: "LP-2026-0001",
      vehicleSeq: 1,
      vehicleTypeCode: "TRUCK-1T25",
    });
  });
});

describe("handoverWarningSchema — đơn chưa được phép đi", () => {
  const base = { orderId: "o1", orderNumber: "SO-2", reasonCode: "ORDER_BALANCE_NOT_PAID" };

  it("amountDue đến dạng chuỗi (details.orders) hoặc số đều thành số", () => {
    expect(handoverWarningSchema.parse({ ...base, amountDue: "15000000.00" }).amountDue).toBe(
      15_000_000,
    );
    expect(handoverWarningSchema.parse({ ...base, amountDue: 20_000 }).amountDue).toBe(20_000);
    expect(handoverWarningSchema.parse(base).amountDue).toBeUndefined();
  });

  it("số tiền âm / không phải số, hoặc thiếu mã lý do bị từ chối", () => {
    expect(() => handoverWarningSchema.parse({ ...base, amountDue: "-1" })).toThrow();
    expect(() => handoverWarningSchema.parse({ ...base, amountDue: "abc" })).toThrow();
    const { reasonCode: _reasonCode, ...noReason } = base;
    expect(() => handoverWarningSchema.parse(noReason)).toThrow();
  });
});
