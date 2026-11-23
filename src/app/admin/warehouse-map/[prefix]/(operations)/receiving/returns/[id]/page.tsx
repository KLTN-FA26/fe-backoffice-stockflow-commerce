import { ReceivingReturnDetail } from "@/features/return";

/** Quét LPN / xác nhận phiếu hàng hoàn (docs 03 §4.2) trong tab theo kho. */
export default async function WorkspaceReceivingReturnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReceivingReturnDetail id={decodeURIComponent(id)} />;
}
