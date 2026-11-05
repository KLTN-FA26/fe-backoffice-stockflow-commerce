import { createMutation } from "@/lib/api/query-factory";

import { rebuildReports } from "./api";
import { reportingKeys } from "./queries";

/** Rebuild changes every number on the section, so all reporting queries are refreshed. */
export const useRebuildReports = createMutation(rebuildReports, {
  invalidate: [reportingKeys.all],
  showErrorToast: false,
});
