import { WORKSPACE_PATHS } from "@/constants";
import { WorkspaceRedirect } from "@/lib/workspace";

/** Route cũ: Cất hàng giờ nằm trong tab theo kho — `?warehouse=` → `/admin/warehouse-map/{prefix}/putaway` (spec §5.5). */
export default async function LegacyPutawayPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string | string[] }>;
}) {
  const { warehouse } = await searchParams;
  return (
    <WorkspaceRedirect
      warehouseId={typeof warehouse === "string" ? warehouse : null}
      path={WORKSPACE_PATHS.putaway}
      keepQuery
    />
  );
}
