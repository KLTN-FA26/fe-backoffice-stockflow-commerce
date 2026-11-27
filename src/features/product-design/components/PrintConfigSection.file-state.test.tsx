/**
 * The section when the stored `.glb` limits what may be saved (BE `ModelFileRules`, origin/develop d47ed4ae): a template
 * written before files were required (free edits only, no activation), one whose area ↔ mesh table the BE refuses
 * (nothing without a new file), and a save whose stored file is not the measured one.
 */
import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import {
  printConfigMockFaults,
  resetPrintConfigMockStore,
} from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { plantTemplate } from "../mock-backend-test-utils";
import { BAG_BODY } from "../test-fixtures";
import {
  cupTree,
  DEFAULTS_SECTION,
  EDIT_BUTTON,
  editStored,
  EMPTY_VARIANT,
  glbFile,
  loaderOf,
  renderSection,
  REPLACE_FILE,
  saveStored,
} from "./print-config-test-utils";

vi.setConfig({ testTimeout: 60_000 });
configure({ asyncUtilTimeout: 45_000 });

const SAVE = { name: "Lưu cấu hình in" };
const OLD_FILE = { url: "u", name: "old.glb", sizeBytes: 16, checksum: "c".repeat(64) };

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

async function setSeam(user: ReturnType<typeof userEvent.setup>, seam: string) {
  await screen.findByRole("region", DEFAULTS_SECTION);
  const field = screen.getByLabelText("Mép dán (mm)");
  await user.clear(field);
  await user.type(field, seam);
}

describe("a template written before files were required (no file)", () => {
  it("says only the free fields can change, and saves them as one JSON PUT with the stored figures untouched", async () => {
    plantTemplate({ model: plantModel(), surfaces: [] });
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup();
    renderSection(EMPTY_VARIANT);
    await editStored(user);
    expect(await screen.findByText("Cấu hình cũ chưa có file 3D")).toBeInTheDocument();
    expect(screen.getByText(/chỉ sửa được tên, giới hạn tải lên/)).toBeInTheDocument();

    await setSeam(user, "6");
    expect(screen.getByText(/Chỉ lưu các giá trị sửa được khi chưa có file/)).toBeInTheDocument();
    await saveStored(user);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const body = put.mock.calls[0]?.[1];
    expect(body).not.toBeInstanceOf(FormData);
    expect(body).toMatchObject({
      version: 4,
      model: { seamMm: 6, topDiameterMm: 90.123456, heightMm: 110 },
    });
    const defaults = within(await screen.findByRole("table", { name: "Số không lấy từ file 3D" }));
    await waitFor(() =>
      expect(defaults.getByRole("row", { name: /Mép dán.*6,0 mm/ })).toBeInTheDocument(),
    );
  });

  it.each([
    ["an empty table (as every template before the migration)", []],
    ["a partial table", BAG_BODY.surfaces.slice(0, 2)],
  ])(
    "a bag with %s saves a free field: one JSON PUT, four areas, the table as stored",
    async (_name, table) => {
      const bag = BAG_BODY.model;
      if (bag.kind !== "parametric-bag") throw new Error("bag fixture");
      plantTemplate({ model: bag, areas: BAG_BODY.printAreas, surfaces: table });
      const put = vi.spyOn(api, "put");
      const user = userEvent.setup();
      renderSection(EMPTY_VARIANT);
      await editStored(user);
      expect(await screen.findByText("Cấu hình cũ chưa có file 3D")).toBeInTheDocument();
      await screen.findByRole("region", DEFAULTS_SECTION);
      const margin = screen.getByLabelText("Lề an toàn (mm)");
      await user.clear(margin);
      await user.type(margin, "6");
      await saveStored(user);
      await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
      const body = put.mock.calls[0]?.[1] as {
        printAreas: { code: string; safeMarginMm: number }[];
        model3d: unknown;
        model: unknown;
      };
      expect(body.printAreas.map((a) => [a.code, a.safeMarginMm])).toEqual([
        ["FRONT", 6],
        ["BACK", 6],
        ["LEFT", 6],
        ["RIGHT", 6],
      ]);
      expect(body.model3d).toEqual({ surfaces: table });
      expect(body.model).toMatchObject({ widthMm: bag.widthMm, heightMm: bag.heightMm });
      // the BE (mock) took it: the saved margin shows, no error
      await screen.findByRole("button", EDIT_BUTTON); // the save went back to the view mode
      expect(screen.queryByText("Không lưu được cấu hình in")).not.toBeInTheDocument();
    },
  );

  it("is not offered activation, and says why", async () => {
    plantTemplate();
    renderSection(EMPTY_VARIANT);
    expect(
      await screen.findByText(/Chưa kích hoạt được: cấu hình chưa có file 3D/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kích hoạt" })).not.toBeInTheDocument();
  });
});

/** A cup whose stored figures have more decimals than the screen shows. */
function plantModel() {
  return {
    kind: "parametric-cup" as const,
    topDiameterMm: 90.123456,
    bottomDiameterMm: 60,
    heightMm: 110,
    rimMm: 3,
    seamMm: 8,
    bandTopOffsetMm: 6,
    bandBottomOffsetMm: 8,
    material: "paper-white" as const,
  };
}

describe("a template with a file whose area ↔ mesh table the BE refuses", () => {
  const plantBroken = () =>
    plantTemplate({ file: OLD_FILE, surfaces: [{ printAreaCode: "BODY", meshName: "Body" }] });

  it("names the area, blocks every save without a new file, and offers no activation", async () => {
    plantBroken();
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup();
    renderSection(EMPTY_VARIANT);
    await editStored(user);
    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent("File 3D đang lưu không khớp các vùng in");
    expect(notice).toHaveTextContent("Mesh của vùng in BODY phải tên là print:BODY.");
    expect(
      screen.getByText(/Chưa kích hoạt được: file 3D đang lưu chưa có đủ mesh/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kích hoạt" })).not.toBeInTheDocument();

    await setSeam(user, "6");
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
    expect(screen.getByText("Cần chọn file .glb để lưu cấu hình này.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: SAVE.name }));
    expect(put).not.toHaveBeenCalled();
  });

  it("a new file with the print:BODY mesh fixes it in one multipart PUT", async () => {
    plantBroken();
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup({ applyAccept: true });
    renderSection({ ...EMPTY_VARIANT, loadModel: loaderOf(cupTree()) });
    await editStored(user);
    await screen.findByText("File 3D đang lưu không khớp các vùng in");
    await user.upload(screen.getByLabelText(REPLACE_FILE), glbFile("fixed.glb"));
    await screen.findByText("Nhận ra: Ly");
    await saveStored(user);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]?.[1]).toBeInstanceOf(FormData);
    await waitFor(() =>
      expect(screen.queryByText("File 3D đang lưu không khớp các vùng in")).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole("button", { name: "Kích hoạt" })).toBeInTheDocument();
  });
});

describe("a stored file that is not the measured one", () => {
  it("is an error, not a success: the sentence, the chosen file kept, the template reloaded", async () => {
    printConfigMockFaults.storeOtherBytes = true;
    const get = vi.spyOn(api, "get");
    const user = userEvent.setup({ applyAccept: true });
    renderSection({ loadModel: loaderOf(cupTree()) });
    await editStored(user);
    await screen.findByRole("table", { name: "Số đo lấy từ file 3D" });
    await user.upload(screen.getByLabelText(REPLACE_FILE), glbFile("new.glb"));
    await screen.findByText("Nhận ra: Ly");
    const readsBefore = get.mock.calls.length;
    await saveStored(user);
    const alert = await screen.findByText(/Máy chủ đã lưu một file khác với file đã dùng để đo/);
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("File: new.glb")).toBeInTheDocument();
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(readsBefore));
  });
});
