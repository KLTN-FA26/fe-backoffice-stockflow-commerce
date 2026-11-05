import { LoadScreen } from "@/features/shipping/components/LoadScreen";

export default async function LoadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LoadScreen id={id} />;
}
