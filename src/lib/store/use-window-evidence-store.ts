import { create } from "zustand";

interface SelectedMessage {
  customerId: string;
  messageId: string;
}

/** Tin khách vừa chọn ở chat để điền vào hộp thoại dời cửa sổ giao trong cùng phiên làm việc. */
export const useWindowEvidenceStore = create<{
  selected: SelectedMessage | null;
  select: (message: SelectedMessage) => void;
  clear: () => void;
}>((set) => ({
  selected: null,
  select: (selected) => set({ selected }),
  clear: () => set({ selected: null }),
}));
