import { PickingTaskRedirect } from "@/features/fulfillment/components/PickingTaskRedirect";

/** Route cũ: trạm kiểm thùng giờ nằm trong tab theo kho của task (spec §5.5). */
export default async function LegacyPackingTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PickingTaskRedirect id={id} scope="packing" />;
}
