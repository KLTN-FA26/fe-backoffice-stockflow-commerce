import { WORKSPACE_PATHS } from "@/constants";
import { WorkspaceRedirect } from "@/lib/workspace";

/** Route cũ: Kiểm thùng giờ nằm trong tab theo kho — `?warehouse=` → `/admin/warehouse-map/{prefix}/packing` (spec §5.5). */
export default async function LegacyPackingPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string | string[] }>;
}) {
  const { warehouse } = await searchParams;
  return (
    <WorkspaceRedirect
      warehouseId={typeof warehouse === "string" ? warehouse : null}
      path={WORKSPACE_PATHS.packing}
      keepQuery
    />
  );
}
