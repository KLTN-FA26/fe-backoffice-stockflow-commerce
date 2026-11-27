import { describe, expect, it } from "vitest";

import { returnRowJson } from "./__fixtures__/screen";
import { matchesReturnRow } from "./list-filters";
import { returnRowDtoSchema } from "./schemas";

const row = returnRowDtoSchema.parse(returnRowJson());

describe("matchesReturnRow", () => {
  it("không lọc → khớp", () => {
    expect(matchesReturnRow(row, { rtReason: "", rtChannel: "" })).toBe(true);
  });

  it("lọc lý do và nguồn theo đúng mã BE", () => {
    expect(matchesReturnRow(row, { rtReason: "PRINT_DEFECT", rtChannel: "" })).toBe(true);
    expect(matchesReturnRow(row, { rtReason: "WRONG_ITEM", rtChannel: "" })).toBe(false);
    expect(matchesReturnRow(row, { rtReason: "", rtChannel: "PORTAL" })).toBe(true);
    expect(matchesReturnRow(row, { rtReason: "PRINT_DEFECT", rtChannel: "BACK_OFFICE" })).toBe(
      false,
    );
  });
});
