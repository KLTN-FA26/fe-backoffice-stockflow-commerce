import type { z } from "zod";

import type { CartonStatus, PackStatus } from "@/constants";
import type {
  beCartonCheckLineSchema,
  beCartonCheckQueueRowSchema,
  beCartonCheckSessionSchema,
  beCartonPaymentDueSchema,
  beCartonSchema,
  beCartonShipmentSchema,
} from "./carton-check-schemas";

/* ── DTO trên wire ───────────────────────────────────────────────────── */

export type CartonCheckQueueRowDto = z.infer<typeof beCartonCheckQueueRowSchema>;
export type CartonCheckSessionDto = z.infer<typeof beCartonCheckSessionSchema>;
export type CartonCheckLine = z.infer<typeof beCartonCheckLineSchema>;
export type CartonShipment = z.infer<typeof beCartonShipmentSchema>;
export type CartonPaymentDue = z.infer<typeof beCartonPaymentDueSchema>;

/* ── Model FE: trạng thái đổi 1-1 sang tên hiển thị nguyên văn docs, giá trị lạ → "Unknown" ── */

export type SessionStatus = PackStatus | "Unknown";
export type CartonDisplayStatus = CartonStatus | "Unknown";

export type Carton = Omit<z.infer<typeof beCartonSchema>, "status"> & {
  status: CartonDisplayStatus;
};

export type CartonCheckSession = Omit<CartonCheckSessionDto, "status" | "cartons"> & {
  status: SessionStatus;
  cartons: Carton[];
};

export type CartonCheckQueueRow = Omit<CartonCheckQueueRowDto, "status"> & {
  status: SessionStatus;
};

/* ── Input của các thao tác ──────────────────────────────────────────── */

export interface CartonCheckQueueParams {
  /** Trang đánh số từ 0 (BE PageResponse). */
  page?: number;
  size?: number;
  warehouseId?: string;
  /** `PackStatus` BE (PENDING / IN_PROGRESS / …); bỏ trống = mọi đơn đang chờ. */
  status?: string;
  [key: string]: unknown;
}

export interface CartonScanInput {
  taskId: string;
  /** LPN như máy quét đọc — BE nhận mọi kiểu chữ hoa / thường. */
  lpn: string;
}

export interface CartonSelectionInput {
  taskId: string;
  /** Thùng được chọn; bỏ trống = mọi thùng liên quan (đã quét để dán nhãn / đã dán để in). */
  lpns?: readonly string[];
}

export interface CartonRemovalInput {
  taskId: string;
  lpn: string;
  /** Tình trạng thùng (≤ 500 ký tự), không bắt buộc. */
  note?: string;
}

export interface CartonReprintInput {
  taskId: string;
  lpn: string;
  /** Phiên bản nhãn đang dán — gửi lại sau lỗi mạng không tạo thêm một phiên bản nữa. */
  fromVersion: number;
}

export interface CompleteCartonCheckInput {
  taskId: string;
  /** Id lần hoàn tất — gửi lại cùng id thì BE trả lại shipment đã tạo. */
  requestId: string;
  partial: boolean;
  note?: string;
}

/** File PDF nhãn giao hàng BE trả về. */
export interface ShippingLabelsPdf {
  blob: Blob;
  fileName: string;
}
