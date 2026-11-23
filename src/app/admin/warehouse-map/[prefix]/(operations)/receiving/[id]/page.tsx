import { ReceivingReceiptDetail } from "@/features/receipt/components/workspace/ReceivingReceiptDetail";

/** Kiểm đếm / xác nhận phiếu theo Đơn sản xuất (docs 03 §4.1) trong tab theo kho. */
export default async function WorkspaceReceivingReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReceivingReceiptDetail id={decodeURIComponent(id)} />;
}
