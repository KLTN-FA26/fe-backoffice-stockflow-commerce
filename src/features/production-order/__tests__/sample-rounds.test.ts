import { describe, expect, it } from "vitest";

import { PRODUCTION_LIMITS } from "@/constants";

import { sampleFileProblems } from "../sample-files";
import { latestRound, sampleRoundActions, willExceedFreeRounds } from "../sample-lifecycle";
import { openRoundInput, physicalSampleInput, sampleRoundsDto } from "../sample-schemas";
import { actorOf, PRODUCTION_ACTORS } from "../__fixtures__/production-order";
import { sampleRound, sampleRounds } from "../__fixtures__/sample-rounds";

const coordinator = actorOf(PRODUCTION_ACTORS.coordinator);
const sales = actorOf(PRODUCTION_ACTORS.sales);
const file = (name: string, type: string) => new File(["x"], name, { type });
const sized = (name: string, type: string, size: number) => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("sampleRoundActions (docs 17 §4.3 bước 9, BR-24)", () => {
  it("Accepted + cờ duyệt mẫu + chưa có vòng → Điều phối sản xuất mở vòng 1", () => {
    const a = sampleRoundActions(sampleRounds({ status: "ACCEPTED", rounds: [] }), coordinator);
    expect(a).toEqual({ openFirst: true, openReprint: false, waitingRound: null });
  });

  it("Sample Pending, vòng gần nhất còn chờ khách → chỉ thêm tệp / ghi mẫu vật, chưa mở vòng mới", () => {
    const view = sampleRounds();
    const a = sampleRoundActions(view, coordinator);
    expect([a.openFirst, a.openReprint, a.waitingRound?.id]).toEqual([
      false,
      false,
      view.waitingRoundId,
    ]);
  });

  it("khách yêu cầu in lại → mở vòng in lại", () => {
    const view = sampleRounds({
      waitingRoundId: null,
      rounds: [sampleRound({ result: "REPRINT_REQUESTED", customerNote: "Màu đậm quá" })],
    });
    expect(sampleRoundActions(view, coordinator).openReprint).toBe(true);
  });

  it("khách đã duyệt → không mở thêm vòng", () => {
    const view = sampleRounds({
      status: "IN_PRODUCTION",
      waitingRoundId: null,
      rounds: [sampleRound({ result: "APPROVED" })],
    });
    expect(sampleRoundActions(view, coordinator)).toEqual({
      openFirst: false,
      openReprint: false,
      waitingRound: null,
    });
  });

  it("Sale chỉ đọc → không thao tác nào kể cả khi Accepted", () => {
    expect(sampleRoundActions(sampleRounds({ status: "ACCEPTED", rounds: [] }), sales)).toEqual({
      openFirst: false,
      openReprint: false,
      waitingRound: null,
    });
  });

  it("đơn không có cờ duyệt mẫu → không mở vòng", () => {
    const view = sampleRounds({ status: "ACCEPTED", sampleApprovalRequired: false, rounds: [] });
    expect(sampleRoundActions(view, coordinator).openFirst).toBe(false);
  });

  it("vòng gần nhất là vòng số lớn nhất", () => {
    expect(
      latestRound([sampleRound({ roundNo: 2, id: "r2" }), sampleRound({ roundNo: 3, id: "r3" })])
        ?.id,
    ).toBe("r3");
    expect(latestRound([])).toBeNull();
  });
});

describe("willExceedFreeRounds (14 BR-18)", () => {
  it("vòng tính phí làm vượt số lần miễn phí → cảnh báo; lỗi in thì không tính", () => {
    const view = { freeSampleRounds: 2, countedRounds: 2 };
    expect(willExceedFreeRounds(view, true)).toBe(true);
    expect(willExceedFreeRounds(view, false)).toBe(false);
    expect(willExceedFreeRounds({ freeSampleRounds: 3, countedRounds: 2 }, true)).toBe(false);
    expect(willExceedFreeRounds({ freeSampleRounds: null, countedRounds: 9 }, true)).toBe(false);
  });
});

describe("kiểm tệp mẫu", () => {
  it("nhận ảnh, MP4, QuickTime, WebM; từ chối loại khác và tệp > 100 MB", () => {
    expect(
      sampleFileProblems([file("a.jpg", "image/jpeg"), file("b.mov", "video/quicktime")]),
    ).toEqual([]);
    expect(sampleFileProblems([file("c.pdf", "application/pdf")])).toHaveLength(1);
    expect(
      sampleFileProblems([sized("d.mp4", "video/mp4", PRODUCTION_LIMITS.mediaMaxBytes + 1)]),
    ).toHaveLength(1);
  });

  it("tối đa 10 tệp mỗi lần", () => {
    const many = Array.from({ length: PRODUCTION_LIMITS.mediaPerUploadMax + 1 }, (_, i) =>
      file(`${i}.png`, "image/png"),
    );
    expect(sampleFileProblems(many)).toHaveLength(1);
  });
});

describe("schema vòng mẫu", () => {
  it("BR-24: vòng in lại bắt buộc lý do; vòng 1 không cần", () => {
    expect(
      openRoundInput(true).safeParse({ reprintReason: null, physicalSampleSentOn: "" }).success,
    ).toBe(false);
    expect(
      openRoundInput(true).safeParse({ reprintReason: "PRINT_DEFECT", physicalSampleSentOn: "" })
        .success,
    ).toBe(true);
    expect(
      openRoundInput(false).safeParse({ reprintReason: null, physicalSampleSentOn: "" }).success,
    ).toBe(true);
  });

  it("ngày gửi mẫu vật không sau hôm nay", () => {
    expect(physicalSampleInput.safeParse({ sentOn: "2999-01-01" }).success).toBe(false);
    expect(physicalSampleInput.safeParse({ sentOn: "2026-01-01" }).success).toBe(true);
  });

  it("parse hợp đồng BE SampleRounds (vòng chờ khách không có result)", () => {
    const parsed = sampleRoundsDto.parse(sampleRounds());
    expect(parsed.rounds[0]?.result).toBeUndefined();
  });
});
