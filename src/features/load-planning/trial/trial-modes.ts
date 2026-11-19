/**
 * Các chế độ chọn xe của "Ước tính thử" (WF4-TRIAL-EST; docs 09 §4.2 "Chế độ chọn xe") cho nhóm radio. "Chỉnh tay"
 * không có ở đây: đó là kéo thả kiện trên kế hoạch đã lưu rồi tính lại một xe (§4.2 bước 3, BR-11), không phải cách
 * chọn xe trước khi tính — xem `TRIAL_SELECTION_MODES`.
 */

import { TRIAL_LABELS, TRIAL_SELECTION_MODES } from "@/constants";

import type { TrialSelectionMode } from "@/constants";
import type { SelectionModeOption } from "../components/estimate/SelectionModeField";

export const TRIAL_MODE_OPTIONS: readonly SelectionModeOption<TrialSelectionMode>[] =
  TRIAL_SELECTION_MODES.map((mode) => ({
    value: mode,
    label: TRIAL_LABELS.modes[mode],
    hint: TRIAL_LABELS.modeHints[mode],
  }));
