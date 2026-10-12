import { LoadingScreen } from "@/features/shipping/components/LoadingScreen";

export default async function LoadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LoadingScreen id={id} />;
}
