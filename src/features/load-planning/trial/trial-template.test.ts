/**
 * File mẫu "Tải file mẫu" (`public/templates/easycargo-trial-template.xlsx`) phải đọc được bằng chính parser của màn:
 * tiêu đề khớp tên cột parser mong đợi, dòng đơn vị là xentimét, các dòng ví dụ hợp lệ.
 */
import { resolve } from "node:path";

import { readSheet } from "read-excel-file/node";
import { describe, expect, it } from "vitest";

import { TRIAL_TEMPLATE } from "@/constants";

import { normalizeRows, parseTrialRows } from "./trial-parse";

describe("file mẫu EasyCargo", () => {
  it("parser đọc được: đủ cột, xentimét, ví dụ hợp lệ, không dòng bị bỏ", async () => {
    const rows = await readSheet(resolve(process.cwd(), "public", TRIAL_TEMPLATE.href.slice(1)));
    const { lines, skipped, summary } = parseTrialRows(normalizeRows(rows));
    expect(skipped).toEqual([]);
    expect(summary).toMatchObject({ rows: 3, groups: 2, totalPieces: 40, unitLabel: "xentimét" });
    expect(lines[0]).toMatchObject({
      name: "SW1701-1 5HK2394A",
      lengthMm: 900,
      widthMm: 720,
      heightMm: 1310,
    });
    expect(lines[1]?.rotatable).toBe(false);
  });
});
