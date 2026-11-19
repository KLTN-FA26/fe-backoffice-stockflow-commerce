import { useState } from "react";

import type { UseQueryResult } from "@tanstack/react-query";

export type RowsEditorStatus = "loading" | "error" | "ready";

export interface RowsEditor<Row extends { key: string }> {
  rows: Row[];
  status: RowsEditorStatus;
  retry: () => void;
  /** Sửa dòng đang hiện (thêm / xoá / đổi ô). */
  setRows: (next: Row[]) => void;
  /** Bản người dùng đã sửa so với bản đã lưu. */
  dirty: boolean;
  /** Ghi nhận rằng `saved` là bản đã lưu ở BE (sau khi PUT thành công): bảng và mốc so sánh đổi theo. */
  markSaved: (saved: Row[]) => void;
}

/**
 * State một bảng dòng của hộp thoại hãng. Hãng đã có (`carrierId`) thì đọc danh sách đã lưu MỘT lần rồi giữ bản đang sửa
 * (lần tải lại sau không ghi đè dòng người dùng đang gõ); hãng mới thì bắt đầu rỗng. Chưa tải xong hoặc tải lỗi thì bảng
 * KHÔNG ghi được (`status` ≠ ready, `dirty` luôn false) — không bao giờ gửi PUT thay cả danh sách từ một bảng chưa đọc.
 */
export function useRowsEditor<Row extends { key: string }, Rec>(options: {
  /** Hãng đã lưu ở BE; `undefined` = hãng mới (chưa có gì để đọc). */
  carrierId: string | undefined;
  /** Bảng có hiện không (chỉ đọc / ghi khi kiểu kết nối dùng bảng). */
  enabled: boolean;
  query: UseQueryResult<Rec[]>;
  toRows: (records: readonly Rec[]) => Row[];
  signature: (rows: readonly Row[]) => string;
}): RowsEditor<Row> {
  const { carrierId, enabled, query, toRows, signature } = options;
  /** Bản đang sửa + mốc so sánh (chữ ký bản đã lưu); `null` = chưa có gì để sửa (chưa đọc xong). */
  const [state, setState] = useState<{ rows: Row[]; baseline: string } | null>(null);
  // Lần đọc ĐẦU TIÊN (hoặc hãng mới) quyết định bản bắt đầu; các lần tải lại sau không đụng tới dòng người dùng đang gõ.
  if (enabled && state === null) {
    const initial = !carrierId ? [] : query.data ? toRows(query.data) : null;
    if (initial) setState({ rows: initial, baseline: signature(initial) });
  }
  const status: RowsEditorStatus = state
    ? "ready"
    : carrierId && query.isError
      ? "error"
      : "loading";
  return {
    rows: state?.rows ?? [],
    status,
    retry: () => void query.refetch(),
    setRows: (next) => setState((current) => (current ? { ...current, rows: next } : current)),
    dirty: state !== null && signature(state.rows) !== state.baseline,
    markSaved: (saved) => setState({ rows: saved, baseline: signature(saved) }),
  };
}

/** Bảng không cần đọc riêng (đã có sẵn từ dữ liệu hãng, vd bảng lý do giao thất bại): luôn `ready`. */
export function useStaticRowsEditor<Row extends { key: string }>(
  initial: () => Row[],
  signature: (rows: readonly Row[]) => string,
): RowsEditor<Row> {
  const [rows, setRows] = useState<Row[]>(initial);
  const [baseline, setBaseline] = useState<string>(() => signature(rows));
  return {
    rows,
    status: "ready",
    retry: () => undefined,
    setRows,
    dirty: signature(rows) !== baseline,
    markSaved: (saved) => {
      setRows(saved);
      setBaseline(signature(saved));
    },
  };
}
