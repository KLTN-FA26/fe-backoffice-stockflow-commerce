import { describe, expect, it } from "vitest";

import {
  isWaybillImportFile,
  WAYBILL_IMPORT_ACCEPT,
  WAYBILL_IMPORT_EXTENSIONS,
} from "./waybill-import-file";

describe("isWaybillImportFile", () => {
  it("accepts .csv and .xlsx whatever the case, and nothing else", () => {
    for (const name of [
      "van-don.csv",
      "VAN-DON.CSV",
      "van don (1).xlsx",
      "Van-Don.XLSX",
      " a.csv ",
    ]) {
      expect(isWaybillImportFile({ name }), name).toBe(true);
    }
    for (const name of [
      "van-don.xls",
      "van-don.pdf",
      "van-don.csv.txt",
      "van-don",
      "xlsx",
      ".csvx",
      "",
    ]) {
      expect(isWaybillImportFile({ name }), name).toBe(false);
    }
  });

  it("offers the same extensions in the file picker", () => {
    for (const extension of WAYBILL_IMPORT_EXTENSIONS) {
      expect(WAYBILL_IMPORT_ACCEPT).toContain(extension);
    }
  });
});
