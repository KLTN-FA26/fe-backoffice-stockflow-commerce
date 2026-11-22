import { PutawayTaskDetail } from "@/features/putaway";

export default async function PutawayTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <PutawayTaskDetail taskId={decodeURIComponent(taskId)} />;
}
