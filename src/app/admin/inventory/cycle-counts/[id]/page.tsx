import { CycleCountRedirect } from "@/features/inventory";

/** Route cũ: phiếu kiểm kê giờ nằm trong tab theo kho của phiếu (spec §5.5). */
export default async function LegacyCycleCountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CycleCountRedirect id={id} />;
}
