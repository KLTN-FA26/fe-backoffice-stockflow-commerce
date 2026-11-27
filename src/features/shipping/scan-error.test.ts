import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import { scanErrorMessage } from "./scan-error";

const load = { code: "LD-1", loadPlanCode: "LP-1", vehicleSeq: 1 };
const refusal = (
  code: string,
  details?: Record<string, unknown>,
  fields?: Record<string, string>,
) => new ApiError(409, code, "server message", fields, undefined, undefined, undefined, details);

describe("scanErrorMessage — quét lên xe (U69)", () => {
  it("sai xe: nêu kế hoạch, xe, chuyến đích và việc mang kiện tới đó", () => {
    const message = scanErrorMessage(
      refusal("PACKAGE_NOT_IN_LOAD", {
        planCode: "LP-2",
        vehicleSeq: 3,
        loadCode: "LD-3",
      }),
      load,
    );
    expect(message).toContain("Chuyến LD-1 · kế hoạch LP-1 · xe số 1");
    expect(message).toContain("kế hoạch LP-2 · xe số 3 · chuyến LD-3");
    expect(message).toContain("mang tới đúng chuyến");
  });

  it("BE cũ chỉ gửi fieldErrors: vẫn nêu xe và chuyến đích", () => {
    expect(
      scanErrorMessage(
        refusal("PACKAGE_NOT_IN_LOAD", undefined, { vehicleSeq: "2", loadCode: "LD-2" }),
        load,
      ),
    ).toContain("xe số 2 · chuyến LD-2");
  });

  it("LPN của thùng chưa dán nhãn: nêu trạng thái thật và màn Kiểm thùng", () => {
    const message = scanErrorMessage(
      refusal("PACKAGE_NOT_READY", { packageStatus: "CHECKED" }),
      load,
    );
    expect(message).toContain("Trạng thái kiện: Đã kiểm");
    expect(message).toContain("Hoàn tất kiểm thùng và dán nhãn ở màn Kiểm thùng");
    expect(message).not.toContain("Không tìm thấy");
  });

  it("lô đã huỷ: nêu trạng thái lô và giao quản lý kho kiểm tra", () => {
    const message = scanErrorMessage(
      refusal("PACKAGE_NOT_READY", {
        packageStatus: "LABELED",
        shipmentCode: "SO-2-S1",
        shipmentStatus: "CANCELLED",
      }),
      load,
    );
    expect(message).toContain("Trạng thái kiện: Đã dán nhãn");
    expect(message).toContain("Lô SO-2-S1: Đã huỷ");
    expect(message).toContain("Quản lý kho kiểm tra trạng thái lô giao");
  });

  it("đã ở chuyến khác / chờ dỡ: nêu đúng chuyến để tới xử lý", () => {
    expect(
      scanErrorMessage(refusal("PACKAGE_ALREADY_LOADED", { loadCode: "LD-4" }), load),
    ).toContain("Kiện đã ở chuyến LD-4");
    expect(
      scanErrorMessage(refusal("PACKAGE_UNLOAD_PENDING", { loadCode: "LD-5" }), load),
    ).toContain("quét dỡ ở chuyến đó trước");
  });

  it("mã chưa biết: chỉ kiểm tra nhãn, không đoán kiện thuộc chuyến nào", () => {
    const message = scanErrorMessage(refusal("PACKAGE_NOT_FOUND"), load);
    expect(message).toContain("Không tìm thấy kiện với mã này");
    expect(message).toContain("Kiểm tra mã trên nhãn");
    expect(message).not.toContain("chuyến LD-2");
  });
});
