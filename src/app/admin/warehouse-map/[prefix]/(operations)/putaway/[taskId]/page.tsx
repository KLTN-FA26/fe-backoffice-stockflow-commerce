import { PutawayTaskDetail } from "@/features/putaway";

/** Cất một thùng (docs 05 §4.3) trong tab theo kho. */
export default async function WorkspacePutawayTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <PutawayTaskDetail taskId={decodeURIComponent(taskId)} />;
}
