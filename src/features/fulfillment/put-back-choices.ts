import { defaultPutBackLocation, putBackLocationOptions } from "./pick-line-selectors";

import type { WarehouseLocation } from "@/lib/references/warehouse-locations";
import type { CodeOption } from "./pick-line-selectors";
import type { PutBackRow } from "./types";

/**
 * Where a carton of the put-back queue may be put back, from the warehouse map (docs 07 BR-12): the usable bins - and,
 * when no bin takes the carton, the OVERFLOW areas the BE names; a damaged carton goes to a quarantine area. The map
 * not loaded leaves the bin it was picked from (the BE still checks the bin) and the OVERFLOW areas; a quarantine
 * carton then has no suggestion - the user types the area.
 */
export function putBackChoices(
  row: Pick<PutBackRow, "fromLocationCode" | "quarantine" | "overflowLocationCodes">,
  locations: readonly WarehouseLocation[] | undefined,
  mapFailed: boolean,
): { fallback: boolean; options: CodeOption[]; defaultCode: string } {
  const quarantine = row.quarantine === true;
  const overflow = row.overflowLocationCodes ?? [];
  const fallback = mapFailed && !quarantine;
  return {
    fallback,
    options: fallback
      ? [
          { value: row.fromLocationCode, label: row.fromLocationCode },
          ...putBackLocationOptions(undefined, false, overflow),
        ]
      : putBackLocationOptions(locations, quarantine, overflow),
    defaultCode: fallback
      ? row.fromLocationCode
      : defaultPutBackLocation(row.fromLocationCode, locations, quarantine, overflow),
  };
}
