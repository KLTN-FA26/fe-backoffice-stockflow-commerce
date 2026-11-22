/**
 * Trạng thái kiện/thùng trong "Chi tiết lô giao": mọi giá trị BE `PackageStatus` đều có nhãn tiếng Việt — thùng đã dán
 * nhãn (`LABELED`) trước đây rơi vào "Không rõ".
 */
import { describe, expect, it } from "vitest";

import { PACKAGE_API_STATUSES, PACKAGE_STATUS_DISPLAY } from "@/constants";
import { statusLabelVi } from "@/lib/status-map";

import { beShipmentParcelSchema } from "./schemas";

describe("trạng thái kiện trong lô giao", () => {
  it("mọi giá trị BE PackageStatus có nhãn tiếng Việt, không phải 'Không rõ'", () => {
    for (const status of PACKAGE_API_STATUSES) {
      const label = statusLabelVi(PACKAGE_STATUS_DISPLAY[status]);
      expect(label, status).toBeTruthy();
      expect(label, status).not.toBe("Không rõ");
    }
  });

  it("LABELED (thùng đã dán nhãn đi trong lô) → 'Đã dán nhãn'", () => {
    const parcel = beShipmentParcelSchema.parse({
      packageId: "p1",
      labelCode: "SO-1-C1",
      status: "LABELED",
    });
    expect(parcel.status).toBe("LABELED");
    expect(statusLabelVi(PACKAGE_STATUS_DISPLAY[parcel.status])).toBe("Đã dán nhãn");
  });

  it("trạng thái kiện cũ vẫn đúng: SEALED → Đã niêm phong; mã BE lạ → 'Không rõ' (không chặn trang)", () => {
    expect(statusLabelVi(PACKAGE_STATUS_DISPLAY.SEALED)).toBe("Đã niêm phong");
    const parcel = beShipmentParcelSchema.parse({
      packageId: "p2",
      labelCode: "SO-1-C2",
      status: "SOMETHING_NEW",
    });
    expect(statusLabelVi(PACKAGE_STATUS_DISPLAY[parcel.status])).toBe("Không rõ");
  });
});
