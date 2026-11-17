import { describe, expect, it } from "vitest";

import {
  PRINT_CONFIG_CONTEXT_ERROR_MESSAGES,
  PRINT_CONFIG_ERROR_MESSAGES,
} from "@/constants/labels-print-config";
import { ApiError } from "@/lib/api/error";

import { ModelFileMismatchError, printConfigErrorMessage } from "../errors";
import { BAG_BODY } from "../test-fixtures";
import { saveErrorView } from "./save-error";

import type { ApiFieldErrorBody } from "@/lib/api/error";

const FALLBACK = "Không thực hiện được thao tác. Vui lòng thử lại.";
/** An ApiError as the client builds it from a BE body with `fieldErrors[{ field, message, code }]`. */
const surfacesError = (list: ApiFieldErrorBody[]) =>
  new ApiError(
    422,
    "PRINT_CONFIG_SURFACES_INVALID",
    "English",
    Object.fromEntries(list.map(({ field, message }) => [field, message])),
    undefined,
    undefined,
    list,
  );

describe("saveErrorView", () => {
  it("maps the BE code to the feature's sentence, not the BE's message", () => {
    const view = saveErrorView(new ApiError(409, "OPTIMISTIC_LOCK", "English text"), null);
    expect(view.general).toContain("vừa được người khác sửa");
    expect(view.general).not.toContain("English");
    expect(view.fields).toEqual([]);
  });

  it.each([
    [
      409,
      "PRINT_CONFIG_MODEL_FILE_REQUIRED",
      "Số đo này lấy từ file 3D, hãy tải file mới cùng số đo",
    ],
    [422, "PRINT_CONFIG_SURFACES_INVALID", "Bảng ghép vùng in với mesh"],
    [400, "VALIDATION_FAILED", "không qua bước quét virus"],
    [413, "PAYLOAD_TOO_LARGE", "File model quá lớn (tối đa 10 MB)"],
    [415, "UNSUPPORTED_MEDIA_TYPE", "File model phải là .glb"],
    [429, "RATE_LIMITED", "đang bận kiểm tra file"],
    [409, "OPTIMISTIC_LOCK", "vừa được người khác sửa"],
    [409, "PRODUCT_NOT_CUSTOMIZABLE", "không phải sản phẩm in theo thiết kế"],
    [409, "PRINT_CONFIG_CODE_TAKEN", "Mã cấu hình in đã có"],
    [400, "PRINT_CONFIG_INVALID", "chưa hợp lệ"],
    [404, "PRINT_CONFIG_NOT_FOUND", "Không tìm thấy cấu hình in"],
    [409, "CONFLICT", "đã ngừng bán"],
    [403, "FORBIDDEN_X", "không có quyền"],
  ])("%i %s has its own Vietnamese sentence", (status, code, part) => {
    const text = saveErrorView(new ApiError(status, code, "English"), null).general;
    expect(text).toContain(part);
    expect(text).not.toContain("English");
  });

  it("by code, never by message: the same code with any message says the same", () => {
    const a = saveErrorView(
      new ApiError(409, "PRINT_CONFIG_MODEL_FILE_REQUIRED", "model.heightMm"),
      null,
    );
    const b = saveErrorView(
      new ApiError(409, "PRINT_CONFIG_MODEL_FILE_REQUIRED", "anything"),
      null,
    );
    expect(a.general).toBe(b.general);
    // and a 409 of another code does not get the file sentence
    expect(saveErrorView(new ApiError(409, "OPTIMISTIC_LOCK", "file"), null).general).not.toContain(
      "file 3D",
    );
  });

  it("a create refused for its missing file says so in the words of a create", () => {
    const error = new ApiError(409, "PRINT_CONFIG_MODEL_FILE_REQUIRED", "x");
    expect(saveErrorView(error, null, undefined, "create").general).toBe(
      PRINT_CONFIG_CONTEXT_ERROR_MESSAGES.create.PRINT_CONFIG_MODEL_FILE_REQUIRED,
    );
  });

  it("413 and 415 without a code still map by status (the BFF's own refusal)", () => {
    expect(saveErrorView(new ApiError(413, "HTTP_413", "x"), null).general).toBe(
      PRINT_CONFIG_ERROR_MESSAGES.PAYLOAD_TOO_LARGE,
    );
    expect(saveErrorView(new ApiError(415, "HTTP_415", "x"), null).general).toBe(
      PRINT_CONFIG_ERROR_MESSAGES.UNSUPPORTED_MEDIA_TYPE,
    );
  });

  it("codes that no longer exist get the fallback", () => {
    for (const code of [
      "MODEL_FILE_PAIR_REQUIRED",
      "MODEL_FILE_CHECKSUM_MISMATCH",
      "MODEL_FILE_REJECTED",
      "SAVE_OUTCOME_UNKNOWN",
    ]) {
      expect(saveErrorView(new ApiError(409, code, "x"), null).general).toBe(FALLBACK);
    }
  });

  it("422 PRINT_CONFIG_SURFACES_INVALID: each field error's code names the print area it is about", () => {
    const sent = {
      printAreas: BAG_BODY.printAreas,
      surfaces: [
        { printAreaCode: "FRONT" as const, meshName: "print:FRONT" },
        { printAreaCode: "BACK" as const, meshName: "Back" },
        { printAreaCode: "BACK" as const, meshName: "print:BACK" },
        { printAreaCode: "RIGHT" as const, meshName: "" },
      ],
    };
    const view = saveErrorView(
      surfacesError([
        { field: "model3d.surfaces[1].meshName", message: "x", code: "MeshNameMismatch" },
        { field: "model3d.surfaces[2].printAreaCode", message: "x", code: "PrintAreaDuplicate" },
        { field: "model3d.surfaces[3].meshName", message: "x", code: "Size" },
        { field: "model3d.surfaces[0].printAreaCode", message: "x", code: "PrintAreaUnknown" },
        {
          field: "model3d.surfaces",
          message: "Print area LEFT has no mesh",
          code: "PrintAreaMissing",
        },
        { field: "model3d.surfaces[7].meshName", message: "x", code: "Size" },
      ]),
      "parametric-bag",
      sent,
    );
    expect(view.general).toContain("Mesh của vùng in BACK phải tên là print:BACK");
    expect(view.general).toContain("Vùng in BACK xuất hiện hai lần trong bảng ghép");
    expect(view.general).toContain("Tên mesh của vùng in RIGHT phải dài từ 1 đến 100 ký tự");
    expect(view.general).toContain("Bảng ghép nêu vùng in FRONT mà mẫu không có");
    // PrintAreaMissing has no row: the area is the one the sent table left out, not read from the English message.
    expect(view.general).toContain("Vùng in LEFT chưa có mesh print:LEFT");
    expect(view.general).toContain("Dòng 8 của bảng ghép bị từ chối");
    expect(view.general).not.toContain("has no mesh");
    expect(view.fields).toEqual([]); // the table comes from the file: its rows are not form fields
  });

  it("puts the server's field errors on the fields they name", () => {
    const error = new ApiError(422, "VALIDATION_FAILED", "x", {
      "printAreas[0].safeMarginMm": "must be >= 0",
      "model.seamMm": "bad",
      "model.material": "bad",
      surfaces: "unknown",
    });
    const view = saveErrorView(error, "parametric-bag");
    expect(view.fields.map((f) => f.field).sort()).toEqual([
      "bagMaterial",
      "safeMarginMm",
      "seamMm",
    ]);
  });

  it("a plain error gets the fallback sentence", () => {
    expect(saveErrorView(new Error("boom"), null).general).toBe(FALLBACK);
  });
});

describe("printConfigErrorMessage by context", () => {
  const ACTIVATE = PRINT_CONFIG_CONTEXT_ERROR_MESSAGES.activate;
  const message = (status: number, code: string) =>
    printConfigErrorMessage(new ApiError(status, code, "x"), "activate");

  it("activation words for the file, the table and an old template without a model", () => {
    expect(message(409, "PRINT_CONFIG_MODEL_FILE_REQUIRED")).toBe(
      ACTIVATE.PRINT_CONFIG_MODEL_FILE_REQUIRED,
    );
    expect(message(422, "PRINT_CONFIG_SURFACES_INVALID")).toBe(
      ACTIVATE.PRINT_CONFIG_SURFACES_INVALID,
    );
    expect(message(400, "PRINT_CONFIG_INVALID")).toBe(ACTIVATE.PRINT_CONFIG_INVALID);
    // other codes keep their general sentence
    expect(message(409, "OPTIMISTIC_LOCK")).toBe(PRINT_CONFIG_ERROR_MESSAGES.OPTIMISTIC_LOCK);
  });

  it("a stored file that is not the measured one has its own sentence (reloaded, choose the file again)", () => {
    expect(printConfigErrorMessage(new ModelFileMismatchError())).toBe(
      PRINT_CONFIG_ERROR_MESSAGES.FILE_STORED_DIFFERENT,
    );
  });
});
