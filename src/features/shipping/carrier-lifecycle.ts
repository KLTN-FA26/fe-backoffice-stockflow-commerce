/**
 * Shipping — action-gating danh mục hãng (feature-architecture §6). Xem danh sách hãng là `fulfillment-shipments:READ`
 * (nhân viên kho chọn từ danh mục); thêm / sửa hãng — `POST`, `PUT /fulfillment/carriers` — là
 * `fulfillment-carriers:UPDATE` (quản lý kho). UI-only — Backend phải re-check.
 */

import { FULFILLMENT_CARRIER_PERMISSIONS } from "@/constants";

import type { ShippingActor } from "./lifecycle";

export interface CarrierActions {
  create: boolean;
  edit: boolean;
}

/** Thao tác trên danh mục hãng mà người dùng được làm: thêm và sửa chung một mã quyền. */
export function carrierActions(actor: ShippingActor): CarrierActions {
  const manage = actor.can(FULFILLMENT_CARRIER_PERMISSIONS.update);
  return { create: manage, edit: manage };
}
