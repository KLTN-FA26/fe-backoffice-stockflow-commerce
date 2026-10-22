/**
 * Mock routes — đóng gói chuyển kho (`/fulfillment/transfer-packs`), khớp BE `TransferPackController` (SCRUM-287 PR T,
 * BE PR #164). Chỉ dùng khi USE_MOCK=true. Quyền như BE: mở / ghi = `fulfillment-packing:UPDATE`, xem =
 * `fulfillment-packages:READ`; người không mở phiên bị `PACKING_TAKEN` trừ khi có `fulfillment-packing:APPROVE`.
 * Mở phiên chuyển lệnh APPROVED → PICKING; hoàn tất đặt `packedAt` của lệnh và đưa lệnh vào danh sách ứng viên kế hoạch xe.
 */

import { FULFILLMENT_PACKAGE_PERMISSIONS, FULFILLMENT_PACKING_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { addMockTransferShipment } from "./mock-load-plan-transfer";
import { PackError } from "./mock-packing-session";
import { fail, ok } from "./mock-route-utils";
import { currentActor, routeParam } from "./mock-routes-fulfillment-store";
import { getTransferStore } from "./mock-routes-transfer-orders-store";
import { parseJsonBody, readInt, readString } from "./mock-routes-purchase-orders-store";
import {
  applyScan,
  completePack,
  newPack,
  openKit,
  openParcel,
  sealParcel,
  shipCarton,
  voidParcel,
} from "./mock-transfer-pack-session";
import {
  getTransferPacks,
  livePackOf,
  parcelView,
  sessionView,
} from "./mock-routes-transfer-packs-store";

import type { AxiosRequestConfig } from "axios";
import type { MockActor } from "./mock-routes-fulfillment-store";
import type { MockResponseShape } from "./mock-route-utils";
import type { MockTransfer } from "./mock-routes-transfer-orders-store";
import type { MockTransferPack } from "./mock-transfer-pack-session";

const BASE = "/fulfillment/transfer-packs";
const PACK = `${BASE}/:packId`;
const PACKAGE = `${PACK}/packages/:packageId`;

const asFailure = (error: unknown): MockResponseShape => {
  if (error instanceof PackError)
    return fail(error.status, error.code, error.message, error.fields);
  throw error;
};

interface Ctx {
  pack: MockTransferPack;
  transfer: MockTransfer;
  actor: MockActor;
}

/** Khung chung: quyền → phiên → lệnh → (ghi) người đóng hoặc người có quyền tiếp quản. */
async function load(config: AxiosRequestConfig, write: boolean): Promise<Ctx | MockResponseShape> {
  const actor = await currentActor();
  if (
    !actor.can(
      write ? FULFILLMENT_PACKING_PERMISSIONS.update : FULFILLMENT_PACKAGE_PERMISSIONS.read,
    )
  )
    return fail(403, "FORBIDDEN", "Access denied");
  const pack = getTransferPacks().get(routeParam(config, "packId"));
  const transfer = pack ? (await getTransferStore()).get(pack.transferOrderId) : undefined;
  if (!pack || !transfer) return fail(404, "NOT_FOUND", "No transfer packing session");
  if (
    write &&
    pack.packerId !== actor.userId &&
    !actor.can(FULFILLMENT_PACKING_PERMISSIONS.approve)
  )
    return fail(409, "PACKING_TAKEN", "Another packer is packing this transfer");
  return { pack, transfer, actor };
}

const isFailure = (value: Ctx | MockResponseShape): value is MockResponseShape => "status" in value;

/** Chạy một thao tác ghi trên phiên; `PackError` thành lỗi BE, ngoài ra trả `reply(ctx)`. */
async function write(
  config: AxiosRequestConfig,
  run: (ctx: Ctx) => MockResponseShape | Promise<MockResponseShape>,
): Promise<MockResponseShape> {
  const ctx = await load(config, true);
  if (isFailure(ctx)) return ctx;
  try {
    return await run(ctx);
  } catch (error: unknown) {
    return asFailure(error);
  }
}

const sessionOf = ({ pack, transfer }: Ctx, status = 200) =>
  ok(sessionView(pack, transfer), status);

export function registerTransferPackMockRoutes(): void {
  registerMockRoute("POST", BASE, async (config) => {
    const actor = await currentActor();
    if (!actor.can(FULFILLMENT_PACKING_PERMISSIONS.update))
      return fail(403, "FORBIDDEN", "Access denied");
    const store = await getTransferStore();
    const transfer = store.get(readString(parseJsonBody(config.data).transferOrderId));
    if (!transfer) return fail(404, "TRANSFER_ORDER_NOT_FOUND", "Transfer order not found");
    if (transfer.deliveryMode !== "FULL_TRUCKLOAD")
      return fail(
        409,
        "TRANSFER_NOT_FULL_TRUCKLOAD",
        "This transfer order does not travel as a full truckload",
      );
    const existing = livePackOf(transfer.transferId);
    if (existing) {
      if (
        existing.packStatus === "PACKING" &&
        existing.packerId !== actor.userId &&
        !actor.can(FULFILLMENT_PACKING_PERMISSIONS.approve)
      )
        return fail(409, "PACKING_TAKEN", "Another packer is packing this transfer");
      return ok(sessionView(existing, transfer), 201);
    }
    if (transfer.status !== "APPROVED" && transfer.status !== "PICKING")
      return fail(
        409,
        "INVALID_TRANSFER_TRANSITION",
        `Transfer cannot move from ${transfer.status} to PICKING`,
      );
    // APPROVED → PICKING (docs 10 §5)
    if (transfer.status === "APPROVED")
      store.set(transfer.transferId, {
        ...transfer,
        status: "PICKING",
        version: transfer.version + 1,
      });
    const pack = newPack(transfer, actor.userId);
    getTransferPacks().set(pack.packId, pack);
    return ok(sessionView(pack, store.get(transfer.transferId) ?? transfer), 201);
  });

  registerMockRoute("GET", PACK, async (config) => {
    const ctx = await load(config, false);
    return isFailure(ctx) ? ctx : sessionOf(ctx);
  });

  registerMockRoute("POST", `${PACK}/packages`, (config) =>
    write(config, ({ pack, transfer }) => {
      const body = parseJsonBody(config.data);
      const reason = readString(body.kitOverrideReason) || undefined;
      return ok(parcelView(openParcel(pack, transfer, body.packageType, reason), transfer), 201);
    }),
  );

  registerMockRoute("POST", `${PACK}/package-kits`, (config) =>
    write(config, ({ pack, transfer }) => {
      const body = parseJsonBody(config.data);
      const partCount = body.partCount === undefined ? undefined : readInt(body.partCount, 0);
      if (partCount !== undefined && (partCount < 2 || partCount > 99))
        return fail(400, "VALIDATION_FAILED", "Invalid request data", [
          { field: "partCount", message: "must be between 2 and 99" },
        ]);
      const kit = openKit(pack, transfer, {
        transferLineId: readString(body.transferLineId),
        partCount,
        packageType: body.packageType,
      });
      return ok(
        {
          kitGroupId: kit.groupId,
          transferLineId: kit.line.lineId,
          sku: kit.line.sku,
          partCount: kit.packages.length,
          packages: kit.packages.map((p) => parcelView(p, transfer)),
        },
        201,
      );
    }),
  );

  registerMockRoute("POST", `${PACKAGE}/scans`, (config) =>
    write(config, (ctx) => {
      const body = parseJsonBody(config.data);
      const scannedCode = readString(body.scannedCode);
      const quantity = readInt(body.quantity, 0);
      if (!readString(body.scanId) || !scannedCode || quantity < 1 || quantity > 1_000_000)
        return fail(400, "VALIDATION_FAILED", "Invalid request data", [
          { field: !scannedCode ? "scannedCode" : "quantity", message: "invalid" },
        ]);
      applyScan(ctx.pack, ctx.transfer, routeParam(config, "packageId"), {
        scanId: readString(body.scanId),
        scannedCode,
        quantity,
        lotNumber: readString(body.lotNumber) || undefined,
        transferLineId: readString(body.transferLineId) || undefined,
        kitOverrideReason: readString(body.kitOverrideReason) || undefined,
      });
      return sessionOf(ctx);
    }),
  );

  registerMockRoute("POST", `${PACKAGE}/seal`, (config) =>
    write(config, ({ pack, transfer }) => {
      const body = parseJsonBody(config.data);
      const parcel = sealParcel(pack, transfer, routeParam(config, "packageId"), {
        weightKg: body.weightKg,
        lengthCm: body.lengthCm,
        widthCm: body.widthCm,
        heightCm: body.heightCm,
        packageType: body.packageType,
        rotatable: body.rotatable,
        fragile: body.fragile,
        kitOverrideReason: readString(body.kitOverrideReason) || undefined,
      });
      return ok(parcelView(parcel, transfer));
    }),
  );

  registerMockRoute("DELETE", PACKAGE, (config) =>
    write(config, (ctx) => {
      voidParcel(ctx.pack, routeParam(config, "packageId"));
      return sessionOf(ctx);
    }),
  );

  registerMockRoute("POST", `${PACK}/cartons`, (config) =>
    write(config, ({ pack, transfer }) => {
      const body = parseJsonBody(config.data);
      const lpn = readString(body.lpn);
      if (!lpn)
        return fail(400, "VALIDATION_FAILED", "Invalid request data", [
          { field: "lpn", message: "must not be blank" },
        ]);
      const { parcel, carton } = shipCarton(pack, transfer, lpn, body.packageType);
      return ok(
        {
          parcel: parcelView(parcel, transfer),
          lpn,
          unitOfMeasure: carton.unitOfMeasure,
          suggested: carton.suggested,
        },
        201,
      );
    }),
  );

  registerMockRoute("POST", `${PACK}/completion`, (config) =>
    write(config, async (ctx) => {
      const body = parseJsonBody(config.data);
      completePack(ctx.pack, ctx.transfer, {
        partial: body.partial === true,
        note: readString(body.note),
      });
      const store = await getTransferStore();
      const packedAt = ctx.pack.packedAt ?? new Date().toISOString();
      const next = { ...ctx.transfer, packedAt, version: ctx.transfer.version + 1 };
      store.set(next.transferId, next);
      addMockTransferShipment(next, ctx.pack);
      return sessionOf({ ...ctx, transfer: next });
    }),
  );
}
