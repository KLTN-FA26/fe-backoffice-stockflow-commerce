/**
 * "Ước tính thử" (SCRUM-474 TRIAL-FLOW, LP2-9): cổng quyền theo MÃ (`fulfillment-load-estimates:CREATE`), chọn file →
 * xem trước (kèm cảnh báo dòng bị bỏ) → chạy thử (POST, không lưu) → khung 3D với huy hiệu "Chạy thử — không lưu"; lỗi
 * bằng tiếng Việt. Đọc xlsx (Web Worker) và khung 3D (WebGL) được thay bằng bản giả — jsdom không có hai thứ đó.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOAD_ESTIMATE_PERMISSIONS, TRIAL_MAX_BOXES } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiVehicleTypePage } from "../../__fixtures__/estimate";
import {
  ESTIMATE_PERMISSION_SETS,
  mockEstimateGet,
  renderWithEstimateProviders,
} from "../../__fixtures__/render-estimate";
import { apiTrialEstimate } from "../../__fixtures__/trial";

import { TrialEstimateScreen } from "./TrialEstimateScreen";

import type { PermissionCode } from "@/lib/auth";
import type { TrialRow } from "../../trial/trial-parse";

vi.mock("../viewer/VehicleViewer", () => ({
  VehicleViewer: ({ layout }: { layout: { code: string; boxes: unknown[] } }) => (
    <div data-testid="viewer" data-code={layout.code}>
      {layout.boxes.length} kiện
    </div>
  ),
}));
/** `readSheet` giả: `read` trả bảng; `corrupt` mô phỏng file hỏng (ném thật, không qua spy — spy ném bị Vitest báo lỗi). */
const sheet = vi.hoisted(() => ({ read: vi.fn(), corrupt: false }));
vi.mock("read-excel-file/browser", () => ({
  readSheet: async (file: File) => {
    if (sheet.corrupt) throw new Error("zip");
    return sheet.read(file);
  },
}));

/** Bảng đọc từ xlsx: tiêu đề, dòng đơn vị (cm), hai dòng hàng, một dòng thiếu Pieces (bị bỏ kèm cảnh báo). */
const HEADER = [
  "Group",
  "Description",
  "Pieces",
  "Length",
  "Width",
  "Height",
  "Total weight",
  "Rotable",
];
const SHEET: TrialRow[] = [
  ["EasyCargo import template"],
  HEADER,
  [null, null, null, "centimeters", null, null, "kilograms", "Y/N"],
  ["VIS-1", "SW1701-1", 10, 90, 72, 131, 1, "Y"],
  [null, null, 6, 120, 80, 60, 1, "N"],
  ["VIS-2", "Thiếu", null, 10, 10, 10, 1, "Y"],
];

const TYPES = "/fulfillment/vehicle-types";
const FILE = () =>
  new File(["x"], "danh-sach.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

beforeEach(() => {
  sheet.corrupt = false;
  sheet.read.mockResolvedValue(SHEET);
});
afterEach(() => vi.restoreAllMocks());

async function open(permissions: readonly PermissionCode[] = ESTIMATE_PERMISSION_SETS.createOnly) {
  mockEstimateGet(permissions, { [TYPES]: () => apiVehicleTypePage });
  await renderWithEstimateProviders(<TrialEstimateScreen />);
  return userEvent.setup();
}

async function pickFile(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(await screen.findByTestId("trial-file-input"), FILE());
}

describe("TrialEstimateScreen — cổng quyền theo mã (UI-only; Backend re-check)", () => {
  it("thiếu fulfillment-load-estimates:CREATE (chỉ READ) → bị chặn, không có ô tải file", async () => {
    await open(ESTIMATE_PERMISSION_SETS.readOnly);
    expect(await screen.findByRole("alert")).toHaveTextContent(/không có quyền/i);
    expect(screen.queryByTestId("trial-file-input")).not.toBeInTheDocument();
  });

  it("có CREATE → màn hiện, nút tải file mẫu trỏ tới file trong public", async () => {
    await open();
    expect(await screen.findByRole("button", { name: "Chọn file .xlsx" })).toBeEnabled();
    const template = screen.getByRole("link", { name: "Tải file mẫu" });
    expect(template).toHaveAttribute("href", "/templates/easycargo-trial-template.xlsx");
    expect(template).toHaveAttribute("download");
    expect(screen.getAllByText("Chạy thử — không lưu").length).toBeGreaterThan(0);
  });
});

describe("TrialEstimateScreen — từ file tới kết quả", () => {
  it("xem trước: tóm tắt, dòng bị bỏ có cảnh báo, bảng kiện; chưa chọn file thì chưa có nút chạy", async () => {
    const user = await open();
    expect(screen.queryByRole("button", { name: "Chạy thử" })).not.toBeInTheDocument();
    await pickFile(user);
    expect(
      await screen.findByText(/2 dòng · 16 kiện · 1 nhóm · đơn vị trong file: xentimét/),
    ).toBeInTheDocument();
    expect(screen.getByText("Đã bỏ qua 1 dòng")).toBeInTheDocument();
    expect(screen.getByText("Dòng 6: bỏ qua — thiếu Pieces hoặc bằng 0.")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("SW1701-1")).toBeInTheDocument();
    expect(within(table).getByText("1.310")).toBeInTheDocument();
    expect(within(table).getByText("Không")).toBeInTheDocument();
  });

  it("chạy thử: POST danh sách dòng (không có sourceRow) + loại xe đã chọn, rồi hiện 3D kèm huy hiệu 'Chạy thử — không lưu'", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiTrialEstimate() });
    const user = await open();
    await pickFile(user);
    await user.click(await screen.findByRole("checkbox", { name: /40HC/ }));
    await user.click(screen.getByRole("button", { name: "Chạy thử" }));

    const result = await screen.findByRole("region", { name: "Kết quả chạy thử" });
    expect(within(result).getByTestId("viewer")).toHaveAttribute("data-code", "40HC");
    expect(within(result).getByText("Chạy thử — không lưu")).toBeInTheDocument();
    expect(within(result).queryByText("Khối lượng")).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0] ?? [];
    expect(url).toBe("/fulfillment/load-estimates/trial");
    expect(body).toMatchObject({ selectionMode: "SINGLE_TYPE" });
    expect((body as { lines: object[] }).lines).toEqual([
      {
        name: "SW1701-1",
        group: "VIS-1",
        lengthMm: 900,
        widthMm: 720,
        heightMm: 1310,
        quantity: 10,
        rotatable: true,
      },
      {
        name: "row-5",
        group: "",
        lengthMm: 1200,
        widthMm: 800,
        heightMm: 600,
        quantity: 6,
        rotatable: false,
      },
    ]);
    expect((body as { vehicleTypeIds: string[] }).vehicleTypeIds).toHaveLength(1);
    expect(await screen.findByRole("button", { name: "Chạy thử lại" })).toBeEnabled();
  });

  it("chọn file khác = bỏ kết quả cũ (kết quả không lưu, không còn ý nghĩa)", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: apiTrialEstimate() });
    const user = await open();
    await pickFile(user);
    await user.click(await screen.findByRole("button", { name: "Chạy thử" }));
    await screen.findByRole("region", { name: "Kết quả chạy thử" });
    await pickFile(user);
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Kết quả chạy thử" })).not.toBeInTheDocument(),
    );
  });

  it("lỗi BE được dịch: quá 3 000 kiện (422)", async () => {
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(422, "LOAD_ESTIMATE_TOO_MANY_CARTONS", "x"),
    );
    const user = await open();
    await pickFile(user);
    await user.click(await screen.findByRole("button", { name: "Chạy thử" }));
    expect(await screen.findByText(/Quá nhiều kiện cho một lần ước tính/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Kết quả chạy thử" })).not.toBeInTheDocument();
  });

  it("lỗi BE được dịch: dòng không hợp lệ (400, lines[1])", async () => {
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(400, "VALIDATION_FAILED", "x", {
        "lines[1].heightMm": "must be at most 100000",
      }),
    );
    const user = await open();
    await pickFile(user);
    await user.click(await screen.findByRole("button", { name: "Chạy thử" }));
    expect(await screen.findByText(/Dòng thứ 2 trong danh sách không hợp lệ/)).toBeInTheDocument();
  });

  it(`quá ${TRIAL_MAX_BOXES} kiện: báo ngay ở bước xem trước và khoá nút chạy thử (không gọi BE)`, async () => {
    sheet.read.mockResolvedValue([
      ...SHEET.slice(0, 3),
      ["", "Nhiều", TRIAL_MAX_BOXES + 1, 10, 10, 10],
    ]);
    const post = vi.spyOn(api, "post");
    const user = await open();
    await pickFile(user);
    expect(await screen.findByText(/vượt giới hạn 3000 kiện/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chạy thử" })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("file không có dòng tiêu đề đủ cột: báo lỗi tiếng Việt, không có xem trước", async () => {
    sheet.read.mockResolvedValue([
      ["Tên", "Số lượng"],
      ["a", 1],
    ]);
    const user = await open();
    await pickFile(user);
    expect(await screen.findByText(/Không tìm thấy dòng tiêu đề/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chạy thử" })).not.toBeInTheDocument();
  });

  it("file không phải .xlsx bị từ chối trước khi đọc; file hỏng báo không đọc được", async () => {
    await open();
    // Trình duyệt lọc theo `accept`, nhưng người dùng vẫn kéo thả được file khác: parser tự kiểm tên file
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(
      await screen.findByTestId("trial-file-input"),
      new File(["x"], "bang.csv", { type: "text/csv" }),
    );
    expect(await screen.findByText("Chỉ nhận file .xlsx.")).toBeInTheDocument();
    expect(sheet.read).not.toHaveBeenCalled();
    sheet.corrupt = true;
    await pickFile(user);
    expect(await screen.findByText(/Không đọc được file/)).toBeInTheDocument();
  });
});

describe("quyền của mã", () => {
  it("dùng đúng mã BE fulfillment-load-estimates:CREATE", () => {
    expect(LOAD_ESTIMATE_PERMISSIONS.create).toBe("fulfillment-load-estimates:CREATE");
  });
});
