import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PICK_LINE_ERROR_MESSAGES, PICK_LINE_LABELS } from "@/constants";

import { useLocationScan } from "./useLocationScan";

const EXPECTED = "HN-A01-01-01-A";

function setup(current = "") {
  const accept = vi.fn();
  const reject = vi.fn();
  const view = renderHook(() => useLocationScan({ expected: EXPECTED, current, accept, reject }));
  return { ...view, accept, reject };
}

describe("useLocationScan", () => {
  it("mã đúng (khác hoa thường, thừa khoảng trắng) → nhận MÃ CỦA DÒNG, không phải chữ đã gõ", () => {
    const { result, accept } = setup();
    act(() => result.current.onScan(" hn-a01-01-01-a "));
    expect(accept).toHaveBeenCalledWith(EXPECTED);
  });

  it("mã sai → báo vị trí đúng, không nhận; lặp lại cùng lỗi thì seq tăng để được đọc lại", () => {
    const { result, accept, reject } = setup();
    act(() => result.current.onScan("HN-STAGE-01"));
    const first = result.current.feedback;
    expect(first).toMatchObject({
      tone: "danger",
      message: PICK_LINE_ERROR_MESSAGES.locationMismatch(EXPECTED),
    });
    act(() => result.current.onScan("HN-STAGE-01"));
    expect(result.current.feedback?.seq).toBeGreaterThan(first?.seq ?? 0);
    expect(accept).not.toHaveBeenCalled();
    expect(reject).toHaveBeenCalledTimes(2);
  });

  it("đã nhận vị trí → phản hồi đúng; lỗi BE trả về ô hiện khi chưa nhận và seq theo serverSeq", () => {
    expect(setup(EXPECTED).result.current.feedback).toEqual({
      tone: "positive",
      message: PICK_LINE_LABELS.locationOk(EXPECTED),
    });
    const view = renderHook(
      ({ seq }) =>
        useLocationScan({
          expected: EXPECTED,
          current: "",
          accept: vi.fn(),
          serverMessage: "x",
          serverSeq: seq,
        }),
      { initialProps: { seq: 1 } },
    );
    const before = view.result.current.feedback?.seq ?? 0;
    view.rerender({ seq: 2 });
    expect(view.result.current.feedback?.seq).toBeGreaterThan(before);
  });
});
