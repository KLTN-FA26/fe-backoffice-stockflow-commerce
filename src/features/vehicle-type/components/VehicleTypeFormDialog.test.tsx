import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS, VEHICLE_TYPE_ERROR_MESSAGES, VEHICLE_TYPE_FIELD_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { VT_20DC_ID, apiCustomTruck, apiVehicleType } from "../__fixtures__/vehicle-type";
import {
  VEHICLE_TYPE_ACTORS as ACTORS,
  mockVehicleTypeApi,
  renderVehicleTypeScreen,
} from "../__fixtures__/render";
import { VehicleTypeFormDialog } from "./VehicleTypeFormDialog";

import type { VehicleType } from "../types";

afterEach(() => vi.restoreAllMocks());

const L = UI_LABELS.vehicleType;
const PATH = "/fulfillment/vehicle-types";
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const field = (name: string) => screen.getByLabelText(new RegExp(`^${escape(name)}`));

/** Response BE: body đi qua JSON nên trường `undefined` (bỏ trống) không đè lên giá trị mặc định. */
const echo = (base: VehicleType, body: unknown): VehicleType => ({
  ...base,
  ...(JSON.parse(JSON.stringify(body)) as Partial<VehicleType>),
});

function renderDialog(vehicleType?: VehicleType, onClose = vi.fn()) {
  let latest = vehicleType;
  const spies = mockVehicleTypeApi(ACTORS.warehouseManager, {
    get: { [`${PATH}/${vehicleType?.vehicleTypeId}`]: () => latest },
    post: { [PATH]: (_p, body) => echo(apiCustomTruck(), body) },
    put: {
      [`${PATH}/${vehicleType?.vehicleTypeId}`]: (_p, body) => echo(apiVehicleType(), body),
    },
  });
  renderVehicleTypeScreen(<VehicleTypeFormDialog vehicleType={vehicleType} onClose={onClose} />);
  return { ...spies, onClose, setServerRow: (row: VehicleType) => (latest = row) };
}

async function fillCreateForm() {
  const user = userEvent.setup();
  await user.type(field(L.field.code), "truck-3t");
  await user.type(field(L.field.name), "Xe tải 3 tấn");
  await user.type(field(L.field.innerLengthMm), "4200");
  await user.type(field(L.field.innerWidthMm), "1900");
  await user.type(field(L.field.innerHeightMm), "1900");
  await user.type(field(L.field.maxPayloadKg), "3000");
  return user;
}

describe("VehicleTypeFormDialog — thêm loại xe", () => {
  it("chưa đủ dữ liệu thì nút Thêm bị khoá; xem trước thể tích m³ cập nhật theo ba cạnh", async () => {
    renderDialog();
    const submit = await screen.findByRole("button", { name: L.form.submitCreate });
    expect(submit).toBeDisabled();
    expect(screen.getByText(L.form.volumeEmpty)).toBeInTheDocument();
    await fillCreateForm();
    // 4,2 × 1,9 × 1,9 = 15,162 m³
    expect(await screen.findByText("15,16 m³")).toBeInTheDocument();
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("báo lỗi từng ô theo luật BE: kích thước > 0, tải trọng > 0, số xe ≥ 0, khe góc ≥ 0", async () => {
    renderDialog();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: L.form.submitCreate });
    await user.type(field(L.field.innerLengthMm), "0");
    await user.type(field(L.field.maxPayloadKg), "0");
    await user.clear(field(L.field.availableCount));
    await user.type(field(L.field.availableCount), "-1");
    await user.type(field(L.field.gussetMm), "-5");
    expect(
      await screen.findAllByText(VEHICLE_TYPE_FIELD_MESSAGES.dimensionPositive),
    ).not.toHaveLength(0);
    expect(screen.getByText(VEHICLE_TYPE_FIELD_MESSAGES.payloadPositive)).toBeInTheDocument();
    // Số xe và khe góc dùng chung câu "Không được âm" — mỗi ô một câu
    expect(screen.getAllByText(VEHICLE_TYPE_FIELD_MESSAGES.countNegative)).toHaveLength(2);
    expect(screen.getByRole("button", { name: L.form.submitCreate })).toBeDisabled();
  });

  it("gửi POST với số đã đổi từ chuỗi, bỏ trường tuỳ chọn để trống, rồi đóng", async () => {
    const { post, onClose } = renderDialog();
    const user = await fillCreateForm();
    await user.click(await screen.findByRole("button", { name: L.form.submitCreate }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    const [url, sent] = post.mock.calls[0] ?? [];
    expect(url).toBe(PATH);
    expect(sent).toEqual({
      code: "TRUCK-3T",
      name: "Xe tải 3 tấn",
      kind: "TRUCK",
      innerLengthMm: 4200,
      innerWidthMm: 1900,
      innerHeightMm: 1900,
      gussetMm: 0,
      maxPayloadKg: 3000,
      availableCount: 1,
      status: "ACTIVE",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("409 VEHICLE_TYPE_CODE_EXISTS: hiện câu tiếng Việt trong dialog, form giữ nguyên", async () => {
    const { post, onClose } = renderDialog();
    post.mockRejectedValueOnce(new ApiError(409, "VEHICLE_TYPE_CODE_EXISTS", "taken"));
    const user = await fillCreateForm();
    await user.click(await screen.findByRole("button", { name: L.form.submitCreate }));
    expect(
      await screen.findByText(VEHICLE_TYPE_ERROR_MESSAGES.VEHICLE_TYPE_CODE_EXISTS),
    ).toBeInTheDocument();
    expect(field(L.field.code)).toHaveValue("truck-3t");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_FAILED: nêu tên ô và gắn lỗi vào đúng ô", async () => {
    const { post } = renderDialog();
    post.mockRejectedValueOnce(
      new ApiError(400, "VALIDATION_FAILED", "bad", { innerHeightMm: "1 to 30000 mm" }),
    );
    const user = await fillCreateForm();
    await user.click(await screen.findByRole("button", { name: L.form.submitCreate }));
    expect(
      await screen.findByText(/Dữ liệu chưa hợp lệ\. \(Cao trong \(mm\)\)/),
    ).toBeInTheDocument();
    expect(field(L.field.innerHeightMm)).toHaveAttribute("aria-invalid", "true");
  });
});

describe("VehicleTypeFormDialog — sửa loại xe", () => {
  it("nạp sẵn giá trị; mã chỉ đọc; có ô trạng thái", async () => {
    renderDialog(apiVehicleType());
    expect(await screen.findByDisplayValue("Container 20' Dry (20DC)")).toBeInTheDocument();
    expect(field(L.field.code)).toBeDisabled();
    expect(field(L.field.code)).toHaveValue("20DC");
    expect(field(L.field.innerLengthMm)).toHaveValue("5898");
    expect(field(L.field.maxPayloadKg)).toHaveValue("28200");
    expect(field(L.field.status)).toBeInTheDocument();
    expect(screen.getByText("33,20 m³")).toBeInTheDocument();
  });

  it("loại xe mặc định: mã và loại bị khoá, có gợi ý; loại xe tự thêm đổi được loại", async () => {
    renderDialog(apiVehicleType());
    const kind = await screen.findByRole("combobox", { name: new RegExp(`^${L.field.kind}`) });
    expect(kind).toBeDisabled();
    expect(field(L.field.code)).toBeDisabled();
    expect(screen.getByText(L.form.presetLockedHint)).toBeInTheDocument();
  });

  it("loại xe tự thêm: loại chọn được, chỉ mã bị khoá", async () => {
    renderDialog(apiCustomTruck());
    const kind = await screen.findByRole("combobox", { name: new RegExp(`^${L.field.kind}`) });
    expect(kind).toBeEnabled();
    expect(field(L.field.code)).toBeDisabled();
    expect(screen.queryByText(L.form.presetLockedHint)).not.toBeInTheDocument();
  });

  it("khe góc quá lớn so với thùng: báo ngay ở ô khe góc và khoá nút Lưu; trống gửi 0", async () => {
    const { put } = renderDialog(apiVehicleType());
    const user = userEvent.setup();
    const gusset = await screen.findByDisplayValue("150");
    const width = field(L.field.innerWidthMm);
    await user.clear(width);
    await user.type(width, "1900");
    await user.clear(gusset);
    // Rộng trong 1900: 2 × 950 không nhỏ hơn rộng
    await user.type(gusset, "950");
    expect(
      await screen.findByText(VEHICLE_TYPE_FIELD_MESSAGES.gussetTooLargeForBox),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.form.submitEdit })).toBeDisabled();
    await user.clear(gusset);
    await user.click(screen.getByRole("button", { name: L.form.submitEdit }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    // PUT thay thế toàn bộ: khe góc trống gửi 0, không bỏ trường
    expect(put.mock.calls[0]?.[1]).toMatchObject({
      gussetMm: 0,
      kind: "CONTAINER",
      status: "ACTIVE",
    });
  });

  it("gửi PUT kèm version của lần đọc và mã hiện tại", async () => {
    const { put, onClose } = renderDialog(apiVehicleType({ version: 3 }));
    const user = userEvent.setup();
    const payload = await screen.findByDisplayValue("28200");
    await user.clear(payload);
    await user.type(payload, "28000");
    await user.click(screen.getByRole("button", { name: L.form.submitEdit }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put).toHaveBeenCalledWith(
      `${PATH}/${VT_20DC_ID}`,
      expect.objectContaining({
        code: "20DC",
        maxPayloadKg: 28000,
        gussetMm: 150,
        status: "ACTIVE",
        version: 3,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("OPTIMISTIC_LOCK: tải lại dòng — form nạp bản mới và báo đã nạp lại", async () => {
    const { put, setServerRow } = renderDialog(apiVehicleType({ version: 0 }));
    const user = userEvent.setup();
    const name = await screen.findByDisplayValue("Container 20' Dry (20DC)");
    // Người khác sửa trước: BE đã ở version 1 với tên mới
    setServerRow(apiVehicleType({ version: 1, name: "Container 20 ft (đã đổi)" }));
    put.mockRejectedValueOnce(new ApiError(409, "OPTIMISTIC_LOCK", "changed"));
    await user.type(name, "!");
    await user.click(screen.getByRole("button", { name: L.form.submitEdit }));
    expect(await screen.findByDisplayValue("Container 20 ft (đã đổi)")).toBeInTheDocument();
    expect(screen.getByText(L.form.reloaded)).toBeInTheDocument();
  });
});
