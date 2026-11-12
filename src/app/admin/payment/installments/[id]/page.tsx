import { InstallmentDetail } from "@/features/payment";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InstallmentDetail id={id} />;
}
