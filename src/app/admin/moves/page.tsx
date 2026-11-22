import { WORKSPACE_PATHS } from "@/constants";
import { WorkspaceRedirect } from "@/lib/workspace";

/** Route cũ: Di chuyển nội bộ giờ nằm trong tab theo kho (spec §5.5) — không mang kho thì về gốc tab để chọn kho. */
export default async function LegacyMovesPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string | string[] }>;
}) {
  const { warehouse } = await searchParams;
  return (
    <WorkspaceRedirect
      warehouseId={typeof warehouse === "string" ? warehouse : null}
      path={WORKSPACE_PATHS.moves}
      keepQuery
    />
  );
}
