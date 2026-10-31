/**
 * Nhãn thùng — mutation in / in lại (SCRUM-473). Không đổi dữ liệu nào nên không invalidate; lỗi hiện trong dialog in.
 */

import { createMutation } from "@/lib/api/query-factory";

import { printCartonLabels } from "./carton-api";

import type { CartonLabelsPdf, PrintCartonLabelsInput } from "./carton-api";

export const usePrintCartonLabels = createMutation<PrintCartonLabelsInput, CartonLabelsPdf>(
  printCartonLabels,
  { showErrorToast: false },
);
