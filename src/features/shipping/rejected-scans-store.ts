import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { STORAGE_KEYS } from "@/constants";

export interface RejectedScan {
  /** Khoá cho React — đổi mỗi lần mã được ghi lại (lên đầu danh sách). */
  key: number;
  packageCode: string;
  message: string;
}

interface RejectedScansState {
  /** Theo từng chuyến — mở chuyến khác không lẫn danh sách. */
  byLoad: Record<string, RejectedScan[]>;
  seq: number;
  add: (loadId: string, codes: readonly string[], message: string) => void;
  clear: (loadId: string) => void;
}

/**
 * Danh sách mã quét không thành công của từng chuyến, sống NGOÀI màn quét: sang màn biên bản rồi quay
 * lại, F5, hay ô quét biến mất (chuyến đổi trạng thái ở máy khác) đều không được làm mất danh sách
 * kiện phải gỡ khỏi xe. Lưu sessionStorage — trạng thái làm việc của máy / tab này, không phải dữ
 * liệu máy chủ, không chia sẻ qua link.
 */
export const useRejectedScansStore = create<RejectedScansState>()(
  persist(
    (set) => ({
      byLoad: {},
      seq: 0,
      add: (loadId, codes, message) => {
        if (codes.length === 0) return;
        set((state) => {
          let seq = state.seq;
          const added = codes.map((packageCode) => ({ key: ++seq, packageCode, message }));
          const codesAdded = new Set(codes);
          // Mới nhất lên đầu. Một mã chỉ một dòng (quét lại → thay dòng cũ) để số đếm = số kiện phải
          // xử lý. KHÔNG giới hạn số dòng: cắt bớt có thể đẩy mất kiện đang nằm sai trên xe (danh
          // sách tự gọn nhờ bỏ trùng + bỏ mã đã lên xe; vùng hiển thị có thanh cuộn)
          const kept = (state.byLoad[loadId] ?? []).filter(
            (item) => !codesAdded.has(item.packageCode),
          );
          return { seq, byLoad: { ...state.byLoad, [loadId]: [...added.reverse(), ...kept] } };
        });
      },
      clear: (loadId) =>
        set((state) => {
          const { [loadId]: _removed, ...rest } = state.byLoad;
          return { byLoad: rest };
        }),
    }),
    {
      name: STORAGE_KEYS.shipmentRejectedScans,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ byLoad: state.byLoad, seq: state.seq }),
    },
  ),
);
