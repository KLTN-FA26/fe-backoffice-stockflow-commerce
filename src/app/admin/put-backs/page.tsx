import { WORKSPACE_PATHS } from "@/constants";
import { WorkspaceRedirect } from "@/lib/workspace";

/** Route cũ: Cất lại giờ nằm trong tab theo kho — `?warehouse=` → `/admin/warehouse-map/{prefix}/put-backs` (spec §5.5). */
export default async function LegacyPutBacksPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string | string[] }>;
}) {
  const { warehouse } = await searchParams;
  return (
    <WorkspaceRedirect
      warehouseId={typeof warehouse === "string" ? warehouse : null}
      path={WORKSPACE_PATHS.putBacks}
      keepQuery
    />
  );
}
