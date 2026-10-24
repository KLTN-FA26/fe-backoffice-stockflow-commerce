/**
 * Đối chiếu sổ kép số kiện: mọi kiện đưa VÀO solver phải quay lại ở một trong ba chỗ — đã xếp
 * lên xe, chưa xếp được, hoặc hàng lấp đầy còn dư. (Gốc: `lib/nesting-reconcile.ts`.)
 *
 * Vì sao cần: solver trả `unplaced` dưới dạng dòng gộp kèm số lượng. Khi số lượng rơi khỏi payload,
 * client từng mặc định "1" và thiếu 4 kiện bị hiển thị thành 1 — tổng theo SKU lệch so với đơn mà
 * không ai thấy. Một phép cộng độc lập rẻ tiền bắt được loại lỗi đó (kiện rơi mất, đếm sai) trước
 * khi kết quả đi vào việc đặt xe. Dòng có số lượng không hợp lệ KHÔNG được coi là 0: đếm riêng và
 * làm phép đối chiếu thất bại, thay vì để số liệu sai lặng lẽ khớp.
 */

import type { Layout } from "../types";

export interface PieceLine {
  quantity: number;
}

export interface PieceCheck {
  /** Tổng số kiện đã đưa vào solver (hàng ưu tiên + hàng lấp đầy). */
  input: number;
  /** Tổng số kiện đã xếp lên các xe. */
  placed: number;
  /** Tổng số lượng các dòng ưu tiên không xếp được. */
  unplaced: number;
  /** Tổng số lượng hàng lấp đầy còn dư. */
  fillLeft: number;
  /** placed + unplaced + fillLeft — phần kết quả giải trình được. */
  accounted: number;
  /** accounted − input; khác 0 là lệch sổ. */
  difference: number;
  /** Số dòng có số lượng không phải số nguyên ≥ 0 (không tin được). */
  malformedLines: number;
  /** Sổ cân và không có dòng hỏng. */
  ok: boolean;
}

interface Tally {
  total: number;
  malformed: number;
}

function tally(lines: readonly PieceLine[]): Tally {
  let total = 0;
  let malformed = 0;
  for (const line of lines) {
    if (Number.isInteger(line.quantity) && line.quantity >= 0) total += line.quantity;
    else malformed += 1;
  }
  return { total, malformed };
}

export interface PieceCheckInput {
  /** Số kiện đưa vào: dòng ưu tiên đã gửi solver. */
  inputLines: readonly PieceLine[];
  /** Dòng hàng lấp đầy đã gửi solver (tuỳ chọn). */
  fillLines?: readonly PieceLine[];
  layouts: readonly Pick<Layout, "boxes">[];
  /** Dòng ưu tiên solver báo không xếp được. */
  unplacedLines: readonly PieceLine[];
  /** Dòng lấp đầy solver báo còn dư. */
  fillLeftLines?: readonly PieceLine[];
}

export function checkPieces(input: PieceCheckInput): PieceCheck {
  const sentPriority = tally(input.inputLines);
  const sentFill = tally(input.fillLines ?? []);
  const unplaced = tally(input.unplacedLines);
  const fillLeft = tally(input.fillLeftLines ?? []);
  const placed = input.layouts.reduce((sum, layout) => sum + layout.boxes.length, 0);

  const sent = sentPriority.total + sentFill.total;
  const accounted = placed + unplaced.total + fillLeft.total;
  const malformedLines =
    sentPriority.malformed + sentFill.malformed + unplaced.malformed + fillLeft.malformed;
  return {
    input: sent,
    placed,
    unplaced: unplaced.total,
    fillLeft: fillLeft.total,
    accounted,
    difference: accounted - sent,
    malformedLines,
    ok: accounted === sent && malformedLines === 0,
  };
}
