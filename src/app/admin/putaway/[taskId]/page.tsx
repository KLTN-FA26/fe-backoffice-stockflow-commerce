import { PutawayTaskRedirect } from "@/features/putaway";

/** Route cũ: nhiệm vụ cất hàng giờ nằm trong tab theo kho của nhiệm vụ (spec §5.5). */
export default async function LegacyPutawayTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <PutawayTaskRedirect taskId={decodeURIComponent(taskId)} />;
}
